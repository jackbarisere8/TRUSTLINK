"use client";

import { Button } from "@/components/ui/button";

export default function ProvidersError({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main id="main-content" className="grid min-h-[70vh] place-items-center bg-surface-50 px-5"><div className="max-w-lg rounded border border-surface-200 bg-white p-8 text-center"><p className="eyebrow">Provider search unavailable</p><h1 className="mt-3 text-2xl font-semibold">We could not load provider results.</h1><p className="mt-3 text-sm leading-6 text-surface-600">Your filters are still in the address bar. Retry the search, or return later if the connection is interrupted.</p><Button className="mt-6" type="button" onClick={reset}>Retry search</Button></div></main>}
