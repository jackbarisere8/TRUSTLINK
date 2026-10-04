import { appendPayment } from "../payments";
import { appendDelivery } from "../deliveries";
import { appendRevision } from "../revisions";
import { appendDispute, respondToDispute, resolveDispute } from "../disputes";
import { appendReview } from "../reviews";
import type { JobAggregate } from "../../db/repository";
import { acceptanceSchema, commandSchema, type JobCommand } from "../../validation/schemas";
import { DomainError } from "../errors";
import { clientCapabilityExpiresAt, hasStoredClientCapability, hashToken, newToken, validCapability, requireParticipant, requireRole, type Actor } from "../participants";
import { appendEvent as event } from "../trust-events";
import { transactionRules, nextStatus, type TransactionAction } from "./policy";
import { checkRequest, type MutationRequest } from "./request";
import { acceptedTermsSnapshot } from "./acceptance";

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
  event(a, actor, transactionRules.ACCEPT.event, {
    ...operation.metadata,
    participantDetailStatus: "SELF_PROVIDED",
    acceptedTerms: acceptedTermsSnapshot(a.terms),
  }, a.job.updatedAt);
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
      if (!/^\d+(\.\d{1,2})?$/.test(a.terms.price) || !Number.isFinite(Number(a.terms.price)) || Number(a.terms.price) <= 0 || a.terms.currency !== "NGN") {
        throw new DomainError("The agreed payment amount is invalid.");
      }
      appendPayment(a, command, now);
      metadata = { paymentMode: "RECORDED", amount: a.terms.price, currency: a.terms.currency, verificationStatus: "NOT_VERIFIED", recordedBy: "PROVIDER" }; break;
    case "START":
      if (current.job.status === "REVISION_REQUESTED" &&
          (a.revisions.length !== a.terms.revisionsUsed || !a.revisions.at(-1))) {
        throw new DomainError("The revision request record is incomplete.");
      }
      metadata = current.job.status === "REVISION_REQUESTED" ? { revisionNumber: a.terms.revisionsUsed } : {};
      break;
    case "APPROVE": {
      const delivery = a.deliveries.at(-1);
      if (!delivery) throw new DomainError("No submitted delivery is available to approve.");
      metadata = { deliveryId: delivery.id };
      break;
    }
    case "CANCEL": break;
    case "DELIVER":
      appendDelivery(a, actor, command, now);
      metadata = { deliveryId: a.deliveries.at(-1)!.id, fileCount: command.files.length };
      break;
    case "REVISE":
      appendRevision(a, actor, command.description, now);
      metadata = { revisionId: a.revisions.at(-1)!.id, revisionNumber: a.terms.revisionsUsed };
      break;
    case "COMPLETE": a.job.completedAt = now; break;
    case "DISPUTE":
      appendDispute(a, actor, command, now);
      metadata = { disputeId: a.disputes.at(-1)!.id, contestedTerm: command.contestedTerm, fileCount: command.files.length };
      break;
    case "RESPOND_DISPUTE": {
      const dispute = respondToDispute(a, actor, command.response, now);
      metadata = { disputeId: dispute.id };
      break;
    }
    case "RESOLVE":
      metadata = { disputeId: resolveDispute(a, actor, command, now).id, outcome: command.outcome }; break;
    case "REVIEW": {
      if (a.reviews.length) throw new DomainError("A review has already been submitted.");
      appendReview(a, actor, command, now);
      metadata = { reviewId: a.reviews.at(-1)!.id, rating: command.rating };
      break;
    }
    case "ROTATE_INVITE":
      token = newToken(); a.job.clientActionTokenHash = hashToken(token); a.job.clientTokenExpiresAt = clientCapabilityExpiresAt(); break;
    case "REVOKE_INVITE":
      if (!hasStoredClientCapability(a.job)) throw new DomainError("Client participant access is already revoked.");
      Reflect.deleteProperty(a.job, "clientActionTokenHash");
      Reflect.deleteProperty(a.job, "clientTokenExpiresAt");
      break;
  }
  a.job.status = nextStatus(current.job.status, command.type, command.type === "RESOLVE" ? command.outcome : undefined);
  event(a, actor, transactionRules[command.type].event, { ...metadata, ...operation.metadata }, now);
  a.job.version = current.job.version + 1; a.job.updatedAt = now;
  return { aggregate: a, token, replayed: false };
}
