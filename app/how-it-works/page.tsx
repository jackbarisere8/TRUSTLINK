
import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "How TrustLink Works",
  description:
    "Learn how independent Nigerian service providers and clients use TrustLink to turn informal agreements into structured, evidence-backed transactions.",
};

const STEPS = [
  {
    number: "01",
    title: "Define the agreement",
    subtitle: "Turn chat messages into structured terms",
    description:
      "When a client agrees to work with you on WhatsApp, Instagram, or via referral, open TrustLink to create a Job. Specify the exact deliverables, total price in Naira, deadline date, number of included revisions, and cancellation terms.",
    details: [
      "Select your source channel (WhatsApp, Instagram, Referral, Direct)",
      "Set clear milestone or delivery deadlines",
      "Explicit revision limits prevent endless unpaid changes",
      "Set transparent cancellation and refund conditions",
    ],
  },
  {
    number: "02",
    title: "Share your universal Job URL",
    subtitle: "Send one link anywhere you converse",
    description:
      "TrustLink generates a unique, shareable link (e.g. trustlink.ng/j/web-revamp-2026). Copy it into your chat thread, send via SMS, or send it through another channel. Your client needs zero special software to open it.",
    details: [
      "Works on any mobile browser across Nigeria",
      "No app download required for your client",
      "A link preview identifies the TrustLink agreement",
      "Complete transparency before any work starts",
    ],
  },
  {
    number: "03",
    title: "Client review and acceptance",
    subtitle: "Explicit agreement, timestamped and recorded",
    description:
      "The client opens the Job Page, reviews the provider's self-provided details, service scope, and terms, and explicitly accepts the agreement. Once accepted, payment status is recorded.",
    details: [
      "Client provides a name and email; these details are self-provided",
      "Explicit 'I accept these terms' confirmation",
      "Payment Recorded status logs transaction commencement",
      "Append-only event created in the trust ledger",
    ],
  },
  {
    number: "04",
    title: "Deliver, revise, and build reputation",
    subtitle: "Delivery and feedback stay with the record",
    description:
      "Submit deliverables, link files, or share drafts directly in the workspace. Clients can request designated revisions or approve the work. After approval, the provider completes the record and the client can leave a review.",
    details: [
      "Structured delivery submissions with file links and notes",
      "Clear revision tracking against included rounds",
      "Dispute option if terms are violated",
      "Client ratings contribute to your Trust Profile",
    ],
  },
];

const FAQS = [
  {
    q: "Does TrustLink hold my money or act as an escrow?",
    a: "No. In V0.1, TrustLink operates strictly on a 'Payment Recorded' model. We do not hold client funds, manage internal wallets, or operate an escrow ledger. Payments are handled directly between provider and client (e.g. bank transfer), and TrustLink provides the immutable audit record of what was agreed, paid, and delivered.",
  },
  {
    q: "Does my client need to install an app or create an account?",
    a: "No app installation is ever required. Your client simply opens the link in their mobile browser (Chrome, Safari, etc.) to review the scope and accept the terms. They use the private participant link and provide their name and email. These details are not independent identity verification.",
  },
  {
    q: "What does 'Payment Recorded' mean on a job page?",
    a: "It means the provider declared receipt of a direct payment. TrustLink records the declaration and timestamp; it does not independently verify the transfer.",
  },
  {
    q: "What happens if there is a dispute during the job?",
    a: "Either party can raise a structured dispute from the job workspace under specific categories: Scope, Quality, Deadline, or Payment. Both parties can submit evidence (screenshots, files, agreements), which is reviewed by TrustLink administrators to facilitate a fair resolution.",
  },
  {
    q: "How does the Trust Profile work?",
    a: "Your Trust Profile is derived directly from completed transaction records, client ratings, and recorded delivery dates. It does not use opaque algorithms or fake scoring; every metric reflects real transactions completed on TrustLink.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        {/* Hero Header */}
        <section className="bg-navy-900 text-white py-16 md:py-24">
          <div className="shell text-center max-w-3xl mx-auto space-y-5">
            <p className="text-teal-400 text-xs font-bold ">
              The TrustLink Process
            </p>
            <h1 className="font-sans text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-balance">
              How informal deals become{" "}
              <em className="not-italic text-teal-400">structured transactions.</em>
            </h1>
            <p className="text-surface-300 text-lg leading-relaxed">
              No long legal contracts. No complex apps. Just a clear, verifiable record
              of scope, price, deadline, and proof.
            </p>
          </div>
        </section>

        {/* Step-by-Step Breakdown */}
        <section className="section bg-surface-50">
          <div className="shell max-w-4xl mx-auto space-y-16">
            {STEPS.map((step, idx) => (
              <div
                key={step.number}
                className="bg-white border border-surface-200 rounded-xl p-8 md:p-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-start"
              >
                <div className="md:col-span-3">
                  <span className="font-sans text-5xl font-bold text-teal-600 block mb-2">
                    {step.number}
                  </span>
                  <span className="text-xs font-bold text-surface-400 ">
                    Step {idx + 1}
                  </span>
                </div>

                <div className="md:col-span-9 space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-navy-900 font-sans">
                      {step.title}
                    </h2>
                    <p className="text-sm font-semibold text-teal-700 mt-1">
                      {step.subtitle}
                    </p>
                  </div>

                  <p className="text-surface-600 leading-relaxed text-sm">
                    {step.description}
                  </p>

                  <div className="pt-3 border-t border-surface-100">
                    <p className="text-xs font-bold text-navy-900  mb-2.5">
                      Key features:
                    </p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-surface-600 list-none p-0 m-0">
                      {step.details.map((detail) => (
                        <li key={detail} className="flex items-start gap-2">
                          <span className="text-teal-600 font-bold">✓</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="section bg-white border-t border-surface-200">
          <div className="shell max-w-3xl mx-auto">
            <div className="text-center space-y-4 mb-14">
              <p className="eyebrow">Frequently Asked Questions</p>
              <h2 className="font-sans text-3xl sm:text-4xl text-navy-900 font-normal tracking-tight">
                Clear answers, zero ambiguity
              </h2>
            </div>

            <div className="space-y-6">
              {FAQS.map((faq) => (
                <div
                  key={faq.q}
                  className="border-b border-surface-200 pb-6 last:border-b-0 space-y-2"
                >
                  <h3 className="text-base font-semibold text-navy-900">
                    {faq.q}
                  </h3>
                  <p className="text-sm text-surface-600 leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Band */}
        <section className="py-16 bg-navy-900 text-white text-center">
          <div className="shell max-w-xl mx-auto space-y-6">
            <h2 className="font-sans text-3xl font-normal">
              Ready to create your first TrustLink?
            </h2>
            <p className="text-surface-400 text-sm">
              It takes less than 3 minutes to formalize your agreement and share it with your client.
            </p>
            <Button href="/signup" variant="secondary" size="lg" className="text-white font-semibold">
              Get started free →
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
