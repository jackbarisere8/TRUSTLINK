// Compatibility exports only; all lifecycle rules live in transactions/state-machine.ts.
export { createAggregate } from "./jobs/index";
export { acceptAggregate, transition } from "./transactions/state-machine";
export { validCapability, requireParticipant, hashToken, newToken, type Actor } from "./participants";
export { publicEvents } from "./trust-events";
