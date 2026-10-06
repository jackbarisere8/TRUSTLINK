import assert from "node:assert/strict";
import test from "node:test";
import { readFile,readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const providerId="11111111-1111-4111-8111-111111111111";
const otherProviderId="22222222-2222-4222-8222-222222222222";
const categoryId="10000000-0000-4000-8000-000000000001";
const definitionId="20000000-0000-4000-8000-000000000001";

async function database(){
  const pg=new PGlite();
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb);
    CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS 'SELECT gen_random_uuid()';`);
  const migrations=(await readdir("supabase/migrations")).filter(file=>file.endsWith(".sql")).sort();
  for(const migration of migrations){let sql=await readFile(`supabase/migrations/${migration}`,"utf8");if(migration==="20260917000000_v0_core.sql")sql=sql.replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',"");await pg.exec(sql);}
  for(const [id,name] of [[providerId,"Discovery Provider"],[otherProviderId,"Unpublished Provider"]]){await pg.query("INSERT INTO auth.users VALUES ($1,$2)",[id,{display_name:name}]);await pg.query("SELECT public.tl_enable_provider($1,$2::jsonb)",[id,JSON.stringify({headline:"Experienced website professional",serviceArea:"Lagos"})]);}
  await pg.query("UPDATE public.profiles SET username=CASE WHEN user_id=$1 THEN 'discovery-provider' ELSE 'unpublished-provider' END WHERE user_id IN ($1,$2)",[providerId,otherProviderId]);
  return pg;
}
function service(title="Business website development",radius=5){return {categoryId,serviceDefinitionId:definitionId,publicTitle:title,description:"Responsive website design and development for established small businesses.",pricingModel:"STARTING_AT",priceMin:"50000",priceMax:"150000",supportsRemote:true,supportsOnsite:true,status:"PUBLISHED",durationMinutes:[60,120],areas:[{remoteService:true},{remoteService:false,stateCode:"NG025",lgaCode:"NG025011",approximateOrigin:"Ikeja area",radiusKm:radius}]};}
async function createService(pg:PGlite,owner=providerId,title?:string,radius?:number){return (await pg.query<{value:{id:string} }>("SELECT public.tl_upsert_provider_service($1,null,$2::jsonb) AS value",[owner,JSON.stringify(service(title,radius))])).rows[0].value.id;}
async function search(pg:PGlite,input:Record<string,unknown>){return (await pg.query<{value:{items:Array<Record<string,unknown>>;total:number;page:number;pageSize:number;pageCount:number}}>("SELECT public.tl_search_marketplace_services($1::jsonb) AS value",[JSON.stringify(input)])).rows[0].value;}

test("search exposes only active published providers and applies text, location, remote and date filters",async()=>{
  const pg=await database();
  try{
    const serviceId=await createService(pg);
    await createService(pg,otherProviderId,"Hidden website service");
    await pg.query("SELECT public.tl_replace_provider_availability($1,$2::jsonb)",[providerId,JSON.stringify([{providerServiceId:serviceId,dayOfWeek:1,localStart:"09:00",localEnd:"17:00",timezone:"Africa/Lagos"}])]);
    await pg.query("SELECT public.tl_set_provider_publication($1,true)",[providerId]);
    const result=await search(pg,{q:"website",category:"technology-digital",state:"NG025",lga:"NG025011",remote:true,date:"2026-10-05",sort:"best",page:1,pageSize:12});
    assert.equal(result.total,1);assert.equal(result.items[0].serviceId,serviceId);assert.equal(result.items[0].availableOnRequestedDate,true);
    assert.equal((await search(pg,{state:"NG015",sort:"best",page:1,pageSize:12})).total,0);
    assert.equal((await search(pg,{q:"web developer",sort:"best",page:1,pageSize:12})).total,1);
    const serialized=JSON.stringify(result);
    for(const forbidden of ["origin_latitude","origin_longitude","private_address","blackout","latitude","longitude"])assert.equal(serialized.includes(forbidden),false);
    await pg.query("UPDATE public.provider_services SET status='DRAFT' WHERE id=$1",[serviceId]);
    assert.equal((await search(pg,{sort:"best",page:1,pageSize:12})).total,0);
  }finally{await pg.close();}
});

test("nearby search respects visitor and provider radii and returns only rounded distance",async()=>{
  const pg=await database();
  try{
    const serviceId=await createService(pg,providerId,undefined,5);
    await pg.query("SELECT public.tl_set_provider_publication($1,true)",[providerId]);
    await pg.query("SELECT public.tl_set_provider_service_origin($1,$2,$3,$4)",[providerId,serviceId,6.6018,3.3515]);
    const near=await search(pg,{sort:"nearest",page:1,pageSize:12,latitude:6.61,longitude:3.3515,radiusKm:5});
    assert.equal(near.total,1);assert.equal(typeof near.items[0].distanceKm,"number");
    assert.equal((await search(pg,{sort:"nearest",page:1,pageSize:12,latitude:6.66,longitude:3.3515,radiusKm:50})).total,0);
    await pg.query("SELECT public.tl_set_provider_service_origin($1,$2,null,null)",[providerId,serviceId]);
    assert.equal((await search(pg,{sort:"nearest",page:1,pageSize:12,latitude:6.6018,longitude:3.3515,radiusKm:5})).total,0);
  }finally{await pg.close();}
});

test("search pagination is stable and both Phase 6 RPCs are service-role only",async()=>{
  const pg=await database();
  try{
    await createService(pg,providerId,"Alpha website");await createService(pg,providerId,"Beta website");
    await pg.query("SELECT public.tl_set_provider_publication($1,true)",[providerId]);
    const first=await search(pg,{sort:"best",page:1,pageSize:1}),second=await search(pg,{sort:"best",page:2,pageSize:1});
    assert.equal(first.total,2);assert.equal(first.pageCount,2);assert.notEqual(first.items[0].serviceId,second.items[0].serviceId);
    for(const signature of ["public.tl_search_marketplace_services(jsonb)","public.tl_set_provider_service_origin(uuid,uuid,numeric,numeric)"]){
      for(const role of ["anon","authenticated"])assert.equal((await pg.query<{allowed:boolean}>("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed",[role,signature])).rows[0].allowed,false);
      assert.equal((await pg.query<{allowed:boolean}>("SELECT has_function_privilege('service_role',$1,'EXECUTE') AS allowed",[signature])).rows[0].allowed,true);
    }
  }finally{await pg.close();}
});
