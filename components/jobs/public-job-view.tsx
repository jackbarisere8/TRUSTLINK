import Link from "next/link";
import { Logo } from "@/components/branding/logo";
import { TransactionRecord } from "./transaction-record";
import type { PublicJobProjection } from "@/lib/db/types";

export function PublicJobView({ record, children }: { record: PublicJobProjection; children?: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f4f6f3]"><header className="border-b border-[#dbe2e3] bg-white"><div className="shell h-[72px] flex items-center justify-between"><Logo/><Link href="/" className="quiet-link text-sm">About TrustLink</Link></div></header>
    <main id="main-content" className="shell max-w-3xl py-8 sm:py-14">
      <div className="mb-6 sm:mb-8">
        <p className="eyebrow">Public agreement</p>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-surface-600">Review the provider, terms and current status. Recorded activity and available participant actions follow below.</p>
      </div>
      <TransactionRecord record={record} publicAgreement>{children}</TransactionRecord>
      <p className="text-xs text-surface-600 text-center mt-8">Keep your private participant link confidential. <Link href="/privacy" className="quiet-link">Privacy</Link>{" \u00b7 "}<Link href="/terms" className="quiet-link">Terms</Link></p>
    </main></div>;
}
