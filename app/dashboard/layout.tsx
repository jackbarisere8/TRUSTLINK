import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/branding/logo";
export const dynamic = "force-dynamic";
export default async function Layout({children}:{children:React.ReactNode}) {
  const user = await requireUser();
  return <><header className="bg-white border-b border-surface-200"><div className="shell flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-4"><Logo/><nav aria-label="Workspace" className="flex gap-5 text-sm"><Link href="/dashboard">Overview</Link><Link href="/dashboard/jobs">Transactions</Link><Link href="/dashboard/profile">Profile</Link><Link href="/dashboard/settings">Account</Link></nav><form action={logoutAction}><button className="text-sm min-h-11" type="submit">Sign out</button></form></div></header><div className="shell pt-4 text-xs text-surface-500">Signed in as {user.displayName}</div>{children}</>;
}
