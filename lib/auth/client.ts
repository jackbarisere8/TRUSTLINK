import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export function authConfigured() { return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.TRUSTLINK_STORAGE === "supabase"); }
export async function authClient() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    cookies: { getAll: () => jar.getAll(), setAll(values) {
      try { values.forEach(({ name,value,options }) => jar.set(name,value,options)); }
      catch { /* Server Components cannot set cookies; proxy refreshes the session. */ }
    } },
  });
}
