"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { SAMPLE_OPPORTUNITIES, OPPORTUNITY_TYPES } from "@/lib/opportunities";
import { Input } from "@/components/ui/input";
export function OpportunityListView() {
  const params=useSearchParams();const [query,setQuery]=useState(params.get("q")||"");const [type,setType]=useState(params.get("type")||"ALL");const [remote,setRemote]=useState(false);
  const career=params.get("career");
  const records=SAMPLE_OPPORTUNITIES.filter(o=>(type==="ALL"||o.type===type)&&(!remote||o.isRemote)&&(!career||career===o.careerSlug)&&[o.title,o.description,o.locationCity,o.locationState].join(" ").toLowerCase().includes(query.toLowerCase()));
  return <div><div className="notice mb-8">Example listings only. These records are not confirmed vacancies, employer partnerships or open applications. Source names and dates illustrate the information a future listing would need.</div>
    <div className="grid md:grid-cols-[1fr_240px] gap-5 mb-5"><Input label="Search examples" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Role, skill or location"/><label className="field-label">Opportunity type<select className="field mt-2" value={type} onChange={e=>setType(e.target.value)}><option value="ALL">All types</option>{OPPORTUNITY_TYPES.map(t=><option key={t.type} value={t.type}>{t.label}</option>)}</select></label></div>
    <label className="flex gap-3 items-center text-sm py-3"><input type="checkbox" checked={remote} onChange={e=>setRemote(e.target.checked)}/>Remote examples only</label><p role="status" className="text-sm text-surface-500 my-5">{records.length} examples</p>
    <div className="divide-y border-y">{records.length?records.map(o=><article key={o.id} className="py-6"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold text-lg">{o.title}</h2><span className="text-xs text-surface-500">Example · {o.type.toLowerCase()}</span></div><p className="text-sm text-surface-500 mt-2">{o.locationCity}, {o.locationState}{o.isRemote?" · Remote":""}</p><p className="text-sm leading-7 mt-4">{o.description}</p><details className="mt-4 text-sm"><summary className="cursor-pointer py-2">Illustrative listing details</summary><dl className="grid sm:grid-cols-2 gap-4 mt-4 text-xs">{[["Compensation (unverified example)",o.compensation],["Source reference (not verified)",o.provenance.sourceName],["Source URL (not a confirmed listing)",o.provenance.sourceUrl],["Date found (example)",o.provenance.dateFound],["Deadline (example)",o.deadline],["Skills",o.requiredSkills.join(", ")]].map(([k,v])=><div key={k}><dt className="text-surface-500 mb-1">{k}</dt><dd className="break-words">{v}</dd></div>)}</dl></details></article>):<p className="py-10 text-sm text-surface-500">No examples match these filters. Try a broader search.</p>}</div>
  </div>;
}
