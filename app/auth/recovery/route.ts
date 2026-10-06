import { NextResponse, type NextRequest } from "next/server";
import { getAuthProvider } from "@/lib/auth/provider";
import { recoveryCallbackSchema } from "@/lib/auth/schemas";
import { consumeRateLimit, rateLimitPolicies } from "@/lib/security/rate-limit";
import { clientAddressFromHeaders } from "@/lib/security/request";
import { recordOperationalEvent } from "@/lib/observability";
import { resolveApplicationOrigin } from "@/lib/auth/redirects";

function applicationRedirect(path: string, request: NextRequest) {
  let origin = request.nextUrl.origin;
  try {
    origin = resolveApplicationOrigin();
  } catch {
    // Unconfigured local installs cannot initiate recovery; preserve a same-origin
    // failure redirect for malformed links opened directly during development.
  }
  return new URL(path, origin);
}

export async function GET(request: NextRequest) {
  const limit = consumeRateLimit("auth.recovery.callback.address", clientAddressFromHeaders(request.headers), rateLimitPolicies.authCallbackAddress);
  if (!limit.allowed) {
    recordOperationalEvent({ event: "auth.recovery.complete", outcome: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds });
    return NextResponse.redirect(applicationRedirect("/login?recovery=limited", request));
  }

  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const parsed = recoveryCallbackSchema.safeParse(code ? { code } : { tokenHash, type });
  if (parsed.success) {
    const result = await getAuthProvider().establishPasswordRecovery(parsed.data);
    if (result.ok) {
      recordOperationalEvent({ event: "auth.recovery.complete", outcome: "success" });
      return NextResponse.redirect(applicationRedirect("/reset-password", request));
    }
  }

  recordOperationalEvent({ event: "auth.recovery.complete", outcome: "rejected" });
  return NextResponse.redirect(applicationRedirect("/login?recovery=failed", request));
}
