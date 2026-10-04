# TrustLink — Provider Discovery, Booking and Transaction Platform

## Master implementation prompt — Version 3.1

This document is the controlling implementation brief for expanding the existing TrustLink application. It incorporates the verified repository audit, preserves the working transaction engine, and adds public provider discovery, location-aware search, booking requests, customer accounts, provider order handling, and transaction-backed reviews.

The coding agent must execute this brief in controlled phases. It must not attempt the entire roadmap in one change.

---

# 0. Role and operating standard

Act as:

- a senior product architect;
- a senior full-stack Next.js and TypeScript engineer;
- a PostgreSQL and Supabase engineer;
- an application-security engineer;
- a UX, accessibility, and product-content specialist;
- a QA engineer responsible for proving behavior, not merely editing files.

Before changing Next.js code, read the relevant documentation shipped in `node_modules/next/dist/docs/`. This repository uses Next.js 16.3.5 and its conventions may differ from older Next.js versions.

For every phase:

1. Inspect the repository and relevant documentation.
2. State the current behavior and the exact scope of the phase.
3. Identify existing uncommitted work and preserve unrelated user changes.
4. Implement only that phase.
5. Add or update tests for the behavior changed.
6. Run the relevant validation commands.
7. Inspect the application in a browser at required responsive widths.
8. Report changed files, migrations, results, limitations, and the next safe phase.
9. Stop if the phase gate is not satisfied.

Never fabricate credentials, users, providers, reviews, completed jobs, ratings, verification, payment protection, or production readiness.

---

# 1. Product north star

TrustLink should become a two-sided service marketplace built on top of its existing transaction-record system.

It must support two legitimate entry paths.

## Path A — Provider already has a client

```text
Provider signs in
→ creates clear service terms
→ TrustLink generates a private client link
→ provider sends the link through WhatsApp, email, or another channel
→ client reviews and accepts
→ both parties continue through the existing transaction lifecycle
```

## Path B — Customer needs to find a provider

```text
Visitor searches by service and location
→ filters providers
→ views a real Trust Profile
→ chooses a service, date, time, and duration
→ signs up or signs in before submitting
→ sends a booking request
→ provider declines or prepares final transaction terms
→ customer reviews and accepts the exact terms
→ both parties continue through the existing transaction lifecycle
→ eligible customer leaves a review after completion
```

Both paths must converge into one canonical transaction engine. Do not create a second, weaker order lifecycle that duplicates delivery, revisions, disputes, completion, and reviews.

## One-sentence product definition

> TrustLink helps people find service providers, agree on the work, and build trustworthy transaction history from real completed jobs.

## Core product promise

> Find the right provider. Agree on clear terms. Keep the work on record.

## Canonical terminology

- **Provider:** a person or business offering a service.
- **Service category:** a broad curated grouping such as Technology, Automotive, Home Services, or Creative.
- **Service definition:** a canonical searchable service such as Website Development, Generator Repair, or Event Photography, including approved aliases and synonyms.
- **Provider service:** a provider's published offering linked to a canonical service definition, with the provider's own title, description, delivery mode, and indicative pricing.
- **Provider discovery:** public search and filtering for published providers and provider services.
- **Booking request:** an authenticated customer's proposed date, time, duration, location mode, and work description. It is not yet a confirmed transaction.
- **TrustLink transaction:** the canonical accepted record governing scope, fee, deadline, revisions, payment declaration, work, evidence, disputes, delivery, completion, and review.
- **Trust Profile:** a public, evidence-based provider profile derived from published provider information and eligible completed TrustLink transactions.

Use these terms consistently in schema, domain services, routes, UI labels, analytics, and tests. Do not introduce competing names such as `MarketplaceJob`, `GigOrder`, or `BookingTransaction`.

---

# 2. Verified current baseline

Treat the following as the starting truth unless a fresh repository inspection proves that it has changed.

## Implemented and tested

- Next.js App Router application with strict TypeScript.
- Public marketing, provider, business, legal, and transaction routes.
- Provider authentication architecture through Supabase.
- Provider dashboard and profile editing.
- Transaction creation and private client invitation.
- Scoped, expiring client capabilities.
- Client acceptance.
- Direct-payment recording without false payment verification claims.
- Work start, delivery, evidence, revisions, approval, and completion.
- Disputes, responses, and admin resolution.
- Post-completion reviews.
- Immutable lifecycle events.
- Optimistic concurrency and idempotency.
- Derived public Trust Profiles.
- Admin records and validation reporting.
- Domain, browser, and end-to-end workflow tests.

## Partially implemented

- Authentication exists but is unavailable when `TRUSTLINK_STORAGE=local`.
- Private evidence works only with configured Supabase Storage.
- Average rating and repeat-client metrics are calculated but not fully presented.
- Notification intents are stored, but no delivery worker or notification inbox exists.
- Account settings are incomplete.
- Operational dispute processes are not represented outside the technical workflow.

## Existing pilot/mock areas

- Career Explore catalog.
- Pathfinder recommendations.
- Practice-project catalog.
- Illustrative opportunities.
- The example Amaka profile.
- Homepage example transaction.

## Known product and engineering gaps

- Hosted Supabase staging is not verified.
- Current local configuration cannot complete account-based flows.
- No password recovery or full account management.
- No rate limiting, malware scanning, retention worker, production monitoring, or tested backup recovery.
- No provider marketplace, service catalog, availability, booking request, or customer dashboard.
- No real notification delivery.
- Some Explore taxonomy links and claims are inconsistent.
- Admin and reputation queries need pagination or aggregation for scale.
- No formal accessibility, security, privacy, or legal review.

