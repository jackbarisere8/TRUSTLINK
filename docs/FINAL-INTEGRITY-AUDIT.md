# TrustLink V2 integrity audit — 20 September 2026

## Audit baseline, recorded before further changes

Scope: current app, components, services, both repositories, SQL migrations, auth/cookies, evidence routes, persisted reputation and tests. No new product scope or broad visual redesign is authorized by this audit. Experiments remain frozen.

### Actual lifecycle at the start of this audit

Creation publishes directly into `SENT` and writes `JOB_CREATED` and `JOB_SENT`. `DRAFT` is an enum value but has no creation/editing flow.

| Actor | Command | Allowed previous state | Next state / event |
|---|---|---|---|
| Client capability | Accept | SENT | ACCEPTED / JOB_ACCEPTED |
| Provider | Record payment | ACCEPTED | PAYMENT_RECORDED / PAYMENT_RECORDED |
| Provider | Start work | PAYMENT_RECORDED, REVISION_REQUESTED | IN_PROGRESS / WORK_STARTED |
| Provider | Deliver | IN_PROGRESS | DELIVERY_SUBMITTED / DELIVERY_SUBMITTED |
| Client capability | Request revision | DELIVERY_SUBMITTED, below revision limit | REVISION_REQUESTED / REVISION_REQUESTED |
| Client capability | Approve | DELIVERY_SUBMITTED | APPROVED / DELIVERY_APPROVED |
| Provider | Complete | APPROVED | COMPLETED / JOB_COMPLETED |
| Provider | Cancel | DRAFT, SENT | CANCELLED / JOB_CANCELLED |
| Either participant | Dispute | ACCEPTED, PAYMENT_RECORDED, IN_PROGRESS, DELIVERY_SUBMITTED, REVISION_REQUESTED, APPROVED | DISPUTED / DISPUTE_OPENED |
| Admin | Resolve | DISPUTED with an open dispute | IN_PROGRESS (requires a payment record) or CANCELLED / DISPUTE_RESOLVED |
| Client capability | Review | COMPLETED | State unchanged / CLIENT_REVIEWED |
| Provider | Rotate client link | Published, non-cancelled states | State unchanged / CLIENT_LINK_REISSUED |

`JOB_VIEWED` is a label reserved for analytics, not a canonical state or an event written by page fetches. No payment-protection states are reachable. After the Phase 2 extraction, `lib/domain/transactions/state-machine.ts` owns transitions and `lib/domain/jobs.ts` only re-exports compatibility APIs; `lib/db/types.ts` owns the status union and UI imports it. See `PHASE-2-LOCAL-BACKEND.md` for subsequent changes and verification.

### 1. Definitely implemented and verified at baseline

- Supabase SSR email/password authentication; server `getUser()` validation; administrator role from Auth `app_metadata`. Old base64 session cookies are ignored.
- One-transaction SHA-256-hashed, 256-bit random client capabilities, 30-day expiry, rotation and HTTP-only SameSite cookies. Server Actions supply origin checking; upload POST explicitly checks Origin.
- Provider/client/admin authorization before private reads and mutations. Server-only Supabase credentials; no local-store delegation from the Supabase repository.
- PostgreSQL row lock/version check and atomic state, child records and event insertion. Original migration plus hardening migration deny anonymous/authenticated direct table and RPC access. Public pages use explicit server projections.
- Private evidence bucket, file signature/type checks, per-file size checks, attachment ownership, and 60-second signed downloads.
- Reputation based on persisted completed transactions and client reviews; empty ratings and on-time rates display a dash. Examples are separate from account data.
- Baseline test evidence: 9 domain/PostgreSQL tests passed; production build passed; TypeScript passed. Public route overflow checks passed at 375, 390, 414, 768, 1024, 1280, 1440 and 1920. Four browser tests passed; one had an ambiguous test locator matching Next's route announcer, not a product error. 430 was not yet tested.

### 2. Partial or unverified

- Hosted Supabase Auth delivery/confirmation, refresh and Storage behavior have not been exercised against a configured project. The local fixture is test infrastructure, not a production auth system.
- Repeated acceptance/payment/review are no-ops; immediate repeats of other transitions are rejected. There is no durable operation key, so an old delivery/revision/dispute request replayed after the state cycles could be treated as a new action. Creation also lacks duplicate-request protection.
- Upload limits are checked after multipart parsing unless Content-Length is present. Oversized chunked requests need a bounded stream reader.
- Uploaded-but-unsubmitted files are private but have no scheduled orphan cleanup. No evidence deletion or public portfolio-upload endpoint exists. Retention policy requires an operational decision.
- SQL tests currently cover public tables/RPCs, not interference from pre-existing broad Storage policies. Update/delete triggers do not protect against TRUNCATE.
- Legacy foreign keys and revision checks are NOT VALID for historical rows: new writes are checked; existing rows need deployment-side validation.

