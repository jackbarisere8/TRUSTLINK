import type { JobTermsRecord } from "../../db/types";

/**
 * The agreement fields a client sees and accepts. Mutable operational values
 * such as revisionsUsed deliberately do not become part of this snapshot.
 */
export type AcceptedTermsSnapshot = Pick<JobTermsRecord,
  "service" | "serviceCategory" | "scope" | "deliverables" | "price" |
  "currency" | "deadline" | "revisionsIncluded" | "cancellationTerms"
>;

function normalizedPrice(price: string) {
  return Number(price).toFixed(2);
}

export function acceptedTermsSnapshot(terms: AcceptedTermsSnapshot): AcceptedTermsSnapshot {
  return {
    service: terms.service,
    serviceCategory: terms.serviceCategory,
    scope: terms.scope,
    deliverables: [...terms.deliverables],
    price: normalizedPrice(terms.price),
    currency: terms.currency,
    deadline: terms.deadline,
    revisionsIncluded: terms.revisionsIncluded,
    cancellationTerms: terms.cancellationTerms,
  };
}

/** Accept only a complete, exact snapshot of the immutable agreement fields. */
export function matchesAcceptedTermsSnapshot(terms: AcceptedTermsSnapshot, value: unknown): value is AcceptedTermsSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const expected = acceptedTermsSnapshot(terms);
  return Object.keys(candidate).length === Object.keys(expected).length &&
    candidate.service === expected.service &&
    candidate.serviceCategory === expected.serviceCategory &&
    candidate.scope === expected.scope &&
    candidate.price === expected.price &&
    candidate.currency === expected.currency &&
    candidate.deadline === expected.deadline &&
    candidate.revisionsIncluded === expected.revisionsIncluded &&
    candidate.cancellationTerms === expected.cancellationTerms &&
    Array.isArray(candidate.deliverables) &&
    candidate.deliverables.length === expected.deliverables.length &&
    candidate.deliverables.every((item, index) => item === expected.deliverables[index]);
}
