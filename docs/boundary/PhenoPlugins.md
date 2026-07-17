---
repo: "PhenoPlugins"
role: absorbed
status: archived
last_boundary_review: 2026-07-17
review_cadence: 30d
absorbed_into: KooshaPari/pheno
absorbed_on: 2026-07-17
---

# Boundary — PhenoPlugins (absorbed)

PhenoPlugins has been absorbed into `KooshaPari/pheno` as
`crates/pheno-plugins-{core,git,sqlite,vessel,examples}/`.

The plugin system is now exposed as workspace members of the
pheno monorepo. New boundaries should refer to the pheno
subcrates directly, not PhenoPlugins (which is archived).

## In Scope (now lives in pheno)

- **Plugin contract**: `pheno-plugins-core` traits + registry + manifest + lifecycle + guardrails
- **Git adapter**: `pheno-plugins-git` (libgit2-backed VcsPlugin)
- **SQLite storage adapter**: `pheno-plugins-sqlite` (rusqlite-backed StoragePlugin)
- **Container runtime adapter**: `pheno-plugins-vessel` (Docker/Podman image+container)
- **Reference implementations**: `pheno-plugins-examples` (memory_storage, manifest_demo, memory_vcs)

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Plugin binary/distribution | pheno-cli | The CLI frontend lives separately |
| Plugin marketplace | TBD | Not yet designed |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Plugin manifest validation | this→pheno-cli | serde_json schema | green |
| Plugin registry init | this→pheno-runtime | trait impl | green |
| Plugin git ops | this→pheno-context | trait call | green |

## Last Boundary Review

**Date:** 2026-07-17
**Reviewer:** forge subagent (wave 2026-07-17-queue-refresh-2)
**Absorption commit:** see `docs/absorption/PhenoPlugins/README.md`
**Decisions:**
- PhenoPlugins absorbed into pheno monorepo as 5 sub-crates
- Crate names renamed `pheno-plugin-*` → `pheno-plugins-*`
- pheno-plugins-sqlite downgraded rusqlite 0.40 → 0.32 (workspace
  sqlite link conflict with agileplus-benchmarks)
- pheno-plugins-vessel: removed orphan [[bench]] block (perf.rs
  mismatched name)
- All 5 sub-crates compile clean in 1.79s

**Next review:** 2026-08-17 (post-absorption stabilization)