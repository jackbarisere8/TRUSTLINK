import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-navy-100 text-navy-800 border-navy-200",
  success: "bg-success-light text-success-text border-green-200",
  warning: "bg-warning-light text-warning-text border-amber-200",
  danger:  "bg-danger-light  text-danger-text  border-red-200",
  info:    "bg-blue-50       text-blue-800      border-blue-200",
  muted:   "bg-surface-100  text-surface-600   border-surface-200",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Show a subtle colored dot indicator before the label */
  dot?: boolean;
}

const dotColor: Record<BadgeVariant, string> = {
  default: "bg-navy-500",
  success: "bg-success",
  warning: "bg-warning",
  danger:  "bg-danger",
  info:    "bg-blue-500",
  muted:   "bg-surface-400",
};

export function Badge({
  className,
  variant = "default",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "px-2 py-0.5 text-xs font-medium",
        "rounded border leading-none",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotColor[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
