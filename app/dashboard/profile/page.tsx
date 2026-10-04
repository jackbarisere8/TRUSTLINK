import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/profile/profile-form";
export default async function Page() {
  const user = await requireUser(); const data = await db.getProfileByUsername(user.username);
  if(!data) return <main id="main-content" className="shell max-w-3xl py-12"><h1 className="interface-heading text-[2.5rem]">Your provider profile</h1><p className="mt-5 text-sm text-surface-700" role="alert">Your profile could not be loaded. Try again.</p></main>;
  const p=data.profile, provider=data.providerProfile;
  return <main id="main-content" className="shell max-w-3xl pb-16 pt-8 sm:pt-12"><div className="mb-10 border-b border-[#dbe2e3] pb-7"><p className="eyebrow">Workspace / Profile</p><h1 className="interface-heading mt-3 text-[2.5rem] sm:text-[3.2rem]">Your provider profile</h1><p className="mt-4 max-w-lg text-sm leading-7 text-surface-700">These details describe your work. Your public Trust Profile shows completed transaction history separately.</p><Link href={"/p/"+user.username} className="quiet-link mt-4 inline-block py-2 text-sm font-semibold">View public Trust Profile →</Link></div><ProfileForm initial={{displayName:p.displayName,country:p.country,state:p.state||"",city:p.city||"",headline:provider?.headline||"",bio:provider?.bio||"",serviceArea:provider?.serviceArea||""}}/></main>;
}
