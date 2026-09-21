import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Repository, JobAggregate, ProfileBundle, ProfileInput } from "./repository";
import { ConflictError } from "../domain/errors";
import { aggregateSchema, localDataSchema } from "./local-schema";
import { isDeepStrictEqual } from "node:util";
interface LocalData { profiles: ProfileBundle[]; records: JobAggregate[] }
export class LocalStoreRepository implements Repository {
  constructor(private filename = path.join(process.cwd(), "data", "trustlink-local-v3.json")) {}
  private read(): LocalData {
    if (!fs.existsSync(this.filename)) return { profiles: [], records: [] };
    const contents = fs.readFileSync(this.filename, "utf8");
    let decoded: unknown;
    try { decoded = JSON.parse(contents); }
    catch { throw new Error("Local store contains invalid JSON. Preserve the file and inspect it before retrying."); }
    const parsed = localDataSchema.safeParse(decoded);
    if (!parsed.success) throw new Error("Local store contains invalid records. Preserve the file and inspect it before retrying.");
    return parsed.data;
  }
  private write(data: LocalData) {
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    const temp = this.filename + "." + randomUUID() + ".tmp";
    try {
      const fd = fs.openSync(temp, "wx", 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(data, null, 2)); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
      fs.renameSync(temp, this.filename);
    } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  }
  private transaction<T>(fn: (data: LocalData) => T): T {
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    const lockPath = this.filename + ".lock";
    let lock: number;
    try { lock = fs.openSync(lockPath, "wx", 0o600); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new ConflictError(); throw error; }
    try {
      fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      const data = this.read(); const result = fn(data);
      if (!localDataSchema.safeParse(data).success) throw new Error("Invalid local transaction data");
      this.write(data); return result;
    }
    finally { fs.closeSync(lock); fs.unlinkSync(lockPath); }
  }
  async getProfileByUsername(username: string) { return this.read().profiles.find(p => p.profile.username === username.toLowerCase()) || null; }
  async getProfileByUserId(userId: string) { return this.read().profiles.find(p => p.profile.userId === userId)?.profile || null; }
  async updateProfile(userId: string, input: ProfileInput) {
    this.transaction(data => {
      const p = data.profiles.find(p => p.profile.userId === userId);
      if (!p || !p.providerProfile) throw new Error("Provider profile not found");
      Object.assign(p.profile, { displayName: input.displayName, country: input.country, state: input.state, city: input.city });
      if (p.providerProfile) Object.assign(p.providerProfile, { headline: input.headline, bio: input.bio, serviceArea: input.serviceArea });
    });
  }
  async getAggregate(id: string, byPublicId = false) { return this.read().records.find(a => byPublicId ? a.job.publicId === id : a.job.id === id) || null; }
  async listJobs(providerId?: string) { return this.read().records.filter(a => !providerId || a.job.providerId === providerId).map(a => ({ ...a.job, terms: a.terms })).sort((a,b) => b.createdAt.localeCompare(a.createdAt)); }
  async listProfiles() { return this.read().profiles.map(p => p.profile); }
  async listDisputes() { return this.read().records.flatMap(a => a.disputes); }
  async listEvents() { return this.read().records.flatMap(a => a.events); }
  async commit(aggregate: JobAggregate, expectedVersion: number | null) {
    // Compare the same JSON representation that survives a disk round trip.
    // Optional undefined fields must not turn an unchanged row into an edit.
    const parsed = aggregateSchema.safeParse(JSON.parse(JSON.stringify(aggregate)));
    if (!parsed.success) throw new Error("Invalid transaction aggregate");
    aggregate = parsed.data;
    this.transaction(data => {
      const idx = data.records.findIndex(a => a.job.id === aggregate.job.id);
      if (expectedVersion === null) {
        if (idx !== -1) throw new ConflictError();
        if (aggregate.job.version !== 0 || !aggregate.events.length) throw new Error("Invalid initial transaction");
        data.records.push(aggregate);
      } else {
        if (idx === -1 || data.records[idx].job.version !== expectedVersion) throw new ConflictError();
        const previous = data.records[idx];
        if (aggregate.job.version !== expectedVersion + 1 || aggregate.events.length <= previous.events.length) throw new Error("A transition requires a new version and event");
        if (!isDeepStrictEqual(aggregate.events.slice(0, previous.events.length), previous.events)) throw new Error("Trust events are immutable");
        const immutableTerms = (a: JobAggregate) => ({ ...a.terms, revisionsUsed: 0 });
        if (!isDeepStrictEqual(immutableTerms(aggregate), immutableTerms(previous))) throw new Error("Agreed terms are immutable");
        for (const key of ["id", "publicId", "providerId", "repeatUse", "sourceChannel", "providerLocation", "createdAt"] as const) {
          if (aggregate.job[key] !== previous.job[key]) throw new Error("Transaction identity and origin are immutable");
        }
        for (const key of ["payments", "deliveries", "revisions", "reviews"] as const) {
          if (!isDeepStrictEqual(aggregate[key].slice(0, previous[key].length), previous[key])) throw new Error("Recorded evidence is immutable");
        }
        if (aggregate.disputes.length < previous.disputes.length) throw new Error("Dispute history cannot be removed");
        for (const [i, dispute] of previous.disputes.entries()) {
          const next = aggregate.disputes[i];
          for (const key of ["id", "jobId", "raisedBy", "contestedTerm", "claimDescription", "evidenceUrls", "createdAt"] as const) {
            if (!isDeepStrictEqual(next[key], dispute[key])) throw new Error("Dispute evidence is immutable");
          }
        }
        data.records[idx] = aggregate;
      }
    });
  }
}
export const localStore = new LocalStoreRepository();
