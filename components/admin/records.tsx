import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateLabel } from "@/lib/format";
import { eventLabels } from "@/lib/trust-events";
export async function AdminRecords({type}:{type:"users"|"jobs"|"disputes"|"events"}) {
  await requireAdmin();
  let rows: {id:string;primary:string;secondary:string;href?:string}[];
  if(type==="users") rows=(await db.listProfiles()).map(p=>({id:p.id,primary:p.displayName,secondary:[p.city,p.country].filter(Boolean).join(", "),href:"/p/"+p.username}));
  else if(type==="jobs") rows=(await db.listJobs()).map(j=>({id:j.id,primary:j.terms?.service||j.publicId,secondary:j.status.replaceAll("_"," ").toLowerCase(),href:"/dashboard/jobs/"+j.id}));
  else if(type==="disputes") rows=(await db.listDisputes()).map(d=>({id:d.id,primary:d.contestedTerm+" · "+d.disputeStatus.toLowerCase(),secondary:dateLabel(d.createdAt),href:"/disputes/"+d.jobId}));
  else rows=(await db.listEvents()).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)).map(e=>({id:e.id,primary:eventLabels[e.eventType]||e.eventType,secondary:dateLabel(e.occurredAt)+" · "+e.actorType,href:"/dashboard/jobs/"+e.jobId}));
  return <main id="main-content" className="shell max-w-5xl py-12"><h1 className="text-2xl font-semibold capitalize mb-8">{type}</h1><div className="divide-y border-y">{rows.length?rows.map(r=><div key={r.id} className="flex justify-between gap-5 py-5 text-sm"><Link href={r.href||"/admin"} className="underline">{r.primary}</Link><span className="text-surface-500">{r.secondary}</span></div>):<p className="py-10 text-sm text-surface-500">No {type} on record.</p>}</div></main>;
}
