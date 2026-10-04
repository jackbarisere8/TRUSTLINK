# Phase 20: transactional notification intents

Implemented for the request to continue with Phase 20 on September 27, 2026. This phase replaces the notification stub with the minimum reliable architecture tied to real transaction events. It does not add an external sender, social feed, notification bell, read counters, preferences or background worker.

## Event contract

`lib/notifications/index.ts` is the application mapping from immutable trust events to notification intents:

| Trust event | Notification kind | Recipient role |
|---|---|---|
| `JOB_ACCEPTED` | `TRANSACTION_ACCEPTED` | Provider |
| `PAYMENT_RECORDED` | `PAYMENT_RECORDED` | Client participant |
| `DELIVERY_SUBMITTED` | `DELIVERY_SUBMITTED` | Client participant |
| `REVISION_REQUESTED` | `REVISION_REQUESTED` | Provider |
| `DISPUTE_OPENED` | `DISPUTE_RAISED` | Other participant and administrator |
| `JOB_COMPLETED` | `TRANSACTION_COMPLETED` | Client participant |

Every other trust event produces no notification intent. Copy is deterministic and contains no participant-supplied narrative or evidence. Payment copy continues to say that TrustLink has not verified the direct transfer.

## Atomic persistence

`20260927000000_transaction_notifications.sql` creates `notification_intents`. Each row contains only its job, exact trust event, notification kind, recipient role and creation time. PostgreSQL validates that the source event exists and that its kind and audience match the table above. An `AFTER INSERT` trust-event trigger creates the intent inside the same transaction as the state change. If intent creation fails, the transaction event and domain mutation roll back together.

The unique `(event_id, recipient_role)` constraint prevents duplicate intents. Existing supported events are backfilled by the migration. Intent rows are immutable, RLS is enabled and forced, browser roles have no grants or policies, and `service_role` receives read access only. Notification intents do not enter either anonymous public projection.

The local repository creates the same intents while holding its exclusive writer lock. Its root schema requires the complete exact projection from supported events and upgrades older local files that do not yet contain the intent collection. A failed validation leaves the previous file unchanged.

## Delivery boundary

An intent means that a real transaction event should be communicated to a recipient role. It does not mean an email, SMS, push message or in-product alert was sent. The repository rules currently prohibit adding another provider credential, and Phase 20 does not select a delivery channel. Consequently this phase adds no environment variable, recipient address snapshot, provider message ID, attempt counter or sent/delivered status.

A future channel must resolve the intended participant through an authorized server process, use the immutable event as its idempotency source, and record delivery semantics separately only when a concrete provider and operational retry policy are approved.

## Verification boundary

Focused source coverage checks all six mappings, both dispute directions, exclusion of unrelated events, truthful payment wording, local legacy backfill, local lifecycle intent creation, PostgreSQL historical backfill, trigger creation, uniqueness, immutability and the thirteen-table RLS/privilege matrix.

The migration sequence is now sixteen files. Static checks are recorded in this continuation because Node, PGlite, schema generation, typecheck, build and browser execution are unavailable under the current command restrictions. No hosted Supabase project was configured or changed.
