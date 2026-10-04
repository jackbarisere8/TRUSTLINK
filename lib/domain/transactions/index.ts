import { z } from "zod";
import type { JobAggregate, Repository } from "../../db/repository";
import { createJobSchema, acceptanceSchema, commandSchema } from "../../validation/schemas";
import { createAggregate } from "../jobs/index";
import { requireRole, validCapability, type Actor } from "../participants";
import { DomainError } from "../errors";
import { acceptAggregate, transition } from "./state-machine";
import { mutationRequestSchema } from "./request";

const creationSchema = createJobSchema.extend({ creationId: z.uuid() });
type CreationInput = z.infer<typeof creationSchema>;

function isSameCreation(existing: JobAggregate, actor: Actor, input: CreationInput) {
  return existing.job.id === input.creationId && existing.job.providerId === actor.id &&
    existing.job.sourceChannel === input.sourceChannel && existing.job.repeatUse === input.repeatUse &&
    existing.terms.service === input.title && existing.terms.serviceCategory === input.category &&
    existing.terms.scope === input.scope && JSON.stringify(existing.terms.deliverables) === JSON.stringify(input.deliverables) &&
    Number(existing.terms.price) === Number(input.price) && existing.terms.currency === "NGN" &&
    existing.terms.deadline === input.deadline && existing.terms.revisionsIncluded === input.revisions &&
    existing.terms.cancellationTerms === input.cancellationTerms;
}

/** Session/capability resolution stays at the server boundary. Persistence is injected. */
export class TransactionService {
  constructor(private readonly repository: Repository) {}

  async create(actor: Actor, input: unknown) {
    requireRole(actor, ["PROVIDER"]);
    const parsed = creationSchema.safeParse(input);
    if (!parsed.success) throw new DomainError(parsed.error.issues[0].message);
    const existing = await this.repository.getAggregate(parsed.data.creationId);
    if (existing) {
      if (!isSameCreation(existing, actor, parsed.data)) throw new DomainError("This creation request cannot be reused for different transaction details.");
      return { aggregate: existing, token: undefined };
    }
    const previous = await this.repository.listJobs(actor.id);
    if (previous.length && parsed.data.repeatUse === "FIRST") {
      throw new DomainError("Tell us whether this repeat transaction was prompted or unprompted.");
    }
    if (!previous.length && parsed.data.repeatUse !== "FIRST") {
      throw new DomainError("The first transaction must be classified as first use.");
    }
    const profile = await this.repository.getProfileByUserId(actor.id);
    if (!profile) throw new DomainError("Create your provider profile before publishing a transaction.");
    const created = createAggregate({
      ...parsed.data,
      providerId: actor.id,
      providerLocation: [profile.city, profile.state, profile.country].filter(Boolean).join(", "),
    });
    try { await this.repository.commit(created.aggregate, null); }
    catch (error) {
      const saved = await this.repository.getAggregate(created.aggregate.job.id);
      if (!saved || !isSameCreation(saved, actor, parsed.data)) throw error;
      return { aggregate: saved, token: undefined };
    }
    return created;
  }

  async accept(publicId: string, token: string, input: unknown, requestInput: unknown) {
    const parsed = acceptanceSchema.safeParse(input);
    if (!parsed.success) throw new DomainError("Provide your name, valid email, and confirmation of the terms.");
    const request = mutationRequestSchema.safeParse(requestInput);
    if (!request.success) throw new DomainError("Refresh the record before submitting this action.");
    const current = await this.repository.getAggregate(publicId, true);
    if (!current) throw new DomainError("Transaction not found.");
    const next = acceptAggregate(current, token, parsed.data, request.data);
    if (next !== current) {
      try { await this.repository.commit(next, current.job.version); }
      catch (error) {
        // The first of two identical requests may have committed while this
        // request was waiting. Return success only for that exact operation.
        try {
          const saved = await this.repository.getAggregate(publicId, true);
          if (saved && acceptAggregate(saved, token, parsed.data, request.data) === saved) return saved;
        } catch { /* No exact persisted acceptance was found. */ }
        throw error;
      }
    }
    return next;
  }

  async execute(jobId: string, actor: Actor, input: unknown, requestInput: unknown, capability?: string, validateBeforeCommit?: () => Promise<void>) {
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success) throw new DomainError("Check the fields and try again.");
    const request = mutationRequestSchema.safeParse(requestInput);
    if (!request.success) throw new DomainError("Refresh the record before submitting this action.");
    const current = await this.repository.getAggregate(jobId);
    if (!current) throw new DomainError("Transaction not found.");
    if (actor.type === "CLIENT_PARTICIPANT" && !validCapability(current.job, capability || "")) {
      throw new DomainError("This participant link is invalid or expired. Ask the provider for a new link.");
    }
    const result = transition(current, actor, parsed.data, request.data);
    if (result.aggregate !== current) {
      try {
        await validateBeforeCommit?.();
        await this.repository.commit(result.aggregate, current.job.version);
      } catch (error) {
        // A simultaneous retry can lose the compare-and-swap after the first
        // request commits. Resolve only an exact persisted replay; unrelated
        // conflicts and failed atomic writes retain their original error.
        try {
          const saved = await this.repository.getAggregate(jobId);
          if (saved && (actor.type !== "CLIENT_PARTICIPANT" || validCapability(saved.job, capability || ""))) {
            const replay = transition(saved, actor, parsed.data, request.data);
            if (replay.replayed) return replay;
          }
        } catch { /* The saved aggregate does not contain this exact request. */ }
        throw error;
      }
    }
    return result;
  }
}
