# Phase 13: persistent client acceptance

Phase 13 makes a client acceptance an auditable transaction transition rather than a browser-only acknowledgement. The client reviews the persisted agreement, supplies contact details, confirms the terms, and can accept only through the transaction-scoped capability established in Phase 12.

## Acceptance contract

`acceptJobAction` resolves the actor from the server-side capability cookie and rejects every non-client caller. `TransactionService.accept` then reads the current aggregate again, validates the capability against that exact transaction, parses the self-provided details and confirmation, checks the reviewed version and request UUID, and permits acceptance only from `SENT`.

The transition changes the record to `ACCEPTED`, persists the client participant details, and appends one `JOB_ACCEPTED` event. Repeating the same operation UUID returns the committed aggregate without another event. A fresh request after acceptance cannot replace the stored client details.

The supplied name, email, and optional phone are recorded as `SELF_PROVIDED`. They are not described as verified identity, email verification, or TrustLink verification. Acceptance also preserves the existing guest/account association; typed contact details cannot silently attach a TrustLink account.

## Agreement lock

Terms are immutable from publication apart from the operational `revisionsUsed` counter. On acceptance, `lib/domain/transactions/acceptance.ts` records a complete snapshot of the reviewed service, category, scope, deliverables, normalized NGN value, deadline, included revisions, and cancellation terms in the private event metadata. The mutable revisions-used counter is deliberately excluded.

`20260922000003_client_acceptance.sql` is the eleventh cumulative migration. Its public commit wrapper locks the persisted predecessor before any private state update, so a new `JOB_ACCEPTED` can originate only from `SENT` with one unused, unexpired participant capability. It also measures new and replacement capability expiry against the database clock, rather than a submitted timestamp. The ledger trigger validates the event against the current immutable `job_terms` row, requires `SELF_PROVIDED` provenance, and rejects altered or incomplete term snapshots. Its participant trigger allows details to move from the blank guest state only with one matching acceptance event, an active capability, and the `ACCEPTED` state, then rejects later edits. Existing historical acceptance records remain readable; the new forward-only trigger does not rewrite immutable ledger history.

The local repository applies the same agreement-snapshot, unexpired-capability, state, actor, and accepted-detail immutability checks before its atomic replacement. It upgrades legacy local acceptance events in memory with a snapshot derived from their already immutable terms. An identity-status-only historical record remains readable, but only `SELF_PROVIDED` projects as a client-detail provenance; unsupported historical labels project as `UNKNOWN`.

## Interface and security behavior

The public transaction route renders the persisted agreement terms before the private `Review & accept terms` control becomes available. The confirmation label identifies participant details as self-provided. The client-link fragment exchange now invokes its Server Action inside React `startTransition`, as required by the installed Next.js Server Actions guidance.

The acceptance snapshot remains private event metadata. Public projections still expose only the allowlisted `JOB_ACCEPTED` lifecycle marker, never client contact details, raw metadata, capabilities, payment details, evidence, or participant-only data.

## Regression coverage and deployment

Focused source coverage now checks the canonical terms snapshot, altered snapshots, forged acceptance without an active capability, immutable accepted details, local-store enforcement, PostgreSQL trigger enforcement, public redaction, and the complete eleven-migration fixture sequence. Dynamic validation has not yet been recorded for Phases 12 or 13.

No hosted Supabase project or credentials were changed. Apply the full migration sequence to backed-up staging data and verify historical records, real Auth, PostgREST, Storage, and the client-cookie flow before production use.
