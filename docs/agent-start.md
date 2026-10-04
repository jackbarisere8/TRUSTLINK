# TrustLink agent and source handoff guide

## Instruction order and current scope

Read `AGENTS.md` for the installed Next.js requirements, `AGENT.md` for product/security boundaries, then `PRD.md` and `ARCHITECTURE.md`. `CLAUDE.md` references both instruction files. Use the exact filename casing when working on Linux. The current user request takes precedence over historical plans.

Current implementation evidence is recorded in the numbered phase reports through `docs/PHASE-24-PREMIUM-UI.md` and in `docs/FINAL-INTEGRITY-AUDIT.md`. `docs/PHASE-22-HOSTED-SUPABASE.md` remains an activation runbook and pending-evidence record; it is not proof of a hosted deployment. The earlier reality audit and build roadmap are historical context, not proof that a feature is implemented or authorization to expand it.

The user subsequently authorized source work through Phase 24: the local backend foundation, domain separation, canonical lifecycle hardening, authentication architecture, user/profile/participant model, canonical relational database model, database security/RLS boundary, trust-event ledger, truthful recorded-payment semantics, real atomic job creation, persisted public transaction rendering, secure client capability revocation, persistent client acceptance, provider payment recording, work/delivery/revision integrity, private evidence storage, structured disputes, post-completion client reviews with a derived Trust Profile, idempotent optimistic transaction mutations, event-derived transactional notification intents, aggregate validation analytics, complete local error elimination, and the premium UI pass using `app/icon.png`. Check each phase report for its verification status before treating it as complete. Later phases remain a roadmap. Keep Explore, Pathfinder, Learn and Opportunities frozen until separately authorized.

Phase 22 was requested, but its hosted activation prerequisites remain absent from this workspace: no project configuration values, Supabase CLI or linked project exist. The repository includes a read-only hosted preflight and exact activation/evidence checklist. Phase 23 was later authorized and completed as a local source/build/fixture audit without claiming hosted evidence. Do not mark Phase 22 complete, apply migrations remotely or seed hosted data until the founder creates a staging project, configures secrets outside source control and the hosted evidence matrix passes.

## Actual environment

No hosted Supabase project has been created. There are no hosted credentials configured in this workspace. `.env.example` contains variable names and blank credential fields; do not invent configuration or create `.env.local` with fake secrets.

`TRUSTLINK_STORAGE=local` explicitly selects durable development JSON storage. Missing or unknown storage modes are errors; there is no implicit fallback. It does not enable a fake login. Auth and private file upload remain unavailable without the intended Supabase configuration. Production refuses local storage and incomplete Supabase configuration. `TRUSTLINK_AUTH` is not currently implemented; do not imply otherwise by adding it to the template.

`tests/support/supabase-fixture.mts` is an automated-test HTTP fixture backed by PGlite. Its identities and nonfunctional keys are DEV ONLY. It refuses to start without `TRUSTLINK_TEST_FIXTURE=1` in a non-production process; only the workflow test configuration supplies that flag. It is never application infrastructure. Local testing does not establish hosted Auth, RLS or Storage behavior.

## Canonical source and clean exports

Canonical code lives in `app/`, `components/`, `lib/`, `supabase/` and `tests/`. Keep the intended logo assets in `public/` and application icons. There is no duplicate unpacked source tree.

Historical ZIPs under `docs/source-archives/` and `data/trustlink-dev.json` are retained as historical inputs, ignored and excluded from exports. They are not used by runtime adapters. Generated build/test output and screenshots are useful locally but do not belong in source handoffs. `lib/db/database.generated.ts` is a source-controlled schema contract and must remain in exports.

From the repository root in PowerShell:

```powershell
./scripts/Export-Source.ps1
```

The script creates a fresh ZIP under ignored `artifacts/`, preserving directory structure and including `package-lock.json`, the blank `.env.example`, tests, migrations and logo assets. It excludes dependencies, builds, traces, local data, old ZIPs and credential files. It refuses symlinks/junctions. It never deletes existing source or generated output.

`npm pack` is not the source-export mechanism: this private application has no package version and npm package rules would also omit its lockfile. The export script avoids changing package identity just to share source.

On a fresh source handoff, run `npm ci`. Start the local server from PowerShell with explicit development storage:

```powershell
$env:TRUSTLINK_STORAGE = 'local'
npm run dev
```

This starts the public application with local persistence; provider login is still unconfigured. `npm run build` checks compilation without connecting a hosted backend. `next-env.d.ts` is generated rather than exported with machine-specific build references.

