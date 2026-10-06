import { z } from "zod";
import type { Repository } from "../../db/repository";
import { DomainError } from "../errors";

const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const accountProfileSchema = z.object({
  displayName: requiredText(120),
  country: requiredText(80),
  state: z.string().trim().max(100),
  city: z.string().trim().max(100),
});

export const providerOnboardingSchema = z.object({
  headline: requiredText(160),
  serviceArea: requiredText(160),
});

export async function updateAccount(
  repository: Repository,
  userId: string,
  input: unknown,
) {
  const parsed = accountProfileSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("Check your name and location details.");
  if (!await repository.getProfileByUserId(userId)) throw new DomainError("Account profile not found.");
  await repository.updateAccountProfile(userId, parsed.data);
}

export async function enableProviderProfile(
  repository: Repository,
  userId: string,
  input: unknown,
) {
  const parsed = providerOnboardingSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("Add a professional headline and service area.");
  if (!await repository.getProfileByUserId(userId)) throw new DomainError("Account profile not found.");
  return repository.enableProvider(userId, parsed.data);
}
