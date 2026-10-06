import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const providerId="11111111-1111-4111-8111-111111111111";
const otherProviderId="22222222-2222-4222-8222-222222222222";
const categoryId="10000000-0000-4000-8000-000000000001";
const definitionId="20000000-0000-4000-8000-000000000001";

async function database() {
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
  for (const [id,name] of [[providerId,"Marketplace Provider"],[otherProviderId,"Other Provider"]]) {
    await pg.query("INSERT INTO auth.users VALUES ($1,$2)",[id,{display_name:name}]);
    await pg.query("SELECT public.tl_enable_provider($1,$2::jsonb)",[id,JSON.stringify({headline:"Experienced professional",serviceArea:"Lagos"})]);
  }
  await pg.query("UPDATE public.profiles SET username=CASE WHEN user_id=$1 THEN 'marketplace-provider' ELSE 'other-provider' END WHERE user_id IN ($1,$2)",[providerId,otherProviderId]);
  return pg;
}

function service(overrides:Record<string,unknown>={}) {return {categoryId,serviceDefinitionId:definitionId,publicTitle:"Business website development",description:"Design and development of a complete responsive business website.",pricingModel:"STARTING_AT",priceMin:"50000",priceMax:"150000",supportsRemote:true,supportsOnsite:true,status:"PUBLISHED",durationMinutes:[60,120],areas:[{remoteService:true},{remoteService:false,stateCode:"NG025",lgaCode:"NG025011",approximateOrigin:"Ikeja area",radiusKm:25}],...overrides};}

async function upsert(pg:PGlite,owner=providerId,id:string|null=null,input=service()) {
  return pg.query<{value:{id:string}}>("SELECT public.tl_upsert_provider_service($1,$2,$3::jsonb) AS value",[owner,id,JSON.stringify(input)]);
}

test("provider service RPCs enforce ownership and canonical category, price, and location rules",async()=>{
  const pg=await database();
  try {
    const created=await upsert(pg),id=created.rows[0].value.id;
    await assert.rejects(upsert(pg,otherProviderId,id),/not owned/i);
    await assert.rejects(pg.query("SELECT public.tl_archive_provider_service($1,$2)",[otherProviderId,id]),/not owned/i);
    await assert.rejects(upsert(pg,providerId,null,service({categoryId:"10000000-0000-4000-8000-000000000002"})),/approved service/i);
    await assert.rejects(upsert(pg,providerId,null,service({pricingModel:"QUOTE_REQUIRED",priceMin:"50000",priceMax:null})),/Prices do not match/i);
    await assert.rejects(upsert(pg,providerId,null,service({areas:[{remoteService:true},{remoteService:false,stateCode:"NG001",lgaCode:"NG025011"}]})),/does not belong/i);
    await assert.rejects(upsert(pg,providerId,null,service({areas:[{remoteService:true},{remoteService:false,stateCode:"NG025",approximateOrigin:"Ikeja",radiusKm:0}]})),/radius/i);
    assert.deepEqual((await pg.query<{duration_minutes:number}>("SELECT duration_minutes FROM public.provider_service_durations WHERE provider_service_id=$1 ORDER BY duration_minutes",[id])).rows,[{duration_minutes:60},{duration_minutes:120}]);
  } finally { await pg.close(); }
});

