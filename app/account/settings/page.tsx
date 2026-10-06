import { requireAccountUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccountProfileForm } from "@/components/account/account-profile-form";

export const metadata = { title: "Account settings" };

export default async function AccountSettingsPage() {
  const user = await requireAccountUser();
  const bundle = await db.getProfileBundleByUserId(user.userId);
  if (!bundle) return null;
  const profile = bundle.profile;
  return <main id="main-content" className="shell max-w-3xl pb-16 pt-8 sm:pt-12">
    <div className="mb-10 border-b border-[#dbe2e3] pb-7">
      <p className="eyebrow">Customer account / Settings</p>
      <h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.2rem]">Account details</h1>
      <p className="mt-4 max-w-lg text-sm leading-7 text-surface-700">These details belong to your account and are shared with your provider workspace if you enable one.</p>
    </div>
    <AccountProfileForm initial={{ displayName: profile.displayName, country: profile.country, state: profile.state || "", city: profile.city || "" }} />
  </main>;
}
