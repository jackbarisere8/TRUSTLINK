import { randomUUID } from "node:crypto";
import type { JobAggregate } from "../../db/repository";
import type { Actor } from "../participants";
import { DomainError } from "../errors";

export function appendRevision(a: JobAggregate, actor: Actor, description: string, now: string) {
  if (a.terms.revisionsUsed >= a.terms.revisionsIncluded) {
    throw new DomainError("The included revision limit has been reached. Contact the provider or open a dispute.");
  }
  a.terms.revisionsUsed++;
  a.revisions.push({ id: randomUUID(), jobId: a.job.id, revisionNumber: a.terms.revisionsUsed, description, requestedBy: actor.id, requestedAt: now });
}
