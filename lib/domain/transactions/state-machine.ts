import { appendPayment } from "../payments";
import { appendDelivery } from "../deliveries";
import { appendRevision } from "../revisions";
import { appendDispute, resolveDispute } from "../disputes";
import { appendReview } from "../reviews";
import type { JobAggregate } from "../../db/repository";
import { acceptanceSchema, commandSchema, type JobCommand } from "../../validation/schemas";
import { DomainError } from "../errors";
import { hashToken, newToken, validCapability, requireParticipant, requireRole, type Actor } from "../participants";
import { appendEvent as event } from "../trust-events";
import { transactionRules, nextStatus, type TransactionAction } from "./policy";
import { checkRequest, type MutationRequest } from "./request";

function requireAction(a: JobAggregate, actor: Actor, action: TransactionAction) {
  const rule = transactionRules[action];
  requireRole(actor, [...rule.roles]);
  if (!rule.from.includes(a.job.status)) throw new DomainError("This action is not available in the current transaction state.");
}

export function acceptAggregate(current: JobAggregate, token: string, input: unknown, request: MutationRequest) {
  if (!validCapability(current.job, token)) throw new DomainError("This participant link is invalid or expired. Ask the provider for a new link.");
  const parsed = acceptanceSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("Provide your name, valid email, and confirmation of the terms.");
  const details = parsed.data;
  const actor: Actor = { id: "client:" + current.job.id, type: "CLIENT_PARTICIPANT", name: details.name };
  requireParticipant(current, actor);
  const operation = checkRequest(current, actor, { type: "ACCEPT", ...details }, request);
  if (operation.replayed) return current;
  requireAction(current, actor, "ACCEPT");
  if (current.job.clientTokenUsed) throw new DomainError("This agreement has already been accepted.");
  const a = structuredClone(current);
  Object.assign(a.job, { clientName: details.name, clientEmail: details.email, clientPhone: details.phone, clientTokenUsed: true, status: nextStatus(current.job.status, "ACCEPT"), updatedAt: new Date().toISOString(), version: current.job.version + 1 });
  event(a, actor, transactionRules.ACCEPT.event, { identityStatus: "SELF_PROVIDED", ...operation.metadata });
  return a;
}

export function transition(current: JobAggregate, actor: Actor, input: JobCommand, request: MutationRequest): { aggregate: JobAggregate; token?: string; replayed: boolean } {
  requireParticipant(current, actor);
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("Check the fields and try again.");
  const command = parsed.data;
  const operation = checkRequest(current, actor, command, request);
  if (operation.replayed) return { aggregate: current, replayed: true };
  requireAction(current, actor, command.type);
  if (actor.type === "CLIENT_PARTICIPANT" && !current.job.clientTokenUsed) throw new DomainError("Accept the agreement first.");
  const a = structuredClone(current), now = new Date().toISOString();
  let token: string | undefined;
  let metadata: Record<string, unknown> = {};
  switch (command.type) {
    case "PAYMENT":
      if (a.payments.length) throw new DomainError("Payment has already been recorded.");
      appendPayment(a, command, now);
      metadata = { paymentMode: "RECORDED", verificationStatus: "NOT_VERIFIED", recordedBy: "PROVIDER" }; break;
    case "START": case "APPROVE": case "CANCEL": break;
    case "DELIVER":
      appendDelivery(a, actor, command, now); metadata = { fileCount: command.files.length }; break;
    case "REVISE":
      appendRevision(a, actor, command.description, now); metadata = { revisionNumber: a.terms.revisionsUsed }; break;
    case "COMPLETE": a.job.completedAt = now; break;
    case "DISPUTE":
      appendDispute(a, actor, command, now); metadata = { contestedTerm: command.contestedTerm }; break;
    case "RESOLVE":
      resolveDispute(a, actor, command, now); metadata = { outcome: command.outcome }; break;
    case "REVIEW":
      if (a.reviews.length) throw new DomainError("A review has already been submitted.");
      appendReview(a, actor, command, now); metadata = { rating: command.rating }; break;
    case "ROTATE_INVITE":
      token = newToken(); a.job.clientActionTokenHash = hashToken(token); a.job.clientTokenExpiresAt = new Date(Date.now() + 30*86400000).toISOString(); break;
  }
  a.job.status = nextStatus(current.job.status, command.type, command.type === "RESOLVE" ? command.outcome : undefined);
  event(a, actor, transactionRules[command.type].event, { ...metadata, ...operation.metadata });
  a.job.version = current.job.version + 1; a.job.updatedAt = now;
  return { aggregate: a, token, replayed: false };
}
