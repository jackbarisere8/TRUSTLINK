import type { ProviderMarketplaceCatalog } from "../provider-marketplace";
import { privateNearbySchema, providerSearchParamsSchema } from "./schemas";
import type { PrivateNearbyInput, ProviderSearchFilters, ProviderSearchPage, SearchCandidate } from "./types";

export * from "./types";
export * from "./schemas";
export { providerSearchCategories } from "./catalog";

export type SearchParamInput = Record<string,string|string[]|undefined>;

export function parseProviderSearchParams(input:SearchParamInput,catalog:ProviderMarketplaceCatalog) {
  const allowed=new Set(["q","category","state","lga","remote","date","nearby","radius","sort","page"]);
  const unknown=Object.keys(input).filter(key=>!allowed.has(key));
  const selected=Object.fromEntries(Object.entries(input).filter(([key])=>allowed.has(key)));
  const parsed=providerSearchParamsSchema.safeParse(selected);
  const fallback:ProviderSearchFilters={remote:false,nearby:false,radiusKm:25,sort:"best",page:1,pageSize:12};
  if (!parsed.success) return {filters:fallback,issues:["Some search filters were invalid and have been reset."]};
  const issues=unknown.length?["Unsupported search filters were ignored."]:[];
  const category=parsed.data.category && catalog.categories.some(candidate=>candidate.slug===parsed.data.category) ? parsed.data.category : undefined;
  if (parsed.data.category&&!category) issues.push("The selected category is unavailable and was ignored.");
  const stateCode=parsed.data.state || undefined;
  const state=stateCode ? catalog.states.find(candidate=>candidate.code===stateCode) : undefined;
  if (parsed.data.state&&!state) issues.push("The selected state is unavailable and was ignored.");
  const lga=parsed.data.lga && state?.lgas.some(candidate=>candidate.code===parsed.data.lga) ? parsed.data.lga : undefined;
  if (parsed.data.lga&&!lga) issues.push("The selected LGA does not belong to the selected state and was ignored.");
  const nearby=parsed.data.nearby;
  let sort=parsed.data.sort;
  if (sort==="nearest"&&!nearby) {sort="best";issues.push("Nearest sorting requires location access.");}
  return {filters:{q:parsed.data.q,category,state:state?.code,lga,remote:parsed.data.remote,date:parsed.data.date,nearby,radiusKm:parsed.data.radius,sort,page:parsed.data.page,pageSize:12} satisfies ProviderSearchFilters,issues};
}

export function distanceKm(latitude1:number,longitude1:number,latitude2:number,longitude2:number) {
  const radians=(degrees:number)=>degrees*Math.PI/180;
  const latitudeDelta=radians(latitude2-latitude1),longitudeDelta=radians(longitude2-longitude1);
  const a=Math.sin(latitudeDelta/2)**2+Math.cos(radians(latitude1))*Math.cos(radians(latitude2))*Math.sin(longitudeDelta/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function textScore(candidate:SearchCandidate,query:string|undefined) {
  if (!query) return 0;
  const needle=query.toLocaleLowerCase();
  const exact=[candidate.publicTitle,candidate.serviceName].some(value=>value.toLocaleLowerCase()===needle);
  if (exact) return 100;
  const primary=[candidate.publicTitle,candidate.serviceName,candidate.categoryName,...(candidate.privateSearchAliases||[])].join(" ").toLocaleLowerCase();
  if (primary.includes(needle)) return 60;
  const secondary=[candidate.description,candidate.providerName,candidate.providerHeadline].join(" ").toLocaleLowerCase();
  return secondary.includes(needle)?25:0;
}

export function searchCandidates(candidates:SearchCandidate[],filters:ProviderSearchFilters,nearbyInput?:PrivateNearbyInput):ProviderSearchPage {
  const nearby=nearbyInput?privateNearbySchema.parse(nearbyInput):undefined;
  const requestedDay=filters.date?new Date(`${filters.date}T12:00:00+01:00`).getUTCDay():undefined;
  const eligible=candidates.flatMap(candidate=>{
    const score=textScore(candidate,filters.q);
    if (filters.q&&score===0) return [];
    if (filters.category&&candidate.categorySlug!==filters.category) return [];
    if (filters.remote&&!candidate.supportsRemote) return [];
    if (filters.state&&!candidate.serviceAreas.some(area=>!area.remoteService&&area.stateCode===filters.state)) return [];
    if (filters.lga&&!candidate.serviceAreas.some(area=>!area.remoteService&&area.lgaCode===filters.lga)) return [];
    const available=filters.date?candidate.availability.some(rule=>rule.dayOfWeek===requestedDay&&(!rule.effectiveFrom||rule.effectiveFrom<=filters.date!)&&(!rule.effectiveTo||rule.effectiveTo>=filters.date!)):false;
    if (filters.date&&!available) return [];
    let distance: number|undefined;
    if (nearby) {
      const values=(candidate.privateOrigins||[]).map(origin=>({distance:distanceKm(nearby.latitude,nearby.longitude,origin.latitude,origin.longitude),providerRadius:origin.radiusKm}));
      const match=values.filter(value=>value.distance<=nearby.radiusKm&&(value.providerRadius===undefined||value.distance<=value.providerRadius)).sort((a,b)=>a.distance-b.distance)[0];
      if (!match) return [];
      distance=Math.round(match.distance*10)/10;
    }
    return [{candidate:{...candidate,distanceKm:distance,availableOnRequestedDate:available},score}];
  });
  eligible.sort((left,right)=>{
    const a=left.candidate,b=right.candidate;
    if (filters.sort==="nearest") return (a.distanceKm??Infinity)-(b.distanceKm??Infinity)||a.providerName.localeCompare(b.providerName)||a.serviceId.localeCompare(b.serviceId);
    if (filters.sort==="completed") return b.completedTransactions-a.completedTransactions||right.score-left.score||a.providerName.localeCompare(b.providerName)||a.serviceId.localeCompare(b.serviceId);
    if (filters.sort==="rating") {
      const ar=a.reviewCount>=3?a.averageRating??-1:-1,br=b.reviewCount>=3?b.averageRating??-1:-1;
      return br-ar||b.reviewCount-a.reviewCount||a.providerName.localeCompare(b.providerName)||a.serviceId.localeCompare(b.serviceId);
    }
    return right.score-left.score||b.completedTransactions-a.completedTransactions||a.providerName.localeCompare(b.providerName)||a.serviceId.localeCompare(b.serviceId);
  });
  const start=(filters.page-1)*filters.pageSize,total=eligible.length;
  return {items:eligible.slice(start,start+filters.pageSize).map(item=>{const {privateOrigins:_,privateSearchAliases:__,...result}=item.candidate;void _;void __;return result;}),total,page:filters.page,pageSize:filters.pageSize,pageCount:Math.ceil(total/filters.pageSize)};
}
