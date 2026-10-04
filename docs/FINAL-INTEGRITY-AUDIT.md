# TrustLink V2 integrity audit — 20 September 2026

## Audit baseline, recorded before further changes

Scope: current app, components, services, both repositories, SQL migrations, auth/cookies, evidence routes, persisted reputation and tests. No new product scope or broad visual redesign is authorized by this audit. Experiments remain frozen.

### Actual lifecycle at the start of this audit

Creation publishes directly into `SENT` and writes `JOB_CREATED` and `JOB_SENT`. `DRAFT` is an enum value but has no creation/editing flow.

| Actor | Command | Allowed previous state | Next state / event |
|---|---|---|---|
| Client capability | Accept | SENT | ACCEPTED / JOB_ACCEPTED |
| Provider | Record payment received | ACCEPTED | PAYMENT_RECORDED / PAYMENT_RECORDED |
| Provider | Start work | PAYMENT_RECORDED, REVISION_REQUESTED | IN_PROGRESS / WORK_STARTED |
| Provider | Deliver | IN_PROGRESS | DELIVERY_SUBMITTED / DELIVERY_SUBMITTED |
| Client capability | Request revision | DELIVERY_SUBMITTED, below revision limit | REVISION_REQUESTED / REVISION_REQUESTED |
| Client capability | Approve | DELIVERY_SUBMITTED | APPROVED / DELIVERY_APPROVED |
| Provider | Complete | APPROVED | COMPLETED / JOB_COMPLETED |
| Provider | Cancel | DRAFT, SENT | CANCELLED / JOB_CANCELLED |
| Either participant | Dispute | ACCEPTED, PAYMENT_RECORDED, IN_PROGRESS, DELIVERY_SUBMITTED, REVISION_REQUESTED, APPROVED | DISPUTED / DISPUTE_OPENED |
| Other participant | Respond to dispute | DISPUTED with an OPEN dispute raised by the opposite party | DISPUTED / DISPUTE_RESPONDED |
| Admin | Resolve | DISPUTED with an open dispute | IN_PROGRESS (requires a payment record) or CANCELLED / DISPUTE_RESOLVED |
| Client capability | Review | COMPLETED | State unchanged / CLIENT_REVIEWED |
| Provider | Rotate client link | Published, non-cancelled states | State unchanged / CLIENT_LINK_REISSUED |

`JOB_VIEWED` is a label reserved for analytics, not a canonical state or an event written by page fetches. No payment-protection states are reachable. After Phase 3, `lib/domain/transactions/policy.ts` declares the actor/state/action/event mappings and `state-machine.ts` enforces them; `lib/domain/jobs.ts` only re-exports compatibility APIs. The UI projects action visibility from the policy. See `PHASE-3-CANONICAL-STATE-MACHINE.md` for subsequent changes and verification.

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
- Acceptance and every transaction command require a validated operation UUID and expected version at the Server Action boundary. A previously committed operation is a no-op, including a delivery replay after a revision cycle; reuse with a different payload, actor or reviewed version is rejected. Creation uses a stable creation UUID, and a fresh repeated acceptance cannot replace client identity. Concurrent conflicting submissions return a refresh/retry error; they do not create duplicate state transitions.
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
- Evidence retention and scheduled orphan cleanup are not implemented. Phase 16 adds uploader-authorized deletion for pending files; attached evidence remains immutable, and there is still no public portfolio-upload endpoint. Cleanup after failed metadata insertion or pending deletion is attempted, but remote deletion failure can still leave a private unreachable orphan.
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

## Subsequent Phase 3 verification — 21 September 2026

`docs/PHASE-3-CANONICAL-STATE-MACHINE.md` supersedes the lifecycle implementation details and test counts above. Phase 3 moved actor/state/action/event declarations into one policy consumed by the engine and UI, added versioned acceptance, required runtime-validated operation requests in the engine, and rechecked client capabilities on the service's fresh read. The final checks passed: strict typecheck, lint, production build, 25 Node tests, 6 public browser tests and 1 full workflow browser test. The hosted-Supabase limitations stated above remain unchanged.

## Subsequent Phase 4 verification — 21 September 2026

`docs/PHASE-4-AUTHENTICATION-ARCHITECTURE.md` supersedes the authentication implementation details and test counts above. Phase 4 added a Supabase-only account-auth provider boundary, an explicit unauthenticated local provider, bounded shared auth schemas, linked-profile session resolution, trusted `app_metadata` role mapping and a gated automated fixture. Final checks passed: strict typecheck, lint, production build, 29 Node tests, 6 public browser tests and 2 workflow browser tests. Hosted email, expiry/refresh and deployment-proxy behavior remain staging requirements.

## Subsequent Phase 5 verification — 21 September 2026

