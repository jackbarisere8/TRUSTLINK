export const pricingModels = ["FIXED","STARTING_AT","HOURLY","DAILY","QUOTE_REQUIRED"] as const;
export type PricingModel = typeof pricingModels[number];
export type ProviderServiceStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface ServiceDefinitionOption {
  id: string;
  categoryId: string;
  slug: string;
  name: string;
  description?: string;
}

export interface ServiceCategoryOption {
  id: string;
  slug: string;
  name: string;
  description?: string;
  definitions: ServiceDefinitionOption[];
}

export interface NigeriaLgaOption { code: string; stateCode: string; name: string; kind: "LGA" | "AREA_COUNCIL" }
export interface NigeriaStateOption { code: string; name: string; kind: "STATE" | "FCT"; lgas: NigeriaLgaOption[] }
export interface ProviderMarketplaceCatalog { categories: ServiceCategoryOption[]; states: NigeriaStateOption[] }

export interface ProviderServiceArea {
  id?: string;
  remoteService: boolean;
  stateCode?: string;
  stateName?: string;
  lgaCode?: string;
  lgaName?: string;
  approximateOrigin?: string;
  radiusKm?: number;
  /** Protected workspace hint only. Never included in a public marketplace projection. */
  nearbyEnabled?: boolean;
}

export interface ProviderService {
  id: string;
  providerId: string;
  categoryId: string;
  categoryName: string;
  serviceDefinitionId: string;
  serviceDefinitionName: string;
  publicTitle: string;
  description: string;
  pricingModel: PricingModel;
  priceMin?: string;
  priceMax?: string;
  currency: "NGN";
  supportsRemote: boolean;
  supportsOnsite: boolean;
  status: ProviderServiceStatus;
  publishedAt?: string;
  durationMinutes: number[];
  areas: ProviderServiceArea[];
  createdAt: string;
  updatedAt: string;
}

export interface ProviderAvailabilityRule {
  id?: string;
  providerServiceId?: string;
  dayOfWeek: number;
  localStart: string;
  localEnd: string;
  timezone: "Africa/Lagos";
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface ProviderBlackout {
  id: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
  source: "MANUAL" | "CONFIRMED_TRANSACTION" | "SYSTEM";
  createdAt: string;
}

export interface ProviderMarketplaceWorkspace {
  providerId: string;
  marketplaceStatus: "NOT_LISTED" | "DRAFT" | "PUBLISHED" | "SUSPENDED";
  moderationStatus: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  publishedAt?: string;
  services: ProviderService[];
  availability: ProviderAvailabilityRule[];
  blackouts: ProviderBlackout[];
}

export interface ProviderServiceInput {
  categoryId: string;
  serviceDefinitionId: string;
  publicTitle: string;
  description: string;
  pricingModel: PricingModel;
  priceMin?: string;
  priceMax?: string;
  supportsRemote: boolean;
  supportsOnsite: boolean;
  status: "DRAFT" | "PUBLISHED";
  durationMinutes: number[];
  areas: Array<{
    remoteService: boolean;
    stateCode?: string;
    lgaCode?: string;
    approximateOrigin?: string;
    radiusKm?: number;
  }>;
}

export interface ProviderBlackoutInput { startsAt: string; endsAt: string; reason?: string }

export interface PublicMarketplaceService {
  serviceId: string;
  providerUsername: string;
  providerName: string;
  providerHeadline: string;
  providerBio?: string;
  serviceSlug: string;
  serviceName: string;
  categorySlug: string;
  categoryName: string;
  publicTitle: string;
  description: string;
  pricingModel: PricingModel;
  priceMin?: string;
  priceMax?: string;
  currency: "NGN";
  supportsRemote: boolean;
  supportsOnsite: boolean;
  durations: Array<{durationMinutes:number;label?:string}>;
  serviceAreas: ProviderServiceArea[];
  availability: ProviderAvailabilityRule[];
}

export interface ProviderMarketplaceRepository {
  getCatalog(): Promise<ProviderMarketplaceCatalog>;
  getWorkspace(providerId: string): Promise<ProviderMarketplaceWorkspace | null>;
  saveService(providerId: string, serviceId: string | undefined, input: ProviderServiceInput): Promise<void>;
  archiveService(providerId: string, serviceId: string): Promise<void>;
  replaceAvailability(providerId: string, rules: ProviderAvailabilityRule[]): Promise<void>;
  addBlackout(providerId: string, input: ProviderBlackoutInput): Promise<void>;
  deleteBlackout(providerId: string, blackoutId: string): Promise<void>;
  setPublication(providerId: string, publish: boolean): Promise<void>;
  setNearbyOrigin(providerId: string, serviceId: string, origin: { latitude: number; longitude: number } | null): Promise<void>;
  listPublicServices(): Promise<PublicMarketplaceService[]>;
}
