"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import type { ProviderMarketplaceCatalog } from "@/lib/domain/provider-marketplace";
import type { ProviderSearchFilters } from "@/lib/domain/provider-search";
import { getButtonClasses } from "@/components/ui/button";

export function ProviderFilters({ catalog, initial }: { catalog: ProviderMarketplaceCatalog; initial: ProviderSearchFilters }) {
  const [open, setOpen] = useState(false);
  const [stateCode, setStateCode] = useState(initial.state || "");
  const toggleRef = useRef<HTMLButtonElement>(null);
  const lgas = useMemo(() => catalog.states.find(state => state.code === stateCode)?.lgas || [], [catalog.states,stateCode]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); toggleRef.current?.focus(); } };
    document.addEventListener("keydown",close);
    return () => document.removeEventListener("keydown",close);
  },[open]);

  return <>
    <button ref={toggleRef} type="button" className="mb-4 flex h-11 w-full items-center justify-between rounded border border-surface-200 bg-white px-4 text-sm font-semibold md:hidden" aria-expanded={open} aria-controls="provider-filters" onClick={() => setOpen(value => !value)}>
      <span className="flex items-center gap-2"><SlidersHorizontal className="size-4" aria-hidden />Filters</span>{open && <X className="size-4" aria-hidden />}
    </button>
    <aside id="provider-filters" className={`${open ? "block" : "hidden"} rounded border border-surface-200 bg-white p-5 md:block`} aria-label="Provider search filters">
      <form action="/providers" method="get" className="space-y-5">
        <label className="block text-sm font-medium text-navy-900">What service do you need?<input className="field mt-2" type="search" name="q" defaultValue={initial.q} maxLength={100} placeholder="Website developer, mechanic…" /></label>
        <label className="block text-sm font-medium text-navy-900">Category<select className="field mt-2" name="category" defaultValue={initial.category || ""}><option value="">All categories</option>{catalog.categories.map(category => <option value={category.slug} key={category.slug}>{category.name}</option>)}</select></label>
        <label className="block text-sm font-medium text-navy-900">State or FCT<select className="field mt-2" name="state" value={stateCode} onChange={event => setStateCode(event.target.value)}><option value="">Anywhere in Nigeria</option>{catalog.states.map(state => <option value={state.code} key={state.code}>{state.name}</option>)}</select></label>
        <label className="block text-sm font-medium text-navy-900">LGA or area council<select className="field mt-2" name="lga" defaultValue={initial.lga || ""} disabled={!stateCode}><option value="">All areas in state</option>{lgas.map(lga => <option value={lga.code} key={lga.code}>{lga.name}</option>)}</select></label>
        <label className="block text-sm font-medium text-navy-900">Available on<input className="field mt-2" type="date" name="date" defaultValue={initial.date} /></label>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" name="remote" value="1" defaultChecked={initial.remote} />Remote services only</label>
        <fieldset className="space-y-3 border-t border-surface-200 pt-5">
          <legend className="text-sm font-semibold text-navy-900">Nearby search</legend>
          <label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1.5" type="checkbox" name="nearby" value="1" defaultChecked={initial.nearby} /><span>Use my location after I search<span className="block text-xs text-surface-500">Your browser will ask only after you press the location button.</span></span></label>
          <label className="block text-sm font-medium text-navy-900">Maximum distance<select className="field mt-2" name="radius" defaultValue={String(initial.radiusKm)}>{[5,10,25,50].map(radius => <option value={radius} key={radius}>{radius} km</option>)}</select></label>
        </fieldset>
        <label className="block text-sm font-medium text-navy-900">Sort by<select className="field mt-2" name="sort" defaultValue={initial.sort}><option value="best">Best match</option>{initial.nearby && <option value="nearest">Nearest</option>}<option value="completed">Most completed</option><option value="rating">Highest rated</option></select></label>
        <button className={getButtonClasses({ fullWidth:true })} type="submit">Show providers</button>
        <Link className="block py-2 text-center text-sm font-semibold text-surface-600 underline underline-offset-4" href="/providers">Clear filters</Link>
      </form>
    </aside>
  </>;
}
