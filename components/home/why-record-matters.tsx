const reasons = [
  ["Before work begins", "Both sides can check the same scope, fee, deadline and revision terms."],
  ["When work is delivered", "The delivery can be reviewed against those terms, with revision requests kept in the record."],
  ["If something is disputed", "The claim and response sit beside the original agreement and the work submitted."],
] as const;

export function WhyRecordMatters() {
  return <section className="section border-b border-[#dbe2e3] bg-white" aria-labelledby="why-record-heading">
    <div className="shell grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
      <div>
        <p className="eyebrow">Why write it down</p>
        <h2 id="why-record-heading" className="interface-heading mt-4 max-w-lg text-[2.3rem] sm:text-[3rem]">A conversation starts the work. The record keeps the terms usable.</h2>
        <p className="mt-5 max-w-md leading-7 text-surface-700">The details may start in a chat, a call or a meeting. Putting them in one shared record gives both sides something specific to return to as the work changes.</p>
      </div>
      <ol className="border-t border-[#dbe2e3]">{reasons.map(([moment, value]) => <li key={moment} className="grid gap-2 border-b border-[#dbe2e3] py-6 sm:grid-cols-[11rem_1fr] sm:gap-8"><h3 className="text-sm font-semibold">{moment}</h3><p className="max-w-lg text-sm leading-7 text-surface-700">{value}</p></li>)}</ol>
    </div>
  </section>;
}