Before Phase 1, rerun the baseline checks and update this list if repository truth differs.

---

# 3. Product boundaries

## This expansion includes

- Public provider discovery.
- Service/category search.
- Nigerian state and LGA filters.
- Optional nearby search using browser location permission.
- Provider service offerings and service areas.
- Provider availability and blackout periods.
- Public Trust Profiles grounded in real records.
- Authenticated customer accounts.
- Booking requests containing date, time, duration, location mode, and job description.
- Provider booking inbox and response flow.
- Conversion of an accepted booking opportunity into the existing transaction engine.
- Client and provider status views.
- In-app notifications and an email-delivery boundary.
- Reviews only after eligible completed transactions.
- Admin moderation and marketplace operations.

## Explicitly out of scope unless separately approved

- TrustLink-held funds or escrow.
- Card, bank-transfer, or wallet processing.
- Claims that a direct payment is protected, insured, verified, or refundable.
- Automatic background checks or identity verification without a real vendor and policy.
- A numerical “Trust Score.”
- Paid search ranking or sponsored provider placement.
- Customer-to-customer messaging or a social feed.
- Live location tracking.
- Publishing exact provider home coordinates or exact customer addresses.
- Native mobile applications.
- A full learning-management system.
- Real job-board functionality for the existing opportunity pilot.

If a feature depends on an external service that is not configured, create a truthful integration boundary and report the dependency. Do not simulate a successful external operation in a production route.

## Pre-build decisions and recommended MVP defaults

These decisions resolve ambiguity between the earlier discovery brief and this implementation plan. Phase 0 must verify them against repository truth and record any founder-approved change before schema work begins.

- Nigeria is the initial service market and `Africa/Lagos` is the default presentation timezone. Store instants in a canonical server representation and retain the applicable timezone.
- `/providers` is the discovery directory and `/p/[username]` remains the one canonical public provider profile.
- `/account` is the customer workspace and `/dashboard` remains the provider workroom.
- One authenticated account may act as both customer and provider.
- The taxonomy has three layers: category → canonical service definition → provider service offering.
- The booking lifecycle is `REQUESTED → TERMS_SENT → CONFIRMED`; provider willingness alone is not final customer acceptance.
- Multiple customers may submit `REQUESTED` records for the same period. Sending final terms creates one expiring provider slot hold; customer acceptance turns it into a confirmed conflict block. Expired, declined, or cancelled holds must release atomically.
- Use 72 hours as the initial booking-request expiry and 24 hours as the initial final-terms hold, implemented as configuration rather than scattered constants. Phase 0 may recommend different values with a documented reason.
- An on-site request exposes only state, LGA, and a customer-supplied broad area before confirmation. An exact service address, if collected, remains private and is revealed to the authorized provider only after the customer accepts final terms.
- Do not expose price filters until enough providers use structured, comparable pricing.
- No map UI, calendar synchronization, SMS, escrow, or paid ranking is included in the first marketplace release.
- Career Explore remains a separate experiment and must not share terminology, routes, or data models with provider discovery.

---

# 4. Non-negotiable product decisions

## 4.1 Search for a service, not a “job”

Customer-facing search language should be:

- “What service do you need?”
- “Find a provider”
- “Search web developers, mechanics, photographers…”

Reserve “job” internally for the canonical transaction entity where required by existing code.

## 4.2 Browsing is public; booking submission requires an account

Visitors may:

- search providers;
- use filters;
- view public provider profiles;
- inspect public trust evidence.

They must sign up or sign in before submitting a booking request.

The existing guest-client private-link flow must continue to work for provider-originated transactions.

## 4.3 A booking request is not yet a confirmed order

Use truthful status and button language:

- “Request booking” when the customer first submits.
- “Prepare and send terms” when the provider wants to proceed.
- “Accept terms” when the customer reviews the final transaction record.
- “Booking confirmed” only after the required acceptance is stored.

Do not show a booking as confirmed merely because a request was sent.

## 4.4 The existing transaction is the source of truth after conversion

Booking requests must not reproduce transaction delivery, revision, evidence, dispute, payment-recording, completion, or review logic.

After a booking is converted, the canonical transaction controls the work lifecycle.

## 4.5 Reviews require real eligibility

A marketplace customer may review a provider only when:

- the customer is an authorized participant in the transaction;
- the transaction is completed;
- the customer has not already submitted a review for that transaction.

There must be no standalone review-creation endpoint based only on provider ID.

## 4.6 Trust is evidence, not decoration

Do not use fake verified badges, fake client counts, fake completion totals, fake response times, fake availability, or generated testimonials.

Empty providers must display honest empty states.

---

# 5. Users, roles, and authorization

## Visitor

Can search, filter, and view public profiles. Cannot submit a request.

## Authenticated customer

Can:

- maintain basic account details;
- submit booking requests;
- view and cancel eligible requests;
- receive final transaction terms;
- participate in linked transactions;
- review completed eligible work.

Cannot:

- edit provider availability;
- view another customer’s requests;
- manipulate a transaction by changing an ID;
- review a provider without a completed authorized transaction.

## Provider

Is an authenticated account with an enabled provider profile. Can:

- manage public services, service areas, availability, and profile content;
- receive booking requests addressed to that provider;
- decline a request;
- prepare final terms and create a canonical transaction from a request;
- use all existing provider transaction features.

## Administrator / operations user

Can perform explicitly authorized moderation and operational actions. Admin authorization must continue to come from trusted server-side application metadata, not user-editable profile fields.

## Account model rule

A single authenticated person may be a customer and a provider. Do not force separate logins.

