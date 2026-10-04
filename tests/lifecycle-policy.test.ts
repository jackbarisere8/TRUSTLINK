import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAggregate } from "../lib/domain/jobs";
import { acceptAggregate, transition } from "../lib/domain/transactions/state-machine";
import { TransactionService } from "../lib/domain/transactions";
import { isActionAvailable, type TransactionAction } from "../lib/domain/transactions/policy";
import type { MutationRequest } from "../lib/domain/transactions/request";
import type { Actor } from "../lib/domain/participants";
import type { JobAggregate, Repository } from "../lib/db/repository";
import { jobStatuses, type JobStatus } from "../lib/db/types";
import type { JobCommand } from "../lib/validation/schemas";
import { requestFor } from "./support/lifecycle";

const provider: Actor = { id: "provider", type: "PROVIDER", name: "Provider" };
const admin: Actor = { id: "admin", type: "ADMIN", name: "Admin" };
const details = { name: "Client", email: "client@example.test", confirmed: true };
const create = () => createAggregate({ providerId: provider.id, title: "Design", category: "Design", scope: "Agreed scope", deliverables: ["Design file"], price: "1000", deadline: "2099-01-01", revisions: 1, cancellationTerms: "Discuss before work starts", sourceChannel: "Direct", repeatUse: "FIRST" });
const clientFor = (a: JobAggregate): Actor => ({ id: "client:" + a.job.id, type: "CLIENT_PARTICIPANT", name: "Client" });
const apply = (a: JobAggregate, actor: Actor, command: JobCommand) => transition(a, actor, command, requestFor(a)).aggregate;

function fixtures() {
  const { aggregate: sent, token } = create();
  const client = clientFor(sent);
  const accepted = acceptAggregate(sent, token, details, requestFor(sent));
  const paid = apply(accepted, provider, { type: "PAYMENT" });
  const working = apply(paid, provider, { type: "START" });
  const delivered = apply(working, provider, { type: "DELIVER", description: "Delivery", files: [] });
  const approved = apply(delivered, client, { type: "APPROVE" });
  const draft = structuredClone(sent); draft.job.status = "DRAFT"; // Reserved, not a publishable UI flow.
  const records: Record<JobStatus, JobAggregate> = {
    DRAFT: draft, SENT: sent, ACCEPTED: accepted, PAYMENT_RECORDED: paid, IN_PROGRESS: working,
    DELIVERY_SUBMITTED: delivered, REVISION_REQUESTED: apply(delivered, client, { type: "REVISE", description: "Fix" }),
    APPROVED: approved, COMPLETED: apply(approved, provider, { type: "COMPLETE" }),
    DISPUTED: apply(working, client, { type: "DISPUTE", contestedTerm: "Scope", description: "Missing work", files: [] }),
    CANCELLED: apply(sent, provider, { type: "CANCEL" }),
  };
  return { records, token, client };
}

