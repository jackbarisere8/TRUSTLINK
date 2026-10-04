import { randomUUID } from "node:crypto";
import type { JobAggregate } from "../../db/repository";
import type { PublicTrustEvent, TrustEventRecord } from "../../db/types";
import { isPublicTrustEventType, trustEventAllowsActor, type PublicTrustEventType, type TrustEventType } from "../../trust-events";
import type { Actor } from "../participants";
export function appendEvent(a: JobAggregate, actor: Actor, type: TrustEventType, metadata: Record<string, unknown> = {}, occurredAt = new Date().toISOString()) {
  if (!trustEventAllowsActor(type,actor.type)) throw new Error(`Invalid ${actor.type} actor for ${type}`);
  const previous = a.events.at(-1);
  if (previous && Date.parse(occurredAt) < Date.parse(previous.occurredAt)) throw new Error("Trust event time cannot move backwards");
  a.events.push({
    id: randomUUID(), jobId: a.job.id, actorId: actor.id, actorType: actor.type, eventType: type,
    eventSequence: (previous?.eventSequence || 0) + 1, occurredAt, metadata, createdAt: occurredAt,
  });
}
/** Public history never includes actor identifiers, payment references, or private evidence. */
export function publicEvents(events: TrustEventRecord[]): PublicTrustEvent[] {
  return [...events].sort((a,b) => a.eventSequence-b.eventSequence)
    .flatMap(({ id, eventType, occurredAt }) => isPublicTrustEventType(eventType)
      ? [{ id, eventType: eventType as PublicTrustEventType, occurredAt }]
      : []);
}
