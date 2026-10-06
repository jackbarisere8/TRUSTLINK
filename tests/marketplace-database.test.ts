import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createAggregate } from "../lib/domain/jobs";
import { acceptAggregate } from "./support/lifecycle";

const providerId="11111111-1111-4111-8111-111111111111";
const otherProviderId="22222222-2222-4222-8222-222222222222";
const customerId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherCustomerId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const serviceId="30000000-0000-4000-8000-000000000001";
const serviceDefinitionId="20000000-0000-4000-8000-000000000001";
const occurredAt=new Date().toISOString();

async function marketplaceDatabase() {
  const pg=new PGlite();
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb);
    CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS 'SELECT gen_random_uuid()';`);
  const migrations=(await readdir("supabase/migrations")).filter(file=>file.endsWith(".sql")).sort();
  for (const migration of migrations) {
    let sql=await readFile(`supabase/migrations/${migration}`,"utf8");
    if (migration==="20260917000000_v0_core.sql") sql=sql.replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',"");
    await pg.exec(sql);
  }
  for (const id of [providerId,otherProviderId,customerId,otherCustomerId]) await pg.query("INSERT INTO auth.users VALUES ($1,'{}')",[id]);
  for (const id of [providerId,otherProviderId]) await pg.query(
    "SELECT public.tl_enable_provider($1,$2::jsonb)",
    [id,JSON.stringify({headline:"Independent professional",serviceArea:"Lagos"})],
  );
  await pg.query(`UPDATE public.profiles SET
    username=CASE user_id WHEN $1 THEN 'ada-provider' WHEN $2 THEN 'other-provider' WHEN $3 THEN 'customer-one' ELSE 'customer-two' END,
    display_name=CASE user_id WHEN $1 THEN 'Ada Provider' WHEN $2 THEN 'Other Provider' WHEN $3 THEN 'Customer One' ELSE 'Customer Two' END,
    state='Lagos',city=CASE user_id WHEN $1 THEN 'Ikeja' WHEN $2 THEN 'Surulere' WHEN $3 THEN 'Ikeja' ELSE 'Yaba' END
    WHERE user_id IN ($1,$2,$3,$4)`,[providerId,otherProviderId,customerId,otherCustomerId]);
  await pg.query(`UPDATE public.provider_profiles SET headline=CASE WHEN user_id=$1 THEN 'Web developer' ELSE 'Designer' END,
    service_area='Lagos',verification_status='IDENTITY_PROVIDED',marketplace_status='PUBLISHED',moderation_status='APPROVED',published_at=$3
    WHERE user_id IN ($1,$2)`,[providerId,otherProviderId,occurredAt]);
  await pg.query(`INSERT INTO public.provider_services(id,provider_id,service_definition_id,public_title,description,pricing_model,price_min,currency,supports_remote,supports_onsite,status,published_at)
    VALUES ($1,$2,$3,'Business website development','Web design and development','STARTING_AT',150000,'NGN',true,true,'PUBLISHED',$4)`,[serviceId,providerId,serviceDefinitionId,occurredAt]);
  return pg;
}

function booking(id:string,publicId:string,start="2026-10-10T09:00:00.000Z") {
  return {
    id,public_id:publicId,customer_id:customerId,provider_id:providerId,provider_service_id:serviceId,
    request_text:"Build a five-page business website.",requested_start:start,
    requested_end:new Date(Date.parse(start)+120*60_000).toISOString(),timezone:"Africa/Lagos",duration_minutes:120,
    location_mode:"CUSTOMER_LOCATION",state_code:"NG025",lga_code:"NG025011",broad_area:"Ikeja",
    private_address:"12 Private Street",budget_min:"150000",budget_max:"250000",currency:"NGN",
    status:"REQUESTED",version:0,expires_at:new Date(Date.parse(occurredAt)+72*3600_000).toISOString(),linked_job_id:null,hold_expires_at:null,
    created_at:occurredAt,updated_at:occurredAt,
  };
}

const createBooking=(pg:PGlite,record:ReturnType<typeof booking>,requestId:string,hash="a".repeat(64))=>
  pg.query<{value:{booking:Record<string,unknown>;replayed:boolean} }>("SELECT public.tl_create_booking($1::jsonb,$2,$3,$4) AS value",[JSON.stringify(record),customerId,requestId,hash]);

function transaction(bookingId:string,repeatUse:"FIRST"|"PROMPTED"="FIRST") {
  return createAggregate({
    creationId:bookingId,providerId,title:"Business website development",category:"Technology & Digital",
    scope:"Design and build the website.",deliverables:["Responsive website","Deployment"],price:"200000",
    deadline:"2099-11-30",revisions:2,cancellationTerms:"Cancel before work begins.",
    sourceChannel:"TrustLink Marketplace",repeatUse,providerLocation:"Ikeja, Lagos, Nigeria",
  });
}

test("marketplace schema seeds authoritative references and remains browser-default-deny",async()=>{
  const pg=await marketplaceDatabase();
  try {
    assert.deepEqual((await pg.query<{states:number;lgas:number;area_councils:number}>(`SELECT
      (SELECT count(*)::integer FROM public.nigeria_states) AS states,
      (SELECT count(*)::integer FROM public.nigeria_lgas) AS lgas,
      (SELECT count(*)::integer FROM public.nigeria_lgas WHERE kind='AREA_COUNCIL') AS area_councils`)).rows,[{states:37,lgas:774,area_councils:6}]);
    assert.deepEqual((await pg.query<{state:string;units:number}>("SELECT state.name AS state,count(*)::integer AS units FROM public.nigeria_lgas lga JOIN public.nigeria_states state ON state.code=lga.state_code WHERE state.kind='FCT' GROUP BY state.name")).rows,[{state:"Federal Capital Territory",units:6}]);
    const release=(await pg.query<{license:string;source_sha256:string;normalized_sha256:string}>("SELECT license,source_sha256,normalized_sha256 FROM public.reference_data_releases")).rows[0];
    assert.equal(release.license,"CC-BY-4.0");
    assert.equal(release.source_sha256,"334f3dfec7c518b6b0602a2c9d265fb030a0347e4919e5d16e58e76125798f95");
    assert.equal(release.normalized_sha256,"cc9cf5c6977ea68a8ff2c038368bf61d781b83a9cf1813bf7fe9f5bef3e203bb");
    const website=await pg.query<{aliases:string[]}>("SELECT approved_aliases AS aliases FROM public.service_definitions WHERE slug='website-development'");
    assert.ok(website.rows[0].aliases.includes("web developer"));
    assert.equal((await pg.query<{count:number}>("SELECT count(*)::integer AS count FROM public.service_categories WHERE active")).rows[0].count,6);

    const protectedTables=["reference_data_releases","nigeria_states","nigeria_lgas","service_categories","service_definitions","provider_services","provider_service_durations","provider_service_areas","provider_availability_rules","provider_unavailability","marketplace_settings","booking_requests","booking_events","booking_slot_holds"];
    const security=await pg.query<{relname:string;relrowsecurity:boolean;relforcerowsecurity:boolean}>("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace WHERE namespace.nspname='public' AND relname=ANY($1::text[]) ORDER BY relname",[protectedTables]);
    assert.equal(security.rows.length,protectedTables.length);
    assert.ok(security.rows.every(table=>table.relrowsecurity&&table.relforcerowsecurity));
    for (const role of ["anon","authenticated"]) {
      assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege($1,'public.booking_requests','SELECT') AS allowed",[role])).rows[0].allowed,false);
      assert.equal((await pg.query<{allowed:boolean}>("SELECT has_function_privilege($1,'public.tl_create_booking(jsonb,uuid,uuid,text)','EXECUTE') AS allowed",[role])).rows[0].allowed,false);
    }
    assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege('service_role','public.booking_requests','INSERT') AS allowed")).rows[0].allowed,false);
    assert.equal((await pg.query<{allowed:boolean}>("SELECT has_function_privilege('service_role','public.tl_create_booking(jsonb,uuid,uuid,text)','EXECUTE') AS allowed")).rows[0].allowed,true);
  } finally { await pg.close(); }
});

test("database booking commands enforce role isolation, versions, and exact idempotency",async()=>{
  const pg=await marketplaceDatabase();
  try {
    const id="40000000-0000-4000-8000-000000000001",requestId="50000000-0000-4000-8000-000000000001";
    const created=await createBooking(pg,booking(id,"111111111111111111111111"),requestId);
    assert.equal(created.rows[0].value.replayed,false);
    assert.equal((await createBooking(pg,booking(id,"222222222222222222222222"),requestId)).rows[0].value.replayed,true);
    assert.equal((await pg.query<{count:number}>("SELECT count(*)::integer AS count FROM public.booking_events WHERE booking_id=$1",[id])).rows[0].count,1);
    await assert.rejects(createBooking(pg,{...booking(id,"333333333333333333333333"),request_text:"Different"},requestId,"b".repeat(64)),/identifier.*different/i);
    await assert.rejects(pg.query("SELECT public.tl_read_booking($1,$2,'CUSTOMER')",[id,otherCustomerId]),/access/);
    await assert.rejects(pg.query("SELECT public.tl_read_booking($1,$2,'PROVIDER')",[id,otherProviderId]),/access/);
    const providerView=(await pg.query<{value:{private_address:null} }>("SELECT public.tl_read_booking($1,$2,'PROVIDER') AS value",[id,providerId])).rows[0].value;
    assert.equal(providerView.private_address,null);
    const customerView=(await pg.query<{value:{private_address:string} }>("SELECT public.tl_read_booking($1,$2,'CUSTOMER') AS value",[id,customerId])).rows[0].value;
    assert.equal(customerView.private_address,"12 Private Street");
    await assert.rejects(pg.query("SELECT public.tl_transition_booking($1,$2,'PROVIDER','DECLINED',1,$3,$4,$5)",[id,providerId,"50000000-0000-4000-8000-000000000002","c".repeat(64),occurredAt]),/Concurrent change/);
    await assert.rejects(pg.query("SELECT public.tl_transition_booking($1,$2,'CUSTOMER','DECLINED',0,$3,$4,$5)",[id,customerId,"50000000-0000-4000-8000-000000000003","d".repeat(64),occurredAt]),/Illegal or unauthorized/);
    const declined=await pg.query<{value:{booking:{status:string};replayed:boolean} }>("SELECT public.tl_transition_booking($1,$2,'PROVIDER','DECLINED',0,$3,$4,$5) AS value",[id,providerId,"50000000-0000-4000-8000-000000000004","e".repeat(64),occurredAt]);
    assert.equal(declined.rows[0].value.booking.status,"DECLINED");
    assert.equal((await pg.query<{value:{replayed:boolean} }>("SELECT public.tl_transition_booking($1,$2,'PROVIDER','DECLINED',0,$3,$4,$5) AS value",[id,providerId,"50000000-0000-4000-8000-000000000004","e".repeat(64),occurredAt])).rows[0].value.replayed,true);
  } finally { await pg.close(); }
});

test("database conversion is atomic, capacity-safe, retry-safe, and linked to canonical acceptance",async()=>{
  const pg=await marketplaceDatabase();
  try {
    const id="40000000-0000-4000-8000-000000000010",requestId="50000000-0000-4000-8000-000000000010",conversionId="60000000-0000-4000-8000-000000000010";
    await createBooking(pg,booking(id,"aaaaaaaaaaaaaaaaaaaaaaaa"),requestId);
    const created=transaction(id),convert=()=>pg.query<{value:{booking:{status:string;linked_job_id:string};replayed:boolean} }>("SELECT public.tl_convert_booking($1,$2,0,$3,$4,$5::jsonb,$6) AS value",[id,providerId,conversionId,"f".repeat(64),JSON.stringify(created.aggregate),occurredAt]);
    const converted=await convert();
    assert.deepEqual(converted.rows[0].value,{booking:{...converted.rows[0].value.booking,status:"TERMS_SENT",linked_job_id:id},replayed:false});
    assert.equal((await convert()).rows[0].value.replayed,true);
    assert.equal((await pg.query<{count:number}>("SELECT count(*)::integer AS count FROM public.jobs WHERE id=$1",[id])).rows[0].count,1);
    assert.deepEqual((await pg.query<{event_type:string}>("SELECT event_type FROM public.booking_events WHERE booking_id=$1 ORDER BY event_sequence",[id])).rows.map(row=>row.event_type),["REQUEST_CREATED","TERMS_SENT","SLOT_HOLD_CREATED"]);
    await assert.rejects(pg.query("SELECT public.tl_convert_booking($1,$2,0,$3,$4,$5::jsonb,$6)",[id,providerId,"60000000-0000-4000-8000-000000000011","0".repeat(64),JSON.stringify(created.aggregate),occurredAt]),/Only a requested booking/);

    const accepted=acceptAggregate(created.aggregate,created.token,{name:"Customer One",email:"customer@example.test"});
    await pg.query("SELECT public.tl_commit_job($1::jsonb,0)",[JSON.stringify(accepted)]);
    assert.deepEqual((await pg.query<{status:string;hold_expires_at:string|null}>("SELECT status,hold_expires_at FROM public.booking_requests WHERE id=$1",[id])).rows,[{status:"CONFIRMED",hold_expires_at:null}]);
    assert.equal((await pg.query<{status:string}>("SELECT status FROM public.booking_slot_holds WHERE booking_id=$1",[id])).rows[0].status,"CONFIRMED");

    const overlapId="40000000-0000-4000-8000-000000000011";
    await createBooking(pg,booking(overlapId,"bbbbbbbbbbbbbbbbbbbbbbbb"),"50000000-0000-4000-8000-000000000011");
    const overlapTransaction=transaction(overlapId,"PROMPTED");
    await assert.rejects(pg.query("SELECT public.tl_convert_booking($1,$2,0,$3,$4,$5::jsonb,$6)",[overlapId,providerId,"60000000-0000-4000-8000-000000000012","1".repeat(64),JSON.stringify(overlapTransaction.aggregate),occurredAt]),/slot.*available/i);
    assert.equal((await pg.query<{count:number}>("SELECT count(*)::integer AS count FROM public.jobs WHERE id=$1",[overlapId])).rows[0].count,0);

    const rollbackId="40000000-0000-4000-8000-000000000012";
    await createBooking(pg,booking(rollbackId,"cccccccccccccccccccccccc","2026-10-11T09:00:00.000Z"),"50000000-0000-4000-8000-000000000012");
    await pg.query(`INSERT INTO public.booking_slot_holds(booking_id,provider_id,starts_at,ends_at,status,expires_at,created_at,updated_at,released_at)
      VALUES ($1,$2,'2026-10-11T09:00:00Z','2026-10-11T11:00:00Z','RELEASED',NULL,$3,$3,$3)`,[rollbackId,providerId,occurredAt]);
    const rollbackTransaction=transaction(rollbackId,"PROMPTED");
    await assert.rejects(pg.query("SELECT public.tl_convert_booking($1,$2,0,$3,$4,$5::jsonb,$6)",[rollbackId,providerId,"60000000-0000-4000-8000-000000000013","2".repeat(64),JSON.stringify(rollbackTransaction.aggregate),occurredAt]),/unique|duplicate/i);
    assert.equal((await pg.query<{count:number}>("SELECT count(*)::integer AS count FROM public.jobs WHERE id=$1",[rollbackId])).rows[0].count,0);
    assert.equal((await pg.query<{status:string}>("SELECT status FROM public.booking_requests WHERE id=$1",[rollbackId])).rows[0].status,"REQUESTED");
    assert.deepEqual((await pg.query<{event_type:string}>("SELECT event_type FROM public.booking_events WHERE booking_id=$1 ORDER BY event_sequence",[rollbackId])).rows.map(row=>row.event_type),["REQUEST_CREATED"]);

    const expiryId="40000000-0000-4000-8000-000000000013";
    await createBooking(pg,booking(expiryId,"dddddddddddddddddddddddd","2026-10-12T09:00:00.000Z"),"50000000-0000-4000-8000-000000000013");
    const expiryTransaction=transaction(expiryId,"PROMPTED");
    await pg.query("SELECT public.tl_convert_booking($1,$2,0,$3,$4,$5::jsonb,$6)",[expiryId,providerId,"60000000-0000-4000-8000-000000000014","3".repeat(64),JSON.stringify(expiryTransaction.aggregate),occurredAt]);
    assert.equal((await pg.query<{value:number}>("SELECT public.tl_expire_bookings($1) AS value",[new Date(Date.parse(occurredAt) + 25 * 3600_000).toISOString()])).rows[0].value,1);
    assert.equal((await pg.query<{status:string}>("SELECT status FROM public.booking_slot_holds WHERE booking_id=$1",[expiryId])).rows[0].status,"EXPIRED");
    const lateAcceptance=acceptAggregate(expiryTransaction.aggregate,expiryTransaction.token,{name:"Customer One",email:"late@example.test"});
    await assert.rejects(pg.query("SELECT public.tl_commit_job($1::jsonb,0)",[JSON.stringify(lateAcceptance)]),/hold is no longer active/);
    assert.equal((await pg.query<{status:string}>("SELECT status FROM public.jobs WHERE id=$1",[expiryId])).rows[0].status,"SENT");
  } finally { await pg.close(); }
});
