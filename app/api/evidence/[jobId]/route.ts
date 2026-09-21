import { readBoundedBody, hasSameOrigin } from "@/lib/evidence-validation";
import { randomUUID } from "node:crypto";
import { authorizedJob } from "@/lib/jobs";
import { getSupabaseClient } from "@/lib/db/supabase";
import { EVIDENCE_BUCKET, MAX_FILE_SIZE, detectFile } from "@/lib/storage";
import { DomainError, publicError } from "@/lib/domain/errors";
export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    if (!hasSameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
    if (Number(request.headers.get("content-length")) > MAX_FILE_SIZE + 100000) return Response.json({ error: "The file exceeds 10 MB." }, { status: 413 });
    const { jobId } = await context.params;
    const { aggregate, actor } = await authorizedJob(jobId);
    if (actor.type === "ADMIN" || (actor.type === "CLIENT_PARTICIPANT" && !aggregate.job.clientTokenUsed)) throw new DomainError("Only active participants can upload evidence.");
    if (["CANCELLED","COMPLETED"].includes(aggregate.job.status)) throw new DomainError("This record is closed for uploads.");
    if (process.env.TRUSTLINK_STORAGE !== "supabase") throw new DomainError("File uploads are not configured on this installation.");
    let body: Buffer;
    try { body = await readBoundedBody(request); } catch { return Response.json({ error: "The upload exceeds the request size limit." }, { status: 413 }); }
    const form = await new Response(new Uint8Array(body), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > MAX_FILE_SIZE) throw new DomainError("Choose a file between 1 byte and 10 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!detectFile(bytes, file.type)) throw new DomainError("Upload a PDF, PNG, JPEG, WebP, or plain text file with matching contents.");
    const path = jobId + "/" + randomUUID();
    const client = getSupabaseClient();
    const { error } = await client.storage.from(EVIDENCE_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
    if (error) throw new Error("Upload failed");
    const { error: insertError } = await client.from("evidence_files").insert({ job_id: jobId, storage_path: path, filename: file.name.slice(0,200), content_type: file.type, size_bytes: file.size, uploaded_by: actor.id });
    if (insertError) { await client.storage.from(EVIDENCE_BUCKET).remove([path]); throw new Error("Evidence record failed"); }
    return Response.json({ path, name: file.name }, { headers: { "Cache-Control": "no-store" } });
  } catch(error) { return Response.json({ error: publicError(error) }, { status: 400 }); }
}
export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    const { aggregate, actor } = await authorizedJob(jobId);
    const path = new URL(request.url).searchParams.get("path") || "";
    const client = getSupabaseClient();
    const { data, error } = await client.from("evidence_files").select("filename,uploaded_by").eq("job_id", jobId).eq("storage_path",path).maybeSingle();
    const attached = aggregate.deliveries.some(d => d.fileUrls.includes(path)) || aggregate.disputes.some(d => d.evidenceUrls.includes(path));
    if (error || !data || (!attached && data.uploaded_by !== actor.id)) throw new DomainError("Attachment not found.");
    const { data: signed, error: signingError } = await client.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 60, { download: data.filename });
    if (signingError || !signed) throw new Error("Signing failed");
    return new Response(null, { status: 303, headers: { Location: signed.signedUrl, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch { return Response.json({ error: "Attachment not available." }, { status: 403 }); }
}