`docs/PHASE-5-USER-PROFILE-PARTICIPANTS.md` supersedes the user/profile/participant implementation details and test counts above. Phase 5 separated Auth identity, application profile, provider profile and transaction participant types; added account/guest participant association; persisted accepted client provenance as `SELF_PROVIDED`; and exposed client details only in authorized participant workspaces. Public agreement projections still exclude the participant section and client contact details. Final checks passed: strict typecheck, lint, production build, 30 Node tests, 6 public browser tests and 2 workflow browser tests. The relational `job_participants` schema remains Phase 6 work, and hosted Supabase remains unverified.

## Subsequent Phase 6 verification — 21 September 2026

`docs/PHASE-6-DATABASE-MODEL.md` supersedes the physical-schema and migration-count details above. Phase 6 added canonical `job_participants`, backfilled historical provider/client rows, removed participant contact/capability columns from `jobs`, converted fee/deadline to native PostgreSQL types, removed manual reputation counters, strengthened relational constraints/indexes, and retained single trust-event/evidence stores instead of adding duplicate or speculative tables. The private RPC projection preserves the domain aggregate. Database types are generated from all four migrations and checked before TypeScript; the Supabase service client uses that generated contract. Final checks passed: schema drift check, strict typecheck, lint, production build, 31 Node tests, 6 public browser tests and 2 workflow browser tests. No migration was applied to hosted Supabase; historical target data and `NOT VALID` constraints still require staging review.

## Subsequent Phase 7 verification — 21 September 2026

`docs/PHASE-7-DATABASE-SECURITY.md` supersedes the database authorization and migration-count details above. Phase 7 enables and forces RLS on all twelve public application tables, removes direct `anon`/`authenticated` table/view/RPC access, sets the public transaction view to security invoker, revokes permissive current/default grants, and narrows the elevated server role to required reads, evidence metadata writes and three application RPCs. Provider, guest-client and administrator access remains explicitly authorized at the Next.js server boundary before use of the elevated repository. The PostgreSQL suite enumerates the full table/function privilege matrix and verifies the deliberate public projection plus restrictive evidence Storage policy. Final checks passed: schema drift check, strict typecheck, lint, production build, 31 Node tests, 6 public browser tests and 2 workflow browser tests. No hosted Supabase project was configured or changed; real PostgREST, default ACL and Storage behavior remain staging checks.

## Subsequent Phase 8 verification — 21 September 2026

`docs/PHASE-8-TRUST-EVENT-LEDGER.md` supersedes the event-ledger details above. Phase 8 adds deterministic per-job event sequence, a shared typed vocabulary/actor contract, historical SQL/local backfill, database actor/operation/version/chronology/state validation, and an atomic commit wrapper that rejects altered, omitted, reordered or extra event history. The existing update/delete/truncate protections remain. `JOB_VIEWED` is still reserved and has no page-read writer. Final checks passed: six-migration schema drift check, strict typecheck, lint, production build, 32 Node tests, 6 public browser tests and 2 workflow browser tests. No hosted project was configured or changed; deployment-side historical validation and operational owner controls remain staging work.

## Subsequent Phase 9 verification — 21 September 2026

`docs/PHASE-9-PAYMENT-SEMANTICS.md` supersedes the payment implementation details above. Phase 9 keeps `PAYMENT_RECORDED` provider-reported and non-custodial, snapshots the agreed amount/currency, links each new payment to exactly one matching trust event, makes recorded payment evidence immutable, and labels payment verification as unavailable in authorized participant views. The inactive payment adapter still exposes no processing, authorization, custody, protection or verification capability. Final checks passed: seven-migration schema drift check, strict typecheck, lint, production build, 33 Node tests, 6 public browser tests and 2 workflow browser tests. No payment credentials were added and no hosted project was configured or changed; historical data and real PostgREST behavior remain staging checks.

## Subsequent Phase 10 verification — 22 September 2026

`docs/PHASE-10-REAL-JOB-CREATION.md` supersedes the creation implementation details above. Phase 10 restricts publication to validated provider sessions, uses one shared schema for preview and server validation, generates opaque 96-bit public IDs, and atomically persists the SENT job, immutable terms, provider/client participants and exact `JOB_CREATED`/`JOB_SENT` pair. PostgreSQL and local storage reject malformed initial aggregates, while request UUIDs keep retries idempotent. Final checks passed: eight-migration schema drift check, strict typecheck, lint, production build, 34 Node tests, 6 public browser tests and 2 workflow browser tests. No hosted project was configured or changed; historical public IDs and real PostgREST behavior remain staging checks.

## Subsequent Phase 11 verification — 22 September 2026

