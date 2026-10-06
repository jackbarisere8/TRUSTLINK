import type { JobAggregate } from "../../db/repository";

export const bookingStatuses = ["REQUESTED", "DECLINED", "CANCELLED", "EXPIRED", "TERMS_SENT", "CONFIRMED"] as const;
export type BookingStatus = typeof bookingStatuses[number];

export const bookingEventTypes = [
  "REQUEST_CREATED", "PROVIDER_DECLINED", "CUSTOMER_CANCELLED", "REQUEST_EXPIRED",
  "TERMS_SENT", "CLIENT_ACCEPTED_TRANSACTION", "TRANSACTION_CANCELLED",
  "SLOT_HOLD_CREATED", "SLOT_HOLD_RELEASED", "SLOT_HOLD_CONFIRMED",
] as const;
export type BookingEventType = typeof bookingEventTypes[number];

export type MarketplaceActor = { id: string; type: "CUSTOMER" | "PROVIDER" | "ADMIN" };
export type BookingLocationMode = "REMOTE" | "PROVIDER_LOCATION" | "CUSTOMER_LOCATION";

export interface BookingRecord {
  id: string;
  publicId: string;
  customerId: string;
  providerId: string;
  providerServiceId: string;
  requestText: string;
  requestedStart: string;
  requestedEnd: string;
  timezone: "Africa/Lagos";
  durationMinutes: number;
  locationMode: BookingLocationMode;
  stateCode?: string;
  lgaCode?: string;
  broadArea?: string;
  privateAddress?: string;
  budgetMin?: string;
  budgetMax?: string;
  currency: "NGN";
  status: BookingStatus;
  version: number;
  expiresAt: string;
  linkedJobId?: string;
  holdExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingEventRecord {
  id: string;
  bookingId: string;
  eventSequence: number;
  actorId: string;
  actorType: MarketplaceActor["type"] | "SYSTEM";
  eventType: BookingEventType;
  requestId?: string;
  commandHash?: string;
  expectedVersion?: number;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface BookingSlotHoldRecord {
  id: string;
  bookingId: string;
  providerId: string;
  startsAt: string;
  endsAt: string;
  status: "ACTIVE" | "CONFIRMED" | "RELEASED" | "EXPIRED";
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  releasedAt?: string;
}

export type BookingMutationRequest = { id: string; expectedVersion: number };
export type BookingCommandResult = { booking: BookingRecord; replayed: boolean };

export type ProviderConversionContext = {
  providerLocation: string;
  priorTransactionCount: number;
  serviceTitle: string;
  categoryName: string;
};

export interface MarketplaceRepository {
  getBooking(id: string, actor: MarketplaceActor): Promise<BookingRecord | null>;
  listBookings(actor: MarketplaceActor): Promise<BookingRecord[]>;
  createBooking(record: BookingRecord, actor: MarketplaceActor, request: BookingMutationRequest, commandHash: string): Promise<BookingCommandResult>;
  transitionBooking(id: string, actor: MarketplaceActor, nextStatus: "DECLINED" | "CANCELLED", request: BookingMutationRequest, commandHash: string, occurredAt: string): Promise<BookingCommandResult>;
  getProviderConversionContext(booking: BookingRecord): Promise<ProviderConversionContext>;
  convertBooking(id: string, actor: MarketplaceActor, request: BookingMutationRequest, commandHash: string, aggregate: JobAggregate, occurredAt: string): Promise<BookingCommandResult>;
  expireBookings(now: string): Promise<number>;
}
