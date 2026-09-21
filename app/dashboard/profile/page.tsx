import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/profile/profile-form";
export default async function Page() {
  const user = await requireUser(); const data = await db.getProfileByUsername(user.username);
  if(!data) return <main id="main-content" className="shell py-12">Your profile could not be loaded. Try again.</main>;
  const p=data.profile, provider=data.providerProfile;
  return <main id="main-content" className="shell max-w-3xl py-10"><h1 className="text-2xl font-semibold mb-3">Your provider profile</h1><Link href={"/p/"+user.username} className="text-sm underline inline-block mb-8">View public Trust Profile</Link><ProfileForm initial={{displayName:p.displayName,country:p.country,state:p.state||"",city:p.city||"",headline:provider?.headline||"",bio:provider?.bio||"",serviceArea:provider?.serviceArea||""}}/></main>;
}
