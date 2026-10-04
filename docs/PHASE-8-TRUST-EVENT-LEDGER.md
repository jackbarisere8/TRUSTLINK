# Phase 8: trust-event ledger

Implemented for the request to continue with Phase 8 on September 21, 2026. This phase strengthens the existing `trust_events` store as the single transaction history. It does not add duplicate job/payment event tables, turn the history into a blockchain, or begin Phase 9 payment work.

## Canonical event contract

`lib/trust-events/index.ts` now owns the complete event vocabulary, display labels and allowed actor types. The transaction policy refers to that typed vocabulary, database/local validation use the same TypeScript declaration in tests, and UI labels cannot silently drift to arbitrary strings.

The implemented vocabulary is:

| Event | Actor |
|---|---|
| `JOB_CREATED`, `JOB_SENT` | Provider |
| `JOB_VIEWED` | System, reserved; no writer exists and a page GET does not emit it |
| `JOB_ACCEPTED` | Client participant |
| `PAYMENT_RECORDED`, `WORK_STARTED`, `DELIVERY_SUBMITTED` | Provider |
| `REVISION_REQUESTED`, `DELIVERY_APPROVED` | Client participant |
| `DISPUTE_OPENED` | Provider or client participant |
| `DISPUTE_RESPONDED` | The transaction party that did not raise the active dispute |
| `DISPUTE_RESOLVED` | Administrator |
| `JOB_COMPLETED`, `JOB_CANCELLED`, `CLIENT_LINK_REISSUED` | Provider |
| `CLIENT_REVIEWED` | Client participant after completion; metadata identifies the exact immutable review and rating |

`DISPUTE_OPENED` and `CLIENT_REVIEWED` remain the established canonical names for the brief's illustrative `DISPUTE_RAISED` and `REVIEW_SUBMITTED` events. Renaming persisted history would add migration risk without changing meaning.

Every event contains `id`, `jobId`, `eventType`, `eventSequence`, `actorType`, `actorId`, `occurredAt`, `metadata` and `createdAt`. `eventSequence` is a one-based, gap-free order within the job. It removes the former ambiguity when consecutive events shared the same millisecond and were secondarily sorted by random UUID.

## PostgreSQL enforcement

`supabase/migrations/20260921000002_trust_event_ledger.sql`:

- backfills sequence numbers for historical rows using occurrence/creation time, the known creation pair and operation version metadata;
- requires positive unique `(job_id,event_sequence)` values;
- requires object metadata, a nonblank actor and creation time at or after occurrence time;
- constrains every event type to its allowed actor type;
- validates provider ownership, job-scoped client identity, administrator UUIDs and the reserved system identity on insert;
- requires `JOB_CREATED` then `JOB_SENT` as the first two events and prevents those events from recurring;
- requires mutation events to carry a valid request UUID, SHA-256 command hash and expected transaction version;
- rejects backwards event time, sequence gaps and event/state mismatches;
- preserves the existing update/delete/truncate rejection triggers and service-role mutation revocations.

The former commit implementation now lives in a non-exposed `private` schema. The public `tl_commit_job` wrapper verifies that an update carries the exact persisted event prefix plus exactly one new event. Creation must carry exactly `JOB_CREATED` and `JOB_SENT`. It then calls the existing atomic persistence implementation. Altered, omitted, reordered or extra history fails before persistence. A trigger failure during insertion aborts the same PostgreSQL transaction, so job state, child records, participants and events roll back together.

`tl_read_job` orders events exclusively by `event_sequence`. The server service role can execute only the public wrapper; browser roles and the service role cannot call the private storage function.

## Application and local-store parity

The domain appender assigns the next sequence, enforces the actor/event contract, and uses the transition timestamp for the child record, job update and event. Public history sorts by sequence and emits only `id`, `eventType` and `occurredAt`; actor identifiers, request hashes and private metadata remain absent.

The durable local adapter applies the same vocabulary, actor, sequence, chronology and operation-metadata validation before writing. It still compares the entire stored event prefix and rejects historical edits. Existing local v3 JSON records without `eventSequence` are upgraded deterministically in memory on read and receive the canonical sequence when next persisted; malformed explicit sequences still fail validation.

## Security and evidence limits

This is an application audit ledger, not cryptographic proof against a database owner. A PostgreSQL owner can disable triggers or edit storage outside the application. Operational database access, backups and change control remain deployment responsibilities.

The ledger proves what TrustLink recorded through its authorized workflow. It does not independently verify participant identity, bank transfers, delivery quality, or that a public link request represented conscious human review. Payment remains a provider-reported `PAYMENT_RECORDED` event with `NOT_VERIFIED` semantics.

No hosted Supabase project exists in this workspace. The migration and rollback behavior are validated with PostgreSQL/PGlite locally; historical constraints, PostgREST execution and operational access controls still require staging verification.

## Verification

Verified locally on September 21, 2026:

| Check | Result | Ledger coverage |
|---|---|---|
| `npm run typecheck` | Passed | Six-migration generated-type drift check and strict TypeScript |
| `npm run lint` | Passed | Application, migration support and test sources |
| `npm test` | 32 passed | Historical backfill, exact-prefix checks, atomic rollback, actor/state/operation validation, private-function denial, sequence/chronology validation and local-store parity |
| `npm run build` | Passed | Production Next.js 16.3.5 compilation and route generation |
| `npm run test:browser` | 6 passed | Public routes, responsive surfaces and client-side behavior |
| `npm run test:workflow` | 2 passed | Production Next.js, Supabase adapter and real PostgreSQL/PGlite provider/client/admin lifecycle plus session boundaries |

The workflow gate exposed a valid UTC representation boundary: PostgreSQL returned `+00:00` while new application timestamps used `Z`. Both represent the same timezone but cannot be ordered lexically. Domain and local validation now compare parsed instants, and the database test performs a persisted read, domain transition and write round trip to prevent regression.
