# Historical source snapshots

The ZIP files in this directory are old review exports, not canonical source.
They contain duplicate flattened and nested source paths and can contradict the
current implementation. They are preserved as historical inputs, ignored by Git,
and excluded from source exports. Do not copy their files into the app or serve
them from `public/`.

The canonical implementation lives in the repository's `app/`, `components/`,
`lib/`, `supabase/` and `tests/` directories. Generate a fresh handoff using
`scripts/Export-Source.ps1` as documented in `docs/agent-start.md`.
