import Link from "next/link";
import { Logo } from "@/components/branding/logo";
import { TransactionRecord } from "./transaction-record";
import type { PublicJobProjection } from "@/lib/db/types";
export function PublicJobView({ record, example = false, children }: { record: PublicJobProjection; example?: boolean; children?: React.ReactNode }) {
  return <div className="min-h-screen bg-surface-50"><header className="border-b bg-white"><div className="shell h-16 flex items-center justify-between"><Logo/><Link href="/" className="text-sm text-surface-600">About TrustLink</Link></div></header>
    <main id="main-content" className="shell max-w-3xl py-8 sm:py-12">
      {example && <p className="notice mb-5">Example data · This illustrates an agreement. It is not a real transaction and cannot be accepted.</p>}
      <TransactionRecord record={record} example={example}>{children}</TransactionRecord>
      <p className="text-xs text-surface-500 text-center mt-8">Keep your private participant link confidential. <Link href="/privacy" className="underline">Privacy</Link> · <Link href="/terms" className="underline">Terms</Link></p>
    </main></div>;
}
