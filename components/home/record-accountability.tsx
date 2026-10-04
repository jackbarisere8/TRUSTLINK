import Link from "next/link";

const recordedActivity = [
  ["Client acceptance", "The client reviews the agreed terms and records acceptance before work starts."],
  ["Direct payment declaration", "The provider can record payment received directly. TrustLink does not process or independently verify the transfer."],
  ["Delivery and revisions", "Submitted work, private attachments and revision requests remain with the transaction."],
  ["Dispute and resolution", "A claim, response and operational resolution remain beside the terms. A record does not reverse a direct payment."],
] as const;

export function RecordAccountability() {
  return <section className="section border-b border-[#dbe2e3] bg-[#f4f6f3]" aria-labelledby="record-accountability-heading">
    <div className="shell">
      <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
        <div>
          <p className="eyebrow">Evidence and accountability</p>
          <h2 id="record-accountability-heading" className="interface-heading mt-4 max-w-lg text-[2.3rem] sm:text-[3rem]">See what was agreed. See what happened next.</h2>
          <p className="mt-5 max-w-md leading-7 text-surface-700">The record adds dated activity to the original terms. It helps the parties review the work without pretending that TrustLink verifies identities, payments or outcomes.</p>
          <Link href="/how-it-works" className="quiet-link mt-6 inline-block py-2 text-sm font-semibold">How the record works →</Link>
        </div>
        <ol className="border-t border-[#dbe2e3]">{recordedActivity.map(([title, detail]) => <li key={title} className="grid gap-2 border-b border-[#dbe2e3] py-5 sm:grid-cols-[11rem_1fr] sm:gap-8"><h3 className="text-sm font-semibold">{title}</h3><p className="max-w-lg text-sm leading-7 text-surface-700">{detail}</p></li>)}</ol>
      </div>
      <div className="mt-16 grid gap-8 border-t-2 border-navy-900 pt-8 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
        <div><p className="eyebrow">Trust Profile</p><h3 className="mt-4 text-[1.8rem] font-semibold leading-tight">Completed records become a history of work.</h3><p className="mt-4 max-w-md text-sm leading-7 text-surface-700">Completed services, delivery dates and client feedback can appear on a provider&apos;s profile. Missing evidence stays missing; payment totals are excluded.</p><Link href="/p/amaka" className="quiet-link mt-5 inline-block py-2 text-sm font-semibold">View an illustrative profile →</Link></div>
        <div className="border-y border-[#dbe2e3] py-6"><p className="field-label">Illustrative completed transaction</p><p className="mt-3 text-lg font-semibold">Brand website refresh</p><dl className="mt-5 grid grid-cols-2 gap-5 text-sm"><div><dt className="field-label">Provider</dt><dd>Amaka Okafor</dd></div><div><dt className="field-label">Status</dt><dd>Completed</dd></div></dl><p className="mt-5 text-xs leading-6 text-surface-600">Example only. A real Trust Profile is derived from completed transaction records and client submissions.</p></div>
      </div>
    </div>
  </section>;
}
