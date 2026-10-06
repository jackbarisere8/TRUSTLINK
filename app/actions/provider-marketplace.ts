"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { providerMarketplaceDb } from "@/lib/db/provider-marketplace";
import { publicError } from "@/lib/domain/errors";
import {
  addProviderBlackout,
  MarketplaceValidationError,
  replaceProviderAvailability,
  saveProviderService,
} from "@/lib/domain/provider-marketplace";
import { providerOriginSchema } from "@/lib/domain/provider-search";

export type ProviderMarketplaceActionResult = {
  ok?: true;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

async function providerIdentity() {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in to manage provider services." } as const;
  if (user.role !== "PROVIDER") return { error: "Enable your provider workspace before managing services." } as const;
  return { user } as const;
}

function failure(error: unknown): ProviderMarketplaceActionResult {
  if (error instanceof MarketplaceValidationError) return { error: error.message, fieldErrors: error.fieldErrors };
  return { error: publicError(error) };
}

function refreshProviderMarketplace(username?: string) {
  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/availability");
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/profile/preview");
  if (username) revalidatePath(`/p/${username}`);
}

export async function saveProviderServiceAction(serviceId: string | undefined, input: unknown): Promise<ProviderMarketplaceActionResult> {
  const identity = await providerIdentity();
  if ("error" in identity) return { error: identity.error };
  if (serviceId && !z.uuid().safeParse(serviceId).success) return { error: "The selected service is invalid." };
  try {
    await saveProviderService(providerMarketplaceDb, identity.user.userId, serviceId, input);
  } catch (error) {
    return failure(error);
  }
  refreshProviderMarketplace(identity.user.username);
  return { ok: true };
}

export async function archiveProviderServiceAction(serviceId: string): Promise<ProviderMarketplaceActionResult> {
  const identity = await providerIdentity();
  if ("error" in identity) return { error: identity.error };
  if (!z.uuid().safeParse(serviceId).success) return { error: "The selected service is invalid." };
  try {
    await providerMarketplaceDb.archiveService(identity.user.userId, serviceId);
  } catch (error) {
    return failure(error);
  }
  refreshProviderMarketplace(identity.user.username);
  return { ok: true };
}

export async function saveProviderAvailabilityAction(input: unknown): Promise<ProviderMarketplaceActionResult> {
  const identity = await providerIdentity();
  if ("error" in identity) return { error: identity.error };
  try {
    await replaceProviderAvailability(providerMarketplaceDb, identity.user.userId, input);
  } catch (error) {
    return failure(error);
  }
  refreshProviderMarketplace(identity.user.username);
  return { ok: true };
}

export async function addProviderBlackoutAction(input: unknown): Promise<ProviderMarketplaceActionResult> {
  const identity = await providerIdentity();
  if ("error" in identity) return { error: identity.error };
  try {
    await addProviderBlackout(providerMarketplaceDb, identity.user.userId, input);
  } catch (error) {
    return failure(error);
  }
  refreshProviderMarketplace(identity.user.username);
  return { ok: true };
}

export async function deleteProviderBlackoutAction(blackoutId: string): Promise<ProviderMarketplaceActionResult> {
  const identity = await providerIdentity();
  if ("error" in identity) return { error: identity.error };
  if (!z.uuid().safeParse(blackoutId).success) return { error: "The selected blackout period is invalid." };
  try {
    await providerMarketplaceDb.deleteBlackout(identity.user.userId, blackoutId);
  } catch (error) {
    return failure(error);
  }
  refreshProviderMarketplace(identity.user.username);
  return { ok: true };
}

export async function setProviderPublicationAction(publish: boolean): Promise<ProviderMarketplaceActionResult> {
  const identity = await providerIdentity();
  if ("error" in identity) return { error: identity.error };
  try {
    await providerMarketplaceDb.setPublication(identity.user.userId, publish);
  } catch (error) {
    return failure(error);
  }
  refreshProviderMarketplace(identity.user.username);
  return { ok: true };
}

export async function setProviderNearbyOriginAction(serviceId: string, input: unknown): Promise<ProviderMarketplaceActionResult> {
  const identity = await providerIdentity();
  if ("error" in identity) return { error: identity.error };
  if (!z.uuid().safeParse(serviceId).success) return { error: "The selected service is invalid." };
  const origin = input === null ? null : providerOriginSchema.safeParse(input);
  if (origin !== null && !origin.success) return { error: "The selected location could not be used." };
  try {
    await providerMarketplaceDb.setNearbyOrigin(identity.user.userId, serviceId, origin === null ? null : origin.data);
  } catch (error) {
    return failure(error);
  }
  refreshProviderMarketplace(identity.user.username);
  revalidatePath("/providers");
  return { ok: true };
}
