import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { jobStatuses } from "../lib/db/types";
import { transactionRules } from "../lib/domain/transactions/policy";
import { eventLabels } from "../lib/trust-events";
import { createAggregate, type Actor } from "../lib/domain/jobs";
import { acceptAggregate, transition } from "./support/lifecycle";

const applicationTables = [
 "deliveries","disputes","evidence_files","job_participants","job_terms","jobs",
 "payments","profiles","provider_profiles","reviews","revisions","trust_events",
] as const;
const publicJobColumns = [
 "public_id","status","source_channel","provider_location","created_at","first_viewed_at",
 "service","service_category","scope","deliverables","price","currency","deadline",
 "revisions_included","revisions_used","cancellation_terms","provider_username",
 "provider_name","provider_avatar","provider_role","provider_verification_status",
] as const;

async function databaseBeforePhase6() {
 const pg=new PGlite();
 await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb);
 CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS 'SELECT gen_random_uuid()';`);
 const base=(await readFile("supabase/migrations/20260917000000_v0_core.sql","utf8")).replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',"");
 await pg.exec(base);
 await pg.exec(await readFile("supabase/migrations/20260920000000_integrity.sql","utf8"));
 await pg.exec(await readFile("supabase/migrations/20260920000001_final_audit.sql","utf8"));
 return pg;
}

test("Phase 6 migration backfills accepted guest participants without changing aggregate reads",async()=>{
 const pg=await databaseBeforePhase6();
 try {
  const provider:Actor={id:"11111111-1111-4111-8111-111111111111",type:"PROVIDER",name:"Ada"};
  await pg.query("INSERT INTO auth.users VALUES ($1,$2)",[provider.id,{display_name:"Ada"}]);
  const {aggregate,token}=createAggregate({providerId:provider.id,title:"Legacy design",category:"Design",scope:"Logo",deliverables:["Logo"],price:"5000",deadline:"2099-01-01",revisions:1,cancellationTerms:"Discuss first",sourceChannel:"Direct",repeatUse:"FIRST"});
  const commit=(a:unknown,v:number|null)=>pg.query("SELECT public.tl_commit_job($1::jsonb,$2::integer)",[JSON.stringify(a),v]);
  await commit(aggregate,null);
  await commit(acceptAggregate(aggregate,token,{name:"Legacy client",email:"legacy@example.com"}),0);
  await pg.exec(await readFile("supabase/migrations/20260921000000_database_model.sql","utf8"));
  const participants=await pg.query<{role:string;display_name:string|null;email:string|null;detail_status:string;token_used:boolean}>("SELECT role,display_name,email,detail_status,token_used FROM public.job_participants WHERE job_id=$1 ORDER BY role",[aggregate.job.id]);
  assert.deepEqual(participants.rows,[
   {role:"CLIENT_PARTICIPANT",display_name:"Legacy client",email:"legacy@example.com",detail_status:"SELF_PROVIDED",token_used:true},
   {role:"PROVIDER",display_name:"Ada",email:null,detail_status:"SELF_PROVIDED",token_used:false},
  ]);
  const read=await pg.query<{record:{job:{client_email:string;client_action_token_hash:string};terms:{price:string}}}>("SELECT public.tl_read_job($1,true) AS record",[aggregate.job.publicId]);
  assert.equal(read.rows[0].record.job.client_email,"legacy@example.com");
  assert.equal(read.rows[0].record.job.client_action_token_hash,aggregate.job.clientActionTokenHash);
  assert.equal(read.rows[0].record.terms.price,"5000.00");
 } finally { await pg.close(); }
});

test("PostgreSQL migrations: relational integrity, atomic commits and Phase 7 least privilege",async()=>{
 const pg=await databaseBeforePhase6();
 try {
  await pg.exec(await readFile("supabase/migrations/20260921000000_database_model.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260921000001_database_security.sql","utf8"));
 const constraintValues = async (name: string) => {
  const result = await pg.query<{definition:string}>("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname=$1", [name]);
  return [...result.rows[0].definition.matchAll(/'([^']+)'::text/g)].map(match => match[1]).sort();
 };
 assert.deepEqual(await constraintValues("jobs_status_check"), [...jobStatuses].sort());
 const events = [...new Set(["JOB_CREATED", "JOB_SENT", "JOB_VIEWED", ...Object.values(transactionRules).map(rule => rule.event)])].sort();
 assert.deepEqual(await constraintValues("supported_trust_event"), events);
 assert.deepEqual(Object.keys(eventLabels).sort(), events);
 const jobColumns=await pg.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs'");
 for(const legacyColumn of ["client_id","client_name","client_email","client_phone","client_action_token_hash","client_token_expires_at","client_token_used"]){
  assert.equal(jobColumns.rows.some(column=>column.column_name===legacyColumn),false);
 }
 const termTypes=await pg.query<{column_name:string;data_type:string}>("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='job_terms' AND column_name IN ('price','deadline') ORDER BY column_name");
 assert.deepEqual(termTypes.rows,[{column_name:"deadline",data_type:"date"},{column_name:"price",data_type:"numeric"}]);
  const providerColumns=await pg.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='provider_profiles'");
  for(const derivedColumn of ["completed_jobs_count","average_rating","on_time_rate"]){assert.equal(providerColumns.rows.some(column=>column.column_name===derivedColumn),false);}
  const protectedTables=await pg.query<{relname:string;relrowsecurity:boolean;relforcerowsecurity:boolean}>("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace WHERE namespace.nspname='public' AND relation.relkind='r' ORDER BY relname");
  assert.deepEqual(protectedTables.rows.map(table=>table.relname),applicationTables);
  for(const table of protectedTables.rows){
   assert.equal(table.relrowsecurity,true,`${table.relname} must enable RLS`);
   assert.equal(table.relforcerowsecurity,true,`${table.relname} must force RLS`);
  }
  assert.equal((await pg.query<{count:number}>("SELECT count(*)::integer AS count FROM pg_policies WHERE schemaname='public'")).rows[0].count,0);
  const viewSecurity=await pg.query<{reloptions:string[]|null}>("SELECT reloptions FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace WHERE namespace.nspname='public' AND relation.relname='public_job_records'");
  assert.ok(viewSecurity.rows[0].reloptions?.includes("security_invoker=true"));
  const projectionColumns=await pg.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='public_job_records' ORDER BY ordinal_position");
  assert.deepEqual(projectionColumns.rows.map(column=>column.column_name),publicJobColumns);
 const provider:Actor={id:"11111111-1111-4111-8111-111111111111",type:"PROVIDER",name:"Ada"};
 await pg.query("INSERT INTO auth.users VALUES ($1,$2)",[provider.id,{display_name:"Ada",role:"ADMIN"}]);
 const profiles=await pg.query<{display_name:string}>("SELECT display_name FROM public.profiles WHERE user_id=$1",[provider.id]);
 assert.equal(profiles.rows[0].display_name,"Ada");
 const {aggregate,token}=createAggregate({providerId:provider.id,title:"Design",category:"Design",scope:"Logo",deliverables:["Logo"],price:"5000",deadline:"2099-01-01",revisions:1,cancellationTerms:"Discuss first",sourceChannel:"Direct",repeatUse:"FIRST"});
 const commit=(a:unknown,v:number|null)=>pg.query("SELECT public.tl_commit_job($1::jsonb,$2::integer)",[JSON.stringify(a),v]);
 await commit(aggregate,null);
 const initialParticipants=await pg.query<{role:string;detail_status:string;display_name:string|null;token_used:boolean}>("SELECT role,detail_status,display_name,token_used FROM public.job_participants WHERE job_id=$1 ORDER BY role",[aggregate.job.id]);
 assert.deepEqual(initialParticipants.rows,[
  {role:"CLIENT_PARTICIPANT",detail_status:"UNKNOWN",display_name:null,token_used:false},
  {role:"PROVIDER",detail_status:"SELF_PROVIDED",display_name:"Ada",token_used:false},
 ]);
 const read=await pg.query<{record:{job:{client_action_token_hash:string;client_token_used:boolean};terms:{price:string};events:unknown[]}}>("SELECT public.tl_read_job($1,true) AS record",[aggregate.job.publicId]);
 assert.equal(read.rows[0].record.events.length,2);
 assert.ok(read.rows[0].record.job.client_action_token_hash);
 assert.equal(read.rows[0].record.job.client_token_used,false);
 assert.equal(read.rows[0].record.terms.price,"5000.00");
 const accepted=acceptAggregate(aggregate,token,{name:"Client",email:"client@example.com"});
 await commit(accepted,0);
 const clientParticipant=await pg.query<{display_name:string;email:string;detail_status:string;token_used:boolean}>("SELECT display_name,email,detail_status,token_used FROM public.job_participants WHERE job_id=$1 AND role='CLIENT_PARTICIPANT'",[aggregate.job.id]);
 assert.deepEqual(clientParticipant.rows[0],{display_name:"Client",email:"client@example.com",detail_status:"SELF_PROVIDED",token_used:true});
 await assert.rejects(pg.query("UPDATE public.job_participants SET detail_status='VERIFIED_IDENTITY' WHERE job_id=$1 AND role='CLIENT_PARTICIPANT'",[aggregate.job.id]),/check constraint/);
 await assert.rejects(pg.query("DELETE FROM public.job_participants WHERE job_id=$1 AND role='CLIENT_PARTICIPANT'",[aggregate.job.id]),/requires one matching provider and one client participant/);
 const acceptanceEvent=await pg.query<{metadata:{participant_detail_status:string}}>("SELECT metadata FROM public.trust_events WHERE event_type='JOB_ACCEPTED'");
 assert.equal(acceptanceEvent.rows[0].metadata.participant_detail_status,"SELF_PROVIDED");
 await assert.rejects(pg.query("INSERT INTO public.trust_events(id,job_id,actor_id,actor_type,event_type,metadata) VALUES ('99999999-9999-4999-8999-999999999999',$1,'client:test','CLIENT_PARTICIPANT','JOB_ACCEPTED','{}')",[aggregate.job.id]),/check constraint/);
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
  for(const role of ["anon","authenticated"]){
   for(const table of applicationTables){
    for(const privilege of ["SELECT","INSERT","UPDATE","DELETE","TRUNCATE"]){
     const result=await pg.query<{allowed:boolean}>("SELECT has_table_privilege($1,$2,$3) AS allowed",[role,`public.${table}`,privilege]);
     assert.equal(result.rows[0].allowed,false,`${role} must not have ${privilege} on ${table}`);
    }
   }
   assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege($1,'public.public_job_records','SELECT') AS allowed",[role])).rows[0].allowed,false);
  }
  for(const table of applicationTables){
   assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege('service_role',$1,'SELECT') AS allowed",[`public.${table}`])).rows[0].allowed,true,`service_role must read ${table}`);
   for(const privilege of ["INSERT","UPDATE","DELETE","TRUNCATE"]){
    const expected=table==="evidence_files" && (privilege==="INSERT" || privilege==="DELETE");
    assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege('service_role',$1,$2) AS allowed",[`public.${table}`,privilege])).rows[0].allowed,expected,`unexpected service_role ${privilege} on ${table}`);
   }
  }
  assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege('service_role','public.public_job_records','SELECT') AS allowed")).rows[0].allowed,true);
  const functionPrivileges=await pg.query<{name:string;anon:boolean;authenticated:boolean;service:boolean}>(`SELECT procedure.proname AS name,
    has_function_privilege('anon',procedure.oid,'EXECUTE') AS anon,
    has_function_privilege('authenticated',procedure.oid,'EXECUTE') AS authenticated,
    has_function_privilege('service_role',procedure.oid,'EXECUTE') AS service
    FROM pg_proc procedure JOIN pg_namespace namespace ON namespace.oid=procedure.pronamespace
    WHERE namespace.nspname='public' AND (procedure.proname LIKE 'tl_%' OR procedure.proname IN ('uuid_generate_v4','prevent_trust_event_mutation'))
    ORDER BY procedure.proname`);
  const serverFunctions=new Set(["tl_commit_job","tl_read_job","tl_update_profile","uuid_generate_v4"]);
  for(const routine of functionPrivileges.rows){
   assert.equal(routine.anon,false,`${routine.name} must deny anon execution`);
   assert.equal(routine.authenticated,false,`${routine.name} must deny authenticated execution`);
   assert.equal(routine.service,serverFunctions.has(routine.name),`unexpected service_role execution on ${routine.name}`);
  }
  await pg.exec("CREATE TABLE public.phase7_default_table_probe(id integer); CREATE FUNCTION public.phase7_default_function_probe() RETURNS integer LANGUAGE sql AS 'SELECT 1';");
  for(const role of ["anon","authenticated","service_role"]){
   assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege($1,'public.phase7_default_table_probe','SELECT') AS allowed",[role])).rows[0].allowed,false,`${role} inherited a future table grant`);
   assert.equal((await pg.query<{allowed:boolean}>("SELECT has_function_privilege($1,'public.phase7_default_function_probe()','EXECUTE') AS allowed",[role])).rows[0].allowed,false,`${role} inherited a future function grant`);
  }
  await pg.exec("DROP FUNCTION public.phase7_default_function_probe(); DROP TABLE public.phase7_default_table_probe;");
  await pg.exec("SET ROLE service_role");
  assert.equal((await pg.query<{public_id:string}>("SELECT public_id FROM public.public_job_records WHERE public_id=$1",[aggregate.job.publicId])).rows[0].public_id,aggregate.job.publicId);
  assert.ok((await pg.query<{record:unknown}>("SELECT public.tl_read_job($1,true) AS record",[aggregate.job.publicId])).rows[0].record);
  await assert.rejects(pg.query("UPDATE public.trust_events SET metadata='{}'"),/permission denied/);
  await assert.rejects(pg.query("UPDATE public.profiles SET display_name='Unauthorized'"),/permission denied/);
  const evidence=await pg.query<{id:string}>("INSERT INTO public.evidence_files(job_id,storage_path,filename,content_type,size_bytes,uploaded_by) VALUES ($1,'phase7/private','evidence.txt','text/plain',1,$2) RETURNING id",[aggregate.job.id,provider.id]);
  assert.match(evidence.rows[0].id,/^[0-9a-f-]{36}$/);
  await pg.query("DELETE FROM public.evidence_files WHERE id=$1",[evidence.rows[0].id]);
  await pg.exec("RESET ROLE");
 // A broad pre-existing policy must not expose the private evidence bucket.
 await pg.exec("GRANT USAGE ON SCHEMA storage TO anon, authenticated; GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated; CREATE POLICY broad_legacy_storage ON storage.objects FOR ALL USING (true) WITH CHECK (true); INSERT INTO storage.objects(bucket_id) VALUES ('transaction-evidence'),('unrelated-public-bucket');");
 for(const role of ["anon","authenticated"]) {
  await pg.exec("SET ROLE "+role);
   if(role==="authenticated") await pg.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:provider.id,app_metadata:{role:"ADMIN"}})]);
   for(const table of applicationTables){
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
