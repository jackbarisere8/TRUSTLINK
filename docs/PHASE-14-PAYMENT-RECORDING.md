# Phase 14: payment recording

Phase 14 completes the explicit provider action for recording direct payment receipt. It uses the canonical `ACCEPTED` to `PAYMENT_RECORDED` transition and the recorded-payment evidence model established in Phase 9. It does not introduce payment processing, custody, protection, authorization, settlement, refunds, or independent transfer verification.

## Provider action

Only the provider sees **Record payment received**, and only while the transaction is `ACCEPTED`. The confirmation view displays the immutable agreed amount and currency rather than accepting an editable amount. The provider may add a transfer reference of up to 200 characters and a note of up to 2,000 characters; whitespace-only optional values are discarded.

The copy asks the provider to confirm direct receipt and states that TrustLink did not process or independently verify the transfer. Participant workspaces continue to label the resulting evidence as `Recorded payment`, `Reported by: Provider`, and `Payment verification: Not available`.

## Server transition

`jobCommandAction` resolves the current session and transaction relationship on the server. `TransactionService.execute` parses the command and operation UUID, reloads the current aggregate, and the canonical transaction engine then requires:

- the actor to be the transaction provider;
- the current state to be `ACCEPTED`;
- the submitted reference and note to satisfy their bounded schemas; and
- the immutable terms price to be positive and denominated in the canonical currency.

The amount is derived from the accepted transaction terms. It cannot be supplied or changed by the browser. One atomic commit inserts the payment declaration, changes the job to `PAYMENT_RECORDED`, increments its version, and appends one `PAYMENT_RECORDED` event with matching amount, currency, provider, timestamp, and `NOT_VERIFIED` semantics.

PostgreSQL retains the Phase 9 protections: one payment row per job, immutable payment evidence, exact payment/event linkage, request-ID uniqueness, compare-and-swap versioning, and transaction rollback when any check fails. The local repository validates the same aggregate invariants before replacing its record.

## Duplicate requests

The browser UI reuses one operation UUID for the same command and reviewed version, and disables the submitting control while the request is pending. An immediate replay returns the already-committed aggregate without another write. If two identical requests reach persistence simultaneously, one compare-and-swap wins; the other reloads the saved aggregate and resolves only when it finds the exact same actor, command hash, request UUID, and expected version. A different command or stale unrelated request still fails.

Regression coverage asserts that simultaneous identical service requests produce one payment and one payment event, blank optional fields normalize away, oversized fields fail schema validation, a stale database retry cannot add another row or event, and the provider sees the agreed value before confirmation.

## Deployment boundary

Phase 14 requires no new migration because the cumulative schema already contains the required payment uniqueness, ledger, atomicity, and immutable-evidence constraints. Apply the complete migration sequence documented in `docs/supabase-setup.md` to backed-up staging data. No hosted Supabase project was changed, and dynamic validation has not been recorded in this workspace for Phase 14.
