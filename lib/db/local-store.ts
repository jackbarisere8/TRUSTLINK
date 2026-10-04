import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Repository, JobAggregate, ProfileBundle, ProfileInput } from "./repository";
import type { JobTermsRecord, NotificationIntentRecord, PublicJobProjection, PublicTransactionProjection, TrustEventRecord } from "./types";
import { ConflictError } from "../domain/errors";
import { publicEvents } from "../domain/trust-events";
import { aggregateSchema, localDataSchema } from "./local-schema";
import { isDeepStrictEqual } from "node:util";
import { acceptedTermsSnapshot, type AcceptedTermsSnapshot } from "../domain/transactions/acceptance";
import { hasActiveStoredClientCapability } from "../domain/participants";
import { notificationIntentsForEvent, notificationIntentsForEvents } from "../notifications";
interface LocalData { profiles: ProfileBundle[]; records: JobAggregate[]; notificationIntents: NotificationIntentRecord[] }

function legacyAcceptedTerms(value: unknown): AcceptedTermsSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const terms = value as Partial<JobTermsRecord>;
  if (typeof terms.service !== "string" || typeof terms.serviceCategory !== "string" ||
      typeof terms.scope !== "string" || !Array.isArray(terms.deliverables) ||
      !terms.deliverables.every(item => typeof item === "string") || typeof terms.price !== "string" ||
      typeof terms.currency !== "string" || typeof terms.deadline !== "string" ||
      typeof terms.revisionsIncluded !== "number" || typeof terms.cancellationTerms !== "string") return null;
  return acceptedTermsSnapshot({
    service: terms.service,
    serviceCategory: terms.serviceCategory,
    scope: terms.scope,
    deliverables: terms.deliverables,
    price: terms.price,
    currency: terms.currency,
    deadline: terms.deadline,
    revisionsIncluded: terms.revisionsIncluded,
    cancellationTerms: terms.cancellationTerms,
  });
}

function legacyTrustEvents(records: unknown[]): TrustEventRecord[] {
  return records.flatMap(record => {
    if (!record || typeof record !== "object") return [];
    const events = (record as Record<string, unknown>).events;
    return Array.isArray(events) ? events as TrustEventRecord[] : [];
  });
}

