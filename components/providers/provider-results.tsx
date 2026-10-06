import Link from "next/link";
import { CheckCircle2, MapPin, Star } from "lucide-react";
import type { ProviderSearchPage, ProviderSearchResult } from "@/lib/domain/provider-search";

function money(value: string | undefined) {
  if (!value) return undefined;
  return new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(Number(value));
}

function price(result: ProviderSearchResult) {
  if (result.pricingModel === "QUOTE_REQUIRED") return "Quote required";
  const low=money(result.priceMin),high=money(result.priceMax);
  if (result.pricingModel === "FIXED") return low || "Price on request";
  if (result.pricingModel === "HOURLY") return low ? `${low} / hour` : "Price on request";
  if (result.pricingModel === "DAILY") return low ? `${low} / day` : "Price on request";
  return low ? `From ${low}${high ? ` – ${high}` : ""}` : "Price on request";
}

function broadArea(result: ProviderSearchResult) {
  const physical = result.serviceAreas.filter(area => !area.remoteService);
  const labels = physical.map(area => area.lgaName || area.stateName || area.approximateOrigin).filter(Boolean);
  if (labels.length) return [...new Set(labels)].slice(0,2).join(" · ");
  return result.supportsRemote ? "Remote across Nigeria" : "Service area listed on profile";
}

export function ProviderCard({ result }: { result: ProviderSearchResult }) {
  const eligibleRating=result.reviewCount>=3&&result.averageRating!==undefined;
  return <article className="rounded border border-surface-200 bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">{result.categoryName} / {result.serviceName}</p><h2 className="mt-2 text-xl font-semibold text-navy-900">{result.publicTitle}</h2><p className="mt-1 text-sm font-medium text-surface-700">{result.providerName}</p></div><p className="text-sm font-semibold text-navy-900">{price(result)}</p></div>
    <p className="mt-4 line-clamp-2 text-sm leading-6 text-surface-600">{result.description}</p>
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-y border-surface-100 py-4 text-xs text-surface-700">
      <span className="flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden />{result.distanceKm !== undefined ? `${result.distanceKm.toFixed(1)} km away · ` : ""}{broadArea(result)}</span>
      <span>{result.supportsRemote && result.supportsOnsite ? "Remote or on-site" : result.supportsRemote ? "Remote" : "On-site"}</span>
      <span>{result.completedTransactions ? `${result.completedTransactions} completed` : "New provider"}</span>
      {eligibleRating ? <span className="flex items-center gap-1"><Star className="size-3.5 fill-current text-amber-500" aria-hidden />{result.averageRating?.toFixed(1)} ({result.reviewCount})</span> : <span>Rating shown after 3 reviews</span>}
      {result.availableOnRequestedDate && <span className="flex items-center gap-1 text-teal-800"><CheckCircle2 className="size-3.5" aria-hidden />Availability checked</span>}
    </div>
    <div className="mt-5 flex items-center justify-between gap-4"><p className="text-xs text-surface-500">{result.providerHeadline}</p><Link className="shrink-0 text-sm font-semibold text-teal-800 underline decoration-teal-200 underline-offset-4 hover:decoration-teal-700" href={`/p/${encodeURIComponent(result.providerUsername)}`}>View profile →</Link></div>
  </article>;
}

export function ProviderResults({ data }: { data: ProviderSearchPage }) {
  return <div className="space-y-4" aria-live="polite">{data.items.map(result => <ProviderCard key={result.serviceId} result={result} />)}</div>;
}
