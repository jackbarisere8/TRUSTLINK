# TrustLink Web — Architecture v0.1

**Read first:** `PRD.md` (what to build) and `AGENT.md` (rules while building it).

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js + TypeScript, App Router | Full-stack React framework; one codebase for provider and client experiences |
| Styling | Tailwind CSS | Fast, consistent, small output |
| Database | PostgreSQL (via Supabase) | Strongly relational financial/transactional data |
| Auth | Supabase Auth | Email/password with email confirmation and SSR session validation |
| Storage | Supabase Storage | Delivery files, portfolio images, dispute evidence — never in the DB |
| Hosting | Vercel (app) + Supabase (data/auth/storage) | Minimal ops for a validation-stage product |
| ORM | None required for V0.1 | Add Prisma later only if the agent has a concrete reason to |

**Explicitly not used yet:** separate NestJS backend, microservices, Redis, React Native. These are Phase 2 decisions that must be *earned* by validation evidence, not assumed now.

```text
             TRUSTLINK WEB
                  │
             Next.js
                  │
        ┌─────────┼─────────┐
        │         │         │
       Auth     Database   Storage
        │         │         │
        └──── Supabase ────┘
```

## 2. Route structure

```text
/                          marketing
/how-it-works
/for-providers
/for-businesses
/login
/signup

/dashboard                 authenticated
/dashboard/jobs
/dashboard/jobs/new
/dashboard/jobs/[id]
/dashboard/services
/dashboard/services/new
/dashboard/services/[id]/edit
/dashboard/availability
/dashboard/profile
/dashboard/profile/preview
/dashboard/settings

/j/[publicId]               PUBLIC — no login. Highest-priority page in the product.
/p/[username]                PUBLIC — Trust Profile

/disputes/[id]

/admin                      admin-only
/admin/users
/admin/jobs
/admin/disputes
/admin/events
```

Public discovery is available at `/providers`; the homepage leads into the same server-backed search. Booking-request creation is intentionally absent until Phase 7. There are no alternate `/marketplace`, `/search`, or `/find-providers` routes.

## 3. Component structure

```text
components/
├── branding/
├── navigation/
├── auth/
├── jobs/        JobCard, JobSummary, JobTimeline, JobTerms, JobStatus, JobActions
├── profile/     TrustProfile, VerificationBadge, Stats, Skills, Portfolio
├── delivery/
├── disputes/
├── payments/
├── reviews/
└── ui/
```

## 4. Service / domain layer

Current Phase 3 implementation: UI mutations call Server Actions, which resolve the actor and call `lib/domain/transactions/index.ts` (`TransactionService`) or `lib/domain/profiles/index.ts`. Services accept `lib/db/repository.ts`; `lib/db/local-store.ts` and `lib/db/supabase.ts` are independent adapters. `TRUSTLINK_STORAGE` must explicitly select `local` or `supabase`; production requires complete Supabase configuration. No hosted project is configured in this workspace.

The canonical lifecycle declaration is `lib/domain/transactions/policy.ts`; `state-machine.ts` authorizes and applies it. The UI imports `isActionAvailable()` from this policy for visibility, but this never replaces server authorization. Acceptance and commands require operation UUIDs and reviewed versions. Acceptance additionally records the exact immutable agreement snapshot in `JOB_ACCEPTED`; submitted client details remain self-provided, not verified identity. Domain folders also cover jobs, participants, payments, deliveries, revisions, disputes, reviews and trust-events. `lib/domain/jobs.ts` is a compatibility re-export only. The older broad folder outline below is historical, not a list of completed services. See `docs/PHASE-3-CANONICAL-STATE-MACHINE.md`, `docs/PHASE-12-CLIENT-CAPABILITY.md`, and `docs/PHASE-13-CLIENT-ACCEPTANCE.md` for evidence and limits.

Phase 5 provider marketplace configuration lives in `lib/domain/provider-marketplace`, with its server-only Supabase adapter in `lib/db/provider-marketplace.ts`. Server Actions derive provider identity from the validated session; owner-scoped RPCs repeat authorization and critical validation at the database boundary. The public projection contains only published services and broad service-area information. Public search and customer booking pages are not part of this phase. See `docs/PHASE-5-PROVIDER-SERVICES-AVAILABILITY.md`.

