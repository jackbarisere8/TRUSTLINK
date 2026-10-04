import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalStoreRepository } from "../lib/db/local-store";
import { createAggregate, validCapability } from "../lib/domain/jobs";
import { acceptAggregate, transition } from "./support/lifecycle";
test("local repository rejects stale writes and event edits; corruption is not replaced by sample data",async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),"trustlink-test-"));const file=path.join(dir,"store.json");
 try {
  const repo=new LocalStoreRepository(file);
  const {aggregate,token}=createAggregate({providerId:"provider",title:"Work",category:"Design",scope:"Logo",deliverables:["Logo"],price:"100",deadline:"2099-01-01",revisions:1,cancellationTerms:"Agreed",sourceChannel:"Direct",repeatUse:"FIRST"});
  await repo.commit(aggregate,null);
  const accepted=acceptAggregate(aggregate,token,{name:"Client",email:"client@example.com"});
  await repo.commit(accepted,0);await assert.rejects(repo.commit(accepted,0),/changed/);
  const paid=transition(accepted,{id:"provider",type:"PROVIDER",name:"Provider"},{type:"PAYMENT"}).aggregate;
  await repo.commit(paid,1);
  const legacy=JSON.parse(await readFile(file,"utf8")) as {notificationIntents?:unknown;records:Array<{payments:Array<Record<string,unknown>>;events:Array<Record<string,unknown>>}>};
  delete legacy.notificationIntents;
  delete legacy.records[0].payments[0].amount;delete legacy.records[0].payments[0].currency;
  for(const event of legacy.records[0].events) delete event.eventSequence;
  const paymentEvent=legacy.records[0].events.find(event=>event.eventType==="PAYMENT_RECORDED")!;
  delete (paymentEvent.metadata as Record<string,unknown>).amount;delete (paymentEvent.metadata as Record<string,unknown>).currency;
  await writeFile(file,JSON.stringify(legacy));
  const upgraded=await repo.getAggregate(aggregate.job.id);
  assert.deepEqual(upgraded?.events.map(event=>event.eventSequence),[1,2,3,4]);
  assert.deepEqual({amount:upgraded?.payments[0].amount,currency:upgraded?.payments[0].currency},{amount:"100",currency:"NGN"});
  assert.deepEqual((await repo.listNotificationIntents(aggregate.job.id)).map(intent=>[intent.notificationKind,intent.recipientRole]),[
   ["TRANSACTION_ACCEPTED","PROVIDER"],["PAYMENT_RECORDED","CLIENT_PARTICIPANT"],
  ]);
  const changed=transition(paid,{id:"provider",type:"PROVIDER",name:"Provider"},{type:"START"}).aggregate;changed.events[0].metadata.fake=true;
  await assert.rejects(repo.commit(changed,2),/immutable/);
  await writeFile(file,"broken JSON");await assert.rejects(repo.getAggregate(aggregate.job.id));assert.equal(await readFile(file,"utf8"),"broken JSON");
 }finally{await rm(dir,{recursive:true,force:true});}
});

