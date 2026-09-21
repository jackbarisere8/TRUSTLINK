import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { jobStatuses } from "../lib/db/types";
import { transactionRules } from "../lib/domain/transactions/policy";
import { eventLabels } from "../lib/trust-events";
import { createAggregate, type Actor } from "../lib/domain/jobs";
import { acceptAggregate, transition } from "./support/lifecycle";
test("PostgreSQL migration: RLS, atomic commits, conflicts, append-only history and Auth profiles",async()=>{
 const pg=new PGlite();
 try {
 await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb);
 CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS 'SELECT gen_random_uuid()';`);
 const base=(await readFile("supabase/migrations/20260917000000_v0_core.sql","utf8")).replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',"");
 await pg.exec(base);
 await pg.exec(await readFile("supabase/migrations/20260920000000_integrity.sql","utf8"));
 await pg.exec(await readFile("supabase/migrations/20260920000001_final_audit.sql","utf8"));
 const constraintValues = async (name: string) => {
  const result = await pg.query<{definition:string}>("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname=$1", [name]);
  return [...result.rows[0].definition.matchAll(/'([^']+)'::text/g)].map(match => match[1]).sort();
 };
 assert.deepEqual(await constraintValues("jobs_status_check"), [...jobStatuses].sort());
 const events = [...new Set(["JOB_CREATED", "JOB_SENT", "JOB_VIEWED", ...Object.values(transactionRules).map(rule => rule.event)])].sort();
 assert.deepEqual(await constraintValues("supported_trust_event"), events);
 assert.deepEqual(Object.keys(eventLabels).sort(), events);
 const provider:Actor={id:"11111111-1111-4111-8111-111111111111",type:"PROVIDER",name:"Ada"};
 await pg.query("INSERT INTO auth.users VALUES ($1,$2)",[provider.id,{display_name:"Ada",role:"ADMIN"}]);
 const profiles=await pg.query<{display_name:string}>("SELECT display_name FROM public.profiles WHERE user_id=$1",[provider.id]);
 assert.equal(profiles.rows[0].display_name,"Ada");
 const {aggregate,token}=createAggregate({providerId:provider.id,title:"Design",category:"Design",scope:"Logo",deliverables:["Logo"],price:"5000",deadline:"2099-01-01",revisions:1,cancellationTerms:"Discuss first",sourceChannel:"Direct",repeatUse:"FIRST"});
 const commit=(a:unknown,v:number|null)=>pg.query("SELECT public.tl_commit_job($1::jsonb,$2::integer)",[JSON.stringify(a),v]);
 await commit(aggregate,null);
 const read=await pg.query<{record:{job:{client_action_token_hash:string};events:unknown[]}}>("SELECT public.tl_read_job($1,true) AS record",[aggregate.job.publicId]);
 assert.equal(read.rows[0].record.events.length,2);
 assert.ok(read.rows[0].record.job.client_action_token_hash);
 const accepted=acceptAggregate(aggregate,token,{name:"Client",email:"client@example.com"});
 await commit(accepted,0);
 await assert.rejects(commit(accepted,0),/Concurrent change/);
 let paid=transition(accepted,provider,{type:"PAYMENT"}).aggregate;
 // An invalid event must roll back the payment AND the state update.
 paid.events.push({...paid.events.at(-1)!,id:"22222222-2222-4222-8222-222222222222",actorType:"BAD" as "SYSTEM"});
 await assert.rejects(commit(paid,1),/check constraint/);
 const after=await pg.query<{status:string;version:number}>("SELECT status,version FROM public.jobs WHERE id=$1",[aggregate.job.id]);
 assert.equal(after.rows[0].status,"ACCEPTED");assert.equal(after.rows[0].version,1);
 assert.equal((await pg.query("SELECT * FROM public.payments")).rows.length,0);
 paid=transition(accepted,provider,{type:"PAYMENT"},{id:"44444444-4444-4444-8444-444444444444",expectedVersion:1}).aggregate;await commit(paid,1);
 const event=await pg.query<{actor_id:string;occurred_at:Date;metadata:{request_id:string}}>("SELECT actor_id,occurred_at,metadata FROM public.trust_events WHERE event_type='PAYMENT_RECORDED'");
 assert.equal(event.rows[0].actor_id,provider.id);
 assert.equal(event.rows[0].metadata.request_id,"44444444-4444-4444-8444-444444444444");
 assert.ok(Number.isFinite(new Date(event.rows[0].occurred_at).getTime()));
 const eventless=structuredClone(paid);eventless.job.version++;eventless.job.status="IN_PROGRESS";
 await assert.rejects(commit(eventless,2),/requires a new event/);
 assert.equal((await pg.query<{status:string}>("SELECT status FROM public.jobs WHERE id=$1",[aggregate.job.id])).rows[0].status,"PAYMENT_RECORDED");
 await assert.rejects(pg.query("UPDATE public.trust_events SET event_type='FAKE'"),/immutable/);
 await assert.rejects(pg.query("DELETE FROM public.trust_events"),/immutable/);
 await assert.rejects(pg.query("TRUNCATE public.trust_events"),/immutable/);
 await pg.exec("SET ROLE service_role");
 await assert.rejects(pg.query("UPDATE public.trust_events SET metadata='{}'"),/permission denied/);
 await pg.exec("RESET ROLE");
 // A broad pre-existing policy must not expose the private evidence bucket.
 await pg.exec("GRANT USAGE ON SCHEMA storage TO anon, authenticated; GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated; CREATE POLICY broad_legacy_storage ON storage.objects FOR ALL USING (true) WITH CHECK (true); INSERT INTO storage.objects(bucket_id) VALUES ('transaction-evidence'),('unrelated-public-bucket');");
 for(const role of ["anon","authenticated"]) {
  await pg.exec("SET ROLE "+role);
  for(const table of ["profiles","provider_profiles","jobs","job_terms","payments","deliveries","revisions","disputes","reviews","trust_events","evidence_files"]){
    await assert.rejects(pg.query("SELECT * FROM public."+table),/permission denied/);
  }
  await assert.rejects(pg.query("SELECT * FROM public.public_job_records"),/permission denied/);
  await assert.rejects(pg.query("SELECT public.tl_read_job($1,true)",[aggregate.job.publicId]),/permission denied/);
  await assert.rejects(commit(paid,2),/permission denied/);
  const storage=await pg.query<{bucket_id:string}>("SELECT bucket_id FROM storage.objects");
  assert.deepEqual(storage.rows.map(r=>r.bucket_id),["unrelated-public-bucket"]);
  await assert.rejects(pg.query("INSERT INTO storage.objects(bucket_id) VALUES ('transaction-evidence')"),/row-level security/);
  await pg.exec("RESET ROLE");
 }
 assert.equal((await pg.query<{public:boolean}>("SELECT public FROM storage.buckets")).rows[0].public,false);
 const rls=await pg.query<{relrowsecurity:boolean}>("SELECT relrowsecurity FROM pg_class WHERE relname='evidence_files'");
 assert.equal(rls.rows[0].relrowsecurity,true);
 } finally { await pg.close(); }
});