test("engine and UI obey the authorized lifecycle across every status and actor role", () => {
  const { records, token, client } = fixtures();
  // Independent specification of allowed edges: disallowed combinations must not mutate anything.
  const cases: Array<{ command: JobCommand | { type: "ACCEPT" }; roles: Actor["type"][]; from: JobStatus[]; to?: JobStatus }> = [
    { command: { type: "ACCEPT" }, roles: ["CLIENT_PARTICIPANT"], from: ["SENT"], to: "ACCEPTED" },
    { command: { type: "PAYMENT" }, roles: ["PROVIDER"], from: ["ACCEPTED"], to: "PAYMENT_RECORDED" },
    { command: { type: "START" }, roles: ["PROVIDER"], from: ["PAYMENT_RECORDED", "REVISION_REQUESTED"], to: "IN_PROGRESS" },
    { command: { type: "DELIVER", description: "Work", files: [] }, roles: ["PROVIDER"], from: ["IN_PROGRESS"], to: "DELIVERY_SUBMITTED" },
    { command: { type: "REVISE", description: "Fix" }, roles: ["CLIENT_PARTICIPANT"], from: ["DELIVERY_SUBMITTED"], to: "REVISION_REQUESTED" },
    { command: { type: "APPROVE" }, roles: ["CLIENT_PARTICIPANT"], from: ["DELIVERY_SUBMITTED"], to: "APPROVED" },
    { command: { type: "COMPLETE" }, roles: ["PROVIDER"], from: ["APPROVED"], to: "COMPLETED" },
    { command: { type: "CANCEL" }, roles: ["PROVIDER"], from: ["DRAFT", "SENT"], to: "CANCELLED" },
    { command: { type: "DISPUTE", contestedTerm: "Scope", description: "Missing", files: [] }, roles: ["PROVIDER", "CLIENT_PARTICIPANT"], from: ["ACCEPTED", "PAYMENT_RECORDED", "IN_PROGRESS", "DELIVERY_SUBMITTED", "REVISION_REQUESTED", "APPROVED"], to: "DISPUTED" },
    { command: { type: "RESOLVE", notes: "Close dispute", outcome: "CANCELLED" }, roles: ["ADMIN"], from: ["DISPUTED"], to: "CANCELLED" },
    { command: { type: "REVIEW", rating: 4 }, roles: ["CLIENT_PARTICIPANT"], from: ["COMPLETED"] },
    { command: { type: "ROTATE_INVITE" }, roles: ["PROVIDER"], from: ["SENT", "ACCEPTED", "PAYMENT_RECORDED", "IN_PROGRESS", "DELIVERY_SUBMITTED", "REVISION_REQUESTED", "APPROVED", "COMPLETED", "DISPUTED"] },
    { command: { type: "REVOKE_INVITE" }, roles: ["PROVIDER"], from: ["SENT", "ACCEPTED", "PAYMENT_RECORDED", "IN_PROGRESS", "DELIVERY_SUBMITTED", "REVISION_REQUESTED", "APPROVED", "COMPLETED", "DISPUTED"] },
  ];
  for (const item of cases) for (const status of jobStatuses) for (const actor of [provider, client, admin]) {
    const current = records[status];
    const before = JSON.stringify(current);
    const allowed = item.roles.includes(actor.type) && item.from.includes(status);
    const label = `${item.command.type} from ${status} by ${actor.type}`;
    assert.equal(isActionAvailable(status, actor.type, item.command.type as TransactionAction), allowed, label);
    // Acceptance resolves its actor from a valid capability; provider/admin calls are rejected at the action boundary.
    if (item.command.type === "ACCEPT" && actor.type !== "CLIENT_PARTICIPANT") continue;
    const run = () => item.command.type === "ACCEPT" ? acceptAggregate(current, token, details, requestFor(current)) : transition(current, actor, item.command, requestFor(current)).aggregate;
    if (allowed) {
      const next = run();
      assert.equal(next.job.status, item.to || status, label);
      assert.equal(next.job.version, current.job.version + 1, label);
      assert.equal(next.events.length, current.events.length + 1, label);
    } else assert.throws(run, /state|permission/, label);
    assert.equal(JSON.stringify(current), before, label);
  }
});

test("acceptance checks reviewed version, confirmation, replay payload and capability before mutation", () => {
  const { aggregate, token } = create();
  const request = requestFor(aggregate);
  assert.throws(() => acceptAggregate(aggregate, token, details, { ...request, expectedVersion: 1 }), /changed/);
  assert.throws(() => acceptAggregate(aggregate, token, { ...details, confirmed: false }, request), /confirmation/);
  assert.throws(() => acceptAggregate(aggregate, token, details, undefined as unknown as MutationRequest), /Refresh/);
  const accepted = acceptAggregate(aggregate, token, details, request);
  const paid = apply(accepted, provider, { type: "PAYMENT" });
  assert.equal(acceptAggregate(paid, token, details, request), paid);
  assert.throws(() => acceptAggregate(paid, token, { ...details, name: "Replacement" }, request), /different action/);
  assert.throws(() => acceptAggregate(paid, token, details, { ...request, expectedVersion: paid.job.version }), /different action/);
  const rotated = apply(paid, provider, { type: "ROTATE_INVITE" });
  assert.throws(() => acceptAggregate(rotated, token, details, request), /expired/);
  const cancelled = apply(aggregate, provider, { type: "CANCEL" });
  assert.throws(() => acceptAggregate(cancelled, token, details, requestFor(cancelled)), /state/);
});

