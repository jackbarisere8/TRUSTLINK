import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
export default async function Page() {
  await requireAdmin();
  return <main id="main-content" className="shell max-w-4xl py-12"><h1 className="text-2xl mb-4">Administration</h1><p className="text-sm text-surface-500 mb-8">Review recorded transactions and resolve disputes from the supporting evidence.</p><div className="divide-y border-y">{["users","jobs","disputes","events"].map(p=><Link key={p} className="block py-5 capitalize" href={"/admin/"+p}>{p} →</Link>)}</div></main>;
}
