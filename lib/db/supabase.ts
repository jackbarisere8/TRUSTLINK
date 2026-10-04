import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Repository, JobAggregate, ProfileBundle, ProfileInput } from "./repository";
import { jobStatuses, type ApplicationProfileRecord, type DisputeRecord, type JobStatus, type JobSummaryRecord, type JobTermsRecord, type NotificationIntentRecord, type PublicJobProjection, type PublicTransactionProjection, type PublicTrustEvent, type TrustEventRecord } from "./types";
import type { Database, Json } from "./database.generated";
import { ConflictError } from "../domain/errors";
import { isPublicTrustEventType, type PublicTrustEventType } from "../trust-events";

type PublicTable = keyof Database["public"]["Tables"];
type PublicJobRecordRow = Database["public"]["Views"]["public_job_records"]["Row"];
type PublicTransactionEventRow = Database["public"]["Views"]["public_transaction_events"]["Row"];
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

function projectionFromRow(row: PublicJobRecordRow): PublicJobProjection | null {
  const price = typeof row.price === "number" && Number.isFinite(row.price)
    ? String(row.price)
    : typeof row.price === "string" && /^\d+(\.\d{1,2})?$/.test(row.price) ? row.price : null;
  if (
    typeof row.public_id !== "string" || typeof row.status !== "string" ||
    !jobStatuses.includes(row.status as JobStatus) || typeof row.provider_location !== "string" ||
    typeof row.service !== "string" || typeof row.scope !== "string" || !Array.isArray(row.deliverables) ||
    !row.deliverables.every(item => typeof item === "string") || !price ||
    typeof row.currency !== "string" || typeof row.deadline !== "string" ||
    typeof row.revisions_included !== "number" || typeof row.revisions_used !== "number" ||
    typeof row.cancellation_terms !== "string" || typeof row.provider_username !== "string" ||
    typeof row.provider_name !== "string" || typeof row.provider_headline !== "string"
  ) return null;
  return {
    publicId: row.public_id,
    status: row.status as JobStatus,
    providerLocation: row.provider_location,
    service: row.service,
    scope: row.scope,
    deliverables: row.deliverables,
    price,
    currency: row.currency,
    deadline: row.deadline,
    revisionsIncluded: row.revisions_included,
    revisionsUsed: row.revisions_used,
    cancellationTerms: row.cancellation_terms,
    provider: { username: row.provider_username, displayName: row.provider_name, headline: row.provider_headline },
  };
}

function publicEventsFromRows(rows: PublicTransactionEventRow[]): PublicTrustEvent[] {
  return rows
    .filter((row): row is PublicTransactionEventRow & { id: string; event_type: PublicTrustEventType; occurred_at: string; event_sequence: number } =>
      typeof row.id === "string" && typeof row.event_type === "string" && isPublicTrustEventType(row.event_type) &&
      typeof row.occurred_at === "string" && typeof row.event_sequence === "number",
    )
    .sort((a,b) => a.event_sequence - b.event_sequence)
    .map(row => ({ id: row.id, eventType: row.event_type, occurredAt: row.occurred_at }));
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
  async getPublicTransaction(publicId: string): Promise<PublicTransactionProjection | null> {
    const client = getSupabaseClient();
    const { data: recordRows, error: recordError } = await client
      .from("public_job_records").select("*").eq("public_id", publicId);
    if (recordError) throw new Error("Public transaction read failed.");
    const record = recordRows?.[0] ? projectionFromRow(recordRows[0]) : null;
    if (!record) return null;
    const { data: eventRows, error: eventError } = await client
      .from("public_transaction_events").select("*").eq("public_id", publicId).order("event_sequence");
    if (eventError) throw new Error("Public transaction history read failed.");
    return { record, events: publicEventsFromRows(eventRows || []) };
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
  async listNotificationIntents(jobId?: string) {
    return this.query<NotificationIntentRecord>("notification_intents", jobId ? ["job_id", jobId] : undefined);
  }
  async commit(aggregate: JobAggregate, expectedVersion: number | null) {
    const { error } = await getSupabaseClient().rpc("tl_commit_job", { p_record: aggregate as unknown as Json, p_expected_version: expectedVersion });
    if (error?.code === "40001") throw new ConflictError();
    if (error) throw new Error("Transaction could not be committed.");
  }
}
export const supabaseStore = new SupabaseRepository();