test("local repository preserves first, prompted and unprompted creation classification inside its writer lock",async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),"trustlink-repeat-use-"));const file=path.join(dir,"store.json");
 try {
  const repo=new LocalStoreRepository(file);
  const base={providerId:"provider",title:"Work",category:"Design",scope:"Logo",deliverables:["Logo"],price:"100",deadline:"2099-01-01",revisions:1,cancellationTerms:"Agreed",sourceChannel:"Direct" as const};
  const misclassifiedFirst=createAggregate({...base,providerId:"new-provider",repeatUse:"UNPROMPTED"}).aggregate;
  await assert.rejects(repo.commit(misclassifiedFirst,null),/repeat-use classification/);
  const first=createAggregate({...base,repeatUse:"FIRST"}).aggregate;await repo.commit(first,null);
  const duplicateFirst=createAggregate({...base,creationId:"11111111-1111-4111-8111-111111111111",repeatUse:"FIRST"}).aggregate;
  await assert.rejects(repo.commit(duplicateFirst,null),/repeat-use classification/);
  const repeat=createAggregate({...base,creationId:"22222222-2222-4222-8222-222222222222",repeatUse:"UNPROMPTED"}).aggregate;
  await repo.commit(repeat,null);
  assert.deepEqual((await repo.listJobs("provider")).map(record=>record.repeatUse).sort(),["FIRST","UNPROMPTED"]);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test("local repository permits only ledgered client capability revocation and replacement",async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),"trustlink-capability-"));const file=path.join(dir,"store.json");
 try {
  const repo=new LocalStoreRepository(file);
  const {aggregate,token}=createAggregate({providerId:"provider",title:"Work",category:"Design",scope:"Logo",deliverables:["Logo"],price:"100",deadline:"2099-01-01",revisions:1,cancellationTerms:"Agreed",sourceChannel:"Direct",repeatUse:"FIRST"});
  await repo.commit(aggregate,null);
  const forged=transition(aggregate,{id:"provider",type:"PROVIDER",name:"Provider"},{type:"CANCEL"}).aggregate;
  forged.job.clientActionTokenHash="a".repeat(64);
  await assert.rejects(repo.commit(forged,0),/capability changes/);
  const forgedRevocation=transition(aggregate,{id:"provider",type:"PROVIDER",name:"Provider"},{type:"ROTATE_INVITE"}).aggregate;
  forgedRevocation.events.at(-1)!.eventType="CLIENT_LINK_REVOKED";
  await assert.rejects(repo.commit(forgedRevocation,0),/revocation requires/);
  const revoked=transition(aggregate,{id:"provider",type:"PROVIDER",name:"Provider"},{type:"REVOKE_INVITE"}).aggregate;
  await repo.commit(revoked,0);
  assert.equal(validCapability(revoked.job,token),false);
  const storedRevocation=await repo.getAggregate(aggregate.job.id);
  assert.equal(storedRevocation?.job.clientActionTokenHash,undefined);
  const reissued=transition(revoked,{id:"provider",type:"PROVIDER",name:"Provider"},{type:"ROTATE_INVITE"});
  await repo.commit(reissued.aggregate,revoked.job.version);
  assert.ok(reissued.token && validCapability(reissued.aggregate.job,reissued.token));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test("local repository locks accepted terms and client details to the acceptance transition",async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),"trustlink-acceptance-"));const file=path.join(dir,"store.json");
 try {
  const repo=new LocalStoreRepository(file);
  const {aggregate,token}=createAggregate({providerId:"provider",title:"Work",category:"Design",scope:"Logo",deliverables:["Logo"],price:"100",deadline:"2099-01-01",revisions:1,cancellationTerms:"Agreed",sourceChannel:"Direct",repeatUse:"FIRST"});
  await repo.commit(aggregate,null);
  const accepted=acceptAggregate(aggregate,token,{name:"Client",email:"client@example.com"});
  const alteredTerms=structuredClone(accepted);
  (alteredTerms.events.at(-1)!.metadata.acceptedTerms as Record<string,unknown>).scope="Different scope";
  await assert.rejects(repo.commit(alteredTerms,0),/Invalid transaction aggregate/);
  const uncapable=structuredClone(accepted);
  delete uncapable.job.clientActionTokenHash;delete uncapable.job.clientTokenExpiresAt;
  await assert.rejects(repo.commit(uncapable,0),/active participant capability/);
  const bundledAcceptance=transition(accepted,{id:"provider",type:"PROVIDER",name:"Provider"},{type:"PAYMENT"}).aggregate;
  await assert.rejects(repo.commit(bundledAcceptance,0),/exactly one new versioned event/);
  await repo.commit(accepted,0);
   const changedDetails=transition(accepted,{id:"provider",type:"PROVIDER",name:"Provider"},{type:"PAYMENT"}).aggregate;
   changedDetails.job.clientEmail="changed@example.com";
   await assert.rejects(repo.commit(changedDetails,accepted.job.version),/Accepted client details are immutable/);
   const attachedAccount=transition(accepted,{id:"provider",type:"PROVIDER",name:"Provider"},{type:"PAYMENT"}).aggregate;
   attachedAccount.job.clientId="provider";
   await assert.rejects(repo.commit(attachedAccount,accepted.job.version),/Accepted client details are immutable/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test("local repository enforces work, delivery and revision evidence transitions",async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),"trustlink-workflow-"));const file=path.join(dir,"store.json");
 try {
  const repo=new LocalStoreRepository(file),provider={id:"provider",type:"PROVIDER" as const,name:"Provider"};
  const {aggregate,token}=createAggregate({providerId:provider.id,title:"Work",category:"Design",scope:"Logo",deliverables:["Logo"],price:"100",deadline:"2099-01-01",revisions:1,cancellationTerms:"Agreed",sourceChannel:"Direct",repeatUse:"FIRST"});
  await repo.commit(aggregate,null);
  const accepted=acceptAggregate(aggregate,token,{name:"Client",email:"client@example.com"});await repo.commit(accepted,0);
  const forgedStart=transition(accepted,provider,{type:"PAYMENT"}).aggregate;
  forgedStart.payments=[];forgedStart.job.status="IN_PROGRESS";forgedStart.events.at(-1)!.eventType="WORK_STARTED";forgedStart.events.at(-1)!.metadata={requestId:forgedStart.events.at(-1)!.metadata.requestId,commandHash:forgedStart.events.at(-1)!.metadata.commandHash,expectedVersion:1};
  await assert.rejects(repo.commit(forgedStart,1),/canonical predecessor state/);
  const paid=transition(accepted,provider,{type:"PAYMENT"}).aggregate;await repo.commit(paid,1);
  const started=transition(paid,provider,{type:"START"}).aggregate;await repo.commit(started,2);
  const delivered=transition(started,provider,{type:"DELIVER",description:"First delivery",files:[]}).aggregate;
  const mismatched=structuredClone(delivered);mismatched.events.at(-1)!.metadata.deliveryId="00000000-0000-4000-8000-000000000099";
  await assert.rejects(repo.commit(mismatched,3),/Invalid transaction aggregate/);
  await repo.commit(delivered,3);
  const client={id:"client:"+aggregate.job.id,type:"CLIENT_PARTICIPANT" as const,name:"Client"};
  const revised=transition(delivered,client,{type:"REVISE",description:"Change the heading"}).aggregate;await repo.commit(revised,4);
  const restarted=transition(revised,provider,{type:"START"}).aggregate;await repo.commit(restarted,5);
  const redelivered=transition(restarted,provider,{type:"DELIVER",description:"Final delivery",files:[]}).aggregate;await repo.commit(redelivered,6);
  assert.throws(()=>transition(redelivered,client,{type:"REVISE",description:"Another revision"}),/limit/);
  const disputed=transition(redelivered,client,{type:"DISPUTE",description:"Scope remains incomplete",contestedTerm:"Scope",files:[]}).aggregate;await repo.commit(disputed,7);
  const responded=transition(disputed,provider,{type:"RESPOND_DISPUTE",response:"I will complete the missing scope"}).aggregate;
  const forgedResponder=structuredClone(responded);Object.assign(forgedResponder.events.at(-1)!,{actorId:client.id,actorType:"CLIENT_PARTICIPANT"});
  await assert.rejects(repo.commit(forgedResponder,8),/Invalid transaction aggregate/);
  await repo.commit(responded,8);
  const resolved=transition(responded,{id:"admin",type:"ADMIN",name:"Admin"},{type:"RESOLVE",notes:"Resume the agreed work",outcome:"IN_PROGRESS"}).aggregate;
  const alteredResponse=structuredClone(resolved);alteredResponse.disputes[0].responseFromOtherParty="Rewritten response";
  await assert.rejects(repo.commit(alteredResponse,9),/resolution requires|Invalid transaction aggregate/);
  await repo.commit(resolved,9);
  assert.equal((await repo.getAggregate(aggregate.job.id))?.disputes[0].resolutionNotes,"Resume the agreed work");
  const finalDelivery=transition(resolved,provider,{type:"DELIVER",description:"Completed scope",files:[]}).aggregate;await repo.commit(finalDelivery,10);
  const approved=transition(finalDelivery,client,{type:"APPROVE"}).aggregate;await repo.commit(approved,11);
  const completed=transition(approved,provider,{type:"COMPLETE"}).aggregate;await repo.commit(completed,12);
  const reviewed=transition(completed,client,{type:"REVIEW",rating:5,comment:"Complete and clear"}).aggregate;
  const forgedReview=structuredClone(reviewed);forgedReview.reviews[0].reviewerId=provider.id;
  await assert.rejects(repo.commit(forgedReview,13),/Invalid transaction aggregate|post-completion review/);
  await repo.commit(reviewed,13);
  assert.equal((await repo.getAggregate(aggregate.job.id))?.reviews[0].rating,5);
  assert.deepEqual((await repo.listNotificationIntents(aggregate.job.id)).map(intent=>[intent.notificationKind,intent.recipientRole]),[
   ["TRANSACTION_ACCEPTED","PROVIDER"],
   ["PAYMENT_RECORDED","CLIENT_PARTICIPANT"],
   ["DELIVERY_SUBMITTED","CLIENT_PARTICIPANT"],
   ["REVISION_REQUESTED","PROVIDER"],
   ["DELIVERY_SUBMITTED","CLIENT_PARTICIPANT"],
   ["DISPUTE_RAISED","PROVIDER"],
   ["DISPUTE_RAISED","ADMIN"],
   ["DELIVERY_SUBMITTED","CLIENT_PARTICIPANT"],
   ["TRANSACTION_COMPLETED","CLIENT_PARTICIPANT"],
  ]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
