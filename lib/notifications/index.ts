import type { NotificationIntentRecord, TrustEventRecord } from "../db/types";

export const notificationKinds = [
  "TRANSACTION_ACCEPTED",
  "PAYMENT_RECORDED",
  "DELIVERY_SUBMITTED",
  "REVISION_REQUESTED",
  "DISPUTE_RAISED",
  "TRANSACTION_COMPLETED",
] as const;
export type NotificationKind = typeof notificationKinds[number];

export const notificationRecipientRoles = ["PROVIDER", "CLIENT_PARTICIPANT", "ADMIN"] as const;
export type NotificationRecipientRole = typeof notificationRecipientRoles[number];

export const notificationCopy: Record<NotificationKind, { title: string; body: string }> = {
  TRANSACTION_ACCEPTED: {
    title: "Transaction accepted",
    body: "The client accepted the recorded agreement.",
  },
  PAYMENT_RECORDED: {
    title: "Payment recorded",
    body: "The provider recorded direct receipt. TrustLink has not verified the transfer.",
  },
  DELIVERY_SUBMITTED: {
    title: "Delivery submitted",
    body: "The provider submitted work for the client to review.",
  },
  REVISION_REQUESTED: {
    title: "Revision requested",
    body: "The client requested a revision to the submitted work.",
  },
  DISPUTE_RAISED: {
    title: "Transaction dispute opened",
    body: "A participant opened a dispute and the transaction is paused for review.",
  },
  TRANSACTION_COMPLETED: {
    title: "Transaction completed",
    body: "The provider marked the approved transaction complete.",
  },
};

function intent(event: TrustEventRecord, kind: NotificationKind, recipientRole: NotificationRecipientRole): NotificationIntentRecord {
  return {
    id: `${event.id}:${recipientRole}`,
    jobId: event.jobId,
    eventId: event.id,
    notificationKind: kind,
    recipientRole,
    createdAt: event.createdAt,
  };
}

/**
 * Transactional notification intents are a strict projection of immutable
 * trust events. They contain no address, delivery provider state, read state,
 * follower graph, or user-authored content.
 */
export function notificationIntentsForEvent(event: TrustEventRecord): NotificationIntentRecord[] {
  switch (event.eventType) {
    case "JOB_ACCEPTED": return [intent(event, "TRANSACTION_ACCEPTED", "PROVIDER")];
    case "PAYMENT_RECORDED": return [intent(event, "PAYMENT_RECORDED", "CLIENT_PARTICIPANT")];
    case "DELIVERY_SUBMITTED": return [intent(event, "DELIVERY_SUBMITTED", "CLIENT_PARTICIPANT")];
    case "REVISION_REQUESTED": return [intent(event, "REVISION_REQUESTED", "PROVIDER")];
    case "JOB_COMPLETED": return [intent(event, "TRANSACTION_COMPLETED", "CLIENT_PARTICIPANT")];
    case "DISPUTE_OPENED": {
      const counterpart = event.actorType === "PROVIDER" ? "CLIENT_PARTICIPANT"
        : event.actorType === "CLIENT_PARTICIPANT" ? "PROVIDER" : undefined;
      return [
        ...(counterpart ? [intent(event, "DISPUTE_RAISED", counterpart)] : []),
        intent(event, "DISPUTE_RAISED", "ADMIN"),
      ];
    }
    default: return [];
  }
}

export function notificationIntentsForEvents(events: readonly TrustEventRecord[]): NotificationIntentRecord[] {
  return events.flatMap(notificationIntentsForEvent);
}
