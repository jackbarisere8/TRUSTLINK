import Link from "next/link";
import { requireAccountUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/branding/logo";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAccountUser();
  return <>
    <header className="border-b border-[#dbe2e3] bg-white">
      <div className="shell flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-3">
        <Logo />
        <nav aria-label="Customer account" className="flex items-center gap-5 overflow-x-auto whitespace-nowrap text-sm font-medium text-surface-700 sm:gap-7">
          <Link className="py-2 hover:text-teal-800" href="/account">Overview</Link>
          <Link className="py-2 hover:text-teal-800" href="/account/settings">Settings</Link>
          {user.providerEnabled
            ? <Link className="py-2 font-semibold text-teal-800" href="/dashboard">Provider workspace</Link>
            : <Link className="py-2 font-semibold text-teal-800" href="/account/become-provider">Become a provider</Link>}
        </nav>
        <form action={logoutAction}><button className="min-h-11 text-sm text-surface-600 hover:text-navy-900" type="submit">Sign out</button></form>
      </div>
    </header>
    <div className="shell pt-5 text-xs text-surface-600">Customer account <span aria-hidden="true">/</span> {user.displayName}</div>
    {children}
  </>;
}