function upgradeLegacyRecords(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const root = value as Record<string,unknown>;
  if (!Array.isArray(root.records)) return value;
  const records = root.records.map(record => {
      if (!record || typeof record !== "object") return record;
      const aggregate = record as Record<string,unknown>;
      if (!Array.isArray(aggregate.events)) return record;
      const terms = aggregate.terms && typeof aggregate.terms === "object" ? aggregate.terms as Record<string,unknown> : {};
      const acceptanceTerms = legacyAcceptedTerms(terms);
      const deliveries = Array.isArray(aggregate.deliveries) ? aggregate.deliveries : [];
      const revisions = Array.isArray(aggregate.revisions) ? aggregate.revisions : [];
      const disputes = Array.isArray(aggregate.disputes) ? aggregate.disputes : [];
      const reviews = Array.isArray(aggregate.reviews) ? aggregate.reviews.map(review => {
        if (!review || typeof review !== "object") return review;
        const normalized = { ...(review as Record<string,unknown>) };
        if (typeof normalized.comment === "string" && !normalized.comment.trim()) delete normalized.comment;
        return normalized;
      }) : aggregate.reviews;
      const payments = Array.isArray(aggregate.payments) ? aggregate.payments.map(payment => {
        if (!payment || typeof payment !== "object") return payment;
        return { amount: terms.price, currency: terms.currency, ...(payment as Record<string,unknown>) };
      }) : aggregate.payments;
      const recordedPayment = Array.isArray(payments) && payments[0] && typeof payments[0] === "object" ? payments[0] as Record<string,unknown> : undefined;
      let deliveryIndex = 0, revisionIndex = 0, disputeIndex = 0;
      return {
        ...aggregate,
        payments,
        reviews,
        events: aggregate.events.map((event,index) => {
          if (!event || typeof event !== "object") return event;
          const next = { ...(event as Record<string,unknown>) };
          if (!("eventSequence" in next)) next.eventSequence = index+1;
          const metadata = next.metadata && typeof next.metadata === "object" && !Array.isArray(next.metadata)
            ? next.metadata as Record<string,unknown> : undefined;
          if (next.eventType === "PAYMENT_RECORDED" && recordedPayment) next.metadata = {
            ...(metadata || {}),
            paymentMode: recordedPayment.paymentMode, amount: recordedPayment.amount, currency: recordedPayment.currency,
            recordedBy: recordedPayment.recordedBy, verificationStatus: recordedPayment.verificationStatus,
          };
          if (next.eventType === "DELIVERY_SUBMITTED") {
            const delivery = deliveries[deliveryIndex++] as Record<string,unknown> | undefined;
            if (delivery) next.metadata = { ...(metadata || {}),
              ...(metadata?.deliveryId === undefined ? { deliveryId: delivery.id } : {}),
              ...(metadata?.fileCount === undefined ? { fileCount: Array.isArray(delivery.fileUrls) ? delivery.fileUrls.length : 0 } : {}),
            };
          }
          if (next.eventType === "REVISION_REQUESTED") {
            const revision = revisions[revisionIndex++] as Record<string,unknown> | undefined;
            if (revision) next.metadata = { ...(metadata || {}),
              ...(metadata?.revisionId === undefined ? { revisionId: revision.id } : {}),
              ...(metadata?.revisionNumber === undefined ? { revisionNumber: revision.revisionNumber } : {}),
            };
          }
          if (next.eventType === "DELIVERY_APPROVED") {
            const delivery = deliveries[Math.max(0,deliveryIndex-1)] as Record<string,unknown> | undefined;
            if (delivery) next.metadata = { ...(metadata || {}), ...(metadata?.deliveryId === undefined ? { deliveryId: delivery.id } : {}) };
          }
          if (next.eventType === "DISPUTE_OPENED") {
            const dispute = disputes[disputeIndex++] as Record<string,unknown> | undefined;
            if (dispute) next.metadata = { ...(metadata || {}),
              ...(metadata?.disputeId === undefined ? { disputeId: dispute.id } : {}),
              ...(metadata?.contestedTerm === undefined ? { contestedTerm: dispute.contestedTerm } : {}),
              ...(metadata?.fileCount === undefined ? { fileCount: Array.isArray(dispute.evidenceUrls) ? dispute.evidenceUrls.length : 0 } : {}),
            };
          }
          if (next.eventType === "DISPUTE_RESOLVED") {
            const dispute = disputes.find(item => item && typeof item === "object" &&
              (item as Record<string,unknown>).resolvedAt === next.occurredAt) as Record<string,unknown> | undefined;
            if (dispute) next.metadata = { ...(metadata || {}), ...(metadata?.disputeId === undefined ? { disputeId: dispute.id } : {}) };
          }
          if (next.eventType === "CLIENT_REVIEWED" && Array.isArray(reviews)) {
            const review = reviews.find(item => item && typeof item === "object" &&
              (item as Record<string,unknown>).submittedAt === next.occurredAt) as Record<string,unknown> | undefined;
            if (review) next.metadata = { ...(metadata || {}),
              ...(metadata?.reviewId === undefined ? { reviewId: review.id } : {}),
              ...(metadata?.rating === undefined ? { rating: review.rating } : {}),
            };
          }
          if (next.eventType === "JOB_ACCEPTED" && acceptanceTerms && metadata) {
            const reportedStatus = metadata.participantDetailStatus ?? metadata.identityStatus;
            next.metadata = {
              ...metadata,
              ...(!("participantDetailStatus" in metadata) &&
                  (reportedStatus === undefined || reportedStatus === "SELF_PROVIDED")
                ? { participantDetailStatus: "SELF_PROVIDED" }
                : {}),
              ...(!("acceptedTerms" in metadata) ? { acceptedTerms: acceptanceTerms } : {}),
            };
          }
          return next;
        }),
      };
    });
  return {
    ...root,
    records,
    notificationIntents: Array.isArray(root.notificationIntents) ? root.notificationIntents
      : notificationIntentsForEvents(legacyTrustEvents(records)),
  };
}

