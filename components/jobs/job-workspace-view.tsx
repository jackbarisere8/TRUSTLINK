import Link from "next/link";
import { TransactionRecord } from "./transaction-record";
import { Timeline } from "./timeline";
import { JobActions } from "./job-actions";
import { ParticipantEvidenceView } from "./participant-evidence";
import type { JobAggregate } from "@/lib/db/repository";
import type { PublicJobProjection } from "@/lib/db/types";
import type { Actor } from "@/lib/domain/jobs";
import { publicEvents } from "@/lib/domain/jobs";
export function JobWorkspaceView({ aggregate, record, actor }: { aggregate: JobAggregate; record: PublicJobProjection; actor: Actor }) {
  return <main id="main-content" className="shell max-w-4xl py-8"><div className="flex flex-wrap justify-between gap-4 mb-6 text-sm"><Link href="/dashboard/jobs">← Transactions</Link><Link className="underline" href={"/j/"+record.publicId}>Open public agreement</Link></div>
    <TransactionRecord record={record}>
      <JobActions version={aggregate.job.version} jobId={aggregate.job.id} publicId={record.publicId} status={record.status} actor={actor.type} hasReview={!!aggregate.reviews.length}/>
      <ParticipantEvidenceView data={{deliveries:aggregate.deliveries,revisions:aggregate.revisions,disputes:aggregate.disputes,reviews:aggregate.reviews}} jobId={aggregate.job.id}/>
      <Timeline events={publicEvents(aggregate.events)}/>
    </TransactionRecord></main>;
}
