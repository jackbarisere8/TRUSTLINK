"use client";

import { useState, useTransition } from "react";
import { LocateFixed, ShieldCheck } from "lucide-react";
import { searchNearbyProvidersAction } from "@/app/actions/provider-search";
import { Button } from "@/components/ui/button";
import type { ProviderSearchPage, SearchParamInput } from "@/lib/domain/provider-search";
import { ProviderResults } from "./provider-results";

export function NearbySearch({ query, radiusKm }: { query: SearchParamInput; radiusKm: 5|10|25|50 }) {
  const [data,setData]=useState<ProviderSearchPage>();
  const [location,setLocation]=useState<{latitude:number;longitude:number}>();
  const [error,setError]=useState("");
  const [pending,startTransition]=useTransition();

  const run = (coordinates:{latitude:number;longitude:number},page=1) => startTransition(async () => {
    setError("");
    const result=await searchNearbyProvidersAction({...query,page:String(page)}, {...coordinates,radiusKm});
    if (result.error) {setError(result.error);return;}
    setData(result.data);
  });
  const ask = () => {
    setError("");
    if (!navigator.geolocation) {setError("Location is unavailable in this browser. Use state or LGA filters instead.");return;}
    navigator.geolocation.getCurrentPosition(position=>{
      const coordinates={latitude:position.coords.latitude,longitude:position.coords.longitude};
      setLocation(coordinates);run(coordinates);
    },geoError=>setError(geoError.code===1?"Location permission was denied. You can continue with state, LGA, or remote filters.":"Your location is unavailable right now. Try again or use state and LGA filters."),{enableHighAccuracy:false,timeout:10_000,maximumAge:60_000});
  };

  if (!data) return <section className="rounded border border-teal-200 bg-teal-50 p-6" aria-labelledby="nearby-search-heading">
    <div className="flex items-start gap-3"><LocateFixed className="mt-1 size-5 shrink-0 text-teal-800" aria-hidden /><div><h2 id="nearby-search-heading" className="text-lg font-semibold text-navy-900">Find providers within {radiusKm} km</h2><p className="mt-2 text-sm leading-6 text-surface-700">Location access happens only when you press the button. Your coordinates are used once on the server to measure distance and are not put in the URL, public page, profile, or analytics.</p></div></div>
    <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-surface-600"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />You can deny access and keep searching with state, LGA, remote, and date filters.</p>
    {error && <p className="mt-4 border border-red-200 bg-white p-3 text-sm font-medium text-danger-text" role="alert">{error}</p>}
    <Button className="mt-5" type="button" loading={pending} onClick={ask}>Use my location</Button>
  </section>;

  return <div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-surface-700"><strong>{data.total}</strong> provider service{data.total===1?"":"s"} within {radiusKm} km</p><Button type="button" variant="outline" size="sm" onClick={ask} loading={pending}>Refresh location</Button></div>
    {data.items.length ? <ProviderResults data={data}/> : <EmptyNearby/>}
    {data.pageCount>1&&location&&<nav className="mt-6 flex items-center justify-between" aria-label="Nearby result pages"><Button type="button" variant="outline" disabled={data.page<=1} onClick={()=>run(location,data.page-1)}>Previous</Button><p className="text-sm text-surface-600">Page {data.page} of {data.pageCount}</p><Button type="button" variant="outline" disabled={data.page>=data.pageCount} onClick={()=>run(location,data.page+1)}>Next</Button></nav>}
  </div>;
}

function EmptyNearby(){return <div className="rounded border border-surface-200 bg-white p-8 text-center"><h2 className="text-xl font-semibold">No nearby providers matched</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-surface-600">Try a wider radius, remove the date or category, or turn off nearby search and choose a state or remote service.</p></div>}
