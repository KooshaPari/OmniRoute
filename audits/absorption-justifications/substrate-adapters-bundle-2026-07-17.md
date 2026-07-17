# substrate-adapters-bundle — Absorption Justification

**Status:** ARCHIVED 2026-07-17 (redundant-shims)
**Source:** `KooshaPari/substrate-adapters-bundle` (216 KB, 2 branches, last push 2026-06-25)
**Disposition:** ARCHIVE_ONLY (no physical transfer — canonical source already exists)
**Canonical source:** `KooshaPari/substrate` (AFFIRM, active)

## Confidence

**0.95** — HIGH redundancy. The bundle contains 8 thin re-export shims that delegate to the canonical substrate monorepo. There is no unique code here.

## What the bundle actually contained

| Crate | Shim body |
|-------|-----------|
| `engine-agentapi` | `pub use engine_agentapi::*;` |
| `engine-claude` | `pub use engine_claude::*;` |
| `engine-codex` | `pub use engine_codex::*;` |
| `engine-forge` | `pub use engine_forge::*;` |
| `omniroute-adapter` | `pub use omniroute_adapter::*;` |
| `cliproxy-adapter` | `pub use cliproxy_adapter::*;` |
| `context-budget` | `pub use context_budget::*;` |
| `substrate-trace` | `pub use substrate_trace::*;` |

Each shim's Cargo.toml points at the canonical substrate crate via `path = "../substrate/crates/<name>"`. The 216 KB total footprint is dominated by metadata + 8 Cargo.toml files + 8 ~10-line lib.rs files. No production logic lives in the bundle.

## Why ARCHIVE_ONLY (no physical transfer)

1. The 8 canonical crates already exist in `KooshaPari/substrate` with the **same crate names**.
2. Copying the shims into pheno would create a parallel re-export path that the rest of pheno doesn't need (substrate is consumed directly by other crates, not through these shims).
3. The bundle's stated purpose was "OSS consumers who want one version pin for all adapters" — a distribution concern that doesn't apply to in-workspace usage.

The substrate repo is `AFFIRM` (active) — it remains the canonical source of these adapters. The bundle is archived as redundant.

## What was NOT done

- No `crates/substrate-adapters/` was added to the pheno workspace.
- No `Cargo.toml` workspace member was added.
- No source code was copied.
- No new boundary or test fixtures were created.

## Verification

| Check | Result |
|-------|--------|
| Bundle contains only re-exports | ✅ Confirmed by reading all 8 lib.rs files |
| Canonical crates exist in substrate | ✅ All 8 names present in `/repos/substrate/crates/` |
| substrate is AFFIRM (active) | ✅ `disposition=AFFIRM` in `registry/disposition-index.json` |
| No pheno Cargo.toml changes needed | ✅ No physical absorption |

## Restore procedure

```sh
gh repo unarchive KooshaPari/substrate-adapters-bundle
# In registry spine:
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-registry
# Edit registry/disposition-index.json: change fsm from "absorbed" back to "active"
# Restore projects/substrate-adapters-bundle.json from git history (revert to queued status)
```

Note: there's no `pheno/crates/` change to revert because no physical transfer occurred.

## Cross-references

- Disposition row: `registry/disposition-index.json` → `"KooshaPari/substrate-adapters-bundle"`
- Boundary doc: `docs/boundary/substrate-adapters-bundle.md`
- Canonical source: https://github.com/KooshaPari/substrate
- Source repo (now archived): https://github.com/KooshaPari/substrate-adapters-bundle
- Related registry row: `KooshaPari/substrate` (AFFIRM, active)
