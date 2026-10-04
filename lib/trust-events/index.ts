export type TrustEventActorType = "PROVIDER" | "CLIENT_PARTICIPANT" | "ADMIN" | "SYSTEM";

export const trustEventDefinitions = {
  JOB_CREATED: { label: "Record created", actors: ["PROVIDER"] },
  JOB_SENT: { label: "Ready to share", actors: ["PROVIDER"] },
  JOB_VIEWED: { label: "Record opened", actors: ["SYSTEM"] },
  JOB_ACCEPTED: { label: "Agreement accepted", actors: ["CLIENT_PARTICIPANT"] },
  PAYMENT_RECORDED: { label: "Payment recorded by provider", actors: ["PROVIDER"] },
  WORK_STARTED: { label: "Work started", actors: ["PROVIDER"] },
  DELIVERY_SUBMITTED: { label: "Delivery submitted", actors: ["PROVIDER"] },
  REVISION_REQUESTED: { label: "Revision requested", actors: ["CLIENT_PARTICIPANT"] },
  DELIVERY_APPROVED: { label: "Delivery approved", actors: ["CLIENT_PARTICIPANT"] },
  JOB_COMPLETED: { label: "Transaction completed", actors: ["PROVIDER"] },
  JOB_CANCELLED: { label: "Transaction cancelled", actors: ["PROVIDER"] },
  DISPUTE_OPENED: { label: "Dispute opened", actors: ["PROVIDER", "CLIENT_PARTICIPANT"] },
  DISPUTE_RESPONDED: { label: "Other party responded", actors: ["PROVIDER", "CLIENT_PARTICIPANT"] },
  DISPUTE_RESOLVED: { label: "Dispute resolved", actors: ["ADMIN"] },
  CLIENT_REVIEWED: { label: "Client review submitted", actors: ["CLIENT_PARTICIPANT"] },
  CLIENT_LINK_REISSUED: { label: "Participant link replaced", actors: ["PROVIDER"] },
  CLIENT_LINK_REVOKED: { label: "Participant access revoked", actors: ["PROVIDER"] },
} as const satisfies Record<string,{ label: string; actors: readonly TrustEventActorType[] }>;

export type TrustEventType = keyof typeof trustEventDefinitions;
export const trustEventTypes = Object.keys(trustEventDefinitions) as [TrustEventType,...TrustEventType[]];
export const eventLabels = Object.fromEntries(
  trustEventTypes.map(type => [type,trustEventDefinitions[type].label]),
) as Record<TrustEventType,string>;

/**
 * The public agreement can show lifecycle milestones, but never internal page
 * reads or capability-management operations. Keep this allowlist in sync with
 * the database public_transaction_events view.
 */
export const publicTrustEventTypes = [
  "JOB_CREATED", "JOB_SENT", "JOB_ACCEPTED", "PAYMENT_RECORDED", "WORK_STARTED",
  "DELIVERY_SUBMITTED", "REVISION_REQUESTED", "DELIVERY_APPROVED", "JOB_COMPLETED",
  "JOB_CANCELLED", "DISPUTE_OPENED", "DISPUTE_RESOLVED", "CLIENT_REVIEWED",
] as const satisfies readonly TrustEventType[];
export type PublicTrustEventType = typeof publicTrustEventTypes[number];
const publicTrustEventTypeSet = new Set<string>(publicTrustEventTypes);
export function isPublicTrustEventType(type: string): type is PublicTrustEventType {
  return publicTrustEventTypeSet.has(type);
}

export function trustEventAllowsActor(type: TrustEventType, actor: TrustEventActorType) {
  return (trustEventDefinitions[type].actors as readonly TrustEventActorType[]).includes(actor);
}
