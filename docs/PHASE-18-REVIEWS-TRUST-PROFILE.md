# Phase 18: reviews and Trust Profile

Implemented for the request to continue with Phase 18 on September 26, 2026. This phase makes the existing client review the source of a public, evidence-based provider profile. It does not add provider reviews, manually editable reputation counters, payment verification, or a public earnings claim.

## Review authority and lifecycle

Only the transaction-scoped client participant can submit a review, and only after the transaction reaches `COMPLETED`. A transaction accepts at most one review. The server resolves the client capability, rereads the aggregate, enforces the reviewed version and operation UUID, and appends one `CLIENT_REVIEWED` event without changing the completed state.

The review command trims an optional comment and omits it when the submitted value is blank. Ratings remain integers from one through five. The event records the exact `reviewId` and rating so the ledger identifies the row it represents rather than acting as an unlinked lifecycle marker.

## Persistence integrity

`20260926000001_reviews_trust_profile.sql` is the fifteenth cumulative migration. Its preflight requires each historical review to belong to a completed job, follow completion, use the transaction client identity and name, and match exactly one `CLIENT_REVIEWED` event. The reverse check requires exactly one corresponding review for every review event. After that one-to-one proof, the migration backfills each legacy event with its review ID. Existing inconsistent data must be repaired before the migration is retried.

For new writes, the PostgreSQL commit wrapper locks the completed predecessor and permits exactly one new review plus one exact client event. Deferred constraints enforce the relationship in both directions after the atomic aggregate write. Review update, deletion, and table truncation are rejected after submission. The local repository applies the same one-row delta, identity, timing, and event-link rules, while upgrading valid legacy local events with their review IDs in memory.

The migration does not add a table, view, public column, or new public RPC signature. Generated database types therefore retain the existing public contract, while the migration is included in both the type generator and PostgreSQL fixture sequences.

## Public Trust Profile

`/p/[username]` derives its metrics at read time from that provider's actual completed transaction aggregates:

- completed transaction count;
- average client rating and review count;
- on-time delivery rate, based on the final submitted delivery and the agreed deadline;
- repeat-client activity;
- unique services from completed records; and
- up to six recent completed records with any submitted rating and comment.

There are no stored reputation counters. A provider with no completed evidence sees dashes for completed transactions, average rating, on-time delivery, and repeat-client activity. The page never invents a perfect rating, perfect delivery rate, transaction volume, or earnings total.

Repeat-client activity groups authenticated clients by account ID. For guest clients, it falls back to the normalized self-provided email captured in the private transaction record. If completed records lack usable identity coverage, the public metric is a dash. The page says that this grouping does not verify identity.

The profile excludes agreed prices, recorded-payment totals, and `verifiedRevenue`. TrustLink records a provider's declaration of direct payment receipt but does not independently verify settlement, so a public revenue or transaction-value aggregate would overstate the evidence. The `/p/amaka` route remains an explicitly labeled illustrative example rather than a persisted provider result.

## Verification status

Source coverage now exercises trimmed comments, exact review/event IDs, forged-review rejection, review immutability, completed-service derivation, average rating, on-time delivery, and repeat-client grouping. The migration is included in the cumulative database test path.

This continuation was checked statically because Node, PGlite, typecheck, build, and browser execution are unavailable under the current command restrictions. No hosted Supabase project was configured or changed. Apply the migration first in staging, inspect any preflight failure, validate historical `NOT VALID` constraints deliberately, and run the full repository verification suite before deployment.
