# Phase 2: product stabilization and essential account safety

- Date completed locally: October 5, 2026 (Africa/Lagos)
- Scope: Phase 2 only
- Status: **COMPLETE LOCALLY; hosted operational checks remain gated by Phase 1**
- Marketplace schema, provider discovery, booking persistence, and Phase 3 work: not started

## Phase declaration

```text
Phase: 2 - Stabilize existing product and essential account safety
Objective: Close known customer-facing breaks and security prerequisites before adding public mutation surfaces.
Evidence: Source review, installed Next.js 16.3.5 guidance, unit/integration tests, production build, public browser tests, and the PostgreSQL/Supabase-fixture workflow.
Database impact: No migration or schema change.
External impact: No hosted project, email provider, scheduled cleanup job, or deployment was changed.
```

## Result

The Phase 2 local gate passes. The existing transaction workflow remains operational, valid provider/client/admin participants retain access, invalid participants fail closed, and the new password-recovery workflow is exercised end to end against the test-only Supabase adapter.

This result is not hosted-staging evidence. `docs/PHASE-1-HOSTED-SUPABASE-STAGING.md` remains the authoritative blocker report. Phase 3 must not start until that gate is completed against a founder-supplied staging project.

## Implemented work

### 1. Password recovery and confirmation messaging

- Added `/forgot-password`, `/auth/recovery`, and `/reset-password`.
- Added recovery operations to the authentication provider contract and Supabase adapter.
- Recovery requests return the same user-facing response for registered and unregistered addresses, preventing account enumeration.
- Invalid, expired, and rate-limited recovery/confirmation links display explicit messages instead of silently sending users to the dashboard.
- Recovery and confirmation redirects use the configured application origin. This avoids losing auth cookies when a proxy's internal hostname differs from the public hostname.
- Password updates require a valid recovery session, enforce matching 8-to-128-character values, sign out the recovery session, and require a fresh login.

### 2. Minimum application rate limiting

The server-only limiter hashes bucket identifiers before storing them, rejects invalid policies, bounds in-memory bucket growth, and fails closed when capacity is exhausted.

| Surface | Address limit | Account/record limit | Window |
| --- | ---: | ---: | --- |
| Login | 30 | 10 | 15 minutes |
| Signup | 10 | 3 | 60 minutes |
| Recovery request | 10 | 3 | 60 minutes |
| Auth callback | 20 | - | 15 minutes |
| Password update | 5 | - | 15 minutes |
| Capability exchange | 30 | 10 | 15 minutes |
| Transaction mutations | 120 | 40 | 5 minutes |
| Evidence mutations | 30 | 15 | 15 minutes |

Same-origin and participant authorization checks run before a request can consume sensitive record-level quotas. Rate-limited route handlers return `429`, `Retry-After`, and `no-store`; Server Actions return bounded user-facing errors.

This is the minimum single-process control. A horizontally scaled deployment must replace it with a shared atomic limiter before public traffic. The deployment proxy must overwrite, not append user-controlled forwarding headers.

### 3. CSP and HSTS deployment policy

`next.config.ts` applies the policy to all routes:

- deny framing with CSP `frame-ancestors 'none'` and `X-Frame-Options: DENY`;
- deny plugins/objects and embedded frames;
- restrict base URI, forms, images, fonts, media, workers, and connections;
- set `nosniff`, `no-referrer`, a restrictive Permissions Policy, COOP, and cross-domain policy;
- add `upgrade-insecure-requests` and one-year HSTS only in production.

HSTS intentionally omits `includeSubDomains` and `preload` until every relevant subdomain is confirmed HTTPS-only. The CSP uses the narrow static policy compatible with the current application. It retains the inline allowances required by the current Next.js rendering model; adopting nonce-based CSP would make pages dynamic and requires a separate measured change.

### 4. Explore and content integrity

- Canonical career slugs now flow consistently between home search, Explore, Learn, and opportunity filters.
- Unknown slugs fall back safely instead of producing misleading empty states.
- Removed unverified income ranges, demand signals, employer lists, placement claims, and accreditation implications.
- Opportunity records are explicitly synthetic examples with no live employer, compensation, deadline, application, or placement claim.
- Career status, tools, tasks, routes, and Pathfinder results are labeled as editorial/example material that users must verify independently.

