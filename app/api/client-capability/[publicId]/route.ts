import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DomainError, publicError } from "@/lib/domain/errors";
import { publicJobIdPattern } from "@/lib/domain/jobs/public-id";
import { validCapability } from "@/lib/domain/participants";
import { hasSameOrigin, readBoundedBody } from "@/lib/evidence-validation";
import { capabilityCookie, capabilityCookiePath, evidenceCapabilityCookie, evidenceCapabilityCookiePath } from "@/lib/jobs";

export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }) {
  try {
    if (!hasSameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
    if (Number(request.headers.get("content-length")) > 1024) return Response.json({ error: "Invalid participant link." }, { status: 413 });
    const { publicId } = await context.params;
    let body: unknown;
    try { body = JSON.parse((await readBoundedBody(request, 1024)).toString("utf8")); }
    catch { return Response.json({ error: "Invalid participant link." }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
    const token = body && typeof body === "object" && "token" in body ? (body as { token?: unknown }).token : undefined;
    if (!publicJobIdPattern.test(publicId) || typeof token !== "string") {
      throw new DomainError("This participant link is invalid or expired. Ask the provider for a new link.");
    }
    const aggregate = await db.getAggregate(publicId, true);
    if (!aggregate || !validCapability(aggregate.job, token)) {
      throw new DomainError("This participant link is invalid or expired. Ask the provider for a new link.");
    }

    const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
    const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", expires: new Date(aggregate.job.clientTokenExpiresAt!) };
    response.cookies.set(capabilityCookie(publicId), token, { ...options, path: capabilityCookiePath(publicId) });
    response.cookies.set(evidenceCapabilityCookie(aggregate.job.id), token, { ...options, path: evidenceCapabilityCookiePath(aggregate.job.id) });
    return response;
  } catch (error) {
    return Response.json({ error: publicError(error) }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