`docs/PHASE-11-PUBLIC-TRANSACTION-PAGE.md` supersedes the public-agreement implementation details above. Phase 11 removes the sample fallback from `/j/[publicId]`, introduces a persisted-only public transaction projection and allowlisted lifecycle-event projection, and adds the exact `Transaction Record Not Found` state for malformed, draft, or absent records. The public route and its metadata now use only service, agreement terms, provider public identity, status, and safe event data; participant contacts, capability hashes, payment details, evidence, disputes, reviews, actor IDs, and raw event metadata remain private. Final checks passed: nine-migration schema drift check, strict typecheck, lint, production build, 34 Node tests, 7 public browser tests, and 2 workflow browser tests. No hosted project was configured or changed; real PostgREST view behavior and historical-data validation remain staging checks.

## Subsequent Phase 12 implementation

`docs/PHASE-12-CLIENT-CAPABILITY.md` records the client-capability hardening. A public transaction route is not authority to act: a 256-bit randomly generated client capability is stored only as a SHA-256 hash with a 30-day expiry, stripped from the share URL fragment, and exchanged for HTTP-only cookies scoped to the matching transaction page and evidence endpoint after server validation. The requested transaction validates that hash and expiry again for each private render, action, and evidence request. Providers can append a replacement or explicit-revocation event; local and PostgreSQL persistence reject capability creation, replacement, clearing, or duplicate capability events that do not match the immutable ledger. Public views omit both capability-management events and all capability data. Dynamic verification remains to be recorded for Phase 12. No hosted project was configured or changed; real Supabase and historical-data checks remain staging requirements.

## Subsequent Phase 13 implementation

`docs/PHASE-13-CLIENT-ACCEPTANCE.md` records the persistent acceptance hardening. A client can accept only through the scoped capability after the server rereads the transaction, validates the current state, reviewed version, request ID, and self-provided confirmation. The PostgreSQL commit wrapper locks the persisted predecessor so acceptance starts only from `SENT` with an unused, unexpired capability, and measures new or replacement capability expiry against the database clock. `JOB_ACCEPTED` now carries the exact immutable agreement snapshot; PostgreSQL and local persistence reject a forged snapshot, acceptance without an active capability, a bundled multi-event transition, or edits to accepted client details. Public views retain only the allowlisted acceptance lifecycle marker and never expose the snapshot or client contact data. Dynamic verification remains to be recorded for Phases 12 and 13. No hosted project was configured or changed; real Supabase and historical-data checks remain staging requirements.

## Subsequent Phase 14 implementation

`docs/PHASE-14-PAYMENT-RECORDING.md` records the explicit provider payment action. The provider can select **Record payment received** only from `ACCEPTED`, review the immutable agreed NGN amount, and optionally submit a bounded reference and note. The server derives and validates the amount from the accepted terms, changes the state to `PAYMENT_RECORDED`, writes one immutable provider-reported payment, and appends one matching event atomically. Exact operation retries return the saved result; simultaneous duplicate requests resolve against the committed request ID and cannot create a second payment or event. The record remains `NOT_VERIFIED` and makes no processing, custody, protection, or settlement claim. Existing Phase 9 database constraints already provide the required persistence guarantees, so Phase 14 adds no migration. Dynamic verification remains to be recorded for Phases 12 through 14. No hosted project was configured or changed; real Supabase and historical-data checks remain staging requirements.

## Subsequent Phase 15 implementation

`docs/PHASE-15-WORK-DELIVERY-REVISIONS.md` records the provider/client work loop. Providers start work from a recorded payment, submit a delivery with authorized private evidence, and restart work after an allowed revision. Clients can approve the latest delivery, request an included revision, or open a dispute. Delivery, revision, approval, and dispute events now identify their exact records; local and PostgreSQL persistence enforce the predecessor state, actor, one-record delta, immutable evidence, attachment ownership, sequential revision usage, and server-side revision limit. The twelfth migration also preflights historical event cardinality and gives aggregate child records deterministic ordering. Dynamic verification remains to be recorded for Phases 12 through 15. No hosted project was configured or changed; real Supabase, Storage, and historical-data checks remain staging requirements.

## Subsequent Phase 16 implementation

`docs/PHASE-16-EVIDENCE-STORAGE.md` records the private evidence boundary. Uploads now carry a persisted delivery/dispute purpose and pending/attached state, use job-scoped generated paths and normalized non-executable download names, and receive stronger structural content checks. Same-origin, actor, transaction state, purpose, ownership, and capability checks protect mutations; authorized downloads still use 60-second signed URLs. An uploader can remove only pending evidence, while the thirteenth migration serializes attachment against deletion and makes submitted metadata immutable. Public profile/portfolio uploads remain absent and cannot reuse the private evidence bucket. Dynamic verification remains to be recorded for Phases 12 through 16. No hosted project was configured or changed; real Supabase Storage and operational retention/orphan cleanup remain staging requirements.

## Subsequent Phase 17 implementation