Preserve the existing `profiles` and transaction foreign-key relationships where practical. Prefer an additive provider extension such as `provider_profiles` over a destructive rewrite. Inspect the actual schema before choosing names or migrations.

---

# 6. Canonical customer journey

```text
Homepage
→ enter service
→ choose state/LGA or select “Use my location”
→ provider results
→ filter and sort
→ open provider profile
→ select a provider service
→ select date, time, duration, service location mode, and describe the work
→ sign up/sign in if required
→ review request summary
→ submit request
→ provider receives request
→ provider declines OR prepares final TrustLink terms
→ customer reviews exact scope, fee, deadline, revisions, and provider
→ customer accepts
→ existing TrustLink lifecycle begins
→ provider records direct payment if received
→ work, delivery, revisions/dispute, approval, and completion
→ customer leaves one eligible review
→ Trust Profile aggregates update
```

The flow must survive reloads, expired sessions, duplicate clicks, stale versions, and notification retries.

---

# 7. Canonical provider journey

```text
Provider signs up
→ completes account basics
→ enables provider profile
→ chooses service categories
→ creates one or more service offerings
→ selects state/LGA/service radius or remote availability
→ sets availability and blackout dates
→ publishes discoverable profile
→ receives booking request
→ reviews customer request
→ declines OR creates final transaction terms from request
→ customer accepts
→ provider manages the work in the existing dashboard
→ completed record and eligible review contribute to Trust Profile
```

The original provider-originated journey remains available:

```text
Dashboard → Create TrustLink → Send private link to existing client
```

---

# 8. Route and navigation architecture

Confirm final naming against the repository, but use this product structure as the target.

## Public routes

```text
/                         discovery-led homepage plus TrustLink explanation
/providers                provider search results
/providers?service=...    URL-synchronized non-sensitive filters
/p/[username]             public Trust Profile and service offerings
/how-it-works             explains both discovery and direct-link journeys
/for-providers            provider acquisition and workflow
/for-businesses           customer/business workflow
/login
/signup
/privacy
/terms
```

Keep `/explore`, `/pathfinder`, `/learn`, and `/opportunities` secondary or feature-flagged until the founder decides their long-term role. They must not compete with “Find a provider” or “Create a TrustLink” in primary navigation.

## Customer account routes

```text
/account
/account/bookings
/account/bookings/[id]
/account/transactions
/account/settings
```

## Provider workspace

Preserve existing `/dashboard` transaction routes and add:

```text
/dashboard/requests
/dashboard/requests/[id]
/dashboard/services
/dashboard/services/new
/dashboard/services/[id]/edit
/dashboard/availability
/dashboard/profile
```

## Primary navigation

```text
Find a provider
How it works
For providers
For businesses

Log in
Create a TrustLink
```

Authenticated navigation should expose the relevant customer account and provider dashboard without pretending they are separate identities.

---

# 9. Marketplace data architecture

Names below are conceptual. Reconcile them with the existing migration conventions and generated types.

## Required entities

### `service_categories`

- stable ID and slug;
- display name;
- optional parent category;
- description;
- active and sort-order fields.

Start with a curated taxonomy. Do not allow providers to create arbitrary top-level categories without moderation.

### `service_definitions`

- stable ID and slug;
- parent category;
- canonical display name;
- approved aliases, synonyms, and common search terms;
- active and moderation fields.

For example, “web developer,” “website designer,” and “build a business website” may match the Website Development definition without becoming three unrelated categories. Do not hardcode synonym logic across React components.

### `nigeria_states` and `nigeria_lgas`

- stable codes and official display names;
- LGA-to-state foreign key;
- active/version metadata for the imported reference dataset;
- provenance documented in the repository.

Do not invent, silently correct, or duplicate location names in UI files.

### `provider_profiles`

- profile/account foreign key;
- discoverability status;
- public business/display name where different;
- public headline and bio extension where needed;
- remote-service flag;
- response/booking policy fields only if based on real behavior;
- moderation state;
- published timestamp.

### `provider_services`

- provider;
- canonical service definition and derived category;
- provider-specific public title;
- service title and plain-language description;
- pricing model: fixed, starting-at, hourly, daily, or quote-required;
- optional price or price range;
- duration options where meaningful;
- active/published state;
- remote or on-site support.

Price displayed on search/profile pages is indicative until exact transaction terms are accepted.

### `provider_service_areas`

- provider and optionally service;
- Nigerian state code;
- LGA code;
- remote-service flag;
- approximate provider/service origin only when opted in;
- service radius in kilometres where relevant.

Never expose precise residential coordinates.

### `provider_availability_rules`

- provider;
- day of week;
- local start and end time;
- timezone;
- optional service association;
- effective date range.

### `provider_unavailability`

- provider;
- start and end timestamps;
- reason visible only to the provider unless intentionally public;
- source such as manual block or confirmed transaction.

### `booking_requests`

- public opaque ID;
- authenticated customer ID;
- provider ID;
- selected provider service/category;
- customer’s plain-language request;
- requested start date/time;
- timezone;
- duration in minutes;
- remote/provider-location/customer-location mode;
- state and LGA where relevant;
- private address details only if needed and authorized;
- indicative budget where supported;
- currency, initially NGN;
- canonical status;
- optimistic version;
- expiry timestamp;
- linked transaction ID once converted;
- final-terms hold expiry where applicable;
- created/updated timestamps.

### `booking_events`

Append-only request history:

- request created;
- provider declined;
- customer cancelled;
- request expired;
- provider created final terms;
- client accepted linked transaction.
- temporary slot hold created, released, or converted where those are separate auditable events.

