"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Do not emit the message or stack: either may contain request or evidence data.
    console.error("[TrustLink Root Error]", error.digest ?? "no-digest");
  }, [error]);

  return (
    <html lang="en-NG">
      <body>
        <main id="main-content" className="min-h-screen bg-surface-50 flex items-center justify-center px-4 text-navy-900">
          <section className="max-w-md space-y-5 text-center" aria-labelledby="root-error-heading">
            <p className="text-xs font-bold text-danger">Something went wrong</p>
            <h1 id="root-error-heading" className="text-4xl font-semibold">TrustLink could not load this page.</h1>
            <p className="text-sm leading-7 text-surface-600">
              Refresh to check whether your last change was saved. If the problem continues, return to the home page and try again.
            </p>
            {error.digest && <p className="text-xs font-mono text-surface-500">Reference: {error.digest}</p>}
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={reset} className="min-h-11 bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white">
                Try again
              </button>
              <Link href="/" className="min-h-11 border border-surface-300 px-5 py-2.5 text-sm font-semibold">
                Go home
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
