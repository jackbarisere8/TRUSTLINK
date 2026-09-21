# Phase 5: user, profile and participant model

Implemented for the user's request to continue with Phase 5, September 21, 2026. This phase separates account identity, application profile, provider profile and transaction participation without requiring a client account. It does not add the Phase 6 relational schema or claim that self-provided details verify a person's identity.

## Four separate models

| Model | Code boundary | Purpose |
|---|---|---|
| Auth identity | `AuthIdentity` in `lib/auth/contracts.ts` | Supabase-validated account ID, email and trusted account role |
| Application profile | `ApplicationProfileRecord` in `lib/db/types.ts` | Username, display name, avatar and location linked to an Auth user ID |
| Provider profile | `ProviderProfileRecord` in `lib/db/types.ts` | Provider headline, biography, service area and provider-profile status |
| Transaction participant | `TransactionParticipant` in `lib/domain/participants/index.ts` | A provider or client as a party to one transaction, with account/guest association and detail provenance |

`ProfileBundle` groups an application profile with its optional provider profile for repository reads; it does not merge their meanings. `resolveUserSession()` starts with a validated Auth identity and separately loads the linked application profile. Provider profile fields never grant an account role.

## Participant representation

Every participant projection has a transaction role, actor ID, display name, account association and detail status. Providers are account-associated. A client may be account-associated through `clientId`, but the implemented acceptance flow remains a guest-capability flow and does not require signup.

The detail-status vocabulary is:

```text
SELF_PROVIDED
EMAIL_VERIFIED
OTHER_VERIFIED
UNKNOWN
```

Acceptance currently records only `SELF_PROVIDED`. `EMAIL_VERIFIED` and `OTHER_VERIFIED` are modeled values for a future trusted verification process; no current UI or mutation assigns them. An invited client has `UNKNOWN` until acceptance. Existing acceptance events that predate the current metadata key are read through the historical `identityStatus` key, and a missing or unsupported value projects to `UNKNOWN` rather than a verification claim.

The provider participant uses `SELF_PROVIDED` because its displayed name comes from the application profile supplied during account setup. The provider-profile `verificationStatus` remains separate and is not converted into participant identity proof.

## Current persistence mapping

Phase 5 uses the existing aggregate without introducing the Phase 6 `job_participants` table:

- the provider account relationship is `jobs.provider_id`;
- an optional future client account relationship is `jobs.client_id`;
- accepted guest details remain in `jobs.client_name`, `client_email` and `client_phone`;
- the immutable `JOB_ACCEPTED` trust event stores logical `participantDetailStatus = SELF_PROVIDED` (`participant_detail_status` in PostgreSQL after the existing key normalizer).

The local schema requires accepted client details, a single acceptance event and a supported status value when one is present. It rejects client details before acceptance, duplicate acceptance events, conflicting legacy/current status values and invented labels such as `VERIFIED_IDENTITY`. Trust-event immutability protects accepted provenance after commit.

This mapping is an explicit compatibility model for the present aggregate. Phase 6 owns relational normalization into `job_participants`, database constraints and migration/backfill decisions. No migration was added in this phase.

## Projection and privacy

`transactionParticipants()` creates the private participant projection. Authorized provider, client-capability and administrator workspaces show:

- provider versus client-participant role;
- TrustLink-account versus guest association;
- the participant display name and private client contact details;
- plain-language provenance such as “Self-provided contact details.”

The component also states that these statuses are not proof of legal identity. Public agreement visitors continue to receive `PublicJobProjection`, which contains the public provider presentation and no client name, email, phone, account association or participant-status section. The participant projection is constructed only after a private actor has been resolved for `/j/[publicId]`, or inside an already-authorized dashboard/dispute workspace.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | Passed with strict mode |
| `npm run lint` | Passed without errors or warnings |
| `npm test` | 30 passed, including guest/account association, status persistence, unsupported-status rejection and public-event redaction |
| `npm run build` | Passed; all static and dynamic routes compiled |
| `npm run test:browser` | 6 passed; public routes and nine viewport widths remained clean |
| `npm run test:workflow` | 2 passed; the client workspace showed guest/self-provided status and the public outsider received neither the participant section nor client email |

The browser suites were run sequentially. The workflow uses the gated PGlite-backed Supabase fixture; no hosted Auth, database or Storage project was configured or validated.

## Remaining boundary

Possession of a private client capability authorizes actions for that transaction. It does not authenticate the human holder. Self-provided client contact details and provider profile details remain claims by the participants. A future email or other verification flow must record only the narrow fact it actually establishes, preserve its evidence and authority, and avoid converting contact-method confirmation into a legal-identity claim.

## Phase 6 supersession

The “Current persistence mapping” above records the Phase 5 checkpoint. Phase 6 subsequently migrated client details and capability fields from `jobs` into canonical `job_participants` rows while preserving the same domain aggregate projection. See `docs/PHASE-6-DATABASE-MODEL.md` for the current physical schema.
