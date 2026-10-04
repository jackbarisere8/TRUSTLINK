import Link from "next/link";
import { Logo } from "@/components/branding/logo";

export default function TransactionRecordNotFound() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <header className="shell py-5"><Logo variant="full" size="md" /></header>
      <main id="main-content" className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-surface-600 text-xs font-bold mb-4">404</p>
          <h1 className="font-sans text-4xl md:text-5xl font-normal text-navy-900 tracking-tight mb-4">Transaction Record Not Found</h1>
          <p className="text-surface-500 text-base mb-8 leading-relaxed">This transaction record is unavailable. Ask the provider to send the current link.</p>
          <Link href="/" className="inline-flex items-center justify-center px-5 py-2.5 bg-navy-900 text-white text-sm font-semibold rounded transition-colors hover:bg-navy-800">Go home</Link>
        </div>
      </main>
    </div>
  );
}
