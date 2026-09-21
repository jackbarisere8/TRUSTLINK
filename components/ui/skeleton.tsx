import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  /** Override the default shimmer animation */
  animate?: boolean;
}

export function Skeleton({ className, animate = true }: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-surface-100 rounded",
        animate && [
          "after:absolute after:inset-0",
          "after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent",
          "after:translate-x-[-100%] after:animate-shimmer",
        ],
        className
      )}
      aria-hidden="true"
    />
  );
}

/** Pre-built card skeleton for job listings */
export function JobCardSkeleton() {
  return (
    <div className="bg-white border border-surface-200 rounded-lg p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <div className="flex gap-4 pt-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/** Pre-built profile stat skeleton */
export function StatSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-7 w-12" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