Use the same actor, authorization, idempotency, and immutable-event principles as the transaction ledger.

## Optional later optimization

Add a materialized provider-search projection only after query evidence shows it is needed. Begin with indexed relational queries and measured performance.

## Database requirements

- Foreign keys and check constraints.
- Unique slugs where required.
- Version fields for concurrent mutations.
- Indexed category, provider, state, LGA, status, and date fields.
- Search indexes for canonical service names and approved aliases.
- RLS or equivalent server authorization for every private table.
- Generated TypeScript types updated with schema changes.
- Atomic functions/transactions for request-to-transaction conversion.
- No use of elevated service credentials without explicit application authorization checks.

---

# 10. Booking request state machine

Use one server-enforced state machine.

```text
REQUESTED
├── DECLINED
├── CANCELLED
├── EXPIRED
└── TERMS_SENT
    ├── CANCELLED where policy allows
    ├── EXPIRED where policy allows
    └── CONFIRMED when the linked canonical transaction is accepted
```

`TERMS_SENT` means the provider has created and sent an exact TrustLink transaction record. It does not mean the customer accepted it.

After `CONFIRMED`, display progress from the linked transaction state rather than inventing duplicate booking statuses.

Every transition must validate:

- authenticated actor;
- actor role for that request;
- request ownership/provider assignment;
- current status;
- optimistic version;
- idempotency/replay behavior;
- linked transaction consistency;
- expiry;
- required fields.

Required duplicate and concurrency tests:

- submit request twice;
- provider declines twice;
- customer cancels twice;
- provider creates transaction twice;
- provider and customer act concurrently;
- stale form submits after a newer version;
- linked transaction acceptance event is retried.

---

# 11. Search, filtering, and ranking

## Search inputs

- Free-text service query.
- Curated category.
- State.
- LGA, dependent on selected state.
- Optional “Use my location.”
- Nearby radius such as 5, 10, 25, or 50 km.
- Remote service.
- Availability date.
- Price model/range only when the underlying data is sufficiently consistent.

## Sort options

- Best match.
- Nearest, only when location access is active.
- Most completed TrustLink transactions.
- Highest rated, with a minimum review-count policy to avoid misleading ranking.
- Earliest available, only after availability correctness is proven.

## Ranking principles

Ranking must be explainable and based on real fields:

- service/category match;
- service-area match or distance;
- availability match;
- completed transaction history;
- eligible review aggregates;
- delivery consistency where measurable;
- profile/service completeness.

Do not include paid placement in the first release. Do not present new providers as low quality merely because they have no history. Show honest “New on TrustLink” treatment without implying verification.

## Search-state behavior

- Synchronize non-sensitive filters with the URL.
- Validate all query parameters.
- Preserve filters when navigating back from a profile.
- Paginate results.
- Provide accessible loading, empty, error, and retry states.
- Never return seeded demo providers as though they are live.
- Use server-side queries for the source of truth; client-side filtering alone is not sufficient.

## Provider result-card contract

Each result is a compact evidence summary, not a generic gig-marketplace advertisement. Show only supported fields:

- provider or business name;
- matched provider service;
- state/LGA or broad service area;
- remote, in-person, or both;
- concise headline;
- completed TrustLink transaction count;
- average eligible rating with review count, only when reviews exist;
- delivery consistency only when the calculation is valid and the sample policy is met;
- availability indicator only when it has been server-revalidated.

Primary actions are `View profile` and `Request booking`. New providers must receive an honest “New on TrustLink” treatment without fake ratings or suspiciously perfect defaults.

## Search empty-state contract

Never fabricate results to fill the page. Suggest useful, real recovery actions:

- remove the LGA filter and search the wider state;
- increase the nearby radius;
- include remote providers where the service supports remote delivery;
- choose a broader canonical service;
- clear the requested date.

---

# 12. Location and privacy rules

## State and LGA

Use a maintained Nigerian state/LGA reference list with stable codes, not provider-entered spelling variations. Cascading state/LGA controls must be accessible by keyboard and screen reader.

The imported dataset's source, license, retrieval date, normalization rules, and integrity checks must be documented. Do not treat an AI-generated list as authoritative location data.

## Nearby search

Location access must:

1. Begin only after a user presses “Use my location.”
2. Explain why location is requested.
3. Work when permission is denied.
4. Avoid persistent storage unless the user explicitly saves a location.
5. Avoid exposing coordinates in analytics, logs, public HTML, or provider profiles.
6. Use only the accuracy required for distance matching.

Use PostGIS or another measured server-side geospatial strategy in hosted PostgreSQL. If local fixtures need a fallback, clearly separate it from production behavior and test both.

## Private service addresses

Do not reveal a customer’s exact address in public search, public profile output, notification previews, or unauthorized booking projections. Define precisely when an accepted provider may see it.

---

# 13. Homepage product structure

The homepage must serve discovery without erasing TrustLink’s transaction identity.

Recommended hierarchy:

```text
Primary proposition
“Find the right provider. Keep the work on record.”

Service + location search
Popular service categories
Real provider result preview or honest empty/local state
How provider discovery becomes a TrustLink transaction
The signature Transaction Record object
Trust evidence explained without fake claims
Provider and business paths
Create a TrustLink for an existing client
Footer/legal content
```

The top search should support examples such as:

- website developer;
- mechanic;
- electrician;
- photographer;
- tailor;
- cleaner.

Do not use fake live counters, fake nearby providers, fake testimonials, or fake booking activity. If no real provider data exists, show category exploration and a truthful onboarding invitation.

