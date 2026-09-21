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

**Payment mode in V0.1:** `RECORDED` only. UI copy = "Payment Recorded." Never display "Payment Protected" or "Payment Authorized" — those require a confirmed PSP partner (see `docs/trustlink-psp-interview-script-v2.md`, Assumption #1, currently unresolved).

Creation publishes directly into SENT. DRAFT is reserved; JOB_VIEWED is an unused analytics label. The exact authorization/transition matrix is in `docs/FINAL-INTEGRITY-AUDIT.md`.

**Implemented tables:** Supabase `auth.users`; public `profiles`, `provider_profiles`, `jobs`, `job_terms`, `payments`, `deliveries`, `revisions`, `disputes`, `reviews`, `trust_events`, `evidence_files`. No wallet/escrow tables. Apply all three migrations in order; the original migration alone is not the deployed authorization model.

**Core routes:** `/` `/j/[publicId]` (public, highest priority) `/p/[username]` (public) `/dashboard/*` `/disputes/[id]` `/admin/*`.

**Must-do on every build:**
- `source_channel` captured on every Job
- National fields (`country/state/city/service_area`), never hard-coded
- Repeat use classified `PROMPTED` / `UNPROMPTED` at the moment it happens
- `trust_events` row written on every major transition
- Server-side auth/role checks on everything — never trust the client
