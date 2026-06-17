# Wave 8 — archive delete eligibility — 2026-06-17

**Predecessor:** [wave7-execution-2026-06-17.md](./wave7-execution-2026-06-17.md)

## Method

Fleet verify: `gh search code` + `Cargo.toml` manifest scan for HexaKit path/git pins on evicted crates. Archive repo status via GitHub API.

## HexaKit stub matrix

| Path | Archive repo | Fleet git/path deps | Stub state | Verdict |
|------|--------------|---------------------|------------|---------|
| `Traceon/` | archived | 0 (Pyron → PhenoObservability) | MIGRATED.md only | **STUB_COMPLETE** |
| `Metron/` | archived | 0 (Pyron → PhenoObservability) | MIGRATED.md only | **STUB_COMPLETE** |
| `crates/stashly` | archived | 0 (Pyron → phenoShared, Wave 7) | MIGRATED.md only | **STUB_COMPLETE** |
| `crates/settly` | archived | 0 (Pyron → phenotype-config, Wave 2) | 107 files → Wave 8 prune PR | **PRUNE_ELIGIBLE → STUB** |

## Archive repo deletes (GitHub)

| Repo | Status | Delete? |
|------|--------|---------|
| Settly | archived | **NO** — governance history; canonical in phenotype-config |
| Traceon | archived | **NO** |
| Stashly | archived | **NO** |
| Metron | archived | **NO** |
| DataKit | 404 | **ALREADY DELETED** |

Per v2 charter: delete archived **repos** only after registry retired rows + 100% boundary — not in this wave.

## Wave 8 PRs

| Repo | PR | Change |
|------|-----|--------|
| HexaKit | TBD | Prune `crates/settly` → MIGRATED.md stub; add workspace `exclude` |
| phenotype-registry | TBD | This ledger + disposition Traceon/settly `done` |

## Remaining HexaKit `crates/*` (P3)

~30 workspace members still disposition `ready`/`pending` — phenotype-error-core/errors excluded Wave 8+ on HexaKit main; full P3 lane is Wave 9+.

## Next

1. ~~P3 phenotype-* crate evictions per disposition-index~~ → Wave 9 wave 2 (3 crates)
2. Archive repo delete gate — when registry retires rows
3. FocalPoint manual absorption (867MB exclude)
