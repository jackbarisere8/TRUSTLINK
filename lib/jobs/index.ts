import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentUser, type UserSession } from "@/lib/auth";
import { validCapability, requireParticipant, type Actor } from "@/lib/domain/jobs";
import { DomainError } from "@/lib/domain/errors";
import type { JobAggregate } from "@/lib/db/repository";
import type { PublicJobProjection, PublicTransactionProjection } from "@/lib/db/types";
import { publicJobIdPattern } from "@/lib/domain/jobs/public-id";

export const capabilityCookie = (publicId: string) => "tl_client_" + publicId;
export const capabilityCookiePath = (publicId: string) => "/j/" + publicId;
export const evidenceCapabilityCookie = (jobId: string) => "tl_client_evidence_" + jobId;
export const evidenceCapabilityCookiePath = (jobId: string) => "/api/evidence/" + jobId;

type CapabilityCookieStore = { get(name: string): { value: string } | undefined };

function capabilityFor(aggregate: JobAggregate, cookieStore: CapabilityCookieStore) {
  return cookieStore.get(capabilityCookie(aggregate.job.publicId))?.value ||
    cookieStore.get(evidenceCapabilityCookie(aggregate.job.id))?.value || "";
}

function actorFor(a: JobAggregate, user: UserSession | null, token: string): Actor {
  if (user?.userId === a.job.providerId) return { id: user.userId, type: "PROVIDER", name: user.displayName };
  if (user?.role === "ADMIN") return { id: user.userId, type: "ADMIN", name: user.displayName };
  if (validCapability(a.job, token)) return { id: "client:" + a.job.id, type: "CLIENT_PARTICIPANT", name: a.job.clientName || "Client" };
  throw new DomainError("Open your private participant link or log in as the provider to continue.");
}

export async function identifyActor(a: JobAggregate): Promise<Actor> {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  return actorFor(a, user, capabilityFor(a, cookieStore));
}

export async function authorizedJob(id: string, byPublicId = false) {
  const aggregate = await db.getAggregate(id, byPublicId);
  if (!aggregate) throw new DomainError("Transaction not found.");
  const actor = await identifyActor(aggregate);
  requireParticipant(aggregate, actor);
  return { aggregate, actor };
}

/**
 * Public routes always read the narrow repository projection. Invalid opaque
 * IDs are rejected before any datastore access.
 */
export const getPublicTransaction = cache(async (publicId: string): Promise<PublicTransactionProjection | null> => {
  if (!publicJobIdPattern.test(publicId)) return null;
  return db.getPublicTransaction(publicId);
});

export async function getPublicJobProjection(publicId: string): Promise<PublicJobProjection | null> {
  return (await getPublicTransaction(publicId))?.record || null;
}

/**
 * Anonymous visitors never load the private aggregate. It is read only after
 * a server-validated account session or a transaction-scoped capability cookie
 * signals that private participant controls may be needed.
 */
export async function getPublicTransactionAccess(publicId: string, providerUsername: string) {
  if (!publicJobIdPattern.test(publicId)) return null;
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  const token = cookieStore.get(capabilityCookie(publicId))?.value || "";
  if (!user && !token) return null;
  // The provider username came from the persisted public projection. An
  // unrelated signed-in provider cannot cause a private aggregate read.
  if (!token && user?.role !== "ADMIN" && user?.username !== providerUsername) return null;
  const aggregate = await db.getAggregate(publicId, true);
  if (!aggregate) return null;
  try {
    return { aggregate, actor: actorFor(aggregate, user, token) };
  } catch {
    return null;
  }
}
