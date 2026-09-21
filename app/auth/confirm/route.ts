import { NextResponse, type NextRequest } from "next/server";
import { authClient, authConfigured } from "@/lib/auth/client";
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (authConfigured() && tokenHash && type === "email") {
    const { error } = await (await authClient()).auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (!error) return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.redirect(new URL("/login?confirmation=failed", request.url));
}
