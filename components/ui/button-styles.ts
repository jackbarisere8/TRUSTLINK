import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 border border-transparent",
  secondary: "bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 border border-transparent",
  outline: "bg-transparent text-navy-900 border border-surface-200 hover:bg-surface-100 hover:border-surface-300 active:bg-surface-200",
  ghost: "bg-transparent text-navy-900 border border-transparent hover:bg-surface-100 active:bg-surface-200",
  danger: "bg-danger text-white hover:bg-red-700 active:bg-red-800 border border-transparent",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-11 px-3 text-xs gap-1.5 rounded",
  md: "h-11 px-4 text-sm gap-2 rounded",
  lg: "h-12 px-6 text-base gap-2.5 rounded",
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
    className,
  );
}
