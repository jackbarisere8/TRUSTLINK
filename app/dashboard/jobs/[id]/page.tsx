import { notFound } from "next/navigation";
import { authorizedJob, getPublicJobProjection } from "@/lib/jobs";
import { requireUser } from "@/lib/auth";
import { JobWorkspaceView } from "@/components/jobs/job-workspace-view";
export const metadata = { title: "Transaction workspace" };
export default async function Page({params}:{params:Promise<{id:string}>}) {
  await requireUser();
  const {id} = await params;
  const result = await authorizedJob(id).catch(()=>null);
  if (!result || result.actor.type === "CLIENT_PARTICIPANT") notFound();
  const record = await getPublicJobProjection(result.aggregate.job.publicId);
  if (!record) notFound();
  return <JobWorkspaceView {...result} record={record}/>;
}
