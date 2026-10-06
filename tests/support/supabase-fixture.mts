// Test-only HTTP stand-in for Supabase Auth/Storage/PostgREST.
// PostgreSQL is real PGlite. Never run this fixture as application infrastructure.
import http from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
if (process.env.TRUSTLINK_TEST_FIXTURE !== "1" || process.env.NODE_ENV === "production") {
 throw new Error("DEV ONLY: set TRUSTLINK_TEST_FIXTURE=1 in a non-production automated test process.");
}
const pg=new PGlite();
type FixtureUser={id:string;email:string;name:string;role:"CUSTOMER"|"PROVIDER"|"ADMIN";userMetadataRole?:string};
const users:FixtureUser[]=[
 {id:"11111111-1111-4111-8111-111111111111",email:"provider@example.test",name:"Ada Provider",role:"PROVIDER"},
 {id:"22222222-2222-4222-8222-222222222222",email:"other@example.test",name:"Other Provider",role:"PROVIDER"},
 {id:"33333333-3333-4333-8333-333333333333",email:"admin@example.test",name:"Test Admin",role:"ADMIN"},
 {id:"44444444-4444-4444-8444-444444444444",email:"metadata-admin@example.test",name:"Metadata Spoof",role:"PROVIDER",userMetadataRole:"ADMIN"},
 {id:"66666666-6666-4666-8666-666666666666",email:"marketplace@example.test",name:"Marketplace Provider",role:"PROVIDER"},
 {id:"77777777-7777-4777-8777-777777777777",email:"discovery@example.test",name:"Discovery Studio",role:"PROVIDER"},
];
const sessions=new Map<string,typeof users[number]>();
const passwords=new Map(users.map(user=>[user.id,"fixture-password-only"]));
const files=new Map<string,Buffer>();
const signatures=new Map<string,{path:string;expires:number}>();
const serviceKey="test-service-role-nonfunctional";
await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb);
CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS 'SELECT gen_random_uuid()';`);
await pg.exec((await readFile("supabase/migrations/20260917000000_v0_core.sql","utf8")).replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',""));
await pg.exec(await readFile("supabase/migrations/20260920000000_integrity.sql","utf8"));
 await pg.exec(await readFile("supabase/migrations/20260920000001_final_audit.sql","utf8"));
 await pg.exec(await readFile("supabase/migrations/20260921000000_database_model.sql","utf8"));
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
await pg.exec(await readFile("supabase/migrations/20261005000000_marketplace_booking_foundation.sql","utf8"));
await pg.exec(await readFile("supabase/migrations/20261005000001_nigeria_admin_seed.sql","utf8"));
for(const u of users)await pg.query("INSERT INTO auth.users VALUES ($1,$2)",[u.id,{display_name:u.name}]);
await pg.exec(await readFile("supabase/migrations/20261005000002_unified_accounts.sql","utf8"));
await pg.exec(await readFile("supabase/migrations/20261005000003_provider_services_availability.sql","utf8"));
await pg.exec(await readFile("supabase/migrations/20261005000004_provider_search.sql","utf8"));
const discoveryProviderId="77777777-7777-4777-8777-777777777777";
await pg.query("SELECT public.tl_enable_provider($1,$2::jsonb)",[discoveryProviderId,JSON.stringify({businessName:"Discovery Studio",headline:"Websites for growing Nigerian businesses",bio:"A Lagos-based digital studio.",serviceArea:"Ikeja, Lagos"})]);
await pg.query("UPDATE public.profiles SET username='discovery-studio' WHERE user_id=$1",[discoveryProviderId]);
const discoveryService=(await pg.query<{value:{id:string}}>("SELECT public.tl_upsert_provider_service($1,null,$2::jsonb) AS value",[discoveryProviderId,JSON.stringify({categoryId:"10000000-0000-4000-8000-000000000001",serviceDefinitionId:"20000000-0000-4000-8000-000000000001",publicTitle:"Business website development",description:"Responsive website design and development for growing Nigerian businesses.",pricingModel:"STARTING_AT",priceMin:"85000",priceMax:"250000",supportsRemote:true,supportsOnsite:true,status:"PUBLISHED",durationMinutes:[60,120],areas:[{remoteService:true},{remoteService:false,stateCode:"NG025",lgaCode:"NG025011",approximateOrigin:"Ikeja area",radiusKm:25}]})])).rows[0].value.id;
await pg.query("SELECT public.tl_replace_provider_availability($1,$2::jsonb)",[discoveryProviderId,JSON.stringify([{providerServiceId:discoveryService,dayOfWeek:1,localStart:"09:00",localEnd:"17:00",timezone:"Africa/Lagos"}])]);
await pg.query("SELECT public.tl_set_provider_publication($1,true)",[discoveryProviderId]);
await pg.query("SELECT public.tl_set_provider_service_origin($1,$2,$3,$4)",[discoveryProviderId,discoveryService,6.6018,3.3515]);
function authUser(u:FixtureUser) {return {id:u.id,email:u.email,aud:"authenticated",role:"authenticated",app_metadata:{role:u.role},user_metadata:{display_name:u.name,role:u.userMetadataRole},created_at:new Date().toISOString()};}
function session(u:FixtureUser) {
 const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const now=Math.floor(Date.now()/1000);
 const token=encode({alg:"HS256",typ:"JWT"})+"."+encode({sub:u.id,exp:now+3600,iat:now,aud:"authenticated",role:"authenticated"})+".fixture-not-a-real-signature";
 sessions.set(token,u);
 return {access_token:token,refresh_token:"fixture-refresh-"+u.id,token_type:"bearer",expires_in:3600,expires_at:now+3600,user:authUser(u)};
}
const allowedTables=["profiles","provider_profiles","jobs","job_terms","job_participants","payments","deliveries","revisions","disputes","reviews","trust_events","evidence_files","notification_intents","public_job_records","public_transaction_events","public_marketplace_services","reference_data_releases","nigeria_states","nigeria_lgas","service_categories","service_definitions","provider_services","provider_service_durations","provider_service_areas","provider_availability_rules","provider_unavailability","marketplace_settings","booking_requests","booking_events","booking_slot_holds"];
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url!,"http://127.0.0.1:54329");
 const send=(status:number,data:unknown)=>{res.writeHead(status,{"Content-Type":"application/json"});res.end(JSON.stringify(data));};
 const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks);
 const json=()=>body.length?JSON.parse(body.toString()):{};
 try {
  if(url.pathname==="/health")return send(200,{ok:true});
  if(url.pathname==="/auth/v1/token"){
    const input=json();
    const u=users.find(u=>url.searchParams.get("grant_type")==="refresh_token"?input.refresh_token==="fixture-refresh-"+u.id:u.email===input.email);
    if(!u||(url.searchParams.get("grant_type")!=="refresh_token"&&input.password!==passwords.get(u.id)))return send(400,{error:"invalid_grant",error_description:"Invalid login credentials"});
    return send(200,session(u));
  }
  if(url.pathname==="/auth/v1/signup"&&req.method==="POST"){
    const input=json() as {email?:string;password?:string;data?:{display_name?:string}};
    const email=typeof input.email==="string"?input.email.trim().toLowerCase():"";
    const name=typeof input.data?.display_name==="string"?input.data.display_name.trim():"";
    if(!email||!name||typeof input.password!=="string"||input.password.length<8)return send(422,{message:"Invalid signup details"});
    if(users.some(user=>user.email===email))return send(422,{message:"User already registered"});
    const u:FixtureUser={id:randomUUID(),email,name,role:"CUSTOMER"};
    users.push(u);passwords.set(u.id,input.password);
    await pg.query("INSERT INTO auth.users VALUES ($1,$2)",[u.id,{display_name:name}]);
    return send(200,session(u));
  }
  if(url.pathname==="/auth/v1/recover"&&req.method==="POST"){
    json();
    return send(200,{});
  }
  if(url.pathname==="/auth/v1/verify"&&req.method==="POST"){
    const input=json();
    const u=users[0];
    if(input.type!=="recovery"||input.token_hash!=="fixture-recovery-token")return send(403,{error:"otp_expired",error_description:"Token is invalid or expired"});
    return send(200,session(u));
  }
  if(url.pathname==="/auth/v1/user"){
    const u=sessions.get(req.headers.authorization?.replace("Bearer ","")||"");
    if(u&&req.method==="PUT"){
      const input=json();
      if(typeof input.password!=="string"||input.password.length<8)return send(422,{message:"Password is too short"});
      passwords.set(u.id,input.password);
      return send(200,authUser(u));
    }
    return u?send(200,authUser(u)):send(401,{message:"Invalid token"});
  }
  if(url.pathname==="/auth/v1/logout"){sessions.delete(req.headers.authorization?.replace("Bearer ","")||"");res.writeHead(204);return res.end();}
  if(url.pathname.startsWith("/storage/v1/object/sign/")&&req.method==="GET"){
    const signed=signatures.get(url.searchParams.get("token")||"");
    if(!signed||signed.expires<Date.now())return send(403,{error:"Expired"});
    const content=files.get(signed.path);
    res.writeHead(200,{"Content-Type":"application/pdf","Content-Disposition":"attachment; filename=evidence.pdf"});return res.end(content);
  }
  if(req.headers.authorization!=="Bearer "+serviceKey)return send(403,{message:"Server access only",code:"42501"});
  if(url.pathname.startsWith("/rest/v1/rpc/")){
    const name=url.pathname.split("/").at(-1),input=json();
    let result;
    if(name==="tl_read_job")result=await pg.query("SELECT public.tl_read_job($1,$2) AS value",[input.p_id,input.p_public]);
    else if(name==="tl_commit_job")result=await pg.query("SELECT public.tl_commit_job($1,$2) AS value",[JSON.stringify(input.p_record),input.p_expected_version]);
    else if(name==="tl_update_profile")result=await pg.query("SELECT public.tl_update_profile($1,$2) AS value",[input.p_user_id,input.p_input]);
    else if(name==="tl_update_account_profile")result=await pg.query("SELECT public.tl_update_account_profile($1,$2) AS value",[input.p_user_id,input.p_input]);
    else if(name==="tl_enable_provider")result=await pg.query("SELECT public.tl_enable_provider($1,$2) AS value",[input.p_user_id,input.p_input]);
    else if(name==="tl_create_booking")result=await pg.query("SELECT public.tl_create_booking($1,$2,$3,$4) AS value",[JSON.stringify(input.p_record),input.p_actor_id,input.p_request_id,input.p_command_hash]);
    else if(name==="tl_read_booking")result=await pg.query("SELECT public.tl_read_booking($1,$2,$3) AS value",[input.p_booking_id,input.p_actor_id,input.p_actor_type]);
    else if(name==="tl_list_bookings")result=await pg.query("SELECT public.tl_list_bookings($1,$2) AS value",[input.p_actor_id,input.p_actor_type]);
    else if(name==="tl_transition_booking")result=await pg.query("SELECT public.tl_transition_booking($1,$2,$3,$4,$5,$6,$7,$8) AS value",[input.p_booking_id,input.p_actor_id,input.p_actor_type,input.p_next_status,input.p_expected_version,input.p_request_id,input.p_command_hash,input.p_occurred_at]);
    else if(name==="tl_convert_booking")result=await pg.query("SELECT public.tl_convert_booking($1,$2,$3,$4,$5,$6,$7) AS value",[input.p_booking_id,input.p_provider_id,input.p_expected_version,input.p_request_id,input.p_command_hash,JSON.stringify(input.p_job_record),input.p_occurred_at]);
    else if(name==="tl_expire_bookings")result=await pg.query("SELECT public.tl_expire_bookings($1) AS value",[input.p_now]);
    else if(name==="tl_upsert_provider_service")result=await pg.query("SELECT public.tl_upsert_provider_service($1,$2,$3) AS value",[input.p_provider_id,input.p_service_id,input.p_input]);
    else if(name==="tl_archive_provider_service")result=await pg.query("SELECT public.tl_archive_provider_service($1,$2) AS value",[input.p_provider_id,input.p_service_id]);
    else if(name==="tl_replace_provider_availability")result=await pg.query("SELECT public.tl_replace_provider_availability($1,$2) AS value",[input.p_provider_id,input.p_rules]);
    else if(name==="tl_add_provider_blackout")result=await pg.query("SELECT public.tl_add_provider_blackout($1,$2) AS value",[input.p_provider_id,input.p_input]);
    else if(name==="tl_delete_provider_blackout")result=await pg.query("SELECT public.tl_delete_provider_blackout($1,$2) AS value",[input.p_provider_id,input.p_blackout_id]);
    else if(name==="tl_set_provider_publication")result=await pg.query("SELECT public.tl_set_provider_publication($1,$2) AS value",[input.p_provider_id,input.p_publish]);
    else if(name==="tl_set_provider_service_origin")result=await pg.query("SELECT public.tl_set_provider_service_origin($1,$2,$3,$4) AS value",[input.p_provider_id,input.p_service_id,input.p_latitude,input.p_longitude]);
    else if(name==="tl_search_marketplace_services")result=await pg.query("SELECT public.tl_search_marketplace_services($1) AS value",[input.p_input]);
    else return send(404,{message:"RPC not found"});
    return send(200,(result.rows[0] as {value:unknown}).value);
  }
  if(url.pathname.startsWith("/rest/v1/")){
    const table=url.pathname.split("/").at(-1)!;if(!allowedTables.includes(table))return send(404,{});
    const input=json();
    if(req.method==="POST"){
      const keys=Object.keys(input);if(keys.some(k=>!/^\w+$/.test(k)))return send(400,{});
      await pg.query("INSERT INTO public."+table+" ("+keys.join(",")+") VALUES ("+keys.map((_,i)=>"$"+(i+1)).join(",")+")",Object.values(input));
      return send(201,null);
    }
    const clauses:string[]=[],values:unknown[]=[];
    for(const [key,value]of url.searchParams){if(["select","order","limit"].includes(key))continue;if(!/^\w+$/.test(key))return send(400,{});
      if(value.startsWith("eq.")){values.push(value.slice(3));clauses.push(key+"=$"+values.length);}
      else if(value.startsWith("in.(")){const entries=value.slice(4,-1).split(",").map(v=>v.replaceAll('"',""));const vars=entries.map(v=>{values.push(v);return "$"+values.length;});clauses.push(key+" IN ("+vars.join(",")+")");}
    }
    if(req.method==="DELETE"){
      const rows=await pg.query("DELETE FROM public."+table+(clauses.length?" WHERE "+clauses.join(" AND "):"")+" RETURNING *",values);
      return send(200,rows.rows);
    }
    const rows=await pg.query("SELECT * FROM public."+table+(clauses.length?" WHERE "+clauses.join(" AND "):""),values);
    return send(200,req.headers.accept?.includes("vnd.pgrst.object")?rows.rows[0]||null:rows.rows);
  }
  if(url.pathname.startsWith("/storage/v1/object/sign/")&&req.method==="POST"){
    const path=url.pathname.replace("/storage/v1/object/sign/","");
    const token=randomUUID();signatures.set(token,{path,expires:Date.now()+60000});
    return send(200,{signedURL:"/object/sign/"+path+"?token="+token});
  }
  if(url.pathname.startsWith("/storage/v1/object/")&&req.method==="POST"){
    const path=url.pathname.replace("/storage/v1/object/","");files.set(path,body);return send(200,{Key:path});
  }
  if(url.pathname==="/storage/v1/object/transaction-evidence"&&req.method==="DELETE"){
    const input=json() as {prefixes?:string[]};
    for(const path of input.prefixes || [])files.delete("transaction-evidence/"+path);
    return send(200,{message:"Successfully deleted"});
  }
  return send(404,{message:"Not implemented by test fixture"});
 }catch(error){const e=error as {message:string;code?:string};return send(400,{message:e.message,code:e.code});}
});
server.listen(54329,"127.0.0.1",()=>process.stdout.write("Test fixture ready on 54329\n"));
