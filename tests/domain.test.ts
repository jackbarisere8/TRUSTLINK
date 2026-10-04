import { randomUUID } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAggregate, hasActiveStoredClientCapability, validCapability, publicEvents, transactionParticipants, clientParticipantDetailStatus, type Actor } from "../lib/domain/jobs";
import { acceptAggregate, transition } from "./support/lifecycle";
import { commandSchema, createJobDraftSchema, createJobSchema } from "../lib/validation/schemas";
import { aggregateSchema } from "../lib/db/local-schema";
import { RecordedPaymentAdapter } from "../lib/payments";
import type { CreateJobInput } from "../lib/db/types";
import { publicJobIdPattern } from "../lib/domain/jobs/public-id";
const provider: Actor={id:"11111111-1111-4111-8111-111111111111",type:"PROVIDER",name:"Provider"};
const input: CreateJobInput={providerId:provider.id,title:"Website",category:"Design",scope:"Build a website",deliverables:["Home page"],price:"180000",deadline:"2099-10-18",revisions:1,cancellationTerms:"Discuss before work starts",sourceChannel:"WhatsApp",repeatUse:"FIRST"};
function accepted(){const {aggregate,token}=createAggregate(input);return {a:acceptAggregate(aggregate,token,{name:"Client",email:"client@example.com"}),token};}
function client(id:string):Actor{return {id:"client:"+id,type:"CLIENT_PARTICIPANT",name:"Client"};}
test("job creation produces the canonical persisted transaction shape",()=>{
 const {aggregate,token}=createAggregate(input);
 assert.match(aggregate.job.publicId,publicJobIdPattern);assert.match(aggregate.job.id,/^[0-9a-f-]{36}$/i);assert.ok(token);
 assert.deepEqual({status:aggregate.job.status,version:aggregate.job.version,currency:aggregate.terms.currency},{status:"SENT",version:0,currency:"NGN"});
 assert.deepEqual(aggregate.events.map(event=>[event.eventSequence,event.eventType,event.actorId]),[[1,"JOB_CREATED",provider.id],[2,"JOB_SENT",provider.id]]);
 assert.deepEqual(transactionParticipants(aggregate,{displayName:"Provider",detailStatus:"SELF_PROVIDED"}).map(participant=>participant.participantType),["PROVIDER","CLIENT_PARTICIPANT"]);
 assert.equal(aggregateSchema.safeParse(aggregate).success,true);
 const badId=structuredClone(aggregate);badId.job.publicId="fake-id";assert.equal(aggregateSchema.safeParse(badId).success,false);
 const badState=structuredClone(aggregate);badState.job.status="ACCEPTED";assert.equal(aggregateSchema.safeParse(badState).success,false);
 const missingCapability=structuredClone(aggregate);delete missingCapability.job.clientActionTokenHash;delete missingCapability.job.clientTokenExpiresAt;assert.equal(aggregateSchema.safeParse(missingCapability).success,false);
});
test("complete lifecycle retains approval and evidence, uses canonical events",()=>{
 let {a}=accepted(); const c=client(a.job.id);
 for(const command of [{type:"PAYMENT"},{type:"START"},{type:"DELIVER",description:"First delivery",files:[]},{type:"REVISE",description:"Change heading"},{type:"START"},{type:"DELIVER",description:"Updated delivery",files:[]},{type:"APPROVE"}] as const){
   a=transition(a,["REVISE","APPROVE"].includes(command.type)?c:provider,command as Parameters<typeof transition>[2]).aggregate;
 }
 assert.equal(a.job.status,"APPROVED");assert.equal(a.terms.revisionsUsed,1);
 a=transition(a,provider,{type:"COMPLETE"}).aggregate;
 a=transition(a,c,{type:"REVIEW",rating:4,comment:"  Clear process  "}).aggregate;
 assert.equal(a.job.status,"COMPLETED");assert.ok(a.job.completedAt);
 assert.equal(a.events.filter(e=>e.eventType==="DELIVERY_APPROVED").length,1);
 assert.equal(a.events.filter(e=>e.eventType==="JOB_COMPLETED").length,1);
 const reviewEvent=a.events.find(event=>event.eventType==="CLIENT_REVIEWED")!;
 assert.equal(a.reviews[0].comment,"Clear process");
 assert.equal(reviewEvent.metadata.reviewId,a.reviews[0].id);assert.equal(reviewEvent.metadata.rating,4);
 const deliveryEvents=a.events.filter(event=>event.eventType==="DELIVERY_SUBMITTED");
 assert.deepEqual(deliveryEvents.map(event=>event.metadata.deliveryId),a.deliveries.map(delivery=>delivery.id));
 const revisionEvent=a.events.find(event=>event.eventType==="REVISION_REQUESTED")!;
 assert.equal(revisionEvent.metadata.revisionId,a.revisions[0].id);assert.equal(revisionEvent.metadata.revisionNumber,1);
 const approvalEvent=a.events.find(event=>event.eventType==="DELIVERY_APPROVED")!;
 assert.equal(approvalEvent.metadata.deliveryId,a.deliveries.at(-1)!.id);
 assert.equal(a.reviews[0].reviewerId,c.id);
  assert.equal(a.payments[0].verificationStatus,"NOT_VERIFIED");
  assert.deepEqual({amount:a.payments[0].amount,currency:a.payments[0].currency,recordedBy:a.payments[0].recordedBy},{amount:"180000",currency:"NGN",recordedBy:"PROVIDER"});
  assert.deepEqual(a.events.map(event=>event.eventSequence),a.events.map((_,index)=>index+1));
  assert.equal(aggregateSchema.safeParse(a).success,true);
 assert.throws(()=>transition(a,c,{type:"REVIEW",rating:1}),/already/);
 assert.throws(()=>transition(a,provider,{type:"PAYMENT"}),/state/);
});
test("authorization rejects guessed jobs, wrong roles, and client identity spoofing",()=>{
 const {a}=accepted(), c=client(a.job.id);
 assert.throws(()=>transition(a,{...provider,id:"another-provider"},{type:"PAYMENT"}),/access/);
 assert.throws(()=>transition(a,c,{type:"PAYMENT"}),/permission/);
 assert.throws(()=>transition(a,provider,{type:"APPROVE"}),/permission/);
 assert.throws(()=>transition(a,{...c,id:"client:another-job"},{type:"DISPUTE",description:"Issue",contestedTerm:"Scope",files:[]}),/access/);
 assert.throws(()=>transition(a,provider,{type:"RESOLVE",notes:"Done",outcome:"CANCELLED"}),/permission/);
});
test("invalid transitions leave original aggregate unchanged",()=>{
 const {a}=accepted(); const before=JSON.stringify(a);
 assert.throws(()=>transition(a,provider,{type:"DELIVER",description:"Early",files:[]}),/state/);
 assert.throws(()=>transition(a,client(a.job.id),{type:"REVIEW",rating:5}),/state/);
 assert.equal(JSON.stringify(a),before);
});
test("capabilities expire, rotate, revoke, and stay transaction-scoped; acceptance cannot overwrite identity",()=>{
 const {aggregate,token}=createAggregate(input);
 assert.equal(validCapability(aggregate.job,token),true);
 assert.equal(hasActiveStoredClientCapability(aggregate.job),true);
 assert.equal(validCapability(aggregate.job,token,Date.now()+31*86400000),false);
 assert.equal(hasActiveStoredClientCapability(aggregate.job,Date.now()+31*86400000),false);
 const other=createAggregate(input);
 assert.equal(validCapability(other.aggregate.job,token),false);
 const a=acceptAggregate(aggregate,token,{name:"Original",email:"original@example.com"});
 assert.throws(()=>acceptAggregate(a,"bad",{name:"Other",email:"other@example.com"}),/expired/);
 assert.throws(()=>acceptAggregate(a,token,{name:"Other",email:"other@example.com"}),/state/);
 assert.equal(a.job.clientName,"Original");
 const rotated=transition(a,provider,{type:"ROTATE_INVITE"});
 assert.equal(validCapability(rotated.aggregate.job,token),false);
 assert.equal(validCapability(rotated.aggregate.job,rotated.token!),true);
 const revoked=transition(rotated.aggregate,provider,{type:"REVOKE_INVITE"});
 assert.equal(revoked.token,undefined);
 assert.equal(revoked.aggregate.job.clientActionTokenHash,undefined);
 assert.equal(revoked.aggregate.job.clientTokenExpiresAt,undefined);
 assert.equal(validCapability(revoked.aggregate.job,rotated.token!),false);
 assert.equal(revoked.aggregate.events.at(-1)?.eventType,"CLIENT_LINK_REVOKED");
 assert.throws(()=>transition(revoked.aggregate,provider,{type:"REVOKE_INVITE"}),/already revoked/);
 const reissued=transition(revoked.aggregate,provider,{type:"ROTATE_INVITE"});
 assert.ok(reissued.token && validCapability(reissued.aggregate.job,reissued.token));
});
test("acceptance persists the exact reviewed terms without claiming verified identity",()=>{
 const {aggregate,token}=createAggregate(input);
 const accepted=acceptAggregate(aggregate,token,{name:"Client",email:"client@example.com"});
 const acceptance=accepted.events.at(-1)!;
 assert.deepEqual(acceptance.metadata.acceptedTerms,{
  service:"Website",serviceCategory:"Design",scope:"Build a website",deliverables:["Home page"],
  price:"180000.00",currency:"NGN",deadline:"2099-10-18",revisionsIncluded:1,cancellationTerms:"Discuss before work starts",
 });
 assert.equal(acceptance.metadata.participantDetailStatus,"SELF_PROVIDED");
 const alteredTerms=structuredClone(accepted);
 alteredTerms.terms.scope="A different agreement";
 assert.equal(aggregateSchema.safeParse(alteredTerms).success,false);
  const alteredSnapshot=structuredClone(accepted);
  (alteredSnapshot.events.at(-1)!.metadata.acceptedTerms as Record<string,unknown>).price="1.00";
  assert.equal(aggregateSchema.safeParse(alteredSnapshot).success,false);
  const claimedVerified=structuredClone(accepted);
  claimedVerified.events.at(-1)!.metadata.participantDetailStatus="EMAIL_VERIFIED";
  assert.equal(aggregateSchema.safeParse(claimedVerified).success,false);
});
test("transaction participants separate account profiles from guest client details",()=>{
 const {aggregate,token}=createAggregate(input);
 let participants=transactionParticipants(aggregate,{displayName:"Provider",detailStatus:"SELF_PROVIDED"});
 assert.deepEqual(participants.map(participant=>({type:participant.participantType,association:participant.accountAssociation,status:participant.detailStatus})),[
  {type:"PROVIDER",association:"ACCOUNT",status:"SELF_PROVIDED"},
  {type:"CLIENT_PARTICIPANT",association:"GUEST",status:"UNKNOWN"},
 ]);
 const accepted=acceptAggregate(aggregate,token,{name:"Guest client",email:"guest@example.com",phone:"+2348012345678"});
 participants=transactionParticipants(accepted,{displayName:"Provider",detailStatus:"SELF_PROVIDED"});
 const guest=participants[1];
 assert.equal(guest.accountUserId,undefined);
 assert.equal(guest.displayName,"Guest client");
 assert.equal(guest.email,"guest@example.com");
 assert.equal(guest.phone,"+2348012345678");
 assert.equal(guest.detailStatus,"SELF_PROVIDED");
 assert.equal(clientParticipantDetailStatus(accepted),"SELF_PROVIDED");
 const acceptance=accepted.events.find(event=>event.eventType==="JOB_ACCEPTED")!;
 assert.equal(acceptance.metadata.participantDetailStatus,"SELF_PROVIDED");
 assert.equal(acceptance.metadata.identityStatus,undefined);
 assert.equal(aggregateSchema.safeParse(accepted).success,true);
 const unsupported=structuredClone(accepted);unsupported.events.find(event=>event.eventType==="JOB_ACCEPTED")!.metadata.participantDetailStatus="VERIFIED_IDENTITY";
 assert.equal(clientParticipantDetailStatus(unsupported),"UNKNOWN");
 assert.equal(aggregateSchema.safeParse(unsupported).success,false);
 const claimedEmailVerification=structuredClone(accepted);claimedEmailVerification.events.find(event=>event.eventType==="JOB_ACCEPTED")!.metadata.participantDetailStatus="EMAIL_VERIFIED";
 assert.equal(clientParticipantDetailStatus(claimedEmailVerification),"UNKNOWN");
 const historicalClaim=structuredClone(accepted);delete historicalClaim.events.find(event=>event.eventType==="JOB_ACCEPTED")!.metadata.participantDetailStatus;historicalClaim.events.find(event=>event.eventType==="JOB_ACCEPTED")!.metadata.identityStatus="EMAIL_VERIFIED";
 assert.equal(clientParticipantDetailStatus(historicalClaim),"UNKNOWN");
 assert.equal(aggregateSchema.safeParse(historicalClaim).success,true);
 const linked=structuredClone(accepted);linked.job.clientId="client-account";
 assert.equal(transactionParticipants(linked,{displayName:"Provider",detailStatus:"SELF_PROVIDED"})[1].accountAssociation,"ACCOUNT");
});
test("revision cap and disputes preserve state; admin resolution has explicit outcome",()=>{
 let {a}=accepted();const c=client(a.job.id);
 a=transition(a,provider,{type:"PAYMENT"}).aggregate;
 a=transition(a,provider,{type:"START"}).aggregate;
 a=transition(a,provider,{type:"DELIVER",description:"First",files:[]}).aggregate;
 a=transition(a,c,{type:"REVISE",description:"Fix"}).aggregate;
 a=transition(a,provider,{type:"START"}).aggregate;
 a=transition(a,provider,{type:"DELIVER",description:"Second",files:[]}).aggregate;
 assert.throws(()=>transition(a,c,{type:"REVISE",description:"Again"}),/limit/);
 a=transition(a,c,{type:"DISPUTE",description:"Scope missing",contestedTerm:"Scope",files:[]}).aggregate;
 const disputeEvent=a.events.at(-1)!;
 assert.equal(disputeEvent.metadata.disputeId,a.disputes[0].id);assert.equal(disputeEvent.metadata.fileCount,0);
 assert.throws(()=>transition(a,provider,{type:"COMPLETE"}),/state/);
 assert.throws(()=>transition(a,c,{type:"RESPOND_DISPUTE",response:"I disagree"}),/other transaction party/);
 a=transition(a,provider,{type:"RESPOND_DISPUTE",response:"I will supply the missing scope"}).aggregate;
 assert.equal(a.job.status,"DISPUTED");assert.equal(a.disputes[0].disputeStatus,"UNDER_REVIEW");
 assert.equal(a.disputes[0].responseFromOtherParty,"I will supply the missing scope");
 assert.equal(a.events.at(-1)!.metadata.disputeId,a.disputes[0].id);
 assert.throws(()=>transition(a,provider,{type:"RESPOND_DISPUTE",response:"Second response"}),/open dispute|already responded/);
 a=transition(a,{id:"admin",type:"ADMIN",name:"Admin"},{type:"RESOLVE",notes:"Resume agreed work",outcome:"IN_PROGRESS"}).aggregate;
 assert.equal(a.job.status,"IN_PROGRESS");assert.equal(a.disputes[0].disputeStatus,"RESOLVED");
 assert.equal(a.events.at(-1)!.metadata.disputeId,a.disputes[0].id);
});
test("the client can respond once when the provider raised the dispute",()=>{
 const {a}=accepted(),c=client(a.job.id);
 const disputed=transition(a,provider,{type:"DISPUTE",description:"The client has not supplied the agreed content",contestedTerm:"Communication",files:[]}).aggregate;
 assert.throws(()=>transition(disputed,provider,{type:"RESPOND_DISPUTE",response:"Claimant response"}),/other transaction party/);
 const responded=transition(disputed,c,{type:"RESPOND_DISPUTE",response:"I will send the content today"}).aggregate;
 const responseEvent=responded.events.at(-1)!;
 assert.equal(responded.job.status,"DISPUTED");
 assert.equal(responded.disputes[0].disputeStatus,"UNDER_REVIEW");
 assert.equal(responded.disputes[0].responseFromOtherParty,"I will send the content today");
 assert.deepEqual({type:responseEvent.eventType,actorType:responseEvent.actorType,actorId:responseEvent.actorId,disputeId:responseEvent.metadata.disputeId},{type:"DISPUTE_RESPONDED",actorType:"CLIENT_PARTICIPANT",actorId:c.id,disputeId:responded.disputes[0].id});
 assert.equal(aggregateSchema.safeParse(responded).success,true);
});
test("public events redact identities and metadata",()=>{
  const {a}=accepted();a.events[0].metadata={email:"secret@example.com",reference:"private"};
  a.events.push(
    {...a.events.at(-1)!,id:randomUUID(),eventType:"JOB_VIEWED",eventSequence:4,actorId:"system",actorType:"SYSTEM",metadata:{email:"private-viewer@example.com"}},
    {...a.events.at(-1)!,id:randomUUID(),eventType:"CLIENT_LINK_REISSUED",eventSequence:5,actorId:provider.id,actorType:"PROVIDER",metadata:{capability:"private"}},
    {...a.events.at(-1)!,id:randomUUID(),eventType:"CLIENT_LINK_REVOKED",eventSequence:6,actorId:provider.id,actorType:"PROVIDER",metadata:{capability:"private"}},
  );
  const projected=publicEvents([...a.events].reverse());
  const serialized=JSON.stringify(projected);
  assert.ok(!serialized.includes("secret@example.com"));assert.ok(!serialized.includes("private-viewer@example.com"));assert.ok(!serialized.includes("actorId"));
  assert.deepEqual(projected.map(event=>event.eventType),["JOB_CREATED","JOB_SENT","JOB_ACCEPTED"]);
});
test("ledger schema rejects gaps, actor mismatches and missing operation metadata",()=>{
  const {a}=accepted();
  const gap=structuredClone(a);gap.events.at(-1)!.eventSequence=9;
  assert.equal(aggregateSchema.safeParse(gap).success,false);
  const actor=structuredClone(a);Object.assign(actor.events.at(-1)!,{actorId:provider.id,actorType:"PROVIDER" as const});
  assert.equal(aggregateSchema.safeParse(actor).success,false);
  const operation=structuredClone(a);delete operation.events.at(-1)!.metadata.commandHash;
  assert.equal(aggregateSchema.safeParse(operation).success,false);
});
test("recorded payment is a provider declaration matching terms and its trust event",()=>{
  const {a}=accepted();
  const paid=transition(a,provider,{type:"PAYMENT",reference:"Direct transfer",notes:"Reported received"}).aggregate;
  const payment=paid.payments[0],event=paid.events.at(-1)!;
  assert.deepEqual({amount:payment.amount,currency:payment.currency,recordedBy:payment.recordedBy,verificationStatus:payment.verificationStatus},{amount:a.terms.price,currency:"NGN",recordedBy:"PROVIDER",verificationStatus:"NOT_VERIFIED"});
  assert.equal(event.metadata.amount,payment.amount);assert.equal(event.metadata.currency,payment.currency);
  for(const change of [
    (candidate:typeof paid)=>{candidate.payments[0].amount="1";},
    (candidate:typeof paid)=>{candidate.payments[0].recordedBy="CLIENT" as "PROVIDER";},
    (candidate:typeof paid)=>{candidate.events.at(-1)!.metadata.verificationStatus="VERIFIED";},
  ]) { const candidate=structuredClone(paid);change(candidate);assert.equal(aggregateSchema.safeParse(candidate).success,false); }
  const invalidAmount=structuredClone(a);invalidAmount.terms.price="0";
  assert.throws(()=>transition(invalidAmount,provider,{type:"PAYMENT"}),/agreed payment amount/);
  const invalidCurrency=structuredClone(a);invalidCurrency.terms.currency="USD";
  assert.throws(()=>transition(invalidCurrency,provider,{type:"PAYMENT"}),/agreed payment amount/);
});
test("server schemas reject invalid inputs",()=>{
 assert.equal(createJobDraftSchema.safeParse(input).success,true);
 assert.equal(createJobSchema.safeParse({...input,confirmed:true}).success,true);
 assert.equal(createJobSchema.safeParse({...input,confirmed:false}).success,false);
 for(const price of ["-10","Infinity","180,000","0"])assert.equal(createJobSchema.safeParse({...input,price,confirmed:true}).success,false);
 assert.equal(createJobSchema.safeParse({...input,confirmed:true,deadline:"2026-02-30"}).success,false);
 assert.equal(createJobSchema.safeParse({...input,confirmed:true,sourceChannel:"invented"}).success,false);
 assert.equal(commandSchema.safeParse({type:"REVIEW",rating:8}).success,false);
 const payment=commandSchema.parse({type:"PAYMENT",reference:"   ",notes:"   "});
 assert.equal(payment.type,"PAYMENT");assert.equal(payment.reference,undefined);assert.equal(payment.notes,undefined);
 assert.equal(commandSchema.safeParse({type:"PAYMENT",reference:"r".repeat(201)}).success,false);
 assert.equal(commandSchema.safeParse({type:"PAYMENT",notes:"n".repeat(2001)}).success,false);
 assert.equal(commandSchema.safeParse({type:"DELIVER",description:"Delivery",files:["same","same"]}).success,false);
 assert.equal(commandSchema.safeParse({type:"DISPUTE",contestedTerm:"Scope",description:"Issue",files:["same","same"]}).success,false);
 assert.equal(commandSchema.safeParse({type:"RESPOND_DISPUTE",response:" "}).success,false);
 assert.equal(commandSchema.safeParse({type:"RESPOND_DISPUTE",response:"r".repeat(5001)}).success,false);
});
test("recording never independently verifies a transfer",async()=>{
 const adapter=new RecordedPaymentAdapter(),verification=await adapter.verifyPayment("reference");
 assert.deepEqual(verification,{reference:"reference",mode:"RECORDED",verificationAvailable:false,verified:false,verificationStatus:"NOT_VERIFIED"});
 assert.deepEqual(await adapter.getCapabilities(),{protectedFunds:false,authorization:false,partialRelease:false,partialRefund:false});
 await assert.rejects(adapter.createPayment(),/unavailable/);
});

