import { readdir } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type Check = { name: string; passed: boolean };

const expectedMigrations = [
  "20260917000000_v0_core.sql",
  "20260920000000_integrity.sql",
  "20260920000001_final_audit.sql",
  "20260921000000_database_model.sql",
  "20260921000001_database_security.sql",
  "20260921000002_trust_event_ledger.sql",
  "20260921000003_payment_semantics.sql",
  "20260922000000_real_job_creation.sql",
  "20260922000001_public_transaction_projection.sql",
  "20260922000002_secure_client_capabilities.sql",
  "20260922000003_client_acceptance.sql",
  "20260924000000_work_delivery_revisions.sql",
  "20260924000001_evidence_storage.sql",
  "20260926000000_disputes.sql",
  "20260926000001_reviews_trust_profile.sql",
  "20260927000000_transaction_notifications.sql",
  "20260927000001_validation_analytics.sql",
] as const;

const expectedEvidenceMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
].sort();

const checks: Check[] = [];
const record = (name: string, passed: boolean) => checks.push({ name, passed });
const configured = (name: string) => {
  const value = process.env[name]?.trim();
  record(`${name} is configured`, Boolean(value));
  return value;
};
const validHttpsUrl = (value: string | undefined) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
};

record("TRUSTLINK_STORAGE selects Supabase", process.env.TRUSTLINK_STORAGE === "supabase");
const supabaseUrl = configured("NEXT_PUBLIC_SUPABASE_URL");
const publicKey = configured("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serverKey = configured("SUPABASE_SERVICE_ROLE_KEY");
const appUrl = configured("NEXT_PUBLIC_APP_URL");
record("Supabase URL is hosted HTTPS", validHttpsUrl(supabaseUrl));
record("Application URL is hosted HTTPS", validHttpsUrl(appUrl));
record("Public and server credentials are distinct", Boolean(publicKey && serverKey && publicKey !== serverKey));

const migrationDirectory = path.join(process.cwd(), "supabase", "migrations");
const migrationNames = (await readdir(migrationDirectory))
  .filter(name => name.endsWith(".sql"))
  .sort();
record(
  "Local migration sequence is the reviewed 17-file manifest",
  JSON.stringify(migrationNames) === JSON.stringify(expectedMigrations),
);

const canCheckRemote = Boolean(
  process.env.TRUSTLINK_STORAGE === "supabase" &&
  validHttpsUrl(supabaseUrl) &&
  validHttpsUrl(appUrl) &&
  publicKey &&
  serverKey &&
  publicKey !== serverKey,
);

if (canCheckRemote) {
  try {
    const clientOptions = {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    };
    const publicClient = createClient(supabaseUrl!, publicKey!, clientOptions);
    const serverClient = createClient(supabaseUrl!, serverKey!, clientOptions);
    const opaqueMissingId = "0".repeat(24);

    const [
      publicJobs,
      publicProjection,
      publicReadRpc,
      serverJobs,
      serverProjection,
      serverReadRpc,
      evidenceBucket,
    ] = await Promise.all([
      publicClient.from("jobs").select("id").limit(1),
      publicClient.from("public_job_records").select("public_id").limit(1),
      publicClient.rpc("tl_read_job", { p_public_id: opaqueMissingId, p_include_private: false }),
      serverClient.from("jobs").select("id").limit(1),
      serverClient.from("public_job_records").select("public_id").limit(1),
      serverClient.rpc("tl_read_job", { p_public_id: opaqueMissingId, p_include_private: false }),
      serverClient.storage.getBucket("transaction-evidence"),
    ]);

    record("Public key cannot read application tables", Boolean(publicJobs.error));
    record("Public key cannot read server-only views", Boolean(publicProjection.error));
    record("Public key cannot execute private aggregate RPCs", Boolean(publicReadRpc.error));
    record("Server key can read application tables", !serverJobs.error);
    record("Server key can read server-only views", !serverProjection.error);
    record("Server key can execute the private aggregate reader", !serverReadRpc.error);
    record("Private transaction-evidence bucket exists", !evidenceBucket.error && evidenceBucket.data?.public === false);
    record(
      "Evidence bucket enforces the 10 MiB limit",
      Number(evidenceBucket.data?.file_size_limit) === 10 * 1024 * 1024,
    );
    record(
      "Evidence bucket uses the reviewed MIME allowlist",
      JSON.stringify([...(evidenceBucket.data?.allowed_mime_types || [])].sort()) === JSON.stringify(expectedEvidenceMimeTypes),
    );
  } catch {
    record("Hosted Supabase endpoints are reachable", false);
  }
} else {
  record("Hosted read-only checks can run", false);
}

for (const check of checks) console.log(`${check.passed ? "PASS" : "FAIL"}: ${check.name}`);
const failures = checks.filter(check => !check.passed).length;
console.log(`${checks.length - failures}/${checks.length} hosted preflight checks passed.`);
if (failures) process.exitCode = 1;