Phase 6 provider discovery lives in `lib/domain/provider-search`, with local reference behavior and the server-only Supabase search adapter in `lib/db/provider-search.ts`. Public filters are validated URL state. Visitor geolocation is sent only after an explicit browser permission action and remains transient; private provider origins are read only inside the service-role RPC, which returns rounded distance without coordinates. See `docs/PHASE-6-PROVIDER-SEARCH.md`.

Job creation is a provider-only Server Action and service operation. The browser preview and service share the same Zod field contract; the server derives provider identity and location from the validated session/profile, generates an opaque 96-bit public ID, builds immutable terms and the `JOB_CREATED`/`JOB_SENT` pair, and commits the aggregate atomically. PostgreSQL creates the provider and guest-client participant rows in that transaction and rejects malformed initial state, identifiers, capabilities, terms, evidence collections or creation events. The client capability is a hashed 256-bit random bearer value with a 30-day expiry; its private-link fragment is exchanged for an HTTP-only cookie only after a server-side check. A valid client can then accept the reviewed SENT record once, preserving the agreement snapshot and self-provided participant details. See `docs/PHASE-10-REAL-JOB-CREATION.md`, `docs/PHASE-12-CLIENT-CAPABILITY.md`, and `docs/PHASE-13-CLIENT-ACCEPTANCE.md`.

Business logic lives in `lib/`, not inside page components — this keeps the door open for a separate backend later without a rewrite.

```text
lib/
├── auth/
├── jobs/
├── payments/
├── disputes/
├── reputation/
├── trust-events/
├── notifications/
└── validation/
```

## 5. Database schema

Core tables for V0.1 (fields abbreviated — full column definitions live in `supabase/migrations`):

```text
auth.users              id, authentication data and trusted app metadata
profiles                id, user_id, username, display_name, avatar, location, timestamps
provider_profiles       id, user_id, headline, bio, service_area, verification_status, timestamps
jobs                    id, public_id, provider_id, version, repeat_use, status, source_channel,
                          location/view/completion timestamps
job_participants        job_id, role, optional user_id, participant details and provenance,
                          guest capability hash/expiry/use or explicit revocation, timestamps
job_terms               job_id, service, scope, numeric price, currency, date deadline,
                          revisions, cancellation terms, timestamps
payments                job_id, recorded report fields and NOT_VERIFIED status
deliveries              job_id, description, private file references, submitted_by/at
revisions               job_id, revision_number, description, requested_by/at
disputes                job_id, raising party, category, claim/evidence, other-party response, status, resolution and timestamps
reviews                 job_id, reviewer, rating, comment, submitted_at
evidence_files          job_id, private storage metadata, purpose/status, uploader and created_at
trust_events            id, job_id, actor, event_type, occurred_at, metadata, created_at
notification_intents    job_id, event_id, notification kind, recipient role, created_at
```

`job_participants` is authoritative for client contact/capability data; the application aggregate reconstructs its legacy-shaped `job` DTO through the private read RPC. Capability values are SHA-256 hashes of 256-bit random plaintext values; an expiry accompanies every active hash, and both fields are cleared together only by revocation. Client details move from the blank guest state to immutable `SELF_PROVIDED` details only with the matching acceptance event. Fee and deadline use `numeric(14,2)` and `date` in PostgreSQL while the domain projection returns stable strings. The job `version` is the optimistic-concurrency version for the aggregate and its mutable child state.

`trust_events` is the single event ledger, so no duplicate `job_events` or `payment_events` tables exist. `evidence_files` is the single attachment registry, so there is no duplicate dispute-evidence table. `notification_intents` contains only immutable recipient-role intents derived from selected ledger events; it does not store delivery addresses, provider responses, preferences or read state. There is no generic analytics or broad audit-log table; validation analytics derive aggregate signals from canonical jobs and trust events. Derived reputation comes from completed jobs/reviews rather than provider-profile counters. **No wallet, escrow, or internal-balance tables exist.**

