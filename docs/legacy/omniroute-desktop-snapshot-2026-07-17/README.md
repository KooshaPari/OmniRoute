# Legacy archive — Omniroute desktop snapshot (2026-07-17)

This directory preserves the historical design artifacts from the
`omniroute-monorepo-archive` GitHub repository (branch
`archive/pr6029-cliproxy-2026-07-17`, HEAD SHA captured at extraction
on 2026-08-10).

## Why this exists

Per operator directive (`2026-08-10`): *"local tmp bundles wont survive an fs restart nor are they the answer, all code and work and ideas must find its way to a new github repo we own. Again the point is given N project or projects SRC and targets M project or projects. Both >=1; You take a given source, and evaluate all branches and commit history incl the files..."*

The current `KooshaPari/OmniRoute` (the active TGT) is **not** a
direct descendant of the `omniroute-monorepo-archive` source. They
share the name `OmniRoute` but represent **different generations**:

| Aspect | SRC (`omniroute-monorepo-archive`) | TGT (`KooshaPari/OmniRoute`) |
|---|---|---|
| Stack | Svelte 5 + Tauri 2 + Kbridge + Hono | Bun + Hono + 237 AI providers |
| Form | Desktop agentic app | AI Gateway CLI/server |
| Scale | 183 files | 1,721 files |
| Backend | Tauri 2 (8 src-tauri/ files) | ElectroBun + Hono |
| Frontend | Svelte 5 routes + Paraglide i18n | (none — pure backend) |

**TGT abandoned Tauri 2 in favor of ElectroBun, and reorganized from a desktop agentic app into an AI Gateway.** Most of SRC's source code (Tauri 2 backend, Svelte 5 routes, Kbridge client) is therefore obsolete for TGT's current arc.

What survives the architectural shift: **the design decisions**. The 10 ADRs and `ARCHITECTURE.md` document *why* certain choices were made (Tauri 2 → ElectroBun migration is documented in ADR-0008; Svelte 5 runes discipline in ADR-0002; monorepo layout in ADR-0001; etc.) — they're historical record of an architectural exploration that informed TGT's evolution.

## What was preserved

### `ADRS/` — 19 files (10 design decisions, each with short + long filename variants)
- ADR-0001: Monorepo layout (pnpm + Cargo)
- ADR-0002: Svelte 5 runes-only discipline
- ADR-0003: Hono typed RPC
- ADR-0004: Tauri 2 macOS-first; ElectroBun reserved
- ADR-0005: Zod canonical types
- ADR-0006: Kbridge unix-socket RPC
- ADR-0007: No ESLint/no turborepo (oxlint + oxfmt only)
- ADR-0008: ElectroBun is the future macOS-lite shell; v4 ships Tauri 2
- ADR-0009: Paraglide i18n
- ADR-0010: No backwards-compat shims

### `reference/` — 2 files
- `README-omniroute-desktop.md` — original README
- `ARCHITECTURE.md` — full architectural document

### `session/` — 6 files
Session logs from `argismonitor-monorepo-bootstrap` (2026-07-05), documenting the early-phase architectural exploration that led to the ADRs above.

## Recoverability

The complete SRC repo state is recoverable from the bundle:
- `/Users/kooshapari/CodeProjects/Phenotype/repos/.preservation-work/thegent-bundles-20260730-0102/thegent-sharecli-all.bundle` (see also the omniroute-monorepo-archive GitHub repo at the SHA captured in this commit)

## Provenance

- **SRC repo:** `KooshaPari/omniroute-monorepo-archive`
- **Branch:** `archive/pr6029-cliproxy-2026-07-17`
- **HEAD SHA:** `6cd87a31f0d1d3eb4cb8f31e7fcb3fd5a26a92b8`
- **Migration date:** 2026-08-10
- **Operator directive:** "yor choice, the 5-10 quickest you can do?"
- **Per-file semantic analysis:** SRC's ADRs are unique design-record content not present in TGT; SRC's source code is obsolete relative to TGT's ElectroBun pivot