### 3. Contradictions

- `ARCHITECTURE.md` and `ARCHITECTURE-ESSENTIALS.md` still show VIEWED, PAYMENT_PENDING, CLIENT_REVIEW and REPUTATION_RECORDED as states. They disagree with TypeScript, SQL and the implemented lifecycle above.
- Original migration alone is permissive; the cumulative migration sequence is restrictive. Deploying only the original migration is unsafe.
- Schema retains manual reputation counters, but the current profile service ignores them. Public-job projection still carries unused zero/dash reputation fields; those are not calculated reputation.
- `RecordedPaymentAdapter.createPayment()` manufactures a payment-recorded response without persistence. It is unused, but contradicts the authoritative transaction command.
- On-time calculations compare UTC date substrings while the UI displays Nigerian dates. Boundary-time deliveries can be classified incorrectly.
- Older docs/marketing still describe mutual reviews and stronger contact verification than the current client-only review/self-provided-contact implementation.

### 4. Unsupported public claims still found

- `components/pathfinder/pathfinder-quiz.tsx`: verified apprenticeship/youth protection claim.
- `app/how-it-works/page.tsx`: mutual-rating claim.
- `components/explore/career-atlas-view.tsx`: estimated salary attributed to trade-association/job data without a documented source.
- `lib/discovery/careers.ts`: unsubstantiated demand/certification descriptions surfaced by the frozen experiment.
- `lib/opportunities/index.ts`: example descriptions promising toolkits/TrustLink contracts and claiming official/certified placements. Example labeling does not justify those promises.
- No `verifiedRevenue`/`Verified Revenue` concept was found. `verified: false`, `NOT_VERIFIED`, negative disclosures, security-cookie options and reserved future capability types are not unsupported public claims.

### 5. Remaining security concerns and exact repair files

| Finding | Files requiring changes |
|---|---|
| Durable replay/creation duplicate protection | lib/domain/jobs.ts; app/actions/jobs.ts; lib/db/types.ts; lib/db/repository.ts; lib/db/local-store.ts; lib/db/supabase.ts; components/jobs/job-actions.tsx; components/jobs/create-job-form.tsx; job page/workspace version props; new SQL migration |
| Ledger privileges/TRUNCATE and Storage default-deny fence | new SQL migration; tests/database.test.ts |
| Bounded upload parsing and file validation tests | lib/storage.ts; app/api/evidence/[jobId]/route.ts; tests |
| Correct Nigerian deadline calculation | lib/reputation/index.ts; extracted calculation tests |
| Unpersisted payment adapter response | lib/payments/index.ts; lib/payments/types.ts; tests/domain.test.ts |
| Documentation and unsupported claims | ARCHITECTURE.md; ARCHITECTURE-ESSENTIALS.md; docs/supabase-setup.md; .env.example; public-copy files listed above |

### 6. Visual assessment, without further redesign

The record, dashboard rows and Trust Profile now use a consistent restrained structure. Secondary marketing pages still repeat bordered panels, small labels and comparison blocks. Frozen career/learning screens retain denser card grids and colored category tags. No further broad visual changes will be made before the integrity repairs and tests are complete.

## Verification status at baseline

Targeted repairs and reruns were pending when this baseline was recorded. The final findings and verification below supersede that status.

## Repairs and final findings - 21 September 2026

This section supersedes the baseline findings above; the baseline remains as the requested record of the state before repairs. No broad visual redesign or experimental feature expansion was performed during this audit.

### 1. Definitely implemented

