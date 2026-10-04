import Link from "next/link";
import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";
import { Button } from "@/components/ui/button";
import { HeroRecord } from "@/components/home/hero-record";

export const metadata = {
  title: "TrustLink for clients and businesses",
  description: "Review service terms, accept a shared agreement, inspect delivery and request revisions against the agreed scope.",
};

const clientActions = [
  ["Review", "Read the provider's self-provided details, scope, deliverables, agreed fee and deadline before accepting."],
  ["Accept", "Use the private participant link to accept those exact terms. Your supplied name and email are recorded, not independently verified."],
  ["Inspect", "See delivery notes and authorized supporting files in the same transaction workspace."],
  ["Respond", "Request a revision within the agreed allowance, approve delivery, or open a structured dispute when needed."],
];

export default function ForBusinessesPage() {
  return <><Navbar/><main id="main-content">
    <section className="border-b border-[#dbe2e3] bg-[#f4f6f3] py-16 sm:py-22 lg:py-26"><div className="shell grid items-center gap-12 lg:grid-cols-[.88fr_1.12fr] lg:gap-20"><div><p className="eyebrow">For clients and businesses</p><h1 className="page-heading mt-5 text-[3.1rem] sm:text-[4.2rem] text-balance">Know what you are agreeing to.</h1><p className="mt-6 max-w-lg text-base leading-8 text-surface-700">When a provider sends you a TrustLink, the service terms live in one readable record. See what is due, when it is due and how delivery will be reviewed.</p><div className="mt-8 flex flex-wrap gap-4"><Button href="/#preview" size="lg">Inspect an example</Button><Link href="/how-it-works" className="quiet-link self-center py-3 text-sm font-semibold">How acceptance works →</Link></div></div><div><p className="mb-3 text-xs text-surface-600">Illustrative transaction record</p><HeroRecord/></div></div></section>
    <section className="section border-b border-[#dbe2e3] bg-white"><div className="shell grid gap-12 lg:grid-cols-[.7fr_1.3fr] lg:gap-20"><div><p className="eyebrow">The client side of the record</p><h2 className="interface-heading mt-4 text-[2.4rem] sm:text-[3rem]">Read first. Act with the terms in view.</h2><p className="mt-6 max-w-md text-sm leading-7 text-surface-700">The public record shows the agreement. A private participant link gives the client access to acceptance and later transaction actions.</p></div><ol className="border-t border-[#dbe2e3]">{clientActions.map(([title, body], index) => <li key={title} className="grid gap-3 border-b border-[#dbe2e3] py-6 sm:grid-cols-[2rem_7rem_1fr] sm:gap-5"><span className="font-mono text-xs text-surface-500">{String(index + 1).padStart(2, "0")}</span><h3 className="font-semibold">{title}</h3><p className="text-sm leading-7 text-surface-700">{body}</p></li>)}</ol></div></section>
    <section className="section border-b border-[#dbe2e3] bg-[#f4f6f3]"><div className="shell grid gap-10 lg:grid-cols-[.7fr_1.3fr] lg:gap-20"><div><p className="eyebrow">Before you accept</p><h2 className="interface-heading mt-4 text-[2.4rem] sm:text-[3rem]">Three questions the record should answer.</h2></div><dl className="border-t border-[#cbd6d9]"><div className="border-b border-[#cbd6d9] py-6"><dt className="font-semibold">What will be delivered?</dt><dd className="mt-2 text-sm leading-7 text-surface-700">Check the scope and each deliverable against your conversation with the provider.</dd></div><div className="border-b border-[#cbd6d9] py-6"><dt className="font-semibold">What are the agreed terms?</dt><dd className="mt-2 text-sm leading-7 text-surface-700">Check the fee, deadline, revision allowance and cancellation terms before accepting.</dd></div><div className="border-b border-[#cbd6d9] py-6"><dt className="font-semibold">What happens next?</dt><dd className="mt-2 text-sm leading-7 text-surface-700">After acceptance, the provider may record direct payment received, then begin and submit work. You can review what was submitted.</dd></div></dl></div></section>
    <section className="section bg-navy-900 text-white"><div className="shell flex flex-col items-start justify-between gap-8 md:flex-row md:items-center"><div><p className="eyebrow !text-[#a9c6c7]">Review an example</p><h2 className="interface-heading mt-4 text-[2.4rem] sm:text-[3rem]">See the terms before you decide.</h2><p className="mt-4 max-w-lg text-sm leading-7 text-surface-300">TrustLink does not hold funds or independently verify a provider&apos;s payment declaration.</p></div><Button href="/#preview" size="lg" className="bg-white text-navy-900 hover:bg-surface-100">Open the example →</Button></div></section>
  </main><Footer/></>;
}
