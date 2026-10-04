// Compatibility exports only; all lifecycle rules live in transactions/state-machine.ts.
export { createAggregate } from "./jobs/index";
export { acceptAggregate, transition } from "./transactions/state-machine";
export { clientCapabilityExpiresAt, clientCapabilityLifetimeMs, clientParticipantDetailStatus, hasActiveStoredClientCapability, hasStoredClientCapability, transactionParticipants, validCapability, requireParticipant, hashToken, newToken, type Actor, type TransactionParticipant } from "./participants";
export { publicEvents } from "./trust-events";
