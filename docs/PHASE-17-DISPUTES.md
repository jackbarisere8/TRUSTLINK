# Phase 17: disputes

Phase 17 completes the structured dispute workflow already rooted in the transaction aggregate. A dispute records the transaction, raising party, category, claim, private evidence, one response from the other party, status, operational resolution, resolver, and resolution time. The canonical categories remain Scope, Deadline, Quality, Payment, and Communication.

## Participant workflow

Either transaction party can open a dispute from an active accepted transaction. The server derives the raising party from the authenticated provider session or the active transaction-scoped client capability. It does not accept a caller-supplied identity. Opening a dispute pauses the job in `DISPUTED`, creates an `OPEN` dispute row, and appends `DISPUTE_OPENED` with the exact dispute ID, category, and evidence count.

Only the party that did not raise the dispute can submit `RESPOND_DISPUTE`. The response is required, trimmed, limited to 5,000 characters, and can be submitted once. It appends `DISPUTE_RESPONDED`, changes the dispute to `UNDER_REVIEW`, and leaves the job `DISPUTED`. The claimant cannot respond to their own claim, and neither participant can resume, complete, cancel, or resolve the transaction while it is paused.

The workspace shows the category, raising party, status, claim, authorized private evidence, other-party response, and resolution. It derives response-button visibility from the active dispute, while the domain and database independently enforce actor identity and state.

## Operational resolution

Only an administrator established from trusted Auth `app_metadata` can invoke `RESOLVE`. Resolution requires non-empty notes and an explicit outcome:

- `IN_PROGRESS` resumes the agreed work and still requires a recorded payment.
- `CANCELLED` closes the transaction record.

Both outcomes set the dispute to `RESOLVED`, record the administrator and timestamp, and append `DISPUTE_RESOLVED` with the exact dispute ID and outcome. Cancellation is an operational record decision. TrustLink does not hold funds, reverse a bank transfer, or issue a refund, and the UI states that boundary at resolution and in the resulting dispute record.

## Database integrity

`20260926000000_disputes.sql` is the fourteenth cumulative migration. It adds `DISPUTE_RESPONDED` to the typed ledger contract, constrains response and resolution shapes, locks the job and active dispute during validation, and purpose-checks the response actor against the original raising party. Mutable dispute fields can change only with their matching immutable response or administrator resolution event. Deferred constraints require both the event and final dispute row, while the original claim, category, raising party, evidence, identity, and creation time remain immutable.

The earlier persistence function did not write `response_from_other_party`. The Phase 17 wrapper preserves the stored row while the event commits, then writes the authorized response inside the same database transaction. Any failure rolls back the job version, event, status, and response together. Resolution continues through the atomic aggregate commit and now receives exact dispute/event linkage.

The migration stops if historical response text exists because the old model did not record who responded or when. Repair that provenance explicitly in backed-up staging rather than inventing an actor or timestamp. Older legitimate resolution events remain readable even though events created before Phase 17 did not carry a dispute ID; every new resolution must carry it.

## Verification and deployment

Focused coverage now includes claimant self-response rejection, exactly-one-response semantics, a paused `UNDER_REVIEW` state, forged responder rejection in PostgreSQL, immutable response and resolution text, administrator-only resolution, explicit outcomes, and the provider/client/admin browser sequence. Static source, migration-order, SQL-shape, and whitespace checks are recorded for this phase. Dynamic Node, PGlite, typecheck, build, and browser validation have not been run under the current execution restriction.

No hosted Supabase project or credentials were changed. Apply the complete migration sequence in order to backed-up staging data, resolve any historical preflight failure, validate the `NOT VALID` constraints after inspection, and exercise real Auth, PostgREST, and private Storage before production use.
