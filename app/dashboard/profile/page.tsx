import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function ProviderProfilePage() {
  const user = await requireProvider();
  const data = await db.getProfileByUsername(user.username);
  if (!data?.providerProfile) return <main id="main-content" className="shell max-w-3xl py-12"><h1 className="interface-heading text-[2.5rem]">Your provider profile</h1><p className="mt-5 text-sm text-surface-700" role="alert">Your profile could not be loaded. Try again.</p></main>;

  const profile = data.profile;
  const provider = data.providerProfile;
  const isPublic = provider.marketplaceStatus === "NOT_LISTED" || provider.marketplaceStatus === "PUBLISHED";
  const status = provider.marketplaceStatus === "DRAFT" ? "Draft" : provider.marketplaceStatus === "PUBLISHED" ? "Published" : provider.marketplaceStatus === "SUSPENDED" ? "Suspended" : "Trust Profile";

  return <main id="main-content" className="shell max-w-3xl pb-16 pt-8 sm:pt-12">
    <div className="mb-10 border-b border-[#dbe2e3] pb-7">
      <p className="eyebrow">Provider workspace / Profile</p>
      <h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.2rem]">Your provider profile</h1>
      <p className="mt-4 max-w-lg text-sm leading-7 text-surface-700">These details describe your work. Your public Trust Profile shows completed transaction history separately.</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-surface-600">Profile status: {status}</p>
      {isPublic
        ? <Link href={`/p/${user.username}`} className="quiet-link mt-4 inline-block py-2 text-sm font-semibold">View public Trust Profile →</Link>
        : <p className="mt-3 text-sm text-surface-600">This provider draft is private. <Link href="/dashboard/services" className="quiet-link font-semibold">Set up services and publication →</Link></p>}
    </div>
    <ProfileForm initial={{ displayName: profile.displayName, country: profile.country, state: profile.state || "", city: profile.city || "", headline: provider.headline, bio: provider.bio || "", serviceArea: provider.serviceArea }} />
  </main>;
}
