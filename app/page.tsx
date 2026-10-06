import Link from "next/link";
import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";
import { Button } from "@/components/ui/button";
import { HeroRecord } from "@/components/home/hero-record";
import { InteractiveDealSimulator } from "@/components/home/interactive-deal-simulator";
import { WhyRecordMatters } from "@/components/home/why-record-matters";
import { RecordAccountability } from "@/components/home/record-accountability";
import { ProviderCard } from "@/components/providers/provider-results";
import { getProviderSearchCatalog, getProviderSearchRepository } from "@/lib/db/provider-search";
import type { ProviderSearchFilters, ProviderSearchPage } from "@/lib/domain/provider-search";

export const metadata = {
  title: "TrustLink - Find providers and keep the work on record",
  description: "Find published service providers, compare their public TrustLink record, and keep the agreement, delivery and outcome clear.",
};
export const dynamic = "force-dynamic";

const steps = [
  ["Find", "Search published services by category, broad area, remote delivery, date or distance."],
  ["Review", "See the provider’s public profile, service coverage and eligible TrustLink activity."],
  ["Agree", "Put the scope, fee, deadline and revisions in one clear transaction record."],
  ["Accept", "The client reviews and accepts the terms before work moves forward."],
  ["Deliver", "Submit work against the agreed scope and keep decisions together."],
  ["Complete", "Close the record after approval, revision or a documented resolution."],
];

const defaultSearch:ProviderSearchFilters={remote:false,nearby:false,radiusKm:25,sort:"best",page:1,pageSize:3};

async function discoveryData(){
  const catalog=await getProviderSearchCatalog();
  let preview:ProviderSearchPage|undefined;
  try{preview=await getProviderSearchRepository().search(defaultSearch);}catch{preview=undefined;}
  return {catalog,preview};
}

