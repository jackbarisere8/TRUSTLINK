import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { db } from "@/lib/db";
import type { JobStatus, JobSummaryRecord } from "@/lib/db/types";
import { dateLabel } from "@/lib/format";
import { eventLabels } from "@/lib/trust-events";
import { Button } from "@/components/ui/button";
import { JobList } from "@/components/jobs/job-list";

export const metadata = { title: "Your workspace" };

const providerAction: Partial<Record<JobStatus, string>> = {
  DRAFT: "Review draft",
  ACCEPTED: "Record payment after receipt",
  PAYMENT_RECORDED: "Start work",
  IN_PROGRESS: "Submit delivery",
  REVISION_REQUESTED: "Start revision",
  APPROVED: "Complete transaction",
  DISPUTED: "Review dispute",
};

function service(job: JobSummaryRecord) {
  return job.terms?.service || "Service transaction";
}

export default async function Page() {
  const user = await requireProvider();
  const jobs = await db.listJobs(user.userId);
  const recentJobs = [...jobs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const active = recentJobs.filter(job => !["COMPLETED", "CANCELLED"].includes(job.status));
  const currentActions = active.filter(job => providerAction[job.status]);
  const pending = active.filter(job => job.status === "SENT" || job.status === "DELIVERY_SUBMITTED");
  const activitySources = await Promise.all(recentJobs.slice(0, 6).map(async job => ({
    job,
    events: (await db.getPublicTransaction(job.publicId))?.events || [],
  })));
  const activity = activitySources.flatMap(({ job, events }) => events.map((event, index) => ({ job, event, index })))
    .sort((a, b) => b.event.occurredAt.localeCompare(a.event.occurredAt) || b.index - a.index)
    .slice(0, 4);

  return <main id="main-content" className="shell max-w-5xl pb-16 pt-8 sm:pt-12">
    <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
      <div><p className="eyebrow">Workspace</p><h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.2rem]">Your workspace</h1><p className="mt-3 text-sm text-surface-600">Your transactions, next actions and recorded activity.</p></div>
      {jobs.length > 0 && <Button href="/dashboard/jobs/new">Create a TrustLink</Button>}
    </div>

    {!jobs.length ? <section className="border-y border-[#dbe2e3] py-12 sm:py-16" aria-labelledby="empty-workspace-heading">
      <h2 id="empty-workspace-heading" className="text-xl font-semibold">No transactions here yet</h2>
      <p className="mt-4 max-w-md text-sm leading-7 text-surface-600">Your first TrustLink transaction will appear here once you create one.</p>
      <Button href="/dashboard/jobs/new" className="mt-6">Create your first transaction</Button>
    </section> : <>
      <section aria-labelledby="active-transactions-heading">
        <div className="mb-5 flex items-end justify-between gap-4"><h2 id="active-transactions-heading" className="text-xl font-semibold">Active transactions</h2><Link href="/dashboard/jobs?filter=active" className="quiet-link text-sm">View all</Link></div>
        {active.length ? <JobList jobs={active.slice(0, 5)} headingLevel={3}/> : <p className="border-y border-[#dbe2e3] py-6 text-sm text-surface-600">No active transactions right now. <Link href="/dashboard/jobs" className="quiet-link">View all records</Link>.</p>}
      </section>

      <section className="mt-12 border-t border-[#dbe2e3] pt-8" aria-labelledby="current-actions-heading">
        <h2 id="current-actions-heading" className="text-xl font-semibold">Current actions</h2>
        {currentActions.length ? <ul className="mt-5 divide-y divide-[#dbe2e3] border-y border-[#dbe2e3]">{currentActions.slice(0, 4).map(job => <li key={job.id}><Link href={"/dashboard/jobs/" + job.id} className="block py-4 hover:text-teal-800"><span className="block text-sm font-semibold">{providerAction[job.status]}</span><span className="mt-1 block text-sm text-surface-600">{service(job)} · Due <time className="record-time" dateTime={job.terms?.deadline}>{dateLabel(job.terms?.deadline)}</time></span></Link></li>)}</ul> : <p className="mt-4 text-sm text-surface-600">No action is needed from you right now.</p>}
      </section>

      <section className="mt-12 border-t border-[#dbe2e3] pt-8" aria-labelledby="recent-activity-heading">
        <h2 id="recent-activity-heading" className="text-xl font-semibold">Recent activity</h2>
        {activity.length ? <ol className="mt-5 divide-y divide-[#dbe2e3] border-y border-[#dbe2e3]">{activity.map(({ job, event }) => <li key={event.id}><Link href={"/dashboard/jobs/" + job.id} className="grid gap-1 py-4 hover:text-teal-800 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6"><span><span className="block text-sm font-semibold">{eventLabels[event.eventType]}</span><span className="mt-1 block text-sm text-surface-600">{service(job)}</span></span><time dateTime={event.occurredAt} className="record-time text-xs text-surface-600 sm:text-right">{dateLabel(event.occurredAt)}</time></Link></li>)}</ol> : <p className="mt-4 text-sm text-surface-600">No activity has been recorded yet.</p>}
      </section>

      <section className="mt-12 border-t border-[#dbe2e3] pt-8" aria-labelledby="pending-work-heading">
        <h2 id="pending-work-heading" className="text-xl font-semibold">Pending work</h2>
        {pending.length ? <ul className="mt-5 divide-y divide-[#dbe2e3] border-y border-[#dbe2e3]">{pending.slice(0, 4).map(job => <li key={job.id}><Link href={"/dashboard/jobs/" + job.id} className="block py-4 hover:text-teal-800"><span className="block text-sm font-semibold">{job.status === "SENT" ? "Awaiting client acceptance" : "Awaiting client review"}</span><span className="mt-1 block text-sm text-surface-600">{service(job)}</span></Link></li>)}</ul> : <p className="mt-4 text-sm text-surface-600">Nothing is waiting on a client right now.</p>}
      </section>
      <p className="mt-12 border-t border-[#dbe2e3] pt-5 text-xs leading-6 text-surface-600">Activity lists recorded transaction milestones. Payment records are provider declarations; TrustLink does not process or hold funds.</p>
    </>}
  </main>;
}