- The transition matrix above remains the actual lifecycle. Approval and completion are separate persisted steps. Database commits combine compare-and-swap version checking, row locking, child records and ledger appends; a commit without a new event rolls back.
- Every transaction command requires a validated operation UUID and expected version at the Server Action boundary. A previously committed operation is a no-op, including a delivery replay after a revision cycle; reuse with a different payload or actor is rejected. Creation uses a stable creation UUID, and repeated acceptance cannot replace client identity. Concurrent conflicting submissions may return a refresh/retry error; they do not create duplicate state transitions.
- Ledger update/delete/truncate protection, request-ID uniqueness, supported event types and job association checks are enforced in PostgreSQL. Actor identity and event timestamps are assigned by server code. Event metadata is immutable. The event count is read under the job lock.
- Anonymous/authenticated database roles have no direct private table/view/RPC access. All eleven application tables are covered by denial tests. App authorization uses Supabase-validated sessions or the transaction capability before returning private projections. A restrictive Storage policy also defeats unrelated permissive legacy policies for the evidence bucket.
- Client capabilities expire, rotate and remain scoped to one transaction. Production cookies are HTTP-only, Secure and SameSite=Lax. No browser-submitted provider/admin/client identity controls authorization. Next Server Actions enforce origin checks; upload POST compares the browser Origin to the external Host using the request protocol, avoiding Next's internal-host mismatch.
- Opening a replacement participant link on an already-open transaction now handles the fragment change and exchanges the new token; the original mount-only handler missed this case.
- Evidence uses private storage, bounded request-body reads, file signature/type checks, attachment ownership and 60-second signed downloads. Public agreement output excludes client contact details, capability hashes, private file paths and private event metadata.
- Payment processing is unavailable. The unused payment adapter now refuses creation rather than inventing success; verification always returns NOT_VERIFIED. The authorized payment command records a provider report only.
- Reputation derives from persisted completed records and reviews. Deadline comparison uses Nigerian local dates. Empty ratings/on-time percentages stay empty; unused public-projection metric placeholders and the real-profile sample-profession fallback were removed.
- Login/signup now recover from interrupted requests with an error and an enabled retry button. The frozen experiments remain separately labeled examples/editorial pilots.

### 2. Partially implemented or externally unverified

- Hosted Supabase email delivery, confirmation, refresh, logout, PostgREST and Storage still need staging verification. The browser workflow uses a production Next server and real PostgreSQL through PGlite, but substitutes Supabase HTTP services with an explicitly test-only fixture. This is not proof of a deployed Supabase configuration.
- Apply all three migrations. Historical NOT VALID foreign-key/revision/event constraints still need data review and validation in the target project. No migration was applied to a hosted database in this task.
- DRAFT has no editor; JOB_VIEWED has no analytics writer. Magic-link login and password recovery are absent. These are disclosed limitations, not features added to this audit.
- Evidence retention and scheduled orphan cleanup are not implemented. There is no evidence-delete endpoint or public portfolio-upload endpoint. Cleanup after failed metadata insertion is attempted, but remote deletion failure can still leave a private orphan.
- If a creation/link-rotation response is lost, plaintext capabilities cannot be recovered from hashes. Open the existing workspace and replace the link. Existing signed download URLs remain usable until their short expiration after capability rotation.

### 3. Architecture/schema/types/UI alignment

The architecture guides now document the implemented states, actors, fields and payment behavior. TypeScript and SQL use the same canonical status vocabulary. Historical planning tables in ARCHITECTURE.md are explicitly identified as proposals. The original migration alone is permissive; authorization depends on the cumulative sequence. Legacy manual reputation columns and reserved identity-verification values remain in the schema/types but do not drive displayed Trust Profile metrics or badges. These compatibility fields must not be presented as independently verified data.

### 4. Remaining unsupported claims

No positive payment-protection, independently verified revenue, guaranteed-placement or certified-provider claim remains in the audited public copy. Removed claims included mutual ratings, verified youth/apprenticeship protection, unsupported salary-source attribution, hypothetical toolkit/contracts/official placements, and total certainty. Remaining matching terms are negative disclosures, explicitly unverified editorial references, inactive capability types, cookie settings or ordinary physical-installation descriptions. This assessment covers source-controlled copy; future user-entered descriptions are self-provided claims.

### 5. Remaining security concerns

- Service-role credentials and database owners are privileged operators. Authorization relies on the server boundary; the ledger is append-only for application roles, not tamper-proof against a database owner.
- Capability holders can act as the client, and client name/email are self-provided. Share private links only with the intended client; contact collection is not identity verification.
- File signatures are not malware scanning. Per-file/body limits exist; total per-account storage quotas and upload-rate controls do not. Retention, abuse controls and operational administrator assignment need deployment decisions before a public launch.
- Deploy behind HTTPS with correct external Host/protocol forwarding. Validate real Auth and Storage, historical constraints and backup/retention procedures in staging. No production-readiness claim is made here.

