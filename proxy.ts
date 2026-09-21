import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveAuthConfiguration } from "@/lib/auth/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const configuration = resolveAuthConfiguration(process.env);
  if (configuration.mode === "supabase") {
    const client = createServerClient(configuration.url, configuration.anonKey, {
      cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
      cookies: { getAll: () => request.cookies.getAll(), setAll(values) {
        values.forEach(({ name,value }) => request.cookies.set(name,value));
        response = NextResponse.next({ request });
        values.forEach(({ name,value,options }) => response.cookies.set(name,value,options));
      } },
    });
    await client.auth.getUser();
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
export const config = { matcher: ["/dashboard/:path*", "/admin/:path*", "/disputes/:path*", "/j/:path*", "/login", "/signup", "/auth/:path*", "/api/evidence/:path*"] };
