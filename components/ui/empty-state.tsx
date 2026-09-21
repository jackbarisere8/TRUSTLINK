import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Main heading */
  title: string;
  /** Supporting explanation */
  description?: string;
  /** Optional icon element */
  icon?: ReactNode;
  /** Optional CTA button or link */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "py-16 px-6",
        className
      )}
    >
      {icon && (
        <div
          className="w-12 h-12 rounded-full bg-surface-100 border border-surface-200 flex items-center justify-center mb-4 text-surface-400"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-navy-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-surface-500 max-w-xs leading-relaxed mb-5">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

