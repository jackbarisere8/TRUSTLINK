import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveAuthConfiguration } from "@/lib/auth/config";
import brandIcon from "@/app/icon.png";
export async function proxy(request: NextRequest) {
  // A legacy public/icon.png still exists. Route Next's automatic icon URL to
  // the selected app icon so the browser tab and shared LogoMark agree.
  if (request.nextUrl.pathname === "/icon.png") {
    return NextResponse.rewrite(new URL(brandIcon.src, request.url));
  }
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
export const config = { matcher: ["/icon.png", "/account/:path*", "/dashboard/:path*", "/admin/:path*", "/disputes/:path*", "/j/:path*", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/:path*", "/api/evidence/:path*"] };
