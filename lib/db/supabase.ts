import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Repository, JobAggregate, ProfileBundle, ProfileInput } from "./repository";
import type { JobSummaryRecord, JobTermsRecord, ApplicationProfileRecord, DisputeRecord, TrustEventRecord } from "./types";
import type { Database, Json } from "./database.generated";
import { ConflictError } from "../domain/errors";
type PublicTable = keyof Database["public"]["Tables"];
let client: SupabaseClient<Database> | undefined;
export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing.");
  return client ??= createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function camel<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map(v => camel(v)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [k.replace(/_([a-z])/g, (_,c) => c.toUpperCase()), camel(v)])) as T;
  return value as T;
}
export class SupabaseRepository implements Repository {
  private async query<T>(table: PublicTable, filter?: [string,string]) {
    let query = getSupabaseClient().from(table).select("*");
    if (filter) query = query.eq(...filter);
    const { data, error } = await query;
    if (error) throw new Error("Database read failed.");
    return camel<T[]>(data);
  }
  async getProfileByUsername(username: string): Promise<ProfileBundle | null> {
    const [profile] = await this.query<ApplicationProfileRecord>("profiles", ["username", username.toLowerCase()]);
    if (!profile) return null;
    const [providerProfile] = await this.query<NonNullable<ProfileBundle["providerProfile"]>>("provider_profiles", ["user_id", profile.userId]);
    return { profile, providerProfile: providerProfile || null };
  }
  async getProfileByUserId(userId: string) { return (await this.query<ApplicationProfileRecord>("profiles", ["user_id", userId]))[0] || null; }
  async updateProfile(userId: string, input: ProfileInput) {
    const { error } = await getSupabaseClient().rpc("tl_update_profile", { p_user_id: userId, p_input: input as unknown as Json });
    if (error) throw new Error("Profile update failed.");
  }
  async getAggregate(id: string, byPublicId = false): Promise<JobAggregate | null> {
    const { data, error } = await getSupabaseClient().rpc("tl_read_job", { p_id: id, p_public: byPublicId });
    if (error) throw new Error("Transaction read failed.");
    return data ? camel<JobAggregate>(data) : null;
  }
  async listJobs(providerId?: string) {
    const jobs = await this.query<JobSummaryRecord>("jobs", providerId ? ["provider_id", providerId] : undefined);
    if (!jobs.length) return [];
    const [termsResult,participantsResult] = await Promise.all([
      getSupabaseClient().from("job_terms").select("*").in("job_id", jobs.map(job => job.id)),
      getSupabaseClient().from("job_participants").select("job_id,display_name").eq("role","CLIENT_PARTICIPANT").in("job_id", jobs.map(job => job.id)),
    ]);
    if (termsResult.error || participantsResult.error) throw new Error("Transaction list read failed.");
    const terms = camel<Array<Omit<JobTermsRecord,"price"> & { price: number }>>(termsResult.data);
    const participants = camel<Array<{ jobId: string; displayName: string | null }>>(participantsResult.data);
    return jobs.map(job => {
      const term = terms.find(candidate => candidate.jobId === job.id);
      return {
        ...job,
        clientName: participants.find(participant => participant.jobId === job.id)?.displayName || undefined,
        terms: term ? { ...term, price: String(term.price) } : undefined,
      };
    }).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }
  async listProfiles() { return this.query<ApplicationProfileRecord>("profiles"); }
  async listDisputes() { return this.query<DisputeRecord>("disputes"); }
  async listEvents() { return this.query<TrustEventRecord>("trust_events"); }
  async commit(aggregate: JobAggregate, expectedVersion: number | null) {
    const { error } = await getSupabaseClient().rpc("tl_commit_job", { p_record: aggregate as unknown as Json, p_expected_version: expectedVersion });
    if (error?.code === "40001") throw new ConflictError();
    if (error) throw new Error("Transaction could not be committed.");
  }
}
export const supabaseStore = new SupabaseRepository();
