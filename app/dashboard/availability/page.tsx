import { requireProvider } from "@/lib/auth";
import { providerMarketplaceDb } from "@/lib/db/provider-marketplace";
import { AvailabilityForm } from "@/components/provider/availability-form";

export default async function ProviderAvailabilityPage() {
  const user = await requireProvider();
  const workspace = await providerMarketplaceDb.getWorkspace(user.userId);
  if (!workspace) return <main id="main-content" className="shell max-w-4xl py-12"><h1 className="interface-heading text-[2.5rem]">Availability</h1><p className="mt-5 text-sm text-surface-700" role="alert">Your provider availability could not be loaded.</p></main>;
  return <main id="main-content" className="shell max-w-4xl pb-16 pt-8 sm:pt-12">
    <div className="mb-10 border-b border-surface-200 pb-7"><p className="eyebrow">Provider workspace / Availability</p><h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.2rem]">Availability</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-surface-700">Set normal weekly hours and private blackout periods. This schedule describes when you can receive requests; it does not confirm a booking by itself.</p></div>
    <AvailabilityForm rules={workspace.availability} blackouts={workspace.blackouts} />
  </main>;
}
