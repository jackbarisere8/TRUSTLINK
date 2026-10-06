import { DomainError } from "../errors";
import { availabilityRulesSchema, blackoutSchema, providerServiceSchema } from "./schemas";
import type { ProviderMarketplaceRepository, ProviderServiceInput } from "./types";

export * from "./types";
export * from "./schemas";

export type MarketplaceFieldErrors = Record<string,string[]>;

export class MarketplaceValidationError extends DomainError {
  constructor(message:string,readonly fieldErrors:MarketplaceFieldErrors={}) { super(message); }
}

function fieldErrors(error: {issues:Array<{path:PropertyKey[];message:string}>}) {
  const output: MarketplaceFieldErrors={};
  for (const issue of error.issues) {
    const key=String(issue.path.find(part=>typeof part==="string") ?? "form");
    (output[key]??=[]).push(issue.message);
  }
  return output;
}

export async function saveProviderService(repository:ProviderMarketplaceRepository,providerId:string,serviceId:string|undefined,input:unknown) {
  const parsed=providerServiceSchema.safeParse(input);
  if (!parsed.success) throw new MarketplaceValidationError("Check the highlighted service details.",fieldErrors(parsed.error));
  const catalog=await repository.getCatalog();
  const category=catalog.categories.find(candidate=>candidate.id===parsed.data.categoryId);
  if (!category) throw new MarketplaceValidationError("Choose an available category.",{categoryId:["Choose an available category."]});
  if (!category.definitions.some(definition=>definition.id===parsed.data.serviceDefinitionId)) {
    throw new MarketplaceValidationError("Choose a service from the selected category.",{serviceDefinitionId:["Choose a service from the selected category."]});
  }
  for (const area of parsed.data.areas.filter(candidate=>!candidate.remoteService)) {
    const state=catalog.states.find(candidate=>candidate.code===area.stateCode);
    if (!state) throw new MarketplaceValidationError("Choose an available state.",{stateCode:["Choose an available state."]});
    if (area.lgaCode && !state.lgas.some(lga=>lga.code===area.lgaCode)) {
      throw new MarketplaceValidationError("Choose an LGA in the selected state.",{lgaCode:["Choose an LGA in the selected state."]});
    }
  }
  await repository.saveService(providerId,serviceId,parsed.data as ProviderServiceInput);
}

export async function replaceProviderAvailability(repository:ProviderMarketplaceRepository,providerId:string,input:unknown) {
  const parsed=availabilityRulesSchema.safeParse(input);
  if (!parsed.success) throw new MarketplaceValidationError("Check the highlighted availability periods.",fieldErrors(parsed.error));
  const workspace=await repository.getWorkspace(providerId);
  if (!workspace) throw new DomainError("Provider profile not found.");
  const owned=new Set(workspace.services.filter(service=>service.status!=="ARCHIVED").map(service=>service.id));
  if (parsed.data.some(rule=>rule.providerServiceId && !owned.has(rule.providerServiceId))) {
    throw new MarketplaceValidationError("Choose one of your active services.",{providerServiceId:["Choose one of your active services."]});
  }
  await repository.replaceAvailability(providerId,parsed.data);
}

export async function addProviderBlackout(repository:ProviderMarketplaceRepository,providerId:string,input:unknown) {
  const parsed=blackoutSchema.safeParse(input);
  if (!parsed.success) throw new MarketplaceValidationError("Check the blackout period.",fieldErrors(parsed.error));
  await repository.addBlackout(providerId,parsed.data);
}
