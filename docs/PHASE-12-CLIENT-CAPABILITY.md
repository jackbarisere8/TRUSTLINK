# Phase 12: secure client participant capabilities

Phase 12 separates a public transaction URL from authority to act. A client participant acts only with a transaction-specific bearer capability that the server verifies against the requested aggregate.

## Capability contract

Publication and link replacement generate 32 cryptographically random bytes and serialize them as a 64-character hexadecimal token. TrustLink stores only its SHA-256 hash and an expiry timestamp in the client `job_participants` row. A newly issued capability expires 30 days after generation. Plaintext capabilities are returned only in the one-time share URL fragment and are never stored, reconstructed, or returned by an idempotent replay.

The client component removes `#invite=…` from the browser address before it invokes the Server Action. That action validates the opaque public ID, reads the matching aggregate, verifies the supplied token with a timing-safe comparison, and exchanges it for two HTTP-only cookies: one scoped to that public transaction page and one scoped to that transaction's evidence endpoint. Both use `SameSite=Lax`, require `Secure` in production, and expire with the capability. Every private request resolves its scoped cookie name against the requested transaction and checks the stored hash and expiry again. Changing an ID, modifying a cookie value, using another transaction's token, or using an expired value fails authorization.

## Rotation and revocation

Providers can replace or revoke client access in every active transaction state. Replacement creates a fresh token/hash/expiry and appends `CLIENT_LINK_REISSUED`. Revocation clears both stored capability values and appends `CLIENT_LINK_REVOKED`. Neither action changes the lifecycle status. A revoked capability cannot act even if an old browser still holds its cookie; reopening a newly issued private link replaces that cookie.

The public transaction projection continues to omit both capability-management events as well as capability hashes, contacts, raw event metadata, payments, evidence, disputes, and reviews.

## Persistence enforcement

`20260922000002_secure_client_capabilities.sql` is the tenth cumulative migration. It permits the client capability hash and expiry to be absent only as a pair after revocation. Its trigger permits an initial active capability only with `JOB_SENT`, a replacement only with a matching `CLIENT_LINK_REISSUED` event, and a clear only with a matching `CLIENT_LINK_REVOKED` event. It rejects duplicate capability events, partial values, expired replacement values, and capability changes smuggled into another transition.

The local repository applies the same event-to-capability rule before its atomic file replacement. The domain policy, Zod command schema, trust-event actor map, SQL constraints, and local aggregate schema all recognize the new revoke action.

## Regression coverage

The focused cases cover expiry, rotation, explicit revocation, modified values, wrong transaction, wrong provider/actor, replayed rotate and revoke requests, and cross-user private access. Browser coverage also confirms fragment removal, cookie flags, post-revocation access loss, reissue, and modified-cookie rejection. PostgreSQL coverage now applies all eleven migrations and verifies that the database rejects an unrelated capability replacement.

Dynamic validation has not yet been recorded for this phase. No hosted Supabase project or credentials were changed; apply the complete migration sequence to backed-up staging data and verify real Auth, PostgREST, Storage, and historical records before production use.
