"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/branding/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { loginAction } from "@/app/actions/auth";

function AccountNotice() {
  const params = useSearchParams();
  const confirmation = params.get("confirmation");
  const recovery = params.get("recovery");
  const message = confirmation === "failed"
    ? "We couldn't confirm that email. The link may be invalid, expired, or already used. Sign in if the account is already confirmed, or create the account again to request a new confirmation email."
    : confirmation === "limited"
      ? "Too many confirmation attempts were made. Wait a few minutes before opening the link again."
      : recovery === "failed"
        ? "That password reset link is invalid or expired. Request a new reset link."
        : recovery === "limited"
          ? "Too many password reset attempts were made. Wait a few minutes and request a new link."
          : recovery === "updated"
            ? "Your password was changed. Sign in with the new password."
            : null;
  if (!message) return null;
  const success = recovery === "updated";
  return <p role={success ? "status" : "alert"} className={success ? "notice" : "p-3 bg-danger-light border border-red-200 text-xs font-medium text-danger-text"}>{message}</p>;
}

export default function LoginPage() {
  const [returnTo, setReturnTo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReturnTo(new URLSearchParams(window.location.search).get("returnTo") || "");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);
    if (returnTo) formData.append("returnTo", returnTo);

    try {
      const result = await loginAction(formData);
      if (result?.error) setError(result.error);
    } catch {
      setError("Connection interrupted. Please try signing in again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6f3] flex flex-col justify-between">
      <header className="shell py-6 flex items-center justify-between border-b border-[#dbe2e3]">
        <Logo variant="full" size="md" />
        <Link
          href="/"
          className="text-xs font-semibold text-surface-500 hover:text-navy-900 transition-colors"
        >
          ← Back to home
        </Link>
      </header>

      <main id="main-content" className="shell flex-1 grid items-center gap-12 py-10 lg:grid-cols-[1fr_1fr] lg:gap-20 lg:py-16">
        <div className="hidden lg:block max-w-lg"><p className="eyebrow">Your work, in one place</p><p className="page-heading mt-5 text-[3.7rem]">Pick up where the agreement left off.</p><p className="mt-6 max-w-md leading-8 text-surface-700">Review current terms, follow delivery and keep the work moving from your workspace.</p><div className="mt-12 border-t border-[#cbd6d9] pt-5 text-sm text-surface-600">Agreement · Delivery · History</div></div>
        <div className="auth-panel w-full max-w-md justify-self-center space-y-6 p-7 sm:p-10">
          <div className="space-y-2 text-left">
            <p className="eyebrow">Sign in</p>
            <h1 className="text-3xl font-semibold text-navy-900">
              Welcome back
            </h1>
            <p className="text-sm text-surface-500">
              Log in to manage your transactions and profile.
            </p>
          </div>

          <Suspense fallback={null}><AccountNotice /></Suspense>

          {error && (
            <div className="p-3 bg-danger-light border border-red-200 text-xs font-medium text-danger-text" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="space-y-1">
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="text-right">
                <Link href="/forgot-password" className="text-xs font-semibold text-teal-700 hover:text-teal-800">
                  Forgot your password?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
            >
              Log in to TrustLink
            </Button>
          </form>

          <div className="pt-5 border-t border-surface-200">
            <p className="text-xs text-surface-500">
              Don&apos;t have an account yet?{" "}
              <Link href={returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : "/signup"} className="text-teal-600 hover:text-teal-700 font-semibold">
                Create a TrustLink account
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="shell py-6 text-center text-xs text-surface-400">
        © {new Date().getFullYear()} TrustLink. Turn any deal into a trusted transaction.
      </footer>
    </div>
  );
}
