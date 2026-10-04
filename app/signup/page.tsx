"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/branding/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signupAction } from "@/app/actions/auth";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profession, setProfession] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError("Please complete all required fields.");
      return;
    }
    setError(null);
    setMessage("");
    setLoading(true);

    const formData = new FormData();
    formData.append("displayName", fullName);
    formData.append("profession", profession);
    formData.append("email", email);
    formData.append("password", password);

    try {
      const result = await signupAction(formData);
      if (result?.message) setMessage(result.message);
      if (result?.error) setError(result.error);
    } catch {
      setError("Connection interrupted. Please try again.");
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
        <div className="hidden lg:block max-w-lg"><p className="eyebrow">Begin with clear terms</p><p className="page-heading mt-5 text-[3.7rem]">Make the agreement easier to keep.</p><p className="mt-6 max-w-md leading-8 text-surface-700">Put scope, fee, deadline and revisions into one record your client can review before work begins.</p><div className="mt-12 border-t border-[#cbd6d9] pt-5 text-sm text-surface-600">Record · Share · Deliver</div></div>
        <div className="auth-panel w-full max-w-md justify-self-center space-y-6 p-7 sm:p-10">
          <div className="space-y-2 text-left">
            <p className="eyebrow">Create an account</p>
            <h1 className="text-3xl font-semibold text-navy-900">
              Create your TrustLink
            </h1>
            <p className="text-sm text-surface-500">
              Create your first transaction record after sign up.
            </p>
          </div>

          {message && <p role="status" className="notice">{message}</p>}
          {error && (
            <div className="p-3 bg-danger-light border border-red-200 text-xs font-medium text-danger-text" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full name or business name"
              type="text"
              placeholder="Amaka Okafor"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <Input
              label="Primary profession / service"
              type="text"
              placeholder="Web Designer, Videographer, IT Consultant"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              hint="You can edit this later on your profile"
            />

            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Choose password"
              type="password"
              placeholder="At least 8 characters"
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="secondary"
              size="lg"
              fullWidth
              loading={loading}
            >
              Get started free →
            </Button>
          </form>

          <div className="pt-5 border-t border-surface-200">
            <p className="text-xs text-surface-500">
              Already have an account?{" "}
              <Link href="/login" className="text-teal-600 hover:text-teal-700 font-semibold">
                Log in here
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="shell py-6 text-center text-xs text-surface-400">
        © {new Date().getFullYear()} TrustLink. No credit card required. No money held by TrustLink.
      </footer>
    </div>
  );
}
