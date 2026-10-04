import { randomUUID } from "node:crypto";
import type { JobAggregate } from "../../db/repository";
import type { JobCommand } from "../../validation/schemas";
import { recordedPaymentSemantics } from "../../payments/types";

/** Called only after the transaction engine has authorized the receipt report. */
export function appendPayment(a: JobAggregate, command: Extract<JobCommand, { type: "PAYMENT" }>, now: string) {
  a.payments.push({
    id: randomUUID(), jobId: a.job.id, amount: a.terms.price, currency: "NGN",
    reference: command.reference, notes: command.notes, recordedAt: now,
    ...recordedPaymentSemantics,
  });
}
