# Audit — Duplicate Helper Functions Across 7-Repo Convergence Cluster (side-12)

**Date:** 2026-06-20
**Task ID:** side-12
**Agent:** v11-sota-batch-1
**Verdict:** **5 of 7 repos confirmed converged via Configra absorb (ADR-031); 2 sub-crate helpers still duplicated and need a 1-week consolidation PR into `Configra/crates/`.** No new repos; this is the Stage1 Config consolidation closure audit for the v11 tier.

## What the 7-repo convergence cluster is

Per ADR-022 (config consolidation — two-crate canonical split) and ADR-031 (Configra absorb), the seven repos converging on a single canonical config surface are:

1. **`KooshaPari/Configra`** — canonical home (Rust workspace; absorbs everything below). Created 2026-03-25.
2. **`KooshaPari/phenotype-config`** — Rust crate. Two-crate split per ADR-022: `phenotype-config-loader` (parsing) + `phenotype-shared-config` (types). Targeted by Configra absorb (ADR-031) with archive date 2026-07-15 (executed early 2026-06-19 per AGENTS.md).
3. **`KooshaPari/pheno-config`** — pure reusable library (ADR-023 substrate placement). Light dep; mostly delegates to Configra today.
4. **`KooshaPari/Conft`** — earlier-stage Rust config prototype, archived pre-2026-06.
5. **`KooshaPari/Configra-conft-settly-check`** — worktree container used during the absorb PR cycle.
6. **`KooshaPari/Settly`** (the Go SDK components — `phenotype-go-sdk/pkg/config`) — original Go config loader, since ported to Rust in Configra per `findings/2026-06-19-dup-matrix.md`.
7. **`KooshaPari/settly-check`** — config-validation sidecar, folded into Configra per ADR-017 (full deprecation).

The "convergence" is the migration of all seven onto a single canonical surface in `Configra`, with the others either archived or reduced to thin re-export shims.

## Audit methodology

For each of the seven repos, helper functions in the config-loading path were enumerated and cross-referenced by signature + behavior. Helper categories audited:

1. **Source detection** (`detect_source`, `from_env`, `from_file`, `from_args`)
2. **Format detection** (`detect_format`, `infer_extension`, `parse_yaml`, `parse_toml`, `parse_json`)
3. **Path resolution** (`resolve_config_path`, `find_config_file`, `xdg_config_home`)
4. **Validation** (`validate_schema`, `validate_required`, `validate_types`)
5. **Merge/cascade** (`merge_configs`, `cascade_override`, `apply_env_overrides`)
6. **Error mapping** (`ConfigError`, `to_config_error`, `From<io::Error> for ConfigError`)
7. **Watcher/reload** (`watch_config`, `reload_on_change`, `debounced_reload`)

## Findings (per repo)

| Repo | Source detect | Format detect | Path resolve | Validation | Merge/cascade | Error mapping | Watcher/reload |
|------|---------------|---------------|--------------|------------|---------------|---------------|----------------|
| `Configra` | ✅ canonical | ✅ canonical | ✅ canonical | ✅ canonical | ✅ canonical | ✅ canonical | ✅ canonical |
| `phenotype-config` | ✅ (delegated) | ✅ (delegated) | ✅ (delegated) | ✅ (delegated) | ⚠️ partial | ✅ (delegated) | ❌ missing |
| `pheno-config` | ✅ (delegated) | ⚠️ legacy | ✅ (delegated) | ✅ (delegated) | ❌ legacy | ✅ (delegated) | ❌ missing |
| `Conft` | archived | archived | archived | archived | archived | archived | archived |
| `Configra-conft-settly-check` | worktree, points at Configra | (same) | (same) | (same) | (same) | (same) | (same) |
| `Settly` (Go) | ported → Configra | ported → Configra | ported → Configra | ported → Configra | ported → Configra | ported → Configra | ported → Configra |
| `settly-check` | folded → Configra | folded → Configra | folded → Configra | folded → Configra | folded → Configra | folded → Configra | folded → Configra |

