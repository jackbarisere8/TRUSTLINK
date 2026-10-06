import { requireProvider } from "@/lib/auth";
import { providerMarketplaceDb } from "@/lib/db/provider-marketplace";
import { ServiceForm } from "@/components/provider/service-form";

export default async function NewProviderServicePage() {
  await requireProvider();
  const catalog = await providerMarketplaceDb.getCatalog();
  return <main id="main-content" className="shell max-w-3xl pb-16 pt-8 sm:pt-12">
    <div className="mb-9 border-b border-surface-200 pb-7"><p className="eyebrow">Provider workspace / Services / New</p><h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.2rem]">Add a service</h1><p className="mt-4 max-w-xl text-sm leading-7 text-surface-700">Create a clear, bookable service. Server validation checks the category, pricing, coverage, and delivery model before saving.</p></div>
    <ServiceForm catalog={catalog} />
  </main>;
}
