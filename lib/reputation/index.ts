import "server-only";
import { calculateReputation } from "./calculate";
import { db } from "@/lib/db";
import type { JobAggregate } from "@/lib/db/repository";
export async function getProviderReputation(username: string) {
  const data = await db.getProfileByUsername(username);
  if (!data) return null;
  const jobs = (await db.listJobs(data.profile.userId)).filter(j => j.status === "COMPLETED");
  const records = (await Promise.all(jobs.map(j => db.getAggregate(j.id))))
    .filter((aggregate): aggregate is JobAggregate => aggregate !== null)
    .filter(aggregate => aggregate.job.status === "COMPLETED" && aggregate.job.providerId === data.profile.userId)
    .sort((a,b) => (b.job.completedAt || b.job.updatedAt).localeCompare(a.job.completedAt || a.job.updatedAt));
  return { ...data, ...calculateReputation(records),
    jobs: records.slice(0,6).map(record => {
      const review = record.reviews[0];
      return {
        publicId: record.job.publicId,
        title: record.terms.service,
        category: record.terms.serviceCategory,
        scope: record.terms.scope,
        completedAt: record.job.completedAt,
        rating: review?.rating,
        comment: review?.comment,
      };
    }),
  };
}