Disputes pause the job in `DISPUTED`. The raising party, category, claim, and evidence remain immutable; the other party can add one response and move the dispute from `OPEN` to `UNDER_REVIEW` while the job stays paused. Only an administrator can record an operational resolution to `IN_PROGRESS` or `CANCELLED`. Response and resolution changes require exact immutable events, and cancellation cannot reverse a direct payment. See `docs/PHASE-17-DISPUTES.md`.

Reviews are submitted once by the transaction-scoped client after `COMPLETED` and become immutable with an exact `CLIENT_REVIEWED` event link. The public Trust Profile derives completed count, average client rating, on-time delivery, repeat-client activity, completed services and recent feedback from actual completed aggregates at read time. It stores no reputation counters and excludes agreed prices, recorded-payment totals and verified-revenue claims. See `docs/PHASE-18-REVIEWS-TRUST-PROFILE.md`.

Transaction notification intents are created only for `JOB_ACCEPTED`, `PAYMENT_RECORDED`, `DELIVERY_SUBMITTED`, `REVISION_REQUESTED`, `DISPUTE_OPENED` and `JOB_COMPLETED`. A dispute addresses the other participant role and administrators; each other event has one fixed recipient role. Local persistence derives the same intents inside its writer lock, while PostgreSQL creates them from the inserted trust event in the same transaction. Unique event/recipient pairs make retries harmless. There is no sender integration or social notification UI. See `docs/PHASE-20-TRANSACTION-NOTIFICATIONS.md`.

Validation analytics are a read-time projection over canonical jobs and trust events. Creation records `FIRST`, `PROMPTED` or `UNPROMPTED` both on the job and its creation event; PostgreSQL and local persistence reject histories that repeat or alter `FIRST`. `/admin/validation` aggregates the two explicit repeat signals, counts them as customer-backed only after `JOB_ACCEPTED`, deduplicates lifecycle funnel stages by job, and summarizes source channels. It collects no page-view, device or third-party analytics telemetry and creates no duplicate analytics table. See `docs/PHASE-21-VALIDATION-ANALYTICS.md`.

`lib/db/database.generated.ts` is generated from the cumulative migrations by `npm run db:types`; `npm run typecheck` rejects schema/type drift. Domain DTOs remain separate because the transaction aggregate is an intentional RPC projection rather than a copy of one physical table. See `docs/PHASE-6-DATABASE-MODEL.md`.

All thirteen public application tables enable and force RLS. `anon` and `authenticated` have no direct table, view or RPC grants and no public-schema policies; public pages are deliberate DTO projections returned by the Next.js server. The server validates provider ownership, a client capability or trusted administrator metadata before using its isolated elevated Supabase client. That credential bypasses RLS, so application authorization is mandatory rather than supplied by the elevated database session. The client URL fragment is stripped before a Server Action validates it and writes HTTP-only cookies scoped to the requested transaction page and evidence endpoint; each private render, action, and evidence request resolves its cookie against the requested transaction's stored hash and expiry. `public_job_records` and `public_transaction_events` use `security_invoker=true` and remain server-only. Anonymous `/j/[publicId]` reads only their selected agreement/provider fields and allowlisted lifecycle event fields; it does not read participant contacts, capability hashes, payment references, evidence, event metadata, notification intents or the private aggregate RPC. Unavailable and malformed IDs render `Transaction Record Not Found`; metadata is derived only from the same persisted public projection. The elevated role can read application relations, insert/delete evidence metadata and execute only `tl_update_profile`, `tl_read_job` and `tl_commit_job` (plus the UUID default required for evidence insertion). See `docs/PHASE-7-DATABASE-SECURITY.md`, `docs/PHASE-11-PUBLIC-TRANSACTION-PAGE.md`, and `docs/PHASE-12-CLIENT-CAPABILITY.md`.

## 6. Job state machine

### Active in V0.1

```text
SENT → ACCEPTED → PAYMENT_RECORDED → IN_PROGRESS → DELIVERY_SUBMITTED
  DELIVERY_SUBMITTED → REVISION_REQUESTED → IN_PROGRESS
  DELIVERY_SUBMITTED → APPROVED → COMPLETED
  Active accepted states → DISPUTED → IN_PROGRESS (admin resumes) or CANCELLED
SENT → CANCELLED (provider)
```

