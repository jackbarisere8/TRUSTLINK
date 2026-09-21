import "server-only";
import { calculateReputation } from "./calculate";
import { db } from "@/lib/db";
export async function getProviderReputation(username: string) {
  const data = await db.getProfileByUsername(username);
  if (!data) return null;
  const jobs = (await db.listJobs(data.profile.userId)).filter(j => j.status === "COMPLETED");
  const records = (await Promise.all(jobs.map(j => db.getAggregate(j.id)))).filter(a => a !== null);
  return { ...data, ...calculateReputation(records),
    jobs: jobs.map(j => ({ publicId: j.publicId, title: j.terms?.service || "Service transaction", price: j.terms?.price || "", completedAt: j.completedAt })),
  };
}
