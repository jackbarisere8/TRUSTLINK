import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicTransaction, getPublicTransactionAccess } from "@/lib/jobs";
import { hasActiveStoredClientCapability, transactionParticipants } from "@/lib/domain/jobs";
import type { PublicJobProjection } from "@/lib/db/types";
import { PublicJobView } from "@/components/jobs/public-job-view";
import { ClientLink } from "@/components/jobs/client-link";
import { Timeline } from "@/components/jobs/timeline";
import { JobActions } from "@/components/jobs/job-actions";
import { ParticipantEvidenceView } from "@/components/jobs/participant-evidence";
import { TransactionParticipants } from "@/components/jobs/transaction-participants";
import { PublicParticipants } from "@/components/jobs/public-participants";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ publicId: string }> };

function metadataText(value: string, maximum: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maximum).trim();
}

function transactionMetadata(record: PublicJobProjection): Metadata {
  const service = metadataText(record.service, 90) || "Service";
  const provider = metadataText(record.provider.displayName, 70) || "provider";
  const title = `${service} \u2014 ${provider}`;
  const description = `${service} agreement with ${provider}. Current status: ${record.status.replaceAll("_", " ").toLowerCase()}.`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
    openGraph: { type: "website", title, description, url: "/j/" + record.publicId },
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  const transaction = await getPublicTransaction(publicId);
  return transaction ? transactionMetadata(transaction.record) : {
    title: "Transaction Record Not Found",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function Page({ params }: Props) {
  const { publicId } = await params;
  const transaction = await getPublicTransaction(publicId);
  if (!transaction) notFound();
  const { record, events } = transaction;
  const access = await getPublicTransactionAccess(record.publicId, record.provider.username);
  const activeDispute = access?.aggregate.disputes.find(dispute => dispute.disputeStatus === "OPEN" || dispute.disputeStatus === "UNDER_REVIEW");
  const canRespondToDispute = Boolean(access && activeDispute?.disputeStatus === "OPEN" &&
    ((activeDispute.raisedBy === "PROVIDER" && access.actor.type === "CLIENT_PARTICIPANT") ||
     (activeDispute.raisedBy === "CLIENT" && access.actor.type === "PROVIDER")));
  return <PublicJobView record={record}>
    <ClientLink publicId={record.publicId}/>
    {access
      ? <TransactionParticipants participants={transactionParticipants(access.aggregate, { displayName: record.provider.displayName, detailStatus: "SELF_PROVIDED" })}/>
      : <PublicParticipants providerName={record.provider.displayName} accepted={events.some(event => event.eventType === "JOB_ACCEPTED")}/>}
    <Timeline events={events}/>
    {access ? <>
      <ParticipantEvidenceView data={{ payments: access.aggregate.payments, deliveries: access.aggregate.deliveries, revisions: access.aggregate.revisions, disputes: access.aggregate.disputes, reviews: access.aggregate.reviews }} jobId={access.aggregate.job.id}/>
      <JobActions version={access.aggregate.job.version} jobId={access.aggregate.job.id} publicId={record.publicId} status={record.status} actor={access.actor.type} paymentAmount={access.aggregate.terms.price} paymentCurrency={access.aggregate.terms.currency} revisionsUsed={access.aggregate.terms.revisionsUsed} revisionsIncluded={access.aggregate.terms.revisionsIncluded} hasReview={!!access.aggregate.reviews.length} hasActiveClientCapability={hasActiveStoredClientCapability(access.aggregate.job)} canRespondToDispute={canRespondToDispute}/>
    </> : <section className="record-section" aria-labelledby="public-next-step-heading"><h2 id="public-next-step-heading">Next step</h2><p className="mt-4 text-sm leading-7 text-surface-600">You are viewing the public agreement. To accept or manage this transaction, open the private participant link shared by the provider.</p></section>}
  </PublicJobView>;
}