The transaction record remains TrustLink’s signature visual object.

---

# 14. Public provider profile

The profile should help a customer decide whether the provider fits the work.

## Profile information

- Provider name/business name.
- Clear description and service categories.
- Service offerings.
- State/LGA or broad service area.
- Remote/on-site availability.
- Indicative price model.
- Availability entry point.
- Completed TrustLink transaction count.
- Average eligible rating, only when reviews exist.
- Delivery consistency where supported by evidence.
- Repeat-client activity where correctly derived.
- Selected completed transaction history where safe and public.
- Client reviews tied to completed records.
- “Request booking” action.

## Profile rules

- No default five-star rating.
- No default 100% success rate.
- No fake “verified” identity or skill label.
- Private job descriptions and private evidence must not leak into the public profile.
- Clear empty states for a new provider.
- Public profile content must be sanitized and bounded.

---

# 15. Availability and scheduling rules

Availability is a constraint, not a promise.

- Store timestamps consistently and record the relevant timezone. Use `Africa/Lagos` as the Nigerian MVP presentation default.
- Present times in the viewer’s intended timezone with clear labels.
- Prevent end time before start time and invalid duration.
- Prevent selection outside published working hours.
- Respect blackout intervals.
- Recheck availability on the server at submission time.
- Allow multiple unconfirmed `REQUESTED` records to target the same slot without promising availability.
- When the provider sends final terms, atomically create an expiring hold and reject conflicting active holds or confirmed transactions under the provider's capacity policy.
- Convert the hold to a confirmed conflict block when the customer accepts the linked transaction; release it on expiry, decline, cancellation, or failed conversion.
- Do not claim real-time availability if it is not revalidated.

For the MVP, a request may be submitted for a currently available slot, but the slot is not guaranteed until final terms are accepted.

## Booking form interaction contract

Keep the customer experience to a small number of understandable steps:

```text
1. Service
2. When
3. Where
4. Details
5. Review and request
```

The final review must show provider, service, date, time, `Africa/Lagos` timezone label, duration, location mode/area, indicative budget or price, and customer note. The primary action is `Request booking`, never `Pay now`.

If authentication interrupts submission, preserve only the minimum safe draft data, restore it after successful authentication, revalidate everything on the server, and ask the customer to review before persisting the request.

---

# 16. Notifications

Build on the existing notification-intent boundary.

## Required in-app notifications

- booking request received;
- booking request declined;
- final terms sent;
- final terms accepted;
- transaction delivery submitted;
- revision requested;
- dispute opened or updated;
- transaction completed;
- review received.

## Delivery architecture

- Domain event creates an idempotent notification intent.
- A delivery worker processes eligible intents.
- Delivery attempts and failures are recorded.
- User preference and required operational messages are distinguished.
- Email links lead to an authorized route and do not disclose private content in the subject/preview.
- Retries cannot send unlimited duplicates.

Do not mark email as delivered merely because an intent was inserted.

---

# 17. Current Explore pilot decision

The existing career/pathfinder/learning/opportunities pilot is not the provider marketplace.

Before public marketplace launch, choose one of these strategies and document the founder’s decision:

1. Keep it as a clearly secondary research area behind “Career tools.”
2. Feature-flag it out of primary production navigation.
3. Remove it in a later separately approved cleanup.

Regardless of strategy, fix existing misleading or broken behavior before presenting it publicly:

- consume the career filter where promised;
- correct slug mismatches;
- remove unsupported portfolio-upload claims;
- state clearly that illustrative opportunities are not real vacancies;
- ensure it does not visually compete with provider discovery.

Do not delete it without explicit authorization.

---

# 18. Phased execution roadmap

Each phase has an entry condition, deliverables, proof, and a stop gate. Execute one phase at a time.

## Phase 0 — Fresh repository baseline and architecture decision record

### Objective

Confirm repository truth before any implementation.

### Work

- Inspect `AGENTS.md`, repository status, routes, components, domain services, repositories, migrations, tests, and environment boundaries.
- Read relevant local Next.js 16 documentation.
- Run the existing baseline checks.
- Record the starting commit and full working-tree status. Propose a branch/tag/checkpoint if useful, but do not create commits, branches, tags, or overwrite user changes without authorization.
- Map the exact current schema and authorization model.
- Identify overlapping uncommitted files.
- Produce an architecture decision record for the additive marketplace design.
- Confirm the final naming of customer, provider, booking, and transaction concepts.
- Verify the provenance and license of the Nigerian state/LGA dataset selected for Phase 3.
- Confirm or explicitly record the recommended MVP defaults for request expiry, final-terms holds, exact-address disclosure, timezone, and provider capacity.
- Report whether hosted Supabase credentials and required project access exist for Phase 1.

### Required validation

```text
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser
npm run test:workflow
```

Use existing fixture requirements correctly. Do not misreport an environment failure as a product failure.

### Gate

No code changes beyond documentation or isolated test-harness correction. Stop and report any baseline regression or unsafe overlap.

## Phase 1 — Activate and verify hosted Supabase staging

### Objective

Make account-based and storage-based behavior testable in a real staging environment.

### Work

- Configure a non-production Supabase project using credentials supplied through the approved environment mechanism.
- Apply migrations in order.
- Regenerate/check database types.
- Configure Auth callback URLs and email confirmation.
- Configure private Storage and policies.
- Run hosted preflight.
- Verify session refresh, cross-user isolation, service-role boundaries, private evidence, rollback, and concurrent writes.
- Document backup and restoration capabilities without claiming they were tested unless actually tested.

### Required validation

```text
npm run supabase:hosted:preflight
npm run typecheck
npm test
npm run test:workflow
```

