import "server-only";
import { getSupabaseClient } from "@/lib/db/supabase";
import { DomainError } from "@/lib/domain/errors";
export const EVIDENCE_BUCKET = "transaction-evidence";
export { MAX_FILE_SIZE, detectFile } from "./evidence-validation";
export async function validateEvidenceReferences(jobId: string, actorId: string, paths: string[]) {
  if (!paths.length) return;
  if (process.env.TRUSTLINK_STORAGE !== "supabase") throw new DomainError("Private file uploads require Supabase Storage.");
  const { data, error } = await getSupabaseClient().from("evidence_files").select("storage_path").eq("job_id",jobId).eq("uploaded_by",actorId).in("storage_path",paths);
  if (error || new Set(data?.map(f => f.storage_path)).size !== new Set(paths).size) throw new DomainError("One or more attachments are not available to this participant.");
}
