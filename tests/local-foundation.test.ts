import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalStoreRepository } from "../lib/db/local-store";
import { resolveStorageMode } from "../lib/db/config";
import { createAggregate, type Actor } from "../lib/domain/jobs";
import { acceptAggregate, transition } from "./support/lifecycle";
import { TransactionService } from "../lib/domain/transactions";
import { updateProviderProfile } from "../lib/domain/profiles";
import type { CreateJobInput } from "../lib/db/types";
import type { JobAggregate } from "../lib/db/repository";
import type { JobCommand } from "../lib/validation/schemas";

const provider: Actor = { id: "11111111-1111-4111-8111-111111111111", type: "PROVIDER", name: "Test provider" };
const input: CreateJobInput = { providerId: provider.id, title: "Website", category: "Design", scope: "Build a website", deliverables: ["Home page"], price: "180000", deadline: "2099-10-18", revisions: 1, cancellationTerms: "Discuss before work starts", sourceChannel: "WhatsApp", repeatUse: "FIRST" };
const execute = promisify(execFile);
async function worker(mode: string, filename: string, value: string) {
  const { stdout } = await execute(process.execPath, ["--conditions=react-server", "--import", "tsx", "tests/support/local-store-worker.mts", mode, filename, value], { timeout: 30000 });
  return JSON.parse(stdout);
}
async function withStore(run: (file: string, repository: LocalStoreRepository) => Promise<void>) {
  const root = path.resolve(tmpdir());
  const directory = await mkdtemp(path.join(root, "trustlink-foundation-"));
  try { const file = path.join(directory, "store.json"); await run(file, new LocalStoreRepository(file)); }
  finally {
    const relative = path.relative(root, path.resolve(directory));
    assert.ok(relative.startsWith("trustlink-foundation-") && !relative.includes(path.sep) && !path.isAbsolute(relative));
    await rm(directory, { recursive: true, force: true });
  }
}

test("storage selection is explicit and production refuses local or incomplete Supabase configuration", () => {
  for (const env of [{}, { TRUSTLINK_STORAGE: "typo" }, { NODE_ENV: "production", TRUSTLINK_STORAGE: "local" }, { TRUSTLINK_STORAGE: "supabase" }]) {
    assert.throws(() => resolveStorageMode(env));
  }
  assert.equal(resolveStorageMode({ TRUSTLINK_STORAGE: "local", NODE_ENV: "development" }), "local");
});

test("local records survive a new process and competing process commits have one winner", async () => withStore(async (file, repo) => {
  const { aggregate, token } = createAggregate(input);
  await repo.commit(aggregate, null);
  assert.deepEqual(await worker("read", file, aggregate.job.id), aggregate);
  const accepted = acceptAggregate(aggregate, token, { name: "Client", email: "client@example.test" });
  const candidate = path.join(path.dirname(file), "candidate.json");
  await writeFile(candidate, JSON.stringify(accepted));
  const outcomes = await Promise.all([worker("commit", file, candidate), worker("commit", file, candidate)]);
  assert.equal(outcomes.filter(result => result.ok).length, 1);
  assert.match(outcomes.find(result => !result.ok).error, /changed/);
  const persisted = await worker("read", file, aggregate.job.id);
  assert.equal(persisted.job.version, 1);
  assert.equal(persisted.events.filter((event: { eventType: string }) => event.eventType === "JOB_ACCEPTED").length, 1);
  assert.deepEqual((await readdir(path.dirname(file))).sort(), ["candidate.json", "store.json"]);
}));

test("local commits reject edits to agreement, identity, evidence and cross-job rows without altering disk", async () => withStore(async (file, repo) => {
  const { aggregate, token } = createAggregate(input);
  await repo.commit(aggregate, null);
  let current = acceptAggregate(aggregate, token, { name: "Client", email: "client@example.test" });
  await repo.commit(current, 0);
  current = transition(current, provider, { type: "PAYMENT", reference: "Original report" }).aggregate;
  await repo.commit(current, 1);
  const before = await readFile(file, "utf8");
  const next = transition(current, provider, { type: "START" }).aggregate;
  const edits: Array<(a: JobAggregate) => void> = [
    a => { a.terms.price = "999"; },
    a => { a.job.publicId = "replacement"; },
    a => { a.job.providerId = "another-provider"; },
    a => { a.payments[0].reference = "Altered report"; },
    a => { a.events[0].metadata.tampered = true; },
    a => { a.payments[0].jobId = "another-job"; },
    a => { a.terms.jobId = "another-job"; },
  ];
  for (const edit of edits) {
    const changed = structuredClone(next); edit(changed);
    await assert.rejects(repo.commit(changed, current.job.version));
    assert.equal(await readFile(file, "utf8"), before);
  }
  const duplicate = createAggregate(input).aggregate;
  duplicate.job.publicId = aggregate.job.publicId;
  await assert.rejects(repo.commit(duplicate, null), /Invalid local transaction/);
  assert.equal(await readFile(file, "utf8"), before);
  await repo.commit(next, current.job.version);
  assert.equal((await repo.getAggregate(current.job.id))?.job.status, "IN_PROGRESS");
}));

