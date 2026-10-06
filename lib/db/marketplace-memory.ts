import "server-only";
import { randomUUID } from "node:crypto";
import type { JobAggregate } from "./repository";
import { ConflictError, DomainError } from "../domain/errors";
import { authorizeBookingTransition, bookingSlotHoldTtlMs, requireBookingParticipant } from "../domain/bookings";
import type {
  BookingCommandResult, BookingEventRecord, BookingMutationRequest, BookingRecord,
  BookingSlotHoldRecord, MarketplaceActor, MarketplaceRepository, ProviderConversionContext,
} from "../domain/bookings";

type ProviderSeed = ProviderConversionContext & { id: string; capacity?: number };
type ServiceSeed = { id: string; providerId: string; title: string; categoryName: string; published?: boolean };
export type MemoryMarketplaceSeed = { providers?: ProviderSeed[]; services?: ServiceSeed[] };

const clone = <T>(value: T): T => structuredClone(value);

export class MemoryMarketplaceRepository implements MarketplaceRepository {
  private bookings = new Map<string,BookingRecord>();
  private events = new Map<string,BookingEventRecord[]>();
  private holds = new Map<string,BookingSlotHoldRecord>();
  private transactions = new Map<string,JobAggregate>();
  private providers = new Map<string,ProviderSeed>();
  private services = new Map<string,ServiceSeed>();
  private failConversion = false;

  constructor(seed: MemoryMarketplaceSeed = {}) {
    for (const provider of seed.providers ?? []) this.providers.set(provider.id, clone(provider));
    for (const service of seed.services ?? []) this.services.set(service.id, clone(service));
  }

  simulateNextConversionFailure() { this.failConversion = true; }

  private visible(booking: BookingRecord, actor: MarketplaceActor) {
    requireBookingParticipant(booking, actor);
    const output = clone(booking);
    if (actor.type === "PROVIDER" && booking.status !== "CONFIRMED") delete output.privateAddress;
    return output;
  }

  async getBooking(id: string, actor: MarketplaceActor) {
    const booking = this.bookings.get(id);
    return booking ? this.visible(booking, actor) : null;
  }

  async listBookings(actor: MarketplaceActor) {
    return [...this.bookings.values()]
      .filter(booking => actor.type === "ADMIN" || (actor.type === "CUSTOMER" ? booking.customerId === actor.id : booking.providerId === actor.id))
      .sort((left,right) => right.createdAt.localeCompare(left.createdAt))
      .map(booking => this.visible(booking, actor));
  }

  private replay(bookingId: string, actor: MarketplaceActor, request: BookingMutationRequest, hash: string) {
    const event = this.events.get(bookingId)?.find(candidate => candidate.requestId === request.id);
    if (!event) return null;
    if (event.actorId !== actor.id || event.actorType !== actor.type || event.commandHash !== hash || event.expectedVersion !== request.expectedVersion) {
      throw new DomainError("This request identifier was already used for a different booking action.");
    }
    const booking = this.bookings.get(bookingId);
    if (!booking) throw new DomainError("Booking not found.");
    return { booking: this.visible(booking, actor), replayed: true } satisfies BookingCommandResult;
  }

  private append(bookingId: string, actorId: string, actorType: BookingEventRecord["actorType"], eventType: BookingEventRecord["eventType"], occurredAt: string, request?: BookingMutationRequest, hash?: string, metadata: Record<string,unknown> = {}) {
    const existing = this.events.get(bookingId) ?? [];
    existing.push({
      id: randomUUID(), bookingId, eventSequence: existing.length+1, actorId, actorType, eventType,
      ...(request ? { requestId: request.id, commandHash: hash, expectedVersion: request.expectedVersion } : {}),
      metadata: clone(metadata), occurredAt, createdAt: occurredAt,
    });
    this.events.set(bookingId, existing);
  }

