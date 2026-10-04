import { test } from "node:test";
import assert from "node:assert/strict";
import type { TrustEventRecord } from "../lib/db/types";
import { notificationCopy, notificationIntentsForEvent } from "../lib/notifications";

function event(eventType: TrustEventRecord["eventType"], actorType: TrustEventRecord["actorType"] = "PROVIDER"): TrustEventRecord {
  return {
    id: `event-${eventType}`,
    jobId: "job",
    actorId: "actor",
    actorType,
    eventType,
    eventSequence: 1,
    occurredAt: "2026-09-27T10:00:00.000Z",
    metadata: {},
    createdAt: "2026-09-27T10:00:00.000Z",
  };
}

test("transaction notifications are derived only from selected immutable domain events", () => {
  const cases = [
    [event("JOB_ACCEPTED", "CLIENT_PARTICIPANT"), [["TRANSACTION_ACCEPTED", "PROVIDER"]]],
    [event("PAYMENT_RECORDED"), [["PAYMENT_RECORDED", "CLIENT_PARTICIPANT"]]],
    [event("DELIVERY_SUBMITTED"), [["DELIVERY_SUBMITTED", "CLIENT_PARTICIPANT"]]],
    [event("REVISION_REQUESTED", "CLIENT_PARTICIPANT"), [["REVISION_REQUESTED", "PROVIDER"]]],
    [event("DISPUTE_OPENED", "CLIENT_PARTICIPANT"), [["DISPUTE_RAISED", "PROVIDER"], ["DISPUTE_RAISED", "ADMIN"]]],
    [event("DISPUTE_OPENED", "PROVIDER"), [["DISPUTE_RAISED", "CLIENT_PARTICIPANT"], ["DISPUTE_RAISED", "ADMIN"]]],
    [event("JOB_COMPLETED"), [["TRANSACTION_COMPLETED", "CLIENT_PARTICIPANT"]]],
  ] as const;
  for (const [source, expected] of cases) {
    assert.deepEqual(notificationIntentsForEvent(source).map(intent => [intent.notificationKind, intent.recipientRole]), expected);
  }
  assert.deepEqual(notificationIntentsForEvent(event("WORK_STARTED")), []);
  assert.match(notificationCopy.PAYMENT_RECORDED.body, /not verified/i);
});
