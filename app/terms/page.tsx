import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";

export const metadata = {
  title: "Terms of Service",
  description: "Terms of Service governing the use of TrustLink Web.",
};

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="py-16 md:py-24 bg-surface-50 text-navy-900">
        <div className="shell-narrow bg-white p-8 md:p-12 rounded-xl border border-surface-200 space-y-8">
          <div className="border-b border-surface-100 pb-6">
            <p className="eyebrow mb-2">Legal & Operating Guidelines</p>
            <h1 className="font-sans text-3xl sm:text-4xl font-normal">Terms of Service</h1>
            <p className="text-surface-500 text-xs mt-2">Last updated: September 2026</p>
          </div>

          <div className="space-y-6 text-sm text-surface-600 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-navy-900">1. Nature of the TrustLink Service</h2>
              <p>
                TrustLink is a transaction-trust and agreement-recording utility designed for independent
                service providers and their clients in Nigeria. TrustLink facilitates clarity by providing a structured
                environment to record agreed scopes of work, prices, deadlines, deliverables, and revision parameters.
              </p>
            </section>

            <section className="space-y-2 bg-teal-50 p-4 rounded-lg border border-teal-200 text-teal-900">
              <h2 className="text-base font-bold text-teal-950">2. Payment & Custody Boundary (Strict Policy)</h2>
              <p>
                TrustLink operates on a <strong>Payment Recorded</strong> model. TrustLink is <strong>not a bank</strong>,
                <strong>not an escrow agent</strong>, and does <strong>not take custody of customer funds</strong>.
                All monetary transfers occur directly between the service provider and the client via their chosen
                financial institutions. Marking a transaction as &quot;Payment Recorded&quot; represents a provider declaration
                that a payment has taken place; it does not imply that TrustLink holds or guarantees those funds.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-navy-900">3. Job Agreement & Deliverables</h2>
              <p>
                When a provider creates a Job on TrustLink and a client explicitly accepts it, the recorded terms
                (scope, price, deadline, revisions, and cancellation terms) constitute the reference record between
                the parties. Delivery files, revision requests, and timestamped events form an immutable audit trail
                attached to that transaction.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-navy-900">4. Disputes & Resolution Process</h2>
              <p>
                In the event of a disagreement regarding scope, quality, timeliness, or payment, either party may
                open a structured dispute within the job workspace. TrustLink operators review submitted evidence,
                audit logs, and the original terms to provide objective resolution assistance. TrustLink does not
                provide automated dispute adjudication.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-navy-900">5. User Conduct & Integrity</h2>
              <p>
                Users must provide truthful identity details. TrustLink reserves the right to suspend or terminate
                accounts found engaging in fraudulent representations, fabricated transaction evidence, or harassment.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