  async createBooking(record: BookingRecord, actor: MarketplaceActor, request: BookingMutationRequest, hash: string) {
    const replay = this.replay(record.id, actor, request, hash);
    if (replay) return replay;
    if (actor.type !== "CUSTOMER" || record.customerId !== actor.id || record.version !== 0 || record.status !== "REQUESTED") {
      throw new DomainError("A new booking must belong to the signed-in customer.");
    }
    if (this.bookings.has(record.id)) throw new DomainError("That booking identifier is already in use.");
    const service = this.services.get(record.providerServiceId);
    if (!service?.published || service.providerId !== record.providerId || !this.providers.has(record.providerId)) {
      throw new DomainError("The selected provider service is not bookable.");
    }
    this.bookings.set(record.id,clone(record));
    this.append(record.id,actor.id,"CUSTOMER","REQUEST_CREATED",record.createdAt,request,hash);
    return { booking: clone(record), replayed: false };
  }

  private releaseHold(bookingId: string, status: "RELEASED" | "EXPIRED", occurredAt: string) {
    const hold = this.holds.get(bookingId);
    if (!hold || hold.status !== "ACTIVE") return;
    Object.assign(hold,{ status, expiresAt: undefined, releasedAt: occurredAt, updatedAt: occurredAt });
    this.append(bookingId,"system","SYSTEM","SLOT_HOLD_RELEASED",occurredAt,undefined,undefined,{ holdStatus: status });
  }

  async transitionBooking(id: string, actor: MarketplaceActor, nextStatus: "DECLINED" | "CANCELLED", request: BookingMutationRequest, hash: string, occurredAt: string) {
    const replay = this.replay(id,actor,request,hash);
    if (replay) return replay;
    const current = this.bookings.get(id);
    if (!current) throw new DomainError("Booking not found.");
    const eventType = authorizeBookingTransition(current,actor,nextStatus);
    if (current.version !== request.expectedVersion) throw new ConflictError();
    const next = clone(current);
    Object.assign(next,{ status: nextStatus, version: next.version+1, holdExpiresAt: undefined, updatedAt: occurredAt });
    this.bookings.set(id,next);
    this.append(id,actor.id,actor.type,eventType,occurredAt,request,hash);
    this.releaseHold(id,"RELEASED",occurredAt);
    return { booking: this.visible(next,actor), replayed: false };
  }

  async getProviderConversionContext(booking: BookingRecord) {
    const provider = this.providers.get(booking.providerId);
    const service = this.services.get(booking.providerServiceId);
    if (!provider || !service?.published || service.providerId !== booking.providerId) throw new DomainError("The selected provider service is not bookable.");
    return {
      providerLocation: provider.providerLocation,
      priorTransactionCount: provider.priorTransactionCount + [...this.transactions.values()].filter(transaction => transaction.job.providerId === booking.providerId).length,
      serviceTitle: service.title,
      categoryName: service.categoryName,
    };
  }