### Gate

Do not begin marketplace accounts or booking persistence until hosted authentication and migrations work in staging. If the founder has not supplied a Supabase project, stop with an exact dependency report; do not fabricate it.

## Phase 2 — Stabilize existing product and essential account safety

### Objective

Close known customer-facing breaks and security prerequisites before adding public mutation surfaces.

### Work

- Implement password recovery and honest confirmation-failure messaging.
- Add minimum rate limiting to auth, capability exchange, transaction actions, and evidence uploads.
- Define CSP/HSTS deployment policy compatible with the app.
- Fix Explore query/slug mismatches and remove unsupported claims.
- Remove or quarantine stale local data only after confirming it is unused.
- Add monitoring/error-reporting boundary and operational logs that exclude secrets/private evidence.
- Add upload-retention/orphan-cleanup design; implement what can be safely automated in staging.

### Gate

Core workflow tests must remain green. Security controls must fail closed without breaking valid participants.

## Phase 3 — Marketplace schema, policies, and booking domain

### Objective

Create the additive database and domain foundation without building the public UI.

### Work

- Add curated service categories and canonical service definitions with approved search aliases.
- Add validated Nigerian state/LGA reference data with provenance and integrity checks.
- Add provider marketplace profile extensions.
- Add services, service areas, availability, blackout periods, booking requests, and booking events.
- Add server-enforced booking state machine.
- Add repositories/interfaces for local fixtures and Supabase only where the architecture requires both.
- Add RLS/policies and application authorization.
- Add version and idempotency constraints.
- Add expiring slot-hold and release semantics.
- Implement atomic request-to-transaction conversion boundary.
- Update generated database types.

### Tests

- schema constraints;
- role authorization;
- cross-customer and cross-provider isolation;
- all legal and illegal transitions;
- duplicate/retry behavior;
- stale versions;
- conversion rollback;
- booking/transaction linkage.

### Gate

No marketplace form may be exposed until unauthorized reads/writes and duplicate conversion are proven to fail safely.

## Phase 4 — Unified account roles and onboarding

### Objective

Allow one account to act as a customer and optionally enable a provider profile.

### Work

- Make signup language role-neutral where appropriate.
- Preserve existing providers and their profile URLs.
- Add customer account basics.
- Add “Become a provider” onboarding.
- Collect only required profile information.
- Add provider profile draft/published/moderation states.
- Add account and provider navigation with clear context.
- Ensure guest private-link clients remain supported.

### Tests

- new customer signup;
- existing provider login;
- customer enabling provider mode;
- one account switching between customer and provider workspaces;
- unauthorized dashboard access;
- migration compatibility with existing fixture providers.

### Gate

Existing providers and direct-link clients must not lose access or history.

## Phase 5 — Provider services, service areas, and availability

### Objective

Give providers the minimum tools required to appear honestly in search and receive relevant requests.

### Work

- Service CRUD with category, description, price model, and delivery mode.
- State/LGA service-area selection.
- Optional approximate origin and radius for nearby results.
- Weekly availability rules and blackout periods.
- Preview public profile before publishing.
- Publish/unpublish and discoverability controls.
- Server validation and field-level errors.

### Tests

- provider ownership;
- category and price validation;
- invalid state/LGA combinations;
- overlapping/invalid availability;
- unpublished services excluded from search;
- exact coordinates excluded from public projections.

### Gate

Only providers with a published marketplace profile and at least one active service may appear in search.

## Phase 6 — Provider search and discovery-led homepage

### Objective

Make it possible to find relevant providers from the homepage.

### Work

- Replace or recompose the homepage hero with service and location search.
- Build `/providers` with real server-backed results.
- Add category, state, LGA, remote, optional date, and pagination controls.
- Add optional nearby search with explicit browser permission.
- Add validated URL query state for non-sensitive filters.
- Implement transparent ranking and sort choices.
- Add loading, empty, denied-location, error, and retry states.
- Preserve the transaction-record explanation and direct “Create a TrustLink” path.

### Tests

- text/category matching;
- state/LGA filtering;
- nearby radius boundaries;
- permission denied/unavailable geolocation;
- invalid query parameters;
- no private fields in result payload;
- pagination and stable sorting;
- zero-results recovery;
- mobile filtering and keyboard use.

### Gate

Search must never display unpublished providers, inactive services, precise coordinates, or demo records presented as live.

## Phase 7 — Public profile and booking-request creation

### Objective

Let a visitor evaluate a provider and an authenticated customer submit a complete request.

### Work

- Extend `/p/[username]` with real service offerings, service area, evidence-backed aggregates, and availability entry.
- Add booking form for service, date, time, duration, delivery/location mode, description, and optional budget.
- Keep form progress through authentication where safe.
- Revalidate provider/service/availability on the server.
- Present a review summary before submission.
- Create `REQUESTED` record and event atomically.
- Add request confirmation page.

### Tests

- anonymous browser redirected to auth at submission, not at browsing;
- safe return to pending form after auth;
- provider cannot book self unless explicitly supported later;
- invalid/inactive service;
- slot changed before submission;
- double submission;
- private address projection;
- XSS/content bounds;
- responsive date/time interaction.

### Gate

A request confirmation must reflect persisted server state, not optimistic UI alone.

## Phase 8 — Provider request inbox and transaction conversion

### Objective

Allow the provider to respond and safely convert a request into final TrustLink terms.

### Work