## Domain and persistence boundaries

Server Actions resolve sessions/capabilities and validate private evidence references. Transaction mutations call `TransactionService` in `lib/domain/transactions/index.ts`, which accepts the `Repository` interface. Profile edits use `lib/domain/profiles/index.ts`. The local and Supabase adapters implement the same interface independently.

Lifecycle declarations live in `lib/domain/transactions/policy.ts`; `state-machine.ts` enforces them and applies mutations. The UI imports the policy only to control action visibility, while the server always authorizes again. Every acceptance/command carries an operation UUID and reviewed version. The other domain modules own aggregate creation, participants and corresponding record construction. `lib/domain/jobs.ts` is only a compatibility re-export. Do not create another transition engine in UI components, SQL or documentation, and do not bypass the service with direct record append calls.

The local file is `data/trustlink-local-v3.json`, with schema validation, an exclusive writer lock and atomic replacement. Preserve corrupt files for diagnosis; do not substitute sample data. See the Phase 2 report for safe lock recovery and development limitations.

Account authentication enters through `lib/auth/contracts.ts`. Local mode uses an explicit unconfigured provider that cannot authenticate. Supabase mode delegates credentials, sessions, confirmation and logout to Supabase Auth. `getCurrentUser()` uses validated `getUser()` output, requires a linked profile, and grants administrator access only from `app_metadata`. The proxy refreshes sessions but never replaces authorization at the page/action/data boundary. See the Phase 4 report.

Keep `AuthIdentity`, `ApplicationProfileRecord`, `ProviderProfileRecord` and `TransactionParticipant` distinct. Client participants may remain guests authorized by a job-scoped capability. Acceptance records `participantDetailStatus = SELF_PROVIDED` in the immutable acceptance event. `EMAIL_VERIFIED` and `OTHER_VERIFIED` have no emitting workflow. Private participant projections may show client contact details; `PublicJobProjection` must not. See the Phase 5 report.

PostgreSQL stores participant details and guest capabilities in `job_participants`; the former client columns no longer exist on `jobs`. `tl_read_job` reconstructs the domain aggregate, so do not couple domain code to a single physical row. `job_terms.price` is numeric and `deadline` is a date in PostgreSQL, with stable string values in the aggregate projection. `trust_events` and `evidence_files` remain the single event and attachment stores. `notification_intents` is the only notification persistence and may contain only the Phase 20 event-derived contract. Validation analytics derive from jobs and trust events rather than a generic telemetry table. Do not add duplicate job/payment event or dispute-evidence tables, generic analytics/audit tables, or manual reputation counters. Run `npm run db:types` after migration changes; `npm run typecheck` checks `lib/db/database.generated.ts` for drift. See the Phase 6, Phase 20 and Phase 21 reports.

All thirteen public application tables force RLS and expose no policy or grant to `anon`/`authenticated`. The security-invoker `public_job_records` and `public_transaction_events` views are server-only. `/j/[publicId]` validates its opaque ID, reads only these narrow projections for anonymous visitors, and renders `Transaction Record Not Found` for malformed or missing records. It must never regain a sample fallback or call `tl_read_job` for an anonymous page render. The elevated repository has read access, direct evidence metadata insert/delete, and only the three domain RPCs; it must be reached only after server authorization because its credential bypasses RLS. Do not add browser table grants or JWT policies without redesigning the guest-capability boundary. Every future migration must explicitly enable/force RLS and opt into the exact required grants. See the Phase 7 and Phase 11 reports.

`lib/trust-events/index.ts` is the canonical event vocabulary and actor map. Every event has a gap-free per-job `eventSequence`; readers order by it rather than UUID/time ties. PostgreSQL validates event actor/resource identity, operation metadata, version, chronology and state, while the public commit wrapper accepts only the exact stored prefix plus one new event (or the two creation events). The local adapter validates the same contract and upgrades legacy sequence-less local rows. Keep `JOB_VIEWED` reserved and side-effect free. See the Phase 8 report.

`PAYMENT_RECORDED` is an immutable provider declaration of direct receipt, not transfer verification. The row snapshots the agreed amount/currency and must match exactly one payment event. Authorized participant views label verification as unavailable; public projections exclude references and notes. No payment provider credential or reachable protected/authorized mode exists. See the Phase 9 report.