Creation publishes directly into SENT with version zero, immutable terms, an unused expiring client capability and exactly two initial provider events. DRAFT is a reserved enum value, with no draft editor. JOB_VIEWED is reserved analytics, never a lifecycle state. No page fetch writes trust events. Review, participant-link replacement, and participant-access revocation append events without changing status. See docs/FINAL-INTEGRITY-AUDIT.md for the exact authorized transition matrix.

The diagram summarizes `lib/domain/transactions/policy.ts`; it is not a separate rule set. PostgreSQL constrains the status/event vocabulary and atomically persists the aggregate. Transition eligibility remains in the TypeScript policy and state machine.

Each acceptance and command includes a UUID operation key and expected transaction version. Its event stores the normalized command hash and reviewed version. Exact retries by the same actor return the persisted result; altered reuse is rejected. The local repository combines an exclusive file lock with compare-and-swap, while PostgreSQL locks the job row and enforces a unique request ID per job inside the atomic commit transaction. The service rereads a losing write and treats it as success only when the exact operation already committed. See `docs/PHASE-19-IDEMPOTENCY-CONCURRENCY.md`.

### Reserved for later (do not implement as reachable states yet)

```text
PAYMENT_PENDING → FUNDS_PROTECTED → IN_PROGRESS → ... → RELEASE_PENDING → SETTLED
```

`FUNDS_PROTECTED` must not be a reachable state in V0.1 under any code path, including test/demo data.

## 7. `trust_events`

Append-only. The implemented transaction event vocabulary and allowed actors are defined by `lib/trust-events/index.ts`: `JOB_CREATED`, `JOB_SENT`, `JOB_ACCEPTED`, `PAYMENT_RECORDED`, `WORK_STARTED`, `DELIVERY_SUBMITTED`, `REVISION_REQUESTED`, `DELIVERY_APPROVED`, `DISPUTE_OPENED`, `DISPUTE_RESPONDED`, `DISPUTE_RESOLVED`, `JOB_COMPLETED`, `JOB_CANCELLED`, `CLIENT_REVIEWED`, `CLIENT_LINK_REISSUED`, `CLIENT_LINK_REVOKED`. `JOB_VIEWED` is reserved and never emitted by page reads. No identity-verification or provider-review event is implemented.

Each event has a one-based `event_sequence` unique within its job. PostgreSQL validates contiguous order, chronology, actor/resource identity, transition operation metadata, reviewed version and event/state agreement. A `JOB_ACCEPTED` event also contains the exact immutable terms the client reviewed; that private metadata never enters a public projection. A `CLIENT_REVIEWED` event identifies the exact immutable review and rating. The public commit RPC requires the exact immutable stored prefix plus one new event; creation requires exactly the create/send pair. The underlying persistence function is private, and insert failure rolls back the whole transition. Update/delete/truncate remain blocked. Local storage enforces the same aggregate contract. See `docs/PHASE-8-TRUST-EVENT-LEDGER.md`, `docs/PHASE-13-CLIENT-ACCEPTANCE.md`, and `docs/PHASE-18-REVIEWS-TRUST-PROFILE.md`.

Phase 18 derives Trust Profile metrics from completed aggregates and their ledger-linked reviews; no provider reputation counter is hand-maintained.

## 8. Payment abstraction

```typescript
type PaymentMode = "PROTECTED" | "AUTHORIZED" | "RECORDED";

interface PaymentCapabilities {
  protectedFunds: boolean;
  authorization: boolean;
  partialRelease: boolean;
  partialRefund: boolean;
}

interface PaymentProvider {
  getCapabilities(): Promise<PaymentCapabilities>;
  createPayment(input: unknown): Promise<unknown>;
  verifyPayment(reference: string): Promise<unknown>;
}
```

