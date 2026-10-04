import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { JobList } from "@/components/jobs/job-list";
import { Button } from "@/components/ui/button";
export default async function Page({searchParams}:{searchParams:Promise<{filter?:string}>}) {
  const user = await requireUser(); const {filter="all"} = await searchParams;
  const jobs = await db.listJobs(user.userId);
  const filtered = jobs.filter(j=>filter==="active" ? !["COMPLETED","CANCELLED"].includes(j.status) : filter==="completed" ? j.status==="COMPLETED" : true);
  return <main id="main-content" className="shell max-w-5xl pb-16 pt-8 sm:pt-12"><div className="mb-10 flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow">Workspace</p><h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.2rem]">Transactions</h1><p className="mt-3 text-sm text-surface-600">The terms and progress for every recorded job.</p></div><Button href="/dashboard/jobs/new">Create a TrustLink</Button></div><nav className="mb-6 flex gap-7 border-b border-[#dbe2e3] text-sm" aria-label="Filter transactions">{["all","active","completed"].map(f=><Link key={f} href={"/dashboard/jobs?filter="+f} aria-current={filter===f?"page":undefined} className={"min-h-11 border-b-2 py-3 font-medium "+(filter===f?"border-[#087f79] text-navy-900":"border-transparent text-surface-600 hover:text-navy-900")}>{f.charAt(0).toUpperCase()+f.slice(1)}</Link>)}</nav><JobList jobs={filtered}/></main>;
}
