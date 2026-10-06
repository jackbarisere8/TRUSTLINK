import assert from "node:assert/strict";
import test from "node:test";
import {
  addProviderBlackout,
  MarketplaceValidationError,
  replaceProviderAvailability,
  saveProviderService,
  type ProviderAvailabilityRule,
  type ProviderBlackoutInput,
  type ProviderMarketplaceRepository,
  type ProviderMarketplaceWorkspace,
  type ProviderServiceInput,
} from "../lib/domain/provider-marketplace";

const providerId="11111111-1111-4111-8111-111111111111";
const categoryId="10000000-0000-4000-8000-000000000001";
const definitionId="20000000-0000-4000-8000-000000000001";
const serviceId="30000000-0000-4000-8000-000000000001";

class FakeRepository implements ProviderMarketplaceRepository {
  saved?: ProviderServiceInput;
  rules?: ProviderAvailabilityRule[];
  blackout?: ProviderBlackoutInput;
  catalog={categories:[{id:categoryId,slug:"technology-digital",name:"Technology & Digital",definitions:[{id:definitionId,categoryId,slug:"website-development",name:"Website Development"}]}],states:[{code:"NG025",name:"Lagos",kind:"STATE" as const,lgas:[{code:"NG025011",stateCode:"NG025",name:"Ikeja",kind:"LGA" as const}]}]};
  workspace:ProviderMarketplaceWorkspace={providerId,marketplaceStatus:"DRAFT",moderationStatus:"DRAFT",services:[{id:serviceId,providerId,categoryId,categoryName:"Technology & Digital",serviceDefinitionId:definitionId,serviceDefinitionName:"Website Development",publicTitle:"Business website",description:"A complete website service for established small businesses.",pricingModel:"STARTING_AT",priceMin:"50000",currency:"NGN",supportsRemote:true,supportsOnsite:false,status:"PUBLISHED",durationMinutes:[60],areas:[{remoteService:true}],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}],availability:[],blackouts:[]};
  async getCatalog(){return this.catalog;}
  async getWorkspace(id:string){return id===providerId?this.workspace:null;}
  async saveService(_providerId:string,_serviceId:string|undefined,input:ProviderServiceInput){this.saved=input;}
  async archiveService(){}
  async replaceAvailability(_providerId:string,rules:ProviderAvailabilityRule[]){this.rules=rules;}
  async addBlackout(_providerId:string,input:ProviderBlackoutInput){this.blackout=input;}
  async deleteBlackout(){}
  async setPublication(){}
  async setNearbyOrigin(){}
  async listPublicServices(){return [];}
}

function validService():ProviderServiceInput {return {categoryId,serviceDefinitionId:definitionId,publicTitle:"Professional business website",description:"A complete website design and development service for small businesses.",pricingModel:"STARTING_AT",priceMin:"50000",priceMax:"150000",supportsRemote:true,supportsOnsite:true,status:"PUBLISHED",durationMinutes:[60,120],areas:[{remoteService:true},{remoteService:false,stateCode:"NG025",lgaCode:"NG025011",approximateOrigin:"Ikeja area",radiusKm:25}]};}

test("provider service validation accepts a canonical category, price, and broad service area",async()=>{
  const repository=new FakeRepository();
  await saveProviderService(repository,providerId,undefined,validService());
  assert.equal(repository.saved?.publicTitle,"Professional business website");
  assert.equal(repository.saved?.areas[1].lgaCode,"NG025011");
});

test("provider service validation rejects mismatched categories and invalid price models",async()=>{
  const repository=new FakeRepository();
  await assert.rejects(()=>saveProviderService(repository,providerId,undefined,{...validService(),categoryId:"10000000-0000-4000-8000-000000000002"}),error=>error instanceof MarketplaceValidationError&&Boolean(error.fieldErrors.categoryId));
  await assert.rejects(()=>saveProviderService(repository,providerId,undefined,{...validService(),pricingModel:"QUOTE_REQUIRED",priceMin:"50000"}),error=>error instanceof MarketplaceValidationError&&Boolean(error.fieldErrors.priceMin));
  await assert.rejects(()=>saveProviderService(repository,providerId,undefined,{...validService(),pricingModel:"FIXED",priceMin:"50000",priceMax:"60000"}),error=>error instanceof MarketplaceValidationError&&Boolean(error.fieldErrors.priceMax));
});

test("provider service validation rejects invalid state and LGA combinations",async()=>{
  const repository=new FakeRepository();
  const invalidState={...validService(),areas:[{remoteService:true},{remoteService:false,stateCode:"NG099"}]};
  await assert.rejects(()=>saveProviderService(repository,providerId,undefined,invalidState),error=>error instanceof MarketplaceValidationError&&Boolean(error.fieldErrors.stateCode));
  const invalidLga={...validService(),areas:[{remoteService:true},{remoteService:false,stateCode:"NG025",lgaCode:"NG001001"}]};
  await assert.rejects(()=>saveProviderService(repository,providerId,undefined,invalidLga),error=>error instanceof MarketplaceValidationError&&Boolean(error.fieldErrors.lgaCode));
});

test("weekly availability rejects invalid and overlapping periods",async()=>{
  const repository=new FakeRepository();
  await assert.rejects(()=>replaceProviderAvailability(repository,providerId,[{dayOfWeek:1,localStart:"10:00",localEnd:"09:00",timezone:"Africa/Lagos"}]),MarketplaceValidationError);
  await assert.rejects(()=>replaceProviderAvailability(repository,providerId,[{dayOfWeek:1,localStart:"09:00",localEnd:"13:00",timezone:"Africa/Lagos"},{dayOfWeek:1,localStart:"12:00",localEnd:"15:00",timezone:"Africa/Lagos"}]),error=>error instanceof MarketplaceValidationError&&Boolean(error.fieldErrors.localStart));
});

test("availability service ownership and blackout intervals are enforced",async()=>{
  const repository=new FakeRepository();
  await assert.rejects(()=>replaceProviderAvailability(repository,providerId,[{providerServiceId:"99999999-9999-4999-8999-999999999999",dayOfWeek:1,localStart:"09:00",localEnd:"12:00",timezone:"Africa/Lagos"}]),error=>error instanceof MarketplaceValidationError&&Boolean(error.fieldErrors.providerServiceId));
  await assert.rejects(()=>addProviderBlackout(repository,providerId,{startsAt:"2026-10-10T10:00:00+01:00",endsAt:"2026-10-10T09:00:00+01:00"}),MarketplaceValidationError);
});