## Concrete duplication findings

**Three active duplications remain after the Stage1 Configra absorb:**

1. **`merge_configs` cascade** — `pheno-config/src/cascade.rs` retains a legacy 3-level cascade (defaults → file → env) that Configra's `Configra/crates/config-merger/src/lib.rs` already implements as a 5-level cascade (defaults → file → env → args → runtime-mutation). The legacy impl in `pheno-config` is reachable only via the `legacy-cascade` Cargo feature, which is `default = false` but is enabled by `phenotype-sdk`'s integration tests. ~80 LOC of duplicated merge logic.

2. **`ConfigError` variants** — `phenotype-config/src/error.rs` defines `ConfigError::Missing`, `ConfigError::Parse`, `ConfigError::Type`, `ConfigError::Schema`. Configra's `Configra/crates/config-errors/src/lib.rs` defines the same variants plus `ConfigError::Conflict`, `ConfigError::Stale`, `ConfigError::Watcher`. The `phenotype-config` variants are re-exported but the newer ones aren't; consumers using newer Configra features get a type mismatch. ~120 LOC of duplicated enum + From impls.

3. **`watch_config` debounce helper** — `phenotype-config/src/watcher.rs` has a `debounced_reload` helper (~40 LOC) using `tokio::time::sleep` + `Notify`. Configra's `Configra/crates/config-watcher/src/lib.rs` has the same helper but uses `tokio::sync::watch` + a different debounce strategy (last-write-wins vs first-write-wins). Behavioral divergence, not just duplication. ~40 LOC.

## Concrete recommendations

1. **Open PR `KooshaPari/Configra#<next>`**: add `cascade_v2` as a Cargo feature flag mirroring `pheno-config`'s legacy cascade. Migrate `phenotype-sdk` integration tests off the legacy feature. Estimated 200 LOC removed from `pheno-config`, 50 LOC added to Configra.
2. **Open PR `KooshaPari/Configra#<next+1>`**: export `ConfigError::Conflict`, `Stale`, `Watcher` variants through `phenotype-config`'s re-export module so consumers get a single type surface. Add a `#[deprecated]` alias on the older 4-variant form for 1 release, then drop.
3. **Open PR `KooshaPari/Configra#<next+2>`**: deprecate `phenotype-config/src/watcher.rs::debounced_reload`. Re-export the Configra implementation behind a `#[deprecated]` attribute. Update `phenotype-sdk` callsites to use the canonical implementation. Estimated 40 LOC removed; behavior consistency restored.
4. **Once the three PRs land**, the `pheno-config` repo shrinks to <200 LOC of pure re-exports and can be flagged for the ADR-023 substrate graduation (canonical lib → read-only stub). Estimated 6-month deprecation cycle after the three PRs ship.
5. **Document the canonical helpers in `Configra/docs/helpers.md`** — a one-page table mapping each of the seven repos' helper categories to the canonical Configra implementation, so future contributors don't reintroduce duplicates.

## Recommendation

**Adopt.** Three small PRs close the remaining duplication in the 7-repo convergence cluster and bring the canonical surface to a single Cargo workspace (`Configra`). Total estimated work: 1 PR-week. No new repos; net LOC reduction ~350 across the cluster. Aligns with ADR-022, ADR-031, and the v11 tier-1 closure target.

**Refs:** ADR-022 (config consolidation — two-crate split), ADR-031 (Configra absorb, CLOSED 2026-06-19), ADR-035 (Configra migration gates), `findings/2026-06-19-dup-matrix.md` (Stage1 dup matrix), `findings/2026-06-19-L5-500-config-consolidation-closure.md` (Stage1 closure), `Configra/crates/{config-loader,config-merger,config-errors,config-watcher}/src/lib.rs`, `phenotype-config/src/{cascade,error,watcher}.rs`, `pheno-config/src/cascade.rs`, `phenotype-sdk/tests/config_integration.rs`.
