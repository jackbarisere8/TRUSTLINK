import { z } from "zod";
import type { JobAggregate, ProfileBundle } from "./repository";
import { jobStatuses } from "./types";
import { sourceChannels } from "../validation/schemas";
import { trustEventAllowsActor, trustEventTypes } from "../trust-events";
import { publicJobIdPattern } from "../domain/jobs/public-id";
import { matchesAcceptedTermsSnapshot } from "../domain/transactions/acceptance";
import { notificationIntentsForEvents, notificationKinds, notificationRecipientRoles } from "../notifications";

const text = z.string().min(1);
const optionalText = z.string().optional();
const timestamp = z.iso.datetime({ offset: true });
const child = z.object({ id: text, jobId: text });
const evidencePaths = z.array(z.string().min(1).max(500)).max(10).refine(paths => new Set(paths).size === paths.length);
const requestEventExclusions = new Set(["JOB_CREATED","JOB_SENT","JOB_VIEWED"]);
const operationId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const commandHash = /^[a-f0-9]{64}$/;

const profileSchema: z.ZodType<ProfileBundle> = z.object({
  profile: z.object({ id: text, userId: text, username: text, displayName: text, avatarUrl: optionalText, country: text, state: optionalText, city: optionalText, createdAt: timestamp }),
  providerProfile: z.object({
    id: text,
    userId: text,
    headline: text,
    bio: optionalText,
    serviceArea: text,
    verificationStatus: z.enum(["UNVERIFIED", "IDENTITY_PROVIDED", "VERIFIED_BY_TRUSTLINK"]),
    marketplaceStatus: z.enum(["NOT_LISTED", "DRAFT", "PUBLISHED", "SUSPENDED"]),
    businessName: optionalText,
    remoteServices: z.boolean(),
    bookingPolicy: optionalText,
    moderationStatus: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED", "SUSPENDED"]),
    publishedAt: timestamp.optional(),
    bookingCapacity: z.number().int().min(1).max(20),
    createdAt: timestamp,
    updatedAt: timestamp,
  }).nullable(),
});

