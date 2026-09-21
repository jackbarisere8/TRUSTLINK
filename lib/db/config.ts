/** Pure configuration boundary; no adapter may silently select another backend. */
export function resolveStorageMode(env: Record<string, string | undefined>): "local" | "supabase" {
  const mode = env.TRUSTLINK_STORAGE;
  if (mode !== "local" && mode !== "supabase") {
    throw new Error("Set TRUSTLINK_STORAGE explicitly to local (development only) or supabase.");
  }
  if (env.NODE_ENV === "production" && mode !== "supabase") {
    throw new Error("Production requires TRUSTLINK_STORAGE=supabase.");
  }
  if (mode === "supabase" && (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("Supabase configuration is incomplete.");
  }
  return mode;
}
