import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Logo } from "@/components/branding/logo";
export const dynamic="force-dynamic";
export default async function Layout({children}:{children:React.ReactNode}) {
  await requireAdmin();
  return <><header className="border-b border-[#dbe2e3] bg-white"><div className="shell flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-3"><Logo/><nav className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-medium text-surface-700" aria-label="Administration">{["","users","jobs","disputes","events","validation"].map(path=><Link className="py-2 capitalize hover:text-teal-800" key={path} href={"/admin"+(path?"/"+path:"")}>{path||"Overview"}</Link>)}<Link className="py-2 hover:text-teal-800" href="/dashboard">Workspace</Link></nav></div></header>{children}</>;
}