export const aggregateSchema: z.ZodType<JobAggregate> = z.object({
  job: z.object({
    id: text, publicId: z.string().regex(publicJobIdPattern), providerId: text, version: z.number().int().nonnegative(),
    repeatUse: z.enum(["FIRST", "PROMPTED", "UNPROMPTED"]), status: z.enum(jobStatuses),
    clientId: optionalText, clientName: optionalText, clientEmail: optionalText, clientPhone: optionalText,
    clientActionTokenHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), clientTokenExpiresAt: timestamp.optional(), clientTokenUsed: z.boolean(),
    sourceChannel: z.enum(sourceChannels), providerLocation: text, clientLocation: optionalText,
    firstViewedAt: timestamp.optional(), lastViewedAt: timestamp.optional(), viewCount: z.number().int().nonnegative(),
    createdAt: timestamp, updatedAt: timestamp, completedAt: timestamp.optional(),
  }),
  terms: child.extend({ service: text, serviceCategory: text, scope: text, deliverables: z.array(text).min(1), price: z.string().regex(/^\d+(\.\d{1,2})?$/), currency: z.literal("NGN"), deadline: z.iso.date(), revisionsIncluded: z.number().int().min(0).max(20), revisionsUsed: z.number().int().nonnegative(), cancellationTerms: text, createdAt: timestamp }),
  payments: z.array(child.extend({ paymentMode: z.literal("RECORDED"), amount: z.string().regex(/^\d+(\.\d{1,2})?$/), currency: z.literal("NGN"), reference: z.string().max(200).optional(), notes: z.string().max(2000).optional(), recordedBy: z.literal("PROVIDER"), verificationStatus: z.literal("NOT_VERIFIED"), recordedAt: timestamp })).max(1),
  deliveries: z.array(child.extend({ description: z.string().min(1).max(5000), fileUrls: evidencePaths, submittedBy: text, submittedAt: timestamp })),
  revisions: z.array(child.extend({ revisionNumber: z.number().int().positive(), description: z.string().min(1).max(5000), requestedBy: text, requestedAt: timestamp })),
  disputes: z.array(child.extend({ raisedBy: z.enum(["PROVIDER", "CLIENT"]), contestedTerm: z.enum(["Scope", "Quality", "Deadline", "Payment", "Communication"]), claimDescription: z.string().min(1).max(5000), evidenceUrls: evidencePaths, responseFromOtherParty: z.string().min(1).max(5000).optional(), disputeStatus: z.enum(["OPEN", "UNDER_REVIEW", "RESOLVED", "CLOSED"]), resolutionNotes: z.string().min(1).max(5000).optional(), resolvedBy: text.optional(), resolvedAt: timestamp.optional(), createdAt: timestamp, updatedAt: timestamp })),
  reviews: z.array(child.extend({ reviewerId: text, reviewerName: text.max(120), rating: z.number().int().min(1).max(5), comment: z.string().min(1).max(3000).optional(), submittedAt: timestamp })).max(1),
  events: z.array(child.extend({ actorId: text, actorType: z.enum(["PROVIDER", "CLIENT_PARTICIPANT", "ADMIN", "SYSTEM"]), eventType: z.enum(trustEventTypes), eventSequence: z.number().int().positive(), occurredAt: timestamp, metadata: z.record(z.string(), z.unknown()), createdAt: timestamp })).min(2),
}).superRefine((a, context) => {
  const fail = () => context.addIssue({ code: "custom", message: "Invalid aggregate relationships" });
  if (a.terms.jobId !== a.job.id || a.terms.revisionsUsed > a.terms.revisionsIncluded || Number(a.terms.price) <= 0) fail();
  if (Boolean(a.job.clientActionTokenHash) !== Boolean(a.job.clientTokenExpiresAt)) fail();
  if (a.events[0]?.eventType !== "JOB_CREATED" || a.events[1]?.eventType !== "JOB_SENT") fail();
  if (a.events.length === 2) {
    const [created,sent] = a.events;
    const hasInitialEvidence = [a.payments,a.deliveries,a.revisions,a.disputes,a.reviews].some(collection => collection.length > 0);
    if (a.job.status !== "SENT" || a.job.version !== 0 || a.job.clientTokenUsed || a.job.completedAt ||
        a.terms.revisionsUsed !== 0 || hasInitialEvidence || created.actorId !== a.job.providerId || sent.actorId !== a.job.providerId ||
        !a.job.clientActionTokenHash || !a.job.clientTokenExpiresAt || Date.parse(a.job.clientTokenExpiresAt) <= Date.parse(a.job.createdAt) ||
        created.occurredAt !== a.job.createdAt || sent.occurredAt !== a.job.createdAt ||
        created.metadata.repeatUse !== a.job.repeatUse || created.metadata.sourceChannel !== a.job.sourceChannel) fail();
  }
  for (const [index,event] of a.events.entries()) {
    const previous = a.events[index-1];
    if (event.eventSequence !== index+1 || !trustEventAllowsActor(event.eventType,event.actorType) ||
        (previous && Date.parse(event.occurredAt) < Date.parse(previous.occurredAt)) || Date.parse(event.createdAt) < Date.parse(event.occurredAt)) fail();
    if (!requestEventExclusions.has(event.eventType) &&
        (typeof event.metadata.requestId !== "string" || !operationId.test(event.metadata.requestId) ||
         typeof event.metadata.commandHash !== "string" || !commandHash.test(event.metadata.commandHash) ||
         typeof event.metadata.expectedVersion !== "number" || !Number.isInteger(event.metadata.expectedVersion) || event.metadata.expectedVersion < 0)) fail();
  }
  const acceptanceEvents = a.events.filter(event => event.eventType === "JOB_ACCEPTED");
  const hasClientDetails = Boolean(a.job.clientId || a.job.clientName || a.job.clientEmail || a.job.clientPhone);
  if ((a.job.clientTokenUsed ? acceptanceEvents.length !== 1 : acceptanceEvents.length !== 0) || (a.job.clientTokenUsed && (!a.job.clientName || !a.job.clientEmail)) || (!a.job.clientTokenUsed && hasClientDetails)) fail();
  for (const acceptance of acceptanceEvents) {
    const currentStatus = acceptance.metadata.participantDetailStatus;
    const legacyStatus = acceptance.metadata.identityStatus;
    // New records must name the provenance precisely. A historical
    // identityStatus-only event remains readable, but the participant
    // projection treats anything other than SELF_PROVIDED as UNKNOWN.
    if ((currentStatus !== undefined && currentStatus !== "SELF_PROVIDED") ||
        (currentStatus === undefined && legacyStatus !== undefined && typeof legacyStatus !== "string") ||
        (currentStatus !== undefined && legacyStatus !== undefined && legacyStatus !== "SELF_PROVIDED") ||
        !matchesAcceptedTermsSnapshot(a.terms, acceptance.metadata.acceptedTerms)) fail();
  }
  const paymentEvents = a.events.filter(event => event.eventType === "PAYMENT_RECORDED");
  if (paymentEvents.length !== a.payments.length) fail();
  if (a.payments[0]) {
    const payment = a.payments[0], paymentEvent = paymentEvents[0];
    if (Number(payment.amount) <= 0 || payment.amount !== a.terms.price || payment.currency !== a.terms.currency ||
        Date.parse(payment.recordedAt) !== Date.parse(paymentEvent.occurredAt) ||
        paymentEvent.metadata.paymentMode !== payment.paymentMode || paymentEvent.metadata.amount !== payment.amount ||
        paymentEvent.metadata.currency !== payment.currency || paymentEvent.metadata.recordedBy !== payment.recordedBy ||
        paymentEvent.metadata.verificationStatus !== payment.verificationStatus) fail();
  }
  const deliveryEvents = a.events.filter(event => event.eventType === "DELIVERY_SUBMITTED");
  if (deliveryEvents.length !== a.deliveries.length) fail();
  for (const [index,delivery] of a.deliveries.entries()) {
    const deliveryEvent = deliveryEvents[index];
    if (!deliveryEvent || delivery.submittedBy !== a.job.providerId || deliveryEvent.actorId !== a.job.providerId ||
        deliveryEvent.actorType !== "PROVIDER" || delivery.submittedAt !== deliveryEvent.occurredAt ||
        deliveryEvent.metadata.deliveryId !== delivery.id || deliveryEvent.metadata.fileCount !== delivery.fileUrls.length) fail();
  }
  const revisionEvents = a.events.filter(event => event.eventType === "REVISION_REQUESTED");
  if (revisionEvents.length !== a.revisions.length || a.terms.revisionsUsed !== a.revisions.length) fail();
  for (const [index,revision] of a.revisions.entries()) {
    const revisionEvent = revisionEvents[index], expectedNumber = index+1;
    if (!revisionEvent || revision.revisionNumber !== expectedNumber || revision.requestedBy !== `client:${a.job.id}` ||
        revisionEvent.actorId !== revision.requestedBy || revisionEvent.actorType !== "CLIENT_PARTICIPANT" ||
        revision.requestedAt !== revisionEvent.occurredAt || revisionEvent.metadata.revisionId !== revision.id ||
        revisionEvent.metadata.revisionNumber !== expectedNumber) fail();
  }
  for (const approval of a.events.filter(event => event.eventType === "DELIVERY_APPROVED")) {
    const delivery = a.deliveries.find(item => item.id === approval.metadata.deliveryId);
    if (!delivery || approval.actorId !== `client:${a.job.id}` || approval.actorType !== "CLIENT_PARTICIPANT" ||
        Date.parse(approval.occurredAt) < Date.parse(delivery.submittedAt)) fail();
  }
  const disputeEvents = a.events.filter(event => event.eventType === "DISPUTE_OPENED");
  if (disputeEvents.length !== a.disputes.length) fail();
  const disputeResponseEvents = a.events.filter(event => event.eventType === "DISPUTE_RESPONDED");
  const disputeResolutionEvents = a.events.filter(event => event.eventType === "DISPUTE_RESOLVED");
  if (disputeResponseEvents.length !== a.disputes.filter(dispute => dispute.responseFromOtherParty).length ||
      disputeResolutionEvents.length !== a.disputes.filter(dispute => ["RESOLVED","CLOSED"].includes(dispute.disputeStatus)).length) fail();
  for (const [index,dispute] of a.disputes.entries()) {
    const disputeEvent = disputeEvents[index], expectedActor = dispute.raisedBy === "PROVIDER" ? a.job.providerId : `client:${a.job.id}`;
    const expectedActorType = dispute.raisedBy === "PROVIDER" ? "PROVIDER" : "CLIENT_PARTICIPANT";
    if (!disputeEvent || disputeEvent.actorId !== expectedActor || disputeEvent.actorType !== expectedActorType || dispute.createdAt !== disputeEvent.occurredAt ||
        disputeEvent.metadata.disputeId !== dispute.id || disputeEvent.metadata.contestedTerm !== dispute.contestedTerm ||
        disputeEvent.metadata.fileCount !== dispute.evidenceUrls.length) fail();
    const responseEvent = disputeResponseEvents.find(event => event.metadata.disputeId === dispute.id);
    const responseActor = dispute.raisedBy === "PROVIDER" ? `client:${a.job.id}` : a.job.providerId;
    const responseActorType = dispute.raisedBy === "PROVIDER" ? "CLIENT_PARTICIPANT" : "PROVIDER";
    if (dispute.responseFromOtherParty) {
      if (!responseEvent || responseEvent.actorId !== responseActor || responseEvent.actorType !== responseActorType ||
          Date.parse(responseEvent.occurredAt) < Date.parse(dispute.createdAt) || Date.parse(responseEvent.occurredAt) > Date.parse(dispute.updatedAt) ||
          !["UNDER_REVIEW","RESOLVED","CLOSED"].includes(dispute.disputeStatus)) fail();
    } else if (responseEvent || dispute.disputeStatus === "UNDER_REVIEW") fail();
    const resolutionEvent = disputeResolutionEvents.find(event => event.metadata.disputeId === dispute.id);
    if (["RESOLVED","CLOSED"].includes(dispute.disputeStatus)) {
      if (!resolutionEvent || resolutionEvent.actorType !== "ADMIN" || resolutionEvent.actorId !== dispute.resolvedBy ||
          resolutionEvent.occurredAt !== dispute.resolvedAt || dispute.updatedAt !== dispute.resolvedAt ||
          !dispute.resolutionNotes || !["IN_PROGRESS","CANCELLED"].includes(String(resolutionEvent.metadata.outcome))) fail();
    } else if (resolutionEvent || dispute.resolutionNotes || dispute.resolvedBy || dispute.resolvedAt) fail();
    if (dispute.disputeStatus === "OPEN" && dispute.updatedAt !== dispute.createdAt) fail();
    if (dispute.disputeStatus === "UNDER_REVIEW" && dispute.updatedAt !== responseEvent?.occurredAt) fail();
  }
  const reviewEvents = a.events.filter(event => event.eventType === "CLIENT_REVIEWED");
  if (reviewEvents.length !== a.reviews.length) fail();
  for (const review of a.reviews) {
    const reviewEvent = reviewEvents.find(event => event.metadata.reviewId === review.id);
    if (!reviewEvent || a.job.status !== "COMPLETED" || !a.job.completedAt ||
        review.reviewerId !== `client:${a.job.id}` || review.reviewerName !== a.job.clientName ||
        reviewEvent.actorId !== review.reviewerId || reviewEvent.actorType !== "CLIENT_PARTICIPANT" ||
        reviewEvent.occurredAt !== review.submittedAt || reviewEvent.metadata.rating !== review.rating ||
        Date.parse(review.submittedAt) < Date.parse(a.job.completedAt)) fail();
  }
  const requestIds = a.events.map(e => e.metadata.requestId).filter(id => id !== undefined);
  if (new Set(requestIds).size !== requestIds.length) fail();
  for (const collection of [a.payments, a.deliveries, a.revisions, a.disputes, a.reviews, a.events]) {
    if (collection.some(row => row.jobId !== a.job.id) || new Set(collection.map(row => row.id)).size !== collection.length) fail();
  }
});

