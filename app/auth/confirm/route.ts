import { NextResponse, type NextRequest } from "next/server";
import { getAuthProvider } from "@/lib/auth/provider";
import { confirmationSchema } from "@/lib/auth/schemas";
export async function GET(request: NextRequest) {
  const parsed = confirmationSchema.safeParse({ tokenHash: request.nextUrl.searchParams.get("token_hash"), type: request.nextUrl.searchParams.get("type") });
  if (parsed.success && await getAuthProvider().verifyEmail(parsed.data.tokenHash)) return NextResponse.redirect(new URL("/dashboard", request.url));
  return NextResponse.redirect(new URL("/login?confirmation=failed", request.url));
}
