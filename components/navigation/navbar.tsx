"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Logo } from "@/components/branding/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/how-it-works",   label: "How it works" },
  { href: "/for-providers",  label: "For providers" },
  { href: "/for-businesses", label: "For businesses" },
  { href: "/explore",        label: "Explore" },
];

interface NavbarProps {
  variant?: "light" | "dark" | "transparent";
  className?: string;
}

export function Navbar({ variant = "light", className }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setMobileMenuOpen(false); toggleRef.current?.focus(); } };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [mobileMenuOpen]);
  const isLight = variant === "light";
  const isDark  = variant === "dark";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full",
        isLight && "bg-white border-b border-surface-200",
        isDark  && "bg-navy-900/95 border-b border-navy-800",
        variant === "transparent" && "bg-transparent",
        className
      )}
    >
      <nav
        className="shell flex items-center justify-between h-16"
        aria-label="Main navigation"
      >
        {/* ── Logo ── */}
        <Logo
          variant="full"
          size="md"
          theme={isDark ? "dark" : "light"}
        />

        {/* ── Desktop Links ── */}
        <ul
          className="hidden lg:flex items-center gap-7 list-none m-0 p-0"
          role="list"
        >
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "text-sm font-medium transition-colors duration-150",
                  isLight
                    ? "text-surface-600 hover:text-navy-900"
                    : "text-surface-300 hover:text-white"
                )}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* ── Desktop CTA & Log in ── */}
        <div className="hidden lg:flex items-center gap-4">
          <Link
            href="/login"
            className={cn(
              "text-sm font-medium transition-colors duration-150",
              isLight
                ? "text-surface-600 hover:text-navy-900"
                : "text-surface-300 hover:text-white"
            )}
          >
            Log in
          </Link>
          <Button
            href="/signup"
            variant="primary"
            size="sm"
            className="text-xs px-4"
          >
            Create a TrustLink
          </Button>
        </div>

        {/* ── Mobile Hamburger Button ── */}
        <div className="flex items-center gap-2 lg:hidden">
          <Button
            href="/signup"
            variant="primary"
            size="sm"
            className="text-xs px-3"
          >
            Start
          </Button>
          <button
            ref={toggleRef}
            aria-controls="mobile-navigation"
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={cn(
              "p-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500",
              isLight
                ? "border-surface-200 text-navy-900 hover:bg-surface-100"
                : "border-navy-700 text-white hover:bg-navy-800"
            )}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* ── Mobile Navigation Drawer ── */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          className={cn(
            "lg:hidden border-b px-4 py-5 space-y-4 animate-fade-in",
            isLight
              ? "bg-white border-surface-200"
              : "bg-navy-900 border-navy-800 text-white"
          )}
        >
          <ul className="space-y-3 list-none p-0 m-0" role="list">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "block text-sm font-medium py-1.5 transition-colors",
                    isLight
                      ? "text-surface-700 hover:text-navy-900"
                      : "text-surface-300 hover:text-white"
                  )}
                >
                  {label}
                </Link>
              </li>
            ))}
            <li className="pt-2 border-t border-surface-200">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block text-sm font-medium py-1.5 transition-colors",
                  isLight
                    ? "text-surface-700 hover:text-navy-900"
                    : "text-surface-300 hover:text-white"
                )}
              >
                Log in
              </Link>
            </li>
          </ul>

          <div className="pt-2">
            <Button
              href="/signup"
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => setMobileMenuOpen(false)}
            >
              Create your first TrustLink →
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
