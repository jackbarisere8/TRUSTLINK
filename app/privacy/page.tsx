import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";

export const metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy explaining how TrustLink handles data and transaction records.",
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="py-16 md:py-24 bg-surface-50 text-navy-900">
        <div className="shell-narrow bg-white p-8 md:p-12 rounded-xl border border-surface-200 space-y-8">
          <div className="border-b border-surface-100 pb-6">
            <p className="eyebrow mb-2">Data Protection & Privacy</p>
            <h1 className="font-sans text-3xl sm:text-4xl font-normal">Privacy Policy</h1>
            <p className="text-surface-500 text-xs mt-2">Last updated: September 2026</p>
          </div>

          <div className="space-y-6 text-sm text-surface-600 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-navy-900">1. Information We Collect</h2>
              <p>
                We collect minimal information required to identify account holders and record service transactions:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Account registration data: Email address, display name, profile headline, bio, and service location.</li>
                <li>Job transaction data: Service title, deliverables, agreed price, deadlines, and source channel metadata.</li>
                <li>Delivery and evidence files: Work submissions, revision descriptions, and dispute evidence uploaded by participants.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-navy-900">2. How We Protect Your Transaction Data</h2>
              <p>
                Dispute evidence, delivery files, and private job notes are strictly restricted to the authorized
                participants of that job and authorized TrustLink administrative auditors. Raw database access is restricted, and server-side participant checks control private record and file access.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-navy-900">3. Financial Data & Payment Privacy</h2>
              <p>
                Because TrustLink operates on a &quot;Payment Recorded&quot; model in V0.1, we <strong>do not store raw debit/credit card details</strong>,
                bank account passwords, or sensitive BVN/NIN credentials. Payment records store a provider&apos;s report of receipt,
                optional reference and notes, and the recording time. The agreed fee and currency belong to the agreement;
                they are not independently verified transfer amounts.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-navy-900">4. Public Job & Profile Visibility</h2>
              <p>
                Job pages shared via universal link (`/j/[publicId]`) display only terms necessary for the client to review
                and accept the agreement. Provider Trust Profiles (`/p/[username]`) display provider details, transaction history and aggregated metrics from
                completed jobs (e.g. number of completed jobs, average client rating, on-time percentage).
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
