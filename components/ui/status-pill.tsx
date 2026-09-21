import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/db/types";
export type { JobStatus } from "@/lib/db/types";
const labels: Record<JobStatus,string> = { DRAFT: "Draft", SENT: "Awaiting acceptance", ACCEPTED: "Accepted", PAYMENT_RECORDED: "Payment recorded", IN_PROGRESS: "In progress", DELIVERY_SUBMITTED: "Delivery submitted", REVISION_REQUESTED: "Revision requested", APPROVED: "Approved", COMPLETED: "Completed", DISPUTED: "Disputed", CANCELLED: "Cancelled" };
export function StatusPill({ status, className, showDot = true }: { status: JobStatus; className?: string; showDot?: boolean }) {
  return <span className={cn("inline-flex items-center gap-2 text-xs font-medium leading-5", status === "DISPUTED" ? "text-red-700" : ["COMPLETED","APPROVED","PAYMENT_RECORDED"].includes(status) ? "text-teal-800" : "text-surface-600", className)}>
    {showDot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />}{labels[status] || "Unknown status"}
  </span>;
}
