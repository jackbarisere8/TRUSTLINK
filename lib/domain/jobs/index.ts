import { randomUUID } from "node:crypto";
import type { JobAggregate } from "../../db/repository";
import type { CreateJobInput } from "../../db/types";
import { clientCapabilityExpiresAt, hashToken, newToken, type Actor } from "../participants";
import { appendEvent as event } from "../trust-events";
import { newPublicJobId } from "./public-id";
export function createAggregate(input: CreateJobInput) {
  const id = input.creationId || randomUUID(), now = new Date().toISOString(), token = newToken();
  const aggregate: JobAggregate = {
    job: { id, publicId: newPublicJobId(), providerId: input.providerId, version: 0, repeatUse: input.repeatUse, clientActionTokenHash: hashToken(token), clientTokenExpiresAt: clientCapabilityExpiresAt(), clientTokenUsed: false, status: "SENT", sourceChannel: input.sourceChannel, providerLocation: input.providerLocation || "Not provided", viewCount: 0, createdAt: now, updatedAt: now },
    terms: { id: randomUUID(), jobId: id, service: input.title, serviceCategory: input.category, scope: input.scope, deliverables: input.deliverables, price: input.price, currency: "NGN", deadline: input.deadline, revisionsIncluded: input.revisions, revisionsUsed: 0, cancellationTerms: input.cancellationTerms, createdAt: now },
    payments: [], deliveries: [], revisions: [], disputes: [], reviews: [], events: [],
  };
  const actor: Actor = { id: input.providerId, type: "PROVIDER", name: "" };
  event(aggregate, actor, "JOB_CREATED", { repeatUse: input.repeatUse, sourceChannel: input.sourceChannel }, now);
  event(aggregate, actor, "JOB_SENT", {}, now);
  return { aggregate, token };
}
