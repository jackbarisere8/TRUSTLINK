import { randomUUID } from "node:crypto";
import type { JobAggregate } from "../../db/repository";
import type { JobCommand } from "../../validation/schemas";
import type { Actor } from "../participants";

export function appendReview(a: JobAggregate, actor: Actor, command: Extract<JobCommand, { type: "REVIEW" }>, now: string) {
  a.reviews.push({ id: randomUUID(), jobId: a.job.id, reviewerId: actor.id, reviewerName: a.job.clientName || "Client", rating: command.rating, comment: command.comment, submittedAt: now });
}
