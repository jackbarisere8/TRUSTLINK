import { randomUUID } from "node:crypto";
import { acceptAggregate as accept, transition as apply } from "../../lib/domain/transactions/state-machine";
import type { JobAggregate } from "../../lib/db/repository";
import type { MutationRequest } from "../../lib/domain/transactions/request";

// Test setup supplies explicit versions and fresh operation IDs, as the UI does.
export const requestFor = (a: JobAggregate): MutationRequest => ({ id: randomUUID(), expectedVersion: a.job.version });
export function acceptAggregate(a: JobAggregate, token: string, details: { name: string; email: string; phone?: string }, request = requestFor(a)) {
  return accept(a, token, { ...details, confirmed: true }, request);
}
export function transition(a: JobAggregate, actor: Parameters<typeof apply>[1], command: Parameters<typeof apply>[2], request = requestFor(a)) {
  return apply(a, actor, command, request);
}
