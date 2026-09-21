import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreateJobForm } from "@/components/jobs/create-job-form";
export default async function Page() {
  const user = await requireUser(); const profile=await db.getProfileByUsername(user.username);
  const jobs=await db.listJobs(user.userId);
  const location=[profile?.profile.city,profile?.profile.country].filter(Boolean).join(", ");
  return <main id="main-content" className="shell max-w-3xl py-10"><h1 className="text-2xl font-semibold mb-3">Create a TrustLink</h1><p className="text-sm text-surface-500 mb-8">Start with the terms you and your client have already discussed.</p><CreateJobForm repeat={jobs.length>0} location={location} provider={{username:user.username,displayName:user.displayName,initials:user.displayName.slice(0,2),headline:profile?.providerProfile?.headline||"Independent professional",verificationStatus:"UNVERIFIED"}}/></main>;
}
