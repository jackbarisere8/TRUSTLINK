import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { validCapability, requireParticipant, type Actor } from "@/lib/domain/jobs";
import { DomainError } from "@/lib/domain/errors";
import type { JobAggregate } from "@/lib/db/repository";
import type { PublicJobProjection } from "@/lib/db/types";
import { exampleRecord } from "@/lib/examples";
export const capabilityCookie = (publicId: string) => "tl_client_" + publicId;
export async function identifyActor(a: JobAggregate): Promise<Actor> {
  const user = await getCurrentUser();
  if (user?.userId === a.job.providerId) return { id: user.userId, type: "PROVIDER", name: user.displayName };
  if (user?.role === "ADMIN") return { id: user.userId, type: "ADMIN", name: user.displayName };
  const token = (await cookies()).get(capabilityCookie(a.job.publicId))?.value || "";
  if (validCapability(a.job, token)) return { id: "client:" + a.job.id, type: "CLIENT_PARTICIPANT", name: a.job.clientName || "Client" };
  throw new DomainError("Open your private participant link or log in as the provider to continue.");
}
export async function authorizedJob(id: string, byPublicId = false) {
  const aggregate = await db.getAggregate(id, byPublicId);
  if (!aggregate) throw new DomainError("Transaction not found.");
  const actor = await identifyActor(aggregate);
  requireParticipant(aggregate, actor);
  return { aggregate, actor };
}
export async function getPublicJobProjection(publicId: string): Promise<PublicJobProjection | null> {
  if (publicId === exampleRecord.publicId) return exampleRecord;
  const a = await db.getAggregate(publicId, true);
  if (!a || a.job.status === "DRAFT") return null;
  const profile = await db.getProfileByUserId(a.job.providerId);
  if (!profile) return null;
  const provider = (await db.getProfileByUsername(profile.username))?.providerProfile;
  return {
    publicId: a.job.publicId, status: a.job.status, sourceChannel: a.job.sourceChannel,
    providerLocation: a.job.providerLocation, createdAt: a.job.createdAt,
    service: a.terms.service, serviceCategory: a.terms.serviceCategory, scope: a.terms.scope,
    deliverables: a.terms.deliverables, price: a.terms.price, currency: a.terms.currency,
    deadline: a.terms.deadline, revisionsIncluded: a.terms.revisionsIncluded, revisionsUsed: a.terms.revisionsUsed,
    cancellationTerms: a.terms.cancellationTerms,
    provider: { username: profile.username, displayName: profile.displayName,
      initials: profile.displayName.split(" ").map(n => n[0]).join("").slice(0,2),
      headline: provider?.headline || "Independent professional", verificationStatus: provider?.verificationStatus || "UNVERIFIED" },
  };
}