- Add provider request list, detail, filters, and unread state.
- Present request groups using truthful states: New (`REQUESTED`), Awaiting customer (`TERMS_SENT`), Confirmed (`CONFIRMED`), Declined, Cancelled, and Expired. Active/completed work is derived from the linked transaction rather than duplicated.
- Add decline action with optional bounded reason.
- Add “Prepare and send terms” action prefilled from the request.
- Require provider review of scope, deliverables, fee, deadline, revisions, and cancellation text.
- Atomically verify availability, create the expiring slot hold, create exactly one linked transaction, append auditable events, and set the request to `TERMS_SENT`.
- Notify the customer.
- When the customer accepts the canonical transaction, mark the booking `CONFIRMED` through an idempotent domain handler.
- Use the existing transaction workspace for all later work.

### Tests

- wrong provider access;
- duplicate conversion;
- conversion rollback;
- conflicting slot holds and hold expiry/release;
- stale request version;
- provider decline/customer cancel race;
- request snapshot to transaction mapping;
- linked transaction acceptance synchronization;
- existing provider-created transaction flow remains unchanged.

### Gate

There must be one transaction at most per request, and final terms must be visible to the customer before acceptance.

## Phase 9 — Customer account and booking status experience

### Objective

Give customers a persistent place to manage requests and linked transactions.

### Work

- Customer overview with pending actions.
- Booking request list and details.
- Cancellation where policy permits.
- Clear request, terms-sent, confirmed, declined, expired, and linked-transaction states.
- Customer transaction list linking into authorized transaction views.
- Account settings and recovery entry points.
- Honest empty/loading/error/unauthorized states.

### Tests

- ownership isolation;
- cancelled/expired action restrictions;
- reload persistence;
- direct-link guest behavior remains separate and functional;
- mobile navigation and assistive-technology status announcements.

### Gate

Changing a booking or transaction ID must never expose another user’s data.

## Phase 10 — Notification inbox and delivery worker

### Objective

Make booking and transaction actions reach the responsible participant.

### Work

- Add notification list, unread count, read state, and deep links.
- Add idempotent worker/queue boundary for email.
- Implement retry limits, failure records, and observability.
- Add user preferences for optional messages while preserving required operational notices.
- Protect private details in notification content.

### Tests

- one intent per unique event/recipient;
- retry without duplicate sends;
- failed provider behavior;
- unauthorized deep links;
- preference enforcement;
- request and transaction notification matrix.

### Gate

Report in-app delivery and email delivery separately. An inserted intent is not a sent email.

## Phase 11 — Trust Profile, reviews, and marketplace integrity

### Objective

Make profiles useful for selection while keeping every trust claim defensible.

### Work

- Present average rating and repeat-client activity already correctly derived.
- Verify or implement aggregate queries that scale.
- Show review count alongside average.
- Explain new-provider empty states.
- Ensure marketplace and direct-link completed transactions follow one review eligibility policy.
- Add provider response-to-review only if moderation and abuse policy are ready.
- Add report-profile/report-review boundary if public launch requires it.
- Prevent private transaction fields from entering public search/profile projections.

### Tests

- no review before completion;
- no duplicate review;
- wrong customer;
- aggregation accuracy;
- deleted/unpublished/moderated content behavior;
- no fake defaults;
- performance with realistic fixture volume.

### Gate

Every public metric must be traceable to stored eligible records and named accurately.

## Phase 12 — Admin, moderation, abuse prevention, and operations

### Objective

Make the marketplace operable, supportable, and resistant to basic abuse.

### Work

- Paginated/searchable provider, customer, booking, transaction, dispute, and event views.
- Provider/service moderation state and audit history.
- Rate limits for search abuse, booking spam, and repeated mutations.
- Report/triage tools where policy permits.
- Booking expiry worker.
- Notification and upload failure queues.
- Orphan evidence cleanup and retention jobs.
- Monitoring, alerts, health checks, and incident runbook.
- Backup and restoration test in staging.
- Data-export/deletion design consistent with transaction-record retention obligations.

### Gate

Do not publicly launch mutation-heavy marketplace routes without abuse throttling, failure visibility, and a support process.

## Phase 13 — Premium visual refinement, content, accessibility, and SEO

### Objective

Unify discovery, profiles, booking, and transactions into one calm, credible product.

### Work

- Use the existing navy, teal, warm-neutral, restrained-radius system.
- Keep the Transaction Record as the signature TrustLink object.
- Avoid card walls, excessive pills, gradients, glow, floating objects, and fake trust theatre.
- Recompose mobile layouts rather than shrinking desktop UI.
- Use precise action copy.
- Add appropriate metadata, sitemap, robots policy, category/profile structured data only when truthful, canonical URLs, and sharing images.
- Run keyboard, focus, contrast, screen-reader, and reduced-motion review.

### Required viewports

```text
375, 390, 414, 430, 768, 1024, 1280, 1440, 1920
```

### Gate

No horizontal overflow, inaccessible dialog/filter interaction, misleading content, or broken no-JavaScript/server-rendered critical state.

## Phase 14 — Full staging QA and controlled launch readiness

### Objective

Prove the two entry paths converge safely and the product is operationally ready for controlled users.

### Required end-to-end journeys

#### Direct transaction path

```text
Provider creates TrustLink
→ shares private link
→ guest client accepts
→ payment is recorded honestly
→ work starts
→ delivery/revision or approval
→ completion
→ eligible review
→ profile aggregates update
```

#### Marketplace path

```text
Visitor searches service/location
→ filters providers
→ opens profile
→ signs up at booking submission
→ submits request
→ provider receives it
→ provider sends final terms
→ customer accepts
→ canonical transaction lifecycle completes
→ customer reviews
→ profile/search aggregates update
```

