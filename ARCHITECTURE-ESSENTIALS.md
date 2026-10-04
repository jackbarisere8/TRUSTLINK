# TrustLink Web — Architecture Essentials

One page. Full detail in `ARCHITECTURE.md`; rules of engagement in `AGENT.md`.

**Product in one sentence:** TrustLink turns an informal Nigerian service agreement into a structured, shareable transaction — identity, scope, price, deadline, evidence, dispute, reputation — via a public link. It does not own the conversation, the marketplace, or (yet) the money.

**Stack:** Next.js + TypeScript (App Router) · Tailwind · PostgreSQL via Supabase · Supabase Auth · Supabase Storage · Vercel hosting. No NestJS, no microservices, no Redis, no native app — yet.

**Must not build:**
- Marketplace / search / discovery
- Wallet, escrow, TrustLink-held funds, any internal ledger implying custody
- Real payment-provider integration (interface stub only)
- `FUNDS_PROTECTED` or `PAYMENT_AUTHORIZED` as reachable states
- Social-platform API dependencies
- Native mobile app, AI scoring, lending

**Active job states:**
```
SENT → ACCEPTED → PAYMENT_RECORDED → IN_PROGRESS → DELIVERY_SUBMITTED
  DELIVERY_SUBMITTED → REVISION_REQUESTED → IN_PROGRESS
  DELIVERY_SUBMITTED → APPROVED → COMPLETED
  Active accepted states → DISPUTED → IN_PROGRESS (admin resumes) or CANCELLED
SENT → CANCELLED (provider)
```