test("accept, payment, start, delivery, approval, revision, dispute and review are exact-operation idempotent", () => {
  const { records, token, client } = fixtures();
  const acceptanceRequest = requestFor(records.SENT);
  const accepted = acceptAggregate(records.SENT, token, details, acceptanceRequest);
  assert.equal(acceptAggregate(accepted, token, details, acceptanceRequest), accepted);
  assert.equal(accepted.job.version, records.SENT.job.version + 1);
  assert.equal(accepted.events.filter(event => event.eventType === "JOB_ACCEPTED").length, 1);

  const cases: Array<{ current: JobAggregate; actor: Actor; command: JobCommand; eventType: string }> = [
    { current: records.ACCEPTED, actor: provider, command: { type: "PAYMENT" }, eventType: "PAYMENT_RECORDED" },
    { current: records.PAYMENT_RECORDED, actor: provider, command: { type: "START" }, eventType: "WORK_STARTED" },
    { current: records.IN_PROGRESS, actor: provider, command: { type: "DELIVER", description: "Submitted work", files: [] }, eventType: "DELIVERY_SUBMITTED" },
    { current: records.DELIVERY_SUBMITTED, actor: client, command: { type: "APPROVE" }, eventType: "DELIVERY_APPROVED" },
    { current: records.DELIVERY_SUBMITTED, actor: client, command: { type: "REVISE", description: "Adjust the heading" }, eventType: "REVISION_REQUESTED" },
    { current: records.IN_PROGRESS, actor: client, command: { type: "DISPUTE", contestedTerm: "Scope", description: "Missing work", files: [] }, eventType: "DISPUTE_OPENED" },
    { current: records.COMPLETED, actor: client, command: { type: "REVIEW", rating: 4, comment: "Clear delivery" }, eventType: "CLIENT_REVIEWED" },
  ];
  for (const { current, actor, command, eventType } of cases) {
    const request = requestFor(current);
    const first = transition(current, actor, command, request);
    const replay = transition(first.aggregate, actor, command, request);
    assert.equal(replay.replayed, true, command.type);
    assert.equal(replay.aggregate, first.aggregate, command.type);
    assert.equal(first.aggregate.job.version, current.job.version + 1, command.type);
    assert.equal(first.aggregate.events.length, current.events.length + 1, command.type);
    assert.equal(first.aggregate.events.filter(event => event.eventType === eventType).length,
      current.events.filter(event => event.eventType === eventType).length + 1, command.type);
  }
});

test("only the non-raising transaction party can respond once while the dispute stays paused", () => {
  const { records, client } = fixtures();
  const disputed = records.DISPUTED;
  assert.equal(isActionAvailable("DISPUTED","PROVIDER","RESPOND_DISPUTE"),true);
  assert.equal(isActionAvailable("DISPUTED","CLIENT_PARTICIPANT","RESPOND_DISPUTE"),true);
  assert.throws(() => apply(disputed,client,{type:"RESPOND_DISPUTE",response:"Repeated claimant view"}),/other transaction party/);
  const responded = apply(disputed,provider,{type:"RESPOND_DISPUTE",response:"Provider response"});
  assert.equal(responded.job.status,"DISPUTED");
  assert.equal(responded.disputes.at(-1)?.disputeStatus,"UNDER_REVIEW");
  assert.throws(() => apply(responded,provider,{type:"RESPOND_DISPUTE",response:"Second response"}),/open dispute|already responded/);
  assert.equal(isActionAvailable("IN_PROGRESS","PROVIDER","RESPOND_DISPUTE"),false);
});

