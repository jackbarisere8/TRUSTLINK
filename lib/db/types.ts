import type { PublicTrustEventType } from "../trust-events";

export const jobStatuses = [
  "DRAFT", "SENT", "ACCEPTED", "PAYMENT_RECORDED", "IN_PROGRESS",
  "DELIVERY_SUBMITTED", "REVISION_REQUESTED", "APPROVED", "COMPLETED", "DISPUTED", "CANCELLED",
] as const;
export type JobStatus = typeof jobStatuses[number];

export type SourceChannel =
  | "WhatsApp"
  | "Instagram"
  | "Referral"
  | "Direct"
  | "X (Twitter)"
  | "LinkedIn"
  | "Facebook"
  | "TikTok"
  | "Telegram"
  | "SMS"
  | "Email"
  | "QR Code"
  | "TrustLink Marketplace"
  | "Other";

export interface ApplicationProfileRecord {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  country: string;
  state?: string;
  city?: string;
  createdAt: string;
}

export interface ProviderProfileRecord {
  id: string;
  userId: string;
  headline: string;
  bio?: string;
  serviceArea: string;
  verificationStatus: "UNVERIFIED" | "IDENTITY_PROVIDED" | "VERIFIED_BY_TRUSTLINK";
  marketplaceStatus: "NOT_LISTED" | "DRAFT" | "PUBLISHED" | "SUSPENDED";
  businessName?: string;
  remoteServices: boolean;
  bookingPolicy?: string;
  moderationStatus: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  publishedAt?: string;
  bookingCapacity: number;
  createdAt: string;
  updatedAt: string;
}

export const participantDetailStatuses = [
  "SELF_PROVIDED",
  "EMAIL_VERIFIED",
  "OTHER_VERIFIED",
  "UNKNOWN",
] as const;
export type ParticipantDetailStatus = typeof participantDetailStatuses[number];

export interface JobTermsRecord {
  id: string;
  jobId: string;
  service: string;
  serviceCategory: string;
  scope: string;
  deliverables: string[];
  price: string;
  currency: string;
  deadline: string;
  revisionsIncluded: number;
  revisionsUsed: number;
  cancellationTerms: string;
  createdAt: string;
}

export interface JobRecord {
  version: number;
  repeatUse: "FIRST" | "PROMPTED" | "UNPROMPTED";
  completedAt?: string;
  id: string;
  publicId: string;
  providerId: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientActionTokenHash?: string;
  clientTokenExpiresAt?: string;
  clientTokenUsed: boolean;
  status: JobStatus;
  sourceChannel: SourceChannel;
  providerLocation: string;
  clientLocation?: string;
  firstViewedAt?: string;
  lastViewedAt?: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  terms?: JobTermsRecord;
}

export type JobSummaryRecord = Pick<JobRecord,
  "id" | "publicId" | "providerId" | "version" | "repeatUse" | "status" |
  "sourceChannel" | "providerLocation" | "createdAt" | "updatedAt" | "completedAt" | "clientName"
> & { terms?: JobTermsRecord };

export interface PublicJobProjection {
  publicId: string;
  status: JobStatus;
  providerLocation: string;
  service: string;
  scope: string;
  deliverables: string[];
  price: string;
  currency: string;
  deadline: string;
  revisionsIncluded: number;
  revisionsUsed: number;
  cancellationTerms: string;
  provider: {
    username: string;
    displayName: string;
    headline: string;
  };
}

/** A timeline DTO intentionally strips actors, operation metadata and evidence. */
export interface PublicTrustEvent {
  id: string;
  eventType: PublicTrustEventType;
  occurredAt: string;
}

/** The only DTO that anonymous transaction rendering may receive. */
export interface PublicTransactionProjection {
  record: PublicJobProjection;
  events: PublicTrustEvent[];
}

export interface DeliveryRecord {
  id: string;
  jobId: string;
  description: string;
  fileUrls: string[];
  submittedBy: string;
  submittedAt: string;
}

export interface RevisionRecord {
  id: string;
  jobId: string;
  revisionNumber: number;
  description: string;
  requestedBy: string;
  requestedAt: string;
}

export interface DisputeRecord {
  id: string;
  jobId: string;
  raisedBy: "PROVIDER" | "CLIENT";
  contestedTerm: "Scope" | "Quality" | "Deadline" | "Payment" | "Communication";
  claimDescription: string;
  evidenceUrls: string[];
  responseFromOtherParty?: string;
  disputeStatus: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED";
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRecord {
  id: string;
  jobId: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comment?: string;
  submittedAt: string;
}

export interface PaymentRecord {
  id: string;
  jobId: string;
  paymentMode: import("../payments/types").RecordedPaymentMode;
  amount: string;
  currency: "NGN";
  reference?: string;
  notes?: string;
  recordedBy: import("../payments/types").RecordedPaymentActor;
  verificationStatus: import("../payments/types").RecordedPaymentVerificationStatus;
  recordedAt: string;
}

export interface TrustEventRecord {
  id: string;
  jobId: string;
  actorId: string;
  actorType: import("../trust-events").TrustEventActorType;
  eventType: import("../trust-events").TrustEventType;
  eventSequence: number;
  occurredAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationIntentRecord {
  id: string;
  jobId: string;
  eventId: string;
  notificationKind: import("../notifications").NotificationKind;
  recipientRole: import("../notifications").NotificationRecipientRole;
  createdAt: string;
}

export interface CreateJobInput {
  creationId?: string;
  repeatUse: "FIRST" | "PROMPTED" | "UNPROMPTED";
  providerId: string;
  title: string;
  category: string;
  scope: string;
  deliverables: string[];
  price: string;
  currency?: string;
  deadline: string;
  revisions: number;
  cancellationTerms: string;
  sourceChannel: SourceChannel;
  providerLocation?: string;
}