test("operation keys prevent delayed replay after state cycles and reject changed payloads",()=>{
 let {a}=accepted();const c=client(a.job.id);
 a=transition(a,provider,{type:"PAYMENT"}).aggregate;
 a=transition(a,provider,{type:"START"}).aggregate;
 const command={type:"DELIVER" as const,description:"Original delivery",files:[]};
 const request={id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",expectedVersion:a.job.version};
 a=transition(a,provider,command,request).aggregate;
 a=transition(a,c,{type:"REVISE",description:"Fix heading"}).aggregate;
 a=transition(a,provider,{type:"START"}).aggregate;
 const before=JSON.stringify(a);
 assert.equal(transition(a,provider,command,request).aggregate,a);
 assert.equal(JSON.stringify(a),before);
 assert.throws(()=>transition(a,provider,{...command,description:"Changed"},request),/different action/);
 assert.throws(()=>transition(a,provider,command,{...request,id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}),/changed/);
});

test("all requested immediate retries are safe and do not append twice",()=>{
 let {a}=accepted();const c=client(a.job.id);
 const commands=[{type:"PAYMENT"},{type:"START"},{type:"DELIVER",description:"Delivery",files:[]},{type:"REVISE",description:"Revision"},{type:"START"},{type:"DELIVER",description:"Revised delivery",files:[]},{type:"DISPUTE",description:"Missing work",contestedTerm:"Scope",files:[]}] as const;
 for(const cmd of commands){const actor=["REVISE","DISPUTE"].includes(cmd.type)?c:provider;const request={id:randomUUID(),expectedVersion:a.job.version};const command=cmd as Parameters<typeof transition>[2];a=transition(a,actor,command,request).aggregate;assert.equal(transition(a,actor,command,request).aggregate,a);}
 const responseRequest={id:randomUUID(),expectedVersion:a.job.version};const response={type:"RESPOND_DISPUTE",response:"Provider response"} as const;
 a=transition(a,provider,response,responseRequest).aggregate;assert.equal(transition(a,provider,response,responseRequest).aggregate,a);
 a=transition(a,{id:"admin",type:"ADMIN",name:"Admin"},{type:"RESOLVE",notes:"Continue",outcome:"IN_PROGRESS"}).aggregate;
 a=transition(a,provider,{type:"DELIVER",description:"Final",files:[]}).aggregate;
 const request={id:randomUUID(),expectedVersion:a.job.version};a=transition(a,c,{type:"APPROVE"},request).aggregate;assert.equal(transition(a,c,{type:"APPROVE"},request).aggregate,a);
});
