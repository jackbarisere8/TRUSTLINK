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
  return <><header className="border-b border-[#dbe2e3] bg-white"><div className="shell py-4"><Logo/></div></header><JobWorkspaceView {...result} record={record} mode="dispute"/></>;
}
