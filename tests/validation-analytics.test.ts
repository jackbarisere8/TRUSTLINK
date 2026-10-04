import { test } from "node:test";
import assert from "node:assert/strict";
import type { JobSummaryRecord, TrustEventRecord } from "../lib/db/types";
import { buildValidationReport, repeatUseSignals } from "../lib/analytics/validation";

const timestamp = "2026-09-27T10:00:00.000Z";
function job(id: string, providerId: string, repeatUse: JobSummaryRecord["repeatUse"], sourceChannel: JobSummaryRecord["sourceChannel"]): JobSummaryRecord {
  return { id, publicId: id.padEnd(24, "0"), providerId, version: 0, repeatUse, status: "SENT", sourceChannel, providerLocation: "Lagos, Nigeria", createdAt: timestamp, updatedAt: timestamp };
}
function event(id: string, jobId: string, eventType: TrustEventRecord["eventType"], eventSequence: number): TrustEventRecord {
  const actorType = eventType === "JOB_ACCEPTED" ? "CLIENT_PARTICIPANT" : eventType === "JOB_VIEWED" ? "SYSTEM" : "PROVIDER";
  return { id, jobId, actorId: "actor", actorType, eventType, eventSequence, occurredAt: timestamp, metadata: {}, createdAt: timestamp };
}

test("validation analytics distinguish prompted and unprompted customer-backed repeat use", () => {
  const jobs = [
    job("job-1", "provider-1", "FIRST", "WhatsApp"),
    job("job-2", "provider-1", "UNPROMPTED", "Direct"),
    job("job-3", "provider-1", "PROMPTED", "Referral"),
    job("job-4", "provider-2", "FIRST", "WhatsApp"),
    job("job-5", "provider-2", "UNPROMPTED", "Direct"),
    job("job-6", "provider-1", "UNPROMPTED", "Direct"),
  ];
  const events = jobs.flatMap((record, index) => [event(`created-${index}`, record.id, "JOB_CREATED", 1), event(`sent-${index}`, record.id, "JOB_SENT", 2)]);
  events.push(
    event("accepted-1", "job-1", "JOB_ACCEPTED", 3),
    event("accepted-2", "job-2", "JOB_ACCEPTED", 3),
    event("accepted-4", "job-4", "JOB_ACCEPTED", 3),
    event("accepted-6", "job-6", "JOB_ACCEPTED", 3),
    event("payment-2", "job-2", "PAYMENT_RECORDED", 4),
    event("delivery-2a", "job-2", "DELIVERY_SUBMITTED", 5),
    event("delivery-2b", "job-2", "DELIVERY_SUBMITTED", 6),
    event("completed-2", "job-2", "JOB_COMPLETED", 7),
  );

  assert.deepEqual(repeatUseSignals(jobs, events).map(signal => [signal.kind, signal.jobId, Boolean(signal.acceptedAt)]), [
    ["repeat_use_unprompted", "job-2", true],
    ["repeat_use_prompted", "job-3", false],
    ["repeat_use_unprompted", "job-5", false],
    ["repeat_use_unprompted", "job-6", true],
  ]);
  assert.deepEqual(buildValidationReport(jobs, events), {
    transactionFunnel: { created: 6, accepted: 4, paymentRecorded: 1, deliverySubmitted: 1, completed: 1 },
    repeatUse: {
      repeat_use_prompted: { created: 1, accepted: 0, acceptedProviders: 0 },
      repeat_use_unprompted: { created: 3, accepted: 2, acceptedProviders: 1 },
    },
    sourceChannels: [
      { channel: "Direct", transactions: 3 },
      { channel: "WhatsApp", transactions: 2 },
      { channel: "Referral", transactions: 1 },
    ],
  });
});

test("validation analytics ignore orphan rows and page-view events", () => {
  const jobs = [job("job-1", "provider-1", "UNPROMPTED", "Direct"), job("orphan", "provider-2", "PROMPTED", "Email")];
  const events = [event("created", "job-1", "JOB_CREATED", 1), event("view", "job-1", "JOB_VIEWED", 2)];
  const report = buildValidationReport(jobs, events);
  assert.equal(report.transactionFunnel.created, 1);
  assert.equal(report.repeatUse.repeat_use_unprompted.created, 1);
  assert.equal(report.repeatUse.repeat_use_unprompted.accepted, 0);
  assert.deepEqual(report.sourceChannels, [{ channel: "Direct", transactions: 1 }]);
});
