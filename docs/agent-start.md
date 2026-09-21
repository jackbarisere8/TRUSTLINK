# TrustLink agent and source handoff guide

## Instruction order and current scope

Read `AGENTS.md` for the installed Next.js requirements, `AGENT.md` for product/security boundaries, then `PRD.md` and `ARCHITECTURE.md`. `CLAUDE.md` references both instruction files. Use the exact filename casing when working on Linux. The current user request takes precedence over historical plans.

Current evidence is recorded in `docs/PHASE-2-LOCAL-BACKEND.md`, `docs/PHASE-0-REPOSITORY-AUDIT.md` and `docs/FINAL-INTEGRITY-AUDIT.md`. The earlier reality audit and build roadmap are historical context, not proof that a feature is implemented or authorization to expand it.

The user subsequently authorized Phase 2: the local backend foundation and domain separation. Phase 1 cleanup is complete. Later phases remain a roadmap. Keep Explore, Pathfinder, Learn and Opportunities frozen.

## Actual environment

No hosted Supabase project has been created. There are no hosted credentials configured in this workspace. `.env.example` contains variable names and blank credential fields; do not invent configuration or create `.env.local` with fake secrets.

`TRUSTLINK_STORAGE=local` explicitly selects durable development JSON storage. Missing or unknown storage modes are errors; there is no implicit fallback. It does not enable a fake login. Auth and private file upload remain unavailable without the intended Supabase configuration. Production refuses local storage and incomplete Supabase configuration. `TRUSTLINK_AUTH` is not currently implemented; do not imply otherwise by adding it to the template.

`tests/support/supabase-fixture.mts` is an automated-test HTTP fixture backed by PGlite. Its identities and nonfunctional keys are DEV ONLY. It is never application infrastructure. Local testing does not establish hosted Auth, RLS or Storage behavior.

## Canonical source and clean exports

Canonical code lives in `app/`, `components/`, `lib/`, `supabase/` and `tests/`. Keep the intended logo assets in `public/` and application icons. There is no duplicate unpacked source tree.

Historical ZIPs under `docs/source-archives/` and `data/trustlink-dev.json` are retained as historical inputs, ignored and excluded from exports. They are not used by runtime adapters. Generated output and test screenshots are useful locally but do not belong in source handoffs.

From the repository root in PowerShell:

```powershell
./scripts/Export-Source.ps1
```

The script creates a fresh ZIP under ignored `artifacts/`, preserving directory structure and including `package-lock.json`, the blank `.env.example`, tests, migrations and logo assets. It excludes dependencies, builds, traces, local data, old ZIPs and credential files. It refuses symlinks/junctions. It never deletes existing source or generated output.

`npm pack` is not the source-export mechanism: this private application has no package version and npm package rules would also omit its lockfile. The export script avoids changing package identity just to share source.

On a fresh source handoff, run `npm ci`. Start the local server from PowerShell with explicit development storage:

```powershell
$env:TRUSTLINK_STORAGE = 'local'
npm run dev
```

This starts the public application with local persistence; provider login is still unconfigured. `npm run build` checks compilation without connecting a hosted backend. `next-env.d.ts` is generated rather than exported with machine-specific build references.

## Domain and persistence boundaries

Server Actions resolve sessions/capabilities and validate private evidence references. Transaction mutations call `TransactionService` in `lib/domain/transactions/index.ts`, which accepts the `Repository` interface. Profile edits use `lib/domain/profiles/index.ts`. The local and Supabase adapters implement the same interface independently.

Lifecycle decisions remain in `lib/domain/transactions/state-machine.ts`; the other domain modules own aggregate creation, participants and the corresponding record construction. `lib/domain/jobs.ts` is only a compatibility re-export. Do not create another transition engine in UI components or bypass the service with direct record append calls.

The local file is `data/trustlink-local-v3.json`, with schema validation, an exclusive writer lock and atomic replacement. Preserve corrupt files for diagnosis; do not substitute sample data. See the Phase 2 report for safe lock recovery and development limitations.

## Diagnostics and checks

The workspace points VS Code at `node_modules/typescript/lib`. Select **TypeScript: Select TypeScript Version > Use Workspace Version** to enable the installed Next plugin. This setting does not suppress diagnostics or prove that an unseen editor warning is stale.

```powershell
npm run typecheck
npm run lint
npm run build
npm test
npm run test:browser
npm run test:workflow
```

Run the build and each browser suite sequentially. During Phase 2, running both browser suites together produced an example-route 404 in the dev server; the isolated public-suite rerun passed all six tests. The precise concurrency cause was not established; use sequential runs for verification in this workspace. Phase 2 enables strict TypeScript and fixes all eight missing utility occurrences identified in the Phase 0 audit plus four related background-color references found in variant maps. The IDE Problems panel itself was not inspected.

Payments are provider reports only. No wallet, custody, independent transfer verification or payment protection is implemented. Clients act through scoped capabilities; self-provided contact details are not verified identity.
