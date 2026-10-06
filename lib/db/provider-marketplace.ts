import "server-only";

import type { Json } from "./database.generated";
import { getSupabaseClient } from "./supabase";
import { resolveStorageMode } from "./config";
import { DomainError } from "../domain/errors";
import type {
  NigeriaLgaOption,
  NigeriaStateOption,
  PricingModel,
  ProviderAvailabilityRule,
  ProviderBlackoutInput,
  ProviderMarketplaceCatalog,
  ProviderMarketplaceRepository,
  ProviderMarketplaceWorkspace,
  ProviderService,
  ProviderServiceArea,
  ProviderServiceInput,
  ProviderServiceStatus,
  PublicMarketplaceService,
  ServiceCategoryOption,
} from "../domain/provider-marketplace";

function databaseFailure(error: { message?: string } | null, fallback: string): never {
  const safeMessages = [
    "Provider service not found or not owned by this provider",
    "Publish at least one complete service first",
    "This provider profile cannot be published",
    "Availability periods cannot overlap",
    "Blackout periods cannot overlap",
    "Manual blackout not found or not owned by this provider",
    "Add a broad origin and travel radius before enabling nearby matching",
  ];
  const safe = safeMessages.find(message => error?.message?.includes(message));
  throw new DomainError(safe || fallback);
}

function money(value: number | string | null): string | undefined {
  return value === null ? undefined : String(value);
}

function clock(value: string): string {
  return value.slice(0, 5);
}

function areaFromJson(value: unknown): ProviderServiceArea | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.remoteService !== "boolean") return null;
  return {
    remoteService: item.remoteService,
    stateCode: typeof item.stateCode === "string" ? item.stateCode : undefined,
    stateName: typeof item.stateName === "string" ? item.stateName : undefined,
    lgaCode: typeof item.lgaCode === "string" ? item.lgaCode : undefined,
    lgaName: typeof item.lgaName === "string" ? item.lgaName : undefined,
    approximateOrigin: typeof item.approximateOrigin === "string" ? item.approximateOrigin : undefined,
    radiusKm: typeof item.radiusKm === "number" ? item.radiusKm : undefined,
  };
}

function availabilityFromJson(value: unknown): ProviderAvailabilityRule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.dayOfWeek !== "number" || typeof item.localStart !== "string" || typeof item.localEnd !== "string") return null;
  return {
    dayOfWeek: item.dayOfWeek,
    localStart: clock(item.localStart),
    localEnd: clock(item.localEnd),
    timezone: "Africa/Lagos",
    effectiveFrom: typeof item.effectiveFrom === "string" ? item.effectiveFrom : undefined,
    effectiveTo: typeof item.effectiveTo === "string" ? item.effectiveTo : undefined,
  };
}

