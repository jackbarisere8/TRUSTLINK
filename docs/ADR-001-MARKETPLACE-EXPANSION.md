# ADR-001: Add provider discovery and booking without duplicating the transaction engine

- Status: Accepted for phased implementation
- Date: 2026-10-04
- Decision owners: TrustLink founder and implementation team
- Scope: Architecture decision only; no marketplace implementation is included in Phase 0
- Controlling brief: `TRUSTLINK-MARKETPLACE-EXPANSION-MASTER-PROMPT-v3.md` Version 3.1

## Context

TrustLink currently has a mature service-agreement and transaction-record engine. It supports provider-created terms, scoped guest-client capabilities, exact client acceptance, direct-payment recording, work and delivery, evidence, revisions, disputes, completion, reviews, immutable events, optimistic concurrency, and idempotency.

The expansion adds a second acquisition path: a visitor searches for a provider and submits a booking request. That request must converge into the existing TrustLink transaction instead of creating a competing order lifecycle.

The current repository already has these useful boundaries:

- `profiles` represents an authenticated application account.
- `provider_profiles` is a one-to-one provider extension keyed by account user ID.
- `TransactionService` owns canonical transaction creation and lifecycle commands.
- `Repository` is implemented by independent local and Supabase adapters.
- the server resolves authentication or participant capability before invoking domain behavior;
- public transaction and profile views use narrow projections rather than exposing full aggregates.

The current checkout uses local storage, has no configured Supabase credentials, and cannot authenticate real accounts. Hosted activation is therefore an architectural prerequisite for claiming marketplace account flows work.

## Decision

### 1. Use one account identity with optional provider capability

`profiles` remains the application-account identity. An account may act as a customer and may also enable a provider profile. Do not create separate customer and provider login identities.

`provider_profiles` remains the optional provider extension. Add marketplace publication and moderation fields to that model rather than replacing it. Existing provider profile URLs and transaction relationships must remain valid.

Customer-specific preferences may be added later as a separate extension only when persistent customer-only data requires it. A new customer-profile table is not required merely to submit a booking.

### 2. Keep booking and transaction domains distinct

A booking request is proposed work, not an accepted agreement. It has its own state machine:

```text
REQUESTED
├── DECLINED
├── CANCELLED
├── EXPIRED
└── TERMS_SENT
    ├── CANCELLED
    ├── EXPIRED
    └── CONFIRMED
```

The provider action is “Prepare and send terms,” not final acceptance. `TERMS_SENT` means one exact linked TrustLink transaction exists and awaits the customer’s acceptance. `CONFIRMED` is derived when the customer accepts that canonical transaction.

Once confirmed, work status comes from the linked transaction. Booking code must not reproduce payment, work, delivery, revision, dispute, completion, or review states.

### 3. Preserve `TransactionService` as the only transaction mutation engine

Booking conversion calls the existing `TransactionService.create()` behavior through an atomic persistence boundary. It must not insert jobs, terms, participants, or events independently.

The conversion operation must atomically produce:

- one booking transition to `TERMS_SENT`;
- one active provider slot hold;
- exactly one linked canonical transaction;
- the corresponding immutable booking events;
- notification intent creation where applicable.

A failure in any part rolls back all parts. A unique booking-to-transaction constraint and idempotency key prevent duplicate conversion.

### 4. Add a separate marketplace repository boundary

Do not make the existing transaction `Repository` responsible for every marketplace query. Add a focused, server-only marketplace repository contract for:

- categories and canonical services;
- provider offerings and service areas;
- availability and holds;
- provider search projections;
- booking-request reads and atomic transitions.

The Supabase implementation is the production/staging source of truth. A local implementation may exist only where it provides useful deterministic development or domain tests. Local parity must not be presented as hosted Auth, PostGIS, RLS, Storage, or concurrency proof.

### 5. Use a three-layer service taxonomy

```text
service category
→ canonical service definition
→ provider service offering
```

- Categories are broad curated groups.
- Canonical services provide stable slugs plus approved aliases and synonyms.
- Provider services contain provider-authored title, description, delivery mode, indicative pricing, and duration options.

Providers cannot create arbitrary top-level categories. Search normalization and aliases live in the domain/data layer, not scattered through React components.

### 6. Use normalized Nigerian administrative references

Add normalized state and LGA reference tables. Preserve current free-text profile location fields for compatibility, but do not use them as the authoritative discovery filter.

The initial imported reference will be derived from the OCHA Nigeria/HDX Nigeria administrative-boundaries dataset, distributed under CC BY 4.0. Import only fields required by TrustLink, retain source identifiers where available, and record:

- source URL;
- license and attribution;
- retrieval date;
- source version/date;
- normalization rules;
- checksum of the imported source artifact;
- validation results.

Cross-check the resulting 37 state/FCT records and 774 LGA/area-council records against INEC’s official state and LGA directory. Model the six FCT subdivisions as `AREA_COUNCIL` rather than silently labelling them ordinary LGAs, while allowing the UI to use “LGA / Area Council.”

Do not use UN SALB data for the commercial product because its terms restrict commercial reuse. Do not use an AI-generated list or an unattributed community snippet.

Data references evaluated during Phase 0:

- OCHA/HDX-derived Nigeria boundaries, CC BY 4.0: <https://datacatalog.worldbank.org/search/dataset/0039368/nigeria-administrative-boundaries>
- INEC official state/LGA directory: <https://inecnigeria.org/about/state-offices/>
- UN SALB Nigeria reference, not selected because of reuse restrictions: <https://salb.un.org/en/data/nga>

