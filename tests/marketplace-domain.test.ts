import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { BookingService, bookingTransitions, type MarketplaceActor } from "../lib/domain/bookings";
import { ConflictError } from "../lib/domain/errors";
import { MemoryMarketplaceRepository } from "../lib/db/marketplace-memory";

const customer:MarketplaceActor={id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",type:"CUSTOMER"};
const otherCustomer:MarketplaceActor={id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",type:"CUSTOMER"};
const provider:MarketplaceActor={id:"11111111-1111-4111-8111-111111111111",type:"PROVIDER"};
const otherProvider:MarketplaceActor={id:"22222222-2222-4222-8222-222222222222",type:"PROVIDER"};
const serviceId="20000000-0000-4000-8000-000000000001";
const now=new Date("2026-10-05T09:00:00.000Z");

function setup(capacity=1) {
  const repository=new MemoryMarketplaceRepository({
    providers:[{id:provider.id,providerLocation:"Ikeja, Lagos, Nigeria",priorTransactionCount:0,serviceTitle:"Business website development",categoryName:"Technology & Digital",capacity}],
    services:[{id:serviceId,providerId:provider.id,title:"Business website development",categoryName:"Technology & Digital",published:true}],
  });
  return {repository,bookings:new BookingService(repository,()=>new Date(now))};
}

const requestInput=(bookingId:string,start="2026-10-10T09:00:00.000Z")=>({
  bookingId,providerId:provider.id,providerServiceId:serviceId,requestText:"Build a five-page business website.",
  requestedStart:start,durationMinutes:120,locationMode:"CUSTOMER_LOCATION" as const,stateCode:"NG025",lgaCode:"NG025011",
  broadArea:"Ikeja",privateAddress:"12 Private Street",budgetMin:"150000",budgetMax:"250000",
});
const terms={scope:"Design and build the agreed five-page website.",deliverables:["Responsive website","Deployment"],price:"200000",deadline:"2099-11-30",revisions:2,cancellationTerms:"Cancel before work begins for a full refund.",confirmed:true as const};

test("booking state graph contains only the approved lifecycle",()=>{
  assert.deepEqual(bookingTransitions,{
    REQUESTED:["DECLINED","CANCELLED","EXPIRED","TERMS_SENT"],
    TERMS_SENT:["CANCELLED","EXPIRED","CONFIRMED"],
    DECLINED:[],CANCELLED:[],EXPIRED:[],CONFIRMED:[],
  });
});

test("booking creation is customer-only, isolated, idempotent, and location-private",async()=>{
  const {repository,bookings}=setup();
  const bookingId=randomUUID(),requestId=randomUUID();
  const created=await bookings.request(customer,requestInput(bookingId),{id:requestId,expectedVersion:0});
  assert.equal(created.booking.status,"REQUESTED");
  assert.equal(created.booking.expiresAt,"2026-10-08T09:00:00.000Z");
  assert.equal(created.replayed,false);
  const replay=await bookings.request(customer,requestInput(bookingId),{id:requestId,expectedVersion:0});
  assert.equal(replay.replayed,true);
  assert.equal(repository.eventsFor(bookingId).length,1);
  await assert.rejects(bookings.request(provider,requestInput(randomUUID()),{id:randomUUID(),expectedVersion:0}),/customer/);
  await assert.rejects(bookings.get(bookingId,otherCustomer),/access/);
  await assert.rejects(bookings.get(bookingId,otherProvider),/access/);
  assert.equal((await bookings.get(bookingId,provider)).privateAddress,undefined);
  assert.equal((await bookings.get(bookingId,customer)).privateAddress,"12 Private Street");
  assert.equal((await bookings.list(otherCustomer)).length,0);
  await assert.rejects(
    bookings.request(customer,{...requestInput(bookingId),requestText:"Different work"},{id:requestId,expectedVersion:0}),
    /identifier.*different/i,
  );
});

test("decline and cancel enforce participant roles, versions, and exact retries",async()=>{
  const {bookings}=setup();
  const declinedId=randomUUID(),declineRequest=randomUUID();
  await bookings.request(customer,requestInput(declinedId),{id:randomUUID(),expectedVersion:0});
  await assert.rejects(bookings.decline(declinedId,customer,{id:randomUUID(),expectedVersion:0}),/permission/);
  await assert.rejects(bookings.decline(declinedId,provider,{id:randomUUID(),expectedVersion:1}),ConflictError);
  const declined=await bookings.decline(declinedId,provider,{id:declineRequest,expectedVersion:0});
  assert.equal(declined.booking.status,"DECLINED");
  assert.equal((await bookings.decline(declinedId,provider,{id:declineRequest,expectedVersion:0})).replayed,true);
  await assert.rejects(bookings.cancel(declinedId,customer,{id:randomUUID(),expectedVersion:1}),/no longer available/);

  const cancelledId=randomUUID();
  await bookings.request(customer,requestInput(cancelledId,"2026-10-10T13:00:00.000Z"),{id:randomUUID(),expectedVersion:0});
  await assert.rejects(bookings.cancel(cancelledId,provider,{id:randomUUID(),expectedVersion:0}),/permission/);
  assert.equal((await bookings.cancel(cancelledId,customer,{id:randomUUID(),expectedVersion:0})).booking.status,"CANCELLED");
});

test("conversion creates one transaction and hold, blocks overlap, releases on expiry, and confirms from transaction acceptance",async()=>{
  const {repository,bookings}=setup();
  const firstId=randomUUID(),conversionRequest=randomUUID();
  await bookings.request(customer,requestInput(firstId),{id:randomUUID(),expectedVersion:0});
  const converted=await bookings.prepareTerms(firstId,provider,terms,{id:conversionRequest,expectedVersion:0});
  assert.equal(converted.booking.status,"TERMS_SENT");
  assert.equal(converted.booking.linkedJobId,firstId);
  assert.ok(converted.token);
  assert.equal(repository.linkedTransaction(firstId)?.job.sourceChannel,"TrustLink Marketplace");
  assert.equal(repository.holdFor(firstId)?.expiresAt,"2026-10-06T09:00:00.000Z");
  assert.deepEqual(repository.eventsFor(firstId).map(event=>event.eventType),["REQUEST_CREATED","TERMS_SENT","SLOT_HOLD_CREATED"]);
  const replay=await bookings.prepareTerms(firstId,provider,terms,{id:conversionRequest,expectedVersion:0});
  assert.equal(replay.replayed,true);
  assert.equal(replay.token,undefined);
  assert.equal(repository.eventsFor(firstId).length,3);

  const overlappingId=randomUUID();
  await bookings.request(customer,requestInput(overlappingId),{id:randomUUID(),expectedVersion:0});
  await assert.rejects(bookings.prepareTerms(overlappingId,provider,terms,{id:randomUUID(),expectedVersion:0}),/slot.*available/);

  repository.confirmLinkedTransaction(firstId,"2026-10-05T10:00:00.000Z");
  assert.equal((await bookings.get(firstId,provider)).status,"CONFIRMED");
  assert.equal((await bookings.get(firstId,provider)).privateAddress,"12 Private Street");
  assert.equal(repository.holdFor(firstId)?.status,"CONFIRMED");
  assert.deepEqual(repository.eventsFor(firstId).slice(-2).map(event=>event.eventType),["CLIENT_ACCEPTED_TRANSACTION","SLOT_HOLD_CONFIRMED"]);
});

test("conversion rollback leaves no partial transaction, booking event, or slot hold",async()=>{
  const {repository,bookings}=setup();
  const bookingId=randomUUID();
  await bookings.request(customer,requestInput(bookingId,"2026-10-11T09:00:00.000Z"),{id:randomUUID(),expectedVersion:0});
  repository.simulateNextConversionFailure();
  await assert.rejects(bookings.prepareTerms(bookingId,provider,terms,{id:randomUUID(),expectedVersion:0}),/Simulated/);
  assert.equal((await bookings.get(bookingId,customer)).status,"REQUESTED");
  assert.equal(repository.linkedTransaction(bookingId),undefined);
  assert.equal(repository.holdFor(bookingId),undefined);
  assert.deepEqual(repository.eventsFor(bookingId).map(event=>event.eventType),["REQUEST_CREATED"]);
});

test("expired requests and terms holds become terminal and release capacity",async()=>{
  const {repository,bookings}=setup();
  const rawId=randomUUID();
  await bookings.request(customer,requestInput(rawId,"2026-10-12T09:00:00.000Z"),{id:randomUUID(),expectedVersion:0});
  assert.equal(await bookings.expire(new Date("2026-10-08T09:00:01.000Z")),1);
  assert.equal((await bookings.get(rawId,customer)).status,"EXPIRED");

  const heldId=randomUUID();
  await bookings.request(customer,requestInput(heldId,"2026-10-12T13:00:00.000Z"),{id:randomUUID(),expectedVersion:0});
  await bookings.prepareTerms(heldId,provider,terms,{id:randomUUID(),expectedVersion:0});
  assert.equal(await bookings.expire(new Date("2026-10-06T09:00:01.000Z")),1);
  assert.equal((await bookings.get(heldId,customer)).status,"EXPIRED");
  assert.equal(repository.holdFor(heldId)?.status,"EXPIRED");
  assert.throws(()=>repository.confirmLinkedTransaction(heldId,"2026-10-06T09:00:02.000Z"),/no longer active/);
});