### 6. Remaining visual patterns

The Transaction Record remains the primary visual object. Core pages use restrained borders, typography and rows; secondary marketing pages still repeat panels and small labels, and frozen experiments still use denser card grids/category tags. Those are optional future polish, not integrity blockers. Mobile and desktop screenshots of the homepage, record and profile are generated by the browser suite in test-results/. The mobile record was visually inspected for readable hierarchy, disclosures and overflow.

### 7. Exact repair files

- Lifecycle/retries/capabilities: `lib/domain/jobs.ts`, `app/actions/jobs.ts`, `lib/db/types.ts`, `lib/db/local-store.ts`, `components/jobs/create-job-form.tsx`, `components/jobs/job-actions.tsx`, `components/jobs/client-link.tsx`, `components/jobs/job-workspace-view.tsx`, `app/j/[publicId]/page.tsx`.
- Database: `supabase/migrations/20260920000001_final_audit.sql` (applied after the original migration and `20260920000000_integrity.sql`).
- Evidence: `lib/evidence-validation.ts`, `lib/storage.ts`, `app/api/evidence/[jobId]/route.ts`.
- Payment/reputation/projections: `lib/payments/index.ts`, `lib/reputation/calculate.ts`, `lib/reputation/index.ts`, `lib/jobs/index.ts`, `lib/examples.ts`, `app/dashboard/jobs/new/page.tsx`, `app/p/[username]/page.tsx`.
- Truthful copy and recoverable auth: `app/login/page.tsx`, `app/signup/page.tsx`, `app/how-it-works/page.tsx`, `app/for-businesses/page.tsx`, `app/privacy/page.tsx`, `components/pathfinder/pathfinder-quiz.tsx`, `components/explore/career-atlas-view.tsx`, `lib/discovery/careers.ts`, `lib/opportunities/index.ts`.
- Documentation/configuration: `ARCHITECTURE.md`, `ARCHITECTURE-ESSENTIALS.md`, `.env.example`, `docs/supabase-setup.md`, this report, `.gitignore`, `eslint.config.mjs`, `package.json`, `package-lock.json`.
- Verification: `tests/domain.test.ts`, `tests/database.test.ts`, `tests/evidence-reputation.test.ts`, `tests/local-store.test.ts`, `tests/browser/public.spec.ts`, `tests/browser/workflow.spec.ts`, `tests/support/supabase-fixture.mts`, `playwright.config.ts`, `playwright.workflow.config.ts`.

No further visual files require changes to resolve this audit. Remaining deployment work belongs to the configured Supabase/hosting environment and the operational decisions above.

## Final verification results

Verified locally on 21 September 2026:

| Check | Result | Evidence / scope |
|---|---|---|
| `npm run build` | Passed | Production Next build, including TypeScript and route generation |
| `npm run lint` | Passed | No errors or warnings |
| `npm test` | 16 passed | Canonical lifecycle, role/capability rejection, immediate and delayed retries, all private table read denials, SQL rollback/ledger immutability, local-store corruption/CAS, bounded uploads, CSRF and reputation boundary dates |
| `npm run test:browser` | 6 passed | 14 public routes with successful responses and no page errors/overflow; simulator; mobile navigation/dialog keyboard behavior; forged legacy-cookie rejection; missing-auth and interrupted-network states; screenshots |
| `npm run test:workflow` | 1 passed | Production Next + Supabase adapter + test-only Auth/Storage/PostgREST fixture backed by real PostgreSQL/PGlite: provider creates, client accepts, provider records receipt/starts/delivers/uploads, authorized signed download, other-provider and cross-origin rejection, revision, dispute, admin resolution, approval, completion, persisted rating, rotated-link exchange on the same page, modified-cookie rejection |
| Responsive widths | All requested widths passed | 375, 390, 414, 430, 768, 1024, 1280, 1440, 1920 across public routes and authenticated dashboard/create/workspace surfaces |

Browser verification discovered and drove two actual fixes: uploads rejected a valid external origin because Next used an internal URL hostname, and an already-open transaction ignored a replacement invite fragment. Both pass in the final production workflow. Test-only failures from shared artifact directories, navigation timing, required-label matching and loopback API cookie behavior were corrected without weakening authorization assertions. Public route checks now explicitly reject 404 responses.

The local source audit and targeted repairs are complete. Hosted deployment validation, historical data validation and operational evidence retention/abuse controls remain as stated above. No new product features or further broad visual redesign were added.
