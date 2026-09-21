import Link from "next/link";
import type { PublicJobProjection } from "@/lib/db/types";
import { StatusPill } from "@/components/ui/status-pill";
import { dateLabel, money } from "@/lib/format";
export function TransactionRecord({ record, compact = false, example = false, children, headingLevel = 1 }: { record: PublicJobProjection; compact?: boolean; example?: boolean; children?: React.ReactNode; headingLevel?: 1 | 2 }) {
  const Heading = compact || headingLevel === 2 ? "h2" : "h1";
  return <article className="transaction-record bg-white border border-surface-200 rounded-xl text-navy-900">
    <div className={compact ? "p-6 sm:p-8" : "p-6 sm:p-10"}>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-surface-500 pb-6 border-b border-surface-200">
        <span>{example ? "Example transaction" : "Transaction record"}</span><span className="font-mono break-all">{example ? "TL-7K29XQ" : record.publicId}</span>
      </div>
      <Heading className={compact ? "text-2xl font-semibold mt-6 mb-5" : "text-3xl sm:text-4xl font-serif font-normal mt-8 mb-6"}>{record.service}</Heading>
      <div className="flex flex-wrap justify-between items-start gap-4 pb-6">
        <div><p className="field-label">Provider</p><Link href={example ? "/p/amaka" : "/p/" + record.provider.username} className="font-medium hover:underline">{record.provider.displayName}</Link>{!compact && <p className="text-sm text-surface-500 mt-1">{record.provider.headline} · {record.providerLocation}</p>}</div>
        <StatusPill status={record.status}/>
      </div>
      <section className="border-t border-surface-200 py-6"><h2 className="field-label">Agreed scope</h2><p className="text-sm leading-7 whitespace-pre-line">{record.scope}</p></section>
      {!compact && <section className="pb-6"><h2 className="field-label">Deliverables</h2><ul className="divide-y divide-surface-100">{record.deliverables.map((d,i) => <li key={i} className="py-3 flex gap-3 text-sm"><span className="text-surface-400" aria-hidden="true">—</span>{d}</li>)}</ul></section>}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-6 border-y border-surface-200 py-6">
        <div><dt className="field-label">Fee</dt><dd className="text-xl font-semibold tabular-nums">{money(record.price,record.currency)}</dd></div>
        <div><dt className="field-label">Deadline</dt><dd className="text-sm font-medium">{dateLabel(record.deadline)}</dd></div>
        <div><dt className="field-label">Revisions</dt><dd className="text-sm font-medium">{record.revisionsIncluded} rounds{!compact && <span className="block text-surface-500 font-normal mt-1">{record.revisionsUsed} used</span>}</dd></div>
      </dl>
      {!compact && <section className="pt-6"><h2 className="field-label">Cancellation terms</h2><p className="text-sm leading-7 whitespace-pre-line">{record.cancellationTerms}</p></section>}
      <p className="text-xs leading-6 text-surface-500 pt-6">Payments happen directly between the parties. A recorded payment is a provider declaration, not independent verification by TrustLink.</p>
      {children}
    </div>
  </article>;
}
