# Phase 1: hosted Supabase staging activation

Status: **BLOCKED - external staging dependencies are not configured**  
Checked: October 4, 2026 (Africa/Lagos)

Phase 1 is not complete. No hosted project was created, linked, migrated, or modified during this run. Marketplace accounts, booking persistence, and all later phases remain gated.

## Verified repository readiness

- The reviewed local migration manifest contains exactly 17 ordered SQL migrations.
- `npm run typecheck` passed, including generated database type drift detection.
- `npm test` passed: 51 tests passed and 0 failed.
- `npm run test:workflow` passed: 2 tests passed and 0 failed.
- The workflow suite uses the repository's test-only Supabase fixture. It is not hosted-staging evidence.
- `npm run supabase:hosted:preflight` ran without exposing credentials and reported 2/10 checks passing:
  - the application URL variable exists;
  - the local migration sequence matches the reviewed 17-file manifest.

## Exact blockers

The approved local environment and process environment do not currently provide:

- `NEXT_PUBLIC_SUPABASE_URL`;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- authenticated Supabase CLI access;
- a staging project reference or linked project;
- a staging database password for migration operations.

In addition:

- `TRUSTLINK_STORAGE` is still `local`, not `supabase`;
- `NEXT_PUBLIC_APP_URL` is local HTTP, not a deployed staging HTTPS origin;
- the Supabase CLI is not installed or otherwise available on `PATH`;
- `supabase/config.toml` does not exist;
- no linked-project metadata exists.

These conditions prevent migration preview/application, hosted type regeneration, Auth URL/email configuration, Storage inspection, cross-user isolation tests, session refresh tests, rollback tests, and concurrent-write tests against a real project.

## Founder-supplied dependencies

Before work can resume, create or designate a non-production Supabase project and a deployed HTTPS staging application. Configure the following through the approved secret mechanism; do not paste secrets into chat, source files, documentation, or committed shell scripts:

```text
TRUSTLINK_STORAGE=supabase
NEXT_PUBLIC_SUPABASE_URL=<hosted staging project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging publishable key>
SUPABASE_SERVICE_ROLE_KEY=<staging server-only secret key>
NEXT_PUBLIC_APP_URL=<deployed staging HTTPS origin>
```

Also make authorized Supabase CLI access, the staging project reference, and the database password available through a secure local/operator workflow. `.env.local` must remain ignored by Git.

## Resume point

Once those dependencies are present, resume Phase 1 at this order:

1. Install/verify the official Supabase CLI and initialize/link only the staging project.
2. Review `supabase db push --dry-run` against the 17-file manifest.
3. Back up any existing staging data, then apply the reviewed migrations.
4. Regenerate/check database types.
5. Configure Auth Site URL, allowed redirects, and email confirmation for the staging HTTPS origin.
6. Verify the private evidence bucket and Storage policies.
7. Run hosted preflight and the complete hosted evidence matrix in `docs/PHASE-22-HOSTED-SUPABASE.md`.
8. Record only redacted identifiers, timestamps, command results, and migration identifiers.

Do not mark Phase 1 complete until hosted Auth, authorization isolation, service-role boundaries, private evidence, rollback, and concurrency checks all pass against the real staging project.