V0.1's implementation returns `{ protectedFunds: false, authorization: false, partialRelease: false, partialRefund: false }`. `verifyPayment()` explicitly returns `verificationAvailable: false`, `verified: false` and `NOT_VERIFIED`; `createPayment()` throws because processing is unavailable. Only the authorized provider transaction command persists a declaration of direct receipt. The declaration snapshots the agreed transaction value and currency; it is not bank-transfer verification. The future capability interface does not make any protection state reachable. See `lib/payments/types.ts`.

## 9. Auth & roles

`lib/auth/contracts.ts` is the application authentication boundary. In Supabase mode it delegates email/password login, signup, email confirmation, validated identity lookup and logout to Supabase Auth SSR. In local mode the explicit unconfigured provider never authenticates; there is no alternate password/session system or development dashboard bypass.

Account actors are `CUSTOMER`, `PROVIDER`, or `ADMIN`. The server calls Supabase `getUser()`, then requires a linked application profile. Administrator role comes only from trusted Auth `app_metadata`; editable `user_metadata` cannot grant it. Provider access is an optional application capability derived from the presence of a `provider_profiles` row, so one non-admin identity can use both customer and provider workspaces. A guest client may still use a scoped, expiring `CLIENT_PARTICIPANT` capability without an account. A client link's fragment is exchanged for an HTTP-only session cookie only after the server validates its exact transaction hash and expiry; rotation and revocation invalidate the earlier capability. Actor identity comes from the server-validated session or capability, never a submitted ID. The proxy refreshes cookies but protected pages, actions and data access authorize independently. Password recovery is implemented; magic-link login, MFA and social login are not. See `docs/PHASE-4-AUTHENTICATION-ARCHITECTURE.md`, `docs/PHASE-4-UNIFIED-ACCOUNTS.md`, and `docs/PHASE-12-CLIENT-CAPABILITY.md`.

Auth identity, application profile, provider profile and transaction participant are separate models. `AuthIdentity` contains the validated account principal; `ApplicationProfileRecord` supplies application presentation; `ProviderProfileRecord` supplies provider-specific fields; `TransactionParticipant` represents a provider or client inside one transaction. A client can remain a guest authorized by the scoped capability. Acceptance records its contact provenance as `SELF_PROVIDED`, not verified identity, and locks those details through the matching `JOB_ACCEPTED` transition. `EMAIL_VERIFIED` and `OTHER_VERIFIED` are reserved typed values with no current emitting workflow. Participant contact details are available only in authorized workspaces and remain absent from `PublicJobProjection`. See `docs/PHASE-5-USER-PROFILE-PARTICIPANTS.md` and `docs/PHASE-13-CLIENT-ACCEPTANCE.md`.

## 10. Security model

- All authenticated operations require valid server-side session checks — never trust a client-supplied role or status.
- A client must not see another client's private transactions; a provider must not modify another provider's jobs.
- Admin routes are separately protected, not just hidden in the UI.
- Dispute evidence and delivery files are private by default, not publicly readable.
- Every meaningful state transition writes a `trust_events` row.
- Raw application tables and RPCs are unavailable to browser database roles. Every future public-schema table must opt into grants and explicitly enable/force RLS.
- The server database credential bypasses RLS and therefore may be used only after the page/action/route has performed its actor and resource authorization.
- No payment status is ever trusted from the frontend — see `AGENT.md` for the credentials/secrets rules that go with this.

## 11. National data model

Providers carry `country`/`state`/`city` and a separate provider-profile `service_area`. Jobs snapshot `provider_location`. The legacy schema has an unused `client_location`; a separate `job_location` remains a historical proposal. No real account is populated with example location data.

## 12. Performance requirements

The public Job Page in particular must assume a mobile browser on an imperfect connection: fast first paint, compressed images, minimal client-side JS, lazy-loaded media, no autoplay video, responsive layout, clear Open Graph metadata for link previews.

## 13. Deployment

```text
GitHub → Vercel → Next.js → Supabase (Auth · Postgres · Storage)
```

## 14. Migration path (earn, don't pre-build)

Only after V0.1 produces real validation evidence:

```text
Next.js/Web → API layer → NestJS → PostgreSQL
                                    ├── Payments
                                    ├── Storage
                                    └── Events
```

Do not begin this migration speculatively.