### Failure matrix

- wrong customer;
- wrong provider;
- wrong transaction;
- unpublished provider/service;
- stale availability;
- expired/cancelled request;
- duplicate request/action;
- concurrent provider/customer action;
- expired/revoked capability;
- invalid state transition;
- email worker failure;
- invalid/oversized/malicious evidence;
- private evidence access;
- location denied/unavailable;
- database/network interruption;
- rollback and retry;
- mobile and keyboard-only execution.

### Final validation

```text
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser
npm run test:workflow
npm run supabase:hosted:preflight
```

Also run formal accessibility and security checks selected for the staging environment.

### Gate

Use these labels accurately:

```text
Implemented
Locally tested
Hosted staging tested
Production configured
Externally verified
Not yet validated
```

Never say “production-ready” solely because builds and screenshots pass.

---

# 19. Cross-cutting engineering rules

## Server authority

- All meaningful mutations are server validated.
- React state is never the authority for ownership, availability, price, status, revision limits, or review eligibility.
- Sensitive projections are narrow and explicit.

## Security

- Treat public IDs as identifiers, not authorization.
- Validate session and ownership for every private operation.
- Preserve scoped client-capability protections.
- Enforce request-body limits and schema validation.
- Apply origin/CSRF protection where required.
- Sanitize or safely render user content.
- Never log capability tokens, session secrets, exact private addresses, or evidence contents.

## Data integrity

- Use transactions for multi-record state changes.
- Use optimistic versions and uniqueness constraints.
- Make retries idempotent.
- Append immutable domain events for meaningful lifecycle changes.
- Do not use client timestamps as authoritative lifecycle time.
- A transaction creation failure, booking-event failure, or hold creation failure must roll back the entire conversion. Never display partial success.

## Performance

- Paginate all potentially unbounded lists.
- Add indexes based on query plans.
- Avoid N+1 provider aggregate queries.
- Keep search payloads narrow.
- Measure before adding a separate search service.

## Accessibility

- Semantic controls and headings.
- Visible focus and correct focus restoration.
- Field-level validation tied to inputs.
- Screen-reader status announcements.
- Minimum practical touch targets.
- Reduced-motion support.
- Accessible date, time, location, filter, and dialog interactions.

## Content

Prefer concrete language:

```text
Find a provider
Request booking
Send final terms
Accept terms
Record payment received
Submit delivery
Request a revision
Open a dispute
Complete transaction
Leave a review
```

Avoid generic phrases such as “unlock,” “revolutionize,” “seamless,” and “game-changing.”

## Type and lint integrity

- Do not introduce `any`, `@ts-ignore`, disabled lint rules, or broad type assertions to hide implementation problems.
- Investigate editor diagnostics as well as command-line checks.
- Remove dead imports and unreachable phase-specific code introduced by the change.
- Do not replace a working dependency or architecture merely to use a preferred library.

---

# 20. Required phase report format

Before editing each phase, output:

```text
Phase:
Objective:
Current evidence:
Files likely affected:
Database/API impact:
Security risks:
Tests to add/run:
Explicitly out of scope:
```

After editing, output:

```text
Phase result:
Files changed:
Migrations added:
Behavior implemented:
Tests/checks passed:
Browser routes and viewports checked:
Known limitations/external dependencies:
Unrelated existing changes preserved:
Gate status: PASS or FAIL
Recommended next phase:
```

If the gate is `FAIL`, stop. Do not hide the failure by moving to visual work.

---

# 21. Final definition of done

The marketplace expansion is ready for controlled validation only when:

## Discovery

- real published providers can be searched by service;
- state/LGA filtering works;
- optional nearby search respects consent and privacy;
- results are paginated, explainable, and free of fake data;
- visitors can open a useful evidence-based profile.

## Booking

- signup/sign-in is required at request submission;
- date, time, duration, service, location mode, and description persist;
- provider receives the request;
- provider can decline or prepare exact final terms;
- request conversion produces one canonical transaction at most;
- customer accepts the final record before confirmation;
- booking and transaction state cannot drift silently.

## Existing transaction core

- direct provider-to-client links still work;
- payment semantics remain honest;
- evidence remains private;
- delivery, revisions, disputes, approval, completion, and review remain server enforced;
- concurrency and idempotency protections remain intact.

## Trust

- reviews come only from eligible completed transactions;
- public profile metrics derive from real records;
- empty/new profiles show no fabricated score;
- private data does not leak through search, notifications, profile pages, or metadata.

## Operations

- hosted staging Auth, database, Storage, and email boundaries are tested;
- rate limits and abuse controls exist;
- failures are observable;
- background jobs are retry-safe;
- backup restoration has been tested and documented;
- support and dispute responsibilities are explicit.

## Quality

- TypeScript, lint, build, domain, browser, workflow, and hosted preflight checks pass;
- major routes pass accessibility and responsive review;
- no known critical or high-severity security defect remains;
- claims accurately distinguish implemented, tested, configured, and verified behavior.

---

# Final directive to the coding agent

Preserve TrustLink’s strongest asset: the rigorous transaction record.

Add discovery and booking as an honest path into that record, not as a disconnected marketplace simulation.

Let visitors search before signing up. Require an account before a booking request is submitted. Let providers decide whether to proceed. Let customers inspect and accept the exact final terms. Then use the existing transaction engine for everything that follows.

Make location useful without becoming invasive. Make profiles persuasive through real evidence rather than badges. Make reviews difficult to fake. Make notification failures visible. Make every state transition explicit, authorized, persistent, idempotent, and testable.

Build the product in phases. Prove each phase before starting the next.
