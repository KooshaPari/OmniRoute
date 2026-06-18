# ADR-012: Config consolidation — PR-1, PR-2, PR-3 executed (2026-06-15)

## Status

PR-1, PR-2, PR-3 from the subagent-B 11-PR plan are **executed** in the `pheno` submodule on branch `chore/adr-012-config-consolidation-2026-06-15`, commit `bd5d807`.

## What was deleted

| Crate | LoC removed | Reason |
|---|---|---|
| `pheno/crates/phenotype-config-core/` | 275 | `CANONICAL.md` redirect to `phenoShared` already in place; active canonical lives at `phenoShared/crates/phenotype-config-core`; zero workspace consumers |
| `pheno/crates/phenotype-config-loader/` | 64 | Trivial 64-LoC JSON+TOML loaders; superseded by `phenoShared/phenotype-config-core::FileConfig` (supports JSON+Toml+Yaml) |
| `pheno/libs/phenotype-config-core/` | 142 | TOML-only cascade with divergent design; superseded by `phenoShared` core; if cascade is needed, port as `CascadeLoader` extension |

**Net LoC removed:** 481 (4 files: 2 CANONICAL.md, 2 src/lib.rs, 1 Cargo.toml, 1 lib.rs).

**Verification:** No `path =` or `git =` references in `pheno/Cargo.toml` or any sibling crate's `Cargo.toml` (`grep` confirmed 0 matches). Safe deletion.

## Why this can be done now

1. The `phenoShared` version is the active canonical (consumed by `phenotype-infrakit`, `PhenoDevOps`, `PhenoProc`, `PhenoProc-security-fixes`)
2. The 3 deleted crates have `CANONICAL.md` redirect files explicitly pointing to `phenoShared`
3. The deleted crates are NOT members of the `pheno` workspace `Cargo.toml` (only the workspace-declared members are checked)
4. The deletions happen on a `chore/adr-012-config-consolidation-2026-06-15` branch in `pheno`, not in the parent monorepo — submodule-level isolation is preserved

## Push state

The `pheno` submodule cannot be pushed from Dmouse92's account (same `gh auth` gap as the monorepo). The commit `bd5d807` is on the local branch, ready to be pushed when re-auth happens.

## Remaining subagent-B work (PR-4 through PR-11)

- **PR-4:** Delete `crates/phenotype-config/` (root monorepo, Settly fork) — needs verification across ALL of `repos/Cargo.toml` (not just `pheno/Cargo.toml`)
- **PR-5:** Settly deprecation PR (`#[deprecated]`, `ARCHIVED.md`) — needs ADR approval + Settly clone
- **PR-6:** `pheno-config` v0.2.0 (add TOML, merge, combine) — small additive change, low risk
- **PR-7:** `phenoShared/phenotype-config-core` v0.3.0 (`CascadeLoader` port) — port from deleted `libs/phenotype-config-core`
- **PR-8:** Settly GitHub archive (admin action, no PR) — blocked by `gh auth` gap
- **PR-9:** `phenotype-python-sdk/phenotype-config` v0.2.0 (Rust parity) — add `url`/`port`/`db_path`/`feature_flags` fields
- **PR-10:** `pheno-config` v0.3.0 → crates.io publish — needs `pheno-config` repo remote access
- **PR-11:** ADR-012 (settly-archive) — doc only

## Subagent B's other key findings (still actionable)

- **Configra does not exist** — phantom reference, dropped from consolidation list
- **pheno-context is NOT a config library** — request-context library; keep separate, possibly co-locate with `phenotype-request-id` in `pheno-runtime` meta-crate
- **Polyglot parity gap** — Rust `pheno-config` has `url/port/db_path/feature_flags`; Python `phenotype-config` has `environment/debug/service_name`; recommend adding missing fields to both sides
- **Hexagonal architecture is overkill** for these use cases — flat library code is sufficient

## Subagent C / D work (separately actionable)

- **Profila** → migrate to new `pheno-profiling` Python crate (12-PR plan, ~1,400 LoC including 300 tests)
- **sharecli / thegent-sharecli** are complementary, not duplicate (PRCP pattern: Rust process, Python coordination)
- **phenoVessel / phenoTypes** already deleted (404) — 3 ADRs proposed (D1, D2, D3)

## References

- `findings/2026-06-15-DAG-V6-FINAL-v1.md` (full consolidation report)
- `/tmp/subagent-B-config-consolidation-result.md` (raw audit)
- `/tmp/subagent-C-profila-result.md` (Profila audit)
- `/tmp/subagent-D-polyglot-result.md` (polyglot decision)
- `pheno/CANONICAL.md` (parent redirect)
