# Phase 21: analytics for validation

Implemented for the request to continue with Phase 21 on September 27, 2026. This phase turns the already-required repeat-use classification and immutable transaction ledger into a small administrator-only validation report. It adds no third-party analytics SDK, generic event-ingestion endpoint, tracking cookie, device fingerprint, page-view writer or client-content export.

## Signal contract

The provider classifies each transaction at creation as `FIRST`, `PROMPTED` or `UNPROMPTED`. Returning providers see the prompted/unprompted question in the creation form, and `TransactionService` independently verifies provider history on the server. The job and its `JOB_CREATED` event record the same classification in the atomic creation commit.

`lib/analytics/validation.ts` projects the two validation signal names required by the product plan:

| Signal | Recorded evidence | Customer-backed evidence |
|---|---|---|
| `repeat_use_prompted` | A canonical repeat job classified `PROMPTED` | The same job has `JOB_ACCEPTED` |
| `repeat_use_unprompted` | A canonical repeat job classified `UNPROMPTED` | The same job has `JOB_ACCEPTED` |

The most valuable count is accepted unprompted repeat transactions, accompanied by the number of distinct providers behind them. Client acceptance establishes that the repeat record reached a real transaction participant; it does not verify that participant's identity or prove payment.

The report also counts unique transactions reaching creation, client acceptance, recorded payment, delivery and completion, plus the recorded agreement source channel. Multiple deliveries in one transaction count once in the funnel. `JOB_VIEWED` remains reserved and is ignored: loading a page never becomes product-success evidence.

## Integrity and persistence

The seventeenth migration, `20260927000001_validation_analytics.sql`, protects the source classification instead of creating a duplicate analytics-event table. It requires the earliest historical transaction to be the provider's only `FIRST` record, rejects a first transaction classified as repeat use, rejects later transactions classified as first use, and makes the classification immutable. The partial unique index closes simultaneous double-first creation; the server remains responsible for presenting and validating the prompted/unprompted choice.

The local repository applies the same rule while holding its exclusive writer lock, and the root local schema rejects histories whose first record is not `FIRST` or whose later records reuse `FIRST`. Historical data with ambiguous repeat classification must be reviewed; the migration does not infer prompted or unprompted use after the fact.

No new application table is required. `jobs.repeat_use`, `jobs.source_channel` and `trust_events` remain the canonical persisted evidence, keeping the schema at thirteen public application tables.

## Administrator report and privacy

`/admin/validation` is rendered by a server component inside the existing administrator layout. It requires trusted administrator metadata before reading the elevated repository, then exposes only aggregate counts. The page does not render provider identities, client contacts, agreement narratives, payment references, attachment data, dispute text or event metadata.

The report is intended for product validation rather than individual monitoring. It does not claim that a dashboard open, public-link view, recorded transfer or self-provided identity is externally verified behavior.

## Verification boundary

Focused source coverage checks exact prompted/unprompted signal names, acceptance-backed classification, distinct-provider counts, unique-transaction funnel counts, source-channel aggregation, orphan exclusion, page-view exclusion, local first/repeat enforcement, PostgreSQL preflight/uniqueness/immutability and migration ordering.

The migration sequence is now seventeen files. Static checks are recorded in this continuation because Node, PGlite, schema generation, typecheck, build and browser execution remain unavailable under the current command restrictions. No hosted Supabase project was configured or changed.
