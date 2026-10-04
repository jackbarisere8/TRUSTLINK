# Phase 7: database security and RLS

Implemented for the request to continue with Phase 7 on September 21, 2026. This phase closes the PostgreSQL Data API surface around the existing server-authorized architecture. It does not add a second browser database client, expose raw transaction tables, or begin the Phase 8 ledger expansion.

## Authorization boundary

TrustLink has two production authorization mechanisms that PostgreSQL JWT policies cannot represent as one row predicate:

- account actors use a Supabase-validated session linked to an application profile;
- guest clients use an expiring, revocable, job-scoped capability exchanged for an HTTP-only cookie.

The Next.js server resolves those credentials, checks the actor's relationship to the requested transaction, and only then uses the isolated server database client. The database client carries the elevated server credential, which Supabase documents as bypassing RLS. That makes the application authorization check a required part of every private server read and mutation, even though RLS is enabled and forced on the tables. The elevated client remains a direct `@supabase/supabase-js` client with no browser session persistence, and its key is read only by server modules.

TrustLink deliberately does not grant `anon` or `authenticated` direct table/RPC access. Adding provider-only JWT policies would create an unused second authorization path and still would not model the guest capability. Default-deny is stricter and matches the current server-mediated product.

| Actor | Public database role | Effective access path |
|---|---|---|
| Anonymous visitor | `anon` | Public Next.js agreement/profile projections only; no direct table, view or RPC access |
| Provider | `authenticated` session | Server validates `getUser()`, linked profile and transaction ownership before private repository access |
| Client participant | No account required | Server validates the scoped capability before returning or mutating that transaction |
| Administrator | `authenticated` session | Server requires trusted `app_metadata.role = ADMIN`; the claim alone grants no direct database access |
| Application server | `service_role` | Reads after authorization; writes evidence metadata directly and performs domain mutations through three approved RPCs |

## Migration controls

`supabase/migrations/20260921000001_database_security.sql` is applied after the Phase 6 database model. It:

- enables and forces RLS on all twelve public application tables;
- removes all public-schema policies so browser roles fail closed;
- revokes current table, sequence and function privileges from `PUBLIC`, `anon` and `authenticated`;
- revokes default privileges for objects created by later migrations, making future exposure opt-in;
- changes `public_job_records` to `security_invoker=true`, preventing view-owner permissions from bypassing underlying grants/RLS;
- reduces `service_role` tables to read-only access except evidence metadata insert/delete;
- limits service execution to `tl_update_profile`, `tl_read_job`, `tl_commit_job` and the UUID default used by evidence inserts;
- leaves trigger, normalization and participant-integrity helpers unavailable as callable Data API functions.

All aggregate/profile mutations still execute through security-definer functions with an empty `search_path`. The functions preserve the existing atomic version checks, participant synchronization and event writes. They are callable only by the elevated server role. A database owner remains a trusted operator and can change these controls.

## Public and private projections

`public_job_records` contains only agreement terms, transaction status, provider public identity and profile presentation. It does not contain client contact data, participant account links, capability hashes, payment notes, dispute responses/resolution notes, evidence paths, review identity, or private event metadata. The view remains service-only because public pages are shaped through `PublicJobProjection` in the server data-access layer.

Raw `jobs`, `job_participants`, child transaction tables, `trust_events` and `evidence_files` are never anonymous resources. The `transaction-evidence` bucket remains private, and the restrictive Storage policy prevents unrelated permissive policies from admitting `anon` or `authenticated` requests to that bucket.

## Test coverage

The PostgreSQL suite applies all five migrations and enumerates the resulting schema instead of checking a hand-picked subset. It verifies:

- the exact twelve application tables all have `relrowsecurity` and `relforcerowsecurity` enabled;
- there are no policies in the exposed public schema;
- `anon` and `authenticated` have no select/insert/update/delete/truncate privilege on any application table;
- the public view is security invoker, contains the exact approved column projection and denies browser roles;
- every public TrustLink function denies browser execution;
- `service_role` has only the approved table and function privileges;
- even an `authenticated` request carrying an administrator-shaped JWT claim cannot directly query application data;
- the service role can read the projection/RPC and create/delete evidence metadata, but cannot directly edit profiles or the event ledger;
- the private Storage policy still defeats a deliberately injected broad legacy policy.

PGlite validates the cumulative SQL, current ACLs, RLS flags and role behavior locally. It does not represent a deployed Supabase service or persist PostgreSQL default-ACL metadata, so default privileges, PostgREST and Storage must also be inspected in staging.

## Deployment boundary

No hosted Supabase project or credentials exist in this workspace, and no migration was applied remotely. Apply the five migrations in order to a backed-up staging project, review historical rows and `NOT VALID` constraints, then verify Data API denials with real publishable/authenticated tokens and server behavior with the configured secret/service credential.

The implementation follows Supabase's current guidance that exposed tables need RLS plus explicit grants, views should use security-invoker behavior when they must obey underlying RLS, and elevated secret/service credentials bypass RLS and belong only on trusted servers:

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Views and view security](https://supabase.com/docs/guides/database/views)
- [Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [API keys and elevated server access](https://supabase.com/docs/guides/getting-started/api-keys)

## Verification

Verified locally on September 21, 2026:

| Check | Result |
|---|---|
| `npm run db:types:check` / `npm run typecheck` | Passed across all five migrations and the generated database contract |
| `npm run lint` | Passed without errors or warnings |
| `npm test` | 31 passed, including the enumerated Phase 7 RLS/ACL/function/view/Storage matrix |
| `npm run build` | Passed; all production routes compiled |
| `npm run test:browser` | 6 passed |
| `npm run test:workflow` | 2 passed through the Supabase adapter and gated PGlite-backed fixture with the fifth migration applied |

The two browser suites ran sequentially. These results prove the checked-in SQL and local application boundary, not a hosted Supabase deployment.