### 5. Stale local data quarantine

No application, test, migration, or script references `data/trustlink-dev.json`. It was moved to the ignored, recoverable path:

```text
.local-quarantine/trustlink-dev.json
SHA-256 CC12DE6856F53E1F9160CCA92862DA3DBB04C5A3513A8BE68015E7DC21743DBA
```

The active local adapter continues to use `data/trustlink-local-v3.json`. Nothing was permanently deleted.

### 6. Monitoring and error boundaries

- Next.js `onRequestError` emits structured server error events.
- Root and route error boundaries show a recovery path and expose only the framework digest as a support reference.
- Auth, capability, transaction, and evidence mutations emit allowlisted operational events with success, rejection, rate-limit, or failure outcomes.
- Event payloads accept only bounded labels, method, route path, status, retry delay, operation, and digest. Query strings, fragments, emails, tokens, names, filenames, storage paths, request bodies, error messages, stacks, and private evidence are not accepted.

### 7. Existing-product repairs

Verification exposed interleaved duplicate implementations in the public transaction page, Trust Profile, dashboard jobs page, signup handler, and How It Works call to action. The coherent authenticated implementations were restored without resetting the surrounding dirty worktree. In particular, the dashboard no longer falls back to a demo provider ID; it requires the current user and reads that user's records.

## Upload retention and orphan-cleanup design

The current schema distinguishes mutable `PENDING` uploads from immutable `ATTACHED` evidence. Attached evidence is part of the transaction record and is never eligible for automatic deletion.

The staging cleanup design is:

1. Treat an unattached `PENDING` row older than 24 hours as a cleanup candidate.
2. Recheck under a database lock that the row is still pending and is absent from delivery/dispute references.
3. Claim a bounded batch with service-only ownership, an attempt counter, claim timestamp, and next-attempt time.
4. Delete the private Storage object, then delete/tombstone the pending metadata in an idempotent operation.
5. Retry transient object failures with bounded exponential backoff; retain a terminal failure record for operator review.
6. Run a separate daily Storage inventory reconciliation for objects older than 24 hours that have no metadata row, covering upload rollback and the existing `cleanupPending` response path.
7. Emit counts and failure categories only. Never log object paths, filenames, participant identifiers, or file contents.
8. Begin in staging with dry-run counts, then a small canary batch, restore verification, and repeated-run idempotency checks before scheduling the job.

Safe automation was not added because the required hosted staging project, private bucket inspection, scheduler, and migration authority are unavailable. Automating deletion against an unverified or production target would violate the Phase 1 gate. Before activation, add a reviewed migration for cleanup claim/retry state and a service-only cleanup function; do not implement this as an unaudited client-side timer.

## Verification evidence

All final checks passed on October 5, 2026:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed, including generated database type drift check |
| `npm run lint` | Passed with zero warnings/errors |
| `npm test` | 56 passed, 0 failed |
| `npm run build` | Passed; Next.js 16.3.5 production build |
| `npm run test:browser` | 9 passed, 0 failed |
| `npm run test:workflow` | 3 passed, 0 failed |
| `git diff --check` | Passed after newline cleanup |

The workflow suite covers the full provider/client/admin transaction lifecycle, trusted-role and secure-cookie enforcement, logout, non-enumerating recovery requests, invalid recovery links, password rotation, rejection of the old password, and login with the new password. It uses real PostgreSQL through the repository's test-only Supabase protocol adapter; it is not proof of a hosted Supabase deployment.

## Remaining external gate

Hosted validation still requires the staging URL, publishable key, server-only secret, HTTPS application origin, Supabase CLI/project linkage, migration authority, Auth email configuration, and private Storage inspection listed in `docs/PHASE-1-HOSTED-SUPABASE-STAGING.md`.

Do not begin Phase 3 marketplace schema or booking work until that hosted gate is complete.