export default async function Page() {
  const {catalog,preview}=await discoveryData();
  return <><Navbar/><main id="main-content">
    <section className="border-b border-[#dbe2e3] bg-[#f4f6f3] py-14 sm:py-20 lg:py-24">
      <div className="shell grid items-center gap-12 lg:grid-cols-[1.08fr_.92fr] lg:gap-16">
        <div className="max-w-2xl">
          <p className="eyebrow">TrustLink / provider marketplace</p>
          <h1 className="page-heading my-6 text-[2.8rem] text-balance sm:text-[4rem] lg:text-[4.35rem]">Find the right provider.<br/><span className="text-[#526773]">Keep the work on record.</span></h1>
          <p className="max-w-xl text-base leading-8 text-surface-700 sm:text-lg">Search active services across Nigeria. Compare broad coverage and real TrustLink activity, then keep the agreement, delivery and outcome in one shared record.</p>
          <form className="mt-8 rounded border border-surface-200 bg-white p-4 shadow-sm" action="/providers" method="get" aria-label="Find a provider">
            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto]">
              <label><span className="field-label">Service</span><input className="field" name="q" type="search" maxLength={100} placeholder="Website developer, mechanic…"/></label>
              <label><span className="field-label">Location</span><select className="field" name="state" defaultValue=""><option value="">Anywhere in Nigeria</option>{catalog.states.map(state=><option value={state.code} key={state.code}>{state.name}</option>)}</select></label>
              <button className="mt-auto h-[46px] rounded bg-navy-900 px-5 text-sm font-semibold text-white hover:bg-navy-800" type="submit">Search</button>
            </div>
          </form>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">{catalog.categories.slice(0,4).map(category=><Link key={category.slug} className="quiet-link" href={`/providers?category=${category.slug}`}>{category.name}</Link>)}</div>
          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3"><Button href="/providers" size="lg">Browse providers</Button><Link href="/signup" className="quiet-link py-3 text-sm font-semibold">Create a TrustLink →</Link><Link href="#preview" className="quiet-link py-3 text-sm font-semibold">View an example →</Link></div>
        </div>
        <div className="relative lg:pl-5"><p className="mb-3 text-xs font-medium tracking-wide text-surface-600">The agreement stays clear after you find each other</p><HeroRecord/></div>
      </div>
    </section>
    <section className="section border-b border-[#dbe2e3] bg-white" aria-labelledby="published-providers-heading"><div className="shell">
      <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow">Published provider services</p><h2 id="published-providers-heading" className="interface-heading mt-4 max-w-2xl text-[2.3rem] sm:text-[3rem]">Start with services that are actually available.</h2></div><Link className="quiet-link py-2 text-sm font-semibold" href="/providers">See all providers →</Link></div>
      {preview?.items.length?<div className="mt-10 grid gap-5 lg:grid-cols-3">{preview.items.map(item=><ProviderCard result={item} key={item.serviceId}/>)}</div>:<div className="mt-10 rounded border border-surface-200 bg-surface-50 p-7"><p className="font-semibold text-navy-900">No published provider services are available yet.</p><p className="mt-2 text-sm leading-6 text-surface-600">Results appear only after a provider’s profile and service are active. TrustLink does not fill this space with demo listings.</p><Link className="quiet-link mt-4 inline-block text-sm font-semibold" href="/for-providers">Publish your provider services →</Link></div>}
    </div></section>
    <section className="section border-b border-[#dbe2e3] bg-white"><div className="shell">
      <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr] lg:gap-16"><div><p className="eyebrow">Discovery to completion</p><h2 className="interface-heading mt-4 max-w-md text-[2.3rem] sm:text-[3rem]">The same terms stay in view from start to finish.</h2></div><p className="max-w-lg leading-7 text-surface-700 lg:pt-6">You can find a provider here or bring an existing client. Either way, the provider can write the agreement and share one link for acceptance, delivery and decisions.</p></div>
      <ol className="mt-12 grid gap-0 border-t border-[#dbe2e3] sm:grid-cols-2 lg:grid-cols-3">{steps.map(([verb,body],index)=><li key={verb} className="border-b border-[#dbe2e3] py-6 sm:pr-8 lg:py-8"><p className="font-mono text-xs text-surface-500">{String(index+1).padStart(2,"0")}</p><h3 className="mt-4 text-lg font-semibold">{verb}</h3><p className="mt-2 max-w-xs text-sm leading-6 text-surface-600">{body}</p></li>)}</ol>
    </div></section>
    <InteractiveDealSimulator/>
    <WhyRecordMatters/>
    <RecordAccountability/>
    <section className="section border-b border-[#dbe2e3] bg-white" aria-labelledby="use-cases-heading"><div className="shell"><p className="eyebrow">One record, two sides</p><h2 id="use-cases-heading" className="interface-heading mb-10 mt-4 max-w-2xl text-[2.3rem] sm:text-[3rem]">For the person doing the work and the person buying it.</h2><div className="grid gap-12 md:grid-cols-2 lg:gap-24">{[
      ["For providers","Keep the scope clear from the start.","Publish services, record terms before work begins, and build a history of completed work.","/for-providers"],
      ["For businesses","Know what was agreed. Track what happened.","Find a provider, review the deliverables, fee and deadline, then follow the work in one place.","/for-businesses"],
    ].map(([label,title,body,href])=><article key={href} className="border-t-2 border-[#0b1526] pt-7"><p className="eyebrow">{label}</p><h3 className="mb-5 mt-4 max-w-md text-[1.8rem] font-semibold leading-tight">{title}</h3><p className="max-w-md leading-7 text-surface-700">{body}</p><Link href={href} className="quiet-link mt-6 inline-block py-2 text-sm font-semibold">Read the overview →</Link></article>)}</div></div></section>
    <section className="section bg-navy-900 text-white"><div className="shell flex flex-col items-start justify-between gap-8 md:flex-row md:items-center"><div><p className="eyebrow !text-[#a9c6c7]">Ready when the terms are clear</p><h2 className="interface-heading mt-4 text-[2.3rem] text-white sm:text-[3rem]">Put the next agreement in writing.</h2></div><Button href="/signup" size="lg" className="shrink-0 bg-white text-navy-900 hover:bg-surface-100">Create a TrustLink →</Button></div></section>
  </main><Footer/></>;
}
