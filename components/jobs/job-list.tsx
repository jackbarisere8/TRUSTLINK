import Link from "next/link";
import type { JobSummaryRecord } from "@/lib/db/types";
import { StatusPill } from "@/components/ui/status-pill";
import { money, dateLabel } from "@/lib/format";

export function JobList({ jobs, headingLevel = 2 }: { jobs: JobSummaryRecord[]; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  if (!jobs.length) return <div className="border-y border-[#dbe2e3] py-12 sm:py-16"><p className="eyebrow">Nothing recorded yet</p><h2 className="mb-3 mt-4 text-xl font-semibold">No transactions here yet</h2><p className="max-w-md text-sm leading-7 text-surface-600">Your first TrustLink transaction will appear here once you create one.</p><Link href="/dashboard/jobs/new" className="quiet-link mt-5 inline-block py-2 text-sm font-semibold">Create your first transaction →</Link></div>;

  return <div className="divide-y divide-[#dbe2e3] border-y border-[#dbe2e3]">{jobs.map(job => <Link key={job.id} href={"/dashboard/jobs/" + job.id} className="grid items-center gap-3 px-2 py-5 transition-colors hover:bg-[#f0f5f2] sm:grid-cols-[1fr_145px_180px] sm:gap-6 sm:px-4"><div><Heading className="text-[15px] font-semibold">{job.terms?.service || "Service transaction"}</Heading><p className="mt-2 text-xs text-surface-600">{job.clientName || "Awaiting client"} · Due <time className="record-time" dateTime={job.terms?.deadline}>{dateLabel(job.terms?.deadline)}</time></p></div><span className="text-sm font-medium tabular-nums">{money(job.terms?.price || "0")}</span><StatusPill status={job.status}/></Link>)}</div>;
}
