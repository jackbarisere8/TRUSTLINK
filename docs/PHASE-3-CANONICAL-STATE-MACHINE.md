# Phase 3: canonical transaction state machine

Implemented for the user's request to continue to the next phase, September 21, 2026. Scope is lifecycle authority, authorization, versioning, idempotency and transition verification. No new product state, payment capability, schema migration or visual redesign was added.

## Authoritative model

`lib/domain/transactions/policy.ts` is the declarative source for every transaction action's allowed actor roles, previous states, next state and trust event. `lib/domain/transactions/state-machine.ts` applies that policy and owns the corresponding domain mutation. `TransactionService` rereads the aggregate and commits through the injected repository.

The transaction UI uses `isActionAvailable()` from the same policy to decide which controls to show. This is presentation only; every Server Action still resolves the actor on the server, and the state machine independently enforces participant relationship, role and state. PostgreSQL stores the allowed status/event vocabulary and performs atomic compare-and-swap commits. It does not contain a second transition graph.

Creation publishes directly to `SENT`; `DRAFT` remains reserved. The current model is:

| Action | Actor | From | To / event |
|---|---|---|---|
| Accept | Client capability | `SENT` | `ACCEPTED` / `JOB_ACCEPTED` |
| Record payment | Provider | `ACCEPTED` | `PAYMENT_RECORDED` / `PAYMENT_RECORDED` |
| Start work | Provider | `PAYMENT_RECORDED`, `REVISION_REQUESTED` | `IN_PROGRESS` / `WORK_STARTED` |
| Submit delivery | Provider | `IN_PROGRESS` | `DELIVERY_SUBMITTED` / `DELIVERY_SUBMITTED` |
| Request revision | Client capability | `DELIVERY_SUBMITTED` | `REVISION_REQUESTED` / `REVISION_REQUESTED` |
| Approve | Client capability | `DELIVERY_SUBMITTED` | `APPROVED` / `DELIVERY_APPROVED` |
| Complete | Provider | `APPROVED` | `COMPLETED` / `JOB_COMPLETED` |
| Cancel | Provider | `DRAFT`, `SENT` | `CANCELLED` / `JOB_CANCELLED` |
| Open dispute | Either participant | Accepted active states | `DISPUTED` / `DISPUTE_OPENED` |
| Resolve dispute | Admin | `DISPUTED` | Explicit `IN_PROGRESS` or `CANCELLED` / `DISPUTE_RESOLVED` |
| Review | Client capability | `COMPLETED` | State unchanged / `CLIENT_REVIEWED` |
| Replace link | Provider | Published, non-cancelled states except `DRAFT` | State unchanged / `CLIENT_LINK_REISSUED` |

Resuming a dispute as `IN_PROGRESS` still requires a recorded payment. Revision requests still enforce the agreed revision limit. A payment remains a provider report with `NOT_VERIFIED`; this phase adds no custody or transfer verification.

## Mutation contract

Acceptance and every command now require a UUID operation key and the version the user reviewed. The engine performs the checks in this order:

1. validate the input and operation request,
2. verify the participant relationship and current capability,
3. recognize an exact committed retry or reject operation-key reuse,
4. compare the reviewed version with the current aggregate,
5. enforce the action's role and previous-state rule,
6. apply the domain mutation and append the mapped event,
7. commit the aggregate and event atomically through the repository.

An exact retry returns the current aggregate without appending another row. Reusing the operation key with another actor, payload or expected version fails. A fresh payment, acceptance or review request after that one-time action has already happened fails clearly instead of being silently treated as success.

Client commands receive a server-resolved capability and `TransactionService` validates it against its own fresh aggregate read. This protects the interval between the Server Action's authorization read and the service read: replacing a participant link revokes the old capability before any client command, including a replay, can proceed.

Link-replacement retries do not rotate twice. Because only capability hashes are persisted, an exact replay cannot recover the plaintext link. The UI explains that the provider must request another replacement if the response containing the new link was lost.

`JOB_VIEWED` remains a reserved event label. No GET request, metadata function or public-page render emits it, and it is not proof that a person knowingly reviewed an agreement.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | Passed with strict mode |
| `npm run lint` | Passed without errors or warnings |
| `npm test` | 25 passed |
| `npm run build` | Passed; all 17 static pages generated and dynamic routes compiled |
| `npm run test:browser` | 6 passed; 14 public routes and nine viewport widths covered |
| `npm run test:workflow` | 1 passed; provider/client/admin lifecycle through the Supabase adapter and PGlite-backed test fixture |

The four added lifecycle-policy tests cover every action across all eleven statuses and three actor roles, stale or missing acceptance versions, missing/malformed command requests, confirmation, cancellation and terminal states, exact and altered replays, link rotation, fresh capability checks and injected commit failure. The PostgreSQL test now compares the database status constraint with the TypeScript status vocabulary and its event constraint with the canonical policy plus creation/reserved events.

The browser suites were run sequentially as required by the workspace handoff guide. Playwright's `NO_COLOR`/`FORCE_COLOR` notices are tooling warnings, not application failures.

## Boundaries

The repositories remain trusted persistence adapters behind the service; raw repository `commit()` is not an alternative public command API. The Supabase service role and a database owner remain privileged operators. Hosted Supabase has not been configured or validated, and the workflow browser suite still uses the explicitly test-only PGlite-backed HTTP fixture.

This phase does not implement `JOB_VIEWED` analytics, a draft editor, closed-dispute workflow beyond the existing explicit resolution outcomes, mutual reviews, notification delivery, payment processing or protected funds.
