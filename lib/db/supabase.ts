import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Repository, JobAggregate, ProfileData, ProfileInput } from "./repository";
import type { JobRecord, ProfileRecord, DisputeRecord, TrustEventRecord } from "./types";
import { ConflictError } from "../domain/errors";
let client: SupabaseClient | undefined;
export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function camel<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map(v => camel(v)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [k.replace(/_([a-z])/g, (_,c) => c.toUpperCase()), camel(v)])) as T;
  return value as T;
}
export class SupabaseRepository implements Repository {
  private async query<T>(table: string, filter?: [string,string]) {
    let query = getSupabaseClient().from(table).select("*");
    if (filter) query = query.eq(...filter);
    const { data, error } = await query;
    if (error) throw new Error("Database read failed.");
    return camel<T[]>(data);
  }
  async getProfileByUsername(username: string): Promise<ProfileData | null> {
    const [profile] = await this.query<ProfileRecord>("profiles", ["username", username.toLowerCase()]);
    if (!profile) return null;
    const [providerProfile] = await this.query<NonNullable<ProfileData["providerProfile"]>>("provider_profiles", ["user_id", profile.userId]);
    return { profile, providerProfile: providerProfile || null };
  }
  async getProfileByUserId(userId: string) { return (await this.query<ProfileRecord>("profiles", ["user_id", userId]))[0] || null; }
  async updateProfile(userId: string, input: ProfileInput) {
    const { error } = await getSupabaseClient().rpc("tl_update_profile", { p_user_id: userId, p_input: input });
    if (error) throw new Error("Profile update failed.");
  }
  async getAggregate(id: string, byPublicId = false): Promise<JobAggregate | null> {
    const { data, error } = await getSupabaseClient().rpc("tl_read_job", { p_id: id, p_public: byPublicId });
    if (error) throw new Error("Transaction read failed.");
    return data ? camel<JobAggregate>(data) : null;
  }
  async listJobs(providerId?: string) {
    const jobs = await this.query<JobRecord>("jobs", providerId ? ["provider_id", providerId] : undefined);
    if (!jobs.length) return [];
    const { data, error } = await getSupabaseClient().from("job_terms").select("*").in("job_id", jobs.map(j => j.id));
    if (error) throw new Error("Terms read failed.");
    const terms = camel<JobAggregate["terms"][]>(data);
    return jobs.map(job => ({ ...job, terms: terms.find(t => t.jobId === job.id) })).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }
  async listProfiles() { return this.query<ProfileRecord>("profiles"); }
  async listDisputes() { return this.query<DisputeRecord>("disputes"); }
  async listEvents() { return this.query<TrustEventRecord>("trust_events"); }
  async commit(aggregate: JobAggregate, expectedVersion: number | null) {
    const { error } = await getSupabaseClient().rpc("tl_commit_job", { p_record: aggregate, p_expected_version: expectedVersion });
    if (error?.code === "40001") throw new ConflictError();
    if (error) throw new Error("Transaction could not be committed.");
  }
}
export const supabaseStore = new SupabaseRepository();
