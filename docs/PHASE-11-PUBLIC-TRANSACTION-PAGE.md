# Phase 11: persisted public transaction page

Implemented for the request to continue with Phase 11 on September 22, 2026. `/j/[publicId]` is now a persisted-record page rather than a demo route.

## Public record contract

The page validates the opaque 24-character lowercase hexadecimal ID before querying storage. A missing, malformed, draft, or incomplete projection uses the route-local not-found boundary with the literal heading `Transaction Record Not Found`.

There is no exception for `sample-website-project` or any other demo identifier. Marketing examples remain explicitly unsaved visual previews at `/#preview`; example-profile history points there as well. A public agreement route only renders data that was committed through the transaction repository.

For a persisted record, the public page renders the service, scope, deliverables, fee and currency, deadline, revision terms, cancellation terms, provider name/headline/location/profile link, current state, and appropriate lifecycle history. The document and Open Graph metadata use the persisted service, provider display name, and current state only. Transaction pages remain noindex and use a no-referrer policy.

## Projection and privacy boundary

`PublicJobProjection` now contains only fields rendered by the public agreement. `PublicTrustEvent` contains only an event ID, an allowlisted event type, and its occurrence time.

`supabase/migrations/20260922000001_public_transaction_projection.sql` replaces `public_job_records` with the narrow agreement/provider projection and adds `public_transaction_events`. Both views are `security_invoker`, service-role-only, exclude DRAFT records, and deny browser database roles. The event view explicitly permits lifecycle events and excludes `JOB_VIEWED`, `CLIENT_LINK_REISSUED`, `CLIENT_LINK_REVOKED`, actor IDs, request metadata, payment references, evidence, and capability details.

Anonymous `/j/[publicId]` rendering reads only those two views. It does not call `tl_read_job`, so it cannot retrieve participant contacts, capability hashes, payment rows, delivery files, disputes, reviews, or raw trust-event metadata. A private aggregate is read only when a transaction-scoped capability is present, or when the server has recognized the provider or an administrator; private components remain gated by that resulting actor.

The local repository provides the same narrow projection so development storage cannot accidentally use an in-memory sample or a broader aggregate for public output.

## Verification

Verified locally on September 22, 2026:

| Check | Result | Scope |
|---|---:|---|
| `npm run db:types` | Passed | At Phase 11, rebuilt the generated contract from the then-current nine-migration sequence. |
| `npm run typecheck` | Passed | Checked the application and projection contracts. |
| `npm run lint` | Passed | No lint errors or warnings. |
| `npm test` | 34 passed | Validated the migration, public view grants, narrow event projection, domain boundary, and local repository behavior. |
| `npm run build` | Passed | Completed the production Next build with `/j/[publicId]` as a dynamic route. |
| `npm run test:browser` | 7 passed | Checked public routes, the explicit missing-record state, preview labeling, responsive layouts, and screenshots. |
| `npm run test:workflow` | 2 passed | Created a persisted transaction through the Supabase adapter/PGlite fixture and confirmed public terms, state, provider identity, lifecycle history, dynamic metadata, and absence of client/capability data. |

The workflow uses a test-only Auth, Storage, and PostgREST fixture backed by real PostgreSQL/PGlite. It does not prove hosted Supabase configuration.

No hosted Supabase project was changed. Apply all eleven migrations, including Phase 12's client-capability safeguards and Phase 13's acceptance safeguards, to backed-up staging data in order, then confirm the real PostgREST view behavior and existing historical data before production use.
