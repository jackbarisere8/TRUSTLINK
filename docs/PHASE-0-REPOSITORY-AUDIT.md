# TrustLink: Phase 0 audit and Phase 1 repository cleanup

Date: 21 September 2026. The pasted Version 2 brief is the current request. Its section 48 explicitly requires the A-K audit followed by **Phase 1 only**. The Downloads document is supporting reference, not separate authorization to execute the whole roadmap.

The pre-edit A-K report was delivered before modifying files. This document preserves the findings and records the bounded cleanup. See `FINAL-INTEGRITY-AUDIT.md` for the earlier source/security review and local workflow evidence.

## A. Repository structure

- `app/`: 26 page routes, root/error/loading/not-found boundaries, metadata and icons. Public marketing/legal pages; example/real `/j/[publicId]` and `/p/[username]`; protected dashboard and administrator pages; transaction dispute page; four frozen experiments.
- `app/actions/{auth,jobs,profile}.ts`: authenticated server mutation boundaries.
- `app/api/evidence/[jobId]/route.ts`, `app/auth/confirm/route.ts`: evidence access and Supabase email confirmation.
- `components/`: shared UI, navigation, branding, homepage, transaction records/actions, profile/admin views and frozen pilot screens.
- `lib/domain/jobs.ts`: canonical aggregate transitions, actor rules, capabilities and operation keys. `lib/domain/errors.ts`: safe domain errors.
- `lib/db/`: repository contract, local adapter, independent Supabase adapter, selection/configuration and handwritten domain record types.
- `lib/auth/`, `proxy.ts`: Supabase SSR session resolution/refresh. `instrumentation.ts`: production configuration guard.
- `lib/validation/`, `lib/storage.ts`, `lib/evidence-validation.ts`: input and private attachment boundaries.
- `lib/payments/`, `lib/trust-events/`, `lib/reputation/`: payment capability boundary, event labels, persisted profile calculations. Dispute behavior is implemented in the aggregate; the separate `lib/disputes/index.ts` only documents that location.
- `supabase/migrations/`: original schema plus two ordered integrity upgrades.
- `tests/`: domain, PGlite database, evidence/reputation and local-store tests; public/browser workflow suites and an explicitly test-only Supabase HTTP fixture.
- `tailwind.config.ts`, `app/globals.css`, `components/ui/`: design tokens, base styles and shared controls.
- `docs/` and root Markdown: current architecture/audits plus historical plans and research. Historical review ZIPs are under `docs/source-archives/`, never public assets.
- `data/trustlink-dev.json`: legacy fixture, not imported by the current adapters. `data/trustlink-local-v3.json` is the active local adapter's development-only path and need not exist until used.
- `.env.example`: blank credential template. No `.env.local` or hosted project is configured. No `.git` repository exists here, so committed-history/secret verification cannot be claimed.

There is one canonical unpacked source tree. The two old ZIPs contain 280 and 310 entries with duplicated flattened/nested paths; they are historical snapshots, not implementation inputs. Logo PNGs and SVG/application icons are intentional assets and were preserved. `empty.md` is explicitly a founder scratch document and was preserved; empty helper directories are not exported.

## B. Backend status

REAL: durable JSON local repository with atomic replacement, locking and compare-and-swap; independent Supabase RPC/table adapter; pure aggregate domain service. A restart does not replace data with examples. Corruption fails rather than reseeding. Production refuses local mode or incomplete Supabase configuration; there is no production fallback.

Partial: local mode defaults when storage configuration is absent in development. A separate `TRUSTLINK_AUTH` selector is not implemented. Local storage alone does not provide login or private file uploads. The requested later domain-directory breakdown does not exist; working rules are consolidated in `lib/domain/jobs.ts` rather than duplicated across folders. No restructuring was performed in Phase 1.

## C. Authentication status

Supabase SSR email/password, server `getUser()`, Auth-backed profiles and trusted `app_metadata` administrator roles are implemented. They remain unconfigured until a real project exists. Guest clients use transaction capabilities. There is no second production password/session system or fake redirect login.

The fixture in `tests/support/supabase-fixture.mts` simulates Auth/Storage/PostgREST for automated tests only. Its nonfunctional keys are not hosted credentials and are not written to `.env` files. Signup/email delivery, refresh, logout and actual hosted policies remain externally unvalidated. Password recovery and magic-link login are absent.

## D. Database and evidence status

Three migrations define the actual tables: profiles, provider_profiles, jobs, job_terms, payments, deliveries, revisions, disputes, reviews, trust_events and evidence_files. Guest participant details live on the transaction, with SELF_PROVIDED acceptance attribution. Disputes and file metadata use existing aggregate/evidence tables; there are no invented notifications, audit_logs or duplicate job_events tables.

