# Phase 22: hosted Supabase activation

Requested on September 27, 2026. **Hosted activation is pending and Phase 22 is not complete.** The workspace currently has no configured Supabase URL, publishable key or server secret, no Supabase CLI, and no `supabase/config.toml`. No remote project was created, linked, migrated, seeded or tested.

This phase can become active only after the founder creates a separate staging project and configures its values outside source control. Do not paste a project secret, database password or CLI access token into chat, documentation, source code or a shell command that will be recorded.

## Repository readiness

The repository contains seventeen ordered migrations and a credential-safe, read-only hosted preflight:

```powershell
npm run supabase:hosted:preflight
```

The script loads `.env.local` through Node's environment-file support. It prints only named pass/fail results. It never prints credential values and performs no remote writes. Once configured, it verifies:

- the hosted HTTPS application and Supabase configuration;
- the exact reviewed seventeen-migration local manifest;
- denial of direct application-table, service-view and private-RPC access with the public key;
- successful table, service-view and private-reader access with the server key;
- a private `transaction-evidence` bucket with its 10 MiB limit and reviewed MIME allowlist.

The environment variable names remain compatible with the application contract. For a new project, put Supabase's current **publishable key** in `NEXT_PUBLIC_SUPABASE_ANON_KEY` and its current **secret key** in `SUPABASE_SERVICE_ROLE_KEY`. The latter bypasses RLS and remains server-only. Supabase's current key guidance is documented at <https://supabase.com/docs/guides/getting-started/api-keys>.

## Activation sequence

1. Create a dedicated staging project in the founder's Supabase organization. Store the database password in the team's password manager. Do not reuse a production project or personal customer data.
2. Install the official Supabase CLI, then run `supabase init`, `supabase login`, and `supabase link --project-ref <staging-project-ref>`. The project reference is non-secret; the CLI access token and database password are secrets. Follow <https://supabase.com/docs/guides/local-development/cli-workflows>.
3. Configure `.env.local` and the staging host with `TRUSTLINK_STORAGE=supabase`, the project URL, publishable key, secret key and the staging HTTPS `NEXT_PUBLIC_APP_URL`. Confirm `.env.local` remains ignored by Git.
4. In Supabase Auth, enable email confirmation, set the Site URL to the staging HTTPS origin, allow only required redirect origins, and set the confirmation link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. See <https://supabase.com/docs/guides/auth/auth-email-templates> and <https://supabase.com/docs/guides/auth/redirect-urls>.
5. Preview the database change with `supabase db push --dry-run`. It must show only the seventeen reviewed migrations in `docs/supabase-setup.md`. Resolve historical-data preflight failures from backed-up source data; do not weaken a migration.
6. Apply with `supabase db push`, then run `supabase migration list`. Never use `supabase db reset --linked` against a project containing data.
7. Run `npm run db:types`, `npm run db:types:check`, and `npm run supabase:hosted:preflight`. Review and commit any legitimate generated-type change before application deployment.
8. Create controlled staging users through the real signup and email-confirmation flow. Use obviously synthetic names and transactions. Assign an administrator only through trusted Auth `app_metadata` tooling.
9. Deploy the application with the same staging configuration and complete the evidence matrix below.

The migrations create the private bucket and restrictive Storage policy. A private bucket requires authenticated access or a time-limited signed URL; it must never be changed to public. Supabase's current Storage model is documented at <https://supabase.com/docs/guides/storage/buckets/fundamentals>.

## Required hosted evidence

| Area | Required staging proof | Status |
|---|---|---|
| Project and migrations | Dry run reviewed; all seventeen migrations applied and listed | Pending |
| Generated contract | Database types regenerated; drift check passes | Pending |
| Auth | Signup, confirmation, rejected credentials, login, refresh/rotation and logout work over HTTPS | Pending |
| Provider isolation | Provider A cannot read or mutate Provider B's private transaction through any reachable route | Pending |
| Client isolation | A missing, altered, expired, revoked or wrong-job capability cannot access private transaction data or evidence | Pending |
| Public projection | Anonymous users receive only the allowlisted public agreement and event fields | Pending |
| RLS and grants | `anon` and `authenticated` cannot access application tables/views/RPCs; server access matches the reviewed grant matrix | Pending |
| Storage | Bucket remains private; upload limits, signatures, purpose binding, signed downloads and attached-evidence immutability hold | Pending |
| Rollback | A deliberately rejected aggregate leaves job, child rows, evidence status and event history unchanged | Pending |
| Concurrency | Simultaneous acceptance/payment and double-first creation produce one valid commit and one safe conflict/replay result | Pending |
| Validation | `npm test`, hosted workflow checks, typecheck, lint and production build pass against the activated staging configuration | Pending |

Record only non-secret evidence: timestamps, command names, pass/fail results, migration identifiers and redacted opaque record IDs. Remove controlled staging data after verification. Phase 22 becomes complete only after every row above has real hosted evidence.
