# Phase 2: local backend foundation

Implemented for the user's request to continue from Phase 2, September 21, 2026. Scope is the durable local development backend, repository-independent domain services and prerequisite diagnostic fixes. No hosted Supabase project or application login was created.

## Implementation

The existing JSON adapter remains the local development store. Replacing it with a second database would duplicate a working persistence boundary. `Repository` in `lib/db/repository.ts` is shared by independent local and Supabase adapters; domain services receive that interface and never select a backend themselves.

`lib/db/config.ts` requires an explicit `TRUSTLINK_STORAGE=local` or `supabase`. Missing/unknown modes fail. Production refuses local storage and incomplete Supabase configuration. Runtime instrumentation checks this at startup; build-time compilation does not require a hosted connection.

Transaction Server Actions now resolve the authenticated/capability actor, validate storage evidence references, and invoke `TransactionService`. Creation, acceptance, commands and their atomic commits are coordinated there. Creation requires an existing provider profile. Profile edits use a separate domain service. Submitted identity fields do not replace server-resolved actors.

| Module under `lib/domain/` | Responsibility |
|---|---|
| `transactions/` | Repository-injected orchestration and the single lifecycle state machine |
| `jobs/` | Initial aggregate, terms and publication events |
| `participants/` | Scoped capability hashing/validation and participant/role guards |
| `payments/` | Recorded payment rows; always `NOT_VERIFIED` |
| `deliveries/` | Delivery records |
| `revisions/` | Revision records and included-revision limit |
| `disputes/` | Dispute evidence and explicit admin-resolution records |
| `reviews/` | Client review records |
| `trust-events/` | Event construction and public redaction |
| `profiles/` | Validated profile updates through the repository |

`lib/domain/jobs.ts` remains a compatibility re-export for existing callers/tests. It contains no competing rules. Record-construction helpers are internal to the lifecycle pipeline; mutations should enter through the transaction service. Status names now derive from one typed constant in `lib/db/types.ts`.

The local adapter validates persisted profiles/aggregates, child ownership, unique identifiers and basic field constraints. A commit uses an exclusive file lock, checks the expected version, preserves prior trust events, terms, transaction identity and recorded evidence, and requires a new version/event. It writes and flushes a temporary file before replacing the data file. Optional fields are normalized to the persisted JSON representation before immutable-history comparisons. Corrupt or invalid records fail visibly without replacement by sample data. Invalid JSON errors do not expose file contents.

Strict TypeScript is enabled. All eight missing CSS utility occurrences from the earlier audit are resolved: six invalid danger-color references and two uses of the now-defined shared scrollbar utility. A broader follow-up search also found and fixed four invalid background-color references inside the shared button and badge variant maps, which the earlier static JSX scan did not cover. No diagnostic suppression was added.

## Running locally

After dependencies are installed, from the repository root in PowerShell:

```powershell
$env:TRUSTLINK_STORAGE = 'local'
npm run dev
```

Data persists in ignored `data/trustlink-local-v3.json`. The application does not automatically populate users or transactions. Provider authentication and private uploads remain unavailable until the intended Supabase configuration is supplied. `TRUSTLINK_AUTH` is not implemented. The automated test fixture is not a substitute application backend.

The local store is for a single development machine, not production or a distributed filesystem. Writers that encounter a lock or stale version fail with a conflict so callers can refresh/retry. A process killed during a commit can leave a `.lock` file. Preserve the JSON and any temporary files, inspect the lock's PID, and confirm that no owning process is still running before removing that exact lock file. The adapter deliberately does not guess that an old lock is safe to steal. Atomic replacement and file flushing do not constitute a backup or a tested power-loss recovery guarantee.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | Passed with strict mode enabled |
| `npm run lint` | Passed without errors or warnings |
| `npm test` | 21 passed, including five new local-foundation tests |
| `npm run build` | Passed, including the final shared button/badge CSS fixes |
| `npm run test:browser` | 6 passed in an isolated rerun; public routes checked at nine widths |
| `npm run test:workflow` | 1 passed; provider/client/admin flow through the Supabase adapter and test fixture |

Running both browser suites simultaneously initially produced two public-suite failures: the example transaction route returned 404 and its example label was consequently absent. All six public tests passed when rerun alone. The precise cause of this concurrent-server behavior was not established. Run builds and browser suites sequentially in this workspace; no test expectation was weakened to obtain the passing result. Playwright's color-environment warnings are tooling output, not application failures.

The added tests use temporary directories and clearly synthetic test profiles. They read saved transactions in a fresh Node process, launch two processes with the same expected version, check rejection without changing disk contents, and exercise the full service lifecycle through newly constructed repository instances. Existing tests cover lifecycle authorization, retries, capabilities, evidence validation, reputation and the cumulative PostgreSQL migrations under PGlite.

## Remaining boundaries

Hosted Auth, PostgREST, RLS and Storage behavior has not been validated against a real Supabase project. Browser workflow evidence uses the existing test-only HTTP fixture backed by PGlite. No schema migration, payment processing, protected funds, new lifecycle states or broad UI redesign is part of Phase 2. The frozen pilot screens retain their existing behavior. The IDE Problems panel was not accessible; strict compiler/linter results describe the source checks actually run.

Phase 3 subsequently centralized the lifecycle policy and added versioned acceptance. See `docs/PHASE-3-CANONICAL-STATE-MACHINE.md`; the Phase 2 results above remain the historical verification at that checkpoint.
