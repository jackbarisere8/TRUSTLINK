# Phase 15: work, delivery and revisions

Phase 15 completes the persisted provider/client workflow after payment is recorded. Providers can start work and submit a delivery. Clients can approve that delivery, request an included revision, or open a dispute. Each action uses the canonical transaction policy and appends one immutable event through the existing atomic aggregate commit.

## Canonical actions

The provider can select **Start work** only from `PAYMENT_RECORDED`. A client revision moves the record from `DELIVERY_SUBMITTED` to `REVISION_REQUESTED`; the provider then selects **Start revision** to return it to `IN_PROGRESS`. **Submit delivery** is available only to the provider from `IN_PROGRESS` and creates one delivery record with its description, private attachment paths, provider identity, and submission time.

From `DELIVERY_SUBMITTED`, the client can:

- approve the latest submitted delivery;
- request a revision while an included round remains; or
- open a transaction dispute.

The interface shows the remaining included revisions, removes the revision action when the allowance reaches zero, and directs the client to approve or dispute. The value is rendered from persisted terms and is also enforced in the domain, local repository, and PostgreSQL transaction. React state is never the authority for the allowance.

## Evidence authorization and linkage

Delivery and dispute forms accept up to ten private PDF, PNG, JPEG, WebP, or plain-text attachments of at most 10 MB each. The upload endpoint requires the transaction relationship, a same-origin request, an active action for the actor and current state, and an explicit `DELIVERY` or `DISPUTE` purpose before it writes private Storage and `evidence_files` metadata. The transition then accepts only unique paths owned by that same job and actor.

Every new delivery, revision, approval, and dispute event carries the identifier of the exact child record it describes. Delivery and dispute events also carry the attachment count; revisions carry their sequential revision number. Aggregate validation rejects missing, extra, reordered, duplicate, or mismatched evidence. Changing forms clears pending attachment paths so a file selected for one purpose is not silently submitted with another action.

## Persistence boundary

`20260924000000_work_delivery_revisions.sql` is the twelfth cumulative migration. Its preflight requires historical revision usage and the delivery, revision, and dispute event cardinalities to agree before installing new safeguards. The public commit wrapper locks the persisted predecessor, requires one newly appended event, validates the exact child-row delta, actor, state edge, evidence ownership, and server-side revision allowance, then delegates to the preceding atomic commit implementation.

Deferred record/event constraints make each new delivery, revision, and dispute row require its matching event and make each new event require its matching record. Delivery and revision evidence cannot be updated, deleted, or truncated. A dispute can update only its resolution fields; its original claim and evidence remain immutable. The aggregate reader now gives child rows a stable timestamp-and-ID order so both persistence layers resolve the latest delivery consistently.

The local repository applies the same evidence counts, record/event identifiers, predecessor states, immutable history, sequential revisions, and included-revision limit before replacing its file atomically.

## Regression coverage and deployment

Focused source coverage exercises the complete payment-to-start-to-delivery-to-revision-to-redelivery flow, forged work starts, missing or mismatched delivery records, duplicate attachment paths, immutable delivery rows, event linkage, and a second revision beyond a one-round allowance. The browser workflow confirms that the exhausted revision action disappears before the client opens a dispute.

Dynamic validation has not been recorded for Phase 15 in this workspace. No hosted Supabase project or credentials were changed. Apply all twelve migrations to backed-up staging data in order, resolve any Phase 15 preflight failure from the source records, and verify real PostgREST, private Storage, signed downloads, and historical constraints before production use.
