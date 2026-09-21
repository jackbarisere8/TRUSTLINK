import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Logo } from "@/components/branding/logo";
export const dynamic="force-dynamic";
export default async function Layout({children}:{children:React.ReactNode}) {
  await requireAdmin();
  return <><header className="border-b bg-white"><div className="shell py-5 flex flex-wrap justify-between gap-5"><Logo/><nav className="flex flex-wrap gap-5 text-sm" aria-label="Administration">{["","users","jobs","disputes","events"].map(p=><Link key={p} href={"/admin"+(p?"/"+p:"")}>{p||"Overview"}</Link>)}<Link href="/dashboard">Workspace</Link></nav></div></header>{children}</>;
}
