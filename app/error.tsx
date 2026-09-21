"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/branding/logo";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[TrustLink Error]", error.digest ?? "no-digest");
  }, [error]);

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <header className="shell py-5">
        <Logo variant="full" size="md" />
      </header>

      <main id="main-content" className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-danger text-xs font-bold  mb-4">
            Something went wrong
          </p>
          <h1 className="font-sans text-4xl md:text-5xl font-normal text-navy-900 tracking-tight mb-4">
            Unexpected error.
          </h1>
          <p className="text-surface-500 text-base mb-8 leading-relaxed">
            An unexpected error occurred. Refresh the record to check whether your last change was saved.
            Please try again, or return to the home page.
          </p>
          {error.digest && (
            <p className="text-surface-400 text-xs mb-6 font-mono">
              Reference: {error.digest}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-navy-900 text-white text-sm font-semibold rounded transition-colors hover:bg-navy-800"
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-surface-200 text-navy-900 text-sm font-semibold rounded transition-colors hover:border-surface-300 hover:bg-surface-100"
            >
              Go home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