const notificationIntentSchema = z.object({
  id: text,
  jobId: text,
  eventId: text,
  notificationKind: z.enum(notificationKinds),
  recipientRole: z.enum(notificationRecipientRoles),
  createdAt: timestamp,
});

export const localDataSchema = z.object({
  profiles: z.array(profileSchema),
  records: z.array(aggregateSchema),
  notificationIntents: z.array(notificationIntentSchema),
}).superRefine((data, context) => {
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(data.records.map(a => a.job.id)) || !unique(data.records.map(a => a.job.publicId)) || !unique(data.profiles.map(p => p.profile.userId)) ||
      !unique(data.profiles.map(p => p.profile.username.toLowerCase())) || !unique(data.notificationIntents.map(intent => intent.id)) ||
      !unique(data.notificationIntents.map(intent => `${intent.eventId}:${intent.recipientRole}`))) {
    context.addIssue({ code: "custom", message: "Duplicate local identifiers" });
  }
  if (data.profiles.some(p => p.providerProfile && p.providerProfile.userId !== p.profile.userId)) {
    context.addIssue({ code: "custom", message: "Mismatched provider profile" });
  }
  const providerJobs = new Map<string, Array<(typeof data.records)[number]>>();
  for (const record of data.records) {
    const history = providerJobs.get(record.job.providerId) || [];
    history.push(record);
    providerJobs.set(record.job.providerId, history);
  }
  if ([...providerJobs.values()].some(history => history[0]?.job.repeatUse !== "FIRST" || history.slice(1).some(record => record.job.repeatUse === "FIRST"))) {
    context.addIssue({ code: "custom", message: "Repeat-use classification must identify first and returning provider transactions" });
  }
  const expected = notificationIntentsForEvents(data.records.flatMap(record => record.events));
  const byKey = new Map(data.notificationIntents.map(intent => [`${intent.eventId}:${intent.recipientRole}`, intent]));
  if (expected.length !== data.notificationIntents.length || expected.some(intent => {
    const saved = byKey.get(`${intent.eventId}:${intent.recipientRole}`);
    return !saved || saved.id !== intent.id || saved.jobId !== intent.jobId || saved.notificationKind !== intent.notificationKind || saved.createdAt !== intent.createdAt;
  })) {
    context.addIssue({ code: "custom", message: "Notification intents must match immutable trust events" });
  }
});
