import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { JobAggregate } from "../../db/repository";
import { participantDetailStatuses, type JobRecord, type ParticipantDetailStatus } from "../../db/types";
import { DomainError } from "../errors";
export type Actor = { id: string; type: "PROVIDER" | "CLIENT_PARTICIPANT" | "ADMIN"; name: string };

export type TransactionParticipant = {
  participantType: "PROVIDER" | "CLIENT_PARTICIPANT";
  actorId: string;
  accountAssociation: "ACCOUNT" | "GUEST";
  accountUserId?: string;
  displayName: string;
  email?: string;
  phone?: string;
  detailStatus: ParticipantDetailStatus;
};

function isParticipantDetailStatus(value: unknown): value is ParticipantDetailStatus {
  return typeof value === "string" && participantDetailStatuses.some(status => status === value);
}

export function clientParticipantDetailStatus(a: JobAggregate): ParticipantDetailStatus {
  if (!a.job.clientTokenUsed) return "UNKNOWN";
  const acceptance = [...a.events].reverse().find(event => event.eventType === "JOB_ACCEPTED");
  const value = acceptance?.metadata.participantDetailStatus ?? acceptance?.metadata.identityStatus;
  return isParticipantDetailStatus(value) ? value : "UNKNOWN";
}

export function transactionParticipants(
  a: JobAggregate,
  provider: { displayName: string; detailStatus: ParticipantDetailStatus },
): TransactionParticipant[] {
  const clientAccountId = a.job.clientId;
  return [
    {
      participantType: "PROVIDER",
      actorId: a.job.providerId,
      accountAssociation: "ACCOUNT",
      accountUserId: a.job.providerId,
      displayName: provider.displayName,
      detailStatus: provider.detailStatus,
    },
    {
      participantType: "CLIENT_PARTICIPANT",
      actorId: `client:${a.job.id}`,
      accountAssociation: clientAccountId ? "ACCOUNT" : "GUEST",
      ...(clientAccountId ? { accountUserId: clientAccountId } : {}),
      displayName: a.job.clientName || "Invited client",
      ...(a.job.clientEmail ? { email: a.job.clientEmail } : {}),
      ...(a.job.clientPhone ? { phone: a.job.clientPhone } : {}),
      detailStatus: clientParticipantDetailStatus(a),
    },
  ];
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export function validCapability(job: JobRecord, token: string, now = Date.now()) {
  if (!/^[a-f0-9]{64}$/.test(token) || !job.clientActionTokenHash || !job.clientTokenExpiresAt || !Number.isFinite(Date.parse(job.clientTokenExpiresAt)) || Date.parse(job.clientTokenExpiresAt) <= now) return false;
  const stored = Buffer.from(job.clientActionTokenHash, "hex");
  const incoming = Buffer.from(hashToken(token), "hex");
  return stored.length === incoming.length && timingSafeEqual(stored, incoming);
}
export function requireParticipant(a: JobAggregate, actor: Actor) {
  if (actor.type === "ADMIN") return;
  if (actor.type === "PROVIDER" && actor.id === a.job.providerId) return;
  if (actor.type === "CLIENT_PARTICIPANT" && actor.id === `client:${a.job.id}`) return;
  throw new DomainError("You don't have access to this transaction.");
}
export function requireRole(actor: Actor, allowed: Actor["type"][]) {
  if (!allowed.includes(actor.type)) throw new DomainError("You don't have permission to perform this action.");
}
