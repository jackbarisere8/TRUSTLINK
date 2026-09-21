# Supabase setup

Use separate development, staging and production projects. Populate `.env.local` or hosting environment variables from `.env.example`; never commit credentials or paste them into chat. Set `TRUSTLINK_STORAGE=supabase`. The service-role key must remain server-only. Local JSON mode has no replacement authentication and is refused in production.

## Migrations

Apply the complete version-controlled sequence:

1. `20260917000000_v0_core.sql`
2. `20260920000000_integrity.sql`
3. `20260920000001_final_audit.sql`
4. `20260921000000_database_model.sql`

The original migration alone has permissive policies and must not serve this app. Back up existing project data before applying upgrades. Phase 6 validates historical fee/deadline shapes, requires every job to map to an Auth-linked provider profile, backfills provider/client participant rows, and then removes the former client contact/capability columns from `jobs`. Repair inconsistent historical rows before retrying a failed migration; do not bypass its preflight checks. Historical foreign-key and event constraints marked NOT VALID still need inspection and explicit validation in the target project.

## Generated database types

`lib/db/database.generated.ts` is generated from all four migrations through an isolated PGlite database:

```powershell
npm run db:types
npm run db:types:check
```

Commit the generated file with its migration. `npm run typecheck` runs the drift check before TypeScript. The Supabase service client uses this generated contract for tables and RPCs. Domain records remain separate projections because `tl_read_job` intentionally assembles a transaction aggregate from multiple physical tables.

## Authentication

The implemented flow enters through `lib/auth/contracts.ts` and delegates to Supabase email/password Auth, with server-side `getUser()` validation, linked-profile resolution and SSR session refresh. Local storage selects an unconfigured provider that cannot authenticate. There is no second password/session system or fake dashboard login. Enable email confirmation, configure the application Site URL, and use this confirmation template URL:

`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`

Set the Site URL to the actual HTTPS deployment. Test signup, email confirmation, rejected credentials, login, expiration/refresh, refresh-token rotation and logout in staging. Magic-link login, password recovery, MFA and social login are not implemented. Administrator access comes only from Auth `app_metadata.role = ADMIN`, assigned through trusted operator tooling; user-editable metadata cannot grant it. Confirm that each Auth user is linked to the intended `profiles.user_id`; missing or mismatched profiles fail closed.

Clients receive a transaction-specific capability instead of an account. The URL fragment is exchanged for an HTTP-only scoped cookie. Capabilities expire after 30 days and can be replaced by the provider. Production cookies require HTTPS.

Participant contact data and guest capability hashes are stored in `job_participants`, not `jobs`. Each job has one provider row and one client-participant row. The client row may have no account `user_id`; acceptance changes its provenance from `UNKNOWN` to `SELF_PROVIDED`. This does not establish verified identity.

## Authorization and ledger

Anonymous and authenticated database roles cannot directly read or mutate private application tables or call privileged RPCs. Server-only service-role operations first authorize the authenticated actor or client capability in the application. Public agreement/profile pages return explicit projections. Never expose service credentials to browser code or bypass the application authorization layer.

The commit RPC locks the job and checks its version, committing state and append-only events atomically. The final migration requires a new event for a commit and denies event update/delete/truncate. Application operation IDs protect retries. Database owners remain trusted operators who can alter privileges; the ledger is not cryptographic proof against an owner.

## Evidence

Migrations create the private `transaction-evidence` bucket and evidence metadata. A restrictive Storage policy prevents broad older anonymous/authenticated policies from exposing this bucket. Server uploads validate authorization, signatures/types and size; downloads authorize the transaction and issue 60-second signed access. Only PDF, JPEG, PNG, WebP and plain text are accepted, up to 10 MiB per file.

There is no public portfolio upload or evidence deletion endpoint. Failed metadata insertion triggers immediate object cleanup; uploaded-but-unsubmitted files have no scheduled cleanup yet. Define retention and orphan cleanup operationally before launch. Signature validation is not malware scanning.

## Validation and boundaries

`npm test` exercises the domain, auth boundary and real PostgreSQL through PGlite. `npm run test:workflow` exercises the production Next server and Supabase adapter against a test-only HTTP fixture backed by that database. The fixture requires `TRUSTLINK_TEST_FIXTURE=1` in a non-production fixture process; the application server has no fixture-auth mode. It substitutes Auth/Storage/PostgREST services and does not validate hosted Supabase behavior. Run staging checks against real Auth, PostgREST and Storage before claiming deployment readiness.

No payment provider configuration is needed. PAYMENT_RECORDED means the provider reports receiving payment; TrustLink does not verify, process, hold or protect funds.
