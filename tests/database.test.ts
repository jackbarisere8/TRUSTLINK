import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { jobStatuses } from "../lib/db/types";
import { transactionRules } from "../lib/domain/transactions/policy";
import { eventLabels, trustEventTypes } from "../lib/trust-events";
import { createAggregate, validCapability, type Actor } from "../lib/domain/jobs";
import type { JobAggregate } from "../lib/db/repository";
import { acceptAggregate, transition } from "./support/lifecycle";

const applicationTables = [
 "deliveries","disputes","evidence_files","job_participants","job_terms","jobs",
 "notification_intents","payments","profiles","provider_profiles","reviews","revisions","trust_events",
] as const;
const publicJobColumns = [
 "public_id","status","provider_location","service","scope","deliverables","price",
 "currency","deadline","revisions_included","revisions_used","cancellation_terms",
 "provider_username","provider_name","provider_headline",
] as const;
const publicEventColumns = ["public_id","id","event_type","occurred_at","event_sequence"] as const;

function camel<T>(value: unknown): T {
 if (Array.isArray(value)) return value.map(item=>camel(item)) as T;
 if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key,item])=>[key.replace(/_([a-z])/g,(_,letter:string)=>letter.toUpperCase()),camel(item)])) as T;
 return value as T;
}

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

test("Phase 6 through 21 migrations backfill participants, ledger order, notifications and validation integrity",async()=>{
 const pg=await databaseBeforePhase6();
 try {
  const provider:Actor={id:"11111111-1111-4111-8111-111111111111",type:"PROVIDER",name:"Ada"};
  await pg.query("INSERT INTO auth.users VALUES ($1,$2)",[provider.id,{display_name:"Ada"}]);
  const {aggregate,token}=createAggregate({providerId:provider.id,title:"Legacy design",category:"Design",scope:"Logo",deliverables:["Logo"],price:"5000",deadline:"2099-01-01",revisions:1,cancellationTerms:"Discuss first",sourceChannel:"Direct",repeatUse:"FIRST"});
  const commit=(a:unknown,v:number|null)=>pg.query("SELECT public.tl_commit_job($1::jsonb,$2::integer)",[JSON.stringify(a),v]);
  await commit(aggregate,null);
  const accepted=acceptAggregate(aggregate,token,{name:"Legacy client",email:"legacy@example.com"});
  await commit(accepted,0);
  await commit(transition(accepted,provider,{type:"PAYMENT"}).aggregate,1);
  const {aggregate:reviewAggregate,token:reviewToken}=createAggregate({providerId:provider.id,title:"Legacy reviewed work",category:"Design",scope:"Identity",deliverables:["Identity"],price:"8000",deadline:"2099-02-01",revisions:0,cancellationTerms:"Discuss first",sourceChannel:"Direct",repeatUse:"UNPROMPTED"});
  await commit(reviewAggregate,null);
  let historicalReview=acceptAggregate(reviewAggregate,reviewToken,{name:"Historical client",email:"historical@example.com"});await commit(historicalReview,0);
  historicalReview=transition(historicalReview,provider,{type:"PAYMENT"}).aggregate;await commit(historicalReview,1);
  historicalReview=transition(historicalReview,provider,{type:"START"}).aggregate;await commit(historicalReview,2);
  historicalReview=transition(historicalReview,provider,{type:"DELIVER",description:"Legacy delivery",files:[]}).aggregate;await commit(historicalReview,3);
  const historicalClient:Actor={id:"client:"+reviewAggregate.job.id,type:"CLIENT_PARTICIPANT",name:"Historical client"};
  historicalReview=transition(historicalReview,historicalClient,{type:"APPROVE"}).aggregate;await commit(historicalReview,4);
  historicalReview=transition(historicalReview,provider,{type:"COMPLETE"}).aggregate;await commit(historicalReview,5);
  historicalReview=transition(historicalReview,historicalClient,{type:"REVIEW",rating:5,comment:"A sound historical record"}).aggregate;
  delete historicalReview.events.at(-1)!.metadata.reviewId;
  await commit(historicalReview,6);
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
  await pg.exec(await readFile("supabase/migrations/20260921000001_database_security.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260921000002_trust_event_ledger.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260921000003_payment_semantics.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260922000000_real_job_creation.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260922000001_public_transaction_projection.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260922000002_secure_client_capabilities.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260922000003_client_acceptance.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260924000000_work_delivery_revisions.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260924000001_evidence_storage.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260926000000_disputes.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260926000001_reviews_trust_profile.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260927000000_transaction_notifications.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260927000001_validation_analytics.sql","utf8"));
  const ledger=await pg.query<{event_type:string;event_sequence:number}>("SELECT event_type,event_sequence FROM public.trust_events WHERE job_id=$1 ORDER BY event_sequence",[aggregate.job.id]);
  assert.deepEqual(ledger.rows,[
   {event_type:"JOB_CREATED",event_sequence:1},
   {event_type:"JOB_SENT",event_sequence:2},
   {event_type:"JOB_ACCEPTED",event_sequence:3},
   {event_type:"PAYMENT_RECORDED",event_sequence:4},
  ]);
  const payment=await pg.query<{amount:string;currency:string;recorded_by:string;verification_status:string}>("SELECT amount::text,currency,recorded_by,verification_status FROM public.payments WHERE job_id=$1",[aggregate.job.id]);
  assert.deepEqual(payment.rows,[{amount:"5000.00",currency:"NGN",recorded_by:"PROVIDER",verification_status:"NOT_VERIFIED"}]);
  const backfilledReviewEvent=await pg.query<{review_id:string;rating:string}>("SELECT metadata->>'review_id' AS review_id,metadata->>'rating' AS rating FROM public.trust_events WHERE job_id=$1 AND event_type='CLIENT_REVIEWED'",[reviewAggregate.job.id]);
  assert.deepEqual(backfilledReviewEvent.rows,[{review_id:historicalReview.reviews[0].id,rating:"5"}]);
  const backfilledNotifications=await pg.query<{notification_kind:string;recipient_role:string}>("SELECT intent.notification_kind,intent.recipient_role FROM public.notification_intents intent JOIN public.trust_events event ON event.id=intent.event_id WHERE intent.job_id=$1 ORDER BY event.event_sequence,intent.recipient_role",[aggregate.job.id]);
  assert.deepEqual(backfilledNotifications.rows,[
   {notification_kind:"TRANSACTION_ACCEPTED",recipient_role:"PROVIDER"},
   {notification_kind:"PAYMENT_RECORDED",recipient_role:"CLIENT_PARTICIPANT"},
  ]);
  const persisted=camel<JobAggregate>((await pg.query<{record:JobAggregate}>("SELECT public.tl_read_job($1,true) AS record",[aggregate.job.publicId])).rows[0].record);
  const revoked=transition(persisted,provider,{type:"REVOKE_INVITE"}).aggregate;
  await commit(revoked,persisted.job.version);
  assert.equal(validCapability(revoked.job,token),false);
  const revokedParticipant=await pg.query<{action_token_hash:string|null;token_expires_at:string|null}>("SELECT action_token_hash,token_expires_at FROM public.job_participants WHERE job_id=$1 AND role='CLIENT_PARTICIPANT'",[aggregate.job.id]);
  assert.deepEqual(revokedParticipant.rows,[{action_token_hash:null,token_expires_at:null}]);
  const unrelatedCapabilityChange=transition(revoked,provider,{type:"START"}).aggregate;
  unrelatedCapabilityChange.job.clientActionTokenHash="a".repeat(64);
  unrelatedCapabilityChange.job.clientTokenExpiresAt=new Date(Date.now()+86400000).toISOString();
  await assert.rejects(commit(unrelatedCapabilityChange,revoked.job.version),/capability replacement requires its ledger event/);
  const duplicateRevocation=transition(revoked,provider,{type:"ROTATE_INVITE"}).aggregate;
  delete duplicateRevocation.job.clientActionTokenHash;delete duplicateRevocation.job.clientTokenExpiresAt;
  duplicateRevocation.events.at(-1)!.eventType="CLIENT_LINK_REVOKED";
  await assert.rejects(commit(duplicateRevocation,revoked.job.version),/matching capability change/);
  const reissued=transition(revoked,provider,{type:"ROTATE_INVITE"});
  await commit(reissued.aggregate,revoked.job.version);
  assert.ok(reissued.token && validCapability(reissued.aggregate.job,reissued.token));
  assert.deepEqual((await pg.query<{event_type:string}>("SELECT event_type FROM public.trust_events WHERE job_id=$1 ORDER BY event_sequence",[aggregate.job.id])).rows.map(row=>row.event_type),["JOB_CREATED","JOB_SENT","JOB_ACCEPTED","PAYMENT_RECORDED","CLIENT_LINK_REVOKED","CLIENT_LINK_REISSUED"]);
  assert.deepEqual((await pg.query<{event_type:string}>("SELECT event_type FROM public.public_transaction_events WHERE public_id=$1 ORDER BY event_sequence",[aggregate.job.publicId])).rows.map(row=>row.event_type),["JOB_CREATED","JOB_SENT","JOB_ACCEPTED","PAYMENT_RECORDED"]);
 } finally { await pg.close(); }
});

