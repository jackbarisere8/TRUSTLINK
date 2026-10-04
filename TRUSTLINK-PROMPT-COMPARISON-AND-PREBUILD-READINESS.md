# TrustLink prompt comparison and pre-build readiness

## Documents compared

1. `C:\Users\User\Downloads\TRUSTLINK-DISCOVERY-BOOKING-PHASED-BUILD-v1.md`
2. `C:\Users\User\TRUSTLINK\TRUSTLINK-MARKETPLACE-EXPANSION-MASTER-PROMPT-v3.md`

The downloaded v1 document was evaluated as product-specification input. It was not treated as an instruction to change application code.

## Executive verdict

The two documents agree on the main product direction:

- TrustLink gains public provider discovery and booking.
- Visitors can search before creating an account.
- Customers must authenticate before submitting a booking request.
- The direct provider-to-client TrustLink flow remains available.
- Discovery and booking converge into the existing transaction engine.
- Reviews remain tied to eligible completed transactions.
- Search, profiles, and design must use real evidence rather than invented trust signals.

The current master prompt is the stronger implementation authority because it includes:

- the verified repository baseline;
- hosted Supabase and operational prerequisites;
- a safer booking state machine;
- additive account-role architecture;
- transaction-conversion rollback and idempotency requirements;
- customer workspace, moderation, notifications, accessibility, SEO, and launch gates;
- explicit phase-by-phase tests and stop conditions.

The useful unique material from v1 has now been merged into the master prompt as Version 3.1.

## Comparison and resolution

| Area | Downloaded v1 | Master prompt v3.1 | Resolution |
|---|---|---|---|
| Product model | Two entry paths that converge | Same, with canonical customer and provider journeys | Keep v3.1 |
| Existing transaction core | Must be preserved | Preserved and treated as source of truth after conversion | Keep v3.1 |
| Terminology | Defines provider, service, discovery, booking, job, profile | Previously distributed across sections | Added a canonical terminology section to v3.1 |
| Service taxonomy | Category → service → provider service | Previously category → provider service | Added canonical `service_definitions` and aliases to v3.1 |
| Nigerian locations | Central `states`, `lgas`, and service areas | Stable state/LGA reference list | Added explicit reference entities, provenance, licensing, and integrity requirements |
| Search | Strong field/filter examples | Adds ranking, privacy, pagination, and server authority | Keep v3.1; merge examples |
| Provider result card | Detailed compact evidence contract | Previously implied by search/profile rules | Added explicit result-card contract |
| Empty search | Suggests wider area/remote/category | Previously required an empty state without exact recovery copy | Added recovery actions |
| Public profile | Extend `/p/[username]` | Same | No conflict |
| Booking distinction | Booking request is separate from job | Same | No conflict |
| Booking status | `REQUESTED → ACCEPTED/DECLINED/...` | `REQUESTED → TERMS_SENT → CONFIRMED` | Keep v3.1: provider action is not final customer acceptance |
| Provider acceptance | Accept and create/link transaction | Prepare and send exact terms, then client accepts | Keep v3.1 for stronger consent and transaction integrity |
| Scheduling | Working hours, blocks, accepted conflict | Availability rules and conflict policy | Added an expiring slot hold at `TERMS_SENT` and atomic release/confirmation rules |
| Timezone | Explicit `Africa/Lagos` | Generic applicable timezone | Added Nigerian MVP default while retaining canonical storage |
| Authentication interruption | Preserve booking draft | Same requirement in Phase 7 | Strengthened with minimum safe draft data and server revalidation |
| Provider inbox | New, pending, accepted, declined, upcoming, completed | Request list and linked transactions | Added truthful status grouping; active/completed remain transaction-derived |
| Notifications | Dashboard first; external delivery only when real | In-app plus idempotent email boundary | Keep v3.1 because it distinguishes intent, attempt, and delivery |
| Account recovery | Required before production | Included early in stabilization | Keep v3.1 |
| Hosted Supabase | Deferred to hardening in v1 | Early staging gate | Keep v3.1 because current local mode cannot authenticate or prove Storage/Auth behavior |
| Security | Strong checklist and rate limits | Adds operational controls, rollback, private projections, and launch gate | Keep v3.1 |
| Visual system | Strong screen-specific direction | Strong system-level direction and responsive/a11y gates | Both are compatible; v3.1 remains controlling |
| Career Explore | Freeze and keep separate | Secondary, feature-flag, or later authorized removal | Keep separate; do not delete without authorization |
| Source-control checkpoint | Create backup/tag/branch | Preserve dirty tree and inspect overlap | Record starting state; propose a checkpoint but do not mutate git history without authorization |
| Build phases | 11 broad phases | 15 dependency-safe phases | Keep v3.1 |