**Payment mode in V0.1:** `RECORDED` only. The provider declares direct receipt of the agreed value; payment verification is unavailable. Never display "Payment Protected" or "Payment Authorized" — those require a confirmed PSP partner (see `docs/trustlink-psp-interview-script-v2.md`, Assumption #1, currently unresolved). See `docs/PHASE-9-PAYMENT-SEMANTICS.md`.

Creation is provider-only and publishes directly into SENT through one atomic repository commit. It creates immutable terms, provider/client participant relationships, `JOB_CREATED` and `JOB_SENT`, then returns the opaque 96-bit public route. DRAFT is reserved; JOB_VIEWED is an unused analytics label. See `docs/PHASE-10-REAL-JOB-CREATION.md` and the exact authorization/transition matrix in `docs/FINAL-INTEGRITY-AUDIT.md`.

`lib/domain/transactions/policy.ts` is authoritative for actor/state/action/event mappings. `state-machine.ts` enforces it; UI controls only project it. All mutations require an operation UUID and reviewed version. Client acceptance records the exact immutable agreement snapshot with `SELF_PROVIDED` details; it does not prove verified identity. `JOB_VIEWED` is never emitted by a page read and does not prove human review.

**Implemented tables:** Supabase `auth.users`; public `profiles`, `provider_profiles`, `jobs`, `job_participants`, `job_terms`, `payments`, `deliveries`, `revisions`, `disputes`, `reviews`, `trust_events`, `evidence_files`, `notification_intents`. There are no duplicate job/payment event tables, generic analytics/audit tables, or wallet/escrow tables. Apply all seventeen migrations in order; the original migration alone is not the deployed model. Generate the typed persistence contract with `npm run db:types`; `npm run typecheck` checks it for migration drift.

**Database authorization:** All thirteen public application tables force RLS. `anon` and `authenticated` have no table, view or RPC privileges. `/j/[publicId]` loads only a narrow persisted agreement projection and an allowlisted event DTO; it has no sample fallback and does not load the private aggregate for anonymous visitors. Provider, client-capability and administrator checks happen before private details are read. `service_role` has read access, evidence metadata insert/delete and only the three application RPCs. See `docs/PHASE-7-DATABASE-SECURITY.md` and `docs/PHASE-11-PUBLIC-TRANSACTION-PAGE.md`.

**Trust-event ledger:** `lib/trust-events/index.ts` owns the typed vocabulary and actor map. Each event has a gap-free per-job sequence. PostgreSQL rejects history-prefix changes, gaps, wrong actors, missing operation metadata, state mismatches and update/delete/truncate; a failed event insert rolls back the full transition. `JOB_VIEWED` has no writer and is never evidence of human review. See `docs/PHASE-8-TRUST-EVENT-LEDGER.md`.

**Reviews and Trust Profile:** Only the scoped client can submit one immutable review after completion, and its event identifies the exact review row. `/p/[username]` derives completed count, client rating, on-time delivery, repeat-client activity, services and recent feedback from completed records at read time. It stores no reputation counters and exposes no price, revenue, payment-total or verified-settlement metric. See `docs/PHASE-18-REVIEWS-TRUST-PROFILE.md`.

**Idempotency and concurrency:** Every acceptance and command carries an operation UUID plus reviewed version. The immutable event stores its actor, command hash and expected version; exact retries return the saved result, while changed reuse fails. Local storage uses an exclusive lock and compare-and-swap; PostgreSQL uses a row lock, unique per-job request index and atomic commit RPC. See `docs/PHASE-19-IDEMPOTENCY-CONCURRENCY.md`.

**Transactional notifications:** Selected immutable events atomically create recipient-role intents for acceptance, recorded payment, delivery, revision, dispute and completion. The intent table has no addresses, provider delivery state, preferences or read state. No email/SMS integration or social notification center is implemented. See `docs/PHASE-20-TRANSACTION-NOTIFICATIONS.md`.

**Validation analytics:** `FIRST`, `PROMPTED` and `UNPROMPTED` are immutable creation classifications. The administrator report derives aggregate prompted/unprompted repeat signals, source channels and unique-transaction lifecycle counts from canonical jobs and trust events. Only an accepted unprompted repeat counts as customer-backed independent reuse. No page-view tracking, analytics SDK or duplicate analytics-event table exists. See `docs/PHASE-21-VALIDATION-ANALYTICS.md`.

**Phase 23 quality baseline:** TypeScript, generated database-type drift, lint, the production build, 51 repository tests, 8 public browser tests and 2 production workflow tests pass. The browser suites cover every public page plus all provider/admin route families, dynamic transaction/dispute/profile pages and private route handlers under their real authorization boundaries. See `docs/PHASE-23-ERROR-ELIMINATION.md`. Hosted Supabase activation remains a separate pending Phase 22 gate.

**Core routes:** `/` `/j/[publicId]` (persisted public agreement, highest priority) `/p/[username]` (public) `/dashboard/*` `/disputes/[id]` `/admin/*`. An unavailable or malformed public ID renders `Transaction Record Not Found`.

**Authentication:** Supabase Auth is the only production provider. Local mode is explicitly unconfigured and cannot authenticate. Server `getUser()` output must link to a profile; only `app_metadata.role = ADMIN` grants administration. The proxy refreshes sessions but never supplies authorization. Guest clients use 256-bit job-scoped capabilities, exchanged from URL fragments into HTTP-only cookies. The server checks the requested transaction's stored hash and expiry for every private action; providers can replace or revoke the capability.

**People model:** Auth identity, application profile, provider profile and transaction participant are separate types. The client may remain a guest participant. Acceptance records immutable `SELF_PROVIDED` details and the reviewed terms snapshot; it does not establish verified identity. Private participant projections contain client contact details, while public agreement projections exclude them. See `docs/PHASE-5-USER-PROFILE-PARTICIPANTS.md` and `docs/PHASE-13-CLIENT-ACCEPTANCE.md`.

**Must-do on every build:**
- `source_channel` captured on every Job
- National fields (`country/state/city/service_area`), never hard-coded
- Repeat use classified `PROMPTED` / `UNPROMPTED` at the moment it happens
- `trust_events` row written on every major transition
- Server-side auth/role checks on everything — never trust the client