test("malformed structured storage and an existing writer lock are preserved", async () => withStore(async (file, repo) => {
  const { aggregate } = createAggregate(input);
  const corrupt = JSON.stringify({ profiles: [], records: [{ job: { id: "incomplete" } }] });
  await writeFile(file, corrupt);
  await assert.rejects(repo.getAggregate("incomplete"), /invalid records/);
  await assert.rejects(repo.commit(aggregate, null), /invalid records/);
  assert.equal(await readFile(file, "utf8"), corrupt);
  assert.deepEqual(await readdir(path.dirname(file)), ["store.json"]);
  const lock = JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() });
  await writeFile(file + ".lock", lock);
  await assert.rejects(repo.commit(aggregate, null), /changed/);
  assert.equal(await readFile(file + ".lock", "utf8"), lock);
  assert.equal(await readFile(file, "utf8"), corrupt);
}));

test("domain service persists a full local lifecycle, profile changes, retries and authorization", async () => withStore(async (file, repo) => {
  const service = () => new TransactionService(new LocalStoreRepository(file));
  const creation = { ...input, confirmed: true, creationId: randomUUID() };
  await assert.rejects(service().create(provider, creation), /profile/);
  const now = new Date().toISOString();
  // Test-only records exercise the repository; they do not provide an application login.
  await writeFile(file, JSON.stringify({ records: [], profiles: [{
    profile: { id: randomUUID(), userId: provider.id, username: "test-provider", displayName: "Test provider", country: "Nigeria", state: "Lagos", city: "Ikeja", createdAt: now },
    providerProfile: { id: randomUUID(), userId: provider.id, headline: "Designer", serviceArea: "Remote", verificationStatus: "UNVERIFIED", createdAt: now },
  }] }));
  const created = await service().create(provider, creation);
  assert.ok(created.token);
  assert.equal(created.aggregate.job.providerLocation, "Ikeja, Lagos, Nigeria");
  assert.equal((await service().create(provider, creation)).token, undefined);
  await assert.rejects(service().create({ ...provider, id: "other" }, creation), /cannot be reused/);
  await assert.rejects(service().create(provider, { ...creation, creationId: randomUUID() }), /repeat transaction/);
  await assert.rejects(service().accept(created.aggregate.job.publicId, "bad", { name: "Client", email: "client@example.test", confirmed: true }, { id: randomUUID(), expectedVersion: 0 }), /expired/);
  let current = await service().accept(created.aggregate.job.publicId, created.token, { name: "Client", email: "client@example.test", confirmed: true }, { id: randomUUID(), expectedVersion: 0 });
  const client: Actor = { id: "client:" + current.job.id, type: "CLIENT_PARTICIPANT", name: "Client" };
  await assert.rejects(service().execute(current.job.id, client, { type: "PAYMENT" }, { id: randomUUID(), expectedVersion: current.job.version }, created.token), /permission/);
  const commands: JobCommand[] = [{ type: "PAYMENT" }, { type: "START" }, { type: "DELIVER", description: "First", files: [] }, { type: "REVISE", description: "Fix heading" }, { type: "START" }, { type: "DELIVER", description: "Final", files: [] }, { type: "APPROVE" }, { type: "COMPLETE" }, { type: "REVIEW", rating: 5 }];
  for (const command of commands) {
    const actor = ["REVISE", "APPROVE", "REVIEW"].includes(command.type) ? client : provider;
    const request = { id: randomUUID(), expectedVersion: current.job.version };
    current = (await service().execute(current.job.id, actor, command, request, created.token)).aggregate;
    const retry = await service().execute(current.job.id, actor, command, request, created.token);
    assert.equal(retry.aggregate.events.length, current.events.length);
  }
  const persisted = await worker("read", file, current.job.id);
  assert.equal(persisted.job.status, "COMPLETED");
  assert.equal(persisted.terms.revisionsUsed, 1);
  assert.equal(persisted.reviews.length, 1);
  assert.equal(persisted.payments[0].verificationStatus, "NOT_VERIFIED");
  await updateProviderProfile(repo, provider.id, { displayName: "Updated provider", country: "Nigeria", state: "Oyo", city: "Ibadan", headline: "Web designer", bio: "Test biography", serviceArea: "Nigeria" });
  const profile = await new LocalStoreRepository(file).getProfileByUsername("test-provider");
  assert.equal(profile?.profile.city, "Ibadan");
  assert.equal(profile?.providerProfile?.headline, "Web designer");
  assert.equal((await repo.getAggregate(current.job.id))?.job.providerLocation, "Ikeja, Lagos, Nigeria");
}));
