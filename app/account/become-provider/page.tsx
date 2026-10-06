import { redirect } from "next/navigation";
import { requireAccountUser } from "@/lib/auth";
import { ProviderOnboardingForm } from "@/components/account/provider-onboarding-form";

export const metadata = { title: "Become a provider" };

export default async function BecomeProviderPage() {
  const user = await requireAccountUser();
  if (user.providerEnabled) redirect("/dashboard/profile");
  return <main id="main-content" className="shell max-w-3xl pb-16 pt-8 sm:pt-12">
    <div className="mb-10 border-b border-[#dbe2e3] pb-7">
      <p className="eyebrow">Customer account / Provider onboarding</p>
      <h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.2rem]">Become a provider</h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-surface-700">Enable a provider workspace on this account. Your customer account, email, and existing private-link access stay unchanged.</p>
    </div>
    <ProviderOnboardingForm />
  </main>;
}
