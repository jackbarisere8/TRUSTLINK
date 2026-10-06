import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/branding/logo";
export const dynamic = "force-dynamic";
export default async function Layout({children}:{children:React.ReactNode}) {
  const user = await requireProvider();
  return <><header className="bg-white border-b border-[#dbe2e3]"><div className="shell flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-3"><Logo/><nav aria-label="Provider workspace" className="flex items-center gap-5 overflow-x-auto whitespace-nowrap text-sm font-medium text-surface-700 sm:gap-7"><Link className="py-2 hover:text-teal-800" href="/dashboard">Overview</Link><Link className="py-2 hover:text-teal-800" href="/dashboard/jobs">Transactions</Link><Link className="py-2 hover:text-teal-800" href="/dashboard/services">Services</Link><Link className="py-2 hover:text-teal-800" href="/dashboard/availability">Availability</Link><Link className="py-2 hover:text-teal-800" href="/dashboard/profile">Profile</Link><Link className="py-2 hover:text-teal-800" href="/dashboard/settings">Settings</Link><Link className="py-2 font-semibold text-teal-800" href="/account">Customer account</Link></nav><form action={logoutAction}><button className="text-sm text-surface-600 hover:text-navy-900 min-h-11" type="submit">Sign out</button></form></div></header><div className="shell pt-5 text-xs text-surface-600">Provider workspace <span aria-hidden="true">/</span> {user.displayName}</div>{children}</>;
}
