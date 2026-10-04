import Link from "next/link";
import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "How TrustLink works",
  description: "See how providers and clients record service terms, accept an agreement, follow delivery and close a transaction.",
};

const steps = [
  ["Create the record", "The provider writes the service, scope, deliverables, agreed fee, deadline, revisions and cancellation terms. The record begins with the agreement, not a payment claim."],
  ["Send the link", "TrustLink creates a public record and a separate private participant link. The provider shares the private link with the intended client. The client can review the terms in a browser."],
  ["Accept and work", "The client accepts the exact terms. If payment happens directly between the parties, the provider can declare it received before starting work. Delivery and revision requests stay connected to the record."],
  ["Close the record", "After delivery is approved, the provider completes the transaction. A client review may be added to the completed record and reflected in the provider's Trust Profile."],
];

const questions = [
  ["Does TrustLink hold or verify a payment?", "No. The parties pay each other directly. A payment record is the provider's declaration of receipt; TrustLink does not hold funds or independently verify a transfer."],
  ["Does the client need an account?", "No account or app installation is required for the client participant flow. The client uses a private link to accept and manage their side of the transaction."],
  ["Are participant details verified?", "The client supplies a name and email at acceptance. Those details are recorded as self-provided and are not independent identity verification."],
  ["What if the work needs a change or a dispute?", "The client can request an included revision after delivery. Either authorized participant can open a structured dispute in the supported states; its submissions and resolution remain attached to the transaction."],
  ["Where do profile metrics come from?", "Completed transaction records, recorded delivery dates and client reviews produce the Trust Profile. Missing evidence appears as a dash, and agreed prices and payment totals are excluded."],
];

export default function HowItWorksPage() {
  return <><Navbar/><main id="main-content">
    <section className="border-b border-[#dbe2e3] bg-[#f4f6f3] py-16 sm:py-22 lg:py-26"><div className="shell grid gap-10 lg:grid-cols-[1fr_.7fr] lg:gap-24"><div><p className="eyebrow">How TrustLink works</p><h1 className="page-heading mt-5 max-w-2xl text-[3.1rem] sm:text-[4.2rem] text-balance">A clear record from agreement to delivery.</h1></div><div className="lg:pt-10"><p className="max-w-md text-base leading-8 text-surface-700">Agree wherever you already talk. Put the terms in one place. Give your client a way to review, accept and follow the work.</p><Link href="/#preview" className="quiet-link mt-6 inline-block py-2 text-sm font-semibold">See an example record →</Link></div></div></section>
    <section className="section border-b border-[#dbe2e3] bg-white"><div className="shell"><p className="eyebrow">The transaction sequence</p><div className="mt-8 border-t border-[#dbe2e3]">{steps.map(([title, body], index) => <div key={title} className="grid gap-3 border-b border-[#dbe2e3] py-8 sm:grid-cols-[5rem_.55fr_1fr] sm:gap-8"><span className="font-mono text-sm text-surface-600">{String(index + 1).padStart(2, "0")}</span><h2 className="text-xl font-semibold">{title}</h2><p className="max-w-xl text-sm leading-7 text-surface-700">{body}</p></div>)}</div></div></section>
    <section className="section border-b border-[#dbe2e3] bg-[#f4f6f3]"><div className="shell grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:gap-20"><div><p className="eyebrow">Common questions</p><h2 className="interface-heading mt-4 text-[2.4rem] sm:text-[3rem]">What the record does, and what it does not.</h2></div><div className="border-t border-[#cbd6d9]">{questions.map(([question, answer]) => <div key={question} className="border-b border-[#cbd6d9] py-6"><h3 className="font-semibold">{question}</h3><p className="mt-3 text-sm leading-7 text-surface-700">{answer}</p></div>)}</div></div></section>
    <section className="section bg-navy-900 text-white"><div className="shell flex flex-col items-start justify-between gap-8 md:flex-row md:items-center"><div><p className="eyebrow !text-[#a9c6c7]">Start with an agreement</p><h2 className="interface-heading mt-4 text-[2.4rem] sm:text-[3rem]">Ready to make the terms clear?</h2></div><Button href="/signup" size="lg" className="bg-white text-navy-900 hover:bg-surface-100">Create a TrustLink →</Button></div></section>
  </main><Footer/></>;
}
