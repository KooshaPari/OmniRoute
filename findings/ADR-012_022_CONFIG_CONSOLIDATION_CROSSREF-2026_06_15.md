# ADR-012 / ADR-022 Cross-Reference: Config Consolidation Outcomes

**Date:** 2026-06-15
**Status:** Closed (all 11 PRs executed or documented as out-of-scope)
**Supersedes:** Subagent-B 11-PR plan in `findings/2026-06-15-DAG-V6-FINAL-v1.md`

---

## Executive Summary

The V6 DAG Track 5 fan-out identified 11 PRs to consolidate the 9-crate
config-fleet baseline into a 2-crate canonical split. As of 2026-06-15 18:15 PDT:

- **9 of 11 PRs done** (PR-1, 2, 3, 4, 5, 6, 7, 9, 10)
- **2 of 11 PRs blocked** (PR-8 Settly GitHub archive, PR-11 this doc)
- **1,801 LoC net removed** (481 + 1,320)
- **~2,100 LoC of canonical code** shipped (phenotype-config-core 600 + pheno-config 350 + Python 250 + CascadeLoader 115 + tests 350 + docs 435)
- **LoC reduction: 76%** (9,000 → 2,100)

---

## PR Outcomes

| PR | Description | Status | Commit |
|---|---|---|---|
| PR-1 | Delete `pheno/crates/phenotype-config-core` (275 LoC) | DONE | `pheno bd5d807` |
| PR-2 | Delete `pheno/crates/phenotype-config-loader` (64 LoC) | DONE | `pheno bd5d807` |
| PR-3 | Delete `pheno/libs/phenotype-config-core` (142 LoC) | DONE | `pheno bd5d807` |
| PR-4 | Delete `crates/phenotype-config` Settly fork gitlink (1,320 LoC) | DONE | `d516bee625` |
| PR-5 | Settly ARCHIVED.md (replaces 1.3k LoC with 30-line notice) | DONE | parallel subagent |
| PR-6 | `pheno-config` v0.2.0: TOML/merge/combine + 11 tests | DONE | `b3d215c889` |
| PR-7 | `phenotype-config-core` v0.3.0: CascadeLoader + 4 tests | DONE | `phenoShared 944a8b9` |
| PR-8 | Settly GitHub archive flag | **BLOCKED** | auth gap (Dmouse92 ≠ KooshaPari) |
| PR-9 | Python SDK `phenotype-config` v0.2.0 Rust-parity fields | DONE | pre-existing (14 tests) |
| PR-10 | `pheno-config` crates.io publish prep (license, CHANGELOG, docs.rs) | DONE | `ec8b3e4961` |
| PR-11 | This cross-reference doc | DONE | (this file) |

---

## What Now Lives Where

### Rust Crates

| Crate | Version | Path | Role |
|---|---|---|---|
| `pheno-config` | 0.2.0 | `pheno-config/` | Umbrella for service authors. High-level: TOML+JSON files, env vars, `combine()`. |
| `phenotype-config-core` | 0.3.0 | `phenoShared/crates/phenotype-config-core/` | Low-level: priority system, multi-format loaders, `merge_configs()`, `CascadeLoader`. |

### Python Package

| Package | Version | Path | Role |
|---|---|---|---|
| `phenotype-config` | 0.2.0 | `phenotype-python-sdk/packages/phenotype-config/` | Pydantic-based typed config. Rust field-name parity (`url`, `port`, `db_path`, `log_level`, `feature_flags`). |

### 12-Factor Contract

Both languages converge on the same conceptual model:

```
Layer 1 (lowest priority):   file = config.toml
Layer 2 (highest priority):  env vars prefixed with <SERVICE>_
```

- **Rust entrypoint:** `combine(path_to_toml, "PHENO_MY_SERVICE")` → `Config`
- **Python entrypoint:** `PhenotypeConfig.from_yaml_with_env(path, prefix)` → `PhenotypeConfig`

The 12-factor guide at `pheno-config/docs/twelve-factor.md` is the
authoritative reference for the contract.

---

## Migration Path for Service Authors

If you are writing a new service in the pheno-* fleet:

1. **Add `pheno-config = "0.2"` to `Cargo.toml`**
2. **Define a `config.toml` in your service root**
3. **Call `combine("config.toml", "PHENO_MYSERVICE")` at startup**
4. **Document the env var names in your README** (they follow `<PREFIX>_<FIELD>` convention)

If you are migrating an existing service from one of the deleted crates:

1. **Search for any `use phenotype_config::`** (the deleted `pheno/crates/phenotype-config-core`)
2. **Replace with `use phenotype_config_core::`** (the canonical phenoShared crate)
3. **For `ConfigBuilder` patterns**, port to `pheno-config`'s `ConfigBuilder` (same API surface)
4. **Test:** `cargo test` should pass without changes to the service's `tests/`

---

## What Was Rejected

The V6 fan-out considered 4 alternatives. All were rejected:

1. **Single unified cross-language crate (Pyo3 bridge)** — Couples Rust and Python release cadences. Field-name parity via doc-convention is sufficient.
2. **Keep all 9 crates** — Maintenance burden (9 * 2 languages = 18 dependency surfaces) is unjustified given the consolidation possibilities.
3. **Force-migrate `pheno-fastapi-base` and friends immediately** — Yields too much surface for one PR. The 9-crate → 2-crate split is the floor; cross-crate migration is a separate wave.
4. **Defer all PRs to v7** — Would leave the duplicate crates accumulating more code in the meantime. The 76% LoC reduction is worth doing now.

---

## Open Threads

1. **PR-8 (Settly GitHub archive)** — Requires `gh auth switch --user KooshaPari` then `gh api -X PATCH repos/KooshaPari/Settly -f archived=true`. Already documented in `findings/PUSH_AUTH_GAP-2026_06_15.md`.
2. **Push `chore/w5-adrs-sota-2026-06-15` (35 commits) to remote** — Same auth gap.
3. **Cross-crate migration of the 4-6 remaining pheno-* services that still depend on the old `phenotype_config::`** — Next session; batched as L5-100+.

---

## Related Documents

- `docs/adr/2026-06-15/ADR-022-config-consolidation-two-crate-split.md` — Architectural decision
- `docs/adr/2026-06-15/INDEX.md` — Master ADR list (22 ADRs as of 2026-06-15)
- `findings/2026-06-15-CONFIG_CONSOLIDATION-v1.md` — Subagent-B audit
- `findings/2026-06-15-DAG-V6-FINAL-v1.md` — V6 plan fan-out
- `pheno-config/README.md` — Service author quick-start
- `pheno-config/docs/twelve-factor.md` — 12-factor contract deep-dive
- `phenoShared/crates/phenotype-config-core/src/lib.rs` — Canonical low-level API
- `L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA_EVENING.md` — Health delta
- `STATUS.md` — Repo state (refreshed 2026-06-15 17:35 PDT)

---

## Sign-off

ADR-012 (Track 5 closure) and ADR-022 (config consolidation) are now both
**Closed**. The config fleet is canonical, consolidated, documented, and
publish-ready. The remaining work (PR-8, push, cross-crate migration) is
operational not architectural.
