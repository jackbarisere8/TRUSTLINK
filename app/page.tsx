import Link from "next/link";
import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";
import { Button } from "@/components/ui/button";
import { HeroRecord } from "@/components/home/hero-record";
import { InteractiveDealSimulator } from "@/components/home/interactive-deal-simulator";
import { WhyRecordMatters } from "@/components/home/why-record-matters";
import { RecordAccountability } from "@/components/home/record-accountability";

export const metadata = {
  title: "TrustLink - Make the agreement clear",
  description: "Turn your service agreement into a clear transaction record: scope, fee, deadline, delivery and client approval.",
};

const steps = [
  ["Agree", "Discuss the work wherever you already talk."],
  ["Record", "Put the scope, fee and deadline in writing."],
  ["Accept", "Your client reviews and accepts the terms."],
  ["Work", "Record direct payment received, then start the work."],
  ["Deliver", "Submit work against the agreed scope."],
  ["Complete", "Resolve revisions or disputes, approve delivery and close the record."],
];

export default function Page() {
  return <><Navbar/><main id="main-content">
    <section className="border-b border-[#dbe2e3] bg-[#f4f6f3] py-16 sm:py-22 lg:py-28">
      <div className="shell grid items-center gap-12 lg:grid-cols-[1fr_1.06fr] lg:gap-16">
        <div className="max-w-xl">
          <p className="eyebrow">TrustLink / service agreements</p>
          <h1 className="page-heading my-6 text-[2.8rem] sm:text-[3.8rem] lg:text-[3.55rem] xl:text-[3.85rem] text-balance">Agree on the work.<br/>Record the terms.<br/><span className="text-[#526773]">Deliver with a record.</span></h1>
          <p className="max-w-md text-base sm:text-lg leading-8 text-surface-700">Put the scope, fee, deadline and revisions you agree with a client in one place. Follow acceptance, delivery and decisions on that same record.</p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4"><Button href="/signup" size="lg">Create a TrustLink</Button><Link href="#preview" className="quiet-link py-3 text-sm font-semibold">View an example →</Link></div>
          <p className="mt-7 text-xs leading-6 text-surface-600">Your client opens a link. No app to install.</p>
        </div>
        <div className="relative lg:pl-5"><p className="mb-3 text-xs font-medium tracking-wide text-surface-600">A transaction record, from the first agreement</p><HeroRecord/></div>
      </div>
    </section>
    <section className="section border-b border-[#dbe2e3] bg-white"><div className="shell">
      <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr] lg:gap-16"><div><p className="eyebrow">How the record works</p><h2 className="interface-heading mt-4 max-w-md text-[2.3rem] sm:text-[3rem]">The same terms stay in view from start to finish.</h2></div><p className="max-w-lg text-surface-700 leading-7 lg:pt-6">The provider writes the agreement and shares a link. The client accepts the terms. Each later step adds a dated entry to that record.</p></div>
      <ol className="mt-12 grid gap-0 border-t border-[#dbe2e3] sm:grid-cols-2 lg:grid-cols-3">{steps.map(([verb, body], index) => <li key={verb} className="border-b border-[#dbe2e3] py-6 sm:pr-8 lg:py-8"><p className="font-mono text-xs text-surface-500">{String(index + 1).padStart(2, "0")}</p><h3 className="mt-4 text-lg font-semibold">{verb}</h3><p className="mt-2 max-w-xs text-sm leading-6 text-surface-600">{body}</p></li>)}</ol>
    </div></section>
    <InteractiveDealSimulator/>
    <WhyRecordMatters/>
    <RecordAccountability/>
    <section className="section border-b border-[#dbe2e3] bg-white" aria-labelledby="use-cases-heading"><div className="shell"><p className="eyebrow">One record, two sides</p><h2 id="use-cases-heading" className="interface-heading mb-10 mt-4 max-w-2xl text-[2.3rem] sm:text-[3rem]">For the person doing the work and the person buying it.</h2><div className="grid gap-12 md:grid-cols-2 lg:gap-24">{[
      ["For providers", "Keep the scope clear from the start.", "Record your terms before work begins. Deliver against them, keep revision requests together, and build a history of completed work.", "/for-providers"],
      ["For businesses", "Know what was agreed. Track what happened.", "Review the deliverables, fee and deadline in one place. Accept the agreement, inspect delivery and raise a specific concern when needed.", "/for-businesses"],
    ].map(([label, title, body, href]) => <article key={href} className="border-t-2 border-[#0b1526] pt-7"><p className="eyebrow">{label}</p><h3 className="mt-4 mb-5 max-w-md text-[1.8rem] font-semibold leading-tight">{title}</h3><p className="max-w-md leading-7 text-surface-700">{body}</p><Link href={href} className="quiet-link mt-6 inline-block py-2 text-sm font-semibold">Read the overview →</Link></article>)}</div></div></section>
    <section className="section bg-navy-900 text-white"><div className="shell flex flex-col items-start justify-between gap-8 md:flex-row md:items-center"><div><p className="eyebrow !text-[#a9c6c7]">Ready when the terms are clear</p><h2 className="interface-heading mt-4 text-[2.3rem] sm:text-[3rem] text-white">Put the next agreement in writing.</h2></div><Button href="/signup" size="lg" className="shrink-0 bg-white text-navy-900 hover:bg-surface-100">Create a TrustLink →</Button></div></section>
  </main><Footer/></>;
}