test("mutations reject missing versions and invalid runtime payloads; link retries cannot rotate twice", () => {
  const { aggregate } = create();
  const before = JSON.stringify(aggregate);
  const request = requestFor(aggregate);
  assert.throws(() => transition(aggregate, provider, { type: "CANCEL" }, undefined as unknown as MutationRequest), /Refresh/);
  assert.throws(() => transition(aggregate, provider, { type: "INVENTED" } as unknown as JobCommand, request), /fields/);
  assert.throws(() => transition(aggregate, provider, { type: "REVIEW", rating: 99 }, request), /fields/);
  assert.equal(JSON.stringify(aggregate), before);
  const first = transition(aggregate, provider, { type: "ROTATE_INVITE" }, request);
  const second = transition(first.aggregate, provider, { type: "ROTATE_INVITE" }, request);
  assert.equal(second.replayed, true);
  assert.equal(second.aggregate, first.aggregate);
  assert.equal(second.token, undefined); // Plain capabilities are never persisted for replay.
  assert.ok(first.token);
  assert.equal(first.aggregate.events.length, aggregate.events.length + 1);
  const revokeRequest = requestFor(first.aggregate);
  const revoked = transition(first.aggregate, provider, { type: "REVOKE_INVITE" }, revokeRequest);
  const revokedReplay = transition(revoked.aggregate, provider, { type: "REVOKE_INVITE" }, revokeRequest);
  assert.equal(revokedReplay.replayed, true);
  assert.equal(revokedReplay.aggregate, revoked.aggregate);
});

test("service rechecks capability on its current read, including replay, and propagates failed atomic commits", async () => {
  const { records, token, client } = fixtures();
  let current = records.DELIVERY_SUBMITTED;
  let writes = 0;
  const repository = {
    getAggregate: async () => structuredClone(current),
    commit: async () => { writes++; throw new Error("Injected atomic commit failure"); },
  } as unknown as Repository;
  const service = new TransactionService(repository);
  const request = requestFor(current);
  const before = JSON.stringify(current);
  await assert.rejects(service.execute(current.job.id, client, { type: "APPROVE" }, request, token), /atomic commit failure/);
  assert.equal(writes, 1);
  assert.equal(JSON.stringify(current), before);
  current = transition(current, client, { type: "APPROVE" }, request).aggregate;
  current = apply(current, provider, { type: "ROTATE_INVITE" });
  await assert.rejects(service.execute(current.job.id, client, { type: "APPROVE" }, request, token), /expired/);
  await assert.rejects(service.execute(current.job.id, client, { type: "APPROVE" }, { id: randomUUID(), expectedVersion: current.job.version }), /expired/);
  assert.equal(writes, 1);
});

test("simultaneous payment requests resolve to one payment and one event", async () => {
  const { records } = fixtures();
  let current = structuredClone(records.ACCEPTED);
  let commitAttempts = 0;
  const repository = {
    getAggregate: async () => structuredClone(current),
    commit: async (aggregate: JobAggregate, expectedVersion: number | null) => {
      commitAttempts++;
      if (expectedVersion === null || current.job.version !== expectedVersion) throw new Error("Concurrent change");
      current = structuredClone(aggregate);
    },
  } as unknown as Repository;
  const service = new TransactionService(repository);
  const request = requestFor(current);
  const command = { type: "PAYMENT" as const, reference: "  Bank transfer  ", notes: "  Received directly  " };
  const responses = await Promise.all([
    service.execute(current.job.id, provider, command, request),
    service.execute(current.job.id, provider, command, request),
  ]);
  assert.deepEqual(responses.map(response => response.replayed).sort(), [false, true]);
  assert.equal(commitAttempts, 2);
  assert.equal(current.job.status, "PAYMENT_RECORDED");
  assert.deepEqual(current.payments.map(payment => [payment.reference,payment.notes]), [["Bank transfer","Received directly"]]);
  assert.equal(current.events.filter(event => event.eventType === "PAYMENT_RECORDED").length, 1);
});