Local PGlite tests cover migration execution, raw-table access denial, privileged RPC access, rollback, conflicts and ledger immutability. Storage signatures, MIME/type and body limits, authorized downloads, origin checks and private paths are implemented. Hosted Supabase is neither created nor tested. Generated schema types, historical NOT VALID constraint validation, retention/orphan cleanup, quotas and abuse controls remain later work. Disputes lack a separate other-party response flow; the minimal notifications module is empty. No such features were added during cleanup.

## E. Current state machine

`SENT -> ACCEPTED -> PAYMENT_RECORDED -> IN_PROGRESS -> DELIVERY_SUBMITTED -> APPROVED -> COMPLETED`.

Client revision: `DELIVERY_SUBMITTED -> REVISION_REQUESTED -> IN_PROGRESS`, within the included limit. Eligible active states may enter DISPUTED; an administrator can cancel or resume work when payment has been recorded. Providers may cancel an unaccepted record. Review and link rotation append events without advancing status. DRAFT is reserved with no editor. JOB_VIEWED is not a status and is not written by public GET requests.

The exact actor/state/command matrix is in `FINAL-INTEGRITY-AUDIT.md`. No alternate machine was introduced.

## F. Security status

Implemented and locally tested: server actor/ownership checks, deliberate public projections, scoped expiring hashed guest tokens, rotation, HTTP-only production Secure cookies, CSRF checks, optimistic versions, durable command IDs, atomic state/event writes and immutable ledger history. Database public roles cannot directly read private tables; application service-role calls authorize before exposing data.

Remaining limits: privileged operators can change database privileges; client contact details are self-provided; a capability holder can act as the client; file signature checks are not malware scans; issued download links last up to 60 seconds. Hosted Auth/Storage/concurrency, operational administrator assignment and abuse/retention procedures still need deployment validation.

## G. Compiler, lint, build and editor findings

Fresh pre-edit checks on this turn:

- `npm run typecheck`: passed, zero configured TypeScript errors.
- `npm run lint`: passed, zero errors/warnings.
- `npm run build`: passed, including route generation and TypeScript.
- No TypeScript `any` type annotations or ts-ignore/ts-expect-error/eslint-disable directives were found in application/test source. Natural-language uses of the word "any" are not type suppressions.
- `tsconfig.json` currently sets `strict: false`. The pass is for that configuration; enabling strict mode is not claimed and is deferred to the error-elimination phase.
- The IDE Problems panel is not accessible through this workspace. Workspace TypeScript selection was configured in Phase 1, but unseen red underlines are not declared stale or fixed. Next's installed documentation instructs VS Code to use the workspace TypeScript version.

A separate scan resolved 2,918 static JSX class tokens against the installed Tailwind configuration. Manual review found these genuine missing utilities, deferred to the next error-elimination phase:

| File | Unsupported utilities |
|---|---|
| `app/error.tsx` | `text-danger-DEFAULT` |
| `app/for-providers/page.tsx` | `border-danger-DEFAULT` |
| `components/ui/input.tsx` | `text-danger-DEFAULT` twice, `border-danger-DEFAULT`, `focus:ring-danger-DEFAULT` |
| `components/explore/career-atlas-view.tsx` | `scrollbar-thin` |
| `components/learn/learn-view.tsx` | `scrollbar-thin` |

Tailwind DEFAULT colors use `text-danger`, `border-danger`, `ring-danger`, not a literal `-DEFAULT` suffix. No scrollbar plugin/custom definition provides `scrollbar-thin`. These are real styling gaps despite passing compiler checks. The scan also encountered condition values (such as status names), which are not class tokens, and `transaction-record`, an intentional markup hook rather than a styling utility. Dynamically constructed class strings were not exhaustively validated by this static scan.

## H. Unfinished/example marker classification

`implementation-marker-inventory.csv` gives every matching text line in the scanned canonical app, components, libraries, tests, SQL, documentation and legacy data a classification. It records paths, line numbers and matched terms, not record values. Dependencies, generated output, lockfile contents and archived ZIP contents are not application implementation; ZIP manifests were inspected separately.