  async convertBooking(id: string, actor: MarketplaceActor, request: BookingMutationRequest, hash: string, aggregate: JobAggregate, occurredAt: string) {
    const replay = this.replay(id,actor,request,hash);
    if (replay) return replay;
    const current = this.bookings.get(id);
    if (!current) throw new DomainError("Booking not found.");
    requireBookingParticipant(current,actor);
    if (actor.type !== "PROVIDER" || current.providerId !== actor.id) throw new DomainError("Only the selected provider can prepare final terms.");
    if (current.status !== "REQUESTED") throw new DomainError("Only a requested booking can receive terms.");
    if (current.version !== request.expectedVersion) throw new ConflictError();
    if (Date.parse(current.expiresAt) <= Date.parse(occurredAt)) throw new DomainError("The booking request has expired.");
    if (aggregate.job.id !== current.id || aggregate.job.providerId !== actor.id) throw new DomainError("The converted transaction does not match this booking.");
    const provider = this.providers.get(actor.id);
    if (!provider) throw new DomainError("Provider profile not found.");
    await this.expireBookings(occurredAt);
    const overlaps = [...this.holds.values()].filter(hold => hold.providerId===actor.id && ["ACTIVE","CONFIRMED"].includes(hold.status) && Date.parse(hold.startsAt)<Date.parse(current.requestedEnd) && Date.parse(hold.endsAt)>Date.parse(current.requestedStart));
    if (overlaps.length >= (provider.capacity ?? 1)) throw new DomainError("The requested provider slot is no longer available.");
    if (this.transactions.has(aggregate.job.id)) throw new DomainError("This booking already has a transaction.");

    const next = clone(current);
    const holdExpiresAt = new Date(Date.parse(occurredAt)+bookingSlotHoldTtlMs).toISOString();
    Object.assign(next,{ status: "TERMS_SENT", version: next.version+1, linkedJobId: aggregate.job.id, holdExpiresAt, updatedAt: occurredAt });
    const hold: BookingSlotHoldRecord = {
      id: randomUUID(), bookingId: id, providerId: actor.id, startsAt: current.requestedStart, endsAt: current.requestedEnd,
      status: "ACTIVE", expiresAt: holdExpiresAt, createdAt: occurredAt, updatedAt: occurredAt,
    };
    if (this.failConversion) { this.failConversion=false; throw new Error("Simulated conversion persistence failure."); }
    this.transactions.set(aggregate.job.id,clone(aggregate));
    this.bookings.set(id,next);
    this.holds.set(id,hold);
    this.append(id,actor.id,"PROVIDER","TERMS_SENT",occurredAt,request,hash,{ jobId: aggregate.job.id });
    this.append(id,"system","SYSTEM","SLOT_HOLD_CREATED",occurredAt,undefined,undefined,{ expiresAt: holdExpiresAt });
    return { booking: this.visible(next,actor), replayed: false };
  }

  async expireBookings(now: string) {
    let changed=0;
    for (const current of [...this.bookings.values()]) {
      const expired = current.status === "REQUESTED" ? Date.parse(current.expiresAt)<=Date.parse(now) : current.status === "TERMS_SENT" && !!current.holdExpiresAt && Date.parse(current.holdExpiresAt)<=Date.parse(now);
      if (!expired) continue;
      const next=clone(current);
      Object.assign(next,{ status: "EXPIRED", version: next.version+1, holdExpiresAt: undefined, updatedAt: now });
      this.bookings.set(next.id,next);
      this.append(next.id,"system","SYSTEM","REQUEST_EXPIRED",now);
      this.releaseHold(next.id,"EXPIRED",now);
      changed++;
    }
    return changed;
  }

  confirmLinkedTransaction(jobId: string, occurredAt: string) {
    const current=[...this.bookings.values()].find(booking => booking.linkedJobId===jobId);
    const hold=current ? this.holds.get(current.id) : undefined;
    if (!current || current.status!=="TERMS_SENT" || !hold || hold.status!=="ACTIVE" || !hold.expiresAt || Date.parse(hold.expiresAt)<=Date.parse(occurredAt)) {
      throw new DomainError("The linked booking hold is no longer active.");
    }
    const next=clone(current);Object.assign(next,{status:"CONFIRMED",version:next.version+1,holdExpiresAt:undefined,updatedAt:occurredAt});
    Object.assign(hold,{status:"CONFIRMED",expiresAt:undefined,updatedAt:occurredAt});
    this.bookings.set(next.id,next);
    this.append(next.id,next.customerId,"CUSTOMER","CLIENT_ACCEPTED_TRANSACTION",occurredAt,undefined,undefined,{jobId});
    this.append(next.id,"system","SYSTEM","SLOT_HOLD_CONFIRMED",occurredAt,undefined,undefined,{jobId});
  }

  eventsFor(bookingId: string) { return clone(this.events.get(bookingId) ?? []); }
  holdFor(bookingId: string) { const hold=this.holds.get(bookingId); return hold ? clone(hold) : undefined; }
  linkedTransaction(jobId: string) { const transaction=this.transactions.get(jobId); return transaction ? clone(transaction) : undefined; }
}