export class LocalStoreRepository implements Repository {
  constructor(private filename = path.join(process.cwd(), "data", "trustlink-local-v3.json")) {}
  private read(): LocalData {
    if (!fs.existsSync(this.filename)) return { profiles: [], records: [], notificationIntents: [] };
    const contents = fs.readFileSync(this.filename, "utf8");
    let decoded: unknown;
    try { decoded = JSON.parse(contents); }
    catch { throw new Error("Local store contains invalid JSON. Preserve the file and inspect it before retrying."); }
    const parsed = localDataSchema.safeParse(upgradeLegacyRecords(decoded));
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
  async getPublicTransaction(publicId: string): Promise<PublicTransactionProjection | null> {
    const data = this.read();
    const aggregate = data.records.find(record => record.job.publicId === publicId);
    if (!aggregate || aggregate.job.status === "DRAFT") return null;
    const provider = data.profiles.find(item => item.profile.userId === aggregate.job.providerId);
    if (!provider) return null;
    const record: PublicJobProjection = {
      publicId: aggregate.job.publicId,
      status: aggregate.job.status,
      providerLocation: aggregate.job.providerLocation,
      service: aggregate.terms.service,
      scope: aggregate.terms.scope,
      deliverables: aggregate.terms.deliverables,
      price: aggregate.terms.price,
      currency: aggregate.terms.currency,
      deadline: aggregate.terms.deadline,
      revisionsIncluded: aggregate.terms.revisionsIncluded,
      revisionsUsed: aggregate.terms.revisionsUsed,
      cancellationTerms: aggregate.terms.cancellationTerms,
      provider: {
        username: provider.profile.username,
        displayName: provider.profile.displayName,
        headline: provider.providerProfile?.headline || "Independent professional",
      },
    };
    return { record, events: publicEvents(aggregate.events) };
  }
  async listJobs(providerId?: string) { return this.read().records.filter(a => !providerId || a.job.providerId === providerId).map(a => ({ ...a.job, terms: a.terms })).sort((a,b) => b.createdAt.localeCompare(a.createdAt)); }
  async listProfiles() { return this.read().profiles.map(p => p.profile); }
  async listDisputes() { return this.read().records.flatMap(a => a.disputes); }
  async listEvents() { return this.read().records.flatMap(a => a.events); }
  async listNotificationIntents(jobId?: string) {
    return this.read().notificationIntents.filter(intent => !jobId || intent.jobId === jobId);
  }
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
        if (aggregate.job.version !== 0 || !aggregate.events.length || !hasActiveStoredClientCapability(aggregate.job)) throw new Error("Invalid initial transaction");
        const returningProvider = data.records.some(record => record.job.providerId === aggregate.job.providerId);
        if (returningProvider === (aggregate.job.repeatUse === "FIRST")) throw new Error("Invalid local transaction repeat-use classification");
        data.records.push(aggregate);
      } else {
        if (idx === -1 || data.records[idx].job.version !== expectedVersion) throw new ConflictError();
        const previous = data.records[idx];
        if (aggregate.job.version !== expectedVersion + 1 || aggregate.events.length !== previous.events.length + 1) throw new Error("A transition requires exactly one new versioned event");
        if (!isDeepStrictEqual(aggregate.events.slice(0, previous.events.length), previous.events)) throw new Error("Trust events are immutable");
        const immutableTerms = (a: JobAggregate) => ({ ...a.terms, revisionsUsed: 0 });
        if (!isDeepStrictEqual(immutableTerms(aggregate), immutableTerms(previous))) throw new Error("Agreed terms are immutable");
        for (const key of ["id", "publicId", "providerId", "repeatUse", "sourceChannel", "providerLocation", "createdAt"] as const) {
          if (aggregate.job[key] !== previous.job[key]) throw new Error("Transaction identity and origin are immutable");
        }
        const capabilityChanged = aggregate.job.clientActionTokenHash !== previous.job.clientActionTokenHash ||
          aggregate.job.clientTokenExpiresAt !== previous.job.clientTokenExpiresAt;
        const capabilityEvent = aggregate.events.at(-1)?.eventType;
        const acceptanceEvent = aggregate.events.at(-1);
        const acceptedNow = !previous.job.clientTokenUsed && aggregate.job.clientTokenUsed;
        if (acceptedNow !== (acceptanceEvent?.eventType === "JOB_ACCEPTED")) {
          throw new Error("Client acceptance requires one matching acceptance event");
        }
        if (acceptedNow &&
            (!acceptanceEvent || previous.job.status !== "SENT" || aggregate.job.status !== "ACCEPTED" || previous.job.clientTokenUsed ||
             !hasActiveStoredClientCapability(previous.job) || !hasActiveStoredClientCapability(aggregate.job) || !aggregate.job.clientTokenUsed ||
             aggregate.job.clientId !== previous.job.clientId ||
             acceptanceEvent.actorId !== `client:${aggregate.job.id}` ||
             acceptanceEvent.actorType !== "CLIENT_PARTICIPANT" ||
             acceptanceEvent.metadata.participantDetailStatus !== "SELF_PROVIDED")) {
          throw new Error("Client acceptance requires an active participant capability and the reviewed SENT agreement");
        }
        if (previous.job.clientTokenUsed &&
            (aggregate.job.clientId !== previous.job.clientId ||
             aggregate.job.clientTokenUsed !== previous.job.clientTokenUsed ||
             aggregate.job.clientName !== previous.job.clientName ||
             aggregate.job.clientEmail !== previous.job.clientEmail ||
             aggregate.job.clientPhone !== previous.job.clientPhone)) {
          throw new Error("Accepted client details are immutable");
        }
        const previousCapabilityStored = Boolean(previous.job.clientActionTokenHash && previous.job.clientTokenExpiresAt);
        const nextCapabilityStored = Boolean(aggregate.job.clientActionTokenHash && aggregate.job.clientTokenExpiresAt);
        if (capabilityEvent === "CLIENT_LINK_REVOKED" && (!previousCapabilityStored || nextCapabilityStored)) {
          throw new Error("Client capability revocation requires an active capability to be cleared");
        }
        if (capabilityEvent === "CLIENT_LINK_REISSUED" &&
            (!hasActiveStoredClientCapability(aggregate.job) || aggregate.job.clientActionTokenHash === previous.job.clientActionTokenHash)) {
          throw new Error("Client capability replacement requires a new active capability");
        }
        if (capabilityChanged) {
          if (capabilityEvent === "CLIENT_LINK_REISSUED" && nextCapabilityStored && aggregate.job.clientActionTokenHash !== previous.job.clientActionTokenHash) {
            // A newly generated, hashed capability replaces the old one.
          } else if (capabilityEvent === "CLIENT_LINK_REVOKED" && previousCapabilityStored && !nextCapabilityStored) {
            // Revocation clears both capability fields and invalidates old cookies.
          } else throw new Error("Client capability changes require a replacement or revocation event");
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
        const newEvent = aggregate.events.at(-1)!;
        const deliveryDelta = aggregate.deliveries.length-previous.deliveries.length;
        const revisionDelta = aggregate.revisions.length-previous.revisions.length;
        const disputeDelta = aggregate.disputes.length-previous.disputes.length;
        const reviewDelta = aggregate.reviews.length-previous.reviews.length;
        const unchangedEvidence = () => deliveryDelta === 0 && revisionDelta === 0 && disputeDelta === 0 && reviewDelta === 0;
        const changedDisputes = previous.disputes.flatMap((dispute,index) => isDeepStrictEqual(dispute,aggregate.disputes[index]) ? [] : [index]);
        if (newEvent.eventType !== "REVISION_REQUESTED" && aggregate.terms.revisionsUsed !== previous.terms.revisionsUsed) {
          throw new Error("Revision usage changes require a matching revision request");
        }
        switch (newEvent.eventType) {
          case "WORK_STARTED":
            if ((previous.job.status !== "PAYMENT_RECORDED" && previous.job.status !== "REVISION_REQUESTED") ||
                aggregate.job.status !== "IN_PROGRESS" || !unchangedEvidence()) throw new Error("Work start requires the canonical predecessor state");
            break;
          case "DELIVERY_SUBMITTED":
            if (previous.job.status !== "IN_PROGRESS" || aggregate.job.status !== "DELIVERY_SUBMITTED" || deliveryDelta !== 1 || revisionDelta !== 0 || disputeDelta !== 0) {
              throw new Error("Delivery submission requires one matching delivery record");
            }
            break;
          case "REVISION_REQUESTED":
            if (previous.job.status !== "DELIVERY_SUBMITTED" || aggregate.job.status !== "REVISION_REQUESTED" || deliveryDelta !== 0 || revisionDelta !== 1 || disputeDelta !== 0 ||
                aggregate.terms.revisionsUsed !== previous.terms.revisionsUsed+1 || aggregate.terms.revisionsUsed > aggregate.terms.revisionsIncluded) {
              throw new Error("Revision request exceeds the included limit or lacks its matching record");
            }
            break;
          case "DELIVERY_APPROVED":
            if (previous.job.status !== "DELIVERY_SUBMITTED" || aggregate.job.status !== "APPROVED" || !unchangedEvidence() ||
                newEvent.metadata.deliveryId !== previous.deliveries.at(-1)?.id) throw new Error("Approval requires the latest submitted delivery");
            break;
          case "DISPUTE_OPENED":
            if (!["ACCEPTED","PAYMENT_RECORDED","IN_PROGRESS","DELIVERY_SUBMITTED","REVISION_REQUESTED","APPROVED"].includes(previous.job.status) ||
                aggregate.job.status !== "DISPUTED" || deliveryDelta !== 0 || revisionDelta !== 0 || disputeDelta !== 1 || changedDisputes.length) {
              throw new Error("Dispute opening requires one matching dispute record");
            }
            break;
          case "DISPUTE_RESPONDED": {
            const index = previous.disputes.findIndex(dispute => dispute.disputeStatus === "OPEN");
            const before = previous.disputes[index], after = aggregate.disputes[index];
            if (previous.job.status !== "DISPUTED" || aggregate.job.status !== "DISPUTED" || !unchangedEvidence() ||
                index < 0 || changedDisputes.length !== 1 || changedDisputes[0] !== index || after.disputeStatus !== "UNDER_REVIEW" ||
                before.responseFromOtherParty || !after.responseFromOtherParty || newEvent.metadata.disputeId !== before.id) {
              throw new Error("Dispute response requires the authorized other party and one open dispute");
            }
            break;
          }
          case "DISPUTE_RESOLVED": {
            const index = previous.disputes.findIndex(dispute => dispute.disputeStatus === "OPEN" || dispute.disputeStatus === "UNDER_REVIEW");
            const before = previous.disputes[index], after = aggregate.disputes[index];
            if (previous.job.status !== "DISPUTED" || !["IN_PROGRESS","CANCELLED"].includes(aggregate.job.status) || !unchangedEvidence() ||
                index < 0 || changedDisputes.length !== 1 || changedDisputes[0] !== index || after.disputeStatus !== "RESOLVED" ||
                after.responseFromOtherParty !== before.responseFromOtherParty || newEvent.metadata.disputeId !== before.id ||
                newEvent.metadata.outcome !== aggregate.job.status) {
              throw new Error("Dispute resolution requires an administrator, one active dispute and an explicit outcome");
            }
            break;
          }
          case "CLIENT_REVIEWED": {
            const review = aggregate.reviews.at(-1);
            if (previous.job.status !== "COMPLETED" || aggregate.job.status !== "COMPLETED" ||
                deliveryDelta !== 0 || revisionDelta !== 0 || disputeDelta !== 0 || reviewDelta !== 1 || previous.reviews.length !== 0 ||
                !review || newEvent.metadata.reviewId !== review.id || newEvent.metadata.rating !== review.rating) {
              throw new Error("Client review requires one matching post-completion review record");
            }
            break;
          }
          default:
            if (!unchangedEvidence() || changedDisputes.length) throw new Error("Lifecycle evidence changes require their matching event");
        }
        data.records[idx] = aggregate;
      }
      const newEvent = expectedVersion === null ? undefined : aggregate.events.at(-1);
      if (newEvent) data.notificationIntents.push(...notificationIntentsForEvent(newEvent));
    });
  }
}
export const localStore = new LocalStoreRepository();
