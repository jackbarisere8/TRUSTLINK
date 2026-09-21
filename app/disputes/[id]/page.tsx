import { notFound } from "next/navigation";
import { authorizedJob, getPublicJobProjection } from "@/lib/jobs";
import { JobWorkspaceView } from "@/components/jobs/job-workspace-view";
import { Logo } from "@/components/branding/logo";
export const metadata = {title:"Transaction dispute"};
export default async function Page({params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  const result = await authorizedJob(id).catch(()=>null);
  if(!result) notFound();
  const record = await getPublicJobProjection(result.aggregate.job.publicId);
  if(!record) notFound();
  return <><header className="shell py-5"><Logo/></header><JobWorkspaceView {...result} record={record}/></>;
}
