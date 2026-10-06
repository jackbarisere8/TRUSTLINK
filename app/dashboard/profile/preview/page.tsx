import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { db } from "@/lib/db";
import { providerMarketplaceDb } from "@/lib/db/provider-marketplace";
import { getButtonClasses } from "@/components/ui/button-styles";

const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function publicPrice(model: string, minimum?: string, maximum?: string) {
  if (model === "QUOTE_REQUIRED") return "Quote required";
  const minimumLabel = minimum ? `₦${Number(minimum).toLocaleString("en-NG")}` : "Price unavailable";
  if (model === "FIXED") return minimumLabel;
  const prefix = model === "STARTING_AT" ? "Starting at" : model === "HOURLY" ? "Hourly from" : "Daily from";
  return `${prefix} ${minimumLabel}${maximum ? ` to ₦${Number(maximum).toLocaleString("en-NG")}` : ""}`;
}

export default async function ProviderMarketplacePreviewPage() {
  const user = await requireProvider();
  const [bundle,workspace] = await Promise.all([db.getProfileByUsername(user.username),providerMarketplaceDb.getWorkspace(user.userId)]);
  if (!bundle?.providerProfile || !workspace) return <main id="main-content" className="shell max-w-4xl py-12"><h1 className="interface-heading text-[2.5rem]">Marketplace preview</h1><p className="mt-5 text-sm text-surface-700" role="alert">Your marketplace preview could not be loaded.</p></main>;
  const services = workspace.services.filter(service => service.status === "PUBLISHED");
  return <main id="main-content" className="shell max-w-5xl pb-16 pt-8 sm:pt-12">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-surface-200 pb-6"><div><p className="eyebrow">Private provider preview</p><p className="mt-2 text-sm text-surface-600">This is the marketplace information customers will be allowed to see after publication. Blackout notes and account details are excluded.</p></div><Link className={getButtonClasses({variant:"outline"})} href="/dashboard/services">Back to services</Link></div>
    <section className="rounded border border-surface-200 bg-white p-6 sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-800">{workspace.marketplaceStatus === "PUBLISHED" ? "Published provider" : "Preview · not published"}</p>
      <h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.4rem]">{bundle.profile.displayName}</h1>
      <p className="mt-3 text-lg font-medium text-navy-800">{bundle.providerProfile.headline}</p>
      {bundle.providerProfile.bio && <p className="mt-5 max-w-3xl text-sm leading-7 text-surface-700">{bundle.providerProfile.bio}</p>}
    </section>
    <section className="mt-10 space-y-5" aria-labelledby="preview-services-heading"><h2 id="preview-services-heading" className="text-2xl font-semibold text-navy-900">Services</h2>
      {services.length === 0 ? <p className="rounded border border-dashed border-surface-300 p-6 text-sm text-surface-600">No active service is available for public preview. Activate a complete service first.</p> : services.map(service => <article key={service.id} className="rounded border border-surface-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-500">{service.categoryName} / {service.serviceDefinitionName}</p><h3 className="mt-2 text-xl font-semibold text-navy-900">{service.publicTitle}</h3><p className="mt-3 text-sm leading-7 text-surface-700">{service.description}</p><p className="mt-4 text-sm font-semibold text-teal-900">{publicPrice(service.pricingModel,service.priceMin,service.priceMax)}</p>
        <div className="mt-5 grid gap-5 border-t border-surface-200 pt-5 sm:grid-cols-2"><div><h4 className="text-sm font-semibold text-navy-900">Service area</h4><ul className="mt-2 space-y-1 text-sm text-surface-600">{service.areas.map((area,index) => <li key={area.id || index}>{area.remoteService ? "Remote across Nigeria" : [area.approximateOrigin,area.lgaName,area.stateName].filter(Boolean).join(", ")}{area.radiusKm ? ` · within ${area.radiusKm} km` : ""}</li>)}</ul></div><div><h4 className="text-sm font-semibold text-navy-900">Available durations</h4><p className="mt-2 text-sm text-surface-600">{service.durationMinutes.map(minutes => minutes >= 1440 && minutes % 1440 === 0 ? `${minutes/1440} day${minutes===1440?"":"s"}` : `${minutes} minutes`).join(", ")}</p></div></div>
      </article>)}
    </section>
    <section className="mt-10" aria-labelledby="preview-hours-heading"><h2 id="preview-hours-heading" className="text-2xl font-semibold text-navy-900">Normal availability</h2>{workspace.availability.length ? <ul className="mt-4 grid gap-2 sm:grid-cols-2">{workspace.availability.filter(rule=>!rule.providerServiceId).map(rule => <li className="flex justify-between rounded border border-surface-200 px-4 py-3 text-sm" key={rule.id || `${rule.dayOfWeek}-${rule.localStart}`}><span className="font-medium">{days[rule.dayOfWeek]}</span><span className="text-surface-600">{rule.localStart}–{rule.localEnd} WAT</span></li>)}</ul> : <p className="mt-3 text-sm text-surface-600">Availability has not been provided.</p>}</section>
  </main>;
}
