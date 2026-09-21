import "server-only";
import type { Repository } from "./repository";
import { localStore } from "./local-store";
import { supabaseStore } from "./supabase";
import { resolveStorageMode } from "./config";
export * from "./types";
export function storageMode() {
  return resolveStorageMode(process.env);
}
export const db: Repository = new Proxy({} as Repository, { get(_target, key) {
  const repository = storageMode() === "supabase" ? supabaseStore : localStore;
  const method = repository[key as keyof Repository];
  return typeof method === "function" ? method.bind(repository) : method;
} });
