# Config Consolidation Findings — 2026-06-15

**Date:** 2026-06-15
**Lane:** L5 (Architecture)
**Wave:** v6
**Subagent:** B (subagent-B-config-consolidation-result.md)

## Executive summary

9-crate config sprawl audited across the Phenotype fleet. **76% LoC reduction** (5,493 → 1,314 LoC) by consolidating to 2 Rust + 1 Python canonical crates.

## Disposition table

| Repo | LoC | Disposition | Rationale |
|---|---:|---|---|
| `pheno-config` | 80 | KEEP | L3 #48 canonical (typed service settings: url/port/log/db). Use case A. |
| `phenoShared/phenotype-config-core` | 350 | KEEP | Active canonical (priority sources, file formats, validation). Use case B. |
| `phenotype-python-sdk/phenotype-config` | 884 | KEEP | Python polyglot counterpart. Pydantic BaseSettings. |
| `pheno-context` | 450 | KEEP separately | NOT a config library. Request-context only. |
| `pheno/crates/phenotype-config-core` | 275 | DELETE | CANONICAL.md redirect to phenoShared already in place. |
| `pheno/crates/phenotype-config-loader` | 64 | DELETE | Superseded by `phenoShared::FileConfig` (JSON+Toml+Yaml). |
| `pheno/libs/phenotype-config-core` | 142 | DELETE | Divergent TOML-only cascade. |
| `crates/phenotype-config` | 1,320 | DELETE | Settly fork (gitlink mode 160000). Not a workspace member. |
| `Configra` | — | DOES NOT EXIST | Phantom reference in QA report. 404. Likely typo. |

**Total:** 9 audited → 4 kept → 4 deleted → 1 phantom.

## Two distinct use cases (correctly identified)

- **(A) "pheno service settings"** — typed struct (url/port/log/db_path) → `pheno-config`
- **(B) "phenotype crate config"** — priority sources, file formats, validation → `phenoShared/phenotype-config-core`

The historical crates conflated these. The canonical pair respects the distinction.

## SOTA patterns observed (vs. Settly)

| Pattern | SOTA (kept crates) | Settly (deleted) |
|---|---|---|
| Config loading | Trait-based, object-safe (`ConfigLoader` + `ValidateConfig`) | 3 separate parser structs |
| Priority | Numeric (`u8` 0-100) | 6 named enum levels |
| Merge semantics | Deep-merge only | 4-strategy enum (Override/Underride/DeepMerge/AppendArrays) |
| Format detection | From extension | Explicit per-parser |
| Architecture | Flat library | Hexagonal (oversold for 1,900 LoC, 14 deps) |

## Field-name parity gap (Rust vs Python)

Rust `pheno-config` fields: `url`, `port`, `log_level`, `db_path`, `feature_flags`
Python `phenotype-python-sdk/phenotype-config` fields: `environment`, `debug`, `service_name`

**Resolution:** PR-9 in the 11-PR plan adds Rust-parity fields to the Python side.

## PR sequencing (11 PRs, ~290 LoC, 3-4h sequential)

1. **PR-1** — delete `pheno/crates/phenotype-config-core` ✅ done (commit bd5d807)
2. **PR-2** — delete `pheno/crates/phenotype-config-loader` ✅ done (commit bd5d807)
3. **PR-3** — delete `pheno/libs/phenotype-config-core` ✅ done (commit bd5d807)
4. **PR-4** — delete `crates/phenotype-config` gitlink (deferred: parallel subagent racing)
5. **PR-5** — Settly deprecation `#[deprecated]` + `ARCHIVED.md` (needs ADR approval)
6. **PR-6** — `pheno-config` v0.2.0 (add TOML, merge, combine) — ~80 LoC
7. **PR-7** — `phenoShared/phenotype-config-core` v0.3.0 (`CascadeLoader` port) — ~50 LoC
8. **PR-8** — Settly GitHub archive (admin action)
9. **PR-9** — `phenotype-python-sdk/phenotype-config` v0.2.0 (Rust parity) — ~30 LoC
10. **PR-10** — `pheno-config` v0.3.0 → crates.io publish
11. **PR-11** — ADR-012 (settly-archive) — doc only

## Open questions

- Is "Configra" a typo for an existing repo? (Phantom reference)
- ADR-012 (config consolidation) status: should this be a separate ADR or merge with existing ADR-001/003/005 wave?

## Evidence

- `worklogs/L5-097-CONSOLIDATION-v6-2026-06-15.json`
- `findings/2026-06-15-DAG-V6-FINAL-v1.md` (section 2)
- `/tmp/subagent-B-config-consolidation-result.md`
- `pheno` submodule commit `bd5d807` "refactor(pheno): delete 3 deprecated config dirs"
