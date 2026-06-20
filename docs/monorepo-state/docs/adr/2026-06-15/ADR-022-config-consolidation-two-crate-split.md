# ADR-022: Config consolidation — two-crate canonical split (Rust `pheno-config` + Rust `phenotype-config-core` + Python `phenotype-config`)

**Status:** Accepted · **Date:** 2026-06-15 · **Decision driver:** Subagent-B config audit (2026-06-15) + DAG v6 PR-6/7/9/10/11

## Context

The Phenotype monorepo had **9 distinct config crates** spread across 4 organizational surfaces (pheno/, phenoShared/, phenotype-python-sdk/, crates/), with overlapping scope, divergent field names, and zero coordination between them. The V6 fan-out (`findings/2026-06-15-DAG-V6-FINAL-v1.md:1`) identified this as a P1 consolidation target. Subagent-B's audit (`/tmp/subagent-B-config-consolidation-result.md`) measured the damage:

- **`pheno/crates/phenotype-config-core`** (275 LoC) — superseded by `phenoShared/phenotype-config-core`; `CANONICAL.md` redirect already in place.
- **`pheno/crates/phenotype-config-loader`** (64 LoC) — JSON+TOML loaders; superseded by `phenoShared/phenotype-config-core::FileConfig` (JSON+Toml+Yaml).
- **`pheno/libs/phenotype-config-core`** (142 LoC) — TOML-only cascade; divergent design; superseded by `phenoShared/phenotype-config-core::CascadeLoader` (cascade, multi-format).
- **`crates/phenotype-config`** (1,320 LoC) — Settly fork with cosmetic edits; not a workspace member; zero consumers.
- **`pheno-config`** (Rust) — pheno service settings (typed struct: url/port/log/db) for service authors.
- **`phenoShared/phenotype-config-core`** (Rust) — priority sources, file formats, validation for library authors.
- **`phenotype-config`** (Python) — Pydantic BaseSettings for Python service authors; field names diverged from Rust.
- **`pheno-cost-card`**, **`pheno-llms-txt`**, **`pheno-prompt-test`**, **`pheno-worklog-schema`** — each had a local "config" shim or env-var convention not aligned with any of the above.

Two distinct use cases were conflated by the historical crates:

- **(A) "pheno service settings"** (typed struct: url/port/log/db) → `pheno-config` (Rust) + `phenotype-config` (Python) with field-name parity.
- **(B) "phenotype crate config"** (priority sources, file formats, validation, deep-merge) → `phenoShared/phenotype-config-core` (Rust, lower-level).

The cross-language contract (common field names: `url`, `port`, `db_path`, `log_level`, `feature_flags`) is documented at `pheno-config/docs/twelve-factor.md` and enforced by `pheno-config/tests/toml_merge_test.rs` + `phenotype-config/tests/test_v020_parity.py`.

## Decision

**Two-crate canonical split** for Rust, **one** for Python, **zero** for the deleted legacy crates.

1. **`pheno-config` v0.2.0** — the canonical Rust crate for pheno service settings.
   - New: `load_from_toml_file()`, `Config::merge()`, `combine(file, prefix)`.
   - Dep: `toml = "0.8"` for TOML file support.
   - Tests: 11 in `tests/toml_merge_test.rs` (v0.1.0 regression + v0.2.0 parity), all pass parallel.
   - Consumer-facing docs: `pheno-config/README.md` + `pheno-config/docs/twelve-factor.md`.
2. **`phenoShared/phenotype-config-core` v0.3.0** — the canonical lower-level crate for Phenotype library authors.
   - New: `CascadeLoader` (ordered chain of `ConfigLoader`s, deep-merge via existing `merge_configs()`).
   - Tests: 14 inline (10 pre-existing + 4 new CascadeLoader tests), all pass.
   - Naming preserves Settly's `CascadeLoader` for continuity.
3. **`phenotype-config` v0.2.0** (Python) — the canonical Python crate with Rust field-name parity.
   - Fields: `url`, `port`, `db_path`, `log_level`, `feature_flags` match Rust pheno-config exactly.
   - 12-factor cascade via `settings_customise_sources` (init > env > .env > defaults).
   - Tests: 14 in `tests/test_v020_parity.py` (v0.1.0 regression + v0.2.0 parity + cache semantics).
4. **DELETE**: `pheno/crates/phenotype-config-core`, `pheno/crates/phenotype-config-loader`, `pheno/libs/phenotype-config-core`, `crates/phenotype-config` (Settly fork). All have `CANONICAL.md` / `ARCHIVED.md` redirects; zero consumers found.
5. **DEPRECATE** (not delete) `pheno-config` Settly fork via GitHub `archived` flag (blocked on `Dmouse92 ≠ KooshaPari` auth gap).
6. **PUBLISH** `pheno-config` to crates.io as the canonical Rust service-config crate.

## Consequences

*Positive:*
- 9-crate sprawl → 3-crate canonical surface (Rust service, Rust lib, Python service).
- Cross-language parity: porting a service between Rust and Python no longer requires renaming config keys.
- 1,801 LoC of legacy code removed (275 + 64 + 142 + 1,320 = 1,801).
- One set of env-var conventions per language (`PHENO_<SERVICE>_*` for Rust; `PHENOTYPE_CONFIG_V020_*` for Python; documented in respective READMEs).
- 12-factor path is the documented default: `combine('config.toml', 'PHENO_SERVICE')` in Rust; `MySettings()` with Pydantic-settings in Python.

*Negative:*
- Consumers that used the deleted `pheno/config-loader` or `pheno/libs/phenotype-config-core` APIs must migrate to `phenoShared/phenotype-config-core::FileConfig` / `CascadeLoader` (documented in `pheno-config/docs/twelve-factor.md`).
- Settly GitHub archive is a public, irreversible step (mitigated by history preservation on the archived repo).
- Cross-language parity requires both repos to update the canonical field list together; future fields are added to a coordination doc (`pheno-config/docs/twelve-factor.md`).

## Alternatives Considered

- **Single mega-crate** that handles both use cases (A) and (B) — rejected: violates the existing repo layout; would force `pheno-config` consumers to take a `serde_yaml` + `thiserror` dependency for what is supposed to be a lightweight settings crate.
- **One canonical crate per language (no cross-language parity)** — rejected: defeats the purpose of a polyglot fleet; the canonical 12-factor pattern requires field-name alignment.
- **Keep all 9 crates and add a registry** — rejected: the audit showed zero consumers for 4 of them; keeping them is pure maintenance debt.
- **Rename `pheno-config` to `pheno-settings`** — rejected: `pheno-config` is the established name in the 22 pheno-* repos; renaming would break consumers with no functional benefit.

## Verification

- **Source**: `pheno-config/src/lib.rs:1-200`, `phenoShared/crates/phenotype-config-core/src/lib.rs:1-540`, `phenotype-python-sdk/packages/phenotype-config/src/phenotype_config/config.py:1-150`.
- **Tests**: `pheno-config/tests/toml_merge_test.rs` (11), `phenoShared/.../src/lib.rs` (14 inline), `phenotype-python-sdk/.../tests/test_v020_parity.py` (14). All pass.
- **Deletion evidence**: `pheno bd5d807` (PR-1/2/3), parent `d516bee625` (PR-4 Settly fork gitlink removal).
- **Cross-language parity doc**: `pheno-config/docs/twelve-factor.md:1-146`.
