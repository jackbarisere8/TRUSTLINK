import { evidenceContentTypes, readBoundedBody, hasSameOrigin, isEvidencePathForJob, safeEvidenceFilename } from "@/lib/evidence-validation";
import { randomUUID } from "node:crypto";
import { authorizedJob } from "@/lib/jobs";
import { getSupabaseClient } from "@/lib/db/supabase";
import { EVIDENCE_BUCKET, MAX_FILE_SIZE, detectFile, type EvidencePurpose } from "@/lib/storage";
import { DomainError, publicError } from "@/lib/domain/errors";
import { isActionAvailable } from "@/lib/domain/transactions/policy";
import { consumeRateLimits, rateLimitPolicies } from "@/lib/security/rate-limit";
import { clientAddressFromHeaders } from "@/lib/security/request";
import { recordOperationalEvent } from "@/lib/observability";

function evidenceMutationLimit(request: Request, jobId: string) {
  return consumeRateLimits([
    { scope: "evidence.mutation.address", identifier: clientAddressFromHeaders(request.headers), policy: rateLimitPolicies.evidenceAddress },
    { scope: "evidence.mutation.record", identifier: jobId, policy: rateLimitPolicies.evidenceRecord },
  ]);
}

function evidenceRateLimitResponse(retryAfterSeconds: number) {
  return Response.json({ error: "Too many evidence changes. Wait before trying again." }, {
    status: 429,
    headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfterSeconds) },
  });
}

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    if (!hasSameOrigin(request)) {
      recordOperationalEvent({ event: "evidence.upload", outcome: "rejected" });
      return Response.json({ error: "Invalid request origin." }, { status: 403 });
    }
    const limit = evidenceMutationLimit(request, jobId);
    if (!limit.allowed) {
      recordOperationalEvent({ event: "evidence.upload", outcome: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds });
      return evidenceRateLimitResponse(limit.retryAfterSeconds);
    }
    if (Number(request.headers.get("content-length")) > MAX_FILE_SIZE + 100000) return Response.json({ error: "The file exceeds 10 MB." }, { status: 413 });
    const { aggregate, actor } = await authorizedJob(jobId);
    if (actor.type === "CLIENT_PARTICIPANT" && !aggregate.job.clientTokenUsed) throw new DomainError("Only active participants can upload evidence.");
    if (process.env.TRUSTLINK_STORAGE !== "supabase") throw new DomainError("File uploads are not configured on this installation.");
    let body: Buffer;
    try { body = await readBoundedBody(request); } catch { return Response.json({ error: "The upload exceeds the request size limit." }, { status: 413 }); }
    const form = await new Response(new Uint8Array(body), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const requestedPurpose = form.get("purpose");
    if (requestedPurpose !== "DELIVERY" && requestedPurpose !== "DISPUTE") throw new DomainError("Evidence uploads are not available for this action.");
    const purpose: EvidencePurpose = requestedPurpose;
    const action = purpose === "DELIVERY" ? "DELIVER" : "DISPUTE";
    if (!isActionAvailable(aggregate.job.status,actor.type,action)) throw new DomainError("Evidence uploads are not available for this action.");
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > MAX_FILE_SIZE) throw new DomainError("Choose a file between 1 byte and 10 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = evidenceContentTypes.find(candidate => candidate === file.type);
    if (!contentType || !detectFile(bytes, contentType)) throw new DomainError("Upload a PDF, PNG, JPEG, WebP, or plain text file with matching contents.");
    const path = jobId + "/" + randomUUID();
    const filename = safeEvidenceFilename(file.name,contentType);
    const client = getSupabaseClient();
    const { error } = await client.storage.from(EVIDENCE_BUCKET).upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error("Upload failed");
    const { error: insertError } = await client.from("evidence_files").insert({ job_id: jobId, storage_path: path, filename, content_type: contentType, size_bytes: file.size, uploaded_by: actor.id, purpose, attachment_status: "PENDING" });
    if (insertError) { await client.storage.from(EVIDENCE_BUCKET).remove([path]); throw new Error("Evidence record failed"); }
    recordOperationalEvent({ event: "evidence.upload", outcome: "success", operation: purpose });
    return Response.json({ path, name: filename }, { headers: { "Cache-Control": "no-store" } });
  } catch(error) {
    recordOperationalEvent({ event: "evidence.upload", outcome: error instanceof DomainError ? "rejected" : "failure" });
    return Response.json({ error: publicError(error) }, { status: 400 });
  }
}
export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    const { aggregate, actor } = await authorizedJob(jobId);
    const path = new URL(request.url).searchParams.get("path") || "";
    if (!isEvidencePathForJob(jobId,path)) throw new DomainError("Attachment not found.");
    const client = getSupabaseClient();
    const { data, error } = await client.from("evidence_files").select("filename,uploaded_by,attachment_status").eq("job_id", jobId).eq("storage_path",path).maybeSingle();
    const attached = aggregate.deliveries.some(d => d.fileUrls.includes(path)) || aggregate.disputes.some(d => d.evidenceUrls.includes(path));
    const available = attached
      ? data?.attachment_status === "ATTACHED"
      : data?.attachment_status === "PENDING" && data.uploaded_by === actor.id;
    if (error || !data || !available) throw new DomainError("Attachment not found.");
    const { data: signed, error: signingError } = await client.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 60, { download: data.filename });
    if (signingError || !signed) throw new Error("Signing failed");
    return new Response(null, { status: 303, headers: { Location: signed.signedUrl, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch { return Response.json({ error: "Attachment not available." }, { status: 403 }); }
}
export async function DELETE(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    if (!hasSameOrigin(request)) {
      recordOperationalEvent({ event: "evidence.delete", outcome: "rejected" });
      return Response.json({ error: "Invalid request origin." }, { status: 403 });
    }
    const limit = evidenceMutationLimit(request, jobId);
    if (!limit.allowed) {
      recordOperationalEvent({ event: "evidence.delete", outcome: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds });
      return evidenceRateLimitResponse(limit.retryAfterSeconds);
    }
    const { aggregate, actor } = await authorizedJob(jobId);
    const path = new URL(request.url).searchParams.get("path") || "";
    if (!isEvidencePathForJob(jobId,path)) throw new DomainError("Attachment not found.");
    if (aggregate.deliveries.some(delivery => delivery.fileUrls.includes(path)) || aggregate.disputes.some(dispute => dispute.evidenceUrls.includes(path))) {
      throw new DomainError("Submitted evidence cannot be removed.");
    }
    if (process.env.TRUSTLINK_STORAGE !== "supabase") throw new DomainError("File deletion is not configured on this installation.");
    const client = getSupabaseClient();
    const { data, error } = await client.from("evidence_files").delete()
      .eq("job_id",jobId).eq("storage_path",path).eq("uploaded_by",actor.id).eq("attachment_status","PENDING").select("storage_path");
    if (error || data?.length !== 1) throw new DomainError("Attachment not found.");
    const { error: storageError } = await client.storage.from(EVIDENCE_BUCKET).remove([path]);
    recordOperationalEvent({ event: "evidence.delete", outcome: storageError ? "failure" : "success" });
    return Response.json({ removed: true, cleanupPending: Boolean(storageError) }, {
      status: storageError ? 202 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch(error) {
    recordOperationalEvent({ event: "evidence.delete", outcome: error instanceof DomainError ? "rejected" : "failure" });
    return Response.json({ error: publicError(error) }, { status: 403 });
  }
}