`docs/PHASE-17-DISPUTES.md` records the complete structured dispute path. A provider or scoped client can open a categorized claim with private evidence; only the other party can respond once, and the job remains paused while the dispute moves from open to under review. Only an administrator can resolve it to an explicit resume-work or cancel-record outcome. Response and resolution fields are linked to exact immutable ledger events, while claim identity, category, narrative, and evidence remain immutable. The UI distinguishes claims, responses, and operational resolutions and states that cancellation cannot reverse a direct payment. The fourteenth migration rejects unattributable historical response text for operator repair. Dynamic verification remains to be recorded for Phases 12 through 17. No hosted project was configured or changed; historical-data and real Supabase checks remain staging requirements.

## Subsequent Phase 18 implementation

`docs/PHASE-18-REVIEWS-TRUST-PROFILE.md` records the review and reputation boundary. Only the scoped client can submit one review after completion, and the fifteenth migration binds that immutable row to its exact `CLIENT_REVIEWED` event in both directions. The public Trust Profile derives counts, ratings, on-time delivery, repeat-client activity, completed services, and selected feedback from actual completed aggregates at read time. Empty evidence displays as dashes; agreed prices, recorded-payment totals, verified-revenue claims, and manual reputation counters remain absent. Dynamic verification remains to be recorded for Phases 12 through 18. No hosted project was configured or changed; historical-data and real Supabase checks remain staging requirements.

## Subsequent Phase 19 implementation

`docs/PHASE-19-IDEMPOTENCY-CONCURRENCY.md` records the retry and compare-and-swap contract. Acceptance now recovers a simultaneous exact commit the same way later commands do. Creation IDs reject changed immutable input, and delivery/dispute evidence validation occurs only for a new operation so an exact committed replay is not rejected after attachment. Focused coverage submits all eight required actions twice and checks simultaneous acceptance/payment, one event per operation, local competing writers, the PostgreSQL request uniqueness index, and stale-version rejection. Phase 19 adds no migration; the sequence remains fifteen. Dynamic verification remains to be recorded for Phases 12 through 19, and real deployment PostgreSQL concurrency remains a staging requirement. No hosted project was configured or changed.

## Subsequent Phase 20 implementation

`docs/PHASE-20-TRANSACTION-NOTIFICATIONS.md` records the minimal transactional-notification boundary. Acceptance, recorded payment, delivery, revision, dispute and completion events atomically create immutable recipient-role intents; all other events create none. A unique event/recipient key makes the projection retry-safe, and the sixteenth migration backfills historical supported events while rejecting forged event/kind/audience combinations. The local repository derives and validates the same projection inside its atomic writer lock. No email/SMS integration, delivery claim, preference system, read state or social notification center was added. Dynamic verification remains to be recorded for Phases 12 through 20. No hosted project was configured or changed.

`docs/PHASE-21-VALIDATION-ANALYTICS.md` records the minimal validation-analytics boundary. Prompted and unprompted repeat use remain creation-time job classifications linked to the immutable `JOB_CREATED` event; the seventeenth migration and local writer lock prevent missing, repeated or later-edited first-use classification. The administrator report counts accepted unprompted repeats as the primary customer-backed signal, distinct returning providers, unique-transaction lifecycle stages and agreement source channels. It derives those aggregates from existing records without a generic analytics table, page-view writer, tracking identifier or external SDK. Dynamic verification remains to be recorded for Phases 12 through 21. No hosted project was configured or changed.

## Phase 22 continuation — hosted Supabase activation gate

`docs/PHASE-22-HOSTED-SUPABASE.md` records the hosted activation runbook and evidence matrix. A credential-safe read-only preflight now checks the exact migration manifest, public-role denials, server-role reads, private aggregate-reader access and evidence-bucket configuration without printing values or performing writes. The workspace has no configured project URL or API keys, no Supabase CLI and no linked project, so no remote migration, Auth change, seed, hosted test or deployment claim was made. Phase 22 remains pending until a founder-created staging project passes the complete hosted evidence matrix.

## Phase 23 continuation — complete local error elimination

`docs/PHASE-23-ERROR-ELIMINATION.md` records the clean pre-polish baseline completed on 28 September 2026. The generated database contract and TypeScript compile with zero errors, ESLint reports no errors or warnings, the Next.js production build succeeds, all 51 repository tests pass, all 8 public browser tests pass and both production workflow tests pass. The route audit covers every public page and every provider/administrator route family, plus the persisted transaction, profile, dispute, evidence and capability handlers. SQL parsing, participant upsert/replay validation, command typing and the private-link fragment exchange were corrected without adding product scope. Phase 22 remains independently pending because local PGlite/Supabase-fixture evidence does not prove hosted Auth, RLS, PostgREST or Storage behavior.
