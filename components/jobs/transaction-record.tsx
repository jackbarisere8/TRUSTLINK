import Link from "next/link";
import type { PublicJobProjection } from "@/lib/db/types";
import { StatusPill } from "@/components/ui/status-pill";
import { dateLabel, money } from "@/lib/format";

type TransactionRecordData = PublicJobProjection | (Omit<PublicJobProjection, "publicId"> & { publicId?: never });

export function TransactionRecord({ record, compact = false, example = false, preview = false, publicAgreement = false, children, headingLevel = 1 }: {
  record: TransactionRecordData;
  compact?: boolean;
  example?: boolean;
  preview?: boolean;
  publicAgreement?: boolean;
  children?: React.ReactNode;
  headingLevel?: 1 | 2;
}) {
  const Heading = compact || headingLevel === 2 ? "h2" : "h1";
  if (publicAgreement) return <article className="transaction-record public-agreement border border-[#dbe2e3] bg-white text-navy-900">
    <div className="px-6 py-8 sm:px-12 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-[#dbe2e3] pb-5 text-xs font-medium text-surface-600">
        <span>TrustLink / Transaction record</span>
        <span>Record ID <code className="record-id text-navy-900">{record.publicId}</code></span>
      </div>
      <div className="border-b border-[#dbe2e3] py-7">
        <p className="field-label">Provider</p>
        <Link href={"/p/" + record.provider.username} className="font-semibold underline decoration-[#c2d1d3] underline-offset-4 hover:decoration-teal-700">{record.provider.displayName}</Link>
        {(record.provider.headline || record.providerLocation) && <p className="mt-1 text-sm text-surface-600">{[record.provider.headline, record.providerLocation].filter(Boolean).join(" · ")}</p>}
      </div>
      <div className="border-b border-[#dbe2e3] py-8 sm:py-9">
        <p className="field-label">Service</p>
        <h1 className="page-heading mt-2 text-[2.15rem] sm:text-[2.9rem]">{record.service}</h1>
      </div>
      <div className="border-b border-[#dbe2e3] py-5">
        <p className="field-label">Current status</p>
        <StatusPill status={record.status} showDot={false} className="text-sm"/>
      </div>
      <section className="border-b border-[#dbe2e3] py-7">
        <h2 className="text-base font-semibold">Agreed terms</h2>
        <p className="field-label mt-5">Scope</p>
        <p className="max-w-prose whitespace-pre-line text-sm leading-7">{record.scope}</p>
      </section>
      <dl className="grid gap-6 border-b border-[#dbe2e3] py-7 sm:grid-cols-2">
        <div><dt className="field-label">Agreed fee</dt><dd className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{money(record.price, record.currency)}</dd></div>
        <div><dt className="field-label">Deadline</dt><dd className="text-sm font-semibold"><time className="record-time" dateTime={record.deadline}>{dateLabel(record.deadline)}</time></dd></div>
      </dl>
      <section className="border-b border-[#dbe2e3] py-7">
        <h2 className="text-base font-semibold">Deliverables</h2>
        <ol className="mt-3 divide-y divide-[#e9eeee]">{record.deliverables.map((deliverable, index) => <li key={index} className="grid grid-cols-[2rem_1fr] gap-2 py-3 text-sm leading-6"><span className="pt-1 font-mono text-xs text-surface-500">{String(index + 1).padStart(2, "0")}</span><span>{deliverable}</span></li>)}</ol>
      </section>
      <section className="border-b border-[#dbe2e3] py-7">
        <h2 className="text-base font-semibold">Revision terms</h2>
        <p className="mt-4 text-sm"><span className="font-semibold">{record.revisionsIncluded} included {record.revisionsIncluded === 1 ? "round" : "rounds"}</span><span className="ml-2 text-surface-600">· {record.revisionsUsed} used</span></p>
      </section>
      <section className="border-b border-[#dbe2e3] py-7">
        <h2 className="text-base font-semibold">Cancellation terms</h2>
        <p className="mt-4 max-w-prose whitespace-pre-line text-sm leading-7">{record.cancellationTerms}</p>
      </section>
      <p className="pt-6 text-xs leading-6 text-surface-600">Payments happen directly between the parties. A recorded payment is a provider declaration, not independent verification by TrustLink.</p>
      {children}
    </div>
  </article>;
  return <article className="transaction-record overflow-hidden border border-[#dbe2e3] bg-white text-navy-900">
    <div className="h-1 bg-navy-900" aria-hidden="true" />
    <div className={compact ? "px-6 py-6 sm:px-9 sm:py-8" : "px-6 py-8 sm:px-12 sm:py-11"}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dbe2e3] pb-5 text-xs font-medium text-surface-600">
        <span>TrustLink / {preview ? "Agreement preview" : example ? "Example transaction" : "Transaction record"}</span>
        <span>{preview ? "Public ID assigned after publication" : example ? "Illustrative record" : <>Record ID <code className="record-id text-navy-900">{record.publicId}</code></>}</span>
      </div>
      <div className="pt-7 pb-7 sm:pt-9 sm:pb-9">
        <p className="field-label">Service</p>
        <Heading className={compact ? "text-[1.65rem] sm:text-[1.9rem] font-semibold tracking-[-.045em] leading-tight mt-2" : "page-heading text-[2.15rem] sm:text-[2.9rem] mt-2"}>{record.service}</Heading>
      </div>
      <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end border-b border-[#dbe2e3] pb-7">
        <div><p className="field-label">Provider</p><Link href={example ? "/p/amaka" : "/p/" + record.provider.username} className="font-semibold underline decoration-[#c2d1d3] underline-offset-4 hover:decoration-teal-700">{record.provider.displayName}</Link>{!compact && <p className="text-sm text-surface-600 mt-1">{record.provider.headline} · {record.providerLocation}</p>}</div>
        <div className="sm:text-right"><p className="field-label">Current status</p><StatusPill status={record.status}/></div>
      </div>
      <section className="py-7"><h2 className="field-label">Agreed scope</h2><p className="text-sm leading-7 whitespace-pre-line max-w-prose">{record.scope}</p></section>
      {!compact && <section className="pb-7"><h2 className="field-label">Deliverables</h2><ol className="divide-y divide-[#e9eeee]">{record.deliverables.map((deliverable, index) => <li key={index} className="grid grid-cols-[2rem_1fr] gap-2 py-3 text-sm leading-6"><span className="font-mono text-xs text-surface-500 pt-1">{String(index + 1).padStart(2, "0")}</span><span>{deliverable}</span></li>)}</ol></section>}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-7 border-y border-[#dbe2e3] py-7">
        <div><dt className="field-label">Agreed fee</dt><dd className="text-xl sm:text-2xl font-semibold tracking-tight tabular-nums">{money(record.price, record.currency)}</dd></div>
        <div><dt className="field-label">Deadline</dt><dd className="text-sm font-semibold"><time className="record-time" dateTime={record.deadline}>{dateLabel(record.deadline)}</time></dd></div>
        <div><dt className="field-label">Revisions</dt><dd className="text-sm font-semibold">{record.revisionsIncluded} rounds{!compact && <span className="block text-surface-600 font-normal mt-1">{record.revisionsUsed} used</span>}</dd></div>
      </dl>
      {compact && example && <div className="grid gap-5 border-b border-[#dbe2e3] py-6 sm:grid-cols-2"><div><p className="field-label">Participants</p><p className="text-sm">Provider listed · Client acceptance pending</p></div><div><p className="field-label">Activity / evidence</p><p className="text-sm text-surface-600">No delivery submitted yet</p></div></div>}
      {!compact && <section className="pt-7"><h2 className="field-label">Cancellation terms</h2><p className="text-sm leading-7 whitespace-pre-line max-w-prose">{record.cancellationTerms}</p></section>}
      <p className="text-xs leading-6 text-surface-600 pt-7">Payments happen directly between the parties. A recorded payment is a provider declaration, not independent verification by TrustLink.</p>
      {children}
    </div>
  </article>;
}