test("simultaneous acceptance resolves to one acceptance and one event", async () => {
  const { aggregate, token } = create();
  let current = structuredClone(aggregate);
  let commitAttempts = 0;
  const repository = {
    getAggregate: async () => structuredClone(current),
    commit: async (candidate: JobAggregate, expectedVersion: number | null) => {
      commitAttempts++;
      if (expectedVersion === null || current.job.version !== expectedVersion) throw new Error("Concurrent change");
      current = structuredClone(candidate);
    },
  } as unknown as Repository;
  const service = new TransactionService(repository);
  const request = requestFor(current);
  const responses = await Promise.all([
    service.accept(current.job.publicId, token, details, request),
    service.accept(current.job.publicId, token, details, request),
  ]);
  assert.deepEqual(responses.map(response => response.job.status), ["ACCEPTED", "ACCEPTED"]);
  assert.equal(commitAttempts, 2);
  assert.equal(current.events.filter(event => event.eventType === "JOB_ACCEPTED").length, 1);
});

test("simultaneous creation returns one exact record and rejects changed creation-key reuse", async () => {
  const profile = { id: "profile", userId: provider.id, username: "provider", displayName: "Provider", country: "Nigeria", state: "Lagos", city: "Ikeja", createdAt: new Date().toISOString() };
  const creation = { creationId: randomUUID(), title: "Design", category: "Design", scope: "Agreed scope", deliverables: ["Design file"], price: "1000", deadline: "2099-01-01", revisions: 1, cancellationTerms: "Discuss before work starts", sourceChannel: "Direct" as const, repeatUse: "FIRST" as const, confirmed: true as const };
  const run = async (second: typeof creation) => {
    let current: JobAggregate | null = null;
    const repository = {
      getAggregate: async () => current ? structuredClone(current) : null,
      listJobs: async () => [],
      getProfileByUserId: async () => profile,
      commit: async (candidate: JobAggregate, expectedVersion: number | null) => {
        if (expectedVersion !== null || current) throw new Error("Concurrent change");
        current = structuredClone(candidate);
      },
    } as unknown as Repository;
    return Promise.allSettled([new TransactionService(repository).create(provider, creation),new TransactionService(repository).create(provider, second)]);
  };
  const exact = await run(creation);
  assert.deepEqual(exact.map(result => result.status), ["fulfilled", "fulfilled"]);
  const changed = await run({ ...creation, title: "Changed design" });
  assert.equal(changed.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(changed.filter(result => result.status === "rejected").length, 1);
});

test("exact delivery replay skips pending-evidence validation after the commit", async () => {
  const { records } = fixtures();
  let current = structuredClone(records.IN_PROGRESS);
  let validations = 0;
  const repository = {
    getAggregate: async () => structuredClone(current),
    commit: async (candidate: JobAggregate, expectedVersion: number | null) => {
      if (expectedVersion === null || current.job.version !== expectedVersion) throw new Error("Concurrent change");
      current = structuredClone(candidate);
    },
  } as unknown as Repository;
  const service = new TransactionService(repository);
  const command = { type: "DELIVER" as const, description: "Files", files: [current.job.id + "/evidence"] };
  const request = requestFor(current);
  const first = await service.execute(current.job.id, provider, command, request, undefined, async () => { validations++; });
  const replay = await service.execute(current.job.id, provider, command, request, undefined, async () => { throw new Error("Attached evidence was revalidated"); });
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(validations, 1);
  assert.equal(current.deliveries.length, records.IN_PROGRESS.deliveries.length + 1);
});
