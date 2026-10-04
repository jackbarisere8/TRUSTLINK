import { randomUUID } from "node:crypto";
import type { JobAggregate } from "../../db/repository";
import type { JobCommand } from "../../validation/schemas";
import type { Actor } from "../participants";
import { DomainError } from "../errors";

export function appendDispute(a: JobAggregate, actor: Actor, command: Extract<JobCommand, { type: "DISPUTE" }>, now: string) {
  a.disputes.push({ id: randomUUID(), jobId: a.job.id, raisedBy: actor.type === "PROVIDER" ? "PROVIDER" : "CLIENT", contestedTerm: command.contestedTerm, claimDescription: command.description, evidenceUrls: command.files, disputeStatus: "OPEN", createdAt: now, updatedAt: now });
}

export function respondToDispute(a: JobAggregate, actor: Actor, response: string, now: string) {
  const dispute = a.disputes.find(d => d.disputeStatus === "OPEN");
  if (!dispute) throw new DomainError("No open dispute is awaiting a response.");
  const expectedActor = dispute.raisedBy === "PROVIDER" ? "CLIENT_PARTICIPANT" : "PROVIDER";
  if (actor.type !== expectedActor) throw new DomainError("Only the other transaction party can respond to this dispute.");
  if (dispute.responseFromOtherParty) throw new DomainError("The other party has already responded to this dispute.");
  Object.assign(dispute, { responseFromOtherParty: response, disputeStatus: "UNDER_REVIEW", updatedAt: now });
  return dispute;
}

export function resolveDispute(a: JobAggregate, actor: Actor, command: Extract<JobCommand, { type: "RESOLVE" }>, now: string) {
  const dispute = a.disputes.find(d => d.disputeStatus === "OPEN" || d.disputeStatus === "UNDER_REVIEW");
  if (!dispute) throw new DomainError("No open dispute was found.");
  if (command.outcome === "IN_PROGRESS" && !a.payments.length) {
    throw new DomainError("Payment must be recorded before work can resume. Cancel this record and agree new terms if necessary.");
  }
  Object.assign(dispute, { disputeStatus: "RESOLVED", resolutionNotes: command.notes, resolvedBy: actor.id, resolvedAt: now, updatedAt: now });
  return dispute;
}
