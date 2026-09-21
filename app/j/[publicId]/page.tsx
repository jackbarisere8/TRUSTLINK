import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicJobProjection, identifyActor } from "@/lib/jobs";
import { db } from "@/lib/db";
import { publicEvents } from "@/lib/domain/jobs";
import { PublicJobView } from "@/components/jobs/public-job-view";
import { ClientLink } from "@/components/jobs/client-link";
import { Timeline } from "@/components/jobs/timeline";
import { JobActions } from "@/components/jobs/job-actions";
import { ParticipantEvidenceView } from "@/components/jobs/participant-evidence";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{publicId:string}> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  const record = await getPublicJobProjection(publicId);
  return { title: record ? record.service + " — TrustLink agreement" : "Record not found", robots: {index:false,follow:false}, referrer:"no-referrer",
    description: "Review the agreed scope, fee, deadline and revisions.", openGraph: { title: "A TrustLink service agreement", description: "Open the record to review the terms.", url: "/j/" + publicId } };
}
export default async function Page({ params }: Props) {
  const { publicId } = await params;
  const record = await getPublicJobProjection(publicId);
  if (!record) notFound();
  const example = publicId === "sample-website-project";
  if (example) return <PublicJobView record={record} example><Timeline events={[{id:"example-created",eventType:"JOB_CREATED",occurredAt:record.createdAt},{id:"example-shared",eventType:"JOB_SENT",occurredAt:record.createdAt}]}/></PublicJobView>;
  const aggregate = await db.getAggregate(publicId,true);
  if (!aggregate) notFound();
  const actor = await identifyActor(aggregate).catch(()=>null);
  return <PublicJobView record={record}>
    <ClientLink publicId={publicId}/>
    <Timeline events={publicEvents(aggregate.events)}/>
    {actor ? <><ParticipantEvidenceView data={{deliveries:aggregate.deliveries,revisions:aggregate.revisions,disputes:aggregate.disputes,reviews:aggregate.reviews}} jobId={aggregate.job.id}/><JobActions version={aggregate.job.version} jobId={aggregate.job.id} publicId={publicId} status={record.status} actor={actor.type} hasReview={!!aggregate.reviews.length}/></> : <p className="notice mt-8">You are viewing the public agreement. To accept or manage this transaction, open the private participant link shared by the provider.</p>}
  </PublicJobView>;
}
