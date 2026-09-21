"use client";
import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Variant definitions ────────────────────────────────────────────────────

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize    = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 " +
    "border border-transparent",
  secondary:
    "bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 " +
    "border border-transparent",
  outline:
    "bg-transparent text-navy-900 border border-surface-200 " +
    "hover:bg-surface-100 hover:border-surface-300 active:bg-surface-200",
  ghost:
    "bg-transparent text-navy-900 border border-transparent " +
    "hover:bg-surface-100 active:bg-surface-200",
  danger:
    "bg-danger text-white hover:bg-red-700 active:bg-red-800 " +
    "border border-transparent",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm:  "h-11 px-3 text-xs gap-1.5 rounded",
  md:  "h-11 px-4 text-sm gap-2 rounded",
  lg:  "h-12 px-6 text-base gap-2.5 rounded",
};

export function getButtonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center font-semibold no-underline",
    "transition-colors duration-150 cursor-pointer select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  /** When provided, renders as Next.js Link instead of button */
  href?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      children,
      href,
      ...props
    },
    ref
  ) => {
    const classes = getButtonClasses({ variant, size, fullWidth, className });

    const spinner = loading && (
      <svg
        className="animate-spin -ml-0.5 h-4 w-4 flex-shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    );

    if (href) {
      return (
        <Link href={href} className={classes} aria-disabled={disabled || loading} onClick={(event) => {
          if (disabled || loading) event.preventDefault();
          else props.onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
        }}>
          {spinner}
          {children}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={classes}
        {...props}
      >
        {spinner}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
