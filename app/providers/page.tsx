import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/navigation/footer";
import { Navbar } from "@/components/navigation/navbar";
import { NearbySearch } from "@/components/providers/nearby-search";
import { ProviderFilters } from "@/components/providers/provider-filters";
import { ProviderResults } from "@/components/providers/provider-results";
import { getProviderSearchCatalog, getProviderSearchRepository } from "@/lib/db/provider-search";
import { parseProviderSearchParams, type ProviderSearchFilters, type SearchParamInput } from "@/lib/domain/provider-search";

export const metadata:Metadata={title:"Find a provider | TrustLink",description:"Search active TrustLink providers by service, broad area, remote delivery, availability, and distance."};

function canonical(filters:ProviderSearchFilters,page=filters.page):SearchParamInput {
  return {q:filters.q,category:filters.category,state:filters.state,lga:filters.lga,remote:filters.remote?"1":undefined,date:filters.date,nearby:filters.nearby?"1":undefined,radius:String(filters.radiusKm),sort:filters.sort,page:String(page)};
}
function hrefFor(filters:ProviderSearchFilters,page:number){
  const params=new URLSearchParams();
  Object.entries(canonical(filters,page)).forEach(([key,value])=>{if(typeof value==="string"&&value)params.set(key,value);});
  return `/providers?${params}`;
}
function rankingCopy(filters:ProviderSearchFilters){
  if(filters.sort==="nearest")return "Nearest orders eligible providers by rounded distance, then name. Exact coordinates remain private.";
  if(filters.sort==="completed")return "Most completed orders by completed TrustLink transaction count, with text relevance as a tie-breaker.";
  if(filters.sort==="rating")return "Highest rated includes a rating rank only after at least three completed-job reviews.";
  return "Best match considers your words first, then completed TrustLink transactions, with stable name and service tie-breakers.";
}

export default async function ProvidersPage({searchParams}:{searchParams:Promise<SearchParamInput>}){
  const [raw,catalog]=await Promise.all([searchParams,getProviderSearchCatalog()]);
  const {filters,issues}=parseProviderSearchParams(raw,catalog);
  const data=filters.nearby?undefined:await getProviderSearchRepository().search(filters);
  return <><Navbar/><main id="main-content" className="min-h-[70vh] bg-surface-50 pb-20">
    <header className="border-b border-surface-200 bg-white"><div className="shell py-10 sm:py-14"><p className="eyebrow">TrustLink marketplace</p><h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.5rem]">Find a provider for the work.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-surface-600">Search published services, compare broad coverage and verified TrustLink activity, then view the provider’s public record.</p></div></header>
    <div className="shell pt-7">
      {issues.length>0&&<div className="mb-5 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status"><p className="font-semibold">We adjusted this search.</p><ul className="mt-1 list-disc pl-5">{issues.map(issue=><li key={issue}>{issue}</li>)}</ul></div>}
      <div className="grid gap-7 md:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
        <ProviderFilters catalog={catalog} initial={filters}/>
        <section aria-labelledby="provider-results-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 id="provider-results-heading" className="text-xl font-semibold text-navy-900">{filters.nearby?"Nearby results":data?.total?`${data.total} matching provider service${data.total===1?"":"s"}`:"Provider results"}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-surface-500">{rankingCopy(filters)}</p></div></div>
          {filters.nearby?<NearbySearch query={canonical(filters)} radiusKm={filters.radiusKm}/>:data&&data.items.length?<><ProviderResults data={data}/>{data.pageCount>1&&<nav className="mt-7 flex items-center justify-between" aria-label="Provider result pages"><Link aria-disabled={data.page<=1} tabIndex={data.page<=1?-1:undefined} className={`rounded border border-surface-200 bg-white px-4 py-3 text-sm font-semibold ${data.page<=1?"pointer-events-none opacity-50":"hover:bg-surface-100"}`} href={hrefFor(filters,data.page-1)}>Previous</Link><p className="text-sm text-surface-600">Page {data.page} of {data.pageCount}</p><Link aria-disabled={data.page>=data.pageCount} tabIndex={data.page>=data.pageCount?-1:undefined} className={`rounded border border-surface-200 bg-white px-4 py-3 text-sm font-semibold ${data.page>=data.pageCount?"pointer-events-none opacity-50":"hover:bg-surface-100"}`} href={hrefFor(filters,data.page+1)}>Next</Link></nav>}</>:<EmptyResults/>}
        </section>
      </div>
    </div>
  </main><Footer/></>;
}

function EmptyResults(){return <div className="rounded border border-surface-200 bg-white p-8 sm:p-12"><p className="eyebrow">No published match</p><h2 className="mt-3 text-2xl font-semibold text-navy-900">Try a broader search</h2><p className="mt-3 max-w-lg text-sm leading-6 text-surface-600">Remove the date or location, search a broader category, or include remote services. TrustLink does not add demo providers to live results.</p><div className="mt-6 flex flex-wrap gap-4"><Link className="text-sm font-semibold text-teal-800 underline underline-offset-4" href="/providers">Clear every filter</Link><Link className="text-sm font-semibold text-surface-700 underline underline-offset-4" href="/for-providers">Are you a provider?</Link></div></div>}