test("publication gate and redacted public projection exclude every unpublished state",async()=>{
  const pg=await database();
  try {
    const draft=(await upsert(pg,providerId,null,service({status:"DRAFT"}))).rows[0].value.id;
    assert.equal((await pg.query<{count:number}>("SELECT count(*)::integer AS count FROM public.public_marketplace_services")).rows[0].count,0);
    await assert.rejects(pg.query("SELECT public.tl_set_provider_publication($1,true)",[providerId]),/Publish at least one/i);
    const active=(await upsert(pg)).rows[0].value.id;
    assert.equal((await pg.query<{count:number}>("SELECT count(*)::integer AS count FROM public.public_marketplace_services")).rows[0].count,0);
    await pg.query("SELECT public.tl_set_provider_publication($1,true)",[providerId]);
    const publicRows=(await pg.query<{service_id:string;service_areas:Array<Record<string,unknown>>}>("SELECT service_id,service_areas FROM public.public_marketplace_services")).rows;
    assert.deepEqual(publicRows.map(row=>row.service_id),[active]);
    const serialized=JSON.stringify(publicRows);
    for (const forbidden of ["latitude","longitude","privateAddress","private_address","reason"]) assert.equal(serialized.includes(forbidden),false);
    assert.ok(serialized.includes("Ikeja area"));
    const columns=(await pg.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='public_marketplace_services'")).rows.map(row=>row.column_name);
    for (const forbidden of ["email","private_address","latitude","longitude","blackout_reason"]) assert.equal(columns.includes(forbidden),false);
    await pg.query("SELECT public.tl_set_provider_publication($1,false)",[providerId]);
    assert.equal((await pg.query<{count:number}>("SELECT count(*)::integer AS count FROM public.public_marketplace_services")).rows[0].count,0);
    await pg.query("SELECT public.tl_set_provider_publication($1,true)",[providerId]);
    await pg.query("SELECT public.tl_archive_provider_service($1,$2)",[providerId,active]);
    assert.deepEqual((await pg.query<{marketplace_status:string}>("SELECT marketplace_status FROM public.provider_profiles WHERE user_id=$1",[providerId])).rows,[{marketplace_status:"DRAFT"}]);
    assert.equal((await pg.query<{count:number}>("SELECT count(*)::integer AS count FROM public.public_marketplace_services")).rows[0].count,0);
    assert.equal((await pg.query<{status:string}>("SELECT status FROM public.provider_services WHERE id=$1",[draft])).rows[0].status,"DRAFT");
  } finally { await pg.close(); }
});

test("availability and blackout RPCs reject overlap, invalid time, and cross-provider deletion atomically",async()=>{
  const pg=await database();
  try {
    const id=(await upsert(pg)).rows[0].value.id;
    const initial=[{dayOfWeek:1,localStart:"09:00",localEnd:"12:00",timezone:"Africa/Lagos"}];
    await pg.query("SELECT public.tl_replace_provider_availability($1,$2::jsonb)",[providerId,JSON.stringify(initial)]);
    await assert.rejects(pg.query("SELECT public.tl_replace_provider_availability($1,$2::jsonb)",[providerId,JSON.stringify([...initial,{dayOfWeek:1,localStart:"11:00",localEnd:"14:00",timezone:"Africa/Lagos"}])]),/cannot overlap/i);
    assert.equal((await pg.query<{count:number}>("SELECT count(*)::integer AS count FROM public.provider_availability_rules WHERE provider_id=$1",[providerId])).rows[0].count,1);
    await assert.rejects(pg.query("SELECT public.tl_replace_provider_availability($1,$2::jsonb)",[providerId,JSON.stringify([{dayOfWeek:2,localStart:"12:00",localEnd:"09:00",timezone:"Africa/Lagos"}])]),/Invalid availability/i);
    await assert.rejects(pg.query("SELECT public.tl_replace_provider_availability($1,$2::jsonb)",[providerId,JSON.stringify([{providerServiceId:id,dayOfWeek:9,localStart:"09:00",localEnd:"12:00",timezone:"Africa/Lagos"}])]),/Invalid availability/i);

    const first=(await pg.query<{value:{id:string}}>("SELECT public.tl_add_provider_blackout($1,$2::jsonb) AS value",[providerId,JSON.stringify({startsAt:"2026-10-10T09:00:00+01:00",endsAt:"2026-10-10T11:00:00+01:00",reason:"Private leave note"})])).rows[0].value;
    await assert.rejects(pg.query("SELECT public.tl_add_provider_blackout($1,$2::jsonb)",[providerId,JSON.stringify({startsAt:"2026-10-10T10:00:00+01:00",endsAt:"2026-10-10T12:00:00+01:00"})]),/cannot overlap/i);
    await assert.rejects(pg.query("SELECT public.tl_delete_provider_blackout($1,$2)",[otherProviderId,first.id]),/not owned/i);
    assert.equal((await pg.query<{count:number}>("SELECT count(*)::integer AS count FROM public.provider_unavailability WHERE id=$1",[first.id])).rows[0].count,1);
  } finally { await pg.close(); }
});

test("Phase 5 mutation functions and public projection remain server-only",async()=>{
  const pg=await database();
  try {
    const signatures=["public.tl_upsert_provider_service(uuid,uuid,jsonb)","public.tl_archive_provider_service(uuid,uuid)","public.tl_replace_provider_availability(uuid,jsonb)","public.tl_add_provider_blackout(uuid,jsonb)","public.tl_delete_provider_blackout(uuid,uuid)","public.tl_set_provider_publication(uuid,boolean)"];
    for (const signature of signatures) for (const role of ["anon","authenticated"]) assert.equal((await pg.query<{allowed:boolean}>("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed",[role,signature])).rows[0].allowed,false);
    for (const signature of signatures) assert.equal((await pg.query<{allowed:boolean}>("SELECT has_function_privilege('service_role',$1,'EXECUTE') AS allowed",[signature])).rows[0].allowed,true);
    for (const role of ["anon","authenticated"]) assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege($1,'public.public_marketplace_services','SELECT') AS allowed",[role])).rows[0].allowed,false);
    assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege('service_role','public.public_marketplace_services','SELECT') AS allowed")).rows[0].allowed,true);
    assert.equal((await pg.query<{allowed:boolean}>("SELECT has_table_privilege('service_role','public.provider_services','UPDATE') AS allowed")).rows[0].allowed,false);
  } finally { await pg.close(); }
});
