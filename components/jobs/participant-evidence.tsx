import type { JobAggregate } from "@/lib/db/repository";
import { dateLabel } from "@/lib/format";
export type ParticipantEvidence = Pick<JobAggregate,"deliveries" | "revisions" | "disputes" | "reviews">;
export function ParticipantEvidenceView({ data, jobId }: { data: ParticipantEvidence; jobId: string }) {
  const link = (path: string, i: number) => <a key={path} className="text-sm underline block py-2" href={"/api/evidence/" + jobId + "?path=" + encodeURIComponent(path)}>Download private attachment {i+1}</a>;
  return <div>
    {data.deliveries.length > 0 && <section className="record-section"><h2>Delivery evidence</h2>{data.deliveries.map(d=><div key={d.id} className="py-4 border-b border-surface-100"><p className="text-xs text-surface-500 mb-2">{dateLabel(d.submittedAt)}</p><p className="text-sm whitespace-pre-line">{d.description}</p>{d.fileUrls.map(link)}</div>)}</section>}
    {data.revisions.length > 0 && <section className="record-section"><h2>Revision requests</h2>{data.revisions.map(r=><div key={r.id} className="py-4"><p className="text-sm font-medium">Round {r.revisionNumber} · {dateLabel(r.requestedAt)}</p><p className="text-sm mt-2 whitespace-pre-line">{r.description}</p></div>)}</section>}
    {data.disputes.length > 0 && <section className="record-section"><h2>Dispute record</h2>{data.disputes.map(d=><div key={d.id} className="py-4"><p className="text-sm font-medium">{d.contestedTerm} · {d.disputeStatus.replaceAll("_"," ").toLowerCase()}</p><p className="text-sm mt-2 whitespace-pre-line">{d.claimDescription}</p>{d.evidenceUrls.map(link)}{d.resolutionNotes && <p className="notice mt-3">Resolution: {d.resolutionNotes}</p>}</div>)}</section>}
    {data.reviews.length > 0 && <section className="record-section"><h2>Client review</h2>{data.reviews.map(r=><div key={r.id} className="py-3"><p className="text-sm font-medium">{r.rating} / 5</p><p className="text-sm mt-2">{r.comment}</p></div>)}</section>}
  </div>;
}
