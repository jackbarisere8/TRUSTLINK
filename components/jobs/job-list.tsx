import Link from "next/link";
import type { JobSummaryRecord } from "@/lib/db/types";
import { StatusPill } from "@/components/ui/status-pill";
import { money, dateLabel } from "@/lib/format";
export function JobList({jobs}:{jobs:JobSummaryRecord[]}) {
  if (!jobs.length) return <div className="py-12 border-y border-surface-200"><h2 className="font-semibold mb-2">No transactions here yet</h2><p className="text-sm text-surface-500">Create a TrustLink when you and a client have agreed on a service.</p><Link href="/dashboard/jobs/new" className="inline-block mt-4 text-sm underline py-2">Create your first transaction</Link></div>;
  return <div className="divide-y divide-surface-200 border-y border-surface-200">{jobs.map(j=><Link key={j.id} href={"/dashboard/jobs/"+j.id} className="grid sm:grid-cols-[1fr_150px_180px] items-center gap-3 py-5 hover:bg-surface-100 transition-colors"><div><h2 className="font-medium text-sm">{j.terms?.service || "Service transaction"}</h2><p className="text-xs text-surface-500 mt-1">{j.clientName || "Awaiting client"} · Due {dateLabel(j.terms?.deadline)}</p></div><span className="text-sm tabular-nums">{money(j.terms?.price || "0")}</span><StatusPill status={j.status}/></Link>)}</div>;
}
