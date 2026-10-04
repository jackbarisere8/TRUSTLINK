import type { JobSummaryRecord, SourceChannel, TrustEventRecord } from "../db/types";

export const repeatUseSignalKinds = ["repeat_use_prompted", "repeat_use_unprompted"] as const;
export type RepeatUseSignalKind = typeof repeatUseSignalKinds[number];

export interface RepeatUseSignal {
  kind: RepeatUseSignalKind;
  jobId: string;
  providerId: string;
  recordedAt: string;
  acceptedAt?: string;
}

export interface RepeatUseSummary {
  created: number;
  accepted: number;
  acceptedProviders: number;
}

export interface ValidationReport {
  transactionFunnel: {
    created: number;
    accepted: number;
    paymentRecorded: number;
    deliverySubmitted: number;
    completed: number;
  };
  repeatUse: Record<RepeatUseSignalKind, RepeatUseSummary>;
  sourceChannels: Array<{ channel: SourceChannel; transactions: number }>;
}

function eventTimes(events: readonly TrustEventRecord[], eventType: TrustEventRecord["eventType"]) {
  const times = new Map<string, string>();
  for (const event of events) {
    if (event.eventType !== eventType) continue;
    const current = times.get(event.jobId);
    if (!current || event.occurredAt < current) times.set(event.jobId, event.occurredAt);
  }
  return times;
}

/**
 * Repeat-use signals are projections of canonical transaction records. They
 * contain no client contact, page-view, device, location-history or free-text
 * data, and they are never written by a page render.
 */
export function repeatUseSignals(
  jobs: readonly JobSummaryRecord[],
  events: readonly TrustEventRecord[],
): RepeatUseSignal[] {
  const createdJobs = eventTimes(events, "JOB_CREATED");
  const acceptedJobs = eventTimes(events, "JOB_ACCEPTED");
  return jobs.flatMap(job => {
    if (!createdJobs.has(job.id) || job.repeatUse === "FIRST") return [];
    return [{
      kind: job.repeatUse === "PROMPTED" ? "repeat_use_prompted" : "repeat_use_unprompted",
      jobId: job.id,
      providerId: job.providerId,
      recordedAt: job.createdAt,
      acceptedAt: acceptedJobs.get(job.id),
    } satisfies RepeatUseSignal];
  }).sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.jobId.localeCompare(right.jobId));
}

export function buildValidationReport(
  jobs: readonly JobSummaryRecord[],
  events: readonly TrustEventRecord[],
): ValidationReport {
  const createdJobs = eventTimes(events, "JOB_CREATED");
  const recordedJobs = jobs.filter(job => createdJobs.has(job.id));
  const recordedJobIds = new Set(recordedJobs.map(job => job.id));
  const countTransactionsWith = (eventType: TrustEventRecord["eventType"]) => {
    const ids = new Set(events.filter(event => event.eventType === eventType && recordedJobIds.has(event.jobId)).map(event => event.jobId));
    return ids.size;
  };
  const signals = repeatUseSignals(recordedJobs, events);
  const summarize = (kind: RepeatUseSignalKind): RepeatUseSummary => {
    const matching = signals.filter(signal => signal.kind === kind);
    const accepted = matching.filter(signal => signal.acceptedAt);
    return {
      created: matching.length,
      accepted: accepted.length,
      acceptedProviders: new Set(accepted.map(signal => signal.providerId)).size,
    };
  };
  const channelCounts = new Map<SourceChannel, number>();
  for (const job of recordedJobs) channelCounts.set(job.sourceChannel, (channelCounts.get(job.sourceChannel) || 0) + 1);

  return {
    transactionFunnel: {
      created: recordedJobs.length,
      accepted: countTransactionsWith("JOB_ACCEPTED"),
      paymentRecorded: countTransactionsWith("PAYMENT_RECORDED"),
      deliverySubmitted: countTransactionsWith("DELIVERY_SUBMITTED"),
      completed: countTransactionsWith("JOB_COMPLETED"),
    },
    repeatUse: {
      repeat_use_prompted: summarize("repeat_use_prompted"),
      repeat_use_unprompted: summarize("repeat_use_unprompted"),
    },
    sourceChannels: [...channelCounts.entries()]
      .map(([channel, transactions]) => ({ channel, transactions }))
      .sort((left, right) => right.transactions - left.transactions || left.channel.localeCompare(right.channel)),
  };
}
