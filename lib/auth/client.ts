import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { resolveAuthConfiguration } from "./config";
export { authConfigured } from "./config";
export async function authClient() {
  const configuration = resolveAuthConfiguration(process.env);
  if (configuration.mode !== "supabase") throw new Error("Supabase authentication is not configured.");
  const jar = await cookies();
  return createServerClient(configuration.url, configuration.anonKey, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    cookies: { getAll: () => jar.getAll(), setAll(values) {
      try { values.forEach(({ name,value,options }) => jar.set(name,value,options)); }
      catch { /* Server Components cannot set cookies; proxy refreshes the session. */ }
    } },
  });
}
