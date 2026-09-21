"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/branding/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-surface-50 flex flex-col justify-between">
      <header className="shell py-6 flex items-center justify-between">
        <Logo variant="full" size="md" />
        <Link
          href="/"
          className="text-xs font-semibold text-surface-500 hover:text-navy-900 transition-colors"
        >
          ← Back to home
        </Link>
      </header>

      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white border border-surface-200 rounded-xl p-8 sm:p-10 space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="font-sans text-3xl font-normal text-navy-900">
              Welcome back
            </h1>
            <p className="text-sm text-surface-500">
              Log in to manage your TrustLink jobs and profile
            </p>
          </div>

          {error && (
            <div className="p-3 bg-danger-light border border-red-200 rounded-lg text-xs font-medium text-danger-text" role="alert">
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
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

          <div className="text-center pt-2 border-t border-surface-100">
            <p className="text-xs text-surface-500">
              Don&apos;t have an account yet?{" "}
              <Link href="/signup" className="text-teal-600 hover:text-teal-700 font-semibold">
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
