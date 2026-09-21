import { z } from "zod";
import type { JobAggregate, ProfileData } from "./repository";
import { jobStatuses } from "./types";
import { sourceChannels } from "../validation/schemas";

const text = z.string().min(1);
const optionalText = z.string().optional();
const timestamp = z.iso.datetime({ offset: true });
const child = z.object({ id: text, jobId: text });

const profileSchema: z.ZodType<ProfileData> = z.object({
  profile: z.object({ id: text, userId: text, username: text, displayName: text, avatarUrl: optionalText, country: text, state: optionalText, city: optionalText, createdAt: timestamp }),
  providerProfile: z.object({ id: text, userId: text, headline: text, bio: optionalText, serviceArea: text, verificationStatus: z.enum(["UNVERIFIED", "IDENTITY_PROVIDED", "VERIFIED_BY_TRUSTLINK"]), completedJobsCount: z.number().int().nonnegative(), averageRating: z.number().nullable(), onTimeRate: z.number().nullable(), createdAt: timestamp }).nullable(),
});

export const aggregateSchema: z.ZodType<JobAggregate> = z.object({
  job: z.object({
    id: text, publicId: text, providerId: text, version: z.number().int().nonnegative(),
    repeatUse: z.enum(["FIRST", "PROMPTED", "UNPROMPTED"]), status: z.enum(jobStatuses),
    clientId: optionalText, clientName: optionalText, clientEmail: optionalText, clientPhone: optionalText,
    clientActionTokenHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), clientTokenExpiresAt: timestamp.optional(), clientTokenUsed: z.boolean(),
    sourceChannel: z.enum(sourceChannels), providerLocation: text, clientLocation: optionalText,
    firstViewedAt: timestamp.optional(), lastViewedAt: timestamp.optional(), viewCount: z.number().int().nonnegative(),
    createdAt: timestamp, updatedAt: timestamp, completedAt: timestamp.optional(),
  }),
  terms: child.extend({ service: text, serviceCategory: text, scope: text, deliverables: z.array(text).min(1), price: z.string().regex(/^\d+(\.\d{1,2})?$/), currency: z.literal("NGN"), deadline: z.iso.date(), revisionsIncluded: z.number().int().min(0).max(20), revisionsUsed: z.number().int().nonnegative(), cancellationTerms: text, createdAt: timestamp }),
  payments: z.array(child.extend({ paymentMode: z.literal("RECORDED"), reference: optionalText, notes: optionalText, recordedBy: z.enum(["PROVIDER", "CLIENT"]), verificationStatus: z.literal("NOT_VERIFIED"), recordedAt: timestamp })).max(1),
  deliveries: z.array(child.extend({ description: text, fileUrls: z.array(text), submittedBy: text, submittedAt: timestamp })),
  revisions: z.array(child.extend({ revisionNumber: z.number().int().positive(), description: text, requestedBy: text, requestedAt: timestamp })),
  disputes: z.array(child.extend({ raisedBy: z.enum(["PROVIDER", "CLIENT"]), contestedTerm: z.enum(["Scope", "Quality", "Deadline", "Payment", "Communication"]), claimDescription: text, evidenceUrls: z.array(text), responseFromOtherParty: optionalText, disputeStatus: z.enum(["OPEN", "UNDER_REVIEW", "RESOLVED", "CLOSED"]), resolutionNotes: optionalText, resolvedBy: optionalText, resolvedAt: timestamp.optional(), createdAt: timestamp, updatedAt: timestamp })),
  reviews: z.array(child.extend({ reviewerId: text, reviewerName: text, rating: z.number().int().min(1).max(5), comment: optionalText, submittedAt: timestamp })).max(1),
  events: z.array(child.extend({ actorId: text, actorType: z.enum(["PROVIDER", "CLIENT_PARTICIPANT", "ADMIN", "SYSTEM"]), eventType: text, occurredAt: timestamp, metadata: z.record(z.string(), z.unknown()), createdAt: timestamp })).min(1),
}).superRefine((a, context) => {
  const fail = () => context.addIssue({ code: "custom", message: "Invalid aggregate relationships" });
  if (a.terms.jobId !== a.job.id || a.terms.revisionsUsed > a.terms.revisionsIncluded || Number(a.terms.price) <= 0) fail();
  const requestIds = a.events.map(e => e.metadata.requestId).filter(id => id !== undefined);
  if (new Set(requestIds).size !== requestIds.length) fail();
  for (const collection of [a.payments, a.deliveries, a.revisions, a.disputes, a.reviews, a.events]) {
    if (collection.some(row => row.jobId !== a.job.id) || new Set(collection.map(row => row.id)).size !== collection.length) fail();
  }
});

export const localDataSchema = z.object({ profiles: z.array(profileSchema), records: z.array(aggregateSchema) }).superRefine((data, context) => {
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(data.records.map(a => a.job.id)) || !unique(data.records.map(a => a.job.publicId)) || !unique(data.profiles.map(p => p.profile.userId)) || !unique(data.profiles.map(p => p.profile.username.toLowerCase()))) {
    context.addIssue({ code: "custom", message: "Duplicate local identifiers" });
  }
  if (data.profiles.some(p => p.providerProfile && p.providerProfile.userId !== p.profile.userId)) {
    context.addIssue({ code: "custom", message: "Mismatched provider profile" });
  }
});
