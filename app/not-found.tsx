import Link from "next/link";
import { Logo } from "@/components/branding/logo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <header className="shell py-5">
        <Logo variant="full" size="md" />
      </header>

      <main id="main-content" className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-teal-600 text-xs font-bold  mb-4">
            404
          </p>
          <h1 className="font-sans text-4xl md:text-5xl font-normal text-navy-900 tracking-tight mb-4">
            Page not found.
          </h1>
          <p className="text-surface-500 text-base mb-8 leading-relaxed">
            The link you followed may have expired, been moved, or never existed.
            If someone shared a job link with you, ask them to send it again.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-navy-900 text-white text-sm font-semibold rounded transition-colors hover:bg-navy-800"
            >
              Go home
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-surface-200 text-navy-900 text-sm font-semibold rounded transition-colors hover:border-surface-300 hover:bg-surface-100"
            >
              Create a TrustLink
            </Link>
          </div>
        </div>
      </main>

      <footer className="shell py-6">
        <p className="text-surface-400 text-xs text-center">
          © {new Date().getFullYear()} TrustLink. Make the agreement clear.
        </p>
      </footer>
    </div>
  );
}
