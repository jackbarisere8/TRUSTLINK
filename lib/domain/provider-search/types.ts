import type { ProviderAvailabilityRule, PricingModel } from "../provider-marketplace";

export const providerSearchSorts = ["best","nearest","completed","rating"] as const;
export type ProviderSearchSort = typeof providerSearchSorts[number];
export const nearbyRadii = [5,10,25,50] as const;
export type NearbyRadius = typeof nearbyRadii[number];

export interface ProviderSearchFilters {
  q?: string;
  category?: string;
  state?: string;
  lga?: string;
  remote: boolean;
  date?: string;
  nearby: boolean;
  radiusKm: NearbyRadius;
  sort: ProviderSearchSort;
  page: number;
  pageSize: number;
}

export interface PrivateNearbyInput {
  latitude: number;
  longitude: number;
  radiusKm: NearbyRadius;
}

export interface PublicProviderServiceArea {
  remoteService: boolean;
  stateCode?: string;
  stateName?: string;
  lgaCode?: string;
  lgaName?: string;
  approximateOrigin?: string;
  radiusKm?: number;
}

export interface ProviderSearchResult {
  serviceId: string;
  providerUsername: string;
  providerName: string;
  providerHeadline: string;
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
  durations: Array<{ durationMinutes: number; label?: string }>;
  serviceAreas: PublicProviderServiceArea[];
  availability: ProviderAvailabilityRule[];
  completedTransactions: number;
  averageRating?: number;
  reviewCount: number;
  distanceKm?: number;
  availableOnRequestedDate: boolean;
}

export interface ProviderSearchPage {
  items: ProviderSearchResult[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ProviderSearchRepository {
  search(filters: ProviderSearchFilters, nearby?: PrivateNearbyInput): Promise<ProviderSearchPage>;
}

export interface SearchCandidate extends ProviderSearchResult {
  privateOrigins?: Array<{ latitude: number; longitude: number; radiusKm?: number }>;
  privateSearchAliases?: string[];
}
