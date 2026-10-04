# Phase 9: payment semantics

Implemented for the request to continue with Phase 9 on September 21, 2026. TrustLink remains non-custodial and payment-neutral. This phase makes the existing provider declaration internally complete and harder to misrepresent; it does not add payment processing, bank-transfer verification, authorization, custody, protection, refunds or settlement.

## Canonical meaning

`PAYMENT_RECORDED` means the provider declared that the agreed transaction value was received directly from the client. The record contains the agreed amount and currency snapshot, optional transfer reference and provider note, recording time, `recordedBy = PROVIDER`, and `verificationStatus = NOT_VERIFIED`.

It does not establish that:

- TrustLink or a payment provider verified a transfer;
- the client made the transfer described by the provider;
- TrustLink held, protected, authorized, released or settled funds; or
- the declared amount is independently reconciled against a bank or PSP.

`lib/payments/types.ts` is the shared semantic declaration. The inactive future capability interface remains inert: every capability is false, payment creation throws, and verification explicitly returns `verificationAvailable: false` and `verified: false`.

## Persistence integrity

`supabase/migrations/20260921000003_payment_semantics.sql` adds `amount` and `currency` to `payments` and backfills them from immutable job terms. Before changing the table, it refuses histories with unsupported modes, actors, verification values, oversized notes, or mismatched payment/event timestamps.

New PostgreSQL declarations must:

- use `RECORDED`, `PROVIDER`, `NOT_VERIFIED` and `NGN` exactly;
- snapshot the positive agreed transaction value;
- occur during the `PAYMENT_RECORDED` transition and after transaction creation;
- have exactly one matching `PAYMENT_RECORDED` trust event with the same time, amount, currency and semantic metadata; and
- remain immutable after insertion, including update, delete and truncate attempts.

Duplicate rows replayed by the aggregate commit are accepted only when they exactly match the persisted row. An altered replay raises inside the same transaction, so the job state and new event roll back. The private validation functions remain unavailable to browser and service roles.

The aggregate reader serializes PostgreSQL numeric values as stable strings. Generated database types include the physical numeric column while the domain DTO retains the exact string representation used by validation and currency formatting.

## Local and interface behavior

The local schema requires the payment row and trust event to agree on amount, currency, actor, verification status and occurrence time. Existing local records without the Phase 9 snapshot are upgraded from their immutable terms in memory; explicit inconsistent values remain invalid.

Authorized provider and client-participant workspaces show a `Recorded payment` section with:

- `Recorded transaction value`;
- `Payment verification: Not available`;
- `Reported by: Provider`;
- recording date; and
- optional reference and provider note.

The section repeats that TrustLink did not process, verify, hold or protect the funds. Public visitors do not receive the payment row, reference or note. The public agreement continues to show only the transaction status and general non-custodial disclosure.

## Deployment boundary

No payment provider configuration or credential was added. No hosted Supabase project exists in this workspace, and no migration was applied remotely. Apply all seven migrations to backed-up staging data, repair any preflight failure rather than weakening it, and verify constraints, function privileges, PostgREST projection behavior and historical values before production use.

## Verification

Verified locally on September 21, 2026:

| Check | Result | Payment-semantic coverage |
|---|---|---|
| `npm run typecheck` | Passed | Seven-migration generated-type drift check and strict TypeScript |
| `npm run lint` | Passed | Application, migration support and test sources |
| `npm test` | 33 passed | Historical backfill, amount/currency/event alignment, provider-only declarations, immutable SQL/local evidence, rollback and unavailable adapter capabilities |
| `npm run build` | Passed | Production Next.js 16.3.5 compilation and route generation |
| `npm run test:browser` | 6 passed | Public routes, disclosures, responsive surfaces and client-side behavior |
| `npm run test:workflow` | 2 passed | Production Next.js, Supabase adapter and PostgreSQL/PGlite lifecycle; authorized recorded-value and unavailable-verification presentation |

The PostgreSQL test applies the Phase 9 migration both to a historical payment created before the normalized participant/ledger migrations and to a new current-schema lifecycle. It also verifies that altered payment evidence rolls back the attempted transition and that API roles cannot call the private payment functions.
