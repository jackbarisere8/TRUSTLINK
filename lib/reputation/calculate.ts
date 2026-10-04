import type { JobAggregate } from "../db/repository";

function clientKey(record: JobAggregate) {
  if (record.job.clientId) return `account:${record.job.clientId}`;
  const email = record.job.clientEmail?.trim().toLowerCase();
  return email ? `self-reported-email:${email}` : undefined;
}

export function calculateReputation(records: JobAggregate[]) {
  const completed = records.filter(a => a.job.status === "COMPLETED");
  const reviews = completed.flatMap(a => a.reviews);
  const timed = completed.filter(a => a.deliveries.length && /^\d{4}-\d{2}-\d{2}$/.test(a.terms.deadline));
  const onTime = timed.filter(a => Date.parse(a.deliveries.at(-1)!.submittedAt) <= Date.parse(a.terms.deadline + "T23:59:59.999+01:00"));
  const clientKeys = completed.map(clientKey);
  const clientCounts = new Map<string,number>();
  for (const key of clientKeys) if (key) clientCounts.set(key,(clientCounts.get(key) || 0)+1);
  const completedServices = [...new Set(completed.map(record => record.terms.service.trim()).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b));
  return {
    completedJobsCount: completed.length,
    averageRating: reviews.length ? (reviews.reduce((sum,r) => sum+r.rating,0)/reviews.length).toFixed(1) : "—",
    reviewCount: reviews.length,
    onTimeRate: timed.length ? Math.round(onTime.length/timed.length*100) + "%" : "—",
    onTimeJobsCount: timed.length,
    repeatClientCount: completed.length && clientKeys.every(Boolean)
      ? [...clientCounts.values()].filter(count => count > 1).length
      : "—",
    completedServices,
  };
}
