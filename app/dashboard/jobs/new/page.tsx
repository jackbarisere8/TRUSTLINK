import { requireProvider } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreateJobForm } from "@/components/jobs/create-job-form";
export default async function Page() {
  const user = await requireProvider(); const profile=await db.getProfileByUsername(user.username);
  const jobs=await db.listJobs(user.userId);
  const location=[profile?.profile.city,profile?.profile.country].filter(Boolean).join(", ");
  return <main id="main-content" className="shell max-w-3xl pb-16 pt-8 sm:pt-12"><p className="eyebrow">New transaction</p><h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.2rem]">Create a TrustLink</h1><p className="mb-10 mt-4 max-w-lg text-sm leading-7 text-surface-700">Start with the terms you and your client have already discussed.</p><CreateJobForm repeat={jobs.length>0} location={location} provider={{username:user.username,displayName:user.displayName,headline:profile?.providerProfile?.headline||"Independent professional"}}/></main>;
}
