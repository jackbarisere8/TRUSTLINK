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

Current Phase 2 implementation: UI mutations call Server Actions, which resolve the actor and call `lib/domain/transactions/index.ts` (`TransactionService`) or `lib/domain/profiles/index.ts`. Services accept `lib/db/repository.ts`; `lib/db/local-store.ts` and `lib/db/supabase.ts` are independent adapters. `TRUSTLINK_STORAGE` must explicitly select `local` or `supabase`; production requires complete Supabase configuration. No hosted project is configured in this workspace.

The canonical lifecycle implementation is `lib/domain/transactions/state-machine.ts`. Domain folders also cover jobs, participants, payments, deliveries, revisions, disputes, reviews and trust-events. `lib/domain/jobs.ts` is a compatibility re-export only. The older broad folder outline below is historical, not a list of completed services. See `docs/PHASE-2-LOCAL-BACKEND.md` for current persistence evidence and limits.

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
users                  id, email, role (CLIENT|PROVIDER|ADMIN), status, created_at
profiles                user_id, display_name, avatar, country, state, city
provider_profiles       user_id, headline, bio, service_area, verification_status
skills / provider_skills

jobs                    id, public_id, provider_id, client_id, status, source_channel,
                          provider_location, client_location, job_location
job_terms               job_id, service, scope, price, currency, deadline, revisions, cancellation_terms
job_events               job_id, event_type, timestamp   (lightweight per-job log; see trust_events for the canonical ledger)

payments                job_id, payment_mode, reference, status
payment_events           payment_id, event_type, timestamp
payment_provider_accounts   (empty/unused until a partner is confirmed)

deliveries               job_id, description, files, submitted_at
revisions                job_id, description, affected_item, requested_at

disputes                 job_id, category, description, status
dispute_evidence          dispute_id, file, uploaded_at

reviews                   job_id, reviewer_id, rating, comment, would_repeat

trust_events              id, job_id, actor_id, event_type, timestamp, metadata   -- append-only, never overwritten

notifications
audit_logs
```

**No wallet, escrow, or internal-balance tables exist.** `payments` records that a payment happened; it never represents TrustLink holding funds.

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

Supabase Auth SSR email/password and email confirmation. Magic-link login is not implemented. Account actors are `PROVIDER` or `ADMIN` (administrator role comes from trusted Auth app metadata). A client uses a scoped, expiring `CLIENT_PARTICIPANT` capability. Actor identity comes from the server-validated session or capability, never a submitted ID.

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
