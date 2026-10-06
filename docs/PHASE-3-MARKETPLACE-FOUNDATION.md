# Phase 3 — Marketplace schema, policies, and booking domain

Status: implemented and verified locally on 2026-10-05. No marketplace page or booking form is exposed by this phase.

Hosted Supabase status: not applied. Phase 1 remains dependent on a founder-supplied hosted Supabase project and credentials. The migrations are ready for the normal hosted migration workflow once that dependency exists.

## Delivered boundary

- Curated categories, canonical service definitions, and centrally stored approved search aliases.
- Versioned Nigeria state/FCT and LGA/area-council reference tables with a checked-in normalized artifact, source metadata, checksums, and generated SQL seed.
- Additive marketplace fields on the existing provider profile; no second account identity was introduced.
- Provider offerings, duration options, service areas, availability rules, and private unavailability periods.
- Private booking requests, an immutable booking event ledger, and expiring capacity holds.
- A server-enforced lifecycle: `REQUESTED → DECLINED | CANCELLED | EXPIRED | TERMS_SENT`, then `TERMS_SENT → CANCELLED | EXPIRED | CONFIRMED`.
- Atomic `REQUESTED → TERMS_SENT` conversion that creates exactly one canonical TrustLink transaction and one active hold in the same database transaction.
- Transaction-derived confirmation: the linked booking becomes `CONFIRMED` only when the canonical transaction reaches `ACCEPTED`.
- Version checks, exact request-id replay, request-id misuse rejection, provider capacity serialization, hold expiry/release, and late-acceptance rejection.
- Server-only Supabase and in-memory fixture repositories with participant-scoped reads and precise address redaction. A provider sees a customer's private address only after the booking is confirmed.
- Generated database types and local Supabase HTTP fixture support.

## Authorization model

All new tables have RLS enabled and forced. `anon` and `authenticated` receive no table or booking-RPC privileges. `service_role` receives read access but no direct booking-table mutation access. Mutations use narrowly granted security-definer functions after the Next.js server authenticates the caller.

The database functions independently enforce customer/provider ownership, allowed transitions, expected versions, and idempotency. Cross-customer and cross-provider reads fail closed. Booking events are append-only and cannot be updated, deleted, or truncated.

## Nigeria reference provenance

Selected source: OCHA HDX Nigeria administrative boundaries, sourced from the Office of the Surveyor-General of the Federation and mirrored by the World Bank Data Catalog under CC BY 4.0.

- Dataset landing page: <https://data.humdata.org/dataset/nga-administrative-boundaries>
- Catalog and license record: <https://datacatalog.worldbank.org/search/dataset/0039368/nigeria-administrative-boundaries>
- ADM2 resource: <https://datacatalogfiles.worldbank.org/ddh-published-v2/0039368/1/DR0048906/ngaadmbndaadm2osgof20170222.geojson>
- Source validity field: `2017/02/22`
- Retrieved: `2026-10-05`
- Valid GeoJSON-object SHA-256: `334f3dfec7c518b6b0602a2c9d265fb030a0347e4919e5d16e58e76125798f95`
- Normalized state/LGA payload SHA-256: `cc9cf5c6977ea68a8ff2c038368bf61d781b83a9cf1813bf7fe9f5bef3e203bb`
- Integrity result: 37 state/FCT units, 774 second-level units, including six FCT area councils.

Only codes, names, parent relationships, and administrative kinds are retained. Boundary geometry is intentionally excluded. The repeatable importer is `scripts/import-nigeria-admin-data.mts`; its normalized output is `data/nigeria-administrative-areas.json`, and its generated database seed is `supabase/migrations/20261005000001_nigeria_admin_seed.sql`.

## Transaction convergence

`TERMS_SENT` is not acceptance. During conversion, the booking repository persists the aggregate produced by the existing canonical transaction builder through `tl_commit_job`, links that job to the booking, appends booking events, and creates a 24-hour hold. Any failure rolls back the job, booking transition, events, and hold together.

Raw requests expire after 72 hours. Final-terms holds expire after 24 hours. These values live in `marketplace_settings` and have matching exported domain constants; they are not scattered across UI components.

If a hold expires or a booking is cancelled, the linked `SENT` transaction cannot later be accepted because the job acceptance trigger requires an active `TERMS_SENT` booking hold. Canonical transaction cancellation also cancels the linked booking and releases its hold.

## Verification

Dedicated tests cover:

- reference counts, checksums, taxonomy aliases, indexes, constraints, and forced RLS;
- browser-role denial and service-role least privilege;
- participant isolation and private-address redaction;
- the complete legal transition graph and illegal role/state combinations;
- duplicate retries, request-id misuse, and stale versions;
- overlapping capacity conflicts and hold expiry/release;
- conversion rollback after transaction persistence begins;
- one-to-one booking/transaction linkage;
- transaction-acceptance-derived booking confirmation;
- rejection of acceptance after hold expiry.

The Phase 3 gate is satisfied in the local test environment. It is not represented as hosted verification until the Phase 1 Supabase dependency is supplied and the same migrations/tests run against staging.
