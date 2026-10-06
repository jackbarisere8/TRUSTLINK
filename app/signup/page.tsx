"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/branding/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signupAction } from "@/app/actions/auth";

export default function SignupPage() {
  const [returnTo, setReturnTo] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReturnTo(new URLSearchParams(window.location.search).get("returnTo") || "");
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fullName || !email || !password) {
      setError("Please complete all required fields.");
      return;
    }
    setError(null);
    setMessage("");
    setLoading(true);
    const formData = new FormData();
    formData.append("displayName", fullName);
    formData.append("email", email);
    formData.append("password", password);
    if (returnTo) formData.append("returnTo", returnTo);
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

  return <div className="min-h-screen bg-surface-50 flex flex-col justify-between">
    <header className="shell py-6 flex items-center justify-between">
      <Logo variant="full" size="md" />
      <Link href="/" className="text-xs font-semibold text-surface-500 hover:text-navy-900 transition-colors">← Back to home</Link>
    </header>
    <main className="flex-1 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white border border-surface-200 rounded-xl p-8 sm:p-10 shadow-card space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-serif text-3xl font-normal text-navy-900">Create your account</h1>
          <p className="text-sm text-surface-500">Find trusted providers or enable your own provider workspace later</p>
        </div>
        {message && <p role="status" className="notice">{message}</p>}
        {error && <div className="p-3 bg-danger-light border border-red-200 rounded-lg text-xs font-medium text-danger-text" role="alert">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Full name" type="text" autoComplete="name" placeholder="Amaka Okafor" value={fullName} onChange={event => setFullName(event.target.value)} required />
          <Input label="Email address" type="email" autoComplete="email" placeholder="you@domain.com" value={email} onChange={event => setEmail(event.target.value)} required />
          <Input label="Choose password" type="password" placeholder="At least 8 characters" minLength={8} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required />
          <Button type="submit" variant="secondary" size="lg" fullWidth loading={loading}>Create account →</Button>
        </form>
        <div className="text-center pt-2 border-t border-surface-100"><p className="text-xs text-surface-500">Already have an account? <Link href={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login"} className="text-teal-600 hover:text-teal-700 font-semibold">Log in here</Link></p></div>
      </div>
    </main>
    <footer className="shell py-6 text-center text-xs text-surface-400">© {new Date().getFullYear()} TrustLink. No credit card required. No money held by TrustLink.</footer>
  </div>;
}
