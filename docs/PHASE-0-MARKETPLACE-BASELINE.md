# Phase 0: Marketplace expansion baseline and readiness audit

- Date: 2026-10-04
- Starting branch: `main`
- Starting commit: `031a585ec47b58502ec16340c6a83d471dbcc86d`
- Scope: Inspection, verification, source research, and architecture documentation only
- Application/schema changes in this phase: None
- Related decision: `docs/ADR-001-MARKETPLACE-EXPANSION.md`

## Phase declaration

```text
Phase: 0 — Fresh repository baseline and architecture decision record
Objective: Confirm repository truth and freeze safe architecture boundaries before marketplace implementation.
Current evidence: Existing audit, current working tree, source, migrations, generated types, tests, browser runs, and installed Next.js 16 documentation.
Files likely affected: Phase 0 documentation only.
Database/API impact: None.
Security risks: Accidental overwrite of a heavily modified tree; disclosure of environment secrets; mistaking fixtures for hosted proof.
Tests to add/run: No new test behavior; rerun all existing baseline commands.
Explicitly out of scope: Marketplace schema, search UI, booking UI, Supabase activation, credential creation, migrations, and visual redesign.
```

## Executive result

Phase 0 passes. The current working tree builds and its existing automated coverage passes:

- generated database-type drift check and TypeScript: passed;
- ESLint: passed;
- domain/database tests: 51 passed;
- production build: passed;
- public Playwright suite: 8 passed;
- provider/client/admin workflow suite: 2 passed.

No marketplace implementation was added. The next phase cannot begin in this checkout because hosted Supabase configuration and CLI/project linkage are absent. The working tree is also substantially dirty, so any later phase must continue to preserve existing changes and review overlap file by file.

## A. Current repository structure

### Application

- `app/` — Next.js App Router pages, layouts, Server Actions, and Route Handlers.
- `components/` — product UI grouped around navigation, home, jobs, profiles, disputes, admin, and experimental discovery surfaces.
- `lib/domain/` — transaction policy, state machine, participants, deliveries, revisions, disputes, reviews, payments, and events.
- `lib/db/` — shared records/contracts plus independent local and Supabase repository implementations.
- `lib/auth/` — configuration, provider contracts, Supabase Auth adapter, and session/profile resolution.
- `supabase/migrations/` — 17 ordered SQL migrations.
- `tests/` — Node domain/database tests, PGlite-backed migration tests, and Playwright public/workflow suites.
- `scripts/` — generated database-type check, hosted Supabase preflight, and source export.
- `docs/` — prior phase evidence and operational setup documentation.

### Current routes

Public/product routes:

```text
/
/how-it-works
/for-providers
/for-businesses
/explore
/pathfinder
/learn
/opportunities
/p/[username]
/j/[publicId]
/login
/signup
/auth/confirm
/privacy
/terms
```

Provider workspace:

```text
/dashboard
/dashboard/jobs
/dashboard/jobs/new
/dashboard/jobs/[id]
/dashboard/profile
/dashboard/settings
```

Administration and disputes:

```text
/admin
/admin/users
/admin/jobs
/admin/disputes
/admin/events
/admin/validation
/disputes/[id]
```

Route Handlers:

```text
/api/client-capability/[publicId]
/api/evidence/[jobId]
/auth/confirm
```

No `/providers`, `/account`, booking request, provider service, or availability route exists yet.

### Source-of-truth boundaries

- Transaction behavior: `lib/domain/transactions/`.
- Canonical lifecycle declarations: `lib/domain/transactions/policy.ts`.
- Persistence contract: `lib/db/repository.ts`.
- Local adapter: `lib/db/local-store.ts`.
- Supabase adapter: `lib/db/supabase.ts`.
- Auth provider boundary: `lib/auth/`.
- Public transaction projection: repository methods and server-only database views.
- Reputation calculation: `lib/reputation/`.
- Notification intent mapping: `lib/notifications/`.

### Installed Next.js 16 guidance reviewed

The audit read the installed documentation for project structure, Server/Client Components, Route Handlers, forms, authentication, Server Actions, data security, and caching. Relevant conclusions are recorded in ADR-001.

`next.config.ts` does not enable `cacheComponents`, so future implementation must not copy `use cache`/Cache Components examples without first making and validating that separate framework decision. Current marketplace reads should follow the repository's existing rendering model until explicitly changed.