## Important conflict resolved

The downloaded v1 flow uses this concept:

```text
Customer request
→ provider accepts
→ booking is ACCEPTED
→ transaction is created
→ customer may still need to accept transaction terms
```

That uses “accepted” for two different legal/product moments. The controlling flow is now:

```text
REQUESTED
→ provider prepares and sends exact TrustLink terms
→ TERMS_SENT with an expiring slot hold
→ customer reviews and accepts the canonical transaction
→ CONFIRMED
→ existing transaction lifecycle controls later work
```

This keeps provider willingness separate from customer consent to the final scope, price, deadline, and revision terms.

## Additions made to the master prompt

Version 3.1 now contains:

- canonical product terminology;
- a category → service definition → provider offering taxonomy;
- searchable aliases/synonyms without duplicated frontend logic;
- explicit Nigerian state/LGA reference entities;
- location-data provenance and licensing requirements;
- `Africa/Lagos` as the initial presentation timezone;
- a provider result-card contract;
- honest empty-result recovery actions;
- a five-step booking interaction contract;
- safe booking-draft restoration after authentication;
- configurable request expiry and final-terms hold defaults;
- atomic slot holds, release, conversion, and conflict tests;
- truthful provider-inbox groupings;
- rollback requirements when a linked transaction, booking event, or hold fails;
- explicit bans on hiding failures with `any`, `@ts-ignore`, or lint suppression;
- source-control safety in Phase 0.

## Pre-build readiness status

### Ready now

The coding agent may start **Phase 0 only**:

- inspect repository instructions and local Next.js documentation;
- record the current commit and dirty working tree;
- rerun type, lint, build, domain, browser, and workflow baselines;
- inspect current schema, repositories, authentication, policies, routes, and test fixtures;
- produce the architecture decision record;
- verify the proposed Nigerian location dataset source;
- confirm which files Phase 1 would affect.

Phase 0 must not implement marketplace code.

### External prerequisite for Phase 1

The audited checkout currently uses `TRUSTLINK_STORAGE=local`, where authentication is deliberately unavailable. The master plan therefore requires a real non-production Supabase project before authentication-, Storage-, and migration-dependent marketplace behavior is treated as working.

Required external inputs:

- staging Supabase project URL;
- public/anon key through the approved environment mechanism;
- server/service credentials through the approved secret mechanism;
- permission to apply staging migrations;
- configured Auth callback URLs;
- email confirmation/reset setup;
- private Storage bucket/policies.

If these are unavailable, the agent should finish Phase 0, report Phase 1 as externally blocked, and stop. It must not replace real authentication with a fake production login.

### Decisions already safe to use

- Initial market: Nigeria.
- Default display timezone: `Africa/Lagos`.
- Public discovery route: `/providers`.
- Canonical public profile: `/p/[username]`.
- Customer workspace: `/account`.
- Provider workroom: `/dashboard`.
- Same account may be customer and provider.
- Public browsing does not require signup.
- Booking submission does require signup/sign-in.
- Provider sends final terms; customer accepts final terms.
- Reviews require an eligible completed transaction.
- No escrow, card processing, maps, calendar sync, SMS, paid ranking, or Trust Score in the first release.

### Recommended defaults to verify during Phase 0

- Booking request expires after 72 hours.
- Final-terms slot hold expires after 24 hours.
- Multiple raw requests can target the same time, but only one active hold/confirmed booking may consume provider capacity by default.
- Exact customer address remains hidden until final terms are accepted.
- Price filtering remains disabled until structured provider pricing is sufficiently reliable.

## Controlling document

Use [TRUSTLINK-MARKETPLACE-EXPANSION-MASTER-PROMPT-v3.md](C:/Users/User/TRUSTLINK/TRUSTLINK-MARKETPLACE-EXPANSION-MASTER-PROMPT-v3.md) Version 3.1 as the single implementation authority.

Do not give both prompt documents independently to coding agents. Doing so would reintroduce the conflicting booking status and phase order.
