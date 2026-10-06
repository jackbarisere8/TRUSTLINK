"use client";

import { useState } from "react";
import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/auth";
import { Logo } from "@/components/branding/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.set("password", password);
    form.set("confirmPassword", confirmPassword);
    try {
      const result = await resetPasswordAction(form);
      if (result?.error) setError(result.error);
    } catch {
      setError("Connection interrupted. Request a new reset link if this continues.");
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
        <section className="auth-panel w-full max-w-md space-y-6 p-7 sm:p-10" aria-labelledby="new-password-heading">
          <div className="space-y-2">
            <p className="eyebrow">Account recovery</p>
            <h1 id="new-password-heading" className="text-3xl font-semibold text-navy-900">Choose a new password</h1>
            <p className="text-sm leading-6 text-surface-600">This form works only after a valid recovery link establishes a temporary Supabase session.</p>
          </div>
          {error && <p role="alert" className="p-3 bg-danger-light border border-red-200 text-xs font-medium text-danger-text">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="New password" type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required />
            <Input label="Confirm new password" type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required />
            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>Change password</Button>
          </form>
        </section>
      </main>
    </div>
  );
}
