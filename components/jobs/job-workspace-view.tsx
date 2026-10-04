import Link from "next/link";
import { TransactionRecord } from "./transaction-record";
import { Timeline } from "./timeline";
import { JobActions } from "./job-actions";
import { ParticipantEvidenceView } from "./participant-evidence";
import { TransactionParticipants } from "./transaction-participants";
import type { JobAggregate } from "@/lib/db/repository";
import type { PublicJobProjection } from "@/lib/db/types";
import type { Actor } from "@/lib/domain/jobs";
import { hasActiveStoredClientCapability, publicEvents, transactionParticipants } from "@/lib/domain/jobs";
export function JobWorkspaceView({ aggregate, record, actor, mode = "workspace" }: { aggregate: JobAggregate; record: PublicJobProjection; actor: Actor; mode?: "workspace" | "dispute" }) {
  const participants = transactionParticipants(aggregate, { displayName: record.provider.displayName, detailStatus: "SELF_PROVIDED" });
  const activeDispute = aggregate.disputes.find(dispute => dispute.disputeStatus === "OPEN" || dispute.disputeStatus === "UNDER_REVIEW");
  const focusDispute = activeDispute ?? aggregate.disputes.at(-1);
  const canRespondToDispute = activeDispute?.disputeStatus === "OPEN" &&
    ((activeDispute.raisedBy === "PROVIDER" && actor.type === "CLIENT_PARTICIPANT") ||
     (activeDispute.raisedBy === "CLIENT" && actor.type === "PROVIDER"));
  const actions = <JobActions version={aggregate.job.version} jobId={aggregate.job.id} publicId={record.publicId} status={record.status} actor={actor.type} paymentAmount={aggregate.terms.price} paymentCurrency={aggregate.terms.currency} revisionsUsed={aggregate.terms.revisionsUsed} revisionsIncluded={aggregate.terms.revisionsIncluded} hasReview={!!aggregate.reviews.length} hasActiveClientCapability={hasActiveStoredClientCapability(aggregate.job)} canRespondToDispute={canRespondToDispute}/>;
  const evidence = <ParticipantEvidenceView data={{payments:aggregate.payments,deliveries:aggregate.deliveries,revisions:aggregate.revisions,disputes:aggregate.disputes,reviews:aggregate.reviews}} jobId={aggregate.job.id} disputeFirst={mode === "dispute"}/>;
  return <main id="main-content" className="shell max-w-4xl pb-16 pt-8 sm:pt-12"><div className="mb-6 flex flex-wrap justify-between gap-4 text-sm"><Link className="quiet-link" href="/dashboard/jobs">← Transactions</Link><Link className="quiet-link" href={"/j/"+record.publicId}>Open public agreement</Link></div>
    {mode === "dispute" && <header className="mb-8 border-b border-[#dbe2e3] pb-7"><p className="eyebrow">Dispute / transaction record</p><h1 className="interface-heading mt-3 text-[2.4rem] sm:text-[3rem]">Review the agreement and evidence.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-surface-700">The agreed terms remain alongside the claim, responses and submitted evidence. Review what was recorded before taking an action.</p>{focusDispute && <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm"><p><span className="text-surface-600">Contested term:</span> <span className="font-semibold">{focusDispute.contestedTerm}</span></p><p><span className="text-surface-600">Dispute status:</span> <span className="font-semibold capitalize">{focusDispute.disputeStatus.replaceAll("_", " ").toLowerCase()}</span></p><a href="#dispute-evidence" className="quiet-link font-semibold">Review dispute evidence ↓</a></div>}</header>}
    <TransactionRecord record={record} headingLevel={mode === "dispute" ? 2 : 1}>
      <TransactionParticipants participants={participants}/>
      {mode === "dispute" ? <>{evidence}{actions}</> : <>{actions}{evidence}</>}
      <Timeline events={publicEvents(aggregate.events)}/>
    </TransactionRecord></main>;
}
