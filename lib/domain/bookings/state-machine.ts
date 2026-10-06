import { DomainError } from "../errors";
import type { BookingEventType, BookingRecord, BookingStatus, MarketplaceActor } from "./types";

export const bookingTransitions: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  REQUESTED: ["DECLINED", "CANCELLED", "EXPIRED", "TERMS_SENT"],
  TERMS_SENT: ["CANCELLED", "EXPIRED", "CONFIRMED"],
  DECLINED: [],
  CANCELLED: [],
  EXPIRED: [],
  CONFIRMED: [],
};

export function requireBookingParticipant(booking: BookingRecord, actor: MarketplaceActor) {
  if (actor.type === "ADMIN") return;
  if (actor.type === "CUSTOMER" && actor.id === booking.customerId) return;
  if (actor.type === "PROVIDER" && actor.id === booking.providerId) return;
  throw new DomainError("You don't have access to this booking.");
}

export function authorizeBookingTransition(booking: BookingRecord, actor: MarketplaceActor, nextStatus: "DECLINED" | "CANCELLED"): BookingEventType {
  requireBookingParticipant(booking, actor);
  if (!bookingTransitions[booking.status].includes(nextStatus)) throw new DomainError("That booking action is no longer available.");
  if (nextStatus === "DECLINED" && actor.type === "PROVIDER") return "PROVIDER_DECLINED";
  if (nextStatus === "CANCELLED" && actor.type === "CUSTOMER") return "CUSTOMER_CANCELLED";
  throw new DomainError("You don't have permission to perform this booking action.");
}
