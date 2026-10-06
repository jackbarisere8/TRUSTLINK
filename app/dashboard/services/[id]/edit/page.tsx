import { notFound } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { providerMarketplaceDb } from "@/lib/db/provider-marketplace";
import { ServiceForm } from "@/components/provider/service-form";
import { NearbyOriginControl } from "@/components/provider/nearby-origin-control";

export default async function EditProviderServicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireProvider();
  const { id } = await params;
  const [catalog,workspace] = await Promise.all([providerMarketplaceDb.getCatalog(),providerMarketplaceDb.getWorkspace(user.userId)]);
  const service = workspace?.services.find(candidate => candidate.id === id && candidate.status !== "ARCHIVED");
  if (!service) notFound();
  return <main id="main-content" className="shell max-w-3xl pb-16 pt-8 sm:pt-12">
    <div className="mb-9 border-b border-surface-200 pb-7"><p className="eyebrow">Provider workspace / Services / Edit</p><h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.2rem]">Edit service</h1><p className="mt-4 max-w-xl text-sm leading-7 text-surface-700">Changes to an active service update its marketplace information immediately when your profile is published.</p></div>
    <ServiceForm catalog={catalog} initial={service} />
    <NearbyOriginControl
      serviceId={service.id}
      enabled={service.areas.some(area => area.nearbyEnabled)}
      eligible={service.supportsOnsite && service.areas.some(area => !area.remoteService && Boolean(area.approximateOrigin) && area.radiusKm !== undefined)}
    />
  </main>;
}
