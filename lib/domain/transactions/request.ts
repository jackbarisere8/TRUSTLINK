import { z } from "zod";
import type { JobAggregate } from "../../db/repository";
import type { Actor } from "../participants";
import { hashToken } from "../participants";
import { ConflictError, DomainError } from "../errors";

export const mutationRequestSchema = z.object({ id: z.uuid(), expectedVersion: z.number().int().nonnegative() });
export type MutationRequest = z.infer<typeof mutationRequestSchema>;

export function checkRequest(current: JobAggregate, actor: Actor, command: unknown, input: MutationRequest) {
  const parsed = mutationRequestSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("Refresh the record before submitting this action.");
  const request = parsed.data;
  const commandHash = hashToken(JSON.stringify(command));
  const previous = current.events.find(e => e.metadata.requestId === request.id);
  if (previous) {
    if (previous.actorId !== actor.id || previous.metadata.commandHash !== commandHash ||
      (previous.metadata.expectedVersion !== undefined && previous.metadata.expectedVersion !== request.expectedVersion)) {
      throw new DomainError("This request identifier was already used for a different action.");
    }
    return { replayed: true, metadata: {} };
  }
  if (request.expectedVersion !== current.job.version) throw new ConflictError();
  return { replayed: false, metadata: { requestId: request.id, commandHash, expectedVersion: request.expectedVersion } };
}