## B. Current backend status

The transaction backend is an implemented, tested domain system rather than a UI simulation.

`TransactionService` currently exposes:

- `create`;
- `accept`;
- `execute` for lifecycle commands.

It injects a repository, validates schemas, authorizes roles/capabilities, checks expected versions and request IDs, and resolves safe idempotent replays after conflicts.

The repository currently supports:

- account/provider profile reads and profile updates;
- private aggregate reads;
- narrow public transaction reads;
- provider job lists;
- admin profile/dispute/event reads;
- notification-intent reads;
- atomic compare-and-swap aggregate commits.

Marketplace behavior is absent. It should be added through a focused marketplace repository and domain service rather than by expanding UI components or duplicating transaction mutations.

## C. Current authentication status

- Supabase Auth architecture is implemented.
- Session identity is validated through Supabase `getUser()` rather than trusting raw browser identity fields.
- Application access requires the authenticated Supabase user to map to an application profile.
- Provider access requires a provider profile.
- Administrator authority comes only from trusted `app_metadata.role = ADMIN`.
- The proxy refreshes Supabase sessions but is not treated as the authorization boundary.
- Server Actions and protected pages authorize again at the server/domain boundary.
- Guest clients remain transaction-scoped capability participants rather than account users.

Current `.env.local` selects:

```text
TRUSTLINK_STORAGE=local
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

No Supabase URL, public key, or server secret is present. Local mode intentionally uses an unconfigured auth provider, so signup, login, account dashboards, and authenticated job creation are unavailable in the running local application.

Account recovery is not implemented.

## D. Current database and storage status

### PostgreSQL model

Generated types contain 13 application tables:

```text
profiles
provider_profiles
jobs
job_terms
job_participants
payments
deliveries
revisions
disputes
reviews
trust_events
evidence_files
notification_intents
```

Server-only public projections:

```text
public_job_records
public_transaction_events
```

Principal RPC boundary:

```text
tl_read_job
tl_commit_job
tl_update_profile
```

The current schema does not contain:

- service categories/definitions;
- provider service offerings;
- normalized states/LGAs;
- provider service areas;
- provider availability or slot holds;
- booking requests/events;
- customer notification inbox/read state.

### Storage modes

- Local JSON storage is durable development storage with validation, an exclusive writer lock, and atomic replacement.
- Production refuses local storage.
- Supabase mode requires all three Supabase configuration values.
- Private evidence uses Supabase Storage only.
- The PGlite/HTTP fixture is automated test infrastructure, not application hosting.

### Hosted readiness

The repository has a safe hosted preflight script and activation checklist, but the environment currently has:

```text
Supabase CLI: not installed
supabase/config.toml: missing
NEXT_PUBLIC_SUPABASE_URL: absent
NEXT_PUBLIC_SUPABASE_ANON_KEY: absent
SUPABASE_SERVICE_ROLE_KEY: absent
```

No remote project, migration state, Auth email configuration, Storage policy, backup, or hosted concurrency behavior was verified in Phase 0.

## E. Current transaction state machine

Canonical states:

```text
DRAFT
SENT
ACCEPTED
PAYMENT_RECORDED
IN_PROGRESS
DELIVERY_SUBMITTED
REVISION_REQUESTED
APPROVED
COMPLETED
DISPUTED
CANCELLED
```

Primary path:

```text
SENT
→ ACCEPTED
→ PAYMENT_RECORDED
→ IN_PROGRESS
→ DELIVERY_SUBMITTED
→ APPROVED
→ COMPLETED
```

Revision loop:

```text
DELIVERY_SUBMITTED
→ REVISION_REQUESTED
→ IN_PROGRESS
→ DELIVERY_SUBMITTED
```

Disputes may be opened from accepted through approved states. Administrator resolution explicitly returns the transaction to `IN_PROGRESS` or moves it to `CANCELLED`.

Reviews are one post-completion client-participant command and do not change transaction status.

Invite rotation/revocation are ledgered operations that do not change transaction status.

No booking status is currently present. ADR-001 keeps the future booking state machine separate and links it to the canonical transaction at final-terms acceptance.

## F. Current security status

### Confirmed strengths

- Server-validated account identities.
- Administrator role sourced from trusted application metadata.
- 256-bit participant capabilities stored only as SHA-256 hashes.
- Capability expiry, rotation, revocation, and transaction scoping.
- URL-fragment token exchange into HTTP-only, same-site, path-scoped cookies.
- Origin checks and body limits.
- Narrow anonymous transaction projections.
- Private evidence authorization and short-lived signed downloads.
- File signature validation, bounded upload size, and safe filenames.
- Immutable event history with actor/action/resource linkage.
- Optimistic concurrency and operation-level idempotency.
- Production refuses local storage and incomplete Supabase configuration.
- All application tables are RLS-enabled and forced by later security migrations; browser roles do not receive direct application-table access.

### Known limitations

- No rate limiting for authentication, capabilities, booking-like mutations, reviews, or uploads.
- No malware scanner.
- No production monitoring/alerting proof.
- No orphan-upload cleanup worker or verified retention operation.
- No configured Content Security Policy or HSTS.
- Elevated server credentials bypass RLS and therefore require every server authorization check to remain correct.
- Guest capability possession grants transaction-specific client authority.
- Client contact details are self-provided, not verified identity.
- Hosted Auth, RLS, Storage, email, backup, and restore behavior remain unverified.
- Current `Permissions-Policy` disables browser geolocation for all origins; future nearby search must change it deliberately.

## G. TypeScript, lint, build, test, and editor status

Commands executed from the current working tree:

| Check | Result |
|---|---|
| `npm run typecheck` | Passed; generated database contract has no drift and TypeScript reports no error |
| `npm run lint` | Passed with no reported lint error |
| `npm test` | Passed: 51/51 |
| `npm run build` | Passed under Next.js 16.3.5/Turbopack |
| `npm run test:browser` | Passed: 8/8 |
| `npm run test:workflow` | Passed: 2/2 |

The first sandboxed unit-test attempt was blocked before test execution by Windows `spawn EPERM`. The same command was rerun with subprocess permission and all 51 tests passed. This was an execution-sandbox restriction, not a repository test failure.

The browser suites cover widths 375, 390, 414, 430, 768, 1024, 1280, 1440, and 1920, with additional screenshots at 390/1280/1440 depending on the flow.

The IDE Problems panel was not directly inspectable. Command-line TypeScript, Next build TypeScript, lint, and tests are clean. This does not authorize ignoring a future IDE-only diagnostic; it should be reproduced with the workspace TypeScript version.

## H. Fake, demo, static, and unfinished implementations

### Explicit examples

- Homepage transaction preview and editable simulator use `lib/examples.ts` and do not persist.
- `/p/amaka` is an explicitly labelled illustrative Trust Profile.
- `components/home/hero-search.tsx` is an unused career/opportunity search component and is not provider discovery.

### Career experiment

- Career catalog is static.
- Pathfinder scoring is deterministic browser logic.
- Learn blueprints are static and are not lessons, submissions, or assessments.
- Opportunity records are `SAMPLE_OPPORTUNITIES`, not real vacancies or applications.

### Partial operational boundaries

- Notification intents exist, but no delivery worker, inbox, preference state, delivery attempt, or email/SMS proof exists.
- Settings do not include password reset or complete account management.
- Hosted Supabase preflight exists but has not run against a real project.

These features must remain labelled honestly. None may be reused as fake marketplace provider, service, availability, booking, or review data.

## I. Current visual and product-structure findings

The transaction core has a coherent restrained system:

- deep navy, muted teal, and warm neutral surfaces;
- interface sans, selective display serif, and monospace record metadata;
- fine separators and restrained 4–12px radii;
- low-elevation shadows;
- the Transaction Record as the strongest distinctive object;
- focus styles and reduced-motion behavior;
- tested responsive layouts.

Marketplace expansion must address these current product gaps later, not in Phase 0:

- the homepage currently leads only with agreement creation rather than service discovery;
- primary navigation gives Career Explore a top-level position but has no Find a Provider entry;
- no provider-result visual contract exists in code;
- `/p/[username]` shows trust history but not provider offerings, service areas, availability, or booking;
- the Explore layer uses a denser catalog language that should not define marketplace design;
- current geolocation policy blocks the proposed location control.

No visual changes were made in this phase.

## J. Accepted implementation order

The controlling order remains:

1. Phase 0 — baseline and ADR: completed by this report.
2. Phase 1 — activate and verify hosted Supabase staging.
3. Phase 2 — stabilize existing account/security prerequisites.
4. Phase 3 — marketplace schema, policies, and booking domain.
5. Phase 4 — unified customer/provider account roles and onboarding.
6. Phase 5 — provider services, service areas, and availability.
7. Phase 6 — provider search and discovery-led homepage.
8. Phase 7 — public profile and booking request creation.
9. Phase 8 — provider inbox and atomic transaction conversion.
10. Phase 9 — customer account and booking status experience.
11. Phase 10 — notification inbox and delivery worker.
12. Phase 11 — Trust Profile, reviews, and marketplace integrity.
13. Phase 12 — administration, moderation, abuse prevention, and operations.
14. Phase 13 — premium visual, accessibility, content, and SEO refinement.
15. Phase 14 — full staging QA and controlled-launch readiness.

Do not move hosted activation to the end. Current local mode cannot exercise the account experience that booking requires.

## K. Phase 1 change surface

Phase 1 is infrastructure activation, not marketplace feature development.

Likely repository files:

- `supabase/config.toml` if created by the official CLI and reviewed;
- `lib/db/database.generated.ts` only if real hosted generation reveals legitimate contract drift;
- `docs/supabase-setup.md` for verified staging instructions/evidence;
- a new Phase 1 evidence report;
- an appended corrective migration only if hosted validation exposes a real defect that cannot be fixed through configuration.

External/ignored configuration:

- `.env.local` with staging values, kept ignored and never printed;
- Supabase project Auth Site URL and allowed redirects;
- email confirmation/reset templates and SMTP/provider configuration;
- private Storage bucket/policies created by migrations;
- deployment environment secrets;
- CLI link state and access token outside source control.

Expected application-code changes: none unless real hosted verification exposes a specific defect. Marketplace routes, tables, and UI remain out of scope for Phase 1.

Current overlap warning: `lib/db/database.generated.ts` and `docs/supabase-setup.md` already have uncommitted changes. Phase 1 must review their staged and unstaged layers before editing. No reset, checkout, rebase, or automated overwrite is safe without explicit authorization.

## Working-tree preservation record

At Phase 0 start:

- 140 status entries existed;
- 29 were untracked;
- the tree contained staged, unstaged, and partially staged changes;
- the starting commit was recorded above;
- no branch, tag, commit, reset, checkout, stash, deletion, or source rewrite was performed.

Phase 0 adds only:

- `docs/ADR-001-MARKETPLACE-EXPANSION.md`;
- `docs/PHASE-0-MARKETPLACE-BASELINE.md`.

The previously created marketplace prompt and comparison report remain untracked user-visible planning artifacts. All unrelated existing changes were preserved.

## Nigerian state/LGA source decision

Selected import basis for the later schema phase:

- OCHA/HDX-derived Nigeria administrative boundaries, published as CC BY 4.0 and listing 37 first-level units and 774 second-level units.

Required cross-check:

- INEC official State Offices and LGA directories, which report 36 States plus FCT and 774 LGA offices.

Implementation requirements for the later import:

- retain attribution;
- record retrieval date and source checksum;
- test 37 first-level units and 774 second-level units;
- test every second-level unit has exactly one valid parent;
- reject duplicate normalized names/codes within a state;
- explicitly classify six FCT Area Councils;
- keep source coordinates or polygons out of the database unless a later geospatial requirement needs them;
- do not download or commit the dataset until the relevant schema phase is authorized.

## Phase result

```text
Phase result: PASS
Files changed: Phase 0 documentation only
Migrations added: None
Behavior implemented: None
Tests/checks passed: typecheck, lint, 51 unit/database tests, build, 8 public browser tests, 2 workflow tests
Browser routes and viewports checked: Existing public and workflow suites; 375–1920 px coverage
Known limitations/external dependencies: Hosted Supabase project, credentials, CLI, Auth email setup, and Storage verification are absent
Unrelated existing changes preserved: Yes
Gate status: PASS
Recommended next phase: Phase 1, but its entry is externally blocked until a dedicated staging Supabase project and approved secret configuration are available
```

Stop here. Phase 1 and all marketplace implementation remain unexecuted.
