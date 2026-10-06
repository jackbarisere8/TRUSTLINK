import "server-only";
import type { MarketplaceRepository } from "../domain/bookings";
import { resolveStorageMode } from "./config";
import { MemoryMarketplaceRepository } from "./marketplace-memory";
import { supabaseMarketplaceStore } from "./marketplace-supabase";

const localMarketplaceStore = new MemoryMarketplaceRepository();

export const marketplaceDb: MarketplaceRepository = new Proxy({} as MarketplaceRepository,{get(_target,key){
  const repository=resolveStorageMode(process.env)==="supabase" ? supabaseMarketplaceStore : localMarketplaceStore;
  const method=repository[key as keyof MarketplaceRepository];
  return typeof method === "function" ? method.bind(repository) : method;
}});