Job creation requires a validated `PROVIDER` session at both page and Server Action boundaries. The preview and server use the shared creation schema. `TransactionService` derives provider data from the server-side profile, creates a cryptographically random 24-character public ID, immutable initial terms and the two creation events, and commits them through the repository. PostgreSQL atomically creates provider/client participant rows and rejects malformed initial aggregates. Creation request UUIDs make retries idempotent; a replay never exposes the original private capability again. See the Phase 10 report.

Client capabilities are 256-bit random bearer values whose SHA-256 hash and expiry are stored only in the transaction participant row. A URL fragment is removed before the token is exchanged for HTTP-only cookies scoped to the requested transaction page and evidence endpoint. The server validates the matching stored hash and expiry for every client action, evidence request, and private render. `ROTATE_INVITE` replaces the stored capability, `REVOKE_INVITE` clears it, and both require their matching immutable event in local and PostgreSQL persistence. Plain capabilities are never recovered from storage or returned by a replay. See the Phase 12 report.

Client acceptance is a single capability-authorized `SENT` to `ACCEPTED` transition. It persists self-provided client details and a `JOB_ACCEPTED` event containing the exact immutable agreement snapshot; it does not verify the supplied identity. The PostgreSQL wrapper locks the persisted predecessor and requires an unused, unexpired capability before its private write. PostgreSQL and the local repository reject a forged snapshot, acceptance without an active capability, or later edits to accepted details. The public route exposes only the lifecycle marker, never the details or event metadata. See `docs/PHASE-13-CLIENT-ACCEPTANCE.md`.

A review is a single capability-authorized client command after `COMPLETED`. It creates one immutable review and one `CLIENT_REVIEWED` event carrying that review's ID and rating; local and PostgreSQL persistence reject any other actor, lifecycle point, review delta, or broken linkage. `/p/[username]` derives reputation from actual completed aggregates at read time. Keep empty metrics as dashes, treat guest repeat-client grouping as self-provided rather than verified identity, and do not expose agreed prices, payment totals, `verifiedRevenue`, or manually stored reputation counters. See `docs/PHASE-18-REVIEWS-TRUST-PROFILE.md`.

Every transaction mutation uses an operation UUID and reviewed version. Exact retries must match the persisted actor, normalized command hash, and expected version; a changed reuse fails. The service resolves a losing compare-and-swap only after rereading and proving that exact event. Pending delivery/dispute evidence is validated only for a new operation so a committed retry is not rejected after its files become attached. Creation IDs may return an existing record only when the submitted immutable creation payload matches. See `docs/PHASE-19-IDEMPOTENCY-CONCURRENCY.md`.

Phase 20 notification intents are created atomically from selected immutable trust events. Keep the six kind mappings and their provider/client/administrator recipient roles centralized in `lib/notifications/index.ts`; PostgreSQL independently enforces the same mapping. The table is an internal delivery boundary, not proof that any message was sent. Do not add an email/SMS credential, retry worker, delivery status, preferences, read state or social notification UI until a concrete channel is authorized. See `docs/PHASE-20-TRANSACTION-NOTIFICATIONS.md`.

Phase 21 validation analytics derive aggregate evidence from canonical jobs and immutable events. Keep `repeat_use_prompted` and `repeat_use_unprompted` distinct, count a repeat as customer-backed only when its transaction has `JOB_ACCEPTED`, and protect the creation classification from later edits. `/admin/validation` remains administrator-only and aggregate. Do not add page-view writers, device identifiers, tracking cookies, third-party analytics, client contact fields or free-text content to this report. See `docs/PHASE-21-VALIDATION-ANALYTICS.md`.

## Diagnostics and checks

The workspace points VS Code at `node_modules/typescript/lib`. Select **TypeScript: Select TypeScript Version > Use Workspace Version** to enable the installed Next plugin. This setting does not suppress diagnostics or prove that an unseen editor warning is stale.

```powershell
npm run typecheck
npm run lint
npm run build
npm test
npm run test:browser
npm run test:workflow
```

Run the build and each browser suite sequentially. Public browser coverage treats `/j/[publicId]` as persisted-only: the marketing example is the explicitly unsaved `/#preview` simulator, while a missing or malformed public ID must return the transaction-specific 404. Phase 2 enables strict TypeScript and fixes all eight missing utility occurrences identified in the Phase 0 audit plus four related background-color references found in variant maps. The IDE Problems panel itself was not inspected.

Payments are provider reports only. No wallet, custody, independent transfer verification or payment protection is implemented. Clients act through scoped capabilities; self-provided contact details are not verified identity.
