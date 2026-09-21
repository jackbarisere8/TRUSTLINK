import type { JobAggregate } from "../db/repository";
export function calculateReputation(records: JobAggregate[]) {
  const completed = records.filter(a => a.job.status === "COMPLETED");
  const reviews = completed.flatMap(a => a.reviews);
  const timed = completed.filter(a => a.deliveries.length && /^\d{4}-\d{2}-\d{2}$/.test(a.terms.deadline));
  const onTime = timed.filter(a => Date.parse(a.deliveries.at(-1)!.submittedAt) <= Date.parse(a.terms.deadline + "T23:59:59.999+01:00"));
  return {
    completedJobsCount: completed.length,
    averageRating: reviews.length ? (reviews.reduce((sum,r) => sum+r.rating,0)/reviews.length).toFixed(1) : "—",
    onTimeRate: timed.length ? Math.round(onTime.length/timed.length*100) + "%" : "—",
  };
}
