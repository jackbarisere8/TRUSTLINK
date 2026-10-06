# Phase 6 — Provider search and discovery-led homepage

## Delivered scope

Phase 6 adds a discovery-led homepage and a real `/providers` search surface. Search is backed by the published marketplace domain introduced in Phase 5. It does not create booking requests; booking creation remains Phase 7.

Public, shareable filters are `q`, `category`, `state`, `lga`, `remote`, `date`, `nearby`, `radius`, `sort`, and `page`. The server validates every value against bounded schemas and canonical category/location reference data. Unsupported or stale values are ignored with a visible recovery notice.

Search supports approved service aliases, category, Nigerian state/FCT, LGA/area council, remote delivery, date availability, and 5/10/25/50 km nearby radii. Sorts are intentionally explainable:

- Best match: text score, then completed TrustLink transactions, provider name, and service ID.
- Nearest: rounded measured distance, then provider name and service ID; available only during an active nearby search.
- Most completed: completed TrustLink transactions, then text score and stable identifiers.
- Highest rated: rating is eligible only with at least three completed-job reviews, then review count and stable identifiers.

New providers are not penalized with fabricated values: cards say “New provider” and withhold rating rank until the minimum review count. Empty results offer clear-filter and provider-onboarding paths. No demo provider is inserted into live/local results.

## Nearby privacy boundary

Nearby matching is opt-in on both sides.

Providers first save a broad on-site area, approximate public label, and travel radius. On the service edit page they may separately press “Use my current location.” The service-role-only `tl_set_provider_service_origin` RPC stores the origin on the private `provider_service_areas` table. Saving/replacing areas removes the previous origin, requiring renewed consent. Providers can turn matching off and clear the coordinates.

Visitors explicitly select nearby search and then press “Use my location.” Browser coordinates are passed once to a Server Action and then to the service-role-only search RPC. They are not placed in the URL, rendered HTML, public profile projection, application analytics, or application logs, and they are not persisted. Denied or unavailable geolocation leaves state/LGA/remote search usable.

`tl_search_marketplace_services` calculates Haversine distance inside PostgreSQL. A match must fall inside both the visitor radius and the provider’s consented travel radius. The response returns only distance rounded to one decimal place. Its strict server mapper rejects unexpected or private result keys.

## Publication and availability rules

Search includes a row only when all of these are true:

- provider marketplace status is `PUBLISHED`;
- provider moderation status is `APPROVED`;
- service status is `PUBLISHED`;
- canonical service definition and category are active and approved.

Date filtering requires a matching weekly rule and excludes dates intersecting a provider blackout. Blackout reasons never enter the search response. Availability is re-evaluated by the database for each search rather than copied into a stale search index.

## Verification

Automated coverage is split by boundary:

- `tests/provider-search-domain.test.ts`: query validation, text/alias/category matching, state/LGA, remote/date, radius boundaries, private-field stripping, stable sorting, pagination, and rating thresholds.
- `tests/provider-search-database.test.ts`: publication gates, active services, server-side filter behavior, private-origin radius enforcement, rounded output, stable pages, and denied browser-role RPC access.
- `tests/browser/public.spec.ts`: discovery homepage, truthful local empty state, invalid-query recovery, responsive keyboard filters, denied geolocation, and no coordinates in public HTML.
- `tests/browser/workflow.spec.ts`: Supabase-adapter search, availability filtering, provider location opt-in, public redaction, and successful transient nearby results.

The migration is `20261005000004_provider_search.sql`. It has been applied and verified only in the local PGlite test database in this workspace. Hosted Supabase deployment and verification still require configured hosted credentials and an explicit migration run.
