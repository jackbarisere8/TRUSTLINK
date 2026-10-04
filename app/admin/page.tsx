import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const adminSections = ["users", "jobs", "disputes", "events", "validation"] as const;

export default async function Page() {
  await requireAdmin();
  return <main id="main-content" className="shell max-w-4xl pb-16 pt-10 sm:pt-14">
    <p className="eyebrow">Operations</p><h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.2rem]">Administration</h1>
    <p className="mb-10 mt-4 max-w-lg text-sm leading-7 text-surface-700">Review recorded transactions, resolve disputes, and assess validation signals.</p>
    <div className="divide-y divide-[#dbe2e3] border-y border-[#dbe2e3]">{adminSections.map(section => <Link key={section} className="block py-5 capitalize text-sm font-medium hover:text-teal-800" href={`/admin/${section}`}>{section} →</Link>)}</div>
  </main>;
}
