import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
export default async function Page() {
  const user = await requireUser();
  return <main id="main-content" className="shell max-w-3xl py-12"><h1 className="interface-heading mb-8 text-[2.5rem] sm:text-[3.2rem]">Account</h1><dl className="divide-y border-y"><div className="py-5"><dt className="field-label">Email</dt><dd>{user.email}</dd></div><div className="py-5"><dt className="field-label">Public profile address</dt><dd className="record-id text-sm">/p/{user.username}</dd></div></dl><form action={logoutAction} className="mt-8"><Button variant="outline" type="submit">Sign out of this account</Button></form></main>;
}
