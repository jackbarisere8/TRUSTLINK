
import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "TrustLink for Independent Nigerian Providers",
  description:
    "Stop scope creep, endless unpaid revisions, and forgotten terms. TrustLink gives Nigerian designers, developers, and creators a professional transaction agreement.",
};

const PAIN_POINTS = [
  {
    problem: "Scope Creep",
    story:
      '"Can you just quickly add an e-commerce store and a mobile app to that static landing page we agreed on?"',
    solution:
      "Your TrustLink terms explicitly itemize deliverables. Anything outside the written scope is an add-on, not a favor.",
  },
  {
    problem: "Endless Revision Loops",
    story:
      '"We changed our mind again. Let us try five different color palettes and new fonts."',
    solution:
      "Specify 1, 2, or 3 revision rounds upfront. When included rounds are exhausted, additional work requires a formal update.",
  },
  {
    problem: "Disputed Delivery Dates",
    story:
      '"You delivered late! We expected this last Monday!"',
    solution:
      "Agreed deadline and actual submission timestamps are logged permanently on the job record with exact dates.",
  },
  {
    problem: "Invisible Reputation",
    story:
      'Doing brilliant work for clients who never leave a review or endorse you anywhere visible.',
    solution:
      "Every completed TrustLink job adds to your public Trust Profile — transaction history that new clients can inspect instantly.",
  },
];

const USE_CASES = [
  {
    role: "Web & Mobile Developers",
    typicalDeal: "₦250,000 – ₦1,200,000",
    deliverables: "Responsive frontend, API integration, testing, 14-day bug fix window",
    advantage: "Stops clients from demanding new features before releasing final milestone balance.",
  },
  {
    role: "Brand & UI/UX Designers",
    typicalDeal: "₦120,000 – ₦600,000",
    deliverables: "Logo package, brand guidelines, Figma source files, 2 revision rounds",
    advantage: "Strict revision boundary prevents infinite rework and subjective redesign loops.",
  },
  {
    role: "Photographers & Videographers",
    typicalDeal: "₦150,000 – ₦850,000",
    deliverables: "Half-day shoot, 30 edited stills, 60-second highlight reel in 4K",
    advantage: "Clarifies exactly what raw files or edited assets are included in the quoted fee.",
  },
  {
    role: "Digital Marketers & Copywriters",
    typicalDeal: "₦80,000 – ₦450,000",
    deliverables: "Monthly content calendar, 12 graphics, copy deck, ad campaign setup",
    advantage: "Documents campaign parameters and review turnaround times unambiguously.",
  },
];

export default function ForProvidersPage() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        {/* Hero */}
        <section className="bg-navy-900 text-white py-18 md:py-28">
          <div className="shell grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <p className="text-teal-400 text-xs font-bold ">
                Built for Independent Professionals
              </p>
              <h1 className="font-sans text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-balance">
                Do the work you love.{" "}
                <em className="not-italic text-teal-400">Lock the terms you agreed.</em>
              </h1>
              <p className="text-surface-300 text-lg leading-relaxed max-w-xl">
                TrustLink gives Nigerian freelancers, agencies, and independent creators
                a clean, professional agreement to share with clients on WhatsApp, Instagram,
                or email.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Button href="/signup" variant="secondary" size="lg" className="text-white font-semibold">
                  Create your provider profile →
                </Button>
                <Button
                  href="/j/sample-website-project"
                  variant="outline"
                  size="lg"
                  className="border-navy-700 text-surface-300 hover:border-navy-600 hover:text-white hover:bg-navy-800 font-semibold"
                >
                  Preview a sample job link
                </Button>
              </div>
            </div>

            {/* Quick stats / summary card */}
            <div className="lg:col-span-5">
              <div className="bg-navy-800 border border-navy-700 rounded-xl p-8 space-y-6">
                <h3 className="text-xs font-bold  text-teal-400">
                  What every TrustLink includes
                </h3>
                <div className="space-y-4 text-sm text-surface-300">
                  <div className="flex items-start gap-3">
                    <span className="text-teal-400 font-bold">01</span>
                    <div>
                      <strong className="text-white block">Itemized Deliverables</strong>
                      <span>Specific scope checklist so clients know what is and isn’t included.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-teal-400 font-bold">02</span>
                    <div>
                      <strong className="text-white block">Revision Cap</strong>
                      <span>Lock the number of revisions to prevent endless iterations.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-teal-400 font-bold">03</span>
                    <div>
                      <strong className="text-white block">Delivery evidence</strong>
                      <span>Submit files and links directly to the job ledger.</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-teal-400 font-bold">04</span>
                    <div>
                      <strong className="text-white block">Shareable Trust Profile</strong>
                      <span>A single link to prove your track record to every future client.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The 4 Common Problems */}
        <section className="section bg-surface-50">
          <div className="shell">
            <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
              <p className="eyebrow">The Freelance Reality</p>
              <h2 className="font-sans text-3xl sm:text-4xl text-navy-900 font-normal tracking-tight">
                Problems TrustLink eliminates before they happen
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {PAIN_POINTS.map((item) => (
                <div
                  key={item.problem}
                  className="bg-white border border-surface-200 rounded-xl p-6 md:p-8 space-y-4"
                >
                  <span className="inline-block px-2.5 py-1 bg-danger-light text-danger-text text-xs font-bold rounded">
                    Problem: {item.problem}
                  </span>
                  <blockquote className="text-sm italic text-surface-500 border-l-2 border-danger pl-3 my-2">
                    {item.story}
                  </blockquote>
                  <div className="pt-2 border-t border-surface-100">
                    <p className="text-xs font-bold text-teal-700 uppercase tracking-wide mb-1">
                      How TrustLink fixes this:
                    </p>
                    <p className="text-sm text-surface-600 leading-relaxed">
                      {item.solution}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Real Service Scenarios */}
        <section className="section bg-white border-t border-surface-200">
          <div className="shell">
            <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
              <p className="eyebrow">Built For Your Industry</p>
              <h2 className="font-sans text-3xl sm:text-4xl text-navy-900 font-normal tracking-tight">
                How Nigerian creators structure their jobs
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {USE_CASES.map((uc) => (
                <div
                  key={uc.role}
                  className="border border-surface-200 rounded-xl p-6 space-y-4 hover:border-teal-500 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-navy-900">{uc.role}</h3>
                    <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded border border-teal-200">
                      {uc.typicalDeal}
                    </span>
                  </div>
                  <div>
                    <p className="text-2xs font-bold text-surface-400  mb-1">
                      Deliverables Example
                    </p>
                    <p className="text-sm text-surface-700">{uc.deliverables}</p>
                  </div>
                  <div className="pt-2 border-t border-surface-100">
                    <p className="text-xs text-surface-500">
                      <strong className="text-navy-900">Why it works:</strong> {uc.advantage}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 bg-teal-600 text-white text-center">
          <div className="shell max-w-xl mx-auto space-y-6">
            <h2 className="font-sans text-3xl sm:text-4xl font-normal text-balance">
              Never start another client project without a TrustLink.
            </h2>
            <p className="text-teal-100 text-base">
              Set up your free provider profile in 2 minutes. Start sharing links today.
            </p>
            <Button href="/signup" variant="primary" size="lg" className="bg-navy-900 hover:bg-navy-800 text-white font-semibold">
              Get started free →
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
