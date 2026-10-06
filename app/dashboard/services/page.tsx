import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { providerMarketplaceDb } from "@/lib/db/provider-marketplace";
import { ArchiveServiceButton, PublicationControl } from "@/components/provider/marketplace-controls";
import { getButtonClasses } from "@/components/ui/button-styles";

function priceLabel(model: string, minimum?: string, maximum?: string) {
  if (model === "QUOTE_REQUIRED") return "Quote required";
  const amount = minimum ? `₦${Number(minimum).toLocaleString("en-NG")}` : "Price not set";
  if (model === "FIXED") return amount;
  const prefix = model === "STARTING_AT" ? "From" : model === "HOURLY" ? "Per hour from" : "Per day from";
  return `${prefix} ${amount}${maximum ? ` – ₦${Number(maximum).toLocaleString("en-NG")}` : ""}`;
}

export default async function ProviderServicesPage() {
  const user = await requireProvider();
  const workspace = await providerMarketplaceDb.getWorkspace(user.userId);
  if (!workspace) return <main id="main-content" className="shell max-w-4xl py-12"><h1 className="interface-heading text-[2.5rem]">Provider services</h1><p className="mt-5 text-sm text-surface-700" role="alert">Your provider marketplace workspace could not be loaded.</p></main>;
  const active = workspace.services.filter(service => service.status !== "ARCHIVED");
  const archived = workspace.services.filter(service => service.status === "ARCHIVED");
  const canPublish = active.some(service => service.status === "PUBLISHED");
  const published = workspace.marketplaceStatus === "PUBLISHED";

  return <main id="main-content" className="shell max-w-5xl pb-16 pt-8 sm:pt-12">
    <div className="flex flex-col justify-between gap-6 border-b border-surface-200 pb-8 sm:flex-row sm:items-end">
      <div><p className="eyebrow">Provider workspace / Services</p><h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.2rem]">Your marketplace services</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-surface-700">Define the work you offer, where you deliver it, and honest price expectations. A service must be active before your marketplace profile can be published.</p></div>
      <Link href="/dashboard/services/new" className={getButtonClasses({variant:"primary"})}>Add a service</Link>
    </div>

    <section className="mt-8 grid gap-5 rounded border border-surface-200 bg-surface-50 p-5 sm:grid-cols-[1fr_auto] sm:items-center" aria-labelledby="publication-heading">
      <div><h2 id="publication-heading" className="text-lg font-semibold text-navy-900">Marketplace publication</h2><p className="mt-1 text-sm leading-6 text-surface-600">Status: <strong>{published ? "Published" : workspace.marketplaceStatus === "SUSPENDED" ? "Suspended" : "Private draft"}</strong>. Publishing makes only active services and broad coverage visible to marketplace discovery.</p></div>
      <PublicationControl published={published} canPublish={canPublish} />
    </section>
    <div className="mt-4"><Link className="quiet-link inline-block py-2 text-sm font-semibold" href="/dashboard/profile/preview">Preview marketplace profile →</Link></div>

    <section className="mt-10 space-y-4" aria-labelledby="active-services-heading">
      <h2 id="active-services-heading" className="text-xl font-semibold text-navy-900">Current services</h2>
      {active.length === 0 ? <div className="rounded border border-dashed border-surface-300 p-8 text-center"><p className="text-sm text-surface-600">You have not created a marketplace service yet.</p><Link href="/dashboard/services/new" className="quiet-link mt-3 inline-block py-2 text-sm font-semibold">Create your first service →</Link></div> : active.map(service => <article key={service.id} className="rounded border border-surface-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold text-navy-900">{service.publicTitle}</h3><span className={`rounded-full px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${service.status === "PUBLISHED" ? "bg-teal-50 text-teal-800" : "bg-surface-100 text-surface-600"}`}>{service.status === "PUBLISHED" ? "Active" : "Draft"}</span></div><p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-surface-500">{service.categoryName} / {service.serviceDefinitionName}</p><p className="mt-3 line-clamp-2 text-sm leading-6 text-surface-700">{service.description}</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-surface-600"><span>{priceLabel(service.pricingModel,service.priceMin,service.priceMax)}</span><span>{service.durationMinutes.map(minutes => `${minutes} min`).join(", ")}</span><span>{service.supportsRemote ? "Remote" : ""}{service.supportsRemote && service.supportsOnsite ? " + " : ""}{service.supportsOnsite ? "On-site" : ""}</span></div></div>
          <div className="flex shrink-0 flex-wrap items-start gap-2"><Link href={`/dashboard/services/${service.id}/edit`} className={getButtonClasses({variant:"outline",size:"sm"})}>Edit</Link><ArchiveServiceButton serviceId={service.id} /></div>
        </div>
      </article>)}
    </section>

    {archived.length > 0 && <section className="mt-12 space-y-3" aria-labelledby="archived-services-heading"><h2 id="archived-services-heading" className="text-lg font-semibold text-navy-900">Archived services</h2>{archived.map(service => <div key={service.id} className="flex justify-between gap-4 border-b border-surface-200 py-3 text-sm"><span className="font-medium text-surface-700">{service.publicTitle}</span><span className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-500">Archived</span></div>)}</section>}
  </main>;
}
