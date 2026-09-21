import { test } from "node:test";
import assert from "node:assert/strict";
import { detectFile, readBoundedBody, hasSameOrigin } from "../lib/evidence-validation";
import { calculateReputation } from "../lib/reputation/calculate";
import { createAggregate } from "../lib/domain/jobs";
test("upload CSRF checks use the external host and reject cross-origin or missing origins",()=>{
 const request=(origin?:string)=>new Request("https://internal-host/upload",{headers:{host:"app.example.test",...(origin?{origin}:{})}});
 assert.equal(hasSameOrigin(request("https://app.example.test")),true);
 for(const origin of [undefined,"null","https://attacker.test","http://app.example.test","https://app.example.test.attacker.test"]){
  assert.equal(hasSameOrigin(request(origin)),false);
 }
});
test("file contents must match declared types; executable and SVG uploads are rejected",()=>{
 assert.equal(detectFile(Buffer.from("%PDF-1.7\n"),"application/pdf"),true);
 assert.equal(detectFile(Buffer.from("MZ executable"),"application/pdf"),false);
 assert.equal(detectFile(Buffer.from("<svg onload='alert(1)'/>"),"image/svg+xml"),false);
 assert.equal(detectFile(Buffer.from([0,1,2]),"text/plain"),false);
 assert.equal(detectFile(Buffer.from("Plain text evidence"),"text/plain"),true);
});
test("chunked multipart bodies cannot bypass the total upload bound",async()=>{
 let cancelled=false;
 const body=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(8));c.enqueue(new Uint8Array(8));},cancel(){cancelled=true;}});
 const request=new Request("http://localhost/upload",{method:"POST",body,duplex:"half"} as RequestInit);
 await assert.rejects(readBoundedBody(request,10),/limit/);assert.equal(cancelled,true);
});
test("empty reputation is empty; completed delivery deadlines use Nigerian local dates",()=>{
 assert.deepEqual(calculateReputation([]),{completedJobsCount:0,averageRating:"—",onTimeRate:"—"});
 const {aggregate:a}=createAggregate({providerId:"provider",title:"Design",category:"Design",scope:"Logo",deliverables:["Logo"],price:"500",deadline:"2026-09-20",revisions:0,cancellationTerms:"Agreed",sourceChannel:"Direct",repeatUse:"FIRST"});
 a.job.status="COMPLETED";
 a.deliveries.push({id:"delivery",jobId:a.job.id,description:"Complete",fileUrls:[],submittedBy:"provider",submittedAt:"2026-09-20T23:30:00Z"});
 assert.equal(calculateReputation([a]).onTimeRate,"0%");
 a.deliveries[0].submittedAt="2026-09-20T22:59:59Z";
 assert.equal(calculateReputation([a]).onTimeRate,"100%");
 a.job.status="IN_PROGRESS";
 assert.equal(calculateReputation([a]).completedJobsCount,0);
});