| Classification | Findings |
|---|---|
| REAL | Form placeholders/CSS placeholder utilities, negative escrow/payment disclosures, explanatory code comments, current documentation and historical proposals explicitly treated as documents |
| DEV-ONLY | Synthetic users/keys, base64 fixture tokens, timeout configuration, tampering/replay assertions and the automated HTTP fixture |
| DEMO-ONLY | Labeled example transaction/profile, unsaved homepage simulator, hypothetical conversations, frozen editorial/opportunity data, legacy unused local fixture |
| REPLACE | `lib/notifications/index.ts` is an unused empty stub; later work must either implement the minimum event-driven boundary or remove it |
| REMOVE from source handoff | Build/dependency/test artifacts, old review ZIPs, local data and private environment files; existing local history is preserved outside the export |
| UNSUPPORTED | No positive independently verified-payment/protected-funds implementation was found. Missing CSS utilities and unimplemented roadmap modules are recorded above, not described as working features |

The empty `lib/disputes/index.ts` and compatibility re-export `components/disputes/dispute-detail-view.tsx` are not alternate dispute engines. `components/home/hero-search.tsx` is unreferenced legacy pilot UI, not a live homepage feature. No real transaction route falls back to a sample record when its ID is missing.

## I. Premium visual problems

The shared Transaction Record provides a consistent core. Secondary marketing pages still repeat bordered panels/centered copy; pilot screens retain denser card grids and category tags; global typography favors Arial while Tailwind lists Inter/system fonts. Status and input styling have the missing utility references above. These are documented for a later refinement phase. No visual components or design tokens changed in Phase 1.

## J. Exact implementation order

1. Completed: inspect inventory, classify markers, check current compiler/lint/build and report A-K before edits.
2. This turn only: canonical-source cleanup, source-export exclusions, instruction alignment and workspace SDK configuration; verify the export contents.
3. Later authorized phase: fix known CSS utilities, investigate IDE-specific diagnostics and strict typing/configuration, then address local/auth boundaries and domain gaps without duplicating working code.
4. Later phases: schema/type alignment, dispute/notification minimums, storage and lifecycle/security tests.
5. Hosted connection only after the founder creates a project and supplies configuration through the environment.
6. Security hardening, then premium refinement and final accessibility/responsive QA.

This order preserves implemented work. Passing local checks does not activate the hosted phase.

## K. Phase 1 changes

- `.gitignore`: exclude exports, legacy JSON, archived source ZIPs and private environment variants; preserve `.env.example`.
- `CLAUDE.md`: reference both `AGENTS.md` and `AGENT.md`, current audits and the current request's precedence.
- `.vscode/settings.json`: point the editor at the installed workspace TypeScript; no warning suppression.
- `docs/agent-start.md`: replace stale "live workflow" language with actual configured/unconfigured status, canonical paths and source handoff instructions.
- `docs/source-archives/README.md`: mark old duplicate exports as historical/noncanonical.
- `scripts/Export-Source.ps1`: export only canonical code/config/assets/docs/tests with preserved paths and lockfile, excluding generated/private/local/archive contents.
- This report and `docs/implementation-marker-inventory.csv`: persist the audit and classified search evidence.

No application behavior, database schema, authentication, payment functionality or frozen-experiment business logic was changed. Existing generated files remain usable locally but are excluded from the source package. Existing historical ZIPs and local data were not destroyed.

## Phase 1 verification

The source-export script ran successfully. Its ZIP contains 165 unique paths, all 26 page routes, all eight public PNG/SVG assets, the lockfile, migrations, tests and the blank environment template. Every exported file matched the SHA-256 hash of its canonical source. No private environment files, local data, generated output, dependencies, traces, credential-key files or nested archives were included. No ZIP remains under `public/`.

The classified search inventory contains 212 matching lines: 142 REAL documentation/implementation references, 37 DEMO-ONLY, 32 DEV-ONLY and one REPLACE stub. Labels describe the matched text's role, not external verification of its claims.

The fresh production build passed before cleanup. No application or build configuration was changed afterward. Post-cleanup TypeScript and lint checks both passed with zero errors; lint reported no warnings. Full domain/browser suites were not repeated for documentation, editor SDK selection and packaging-only changes; their previous evidence remains in the final integrity audit.

Phase 1 does not resolve the eight missing Tailwind utility occurrences, enable strict typing, activate hosted services or authorize a redesign. Those remain explicit findings for the next requested phase.

## Subsequent Phase 2 work

The user subsequently authorized the local backend foundation. `docs/PHASE-2-LOCAL-BACKEND.md` records the current implementation and checks. It supersedes the outstanding strict-mode and eight CSS utility findings above: strict mode is now enabled, literal `danger-DEFAULT` references are corrected, and `scrollbar-thin` has a shared CSS definition. The inventory and Phase 1 ZIP are historical snapshots, not a manifest of the latest source. Hosted services remain unconfigured.
