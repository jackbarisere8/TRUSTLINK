"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/auth";
import { Logo } from "@/components/branding/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    const form = new FormData();
    form.set("email", email);
    try {
      const result = await requestPasswordResetAction(form);
      setMessage(result.message ?? null);
      setError(result.error ?? null);
    } catch {
      setError("Connection interrupted. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f3] flex flex-col">
      <header className="shell py-6 flex items-center justify-between border-b border-[#dbe2e3]">
        <Logo variant="full" size="md" />
        <Link href="/login" className="text-xs font-semibold text-surface-500 hover:text-navy-900">Back to sign in</Link>
      </header>
      <main id="main-content" className="shell flex flex-1 items-center justify-center py-12">
        <section className="auth-panel w-full max-w-md space-y-6 p-7 sm:p-10" aria-labelledby="recovery-heading">
          <div className="space-y-2">
            <p className="eyebrow">Account recovery</p>
            <h1 id="recovery-heading" className="text-3xl font-semibold text-navy-900">Reset your password</h1>
            <p className="text-sm leading-6 text-surface-600">Enter the account email. For privacy, TrustLink gives the same response whether or not the address is registered.</p>
          </div>
          {message && <p role="status" className="notice">{message}</p>}
          {error && <p role="alert" className="p-3 bg-danger-light border border-red-200 text-xs font-medium text-danger-text">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email address" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required />
            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>Send reset link</Button>
          </form>
        </section>
      </main>
    </div>
  );
}
