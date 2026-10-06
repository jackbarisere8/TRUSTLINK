"use server";

import { getProviderSearchCatalog, getProviderSearchRepository } from "@/lib/db/provider-search";
import { parseProviderSearchParams, privateNearbySchema, type ProviderSearchPage, type SearchParamInput } from "@/lib/domain/provider-search";

export type NearbySearchActionResult = { data?: ProviderSearchPage; error?: string };

export async function searchNearbyProvidersAction(input: SearchParamInput, privateLocation: unknown): Promise<NearbySearchActionResult> {
  const location = privateNearbySchema.safeParse(privateLocation);
  if (!location.success) return { error: "Your location could not be used. Check location access and try again." };
  try {
    const catalog = await getProviderSearchCatalog();
    const parsed = parseProviderSearchParams({ ...input, nearby: "1", radius: String(location.data.radiusKm) }, catalog);
    if (parsed.issues.some(issue => issue.includes("invalid") || issue.includes("unavailable") || issue.includes("does not belong"))) {
      return { error: "Some search filters are no longer valid. Review the filters and try again." };
    }
    return { data: await getProviderSearchRepository().search(parsed.filters, location.data) };
  } catch {
    return { error: "Provider search is temporarily unavailable. Please try again." };
  }
}
