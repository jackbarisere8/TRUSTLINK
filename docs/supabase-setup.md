# Supabase setup

Use separate development, staging and production projects. Populate `.env.local` or hosting environment variables from `.env.example`; never commit credentials or paste them into chat. Set `TRUSTLINK_STORAGE=supabase`. For a new project, place Supabase's current publishable and secret keys in the compatibility-named `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` variables. The secret key must remain server-only. Local JSON mode has no replacement authentication and is refused in production.

Phase 22's exact activation order, read-only preflight and required hosted evidence are recorded in `docs/PHASE-22-HOSTED-SUPABASE.md`. The phase remains incomplete until those checks run against a real staging project.

## Migrations

Apply the complete version-controlled sequence:

1. `20260917000000_v0_core.sql`
2. `20260920000000_integrity.sql`
3. `20260920000001_final_audit.sql`
4. `20260921000000_database_model.sql`
5. `20260921000001_database_security.sql`
6. `20260921000002_trust_event_ledger.sql`
7. `20260921000003_payment_semantics.sql`
8. `20260922000000_real_job_creation.sql`
9. `20260922000001_public_transaction_projection.sql`
10. `20260922000002_secure_client_capabilities.sql`
11. `20260922000003_client_acceptance.sql`
12. `20260924000000_work_delivery_revisions.sql`
13. `20260924000001_evidence_storage.sql`
14. `20260926000000_disputes.sql`
15. `20260926000001_reviews_trust_profile.sql`
16. `20260927000000_transaction_notifications.sql`
17. `20260927000001_validation_analytics.sql`

The original migration alone has permissive policies and must not serve this app. Back up existing project data before applying upgrades. Phase 6 validates historical fee/deadline shapes, requires every job to map to an Auth-linked provider profile, backfills provider/client participant rows, and then removes the former client contact/capability columns from `jobs`. Phase 7 forces RLS, removes direct browser-role access, makes the public projection view security invoker and narrows the elevated server grants. Phase 8 backfills deterministic event sequence numbers and installs the ledger constraints/wrapper. Phase 9 backfills recorded amount/currency from immutable terms, restricts payment rows to provider declarations, links each new row to its payment event and makes recorded evidence immutable. Phase 10 requires every existing public ID to use the 24-character opaque format and makes the commit RPC reject malformed initial aggregates before any row is written. Phase 11 replaces the public agreement view with only rendered agreement/provider fields, adds an independently redacted public-event view, and excludes DRAFT records. Phase 12 permits an explicitly revoked client capability to be absent as a pair and requires every initial, replacement, or revocation capability change to match its immutable ledger event. Phase 13 requires every new client acceptance to snapshot the immutable reviewed terms, identify details as self-provided, and update the participant only through a matching active-capability `JOB_ACCEPTED` transition. Phase 15 enforces work/delivery predecessor states, exact delivery/revision/dispute event links, authorized attachment ownership, immutable evidence, and the included revision limit. Phase 16 purpose-binds private uploads, marks submitted evidence atomically, authorizes pending deletion, and protects attached metadata. Phase 17 permits one response from the non-raising party, keeps the job paused, and links response and administrator resolution fields to exact immutable events. Phase 18 links each post-completion client review to its exact ledger event, makes the submitted review immutable, and derives public Trust Profile evidence without stored counters or payment totals. Repair inconsistent historical rows before retrying a failed migration; do not bypass its preflight checks. Historical foreign-key and event constraints marked NOT VALID still need inspection and explicit validation in the target project.

## Generated database types

`lib/db/database.generated.ts` is generated from all seventeen migrations through an isolated PGlite database:

```powershell
npm run db:types
npm run db:types:check
```

Commit the generated file with its migration. `npm run typecheck` runs the drift check before TypeScript. The Supabase service client uses this generated contract for tables and RPCs. Domain records remain separate projections because `tl_read_job` intentionally assembles a transaction aggregate from multiple physical tables.

## Authentication