This is a source-selection decision, not permission to download or commit the dataset during Phase 0.

### 7. Protect location privacy

Browser geolocation is optional and begins only after a user action. Manual State and LGA/Area Council selection always remains available.

Provider search may use an opted-in approximate origin and service radius. Exact provider residential coordinates are never public. Customer exact addresses do not appear in URLs, analytics, public profiles, notification previews, or pre-authentication drafts.

For on-site work, only State, LGA/Area Council, and a broad area are visible before confirmation. If an exact address is later collected, the authorized provider may receive it only after the customer accepts final terms.

The current `Permissions-Policy` sets `geolocation=()`. Phase 6 must intentionally change it to an appropriate same-origin policy before “Use my location” can work; this is not a Phase 0 code change.

### 8. Use explicit availability holds

Provider working hours and blackout intervals describe request eligibility, not guaranteed real-time availability.

MVP policy:

- multiple `REQUESTED` records may target the same period;
- provider capacity defaults to one unless a later explicit provider setting supports more;
- sending final terms atomically creates a 24-hour slot hold;
- raw booking requests expire after 72 hours;
- customer acceptance converts the hold into a confirmed conflict block;
- decline, cancellation, failed conversion, or expiry releases the hold atomically.

The 24- and 72-hour values are configurable defaults. They are not scattered constants and can be changed after validation.

### 9. Preserve only a minimal safe pre-authentication draft

When authentication interrupts booking submission, browser `sessionStorage` may temporarily retain only non-sensitive structured fields:

- provider service ID;
- requested date/time and timezone;
- duration;
- delivery/location mode;
- State and LGA/Area Council IDs.

Do not retain free-text notes, an exact address, coordinates, or trust decisions in the URL or pre-auth draft. After authentication, restore the fields into the form, revalidate all values on the server, and require the customer to review before persistence. Browser draft content is never authoritative.

### 10. Follow Next.js 16 server boundaries

The installed Next.js 16 guidance requires the implementation to:

- keep pages and layouts as Server Components unless interaction requires a client boundary;
- authorize every Server Action independently even when its form is rendered on a protected page;
- keep authorization close to the data source rather than relying on layout or proxy redirects;
- use narrow DTOs/projections for public and client-rendered data;
- keep secrets and elevated repositories in `server-only` modules;
- treat route parameters and request APIs according to the installed asynchronous Next.js 16 contracts;
- remember that Route Handlers are uncached by default and cannot share a route segment with `page.tsx`;
- avoid optimistic UI for irreversible trust and booking lifecycle events unless the consistency model explicitly supports it.

The current app does not enable `cacheComponents`. Do not introduce `use cache` or Cache Components assumptions during marketplace work without a separate, tested configuration decision. Search and profile freshness must use the rendering/caching model actually configured in the repository.

### 11. Keep discovery server-authoritative

`/providers` uses validated URL parameters for shareable, non-sensitive filters. The server performs the canonical query and returns a narrow search DTO. Client components may manage filter interaction but cannot be the only source of filtering, ranking, availability, or authorization truth.

Initial ranking signals are explainable: service match, service-area/distance match, availability, completed transaction evidence, eligible rating aggregates, and profile completeness. There is no paid ranking or hidden Trust Score.

### 12. Keep Explore separate

Career Explore, Pathfinder, Learn, and illustrative Opportunities remain a distinct experiment. They do not share the marketplace taxonomy or booking models. They may be made secondary or feature-flagged in a later authorized phase, but Phase 0 does not delete them.

## Consequences

### Positive

- Existing transaction integrity is preserved.
- Provider and customer identities do not fragment.
- Customer consent remains attached to exact final terms.
- Public search can evolve independently from the transaction aggregate.
- Location and address privacy have explicit boundaries.
- Booking retries and concurrent slot decisions have a testable consistency model.
- New provider discovery cannot fabricate reputation or weaken review eligibility.

### Costs and tradeoffs

- Booking conversion requires a database transaction spanning booking, hold, and transaction persistence.
- `TERMS_SENT` adds one step compared with a simple “accept order” marketplace.
- A normalized taxonomy and administrative import require curation and attribution maintenance.
- Real hosted Supabase and PostgreSQL tests are required before the account workflow can be represented as operational.
- Availability is intentionally simpler than a calendar platform and may require later capacity refinements.

## Rejected alternatives

### Add booking fields directly to `jobs`

Rejected because a search inquiry is not yet an accepted agreement and would pollute the canonical transaction lifecycle.

### Mark a booking accepted when the provider clicks Accept

Rejected because the customer may not have reviewed the final scope, price, deadline, revision, and cancellation terms.

### Create separate customer and provider accounts

Rejected because one person may buy and sell services, and separate identities would fragment history and authorization.

### Build search entirely in client React state

Rejected because it cannot provide authoritative publication, privacy, pagination, URL sharing, or scalable database filtering.

### Reuse career Explore taxonomy as service discovery

Rejected because career guidance and provider offerings have different semantics, lifecycle, and data-quality requirements.

### Use exact coordinates or exact addresses in public discovery

Rejected because the product only needs approximate service-area matching and must minimize location exposure.

## Implementation gate

This ADR authorizes architecture only. Marketplace schema and UI work begins no earlier than the phase defined by the controlling master prompt. Hosted Supabase staging remains the next prerequisite phase.