test("PostgreSQL migrations: least privilege, immutable ledger and recorded-payment semantics",async()=>{
 const pg=await databaseBeforePhase6();
 try {
  await pg.exec(await readFile("supabase/migrations/20260921000000_database_model.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260921000001_database_security.sql","utf8"));
  const ledgerMigration=await readFile("supabase/migrations/20260921000002_trust_event_ledger.sql","utf8");
  await pg.exec(ledgerMigration);
  assert.equal((ledgerMigration.match(/ALTER DEFAULT PRIVILEGES IN SCHEMA (?:public|private)/g) || []).length,2);
  await pg.exec(await readFile("supabase/migrations/20260921000003_payment_semantics.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260922000000_real_job_creation.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260922000001_public_transaction_projection.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260922000002_secure_client_capabilities.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260922000003_client_acceptance.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260924000000_work_delivery_revisions.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260924000001_evidence_storage.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260926000000_disputes.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260926000001_reviews_trust_profile.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260927000000_transaction_notifications.sql","utf8"));
  await pg.exec(await readFile("supabase/migrations/20260927000001_validation_analytics.sql","utf8"));
 const constraintValues = async (name: string) => {
  const result = await pg.query<{definition:string}>("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname=$1", [name]);
  return [...result.rows[0].definition.matchAll(/'([^']+)'::text/g)].map(match => match[1]).sort();
 };
 assert.deepEqual(await constraintValues("jobs_status_check"), [...jobStatuses].sort());
  const events = [...trustEventTypes].sort();
  assert.deepEqual(await constraintValues("supported_trust_event"), events);
  assert.deepEqual(Object.keys(eventLabels).sort(), events);
  assert.deepEqual([...new Set(["JOB_CREATED","JOB_SENT","JOB_VIEWED",...Object.values(transactionRules).map(rule=>rule.event)])].sort(),events);
 const jobColumns=await pg.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs'");
 for(const legacyColumn of ["client_id","client_name","client_email","client_phone","client_action_token_hash","client_token_expires_at","client_token_used"]){
  assert.equal(jobColumns.rows.some(column=>column.column_name===legacyColumn),false);
 }
 const termTypes=await pg.query<{column_name:string;data_type:string}>("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='job_terms' AND column_name IN ('price','deadline') ORDER BY column_name");
 assert.deepEqual(termTypes.rows,[{column_name:"deadline",data_type:"date"},{column_name:"price",data_type:"numeric"}]);
  const providerColumns=await pg.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='provider_profiles'");
  for(const derivedColumn of ["completed_jobs_count","average_rating","on_time_rate"]){assert.equal(providerColumns.rows.some(column=>column.column_name===derivedColumn),false);}
  const eventSequenceColumn=await pg.query<{data_type:string;is_nullable:string}>("SELECT data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='trust_events' AND column_name='event_sequence'");
  assert.deepEqual(eventSequenceColumn.rows,[{data_type:"integer",is_nullable:"NO"}]);
  const requestIndex=await pg.query<{indexdef:string}>("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='trust_events_request_once'");
  assert.match(requestIndex.rows[0].indexdef,/CREATE UNIQUE INDEX[\s\S]*job_id[\s\S]*request_id/i);
  const repeatUseIndex=await pg.query<{indexdef:string}>("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='jobs_one_first_use_per_provider'");
  assert.match(repeatUseIndex.rows[0].indexdef,/CREATE UNIQUE INDEX[\s\S]*provider_id[\s\S]*repeat_use[\s\S]*FIRST/i);
  const paymentColumns=await pg.query<{column_name:string;data_type:string;is_nullable:string}>("SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name IN ('amount','currency') ORDER BY column_name");
  assert.deepEqual(paymentColumns.rows,[{column_name:"amount",data_type:"numeric",is_nullable:"NO"},{column_name:"currency",data_type:"text",is_nullable:"NO"}]);
  assert.deepEqual(await constraintValues("payments_provider_declaration"),["PROVIDER"]);
  const publicIdConstraint=await pg.query<{definition:string}>("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname='jobs_public_id_format'");
  assert.match(publicIdConstraint.rows[0].definition,/\^\[a-f0-9\]\{24\}\$/);
  const protectedTables=await pg.query<{relname:string;relrowsecurity:boolean;relforcerowsecurity:boolean}>("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace WHERE namespace.nspname='public' AND relation.relkind='r' ORDER BY relname");
  assert.deepEqual(protectedTables.rows.map(table=>table.relname),applicationTables);
  for(const table of protectedTables.rows){
   assert.equal(table.relrowsecurity,true,`${table.relname} must enable RLS`);
   assert.equal(table.relforcerowsecurity,true,`${table.relname} must force RLS`);
  }
  assert.equal((await pg.query<{count:number}>("SELECT count(*)::integer AS count FROM pg_policies WHERE schemaname='public'")).rows[0].count,0);
  const viewSecurity=await pg.query<{relname:string;reloptions:string[]|null}>("SELECT relname,reloptions FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace WHERE namespace.nspname='public' AND relation.relname IN ('public_job_records','public_transaction_events') ORDER BY relname");
  assert.deepEqual(viewSecurity.rows.map(view=>view.relname),["public_job_records","public_transaction_events"]);
  for(const view of viewSecurity.rows)assert.ok(view.reloptions?.includes("security_invoker=true"),`${view.relname} must use security invoker`);
  const projectionColumns=await pg.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='public_job_records' ORDER BY ordinal_position");
  assert.deepEqual(projectionColumns.rows.map(column=>column.column_name),publicJobColumns);
  const eventProjectionColumns=await pg.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='public_transaction_events' ORDER BY ordinal_position");
  assert.deepEqual(eventProjectionColumns.rows.map(column=>column.column_name),publicEventColumns);
 const provider:Actor={id:"11111111-1111-4111-8111-111111111111",type:"PROVIDER",name:"Ada"};
 await pg.query("INSERT INTO auth.users VALUES ($1,$2)",[provider.id,{display_name:"Ada",role:"ADMIN"}]);
 const profiles=await pg.query<{display_name:string}>("SELECT display_name FROM public.profiles WHERE user_id=$1",[provider.id]);
 assert.equal(profiles.rows[0].display_name,"Ada");
 const {aggregate,token}=createAggregate({providerId:provider.id,title:"Design",category:"Design",scope:"Logo",deliverables:["Logo"],price:"5000",deadline:"2099-01-01",revisions:1,cancellationTerms:"Discuss first",sourceChannel:"Direct",repeatUse:"FIRST"});
 const commit=(a:unknown,v:number|null)=>pg.query("SELECT public.tl_commit_job($1::jsonb,$2::integer)",[JSON.stringify(a),v]);
  assert.match(aggregate.job.publicId,/^[a-f0-9]{24}$/);
  const invalidIdentifier=structuredClone(aggregate);invalidIdentifier.job.publicId="predictable-job";
  await assert.rejects(commit(invalidIdentifier,null),/opaque identifiers|check constraint/);
  const invalidState=structuredClone(aggregate);invalidState.job.status="ACCEPTED";
  await assert.rejects(commit(invalidState,null),/canonical SENT state/);
  const expiredInitial=structuredClone(aggregate);
  const oldCreationTime=new Date(Date.now()-2*86400000).toISOString();
  const expiredCapabilityTime=new Date(Date.now()-86400000).toISOString();
  Object.assign(expiredInitial.job,{createdAt:oldCreationTime,updatedAt:oldCreationTime,clientTokenExpiresAt:expiredCapabilityTime});
  expiredInitial.terms.createdAt=oldCreationTime;
  for(const event of expiredInitial.events)Object.assign(event,{occurredAt:oldCreationTime,createdAt:oldCreationTime});
  await assert.rejects(commit(expiredInitial,null),/unused expiring client capability/);
  assert.equal((await pg.query<{count:number}>("SELECT count(*)::integer AS count FROM public.jobs")).rows[0].count,0);
  await commit(aggregate,null);
  const duplicateFirst=createAggregate({providerId:provider.id,title:"Misclassified repeat",category:"Design",scope:"Icon",deliverables:["Icon"],price:"1000",deadline:"2099-01-02",revisions:0,cancellationTerms:"Discuss first",sourceChannel:"Direct",repeatUse:"FIRST"}).aggregate;
  await assert.rejects(commit(duplicateFirst,null),/returning provider|duplicate key/);
  const repeat=createAggregate({providerId:provider.id,title:"Independent repeat",category:"Design",scope:"Icon",deliverables:["Icon"],price:"1000",deadline:"2099-01-02",revisions:0,cancellationTerms:"Discuss first",sourceChannel:"Direct",repeatUse:"UNPROMPTED"}).aggregate;
  await commit(repeat,null);
  await assert.rejects(pg.query("UPDATE public.jobs SET repeat_use='PROMPTED' WHERE id=$1",[repeat.job.id]),/immutable/);
 const initialParticipants=await pg.query<{role:string;detail_status:string;display_name:string|null;token_used:boolean}>("SELECT role,detail_status,display_name,token_used FROM public.job_participants WHERE job_id=$1 ORDER BY role",[aggregate.job.id]);
 assert.deepEqual(initialParticipants.rows,[
  {role:"CLIENT_PARTICIPANT",detail_status:"UNKNOWN",display_name:null,token_used:false},
  {role:"PROVIDER",detail_status:"SELF_PROVIDED",display_name:"Ada",token_used:false},
 ]);
  const read=await pg.query<{record:{job:{client_action_token_hash:string;client_token_used:boolean};terms:{price:string};events:Array<{event_sequence:number;event_type:string}>}}>("SELECT public.tl_read_job($1,true) AS record",[aggregate.job.publicId]);
  assert.equal(read.rows[0].record.events.length,2);
  assert.deepEqual(read.rows[0].record.events.map(event=>[event.event_sequence,event.event_type]),[[1,"JOB_CREATED"],[2,"JOB_SENT"]]);
 assert.ok(read.rows[0].record.job.client_action_token_hash);
 assert.equal(read.rows[0].record.job.client_token_used,false);
 assert.equal(read.rows[0].record.terms.price,"5000.00");
  const accepted=acceptAggregate(camel<JobAggregate>(read.rows[0].record),token,{name:"Client",email:"client@example.com"});
 const expectedAcceptedTerms={service:"Design",serviceCategory:"Design",scope:"Logo",deliverables:["Logo"],price:"5000.00",currency:"NGN",deadline:"2099-01-01",revisionsIncluded:1,cancellationTerms:"Discuss first"};
 assert.deepEqual(accepted.events.at(-1)?.metadata.acceptedTerms,expectedAcceptedTerms);
  const alteredAcceptance=structuredClone(accepted);
  (alteredAcceptance.events.at(-1)!.metadata.acceptedTerms as Record<string,unknown>).scope="Altered scope";
  await assert.rejects(commit(alteredAcceptance,0),/snapshot the reviewed agreement terms/);
  const claimedVerifiedAcceptance=structuredClone(accepted);
  claimedVerifiedAcceptance.events.at(-1)!.metadata.participantDetailStatus="EMAIL_VERIFIED";
  await assert.rejects(commit(claimedVerifiedAcceptance,0),/self-provided/);
  const claimedLegacyVerifiedAcceptance=structuredClone(accepted);
  claimedLegacyVerifiedAcceptance.events.at(-1)!.metadata.identityStatus="EMAIL_VERIFIED";
  await assert.rejects(commit(claimedLegacyVerifiedAcceptance,0),/self-provided/);
  const uncapableAcceptance=structuredClone(accepted);
  delete uncapableAcceptance.job.clientActionTokenHash;delete uncapableAcceptance.job.clientTokenExpiresAt;
  await assert.rejects(commit(uncapableAcceptance,0),/active capability/);
  const attachedAccountAcceptance=structuredClone(accepted);
  attachedAccountAcceptance.job.clientId=provider.id;
  await assert.rejects(commit(attachedAccountAcceptance,0),/stored active capability and supplied details/);
  await commit(accepted,0);
  const duplicateAcceptance=structuredClone(accepted);
  duplicateAcceptance.job.version=2;
  const duplicateAcceptanceEvent=structuredClone(accepted.events.at(-1)!);
  Object.assign(duplicateAcceptanceEvent,{
    id:"00000000-0000-4000-8000-000000000013",eventSequence:4,
    metadata:{...duplicateAcceptanceEvent.metadata,requestId:"00000000-0000-4000-8000-000000000014",expectedVersion:1},
  });
  duplicateAcceptance.events.push(duplicateAcceptanceEvent);
  await assert.rejects(commit(duplicateAcceptance,1),/reviewed SENT agreement/);
  const clientParticipant=await pg.query<{display_name:string;email:string;detail_status:string;token_used:boolean}>("SELECT display_name,email,detail_status,token_used FROM public.job_participants WHERE job_id=$1 AND role='CLIENT_PARTICIPANT'",[aggregate.job.id]);
 assert.deepEqual(clientParticipant.rows[0],{display_name:"Client",email:"client@example.com",detail_status:"SELF_PROVIDED",token_used:true});
 await assert.rejects(pg.query("UPDATE public.job_participants SET email='changed@example.com' WHERE job_id=$1 AND role='CLIENT_PARTICIPANT'",[aggregate.job.id]),/immutable/);
 await assert.rejects(pg.query("UPDATE public.job_participants SET user_id=$2 WHERE job_id=$1 AND role='CLIENT_PARTICIPANT'",[aggregate.job.id,provider.id]),/immutable/);
 await assert.rejects(pg.query("UPDATE public.job_participants SET detail_status='VERIFIED_IDENTITY' WHERE job_id=$1 AND role='CLIENT_PARTICIPANT'",[aggregate.job.id]),/check constraint/);
 await assert.rejects(pg.query("DELETE FROM public.job_participants WHERE job_id=$1 AND role='CLIENT_PARTICIPANT'",[aggregate.job.id]),/requires one matching provider and one client participant/);
 const acceptanceEvent=await pg.query<{metadata:{participant_detail_status:string;accepted_terms:typeof expectedAcceptedTerms}}>("SELECT metadata FROM public.trust_events WHERE event_type='JOB_ACCEPTED'");
 assert.equal(acceptanceEvent.rows[0].metadata.participant_detail_status,"SELF_PROVIDED");
 assert.deepEqual(acceptanceEvent.rows[0].metadata.accepted_terms,{
  service:"Design",service_category:"Design",scope:"Logo",deliverables:["Logo"],price:"5000.00",currency:"NGN",
  deadline:"2099-01-01",revisions_included:1,cancellation_terms:"Discuss first",
 });
  await assert.rejects(pg.query("INSERT INTO public.trust_events(id,job_id,actor_id,actor_type,event_type,event_sequence,metadata) VALUES ('99999999-9999-4999-8999-999999999999',$1,'client:test','CLIENT_PARTICIPANT','JOB_ACCEPTED',4,'{}')",[aggregate.job.id]),/actor|operation metadata|check constraint/);
  await assert.rejects(commit(accepted,0),/Concurrent change/);
  const invalidPaid=transition(accepted,provider,{type:"PAYMENT"}).aggregate;
  // An invalid event must roll back the payment AND the state update.
  Object.assign(invalidPaid.events.at(-1)!,{actorId:`client:${aggregate.job.id}`,actorType:"CLIENT_PARTICIPANT" as const});
  await assert.rejects(commit(invalidPaid,1),/check constraint|actor/);
 const after=await pg.query<{status:string;version:number}>("SELECT status,version FROM public.jobs WHERE id=$1",[aggregate.job.id]);
 assert.equal(after.rows[0].status,"ACCEPTED");assert.equal(after.rows[0].version,1);
 assert.equal((await pg.query("SELECT * FROM public.payments")).rows.length,0);
  const paid=transition(accepted,provider,{type:"PAYMENT"},{id:"44444444-4444-4444-8444-444444444444",expectedVersion:1}).aggregate;await commit(paid,1);
  const event=await pg.query<{actor_id:string;event_sequence:number;occurred_at:Date;metadata:{request_id:string;amount:string;currency:string;verification_status:string}}>("SELECT actor_id,event_sequence,occurred_at,metadata FROM public.trust_events WHERE event_type='PAYMENT_RECORDED'");
  assert.equal(event.rows[0].actor_id,provider.id);
  assert.equal(event.rows[0].event_sequence,4);
  assert.equal(event.rows[0].metadata.request_id,"44444444-4444-4444-8444-444444444444");
  assert.equal(event.rows[0].metadata.amount,"5000.00");assert.equal(event.rows[0].metadata.currency,"NGN");assert.equal(event.rows[0].metadata.verification_status,"NOT_VERIFIED");
  assert.ok(Number.isFinite(new Date(event.rows[0].occurred_at).getTime()));
  const storedPayment=await pg.query<{amount:string;currency:string;recorded_by:string;verification_status:string}>("SELECT amount::text,currency,recorded_by,verification_status FROM public.payments WHERE job_id=$1",[aggregate.job.id]);
  assert.deepEqual(storedPayment.rows,[{amount:"5000.00",currency:"NGN",recorded_by:"PROVIDER",verification_status:"NOT_VERIFIED"}]);
  await assert.rejects(commit(paid,1),/Concurrent change/);
  assert.equal((await pg.query("SELECT id FROM public.payments WHERE job_id=$1",[aggregate.job.id])).rows.length,1);
  assert.equal((await pg.query("SELECT id FROM public.trust_events WHERE job_id=$1 AND event_type='PAYMENT_RECORDED'",[aggregate.job.id])).rows.length,1);
  const paymentRead=await pg.query<{record:{payments:Array<{amount:string;currency:string}>}}>("SELECT public.tl_read_job($1,false) AS record",[aggregate.job.id]);
  assert.deepEqual(paymentRead.rows[0].record.payments.map(payment=>[payment.amount,payment.currency]),[["5000.00","NGN"]]);
  const eventless=structuredClone(paid);eventless.job.version++;eventless.job.status="IN_PROGRESS";
  await assert.rejects(commit(eventless,2),/complete history and one new event/);
  assert.equal((await pg.query<{status:string}>("SELECT status FROM public.jobs WHERE id=$1",[aggregate.job.id])).rows[0].status,"PAYMENT_RECORDED");
  const tampered=transition(paid,provider,{type:"START"},{id:"55555555-5555-4555-8555-555555555555",expectedVersion:2}).aggregate;
  tampered.events[0].metadata={forged:true};
  await assert.rejects(commit(tampered,2),/Persisted trust event history/);
  const changedPayment=transition(paid,provider,{type:"START"},{id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",expectedVersion:2}).aggregate;
  changedPayment.payments[0].reference="altered";
  await assert.rejects(commit(changedPayment,2),/payment evidence is immutable/);
  const missingOperation=transition(paid,provider,{type:"START"},{id:"66666666-6666-4666-8666-666666666666",expectedVersion:2}).aggregate;
  delete missingOperation.events.at(-1)!.metadata.requestId;
  await assert.rejects(commit(missingOperation,2),/operation metadata/);
  const backdated=transition(paid,provider,{type:"START"},{id:"77777777-7777-4777-8777-777777777777",expectedVersion:2}).aggregate;
  backdated.events.at(-1)!.occurredAt="2000-01-01T00:00:00.000Z";
  backdated.events.at(-1)!.createdAt="2000-01-01T00:00:00.000Z";
  await assert.rejects(commit(backdated,2),/cannot move backwards/);
  const started=transition(paid,provider,{type:"START"},{id:"88888888-8888-4888-8888-888888888888",expectedVersion:2}).aggregate;
  await commit(started,2);
  await assert.rejects(pg.query(`INSERT INTO public.trust_events(id,job_id,actor_id,actor_type,event_type,event_sequence,metadata)
    VALUES ('aaaaaaaa-9999-4999-8999-999999999999',$1,$2,'PROVIDER','WORK_STARTED',7,$3::jsonb)`,[
      aggregate.job.id,provider.id,JSON.stringify({request_id:"99999999-9999-4999-8999-999999999999",command_hash:"a".repeat(64),expected_version:3}),
  ]),/sequence must be contiguous/);
  assert.deepEqual((await pg.query<{event_sequence:number}>("SELECT event_sequence FROM public.trust_events WHERE job_id=$1 ORDER BY event_sequence",[aggregate.job.id])).rows.map(row=>row.event_sequence),[1,2,3,4,5]);
 await assert.rejects(pg.query("UPDATE public.trust_events SET event_type='FAKE'"),/immutable/);
 await assert.rejects(pg.query("DELETE FROM public.trust_events"),/immutable/);
  await assert.rejects(pg.query("TRUNCATE public.trust_events"),/immutable|foreign key constraint/);
  await assert.rejects(pg.query("UPDATE public.payments SET reference='altered'"),/payment evidence is immutable/);
  await assert.rejects(pg.query("DELETE FROM public.payments"),/payment evidence is immutable/);
  await assert.rejects(pg.query("TRUNCATE public.payments"),/payment evidence is immutable/);
  for(const role of ["anon","authenticated"]){
   for(const table of applicationTables){
    for(const privilege of ["SELECT","INSERT","UPDATE","DELETE","TRUNCATE"]){
     const result=await pg.query<{allowed:boolean}>("SELECT has_table_privilege($1,$2,$3) AS allowed",[role,`public.${table}`,privilege]);
     assert.equal(result.rows[0].allowed,false,`${role} must not have ${privilege} on ${table}`);
    }
   }
   assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege($1,'public.public_job_records','SELECT') AS allowed",[role])).rows[0].allowed,false);
   assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege($1,'public.public_transaction_events','SELECT') AS allowed",[role])).rows[0].allowed,false);
  }
  for(const table of applicationTables){
   assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege('service_role',$1,'SELECT') AS allowed",[`public.${table}`])).rows[0].allowed,true,`service_role must read ${table}`);
   for(const privilege of ["INSERT","UPDATE","DELETE","TRUNCATE"]){
    const expected=table==="evidence_files" && (privilege==="INSERT" || privilege==="DELETE");
    assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege('service_role',$1,$2) AS allowed",[`public.${table}`,privilege])).rows[0].allowed,expected,`unexpected service_role ${privilege} on ${table}`);
   }
  }
  assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege('service_role','public.public_job_records','SELECT') AS allowed")).rows[0].allowed,true);
  assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege('service_role','public.public_transaction_events','SELECT') AS allowed")).rows[0].allowed,true);
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
  const privilegedRoutines=await pg.query<{name:string;security_definer:boolean;configuration:string[]|null}>(`SELECT procedure.proname AS name,procedure.prosecdef AS security_definer,procedure.proconfig AS configuration
    FROM pg_proc procedure JOIN pg_namespace namespace ON namespace.oid=procedure.pronamespace
    WHERE namespace.nspname='public' AND procedure.proname IN ('tl_commit_job','tl_read_job','tl_update_profile')
    ORDER BY procedure.proname`);
  assert.deepEqual(privilegedRoutines.rows.map(routine=>routine.name),["tl_commit_job","tl_read_job","tl_update_profile"]);
  for(const routine of privilegedRoutines.rows){
   assert.equal(routine.security_definer,true,`${routine.name} must retain atomic owner execution`);
   assert.ok(routine.configuration?.includes('search_path=""'),`${routine.name} must use an empty search_path`);
  }
  for(const role of ["anon","authenticated","service_role"]){
   assert.equal((await pg.query<{allowed:boolean}>("SELECT has_schema_privilege($1,'private','USAGE') AS allowed",[role])).rows[0].allowed,false,`${role} must not use the private schema`);
   assert.equal((await pg.query<{allowed:boolean}>("SELECT has_function_privilege($1,'private.tl_commit_job(jsonb,integer)','EXECUTE') AS allowed",[role])).rows[0].allowed,false,`${role} must not execute the private commit function`);
   assert.equal((await pg.query<{allowed:boolean}>("SELECT has_function_privilege($1,'private.tl_validate_trust_event_insert()','EXECUTE') AS allowed",[role])).rows[0].allowed,false,`${role} must not execute the ledger trigger function`);
  }
  const privateRoutines=await pg.query<{signature:string}>("SELECT procedure.oid::regprocedure::text AS signature FROM pg_proc procedure JOIN pg_namespace namespace ON namespace.oid=procedure.pronamespace WHERE namespace.nspname='private' ORDER BY procedure.proname");
  for(const role of ["anon","authenticated","service_role"]){
   for(const routine of privateRoutines.rows){
    assert.equal((await pg.query<{allowed:boolean}>("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed",[role,routine.signature])).rows[0].allowed,false,`${role} must not execute ${routine.signature}`);
   }
  }
  await pg.exec("CREATE TABLE public.phase8_default_table_probe(id integer)");
  for(const role of ["anon","authenticated","service_role"]){
   assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege($1,'public.phase8_default_table_probe','SELECT') AS allowed",[role])).rows[0].allowed,false,`${role} inherited a future table grant`);
  }
  await pg.exec("DROP TABLE public.phase8_default_table_probe");
  const wrongPurposePath=aggregate.job.id+"/10101010-1010-4010-8010-101010101010";
  await pg.query("INSERT INTO public.evidence_files(job_id,storage_path,filename,content_type,size_bytes,uploaded_by,purpose) VALUES ($1,$2,'wrong.txt','text/plain',5,$3,'DISPUTE')",[aggregate.job.id,wrongPurposePath,provider.id]);
  const wrongPurposeDelivery=transition(started,provider,{type:"DELIVER",description:"Wrong purpose",files:[wrongPurposePath]},{id:"11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",expectedVersion:3}).aggregate;
  await assert.rejects(commit(wrongPurposeDelivery,3),/purpose-bound/);
  await pg.query("DELETE FROM public.evidence_files WHERE storage_path=$1",[wrongPurposePath]);
  const deliveryEvidencePath=aggregate.job.id+"/12121212-1212-4212-8212-121212121212";
  await pg.query("INSERT INTO public.evidence_files(job_id,storage_path,filename,content_type,size_bytes,uploaded_by,purpose) VALUES ($1,$2,'delivery.pdf','application/pdf',20,$3,'DELIVERY')",[aggregate.job.id,deliveryEvidencePath,provider.id]);
  const delivered=transition(started,provider,{type:"DELIVER",description:"Final files",files:[deliveryEvidencePath]},{id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",expectedVersion:3}).aggregate;
  const missingDelivery=structuredClone(delivered);missingDelivery.deliveries=[];
  await assert.rejects(commit(missingDelivery,3),/one provider delivery|one submitted delivery|matching delivery record/);
  assert.equal((await pg.query<{attachment_status:string}>("SELECT attachment_status FROM public.evidence_files WHERE storage_path=$1",[deliveryEvidencePath])).rows[0].attachment_status,"PENDING");
  await pg.exec("SET ROLE service_role");
  assert.equal((await pg.query<{public_id:string}>("SELECT public_id FROM public.public_job_records WHERE public_id=$1",[aggregate.job.publicId])).rows[0].public_id,aggregate.job.publicId);
  assert.deepEqual((await pg.query<{event_type:string}>("SELECT event_type FROM public.public_transaction_events WHERE public_id=$1 ORDER BY event_sequence",[aggregate.job.publicId])).rows.map(row=>row.event_type),["JOB_CREATED","JOB_SENT","JOB_ACCEPTED","PAYMENT_RECORDED","WORK_STARTED"]);
  assert.ok((await pg.query<{record:unknown}>("SELECT public.tl_read_job($1,true) AS record",[aggregate.job.publicId])).rows[0].record);
  await commit(delivered,3);
  assert.equal((await pg.query<{status:string}>("SELECT status FROM public.jobs WHERE id=$1",[aggregate.job.id])).rows[0].status,"DELIVERY_SUBMITTED");
  const deliveryLink=await pg.query<{id:string;metadata:{delivery_id:string;file_count:number} }>("SELECT delivery.id,event.metadata FROM public.deliveries delivery JOIN public.trust_events event ON event.metadata->>'delivery_id'=delivery.id::text WHERE delivery.job_id=$1",[aggregate.job.id]);
  assert.deepEqual(deliveryLink.rows.map(row=>[row.id,row.metadata.delivery_id,row.metadata.file_count]),[[delivered.deliveries[0].id,delivered.deliveries[0].id,1]]);
  assert.equal((await pg.query<{purpose:string;attachment_status:string}>("SELECT purpose,attachment_status FROM public.evidence_files WHERE storage_path=$1",[deliveryEvidencePath])).rows[0].attachment_status,"ATTACHED");
  await assert.rejects(pg.query("UPDATE public.trust_events SET metadata='{}'"),/permission denied/);
  await assert.rejects(pg.query("UPDATE public.profiles SET display_name='Unauthorized'"),/permission denied/);
  const forgedAttachedPath=aggregate.job.id+"/45454545-4545-4545-8545-454545454545";
  await assert.rejects(pg.query("INSERT INTO public.evidence_files(job_id,storage_path,filename,content_type,size_bytes,uploaded_by,purpose,attachment_status) VALUES ($1,$2,'forged.txt','text/plain',1,$3,'DELIVERY','ATTACHED')",[aggregate.job.id,forgedAttachedPath,provider.id]),/must be pending/);
  const pendingEvidencePath=aggregate.job.id+"/34343434-3434-4434-8434-343434343434";
  const evidence=await pg.query<{id:string}>("INSERT INTO public.evidence_files(job_id,storage_path,filename,content_type,size_bytes,uploaded_by,purpose) VALUES ($1,$2,'evidence.txt','text/plain',1,$3,'DISPUTE') RETURNING id",[aggregate.job.id,pendingEvidencePath,provider.id]);
  assert.match(evidence.rows[0].id,/^[0-9a-f-]{36}$/);
  await pg.query("DELETE FROM public.evidence_files WHERE id=$1",[evidence.rows[0].id]);
  await pg.exec("RESET ROLE");
  await assert.rejects(pg.query("DELETE FROM public.evidence_files WHERE storage_path=$1",[deliveryEvidencePath]),/evidence metadata is immutable/);
  await assert.rejects(pg.query("UPDATE public.evidence_files SET filename='altered.pdf' WHERE storage_path=$1",[deliveryEvidencePath]),/evidence metadata is immutable/);
  await assert.rejects(pg.query("UPDATE public.deliveries SET description='Altered' WHERE job_id=$1",[aggregate.job.id]),/evidence is immutable/);
  await assert.rejects(pg.query("DELETE FROM public.deliveries WHERE job_id=$1",[aggregate.job.id]),/evidence is immutable/);
  const client:Actor={id:"client:"+aggregate.job.id,type:"CLIENT_PARTICIPANT",name:"Client"};
  const revised=transition(delivered,client,{type:"REVISE",description:"Change the heading"},{id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",expectedVersion:4}).aggregate;
  await commit(revised,4);
  const restarted=transition(revised,provider,{type:"START"},{id:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",expectedVersion:5}).aggregate;await commit(restarted,5);
  const redelivered=transition(restarted,provider,{type:"DELIVER",description:"Revised files",files:[]},{id:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",expectedVersion:6}).aggregate;await commit(redelivered,6);
  const overLimit=structuredClone(redelivered),overLimitTime=new Date(Date.parse(redelivered.job.updatedAt)+1000).toISOString();
  overLimit.job.status="REVISION_REQUESTED";overLimit.job.version=8;overLimit.job.updatedAt=overLimitTime;overLimit.terms.revisionsUsed=2;
  const overLimitRevisionId="ffffffff-ffff-4fff-8fff-ffffffffffff";
  overLimit.revisions.push({id:overLimitRevisionId,jobId:aggregate.job.id,revisionNumber:2,description:"Extra revision",requestedBy:client.id,requestedAt:overLimitTime});
  overLimit.events.push({id:"99999999-aaaa-4aaa-8aaa-aaaaaaaaaaaa",jobId:aggregate.job.id,actorId:client.id,actorType:"CLIENT_PARTICIPANT",eventType:"REVISION_REQUESTED",eventSequence:overLimit.events.length+1,occurredAt:overLimitTime,createdAt:overLimitTime,metadata:{revisionId:overLimitRevisionId,revisionNumber:2,requestId:"99999999-bbbb-4bbb-8bbb-bbbbbbbbbbbb",commandHash:"a".repeat(64),expectedVersion:7}});
  await assert.rejects(commit(overLimit,7),/revision limit|exceeds the included limit/);
  assert.equal((await pg.query("SELECT id FROM public.revisions WHERE job_id=$1",[aggregate.job.id])).rows.length,1);
  const disputed=transition(redelivered,client,{type:"DISPUTE",description:"The revised scope is still incomplete",contestedTerm:"Scope",files:[]},{id:"56565656-5656-4656-8656-565656565656",expectedVersion:7}).aggregate;
  await commit(disputed,7);
  const responded=transition(disputed,provider,{type:"RESPOND_DISPUTE",response:"The missing scope will be supplied"},{id:"67676767-6767-4676-8676-676767676767",expectedVersion:8}).aggregate;
  const forgedResponse=structuredClone(responded);
  Object.assign(forgedResponse.events.at(-1)!,{actorId:client.id,actorType:"CLIENT_PARTICIPANT"});
  await assert.rejects(commit(forgedResponse,8),/other transaction party|authorized other party/);
  await commit(responded,8);
  const persistedResponse=await pg.query<{response_from_other_party:string;dispute_status:string}>("SELECT response_from_other_party,dispute_status FROM public.disputes WHERE id=$1",[responded.disputes[0].id]);
  assert.deepEqual(persistedResponse.rows,[{response_from_other_party:"The missing scope will be supplied",dispute_status:"UNDER_REVIEW"}]);
  await assert.rejects(pg.query("UPDATE public.disputes SET response_from_other_party='Altered response' WHERE id=$1",[responded.disputes[0].id]),/matching response or resolution event/);
  const admin:Actor={id:"33333333-3333-4333-8333-333333333333",type:"ADMIN",name:"Admin"};
  const resolved=transition(responded,admin,{type:"RESOLVE",notes:"Provider will resume and supply the missing scope",outcome:"IN_PROGRESS"},{id:"78787878-7878-4787-8787-787878787878",expectedVersion:9}).aggregate;
  await commit(resolved,9);
  const persistedResolution=await pg.query<{dispute_status:string;resolution_notes:string;resolved_by:string}>("SELECT dispute_status,resolution_notes,resolved_by FROM public.disputes WHERE id=$1",[resolved.disputes[0].id]);
  assert.deepEqual(persistedResolution.rows,[{dispute_status:"RESOLVED",resolution_notes:"Provider will resume and supply the missing scope",resolved_by:admin.id}]);
  await assert.rejects(pg.query("UPDATE public.disputes SET resolution_notes='Altered resolution' WHERE id=$1",[resolved.disputes[0].id]),/matching response or resolution event/);
  const finalDelivery=transition(resolved,provider,{type:"DELIVER",description:"Final completed files",files:[]},{id:"89898989-8989-4989-8989-898989898989",expectedVersion:10}).aggregate;
  await commit(finalDelivery,10);
  const approved=transition(finalDelivery,client,{type:"APPROVE"},{id:"90909090-9090-4090-8090-909090909090",expectedVersion:11}).aggregate;
  await commit(approved,11);
  const completed=transition(approved,provider,{type:"COMPLETE"},{id:"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1",expectedVersion:12}).aggregate;
  await commit(completed,12);
  const reviewed=transition(completed,client,{type:"REVIEW",rating:4,comment:"Clear record and a complete final delivery"},{id:"b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2",expectedVersion:13}).aggregate;
  const forgedReview=structuredClone(reviewed);
  Object.assign(forgedReview.events.at(-1)!,{actorId:provider.id,actorType:"PROVIDER"});
  await assert.rejects(commit(forgedReview,13),/transaction client|authorized post-completion review/);
  await commit(reviewed,13);
  const persistedReview=await pg.query<{id:string;rating:number;comment:string;review_id:string}>("SELECT review.id,review.rating,review.comment,event.metadata->>'review_id' AS review_id FROM public.reviews review JOIN public.trust_events event ON event.metadata->>'review_id'=review.id::text WHERE review.job_id=$1",[aggregate.job.id]);
  assert.deepEqual(persistedReview.rows,[{id:reviewed.reviews[0].id,rating:4,comment:"Clear record and a complete final delivery",review_id:reviewed.reviews[0].id}]);
  await assert.rejects(pg.query("UPDATE public.reviews SET comment='Altered review' WHERE job_id=$1",[aggregate.job.id]),/reviews are immutable/);
  await assert.rejects(pg.query("DELETE FROM public.reviews WHERE job_id=$1",[aggregate.job.id]),/reviews are immutable/);
  await assert.rejects(pg.query("TRUNCATE public.reviews"),/reviews are immutable/);
  const notificationRows=await pg.query<{event_type:string;notification_kind:string;recipient_role:string}>(`SELECT event.event_type,intent.notification_kind,intent.recipient_role
    FROM public.notification_intents intent JOIN public.trust_events event ON event.id=intent.event_id
    WHERE intent.job_id=$1 ORDER BY event.event_sequence,intent.recipient_role`,[aggregate.job.id]);
  assert.deepEqual(notificationRows.rows,[
   {event_type:"JOB_ACCEPTED",notification_kind:"TRANSACTION_ACCEPTED",recipient_role:"PROVIDER"},
   {event_type:"PAYMENT_RECORDED",notification_kind:"PAYMENT_RECORDED",recipient_role:"CLIENT_PARTICIPANT"},
   {event_type:"DELIVERY_SUBMITTED",notification_kind:"DELIVERY_SUBMITTED",recipient_role:"CLIENT_PARTICIPANT"},
   {event_type:"REVISION_REQUESTED",notification_kind:"REVISION_REQUESTED",recipient_role:"PROVIDER"},
   {event_type:"DELIVERY_SUBMITTED",notification_kind:"DELIVERY_SUBMITTED",recipient_role:"CLIENT_PARTICIPANT"},
   {event_type:"DISPUTE_OPENED",notification_kind:"DISPUTE_RAISED",recipient_role:"ADMIN"},
   {event_type:"DISPUTE_OPENED",notification_kind:"DISPUTE_RAISED",recipient_role:"PROVIDER"},
   {event_type:"DELIVERY_SUBMITTED",notification_kind:"DELIVERY_SUBMITTED",recipient_role:"CLIENT_PARTICIPANT"},
   {event_type:"JOB_COMPLETED",notification_kind:"TRANSACTION_COMPLETED",recipient_role:"CLIENT_PARTICIPANT"},
  ]);
  const workStartedEvent=await pg.query<{id:string;created_at:string}>("SELECT id,created_at FROM public.trust_events WHERE job_id=$1 AND event_type='WORK_STARTED' ORDER BY event_sequence LIMIT 1",[aggregate.job.id]);
  await assert.rejects(pg.query("INSERT INTO public.notification_intents(job_id,event_id,notification_kind,recipient_role,created_at) VALUES ($1,$2,'TRANSACTION_ACCEPTED','PROVIDER',$3)",[aggregate.job.id,workStartedEvent.rows[0].id,workStartedEvent.rows[0].created_at]),/does not match/);
  await assert.rejects(pg.query("INSERT INTO public.notification_intents(job_id,event_id,notification_kind,recipient_role,created_at) SELECT job_id,id,'TRANSACTION_ACCEPTED','PROVIDER',created_at FROM public.trust_events WHERE job_id=$1 AND event_type='JOB_ACCEPTED'",[aggregate.job.id]),/duplicate key/);
  await assert.rejects(pg.query("UPDATE public.notification_intents SET recipient_role='ADMIN' WHERE job_id=$1",[aggregate.job.id]),/immutable/);
  await assert.rejects(pg.query("DELETE FROM public.notification_intents WHERE job_id=$1",[aggregate.job.id]),/immutable/);
  await assert.rejects(pg.query("TRUNCATE public.notification_intents"),/immutable/);
 // A broad pre-existing policy must not expose the private evidence bucket.
 await pg.exec("GRANT USAGE ON SCHEMA storage TO anon, authenticated; GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated; CREATE POLICY broad_legacy_storage ON storage.objects FOR ALL USING (true) WITH CHECK (true); INSERT INTO storage.objects(bucket_id) VALUES ('transaction-evidence'),('unrelated-public-bucket');");
 for(const role of ["anon","authenticated"]) {
  await pg.exec("SET ROLE "+role);
   if(role==="authenticated") await pg.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:provider.id,app_metadata:{role:"ADMIN"}})]);
   for(const table of applicationTables){
     await assert.rejects(pg.query("SELECT * FROM public."+table),/permission denied/);
   }
  await assert.rejects(pg.query("SELECT * FROM public.public_job_records"),/permission denied/);
  await assert.rejects(pg.query("SELECT * FROM public.public_transaction_events"),/permission denied/);
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
