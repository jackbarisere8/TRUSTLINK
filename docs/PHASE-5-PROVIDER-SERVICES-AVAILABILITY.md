# Phase 5 — Provider services, service areas, and availability

Status: implemented and verified locally on 2026-10-05.

Hosted Supabase status: not applied or verified. The staging project is still unavailable from this workspace. Migration `20261005000003_provider_services_availability.sql` must be applied and the hosted checks repeated before release.

## Delivered

- Provider service create/edit/archive for an approved category and service definition.
- Fixed, starting-at, hourly, daily, and quote-required pricing with server-side model validation.
- Remote and on-site delivery modes, multiple state/LGA coverage areas, and optional broad origin/radius information.
- Weekly Africa/Lagos availability and private blackout periods.
- Provider-only marketplace preview that omits account details and blackout notes.
- Provider publish/unpublish controls.
- Automatic unpublication when the last active service is archived.
- Dashboard routes:
  - `/dashboard/services`
  - `/dashboard/services/new`
  - `/dashboard/services/[id]/edit`
  - `/dashboard/availability`
  - `/dashboard/profile/preview`

Phase 6 discovery/search and Phase 7 customer booking UI were not started.

## Publication and privacy gate

The server-only `public_marketplace_services` projection returns a row only when:

1. the provider marketplace profile is `PUBLISHED` and moderation status is `APPROVED`;
2. the service is `PUBLISHED`; and
3. its canonical category and definition remain active and approved.

A provider cannot publish without at least one active, fully validated service. Unpublishing hides all services immediately. Archiving the final active service returns the provider profile to a private draft.

Publication records structured marketplace eligibility; it does not claim identity verification, background checking, payment protection, or TrustLink endorsement.

The public projection includes only profile presentation fields, service terms, durations, broad service areas, and normal availability. It excludes email, private addresses, blackout reasons, precise coordinates, and booking internals. The current schema stores no precise provider coordinates.

## Authorization and validation

Every Server Action resolves the authenticated user independently and requires an existing provider capability. Provider IDs are never accepted from browser input.

Direct mutations of provider configuration tables remain denied. Service-role-only RPCs enforce provider ownership and apply service, area, schedule, blackout, archive, and publication changes atomically. Database checks repeat the critical category, price, delivery-mode, state/LGA, duration, overlap, and publication rules even when application validation is bypassed.

## Verification

- `npm run db:types` — passed
- `npm run typecheck` — passed
- `npm run lint` — passed
- focused Phase 5 domain/database tests — 9 passed
- `npm test` — 75 passed
- `npm run build` — passed
- focused Phase 5 browser workflow — 1 passed

The Phase 5 workflow passed after the full four-test existing workflow run had passed its unchanged scenarios; the final combined five-test rerun was not executed because the tool approval service reached its usage limit. The public-browser rerun was also blocked before execution by that external limit. The last Phase 4 public suite result was 9 passed, but it is not presented as fresh Phase 5 evidence. Local PGlite and the test-only Supabase HTTP fixture do not replace hosted Supabase validation.
