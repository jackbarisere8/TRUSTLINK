import { randomUUID } from "node:crypto";
import type { JobAggregate } from "../../db/repository";
import type { JobCommand } from "../../validation/schemas";
import type { Actor } from "../participants";

export function appendDelivery(a: JobAggregate, actor: Actor, command: Extract<JobCommand, { type: "DELIVER" }>, now: string) {
  a.deliveries.push({ id: randomUUID(), jobId: a.job.id, description: command.description, fileUrls: command.files, submittedBy: actor.id, submittedAt: now });
}
