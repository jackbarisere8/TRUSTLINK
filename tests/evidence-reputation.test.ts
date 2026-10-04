import { test } from "node:test";
import assert from "node:assert/strict";
import { detectFile, readBoundedBody, hasSameOrigin, isEvidencePathForJob, safeEvidenceFilename } from "../lib/evidence-validation";
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
 assert.equal(detectFile(Buffer.from("%PDF-1.7\nEvidence\n%%EOF"),"application/pdf"),true);
 assert.equal(detectFile(Buffer.from("%PDF-1.7\nMissing trailer"),"application/pdf"),false);
 assert.equal(detectFile(Buffer.from("MZ executable"),"application/pdf"),false);
 assert.equal(detectFile(Buffer.from("<svg onload='alert(1)'/>"),"image/svg+xml"),false);
 assert.equal(detectFile(Buffer.from("<svg onload='alert(1)'/>"),"text/plain"),false);
 assert.equal(detectFile(Buffer.from("#!/bin/sh\necho unsafe"),"text/plain"),false);
 assert.equal(detectFile(Buffer.from([0,1,2]),"text/plain"),false);
 assert.equal(detectFile(Buffer.from("Plain text evidence"),"text/plain"),true);
});
test("evidence paths are job-scoped and download filenames cannot retain executable or path syntax",()=>{
 const jobId="11111111-1111-4111-8111-111111111111",objectId="22222222-2222-4222-8222-222222222222";
 assert.equal(isEvidencePathForJob(jobId,jobId+"/"+objectId),true);
 assert.equal(isEvidencePathForJob(jobId,"other/"+objectId),false);
 assert.equal(isEvidencePathForJob(jobId,jobId+"/../secret"),false);
 const filename=safeEvidenceFilename("../invoice\r\n.exe","text/plain");
 assert.equal(filename.endsWith(".txt"),true);assert.equal(/[\\/\r\n]/.test(filename),false);
 assert.equal(safeEvidenceFilename("CON.exe","text/plain"),"_CON.txt");
 assert.equal(safeEvidenceFilename("report.","application/pdf"),"report.pdf");
});
test("chunked multipart bodies cannot bypass the total upload bound",async()=>{
 let cancelled=false;
 const body=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(8));c.enqueue(new Uint8Array(8));},cancel(){cancelled=true;}});
 const request=new Request("http://localhost/upload",{method:"POST",body,duplex:"half"} as RequestInit);
 await assert.rejects(readBoundedBody(request,10),/limit/);assert.equal(cancelled,true);
});
test("empty reputation is empty; completed delivery deadlines use Nigerian local dates",()=>{
 assert.deepEqual(calculateReputation([]),{completedJobsCount:0,averageRating:"—",reviewCount:0,onTimeRate:"—",onTimeJobsCount:0,repeatClientCount:"—",completedServices:[]});
 const {aggregate:a}=createAggregate({providerId:"provider",title:"Design",category:"Design",scope:"Logo",deliverables:["Logo"],price:"500",deadline:"2026-09-20",revisions:0,cancellationTerms:"Agreed",sourceChannel:"Direct",repeatUse:"FIRST"});
 a.job.status="COMPLETED";
 a.job.clientEmail="client@example.test";
 a.deliveries.push({id:"delivery",jobId:a.job.id,description:"Complete",fileUrls:[],submittedBy:"provider",submittedAt:"2026-09-20T23:30:00Z"});
 assert.equal(calculateReputation([a]).onTimeRate,"0%");
 a.deliveries[0].submittedAt="2026-09-20T22:59:59Z";
 assert.equal(calculateReputation([a]).onTimeRate,"100%");
 assert.equal(calculateReputation([a]).repeatClientCount,0);
 assert.deepEqual(calculateReputation([a]).completedServices,["Design"]);
 a.job.status="IN_PROGRESS";
 assert.equal(calculateReputation([a]).completedJobsCount,0);
});
test("reputation derives ratings, completed services and repeat-client activity from completed records",()=>{
 const make=(service:string,email:string,rating?:number)=>{
  const {aggregate}=createAggregate({providerId:"provider",title:service,category:"Design",scope:"Work",deliverables:["Result"],price:"500",deadline:"2026-09-20",revisions:0,cancellationTerms:"Agreed",sourceChannel:"Direct",repeatUse:"FIRST"});
  aggregate.job.status="COMPLETED";aggregate.job.completedAt="2026-09-20T12:00:00Z";aggregate.job.clientEmail=email;
  if(rating)aggregate.reviews.push({id:"review-"+service,jobId:aggregate.job.id,reviewerId:"client:"+aggregate.job.id,reviewerName:"Client",rating,submittedAt:"2026-09-20T13:00:00Z"});
  return aggregate;
 };
 const result=calculateReputation([make("Website","same@example.test",5),make("Logo","same@example.test",3),make("Illustration","other@example.test")]);
 assert.deepEqual(result,{completedJobsCount:3,averageRating:"4.0",reviewCount:2,onTimeRate:"—",onTimeJobsCount:0,repeatClientCount:1,completedServices:["Illustration","Logo","Website"]});
});
