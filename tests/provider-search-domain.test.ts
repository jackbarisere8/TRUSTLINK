import assert from "node:assert/strict";
import test from "node:test";
import { parseProviderSearchParams, searchCandidates, type ProviderSearchFilters, type SearchCandidate } from "../lib/domain/provider-search";
import type { ProviderMarketplaceCatalog } from "../lib/domain/provider-marketplace";
import { providerSearchCategories } from "../lib/domain/provider-search/catalog";

const catalog:ProviderMarketplaceCatalog={categories:providerSearchCategories,states:[{code:"NG025",name:"Lagos",kind:"STATE",lgas:[{code:"NG025011",stateCode:"NG025",name:"Ikeja",kind:"LGA"}]},{code:"NG015",name:"Enugu",kind:"STATE",lgas:[]}]};
const filters=(patch:Partial<ProviderSearchFilters>={}):ProviderSearchFilters=>({remote:false,nearby:false,radiusKm:25,sort:"best",page:1,pageSize:12,...patch});
function candidate(id:number,patch:Partial<SearchCandidate>={}):SearchCandidate{return {
  serviceId:`30000000-0000-4000-8000-${String(id).padStart(12,"0")}`,providerUsername:`provider-${id}`,providerName:`Provider ${String(id).padStart(2,"0")}`,providerHeadline:"Trusted local professional",
  serviceSlug:"website-development",serviceName:"Website Development",categorySlug:"technology-digital",categoryName:"Technology & Digital",publicTitle:"Business website development",description:"Responsive websites for small businesses.",
  pricingModel:"STARTING_AT",priceMin:"50000",currency:"NGN",supportsRemote:true,supportsOnsite:true,durations:[{durationMinutes:60}],serviceAreas:[{remoteService:true},{remoteService:false,stateCode:"NG025",stateName:"Lagos",lgaCode:"NG025011",lgaName:"Ikeja",approximateOrigin:"Ikeja area",radiusKm:25}],
  availability:[{dayOfWeek:1,localStart:"09:00",localEnd:"17:00",timezone:"Africa/Lagos"}],completedTransactions:id,reviewCount:0,availableOnRequestedDate:false,...patch,
};}

test("provider query parsing validates canonical categories and related state/LGA filters",()=>{
  const valid=parseProviderSearchParams({q:" website ",category:"technology-digital",state:"NG025",lga:"NG025011",remote:"1",page:"2"},catalog);
  assert.deepEqual({q:valid.filters.q,state:valid.filters.state,lga:valid.filters.lga,remote:valid.filters.remote,page:valid.filters.page},{q:"website",state:"NG025",lga:"NG025011",remote:true,page:2});
  const invalid=parseProviderSearchParams({category:"made-up",state:"NG015",lga:"NG025011",sort:"nearest",secret:"value"},catalog);
  assert.equal(invalid.filters.category,undefined);assert.equal(invalid.filters.lga,undefined);assert.equal(invalid.filters.sort,"best");assert.ok(invalid.issues.length>=4);
  const malformed=parseProviderSearchParams({page:"zero",state:"Lagos"},catalog);
  assert.equal(malformed.filters.page,1);assert.match(malformed.issues[0],/invalid/i);
  assert.equal(parseProviderSearchParams({date:"2026-02-30"},catalog).filters.date,undefined);
});

test("text, category, state, LGA, remote and date filters return only genuine matches",()=>{
  const website=candidate(1,{privateSearchAliases:["web developer","website designer"]});
  const mechanic=candidate(2,{serviceSlug:"auto-mechanic",serviceName:"Auto Mechanic",categorySlug:"auto-mobility",categoryName:"Auto & Mobility",publicTitle:"Mobile vehicle mechanic",supportsRemote:false,availability:[{dayOfWeek:2,localStart:"09:00",localEnd:"17:00",timezone:"Africa/Lagos"}]});
  assert.deepEqual(searchCandidates([website,mechanic],filters({q:"website",category:"technology-digital",state:"NG025",lga:"NG025011",remote:true}),undefined).items.map(item=>item.serviceId),[website.serviceId]);
  assert.equal(searchCandidates([website,mechanic],filters({q:"web developer"}),undefined).total,1);
  assert.equal(searchCandidates([website,mechanic],filters({date:"2026-10-05"}),undefined).total,1); // Monday in Africa/Lagos
  assert.equal(searchCandidates([mechanic],filters({remote:true}),undefined).total,0);
});

test("nearby matching respects visitor and provider radius boundaries without returning private origins",()=>{
  const inside=candidate(1,{privateOrigins:[{latitude:6.60,longitude:3.35,radiusKm:5}]});
  const outsideProviderRadius=candidate(2,{privateOrigins:[{latitude:6.645,longitude:3.35,radiusKm:3}]});
  const outsideVisitorRadius=candidate(3,{privateOrigins:[{latitude:6.70,longitude:3.35,radiusKm:50}]});
  const data=searchCandidates([inside,outsideProviderRadius,outsideVisitorRadius],filters({nearby:true,radiusKm:5,sort:"nearest"}),{latitude:6.60,longitude:3.35,radiusKm:5});
  assert.equal(data.total,1);assert.equal(data.items[0].serviceId,inside.serviceId);assert.equal(data.items[0].distanceKm,0);
  assert.doesNotMatch(JSON.stringify(data),/privateOrigins|latitude|longitude/);
});

test("sorting and pagination are stable, and rating requires three reviews",()=>{
  const items=[candidate(3,{providerName:"Alpha",averageRating:5,reviewCount:2}),candidate(2,{providerName:"Beta",averageRating:4.8,reviewCount:3}),candidate(1,{providerName:"Gamma",averageRating:4.9,reviewCount:3})];
  const rated=searchCandidates(items,filters({sort:"rating",pageSize:2}),undefined);
  assert.deepEqual(rated.items.map(item=>item.providerName),["Gamma","Beta"]);assert.equal(rated.pageCount,2);
  const second=searchCandidates(items,filters({sort:"rating",page:2,pageSize:2}),undefined);
  assert.deepEqual(second.items.map(item=>item.providerName),["Alpha"]);
  assert.deepEqual(searchCandidates(items,filters({sort:"completed"}),undefined).items.map(item=>item.completedTransactions),[3,2,1]);
});
