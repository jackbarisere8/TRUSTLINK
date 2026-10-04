# Phase 10: real job creation

Implemented for the request to continue with Phase 10 on September 22, 2026. `/dashboard/jobs/new` has an explicit end-to-end creation contract from authenticated provider input to an atomically persisted, shareable transaction.

## Creation contract

Only a validated account with `role = PROVIDER` can open or invoke the creation flow. Page rendering is not treated as authorization: `createJobAction` independently resolves the current server session and rejects absent or non-provider principals.

The editable form and preview parse the same `createJobDraftSchema` used to define the server contract. Final publication submits the actual confirmation checkbox value. `TransactionService.create` validates the complete input again, derives provider identity and location from the session-linked profile, and classifies repeat use at creation time.

Each successful publication creates:

- a UUID transaction identity and a separate 24-character public ID generated from 96 bits of cryptographic randomness;
- one `SENT`, version-zero job;
- immutable NGN terms;
- one provider and one guest client-participant relationship;
- an unused, hashed client capability that expires after 30 days;
- `JOB_CREATED` followed by `JOB_SENT`; and
- the real `/j/[publicId]` route and private participant route fragment returned to the UI.

The client-supplied creation UUID is an idempotency key, not the public identifier. Repeating the same successful request returns the existing provider-owned record without creating another transaction or revealing the original private token. The provider can replace a lost participant link from the authorized workspace.

## Persistence integrity

`supabase/migrations/20260922000000_real_job_creation.sql` upgrades the public-ID constraint from nonblank text to exactly 24 lowercase hexadecimal characters. Its preflight rejects incompatible historical IDs instead of silently rewriting public routes.

The public commit RPC now rejects a new aggregate unless it contains the canonical SENT/version-zero job, synchronized creation timestamps, immutable initial terms, no lifecycle evidence, an unused expiring client capability, and the exact two provider creation events. It then delegates to the private persistence function, which writes the job, terms, participants and events in the same PostgreSQL transaction. Any participant, term, event or constraint failure rolls back the complete creation.

The local schema enforces the same public-ID and two-event initial shape before its atomic file replacement. Neither adapter uses sample records or React-only state as persistence.

## Interface behavior

The provider previews validated terms before publishing. The preview says its public ID will be assigned after publication and does not fabricate an identifier. A successful response displays the private client link, workspace route and public agreement route produced from the persisted record. Browser workflow coverage verifies that the public path and private link refer to the same opaque ID and that the workspace uses the real UUID record.

Administrators retain their explicit administration role and cannot be coerced into provider creation through the page or action. Provider identity is never accepted from the submitted form.

## Deployment boundary

No hosted Supabase project exists in this workspace, and no migration was applied remotely. Phase 10 introduced the eighth migration; the current deployment sequence now includes Phase 13's eleventh migration and should be applied to backed-up staging data in order. Repair any Phase 10 preflight failure by deciding how legacy public routes should be migrated; do not weaken the opaque-ID constraint or silently break shared links.

## Verification

Verified locally on September 22, 2026:

| Check | Result | Creation coverage |
|---|---|---|
| `npm run typecheck` | Passed | Eight-migration drift check and strict TypeScript |
| `npm run lint` | Passed | Application, migration support and tests |
| `npm test` | 34 passed | Shared input validation, canonical aggregate, opaque IDs, atomic SQL/local persistence, participants, events, malformed creation rollback and retries |
| `npm run build` | Passed | Production Next.js 16.3.5 compilation and route generation |
| `npm run test:browser` | 6 passed | Public surfaces and responsive behavior |
| `npm run test:workflow` | 2 passed | Real form publication through the Supabase adapter/PGlite, matching public/private routes, provider workspace persistence and admin creation denial |

Hosted Auth, PostgREST and migration behavior still require staging verification with real deployment configuration and historical data.
