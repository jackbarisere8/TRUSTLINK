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
/dashboard/profile
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

No `/marketplace`, `/search`, or `/find-providers` routes exist in V0.1. See `AGENT.md`.

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

The canonical lifecycle declaration is `lib/domain/transactions/policy.ts`; `state-machine.ts` authorizes and applies it. The UI imports `isActionAvailable()` from this policy for visibility, but this never replaces server authorization. Acceptance and commands require operation UUIDs and reviewed versions. Domain folders also cover jobs, participants, payments, deliveries, revisions, disputes, reviews and trust-events. `lib/domain/jobs.ts` is a compatibility re-export only. The older broad folder outline below is historical, not a list of completed services. See `docs/PHASE-3-CANONICAL-STATE-MACHINE.md` and `docs/PHASE-2-LOCAL-BACKEND.md` for evidence and limits.

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
                          guest capability hash/expiry/use, timestamps
job_terms               job_id, service, scope, numeric price, currency, date deadline,
                          revisions, cancellation terms, timestamps
payments                job_id, recorded report fields and NOT_VERIFIED status
deliveries              job_id, description, private file references, submitted_by/at
revisions               job_id, revision_number, description, requested_by/at
disputes                job_id, contested term, claim/evidence, resolution and timestamps
reviews                 job_id, reviewer, rating, comment, submitted_at
evidence_files          job_id, private storage metadata, uploader and created_at
trust_events            id, job_id, actor, event_type, occurred_at, metadata, created_at
```

`job_participants` is authoritative for client contact/capability data; the application aggregate reconstructs its legacy-shaped `job` DTO through the private read RPC. Fee and deadline use `numeric(14,2)` and `date` in PostgreSQL while the domain projection returns stable strings. The job `version` is the optimistic-concurrency version for the aggregate and its mutable child state.

`trust_events` is the single event ledger, so no duplicate `job_events` or `payment_events` tables exist. `evidence_files` is the single attachment registry, so there is no duplicate dispute-evidence table. Notifications, analytics and broad audit logs have no implemented workflow and no empty tables. Derived reputation comes from completed jobs/reviews rather than provider-profile counters. **No wallet, escrow, or internal-balance tables exist.**

`lib/db/database.generated.ts` is generated from the cumulative migrations by `npm run db:types`; `npm run typecheck` rejects schema/type drift. Domain DTOs remain separate because the transaction aggregate is an intentional RPC projection rather than a copy of one physical table. See `docs/PHASE-6-DATABASE-MODEL.md`.

## 6. Job state machine

### Active in V0.1

```text
SENT → ACCEPTED → PAYMENT_RECORDED → IN_PROGRESS → DELIVERY_SUBMITTED
  DELIVERY_SUBMITTED → REVISION_REQUESTED → IN_PROGRESS
  DELIVERY_SUBMITTED → APPROVED → COMPLETED
  Active accepted states → DISPUTED → IN_PROGRESS (admin resumes) or CANCELLED
SENT → CANCELLED (provider)
```

Creation publishes directly into SENT. DRAFT is a reserved enum value, with no draft editor. JOB_VIEWED is reserved analytics, never a lifecycle state. No page fetch writes trust events. Review and participant-link rotation append events without changing status. See docs/FINAL-INTEGRITY-AUDIT.md for the exact authorized transition matrix.

The diagram summarizes `lib/domain/transactions/policy.ts`; it is not a separate rule set. PostgreSQL constrains the status/event vocabulary and atomically persists the aggregate. Transition eligibility remains in the TypeScript policy and state machine.

### Reserved for later (do not implement as reachable states yet)

```text
PAYMENT_PENDING → FUNDS_PROTECTED → IN_PROGRESS → ... → RELEASE_PENDING → SETTLED
```

`FUNDS_PROTECTED` must not be a reachable state in V0.1 under any code path, including test/demo data.

## 7. `trust_events`

Append-only. The implemented transaction event vocabulary is defined by `lib/trust-events/index.ts` and constrained in the final audit migration: `JOB_CREATED`, `JOB_SENT`, `JOB_ACCEPTED`, `PAYMENT_RECORDED`, `WORK_STARTED`, `DELIVERY_SUBMITTED`, `REVISION_REQUESTED`, `DELIVERY_APPROVED`, `DISPUTE_OPENED`, `DISPUTE_RESOLVED`, `JOB_COMPLETED`, `JOB_CANCELLED`, `CLIENT_REVIEWED`, `CLIENT_LINK_REISSUED`. `JOB_VIEWED` is reserved and never emitted by page reads. No identity-verification or provider-review event is implemented.

This ledger is the foundation of the future reputation engine — derive stats from it, don't hand-maintain counters separately.

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

V0.1's implementation returns `{ protectedFunds: false, authorization: false, partialRelease: false, partialRefund: false }`. `verifyPayment()` always returns `verified: false` and `NOT_VERIFIED`; `createPayment()` throws because processing is unavailable. Only the authorized transaction command persists a participant's report of a received payment. The future capability interface does not make any protection state reachable. See `lib/payments/types.ts`.

## 9. Auth & roles

`lib/auth/contracts.ts` is the application authentication boundary. In Supabase mode it delegates email/password login, signup, email confirmation, validated identity lookup and logout to Supabase Auth SSR. In local mode the explicit unconfigured provider never authenticates; there is no alternate password/session system or development dashboard bypass.

Account actors are `PROVIDER` or `ADMIN`. The server calls Supabase `getUser()`, then requires a linked application profile. Administrator role comes only from trusted Auth `app_metadata`; editable `user_metadata` cannot grant it. A client uses a scoped, expiring `CLIENT_PARTICIPANT` capability rather than an account. Actor identity comes from the server-validated session or capability, never a submitted ID. The proxy refreshes cookies but protected pages, actions and data access authorize independently. Magic-link login, password recovery, MFA and social login are not implemented. See `docs/PHASE-4-AUTHENTICATION-ARCHITECTURE.md`.

Auth identity, application profile, provider profile and transaction participant are separate models. `AuthIdentity` contains the validated account principal; `ApplicationProfileRecord` supplies application presentation; `ProviderProfileRecord` supplies provider-specific fields; `TransactionParticipant` represents a provider or client inside one transaction. A client can remain a guest authorized by the scoped capability. Acceptance records its contact provenance as `SELF_PROVIDED`, not verified identity. `EMAIL_VERIFIED` and `OTHER_VERIFIED` are reserved typed values with no current emitting workflow. Participant contact details are available only in authorized workspaces and remain absent from `PublicJobProjection`. See `docs/PHASE-5-USER-PROFILE-PARTICIPANTS.md`.

## 10. Security model

- All authenticated operations require valid server-side session checks — never trust a client-supplied role or status.
- A client must not see another client's private transactions; a provider must not modify another provider's jobs.
- Admin routes are separately protected, not just hidden in the UI.
- Dispute evidence and delivery files are private by default, not publicly readable.
- Every meaningful state transition writes a `trust_events` row.
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
