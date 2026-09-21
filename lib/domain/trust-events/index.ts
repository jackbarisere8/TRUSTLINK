import { randomUUID } from "node:crypto";
import type { JobAggregate } from "../../db/repository";
import type { TrustEventRecord } from "../../db/types";
import type { Actor } from "../participants";
export function appendEvent(a: JobAggregate, actor: Actor, type: string, metadata: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  a.events.push({ id: randomUUID(), jobId: a.job.id, actorId: actor.id, actorType: actor.type, eventType: type, occurredAt: now, metadata, createdAt: now });
}
/** Public history never includes actor identifiers, payment references, or private evidence. */
export function publicEvents(events: TrustEventRecord[]) {
  return events.filter(e => e.eventType !== "CLIENT_LINK_REISSUED").map(({ id, eventType, occurredAt }) => ({ id, eventType, occurredAt }));
}
