// Test-only HTTP stand-in for Supabase Auth/Storage/PostgREST.
// PostgreSQL is real PGlite. Never run this fixture as application infrastructure.
import http from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const pg=new PGlite();
const users=[
 {id:"11111111-1111-4111-8111-111111111111",email:"provider@example.test",name:"Ada Provider",role:"PROVIDER"},
 {id:"22222222-2222-4222-8222-222222222222",email:"other@example.test",name:"Other Provider",role:"PROVIDER"},
 {id:"33333333-3333-4333-8333-333333333333",email:"admin@example.test",name:"Test Admin",role:"ADMIN"},
];
const sessions=new Map<string,typeof users[number]>();
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
for(const u of users)await pg.query("INSERT INTO auth.users VALUES ($1,$2)",[u.id,{display_name:u.name}]);
function authUser(u:typeof users[number]) {return {id:u.id,email:u.email,aud:"authenticated",role:"authenticated",app_metadata:{role:u.role},user_metadata:{display_name:u.name},created_at:new Date().toISOString()};}
function session(u:typeof users[number]) {
 const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const now=Math.floor(Date.now()/1000);
 const token=encode({alg:"HS256",typ:"JWT"})+"."+encode({sub:u.id,exp:now+3600,iat:now,aud:"authenticated",role:"authenticated"})+".fixture-not-a-real-signature";
 sessions.set(token,u);
 return {access_token:token,refresh_token:"fixture-refresh-"+u.id,token_type:"bearer",expires_in:3600,expires_at:now+3600,user:authUser(u)};
}
const allowedTables=["profiles","provider_profiles","jobs","job_terms","payments","deliveries","revisions","disputes","reviews","trust_events","evidence_files"];
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
    if(!u||(url.searchParams.get("grant_type")!=="refresh_token"&&input.password!=="fixture-password-only"))return send(400,{error:"invalid_grant",error_description:"Invalid login credentials"});
    return send(200,session(u));
  }
  if(url.pathname==="/auth/v1/user"){
    const u=sessions.get(req.headers.authorization?.replace("Bearer ","")||"");
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
  return send(404,{message:"Not implemented by test fixture"});
 }catch(error){const e=error as {message:string;code?:string};return send(400,{message:e.message,code:e.code});}
});
server.listen(54329,"127.0.0.1",()=>process.stdout.write("Test fixture ready on 54329\n"));

