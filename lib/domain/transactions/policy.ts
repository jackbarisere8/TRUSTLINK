import type { JobStatus } from "../../db/types";
import type { JobCommand } from "../../validation/schemas";
import type { Actor } from "../participants";

export type TransactionAction = JobCommand["type"] | "ACCEPT";
type Rule = { roles: readonly Actor["type"][]; from: readonly JobStatus[]; to: JobStatus | "UNCHANGED" | "OUTCOME"; event: string };

/** Client-safe lifecycle policy shared by the engine and action visibility. No authorization is granted by UI. */
export const transactionRules: Record<TransactionAction, Rule> = {
  ACCEPT: { roles: ["CLIENT_PARTICIPANT"], from: ["SENT"], to: "ACCEPTED", event: "JOB_ACCEPTED" },
  PAYMENT: { roles: ["PROVIDER"], from: ["ACCEPTED"], to: "PAYMENT_RECORDED", event: "PAYMENT_RECORDED" },
  START: { roles: ["PROVIDER"], from: ["PAYMENT_RECORDED", "REVISION_REQUESTED"], to: "IN_PROGRESS", event: "WORK_STARTED" },
  DELIVER: { roles: ["PROVIDER"], from: ["IN_PROGRESS"], to: "DELIVERY_SUBMITTED", event: "DELIVERY_SUBMITTED" },
  REVISE: { roles: ["CLIENT_PARTICIPANT"], from: ["DELIVERY_SUBMITTED"], to: "REVISION_REQUESTED", event: "REVISION_REQUESTED" },
  APPROVE: { roles: ["CLIENT_PARTICIPANT"], from: ["DELIVERY_SUBMITTED"], to: "APPROVED", event: "DELIVERY_APPROVED" },
  COMPLETE: { roles: ["PROVIDER"], from: ["APPROVED"], to: "COMPLETED", event: "JOB_COMPLETED" },
  CANCEL: { roles: ["PROVIDER"], from: ["DRAFT", "SENT"], to: "CANCELLED", event: "JOB_CANCELLED" },
  DISPUTE: { roles: ["PROVIDER", "CLIENT_PARTICIPANT"], from: ["ACCEPTED", "PAYMENT_RECORDED", "IN_PROGRESS", "DELIVERY_SUBMITTED", "REVISION_REQUESTED", "APPROVED"], to: "DISPUTED", event: "DISPUTE_OPENED" },
  RESOLVE: { roles: ["ADMIN"], from: ["DISPUTED"], to: "OUTCOME", event: "DISPUTE_RESOLVED" },
  REVIEW: { roles: ["CLIENT_PARTICIPANT"], from: ["COMPLETED"], to: "UNCHANGED", event: "CLIENT_REVIEWED" },
  ROTATE_INVITE: { roles: ["PROVIDER"], from: ["SENT", "ACCEPTED", "PAYMENT_RECORDED", "IN_PROGRESS", "DELIVERY_SUBMITTED", "REVISION_REQUESTED", "APPROVED", "COMPLETED", "DISPUTED"], to: "UNCHANGED", event: "CLIENT_LINK_REISSUED" },
};

export function isActionAvailable(status: JobStatus, actor: Actor["type"], action: TransactionAction) {
  const rule = transactionRules[action];
  return rule.roles.includes(actor) && rule.from.includes(status);
}

export function nextStatus(status: JobStatus, action: TransactionAction, outcome?: "IN_PROGRESS" | "CANCELLED"): JobStatus {
  const target = transactionRules[action].to;
  if (target === "UNCHANGED") return status;
  if (target === "OUTCOME") {
    if (!outcome) throw new Error("A resolution requires an explicit outcome");
    return outcome;
  }
  return target;
}
