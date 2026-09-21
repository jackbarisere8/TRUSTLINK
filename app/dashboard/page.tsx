import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { JobList } from "@/components/jobs/job-list";
export const metadata = {title:"Your workspace"};
export default async function Page() {
  const user = await requireUser();
  const jobs = await db.listJobs(user.userId);
  const active = jobs.filter(j=>!["COMPLETED","CANCELLED"].includes(j.status));
  return <main id="main-content" className="shell max-w-5xl py-8 sm:py-12"><div className="flex flex-wrap justify-between items-center gap-5 mb-8"><div><h1 className="text-2xl font-semibold">Your workspace</h1><p className="text-sm text-surface-500 mt-2">Keep the agreement and the work in one place.</p></div><Button href="/dashboard/jobs/new">Create a TrustLink</Button></div>
    <dl className="grid grid-cols-3 gap-5 border-y border-surface-200 py-6 mb-10">{[[active.length,"Active"],[jobs.filter(j=>j.status==="COMPLETED").length,"Completed"],[jobs.filter(j=>j.status==="DISPUTED").length,"Disputed"]].map(([v,k])=><div key={k}><dt className="text-sm text-surface-500">{k}</dt><dd className="text-2xl font-semibold mt-2 tabular-nums">{v}</dd></div>)}</dl>
    <div className="flex justify-between mb-4"><h2 className="font-semibold">Recent transactions</h2><Link href="/dashboard/jobs" className="text-sm underline">View all</Link></div><JobList jobs={jobs.slice(0,8)}/>
    <p className="text-xs text-surface-500 mt-8">Payment records are provider declarations. TrustLink does not process or hold funds.</p></main>;
}
