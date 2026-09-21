import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { JobList } from "@/components/jobs/job-list";
import { Button } from "@/components/ui/button";
export default async function Page({searchParams}:{searchParams:Promise<{filter?:string}>}) {
  const user = await requireUser(); const {filter="all"} = await searchParams;
  const jobs = await db.listJobs(user.userId);
  const filtered = jobs.filter(j=>filter==="active" ? !["COMPLETED","CANCELLED"].includes(j.status) : filter==="completed" ? j.status==="COMPLETED" : true);
  return <main id="main-content" className="shell max-w-5xl py-10"><div className="flex flex-wrap justify-between gap-4 mb-8"><h1 className="text-2xl font-semibold">Transactions</h1><Button href="/dashboard/jobs/new">Create a TrustLink</Button></div><nav className="flex gap-6 mb-6 text-sm" aria-label="Filter transactions">{["all","active","completed"].map(f=><Link key={f} href={"/dashboard/jobs?filter="+f} aria-current={filter===f?"page":undefined} className={filter===f?"underline underline-offset-8 font-semibold":"text-surface-500"}>{f.charAt(0).toUpperCase()+f.slice(1)}</Link>)}</nav><JobList jobs={filtered}/></main>;
}