The implemented flow enters through `lib/auth/contracts.ts` and delegates to Supabase email/password Auth, with server-side `getUser()` validation, linked-profile resolution and SSR session refresh. Local storage selects an unconfigured provider that cannot authenticate. There is no second password/session system or fake dashboard login. Enable email confirmation, configure the application Site URL, and use this confirmation template URL:

`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`

Set the Site URL to the actual HTTPS deployment. Test signup, email confirmation, rejected credentials, login, expiration/refresh, refresh-token rotation and logout in staging. Magic-link login, password recovery, MFA and social login are not implemented. Administrator access comes only from Auth `app_metadata.role = ADMIN`, assigned through trusted operator tooling; user-editable metadata cannot grant it. Confirm that each Auth user is linked to the intended `profiles.user_id`; missing or mismatched profiles fail closed.

Clients receive a transaction-specific capability instead of an account. Each capability has 256 bits of cryptographic randomness; only its SHA-256 hash and expiry are persisted. The URL fragment is stripped before a Server Action exchanges it for HTTP-only, `SameSite=Lax` cookies scoped to that transaction page and its evidence endpoint; both require HTTPS in production. Capabilities expire after 30 days, can be replaced, and can be explicitly revoked by the provider. Every private request resolves the requested transaction and validates its stored hash and expiry before authorizing the client.

Participant contact data and guest capability hashes are stored in `job_participants`, not `jobs`. Each job has one provider row and one client-participant row. The client row may have no account `user_id`; acceptance preserves that association and changes its provenance from `UNKNOWN` to `SELF_PROVIDED` only through a valid client capability and matching `JOB_ACCEPTED` event. The immutable event records the exact reviewed agreement terms. This does not establish verified identity.

## Authorization and ledger

Anonymous and authenticated database roles cannot directly read or mutate application tables, query either service-only projection view, or call privileged RPCs. All thirteen public application tables have RLS enabled and forced; the browser roles have no policies or object grants. Server-only elevated operations first authorize the authenticated actor or client capability in the application. Providers are restricted to their own profile/jobs, clients to their scoped transaction, and administrators to explicit trusted-metadata flows at that boundary. The anonymous `/j/[publicId]` path reads only `public_job_records` and `public_transaction_events`; it never calls the private aggregate RPC or reads notification intents. Never expose service credentials to browser code or bypass the application authorization layer. See `docs/PHASE-7-DATABASE-SECURITY.md` and `docs/PHASE-11-PUBLIC-TRANSACTION-PAGE.md`.

The public commit RPC checks the job version and exact persisted event prefix, then delegates to its private atomic persistence function. Creation requires a canonical SENT/version-zero job, immutable initial terms, empty evidence collections, an unused capability whose expiry is after the database clock, and exact `JOB_CREATED`/`JOB_SENT` provider events. The same transaction creates one provider and one client-participant relationship. Each later commit requires exactly one new, correctly sequenced event with matching actor, state, request ID, command hash and reviewed version. Phase 13 also locks the persisted predecessor before an acceptance, requiring `SENT`, an unused unexpired capability, and supplied details before private state changes. The capability trigger measures newly issued and replacement capability expiry against the database clock and requires creation, replacement, or clearing to match its ledger event. The Phase 13 triggers require a `JOB_ACCEPTED` event to carry the exact immutable terms snapshot and make the accepted client details immutable. Phase 15 locks the same predecessor before work/delivery mutations, validates the actor and state edge, permits exactly one matching evidence delta, checks attachment ownership, and links the resulting row to its event. Phase 16 additionally locks purpose-bound pending evidence and marks it attached in the same transaction. Phase 17 locks the active dispute, authorizes the non-raising party response or administrator resolution, and binds each mutable dispute field to its immutable event. Phase 18 locks the completed job, admits one client review, requires its exact review ID and rating in the matching event, and makes review rows immutable. Event insert failure rolls back state, child writes, attachment state, dispute changes, and reviews. Update/delete/truncate remain denied for submitted evidence, dispute claims, and reviews. Database owners remain trusted operators who can alter privileges; the ledger is not cryptographic proof against an owner. See `docs/PHASE-8-TRUST-EVENT-LEDGER.md`, `docs/PHASE-10-REAL-JOB-CREATION.md`, `docs/PHASE-12-CLIENT-CAPABILITY.md`, `docs/PHASE-13-CLIENT-ACCEPTANCE.md`, `docs/PHASE-15-WORK-DELIVERY-REVISIONS.md`, `docs/PHASE-16-EVIDENCE-STORAGE.md`, `docs/PHASE-17-DISPUTES.md`, and `docs/PHASE-18-REVIEWS-TRUST-PROFILE.md`.

