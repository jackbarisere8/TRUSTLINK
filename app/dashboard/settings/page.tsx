import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export default async function ProviderSettingsPage() {
  const user = await requireProvider();
  return <main id="main-content" className="shell max-w-3xl py-12">
    <p className="eyebrow">Provider workspace / Settings</p>
    <h1 className="interface-heading mb-8 mt-3 text-[2.5rem] sm:text-[3.2rem]">Provider settings</h1>
    <dl className="divide-y border-y">
      <div className="py-5"><dt className="field-label">Email</dt><dd>{user.email}</dd></div>
      <div className="py-5"><dt className="field-label">Profile address</dt><dd className="record-id text-sm">/p/{user.username}</dd></div>
    </dl>
    <p className="mt-6 text-sm text-surface-600">Name and location are shared account details. <Link className="quiet-link font-semibold" href="/account/settings">Edit customer account settings</Link>.</p>
    <form action={logoutAction} className="mt-8"><Button variant="outline" type="submit">Sign out of this account</Button></form>
  </main>;
}
