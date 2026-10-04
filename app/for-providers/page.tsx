import Link from "next/link";
import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";
import { Button } from "@/components/ui/button";
import { HeroRecord } from "@/components/home/hero-record";

export const metadata = {
  title: "TrustLink for independent providers",
  description: "Record service terms, send a client link, and keep delivery and revisions connected to the agreement.",
};

const moments = [
  ["Before work", "Put the service, deliverables, fee, deadline, included revisions and cancellation terms into one record."],
  ["At acceptance", "Send a private participant link so your client can review the terms and accept them explicitly."],
  ["During delivery", "Submit the work against the agreed scope. Keep revision requests and supporting files with the transaction."],
  ["After completion", "Completed work can appear in your Trust Profile with any client feedback left on that record."],
];

const examples = [
  ["Website project", "Pages, responsive behavior, handoff files and included revisions."],
  ["Brand identity", "Logo package, source files, usage guide and review rounds."],
  ["Photo or video work", "Coverage, edited outputs, formats and delivery date."],
  ["Campaign work", "Content schedule, deliverables, review window and reporting scope."],
];

export default function ForProvidersPage() {
  return <><Navbar/><main id="main-content">
    <section className="border-b border-[#dbe2e3] bg-[#f4f6f3] py-16 sm:py-22 lg:py-26"><div className="shell grid items-center gap-12 lg:grid-cols-[.88fr_1.12fr] lg:gap-20"><div><p className="eyebrow">For service providers</p><h1 className="page-heading mt-5 text-[3.1rem] sm:text-[4.2rem] text-balance">Start the work with the terms in view.</h1><p className="mt-6 max-w-lg text-base leading-8 text-surface-700">When you and a client agree in a conversation, give that agreement a place of its own. Record the scope, price and deadline before delivery begins.</p><div className="mt-8 flex flex-wrap gap-4"><Button href="/signup" size="lg">Create a TrustLink</Button><Link href="/#preview" className="quiet-link self-center py-3 text-sm font-semibold">Try an example record →</Link></div></div><div><p className="mb-3 text-xs text-surface-600">Illustrative transaction record</p><HeroRecord/></div></div></section>
    <section className="section border-b border-[#dbe2e3] bg-white"><div className="shell grid gap-12 lg:grid-cols-[.7fr_1.3fr] lg:gap-20"><div><p className="eyebrow">One record, through the work</p><h2 className="interface-heading mt-4 text-[2.4rem] sm:text-[3rem]">The agreement stays useful after it is signed.</h2></div><ol className="border-t border-[#dbe2e3]">{moments.map(([title, body], index) => <li key={title} className="grid gap-3 border-b border-[#dbe2e3] py-6 sm:grid-cols-[2rem_10rem_1fr] sm:gap-5"><span className="font-mono text-xs text-surface-500">{String(index + 1).padStart(2, "0")}</span><h3 className="font-semibold">{title}</h3><p className="text-sm leading-7 text-surface-700">{body}</p></li>)}</ol></div></section>
    <section className="section border-b border-[#dbe2e3] bg-[#f4f6f3]"><div className="shell"><p className="eyebrow">Make scope concrete</p><h2 className="interface-heading mt-4 max-w-2xl text-[2.4rem] sm:text-[3rem]">Different services. The same need for clear deliverables.</h2><div className="mt-11 grid gap-x-10 border-t border-[#cbd6d9] md:grid-cols-2">{examples.map(([title, body]) => <div key={title} className="border-b border-[#cbd6d9] py-6"><h3 className="font-semibold">{title}</h3><p className="mt-2 max-w-md text-sm leading-7 text-surface-700">{body}</p></div>)}</div><p className="mt-6 text-xs leading-6 text-surface-600">These are illustrative scopes, not prescribed prices or promises of a result.</p></div></section>
    <section className="section bg-navy-900 text-white"><div className="shell flex flex-col items-start justify-between gap-8 md:flex-row md:items-center"><div><p className="eyebrow !text-[#a9c6c7]">A clear starting point</p><h2 className="interface-heading mt-4 text-[2.4rem] sm:text-[3rem]">Write down what you agreed.</h2><p className="mt-4 max-w-lg text-sm leading-7 text-surface-300">TrustLink records direct payment declarations; it does not hold funds or verify transfers independently.</p></div><Button href="/signup" size="lg" className="bg-white text-navy-900 hover:bg-surface-100">Create a TrustLink →</Button></div></section>
  </main><Footer/></>;
}
