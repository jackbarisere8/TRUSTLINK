import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildValidationReport } from "@/lib/analytics/validation";

export default async function Page() {
  await requireAdmin();
  const [jobs, events] = await Promise.all([db.listJobs(), db.listEvents()]);
  const report = buildValidationReport(jobs, events);
  const unprompted = report.repeatUse.repeat_use_unprompted;
  const prompted = report.repeatUse.repeat_use_prompted;
  const repeatSignals = [
    { label: "Unprompted accepted", value: unprompted.accepted, description: "Repeat transactions independently created and accepted by a client." },
    { label: "Returning providers", value: unprompted.acceptedProviders, description: "Distinct providers behind those accepted unprompted repeats." },
    { label: "Prompted accepted", value: prompted.accepted, description: "Accepted repeats created after a reminder or request." },
    { label: "Accepted transactions", value: report.transactionFunnel.accepted, description: "All transaction records accepted by their client participant." },
  ];
  const repeatRows = [
    { label: "Unprompted repeat", code: "repeat_use_unprompted", signal: unprompted },
    { label: "Prompted repeat", code: "repeat_use_prompted", signal: prompted },
  ];
  const funnel = [
    ["Created", report.transactionFunnel.created],
    ["Accepted by a client", report.transactionFunnel.accepted],
    ["Payment recorded", report.transactionFunnel.paymentRecorded],
    ["Delivery submitted", report.transactionFunnel.deliverySubmitted],
    ["Completed", report.transactionFunnel.completed],
  ] as const;

  return <main id="main-content" className="shell max-w-5xl pb-16 pt-10 sm:pt-14">
    <header className="mb-12"><p className="eyebrow">Validation</p><h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.2rem]">Product signals</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-surface-700">Aggregate evidence from transaction records. A repeat-use signal becomes customer-backed only after the client accepts that transaction.</p></header>

    <section aria-labelledby="repeat-use-heading" className="mb-14">
      <div className="mb-6"><h2 id="repeat-use-heading" className="text-xl font-semibold">Repeat use</h2><p className="mt-2 text-sm text-surface-600">Unprompted accepted repeat use is the primary early validation signal.</p></div>
      <dl className="grid grid-cols-2 gap-x-8 border-y border-[#dbe2e3] lg:grid-cols-4">{repeatSignals.map((signal, index) => <div key={signal.label} className="border-b border-[#dbe2e3] py-6 last:border-b-0 lg:border-b-0"><dt className="text-sm font-semibold">{signal.label}</dt><dd className={"metric-value mt-3 tabular-nums " + (index === 0 ? "text-[2.8rem] sm:text-[3.4rem]" : "text-[2.2rem] sm:text-[2.8rem]")}>{signal.value}</dd><dd className="mt-3 max-w-[16rem] text-xs leading-5 text-surface-600">{signal.description}</dd></div>)}</dl>
      <div className="mt-8 border-y border-[#dbe2e3] sm:hidden">{repeatRows.map(row => <section key={row.code} className="border-b border-[#dbe2e3] py-5 last:border-b-0"><h3 className="text-sm font-semibold">{row.label}</h3><code className="mt-1 block text-xs text-surface-600">{row.code}</code><dl className="mt-4 grid grid-cols-3 gap-3 text-xs"><div><dt className="text-surface-600">Recorded</dt><dd className="mt-2 font-semibold tabular-nums">{row.signal.created}</dd></div><div><dt className="text-surface-600">Client accepted</dt><dd className="mt-2 font-semibold tabular-nums">{row.signal.accepted}</dd></div><div><dt className="text-surface-600">Accepted providers</dt><dd className="mt-2 font-semibold tabular-nums">{row.signal.acceptedProviders}</dd></div></dl></section>)}</div>
      <div className="mt-8 hidden border-y border-[#dbe2e3] sm:block"><table className="w-full text-left text-sm"><caption className="sr-only">Prompted and unprompted repeat-use validation signals</caption><thead className="text-surface-600"><tr><th scope="col" className="px-3 py-3 font-medium">Signal</th><th scope="col" className="px-3 py-3 font-medium">Recorded</th><th scope="col" className="px-3 py-3 font-medium">Client accepted</th><th scope="col" className="px-3 py-3 font-medium">Accepted providers</th></tr></thead><tbody className="divide-y divide-[#dbe2e3]">{repeatRows.map(row => <tr key={row.code}><th scope="row" className="px-3 py-4 text-left font-medium">{row.label}<code className="mt-1 block text-xs font-normal text-surface-600">{row.code}</code></th><td className="px-3 py-4 tabular-nums">{row.signal.created}</td><td className="px-3 py-4 tabular-nums">{row.signal.accepted}</td><td className="px-3 py-4 tabular-nums">{row.signal.acceptedProviders}</td></tr>)}</tbody></table></div>
    </section>

    <div className="grid gap-12 md:grid-cols-2">
      <section aria-labelledby="funnel-heading"><h2 id="funnel-heading" className="mb-4 text-xl font-semibold">Transaction evidence</h2><dl className="border-t border-[#dbe2e3]">{funnel.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-6 border-b border-[#dbe2e3] py-4 text-sm"><dt>{label}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>)}</dl></section>
      <section aria-labelledby="source-heading"><h2 id="source-heading" className="mb-4 text-xl font-semibold">Agreement source</h2>{report.sourceChannels.length ? <dl className="border-t border-[#dbe2e3]">{report.sourceChannels.map(row => <div key={row.channel} className="flex items-center justify-between gap-6 border-b border-[#dbe2e3] py-4 text-sm"><dt>{row.channel}</dt><dd className="font-semibold tabular-nums">{row.transactions}</dd></div>)}</dl> : <p className="border-y border-[#dbe2e3] py-6 text-sm text-surface-600">No transaction sources recorded yet.</p>}</section>
    </div>

    <p className="notice mt-12 text-sm">This report uses aggregate job classifications and immutable lifecycle events. It does not collect page views, device fingerprints, client contact details, free-text content, or third-party analytics identifiers.</p>
  </main>;
}