export class SupabaseProviderMarketplaceRepository implements ProviderMarketplaceRepository {
  async getCatalog(): Promise<ProviderMarketplaceCatalog> {
    const client = getSupabaseClient();
    const [categoryResult, definitionResult, stateResult, lgaResult] = await Promise.all([
      client.from("service_categories").select("*").eq("active", true).order("sort_order"),
      client.from("service_definitions").select("*").eq("active", true).eq("moderation_status", "APPROVED").order("name"),
      client.from("nigeria_states").select("*").eq("active", true).order("name"),
      client.from("nigeria_lgas").select("*").eq("active", true).order("name"),
    ]);
    if (categoryResult.error || definitionResult.error || stateResult.error || lgaResult.error) {
      databaseFailure(categoryResult.error || definitionResult.error || stateResult.error || lgaResult.error, "Marketplace reference data could not be loaded.");
    }
    const definitions = definitionResult.data || [];
    const categories: ServiceCategoryOption[] = (categoryResult.data || []).map(category => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description || undefined,
      definitions: definitions.filter(definition => definition.category_id === category.id).map(definition => ({
        id: definition.id,
        categoryId: definition.category_id,
        slug: definition.slug,
        name: definition.name,
        description: definition.description || undefined,
      })),
    })).filter(category => category.definitions.length > 0);
    const lgas: NigeriaLgaOption[] = (lgaResult.data || []).map(lga => ({
      code: lga.code,
      stateCode: lga.state_code,
      name: lga.name,
      kind: lga.kind === "AREA_COUNCIL" ? "AREA_COUNCIL" : "LGA",
    }));
    const states: NigeriaStateOption[] = (stateResult.data || []).map(state => ({
      code: state.code,
      name: state.name,
      kind: state.kind === "FCT" ? "FCT" : "STATE",
      lgas: lgas.filter(lga => lga.stateCode === state.code),
    }));
    return { categories, states };
  }

  async getWorkspace(providerId: string): Promise<ProviderMarketplaceWorkspace | null> {
    const client = getSupabaseClient();
    const providerResult = await client.from("provider_profiles").select("*").eq("user_id", providerId).maybeSingle();
    if (providerResult.error) databaseFailure(providerResult.error, "Provider marketplace settings could not be loaded.");
    if (!providerResult.data) return null;
    const serviceResult = await client.from("provider_services").select("*").eq("provider_id", providerId).order("created_at");
    if (serviceResult.error) databaseFailure(serviceResult.error, "Provider services could not be loaded.");
    const services = serviceResult.data || [];
    const ids = services.map(service => service.id);
    const [catalog, durationResult, areaResult, availabilityResult, blackoutResult] = await Promise.all([
      this.getCatalog(),
      ids.length ? client.from("provider_service_durations").select("*").in("provider_service_id", ids).order("sort_order") : Promise.resolve({ data: [], error: null }),
      ids.length ? client.from("provider_service_areas").select("*").in("provider_service_id", ids) : Promise.resolve({ data: [], error: null }),
      client.from("provider_availability_rules").select("*").eq("provider_id", providerId).order("day_of_week"),
      client.from("provider_unavailability").select("*").eq("provider_id", providerId).order("starts_at"),
    ]);
    if (durationResult.error || areaResult.error || availabilityResult.error || blackoutResult.error) {
      databaseFailure(durationResult.error || areaResult.error || availabilityResult.error || blackoutResult.error, "Provider marketplace settings could not be loaded.");
    }
    const definitions = catalog.categories.flatMap(category => category.definitions.map(definition => ({ category, definition })));
    const states = new Map(catalog.states.map(state => [state.code, state]));
    const mappedServices: ProviderService[] = services.map(service => {
      const match = definitions.find(candidate => candidate.definition.id === service.service_definition_id);
      const serviceAreas: ProviderServiceArea[] = (areaResult.data || []).filter(area => area.provider_service_id === service.id).map(area => {
        const state = area.state_code ? states.get(area.state_code) : undefined;
        const lga = state?.lgas.find(candidate => candidate.code === area.lga_code);
        return {
          id: area.id,
          remoteService: area.remote_service,
          stateCode: area.state_code || undefined,
          stateName: state?.name,
          lgaCode: area.lga_code || undefined,
          lgaName: lga?.name,
          approximateOrigin: area.approximate_origin || undefined,
          radiusKm: area.radius_km === null ? undefined : Number(area.radius_km),
          nearbyEnabled: area.origin_latitude !== null && area.origin_longitude !== null,
        };
      });
      return {
        id: service.id,
        providerId: service.provider_id,
        categoryId: match?.category.id || "",
        categoryName: match?.category.name || "Unavailable category",
        serviceDefinitionId: service.service_definition_id,
        serviceDefinitionName: match?.definition.name || "Unavailable service",
        publicTitle: service.public_title,
        description: service.description,
        pricingModel: service.pricing_model as PricingModel,
        priceMin: money(service.price_min),
        priceMax: money(service.price_max),
        currency: "NGN",
        supportsRemote: service.supports_remote,
        supportsOnsite: service.supports_onsite,
        status: service.status as ProviderServiceStatus,
        publishedAt: service.published_at || undefined,
        durationMinutes: (durationResult.data || []).filter(duration => duration.provider_service_id === service.id).map(duration => duration.duration_minutes),
        areas: serviceAreas,
        createdAt: service.created_at,
        updatedAt: service.updated_at,
      };
    });
    return {
      providerId,
      marketplaceStatus: providerResult.data.marketplace_status as ProviderMarketplaceWorkspace["marketplaceStatus"],
      moderationStatus: providerResult.data.moderation_status as ProviderMarketplaceWorkspace["moderationStatus"],
      publishedAt: providerResult.data.published_at || undefined,
      services: mappedServices,
      availability: (availabilityResult.data || []).map(rule => ({
        id: rule.id,
        providerServiceId: rule.provider_service_id || undefined,
        dayOfWeek: rule.day_of_week,
        localStart: clock(rule.local_start),
        localEnd: clock(rule.local_end),
        timezone: "Africa/Lagos",
        effectiveFrom: rule.effective_from || undefined,
        effectiveTo: rule.effective_to || undefined,
      })),
      blackouts: (blackoutResult.data || []).map(blackout => ({
        id: blackout.id,
        startsAt: blackout.starts_at,
        endsAt: blackout.ends_at,
        reason: blackout.reason || undefined,
        source: blackout.source as "MANUAL" | "CONFIRMED_TRANSACTION" | "SYSTEM",
        createdAt: blackout.created_at,
      })),
    };
  }

  async saveService(providerId: string, serviceId: string | undefined, input: ProviderServiceInput) {
    const { error } = await getSupabaseClient().rpc("tl_upsert_provider_service", {
      p_provider_id: providerId,
      p_service_id: serviceId || null,
      p_input: input as unknown as Json,
    });
    if (error) databaseFailure(error, "The service could not be saved.");
  }

  async archiveService(providerId: string, serviceId: string) {
    const { error } = await getSupabaseClient().rpc("tl_archive_provider_service", { p_provider_id: providerId, p_service_id: serviceId });
    if (error) databaseFailure(error, "The service could not be archived.");
  }

  async replaceAvailability(providerId: string, rules: ProviderAvailabilityRule[]) {
    const { error } = await getSupabaseClient().rpc("tl_replace_provider_availability", { p_provider_id: providerId, p_rules: rules as unknown as Json });
    if (error) databaseFailure(error, "Availability could not be saved.");
  }

  async addBlackout(providerId: string, input: ProviderBlackoutInput) {
    const { error } = await getSupabaseClient().rpc("tl_add_provider_blackout", { p_provider_id: providerId, p_input: input as unknown as Json });
    if (error) databaseFailure(error, "The blackout period could not be saved.");
  }

  async deleteBlackout(providerId: string, blackoutId: string) {
    const { error } = await getSupabaseClient().rpc("tl_delete_provider_blackout", { p_provider_id: providerId, p_blackout_id: blackoutId });
    if (error) databaseFailure(error, "The blackout period could not be removed.");
  }

  async setPublication(providerId: string, publish: boolean) {
    const { error } = await getSupabaseClient().rpc("tl_set_provider_publication", { p_provider_id: providerId, p_publish: publish });
    if (error) databaseFailure(error, "Publication status could not be changed.");
  }

  async setNearbyOrigin(providerId: string, serviceId: string, origin: { latitude: number; longitude: number } | null) {
    const { error } = await getSupabaseClient().rpc("tl_set_provider_service_origin", {
      p_provider_id: providerId,
      p_service_id: serviceId,
      p_latitude: origin?.latitude ?? null,
      p_longitude: origin?.longitude ?? null,
    });
    if (error) databaseFailure(error, "Nearby matching could not be changed.");
  }

  async listPublicServices(): Promise<PublicMarketplaceService[]> {
    const { data, error } = await getSupabaseClient().from("public_marketplace_services").select("*");
    if (error) databaseFailure(error, "Published services could not be loaded.");
    return (data || []).flatMap(row => {
      if (!row.service_id || !row.provider_username || !row.provider_name || !row.provider_headline || !row.service_slug || !row.service_name ||
          !row.category_slug || !row.category_name || !row.public_title || !row.description || !row.pricing_model || !row.currency ||
          row.supports_remote === null || row.supports_onsite === null) return [];
      const durations = Array.isArray(row.durations) ? row.durations.flatMap(value => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return [];
        const item = value as Record<string, unknown>;
        return typeof item.durationMinutes === "number" ? [{ durationMinutes: item.durationMinutes, label: typeof item.label === "string" ? item.label : undefined }] : [];
      }) : [];
      return [{
        serviceId: row.service_id,
        providerUsername: row.provider_username,
        providerName: row.provider_name,
        providerHeadline: row.provider_headline,
        providerBio: row.provider_bio || undefined,
        serviceSlug: row.service_slug,
        serviceName: row.service_name,
        categorySlug: row.category_slug,
        categoryName: row.category_name,
        publicTitle: row.public_title,
        description: row.description,
        pricingModel: row.pricing_model as PricingModel,
        priceMin: money(row.price_min),
        priceMax: money(row.price_max),
        currency: "NGN" as const,
        supportsRemote: row.supports_remote,
        supportsOnsite: row.supports_onsite,
        durations,
        serviceAreas: Array.isArray(row.service_areas) ? row.service_areas.map(areaFromJson).filter((area): area is ProviderServiceArea => Boolean(area)) : [],
        availability: Array.isArray(row.availability) ? row.availability.map(availabilityFromJson).filter((rule): rule is ProviderAvailabilityRule => Boolean(rule)) : [],
      }];
    });
  }
}

const supabaseProviderMarketplaceStore = new SupabaseProviderMarketplaceRepository();

export const providerMarketplaceDb: ProviderMarketplaceRepository = new Proxy({} as ProviderMarketplaceRepository, {
  get(_target, key) {
    if (resolveStorageMode(process.env) !== "supabase") {
      throw new Error("Provider marketplace configuration requires Supabase storage.");
    }
    const method = supabaseProviderMarketplaceStore[key as keyof ProviderMarketplaceRepository];
    return typeof method === "function" ? method.bind(supabaseProviderMarketplaceStore) : method;
  },
});
