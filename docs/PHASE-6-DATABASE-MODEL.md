# Phase 6: canonical database model

Implemented for the user's request to continue with Phase 6, September 21, 2026. This phase normalizes transaction participants, strengthens physical types and constraints, removes redundant stored values, and makes schema-derived TypeScript part of the validation path. It does not add Phase 7 browser/database authorization policies or Phase 8 ledger features beyond preserving the existing default-deny and append-only protections.

## Canonical relational model

The cumulative PostgreSQL schema now contains:

| Table | Purpose |
|---|---|
| `profiles` | Application identity presentation and national location fields linked to Auth |
| `provider_profiles` | Provider-specific headline, biography, service area and profile status |
| `jobs` | Transaction identity, provider ownership, lifecycle/version, origin and timestamps |
| `job_participants` | Provider/client role, optional client account link, guest details, provenance and capability |
| `job_terms` | Agreed scope, deliverables, numeric fee, currency, date deadline and revision terms |
| `payments` | One non-custodial recorded-payment report per job |
| `deliveries`, `revisions` | Work submissions and numbered revision requests |
| `disputes` | Claims, evidence references and explicit resolution state |
| `reviews` | One client review per job |
| `evidence_files` | Private Storage object metadata and job/uploader ownership |
| `trust_events` | Canonical append-only transaction history |

`auth.users` remains owned by Supabase Auth and is not duplicated in `public`.

The schema deliberately does not create `job_events` or `payment_events`; both would duplicate `trust_events`. It does not create `dispute_evidence`; `evidence_files` plus the dispute's immutable attachment references already represent that data. There are no empty notifications, analytics, broad audit-log, skills or payment-provider-account tables because no implemented workflow writes or reads them. This follows the brief's instruction to avoid tables that only sound enterprise-like.

## Participant normalization

`job_participants` has exactly one `PROVIDER` and one `CLIENT_PARTICIPANT` row per job. The composite unique constraint prevents duplicate roles, and deferred constraint triggers require the committed transaction state to contain both roles with a provider user matching `jobs.provider_id`. This lets the commit RPC insert the job and participants in one atomic operation while rejecting privileged direct writes that leave an incomplete relationship. Provider rows require an account-linked user, a display-name snapshot and `SELF_PROVIDED` provenance; they cannot hold guest capability fields. Client rows may have a nullable account `user_id`. Before acceptance they contain the scoped capability, no contact details and `UNKNOWN` provenance. After acceptance they require a name and email and persist the supported detail status.

The table constrains role, provenance vocabulary, token-hash format, required token expiry, contact lengths and provider/client row shape. Foreign keys use cascade deletion from the transaction and restricted deletion for linked participant profiles. Anonymous and authenticated roles receive no direct access; the table has RLS enabled and service-only privileges, consistent with the existing pre-Phase-7 boundary.

The migration backfills both participant roles from historical jobs and acceptance events. It recognizes the current `participant_detail_status` metadata key and the historical `identity_status` key. It refuses to continue if a historical job lacks its required Auth-linked provider profile. After backfill, the old client ID, contact and capability columns are removed from `jobs`.

`tl_read_job` reconstructs those virtual job fields from `job_participants`, so the domain aggregate and existing lifecycle remain stable. `tl_commit_job` atomically persists the job, child records, event and participant changes. A failed participant constraint or trust-event insert rolls back the whole transaction.

## Physical data types and integrity

- `job_terms.price` is `numeric(14,2)` with a positive-value check; `currency` is constrained to `NGN`.
- `job_terms.deadline` is a PostgreSQL `date`.
- JSON deliverable/file/evidence fields must contain arrays.
- Revision numbers are unique within a job.
- Public IDs cannot be blank and view counts cannot be negative.
- `JOB_ACCEPTED` events written after the migration must carry a supported participant-detail status. The constraint is `NOT VALID` so historical rows can be inspected without silently rewriting immutable events.
- Participant, evidence and dispute lookup indexes cover the actual authorization/aggregate-read paths. Indexes already supplied by unique constraints were not duplicated.
- `jobs.version` remains the single optimistic-concurrency version for the aggregate. Mutable profiles, jobs, terms, participants and disputes have update timestamps; immutable evidence/event rows keep creation or occurrence timestamps.

The Phase 6 migration removes the unused manual `completed_jobs_count`, `average_rating` and `on_time_rate` provider-profile columns. Reputation continues to derive from completed jobs, deliveries and reviews, leaving one source of truth.

## Schema-generated TypeScript

`scripts/generate-database-types.mts` creates an isolated PGlite database, applies the full migration sequence, introspects tables, views, functions, columns, nullability, defaults and relationships, then writes `lib/db/database.generated.ts`.

```powershell
npm run db:types
npm run db:types:check
```

`npm run typecheck` executes the drift check before `tsc`. The server Supabase client is parameterized with the generated `Database` type, so table names, evidence inserts, participant list queries and RPC argument shapes are checked against the migrations. Domain records are intentionally separate: `tl_read_job` joins several tables into a camel-cased transaction aggregate, so treating a physical `jobs` row as the domain type would itself create drift.

The list repository now returns a minimal `JobSummaryRecord`. Its Supabase query loads jobs, terms and only the client participant's display name; capability hashes and private contact details are not loaded for dashboard lists. Numeric fees are converted to the domain's stable string representation at this projection boundary.

## Migration and deployment boundary

Apply `20260921000000_database_model.sql` after the previous three migrations. It preflights historical fee/deadline values and provider links before removing legacy columns. Back up a target database, inspect any preflight failure, and repair the exact historical rows before retrying. Do not bypass the checks or manually mark the migration applied.

No hosted Supabase database exists in this workspace, so no remote migration or generated remote type comparison was performed. Existing `NOT VALID` historical constraints still require target-project review and explicit validation. The local JSON adapter remains an aggregate development store; this phase defines the canonical PostgreSQL model without pretending JSON storage is relational.

## Verification

| Check | Result |
|---|---|
| `npm run db:types:check` | Passed against all four cumulative migrations |
| `npm run typecheck` | Passed with the generated Supabase contract |
| `npm run lint` | Passed without errors or warnings |
| `npm test` | 31 passed, including historical participant backfill and fresh relational constraints |
| `npm run build` | Passed; all routes compiled |
| `npm run test:browser` | 6 passed |
| `npm run test:workflow` | 2 passed; full lifecycle, private participant projection and participant-backed dashboard list through the Supabase adapter |

The browser suites were run sequentially. Their Supabase fixture is gated test infrastructure backed by PGlite; it does not establish hosted RLS, Auth, Storage or migration behavior.
