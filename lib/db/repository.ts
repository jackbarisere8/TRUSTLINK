import type { ApplicationProfileRecord, ProviderProfileRecord, JobSummaryRecord, JobRecord, JobTermsRecord, PaymentRecord, DeliveryRecord, RevisionRecord, DisputeRecord, ReviewRecord, TrustEventRecord } from "./types";

export interface JobAggregate {
  job: JobRecord;
  terms: JobTermsRecord;
  payments: PaymentRecord[];
  deliveries: DeliveryRecord[];
  revisions: RevisionRecord[];
  disputes: DisputeRecord[];
  reviews: ReviewRecord[];
  events: TrustEventRecord[];
}
export type ProfileBundle = { profile: ApplicationProfileRecord; providerProfile: ProviderProfileRecord | null };
export type ProfileInput = { displayName: string; country: string; state: string; city: string; headline: string; bio: string; serviceArea: string };
export interface Repository {
  getProfileByUsername(username: string): Promise<ProfileBundle | null>;
  getProfileByUserId(userId: string): Promise<ApplicationProfileRecord | null>;
  updateProfile(userId: string, input: ProfileInput): Promise<void>;
  getAggregate(id: string, byPublicId?: boolean): Promise<JobAggregate | null>;
  listJobs(providerId?: string): Promise<JobSummaryRecord[]>;
  listProfiles(): Promise<ApplicationProfileRecord[]>;
  listDisputes(): Promise<DisputeRecord[]>;
  listEvents(): Promise<TrustEventRecord[]>;
  /** Atomic compare-and-swap. A conflict must leave both state and events unchanged. */
  commit(aggregate: JobAggregate, expectedVersion: number | null): Promise<void>;
}
