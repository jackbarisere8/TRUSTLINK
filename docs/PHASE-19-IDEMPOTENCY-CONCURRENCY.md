# Phase 19: idempotency and concurrency

Implemented for the request to continue with Phase 19 on September 26, 2026. This phase completes the retry contract for transaction mutations. It adds no product state, table, migration, notification system, or background queue.

## Operation contract

Acceptance and every later transaction command carry a client-generated UUID and the transaction version the user reviewed. The domain hashes the validated command and records the request ID, command hash, and expected version in the immutable event. Repeating the same actor, command, request ID, and reviewed version returns the persisted result without appending another event. Reusing that ID with another actor, payload, or version is rejected.

The browser retains one operation UUID for the same submitted payload and rendered version. A transport failure can therefore retry the same logical operation. A changed payload or refreshed version receives a new UUID. Creation uses its job UUID as a separate idempotency key; a retry returns the saved transaction only when the immutable submitted terms, source, and repeat-use classification still match. The plaintext client capability is never recovered on a creation retry.

## Concurrent writes

Both repositories implement compare-and-swap persistence. Local storage takes its exclusive writer lock, rereads the file, checks the expected version, and atomically replaces the validated document. PostgreSQL locks the job row, checks the expected version, validates the complete event prefix plus one new event, and persists the state, child row, evidence attachment state, and event in one transaction. A failed check leaves the earlier committed result intact.

`trust_events_request_once` uniquely constrains each non-null request ID within a job. Event sequence, child-record uniqueness, immutable history, and the phase-specific bidirectional record/event constraints remain additional defenses rather than substitutes for the version lock.

When two exact commands race, one commit wins. The service rereads after the losing compare-and-swap and returns success only if the persisted event has the same request ID, actor, command hash, and reviewed version. A distinct concurrent command remains a conflict.

Phase 19 extends this recovery to acceptance. It also moves delivery/dispute pending-evidence validation inside the service's new-operation commit attempt. An already committed exact replay is recognized before pending evidence is revalidated; if evidence becomes attached during the race, the recovery reread still proves the exact operation. New commands must continue to reference pending evidence, and PostgreSQL remains the final atomic attachment authority.

## Required retry cases

Focused source coverage now submits each required operation twice with the same request:

- accept;
- record payment;
- start work;
- submit delivery;
- approve delivery;
- request revision;
- open dispute; and
- submit review.

The coverage asserts one version increment and one event, simultaneous acceptance and payment recovery, rejection of altered creation payloads under a reused creation ID, skipped pending-evidence validation for an exact committed delivery replay, local competing-writer behavior, PostgreSQL stale-version rejection, and the unique request index.

## Verification boundary

No sixteenth migration is required because the cumulative schema already has the row locks, transaction wrapper, event-prefix checks, unique request index, and atomic child/event constraints. The setup sequence remains fifteen migrations.

This continuation was checked statically because Node, PGlite, typecheck, build, and browser execution are unavailable under the current command restrictions. No hosted Supabase project was configured or changed. Concurrent requests still require validation against the deployment's real PostgreSQL/PostgREST environment before production readiness is claimed.
