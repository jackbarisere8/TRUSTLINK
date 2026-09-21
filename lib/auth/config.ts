export type AuthConfiguration =
  | { mode: "unconfigured" }
  | { mode: "supabase"; url: string; anonKey: string };

/** Auth follows the selected storage backend; local mode never invents a user session. */
export function resolveAuthConfiguration(env: Record<string, string | undefined>): AuthConfiguration {
  if (env.TRUSTLINK_STORAGE !== "supabase") return { mode: "unconfigured" };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase authentication configuration is incomplete.");
  let endpoint: URL;
  try { endpoint = new URL(url); }
  catch { throw new Error("Supabase authentication URL is invalid."); }
  const loopback = endpoint.hostname === "127.0.0.1" || endpoint.hostname === "localhost" || endpoint.hostname === "[::1]";
  if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && loopback)) {
    throw new Error("Supabase authentication requires HTTPS except on loopback test services.");
  }
  return { mode: "supabase", url: endpoint.toString().replace(/\/$/, ""), anonKey };
}

export function authConfigured(env: Record<string, string | undefined> = process.env) {
  return resolveAuthConfiguration(env).mode === "supabase";
}
