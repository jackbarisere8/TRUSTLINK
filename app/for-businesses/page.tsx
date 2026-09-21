import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "TrustLink for Nigerian Businesses & Clients",
  description:
    "Hire independent contractors with clarity. Review terms before work begins, track delivery progress, and maintain accountability without complex contracts.",
};

const CLIENT_PILLARS = [
  {
    title: "Explicit Scope Review",
    description:
      "Before any naira moves, review exactly what the provider will deliver. No vague promises on WhatsApp; every deliverable, format, and milestone is spelled out.",
  },
  {
    title: "Zero Software to Install",
    description:
      "TrustLink links open instantly in any mobile or desktop browser. Accept terms, review files, and request revisions without downloading an app or setting up an account.",
  },
  {
    title: "Structured Revisions",
    description:
      "You know upfront how many revision cycles are included. When you submit feedback, it is attached directly to the job record so nothing gets lost.",
  },
  {
    title: "Recorded Dispute Review",
    description:
      "If a provider fails to deliver what was specified or goes unresponsive, you have a formal dispute route backed by the written agreement and timestamps.",
  },
];

const COMPARISON = [
  {
    aspect: "Agreement Format",
    standard: "Scattered WhatsApp chats, voice notes, screenshots",
    trustlink: "Single structured URL with scope, price, deadline, and revision terms",
  },
  {
    aspect: "Work History",
    standard: "Blind faith based on Instagram followers or a mutual friend",
    trustlink: "Provider details and transparent completed job history",
  },
  {
    aspect: "Delivery & Files",
    standard: "Expiring WeTransfer links, WhatsApp compressed media, lost emails",
    trustlink: "Deliverables and files securely linked to the job record",
  },
  {
    aspect: "When Issues Arise",
    standard: "Awkward chat arguments, ghosting, complete loss of funds",
    trustlink: "Structured dispute submission reviewed against written agreement",
  },
];

export default function ForBusinessesPage() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        {/* Hero */}
        <section className="bg-navy-900 text-white py-18 md:py-28">
          <div className="shell max-w-4xl mx-auto text-center space-y-6">
            <p className="text-teal-400 text-xs font-bold ">
              For Clients, Startups & Business Owners
            </p>
            <h1 className="font-sans text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-balance">
              Hire independent talent{" "}
              <em className="not-italic text-teal-400">with clearer terms.</em>
            </h1>
            <p className="text-surface-300 text-lg leading-relaxed max-w-2xl mx-auto">
              When your contractor sends you a TrustLink, you get a written
              summary of what you are paying for, when it is due, and what happens if
              something goes wrong.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-3">
              <Button
                href="/j/sample-website-project"
                variant="secondary"
                size="lg"
              >
                Inspect a sample Job Page →
              </Button>
              <Button
                href="/how-it-works"
                variant="outline"
                size="lg"
                className="border-navy-700 text-surface-300 hover:border-navy-600 hover:text-white hover:bg-navy-800"
              >
                How acceptance works
              </Button>
            </div>
          </div>
        </section>

        {/* 4 Pillars */}
        <section className="section bg-surface-50">
          <div className="shell">
            <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
              <p className="eyebrow">The Client Advantage</p>
              <h2 className="font-sans text-3xl sm:text-4xl text-navy-900 font-normal tracking-tight">
                Why forward-thinking Nigerian businesses ask for TrustLink
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {CLIENT_PILLARS.map((pillar) => (
                <div
                  key={pillar.title}
                  className="bg-white border border-surface-200 rounded-xl p-8 space-y-3"
                >
                  <div className="w-8 h-8 rounded bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold text-sm">
                    ✓
                  </div>
                  <h3 className="text-lg font-bold text-navy-900">{pillar.title}</h3>
                  <p className="text-sm text-surface-600 leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="section bg-white border-t border-surface-200">
          <div className="shell max-w-4xl mx-auto">
            <div className="text-center space-y-4 mb-14">
              <p className="eyebrow">Direct Comparison</p>
              <h2 className="font-sans text-3xl sm:text-4xl text-navy-900 font-normal tracking-tight">
                Informal DM Deals vs. TrustLink
              </h2>
            </div>

            <div className="border border-surface-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 bg-navy-900 text-white text-xs font-bold  p-4">
                <div className="col-span-4 sm:col-span-3">Aspect</div>
                <div className="col-span-4 sm:col-span-4 text-surface-400">Typical WhatsApp Deal</div>
                <div className="col-span-4 sm:col-span-5 text-teal-400">TrustLink Transaction</div>
              </div>

              {COMPARISON.map((row, i) => (
                <div
                  key={row.aspect}
                  className={`grid grid-cols-12 text-sm p-4 items-center border-t border-surface-200 ${
                    i % 2 === 0 ? "bg-surface-50" : "bg-white"
                  }`}
                >
                  <div className="col-span-4 sm:col-span-3 font-semibold text-navy-900 text-xs sm:text-sm">
                    {row.aspect}
                  </div>
                  <div className="col-span-4 sm:col-span-4 text-surface-500 text-xs sm:text-sm pr-2">
                    {row.standard}
                  </div>
                  <div className="col-span-4 sm:col-span-5 text-navy-900 font-medium text-xs sm:text-sm">
                    {row.trustlink}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-navy-900 text-white text-center">
          <div className="shell max-w-xl mx-auto space-y-6">
            <h2 className="font-sans text-3xl font-normal">
              Next time you hire a service provider, ask for a TrustLink.
            </h2>
            <p className="text-surface-400 text-sm">
              It protects the relationship, formalizes the scope, and ensures both parties finish on the same page.
            </p>
            <Button
              href="/j/sample-website-project"
              variant="secondary"
              size="lg"
            >
              Explore a live sample agreement →
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
