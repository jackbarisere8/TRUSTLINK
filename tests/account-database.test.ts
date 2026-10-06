import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migrationsBeforePhase4 = [
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
  "20261005000000_marketplace_booking_foundation.sql",
  "20261005000001_nigeria_admin_seed.sql",
];

async function foundation() {
  const pg = new PGlite();
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb);
    CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS 'SELECT gen_random_uuid()';`);
  for (const filename of migrationsBeforePhase4) {
    let sql = await readFile(`supabase/migrations/${filename}`, "utf8");
    if (filename === "20260917000000_v0_core.sql") sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', "");
    await pg.exec(sql);
  }
  return pg;
}

test("Phase 4 preserves existing providers and makes new accounts customer-only until opt-in", async () => {
  const pg = await foundation();
  try {
    const legacyId = "11111111-1111-4111-8111-111111111111";
    const customerId = "55555555-5555-4555-8555-555555555555";
    await pg.query("INSERT INTO auth.users VALUES ($1,$2)", [legacyId,{display_name:"Legacy Provider"}]);
    const before = (await pg.query<{username:string;provider_id:string}>(`SELECT profile.username,provider.user_id AS provider_id
      FROM public.profiles profile JOIN public.provider_profiles provider ON provider.user_id=profile.user_id
      WHERE profile.user_id=$1`,[legacyId])).rows[0];

    await pg.exec(await readFile("supabase/migrations/20261005000002_unified_accounts.sql", "utf8"));
    const after = (await pg.query<{username:string;provider_id:string}>(`SELECT profile.username,provider.user_id AS provider_id
      FROM public.profiles profile JOIN public.provider_profiles provider ON provider.user_id=profile.user_id
      WHERE profile.user_id=$1`,[legacyId])).rows[0];
    assert.deepEqual(after,before);

    await pg.query("INSERT INTO auth.users VALUES ($1,$2)", [customerId,{display_name:"New Customer"}]);
    assert.deepEqual((await pg.query<{username:string}>("SELECT username FROM public.profiles WHERE user_id=$1",[customerId])).rows,[{username:"member-55555555555545558555555555555555"}]);
    assert.equal((await pg.query<{count:number}>("SELECT count(*)::integer AS count FROM public.provider_profiles WHERE user_id=$1",[customerId])).rows[0].count,0);

    const input={headline:"Website developer",serviceArea:"Ikeja, Lagos"};
    const enabled=(await pg.query<{profile:{marketplace_status:string;moderation_status:string;headline:string} }>("SELECT public.tl_enable_provider($1,$2::jsonb) AS profile",[customerId,JSON.stringify(input)])).rows[0].profile;
    assert.deepEqual({marketplace:enabled.marketplace_status,moderation:enabled.moderation_status,headline:enabled.headline},{marketplace:"DRAFT",moderation:"DRAFT",headline:"Website developer"});
    await pg.query("SELECT public.tl_enable_provider($1,$2::jsonb)",[customerId,JSON.stringify({headline:"Must not overwrite",serviceArea:"Elsewhere"})]);
    assert.deepEqual((await pg.query<{headline:string;service_area:string}>("SELECT headline,service_area FROM public.provider_profiles WHERE user_id=$1",[customerId])).rows,[{headline:"Website developer",service_area:"Ikeja, Lagos"}]);

    await pg.query("SELECT public.tl_update_account_profile($1,$2::jsonb)",[customerId,JSON.stringify({displayName:"Customer Updated",country:"Nigeria",state:"Lagos",city:"Ikeja"})]);
    assert.deepEqual((await pg.query<{display_name:string;country:string;state:string;city:string}>("SELECT display_name,country,state,city FROM public.profiles WHERE user_id=$1",[customerId])).rows,[{display_name:"Customer Updated",country:"Nigeria",state:"Lagos",city:"Ikeja"}]);

    for (const role of ["anon","authenticated"]) {
      assert.equal((await pg.query<{allowed:boolean}>("SELECT has_function_privilege($1,'public.tl_enable_provider(uuid,jsonb)','EXECUTE') AS allowed",[role])).rows[0].allowed,false);
      assert.equal((await pg.query<{allowed:boolean}>("SELECT has_function_privilege($1,'public.tl_update_account_profile(uuid,jsonb)','EXECUTE') AS allowed",[role])).rows[0].allowed,false);
    }
    assert.equal((await pg.query<{allowed:boolean}>("SELECT has_function_privilege('service_role','public.tl_enable_provider(uuid,jsonb)','EXECUTE') AS allowed")).rows[0].allowed,true);
  } finally {
    await pg.close();
  }
});
