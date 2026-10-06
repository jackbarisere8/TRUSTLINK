# Phase 4 — Unified account roles and onboarding

Status: implemented and verified locally on 2026-10-05.

Hosted Supabase status: not applied or verified. The hosted staging project remains unavailable from this workspace, so `20261005000002_unified_accounts.sql` must still be deployed through the approved hosted migration process before release.

## Delivered

- New signups are role-neutral customer accounts. Auth metadata grants only the trusted administrator role; provider access is derived from an existing `provider_profiles` row.
- Existing provider rows, usernames, `/p/[username]` URLs, transactions, and private client capabilities are preserved.
- `/account` provides the protected customer context, account settings, an honest pre-booking empty state, and provider opt-in.
- `/account/become-provider` collects only a professional headline and broad service area, then creates an idempotent private `DRAFT` provider profile.
- `/dashboard` remains the provider workspace. Every provider page and provider profile mutation independently checks provider access.
- Customer and provider navigation clearly switch context without requiring a second identity.
- New provider drafts are not publicly accessible. Legacy `NOT_LISTED` Trust Profiles and `PUBLISHED` profiles retain their public URLs.
- Login and email confirmation route customers to `/account`, providers to `/dashboard`, and administrators to `/admin`.

## Database change

`supabase/migrations/20261005000002_unified_accounts.sql`:

- replaces the Auth user trigger so new users receive only `profiles` rows;
- leaves all existing `provider_profiles` rows untouched;
- adds the service-role-only `tl_update_account_profile` RPC;
- adds the idempotent, service-role-only `tl_enable_provider` RPC;
- keeps browser roles default-deny for both account mutations.

Generated database types include both RPCs.

## Verification

- `npm run typecheck` — passed
- `npm run lint` — passed
- `npm test` — 66 passed
- `npm run build` — passed
- `npm run test:browser` — 9 passed
- `npm run test:workflow` — 4 passed

The workflow suite verifies new customer signup, customer denial from the provider dashboard, provider opt-in, draft privacy, customer/provider workspace switching, existing provider login, administrator isolation, and the full guest private-link lifecycle.

The database compatibility test creates a provider before the Phase 4 migration, applies the migration, and proves that the provider ID and username remain unchanged. It then proves that a new account has no provider row until opt-in and that repeated opt-in cannot overwrite the original draft.

## Subsequent work

Provider service CRUD, service areas, availability, private blackout periods, provider preview, and publication controls were subsequently delivered in Phase 5. Discovery and customer booking UI remain deferred. See `docs/PHASE-5-PROVIDER-SERVICES-AVAILABILITY.md`.