Phase 19 adds no migration. Application requests retain one UUID for the same submitted payload and reviewed version. If an exact acceptance or command loses the version race, the service rereads the persisted aggregate and succeeds only when the request ID, actor, normalized command hash, and expected version match its immutable event. Changed reuse remains an error. Delivery/dispute pending-evidence checks run only for a new operation, while PostgreSQL still attaches evidence inside the same atomic commit. See `docs/PHASE-19-IDEMPOTENCY-CONCURRENCY.md`.

Phase 20 creates immutable `notification_intents` from selected trust-event inserts in the same database transaction. The unique event/recipient-role key prevents duplicates, the trigger validates the exact event/kind/audience mapping, and historical supported events are backfilled. The table records intent only: no message address, channel delivery, provider response, preference or read state is stored. No email/SMS provider or environment variable is configured. See `docs/PHASE-20-TRANSACTION-NOTIFICATIONS.md`.

Phase 21 adds no analytics table. Its migration requires the earliest persisted transaction to be each provider's only immutable `FIRST` classification and requires later transactions to retain their creation-time `PROMPTED` or `UNPROMPTED` value. The administrator report derives aggregate validation signals from `jobs` and `trust_events`; it does not write page-view events or configure an external analytics provider. See `docs/PHASE-21-VALIDATION-ANALYTICS.md`.

## Evidence

Migrations create the private `transaction-evidence` bucket and purpose-bound evidence metadata. A restrictive Storage policy prevents broad older anonymous/authenticated policies from exposing this bucket. Server uploads validate authorization, bounded body size, structural signatures, normalized filenames, safe generated paths, purpose, and current action; downloads authorize the transaction and issue 60-second signed access. Only PDF, JPEG, PNG, WebP and plain text are accepted, up to 10 MiB per file.

Pending uploads can be removed only by their uploader through the same transaction-scoped route. Submission atomically marks referenced metadata attached; attached delivery or dispute evidence cannot be updated, deleted, or reused for the other purpose. Failed metadata insertion triggers immediate object cleanup. A failed Storage deletion after metadata removal can still leave a private, unreachable object, and abandoned pending uploads still need scheduled cleanup. Define retention and orphan cleanup operationally before launch. Signature validation is not malware scanning. Public profile/portfolio uploads are not implemented and must never reuse the private evidence bucket.

## Validation and boundaries

`npm test` exercises the domain, auth boundary and real PostgreSQL through PGlite. `npm run test:workflow` exercises the production Next server and Supabase adapter against a test-only HTTP fixture backed by that database. The fixture requires `TRUSTLINK_TEST_FIXTURE=1` in a non-production fixture process; the application server has no fixture-auth mode. It substitutes Auth/Storage/PostgREST services and does not validate hosted Supabase behavior. Run staging checks against real Auth, PostgREST and Storage before claiming deployment readiness.

No payment provider configuration is needed. `PAYMENT_RECORDED` snapshots the agreed transaction value and means the provider reports direct receipt; TrustLink does not verify, process, authorize, settle, hold or protect funds. The Phase 14 provider action derives the amount from immutable terms and uses the existing atomic payment/event constraints, so it adds no migration. See `docs/PHASE-9-PAYMENT-SEMANTICS.md` and `docs/PHASE-14-PAYMENT-RECORDING.md`.
