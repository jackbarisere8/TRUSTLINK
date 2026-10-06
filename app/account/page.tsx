import { requireAccountUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Your account" };

export default async function AccountPage() {
  const user = await requireAccountUser();
  const bundle = await db.getProfileBundleByUserId(user.userId);
  if (!bundle) return null;
  return <main id="main-content" className="shell max-w-5xl pb-16 pt-8 sm:pt-12">
    <div className="mb-10 max-w-2xl">
      <p className="eyebrow">Customer account</p>
      <h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.2rem]">Welcome, {bundle.profile.displayName}</h1>
      <p className="mt-4 text-sm leading-7 text-surface-700">Use this account to manage your personal details and, when marketplace booking launches, service requests placed with providers.</p>
    </div>
    <dl className="mb-10 divide-y border-y border-[#dbe2e3]">
      <div className="grid gap-1 py-5 sm:grid-cols-[10rem_1fr]"><dt className="field-label">Email</dt><dd className="text-sm">{user.email}</dd></div>
      <div className="grid gap-1 py-5 sm:grid-cols-[10rem_1fr]"><dt className="field-label">Account access</dt><dd className="text-sm">Customer{user.providerEnabled ? " and provider" : ""}</dd></div>
    </dl>
    <section className="border-y border-[#dbe2e3] py-8" aria-labelledby="customer-activity-heading">
      <h2 id="customer-activity-heading" className="text-xl font-semibold">Customer activity</h2>
      <p className="mt-4 max-w-xl text-sm leading-7 text-surface-600">No marketplace bookings yet. Booking and provider discovery are introduced in later phases; existing private transaction links continue to work without a customer account.</p>
    </section>
    <section className="mt-10 border-b border-[#dbe2e3] pb-8" aria-labelledby="provider-access-heading">
      <h2 id="provider-access-heading" className="text-xl font-semibold">Provider access</h2>
      {user.providerEnabled ? <>
        <p className="mt-4 max-w-xl text-sm leading-7 text-surface-600">Your provider workspace is enabled. You can switch between customer and provider contexts without creating another account.</p>
        <Button className="mt-6" href="/dashboard">Open provider workspace</Button>
      </> : <>
        <p className="mt-4 max-w-xl text-sm leading-7 text-surface-600">Offer services with the same TrustLink account. Only a professional headline and broad service area are needed to create a private provider draft.</p>
        <Button className="mt-6" href="/account/become-provider">Become a provider</Button>
      </>}
    </section>
  </main>;
}
