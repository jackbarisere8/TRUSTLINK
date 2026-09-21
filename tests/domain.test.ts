import { randomUUID } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createAggregate, validCapability, publicEvents, transactionParticipants, clientParticipantDetailStatus, type Actor } from "../lib/domain/jobs";
import { acceptAggregate, transition } from "./support/lifecycle";
import { commandSchema, createJobSchema } from "../lib/validation/schemas";
import { aggregateSchema } from "../lib/db/local-schema";
import { RecordedPaymentAdapter } from "../lib/payments";
import type { CreateJobInput } from "../lib/db/types";
const provider: Actor={id:"11111111-1111-4111-8111-111111111111",type:"PROVIDER",name:"Provider"};
const input: CreateJobInput={providerId:provider.id,title:"Website",category:"Design",scope:"Build a website",deliverables:["Home page"],price:"180000",deadline:"2099-10-18",revisions:1,cancellationTerms:"Discuss before work starts",sourceChannel:"WhatsApp",repeatUse:"FIRST"};
function accepted(){const {aggregate,token}=createAggregate(input);return {a:acceptAggregate(aggregate,token,{name:"Client",email:"client@example.com"}),token};}
function client(id:string):Actor{return {id:"client:"+id,type:"CLIENT_PARTICIPANT",name:"Client"};}
test("complete lifecycle retains approval and evidence, uses canonical events",()=>{
 let {a}=accepted(); const c=client(a.job.id);
 for(const command of [{type:"PAYMENT"},{type:"START"},{type:"DELIVER",description:"First delivery",files:[]},{type:"REVISE",description:"Change heading"},{type:"START"},{type:"DELIVER",description:"Updated delivery",files:[]},{type:"APPROVE"}] as const){
   a=transition(a,["REVISE","APPROVE"].includes(command.type)?c:provider,command as Parameters<typeof transition>[2]).aggregate;
 }
 assert.equal(a.job.status,"APPROVED");assert.equal(a.terms.revisionsUsed,1);
 a=transition(a,provider,{type:"COMPLETE"}).aggregate;
 a=transition(a,c,{type:"REVIEW",rating:4,comment:"Clear process"}).aggregate;
 assert.equal(a.job.status,"COMPLETED");assert.ok(a.job.completedAt);
 assert.equal(a.events.filter(e=>e.eventType==="DELIVERY_APPROVED").length,1);
 assert.equal(a.events.filter(e=>e.eventType==="JOB_COMPLETED").length,1);
 assert.equal(a.reviews[0].reviewerId,c.id);
 assert.equal(a.payments[0].verificationStatus,"NOT_VERIFIED");
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
test("capabilities expire, rotate, and validate before replay; acceptance cannot overwrite identity",()=>{
 const {aggregate,token}=createAggregate(input);
 assert.equal(validCapability(aggregate.job,token),true);
 assert.equal(validCapability(aggregate.job,token,Date.now()+31*86400000),false);
 const a=acceptAggregate(aggregate,token,{name:"Original",email:"original@example.com"});
 assert.throws(()=>acceptAggregate(a,"bad",{name:"Other",email:"other@example.com"}),/expired/);
 assert.throws(()=>acceptAggregate(a,token,{name:"Other",email:"other@example.com"}),/state/);
 assert.equal(a.job.clientName,"Original");
 const rotated=transition(a,provider,{type:"ROTATE_INVITE"});
 assert.equal(validCapability(rotated.aggregate.job,token),false);
 assert.equal(validCapability(rotated.aggregate.job,rotated.token!),true);
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
 assert.throws(()=>transition(a,provider,{type:"COMPLETE"}),/state/);
 a=transition(a,{id:"admin",type:"ADMIN",name:"Admin"},{type:"RESOLVE",notes:"Resume agreed work",outcome:"IN_PROGRESS"}).aggregate;
 assert.equal(a.job.status,"IN_PROGRESS");assert.equal(a.disputes[0].disputeStatus,"RESOLVED");
});
test("public events redact identities and metadata",()=>{
 const {a}=accepted();a.events[0].metadata={email:"secret@example.com",reference:"private"};
 const serialized=JSON.stringify(publicEvents(a.events));
 assert.ok(!serialized.includes("secret@example.com"));assert.ok(!serialized.includes("actorId"));
});
test("server schemas reject invalid inputs",()=>{
 assert.equal(createJobSchema.safeParse({...input,confirmed:true}).success,true);
 for(const price of ["-10","Infinity","180,000","0"])assert.equal(createJobSchema.safeParse({...input,price,confirmed:true}).success,false);
 assert.equal(createJobSchema.safeParse({...input,confirmed:true,deadline:"2026-02-30"}).success,false);
 assert.equal(createJobSchema.safeParse({...input,confirmed:true,sourceChannel:"invented"}).success,false);
 assert.equal(commandSchema.safeParse({type:"REVIEW",rating:8}).success,false);
});
test("recording never independently verifies a transfer",async()=>{
 const adapter=new RecordedPaymentAdapter();assert.equal((await adapter.verifyPayment("reference")).verified,false);
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
 a=transition(a,{id:"admin",type:"ADMIN",name:"Admin"},{type:"RESOLVE",notes:"Continue",outcome:"IN_PROGRESS"}).aggregate;
 a=transition(a,provider,{type:"DELIVER",description:"Final",files:[]}).aggregate;
 const request={id:randomUUID(),expectedVersion:a.job.version};a=transition(a,c,{type:"APPROVE"},request).aggregate;assert.equal(transition(a,c,{type:"APPROVE"},request).aggregate,a);
});
