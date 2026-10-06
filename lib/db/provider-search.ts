import "server-only";

import { z } from "zod";
import administrativeAreas from "@/data/nigeria-administrative-areas.json";
import { resolveStorageMode } from "./config";
import type { Json } from "./database.generated";
import { getSupabaseClient } from "./supabase";
import { DomainError } from "../domain/errors";
import { providerSearchCategories, searchCandidates } from "../domain/provider-search";
import type {
  PrivateNearbyInput,
  ProviderSearchFilters,
  ProviderSearchPage,
  ProviderSearchRepository,
} from "../domain/provider-search";
import type { ProviderMarketplaceCatalog } from "../domain/provider-marketplace";

const nullableString = z.string().nullable().optional().transform(value => value ?? undefined);
const nullableNumber = z.number().nullable().optional().transform(value => value ?? undefined);
const durationSchema = z.object({ durationMinutes: z.number().int().positive(), label: nullableString });
const areaSchema = z.object({
  remoteService: z.boolean(),
  stateCode: nullableString,
  stateName: nullableString,
  lgaCode: nullableString,
  lgaName: nullableString,
  approximateOrigin: nullableString,
  radiusKm: nullableNumber,
}).strict();
const availabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  localStart: z.string().transform(value => value.slice(0, 5)),
  localEnd: z.string().transform(value => value.slice(0, 5)),
  timezone: z.literal("Africa/Lagos"),
  effectiveFrom: nullableString,
  effectiveTo: nullableString,
}).strict();
const resultSchema = z.object({
  serviceId: z.uuid(), providerUsername: z.string(), providerName: z.string(), providerHeadline: z.string(),
  serviceSlug: z.string(), serviceName: z.string(), categorySlug: z.string(), categoryName: z.string(),
  publicTitle: z.string(), description: z.string(), pricingModel: z.enum(["FIXED","STARTING_AT","HOURLY","DAILY","QUOTE_REQUIRED"]),
  priceMin: z.union([z.string(),z.number().transform(String)]).nullable().optional().transform(value => value == null ? undefined : value),
  priceMax: z.union([z.string(),z.number().transform(String)]).nullable().optional().transform(value => value == null ? undefined : value),
  currency: z.literal("NGN"), supportsRemote: z.boolean(), supportsOnsite: z.boolean(),
  durations: z.array(durationSchema), serviceAreas: z.array(areaSchema), availability: z.array(availabilitySchema),
  completedTransactions: z.number().int().nonnegative(), averageRating: nullableNumber,
  reviewCount: z.number().int().nonnegative(), distanceKm: nullableNumber, availableOnRequestedDate: z.boolean(),
}).strict();
const pageSchema = z.object({
  items: z.array(resultSchema), total: z.number().int().nonnegative(), page: z.number().int().positive(),
  pageSize: z.number().int().positive(), pageCount: z.number().int().nonnegative(),
}).strict();

class SupabaseProviderSearchRepository implements ProviderSearchRepository {
  async search(filters: ProviderSearchFilters, nearby?: PrivateNearbyInput): Promise<ProviderSearchPage> {
    const input = {
      q: filters.q, category: filters.category, state: filters.state, lga: filters.lga,
      remote: filters.remote, date: filters.date, sort: filters.sort, page: filters.page, pageSize: filters.pageSize,
      ...(nearby ? { latitude: nearby.latitude, longitude: nearby.longitude, radiusKm: nearby.radiusKm } : {}),
    };
    const { data, error } = await getSupabaseClient().rpc("tl_search_marketplace_services", { p_input: input as Json });
    if (error) throw new DomainError("Provider search is temporarily unavailable.");
    const parsed = pageSchema.safeParse(data);
    if (!parsed.success) throw new DomainError("Provider search returned an invalid response.");
    return parsed.data;
  }
}

class LocalProviderSearchRepository implements ProviderSearchRepository {
  async search(filters: ProviderSearchFilters, nearby?: PrivateNearbyInput): Promise<ProviderSearchPage> {
    // Local storage contains no provider marketplace projection. Never substitute demo providers.
    return searchCandidates([], filters, nearby);
  }
}

const localCatalog: ProviderMarketplaceCatalog = {
  categories: providerSearchCategories,
  states: administrativeAreas.states.map(state => ({
    code: state.code,
    name: state.name,
    kind: state.kind as "STATE" | "FCT",
    lgas: administrativeAreas.lgas.filter(lga => lga.stateCode === state.code).map(lga => ({
      code: lga.code, stateCode: lga.stateCode, name: lga.name, kind: lga.kind as "LGA" | "AREA_COUNCIL",
    })),
  })),
};

const supabaseRepository = new SupabaseProviderSearchRepository();
const localRepository = new LocalProviderSearchRepository();

export function getProviderSearchRepository(): ProviderSearchRepository {
  return resolveStorageMode(process.env) === "supabase" ? supabaseRepository : localRepository;
}

export async function getProviderSearchCatalog(): Promise<ProviderMarketplaceCatalog> {
  if (resolveStorageMode(process.env) === "local") return localCatalog;
  const client = getSupabaseClient();
  const [categories, definitions, states, lgas] = await Promise.all([
    client.from("service_categories").select("id,slug,name,description,sort_order").eq("active",true).order("sort_order"),
    client.from("service_definitions").select("id,category_id,slug,name,description").eq("active",true).eq("moderation_status","APPROVED").order("name"),
    client.from("nigeria_states").select("code,name,kind").eq("active",true).order("name"),
    client.from("nigeria_lgas").select("code,state_code,name,kind").eq("active",true).order("name"),
  ]);
  const error = categories.error || definitions.error || states.error || lgas.error;
  if (error) throw new DomainError("Search filters could not be loaded.");
  return {
    categories: (categories.data || []).map(category => ({
      id: category.id, slug: category.slug, name: category.name, description: category.description || undefined,
      definitions: (definitions.data || []).filter(definition => definition.category_id === category.id).map(definition => ({
        id: definition.id, categoryId: definition.category_id, slug: definition.slug, name: definition.name, description: definition.description || undefined,
      })),
    })).filter(category => category.definitions.length > 0),
    states: (states.data || []).map(state => ({
      code: state.code, name: state.name, kind: state.kind === "FCT" ? "FCT" : "STATE",
      lgas: (lgas.data || []).filter(lga => lga.state_code === state.code).map(lga => ({
        code: lga.code, stateCode: lga.state_code, name: lga.name, kind: lga.kind === "AREA_COUNCIL" ? "AREA_COUNCIL" : "LGA",
      })),
    })),
  };
}
