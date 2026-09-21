# Supabase setup

Use separate development, staging and production projects. Populate `.env.local` or hosting environment variables from `.env.example`; never commit credentials or paste them into chat. Set `TRUSTLINK_STORAGE=supabase`. The service-role key must remain server-only. Local JSON mode has no replacement authentication and is refused in production.

## Migrations

Apply the complete version-controlled sequence:

1. `20260917000000_v0_core.sql`
2. `20260920000000_integrity.sql`
3. `20260920000001_final_audit.sql`

The original migration alone has permissive policies and must not serve this app. Back up existing project data before applying upgrades. Historical foreign-key and revision constraints use NOT VALID: new writes are checked, but existing rows need inspection and constraint validation before rollout. Historical profiles that do not correspond to Auth users need explicit migration; they are not automatically authenticated accounts.

## Authentication

The implemented flow is Supabase email/password Auth, with server-side `getUser()` validation and SSR session refresh. Enable email confirmation, configure the application Site URL, and use this confirmation template URL:

`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`

Set the Site URL to the actual HTTPS deployment. Test signup, email confirmation, login, expiration/refresh and logout in staging. Magic-link login and password recovery are not implemented. Administrator access comes only from Auth `app_metadata.role = ADMIN`, assigned through trusted operator tooling; user-editable metadata cannot grant it.

Clients receive a transaction-specific capability instead of an account. The URL fragment is exchanged for an HTTP-only scoped cookie. Capabilities expire after 30 days and can be replaced by the provider. Production cookies require HTTPS.

## Authorization and ledger

Anonymous and authenticated database roles cannot directly read or mutate private application tables or call privileged RPCs. Server-only service-role operations first authorize the authenticated actor or client capability in the application. Public agreement/profile pages return explicit projections. Never expose service credentials to browser code or bypass the application authorization layer.

The commit RPC locks the job and checks its version, committing state and append-only events atomically. The final migration requires a new event for a commit and denies event update/delete/truncate. Application operation IDs protect retries. Database owners remain trusted operators who can alter privileges; the ledger is not cryptographic proof against an owner.

## Evidence

Migrations create the private `transaction-evidence` bucket and evidence metadata. A restrictive Storage policy prevents broad older anonymous/authenticated policies from exposing this bucket. Server uploads validate authorization, signatures/types and size; downloads authorize the transaction and issue 60-second signed access. Only PDF, JPEG, PNG, WebP and plain text are accepted, up to 10 MiB per file.

There is no public portfolio upload or evidence deletion endpoint. Failed metadata insertion triggers immediate object cleanup; uploaded-but-unsubmitted files have no scheduled cleanup yet. Define retention and orphan cleanup operationally before launch. Signature validation is not malware scanning.

## Validation and boundaries

`npm test` exercises the domain and real PostgreSQL through PGlite. `npm run test:workflow` exercises the production Next server and Supabase adapter against a test-only HTTP fixture backed by that database. The fixture substitutes Auth/Storage/PostgREST services and does not validate hosted Supabase behavior. Run staging checks against real Auth, PostgREST and Storage before claiming deployment readiness.

No payment provider configuration is needed. PAYMENT_RECORDED means the provider reports receiving payment; TrustLink does not verify, process, hold or protect funds.
