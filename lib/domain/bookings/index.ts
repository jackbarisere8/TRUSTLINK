import { createHash, randomBytes } from "node:crypto";
import { createAggregate } from "../jobs";
import { ConflictError, DomainError } from "../errors";
import { authorizeBookingTransition, requireBookingParticipant } from "./state-machine";
import { bookingMutationRequestSchema, createBookingSchema, finalTermsSchema } from "./schemas";
import type { BookingRecord, MarketplaceActor, MarketplaceRepository } from "./types";

export * from "./types";
export * from "./state-machine";

export const bookingRequestTtlMs = 72 * 60 * 60 * 1000;
export const bookingSlotHoldTtlMs = 24 * 60 * 60 * 1000;

const commandHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const publicBookingId = () => randomBytes(12).toString("hex");

export class BookingService {
  constructor(private readonly repository: MarketplaceRepository, private readonly now: () => Date = () => new Date()) {}

  async request(actor: MarketplaceActor, input: unknown, requestInput: unknown) {
    if (actor.type !== "CUSTOMER") throw new DomainError("Sign in as a customer to request a booking.");
    const parsed = createBookingSchema.safeParse(input);
    const request = bookingMutationRequestSchema.safeParse(requestInput);
    if (!parsed.success) throw new DomainError(parsed.error.issues[0].message);
    if (!request.success || request.data.expectedVersion !== 0) throw new DomainError("Refresh before submitting this booking request.");
    const now = this.now();
    const start = new Date(parsed.data.requestedStart);
    if (start.getTime() <= now.getTime()) throw new DomainError("Choose a booking time in the future.");
    const record: BookingRecord = {
      id: parsed.data.bookingId,
      publicId: publicBookingId(),
      customerId: actor.id,
      providerId: parsed.data.providerId,
      providerServiceId: parsed.data.providerServiceId,
      requestText: parsed.data.requestText,
      requestedStart: start.toISOString(),
      requestedEnd: new Date(start.getTime()+parsed.data.durationMinutes*60_000).toISOString(),
      timezone: "Africa/Lagos",
      durationMinutes: parsed.data.durationMinutes,
      locationMode: parsed.data.locationMode,
      ...(parsed.data.stateCode ? { stateCode: parsed.data.stateCode } : {}),
      ...(parsed.data.lgaCode ? { lgaCode: parsed.data.lgaCode } : {}),
      ...(parsed.data.broadArea ? { broadArea: parsed.data.broadArea } : {}),
      ...(parsed.data.privateAddress ? { privateAddress: parsed.data.privateAddress } : {}),
      ...(parsed.data.budgetMin ? { budgetMin: parsed.data.budgetMin } : {}),
      ...(parsed.data.budgetMax ? { budgetMax: parsed.data.budgetMax } : {}),
      currency: "NGN",
      status: "REQUESTED",
      version: 0,
      expiresAt: new Date(now.getTime()+bookingRequestTtlMs).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    return this.repository.createBooking(record, actor, request.data, commandHash({ type: "REQUEST", input: parsed.data }));
  }

  async get(id: string, actor: MarketplaceActor) {
    const booking = await this.repository.getBooking(id, actor);
    if (!booking) throw new DomainError("Booking not found.");
    return booking;
  }

  list(actor: MarketplaceActor) { return this.repository.listBookings(actor); }

  private async transition(id: string, actor: MarketplaceActor, nextStatus: "DECLINED" | "CANCELLED", requestInput: unknown) {
    const request = bookingMutationRequestSchema.safeParse(requestInput);
    if (!request.success) throw new DomainError("Refresh before updating this booking.");
    const current = await this.get(id, actor);
    requireBookingParticipant(current, actor);
    if (current.status !== nextStatus) authorizeBookingTransition(current, actor, nextStatus);
    else if ((nextStatus === "DECLINED" && actor.type !== "PROVIDER") || (nextStatus === "CANCELLED" && actor.type !== "CUSTOMER")) {
      throw new DomainError("You don't have permission to perform this booking action.");
    }
    try {
      return await this.repository.transitionBooking(id, actor, nextStatus, request.data, commandHash({ type: nextStatus }), this.now().toISOString());
    } catch (error) {
      if (error instanceof ConflictError) throw error;
      throw error;
    }
  }

  decline(id: string, actor: MarketplaceActor, request: unknown) { return this.transition(id, actor, "DECLINED", request); }
  cancel(id: string, actor: MarketplaceActor, request: unknown) { return this.transition(id, actor, "CANCELLED", request); }

  async prepareTerms(id: string, actor: MarketplaceActor, input: unknown, requestInput: unknown) {
    if (actor.type !== "PROVIDER") throw new DomainError("Only the selected provider can prepare final terms.");
    const terms = finalTermsSchema.safeParse(input);
    const request = bookingMutationRequestSchema.safeParse(requestInput);
    if (!terms.success) throw new DomainError(terms.error.issues[0].message);
    if (!request.success) throw new DomainError("Refresh before preparing final terms.");
    const booking = await this.get(id, actor);
    requireBookingParticipant(booking, actor);
    const context = await this.repository.getProviderConversionContext(booking);
    const created = createAggregate({
      creationId: booking.id,
      providerId: actor.id,
      title: context.serviceTitle,
      category: context.categoryName,
      scope: terms.data.scope,
      deliverables: terms.data.deliverables,
      price: terms.data.price,
      currency: "NGN",
      deadline: terms.data.deadline,
      revisions: terms.data.revisions,
      cancellationTerms: terms.data.cancellationTerms,
      sourceChannel: "TrustLink Marketplace",
      repeatUse: context.priorTransactionCount === 0 ? "FIRST" : "PROMPTED",
      providerLocation: context.providerLocation,
    });
    const result = await this.repository.convertBooking(
      id, actor, request.data,
      commandHash({ type: "TERMS_SENT", terms: terms.data }),
      created.aggregate, this.now().toISOString(),
    );
    return { ...result, token: result.replayed ? undefined : created.token };
  }

  expire(now = this.now()) { return this.repository.expireBookings(now.toISOString()); }
}
