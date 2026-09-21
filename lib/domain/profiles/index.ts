import type { Repository } from "../../db/repository";
import { profileSchema } from "../../validation/schemas";
import { DomainError } from "../errors";

/** userId comes from the server-validated session, never the submitted form. */
export async function updateProviderProfile(repository: Repository, userId: string, input: unknown) {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("Check your name, location, headline and service area.");
  const profile = await repository.getProfileByUserId(userId);
  if (!profile) throw new DomainError("Profile not found.");
  await repository.updateProfile(userId, parsed.data);
  return { username: profile.username };
}
