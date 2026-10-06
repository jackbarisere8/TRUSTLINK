import { NextResponse, type NextRequest } from "next/server";
import { getAuthProvider } from "@/lib/auth/provider";
import { confirmationSchema } from "@/lib/auth/schemas";
import { consumeRateLimit, rateLimitPolicies } from "@/lib/security/rate-limit";
import { clientAddressFromHeaders } from "@/lib/security/request";
import { recordOperationalEvent } from "@/lib/observability";
import { resolveApplicationOrigin } from "@/lib/auth/redirects";
import { resolveUserSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

function applicationRedirect(path: string, request: NextRequest) {
  let origin = request.nextUrl.origin;
  try {
    origin = resolveApplicationOrigin();
  } catch {
    // Confirmation is unavailable without configured authentication; keep
    // malformed direct visits same-origin in local development.
  }
  return new URL(path, origin);
}

export async function GET(request: NextRequest) {
  const limit = consumeRateLimit("auth.confirm.address", clientAddressFromHeaders(request.headers), rateLimitPolicies.authCallbackAddress);
  if (!limit.allowed) {
    recordOperationalEvent({ event: "auth.confirm", outcome: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds });
    return NextResponse.redirect(applicationRedirect("/login?confirmation=limited", request));
  }
  const parsed = confirmationSchema.safeParse({ tokenHash: request.nextUrl.searchParams.get("token_hash"), type: request.nextUrl.searchParams.get("type") });
  const provider = getAuthProvider();
  if (parsed.success && await provider.verifyEmail(parsed.data.tokenHash)) {
    const user = await resolveUserSession(provider, db);
    if (user) {
      recordOperationalEvent({ event: "auth.confirm", outcome: "success" });
      const path = user.role === "ADMIN" ? "/admin" : user.role === "PROVIDER" ? "/dashboard" : "/account";
      return NextResponse.redirect(applicationRedirect(path, request));
    }
  }
  recordOperationalEvent({ event: "auth.confirm", outcome: "rejected" });
  return NextResponse.redirect(applicationRedirect("/login?confirmation=failed", request));
}
