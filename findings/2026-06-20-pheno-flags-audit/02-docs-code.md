# Phase 1B — `pheno-flags` Docs + Code Audit

**Date:** 2026-06-20
**Phase:** 1B (docs + code only; matrix / decision deferred to Phase 2)
**Source location:** `/Users/kooshapari/CodeProjects/Phenotype/repos/argis-extensions/pheno-flags/`
**Substrate location (for comparison only):** `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno/crates/phenotype-flags/`

> **Path correction:** The task brief says the source lives at `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-flags/`. The actual location is **one level deeper** at `/Users/kooshapari/CodeProjects/Phenotype/repos/argis-extensions/pheno-flags/` (the subtree is a sub-folder of the `argis-extensions` monorepo, not at the `repos/` root). The substrate lives at `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno/crates/phenotype-flags/`. All file references in this report use the actual paths.

> **No standalone GitHub repo** for this source. The subtree exists ONLY on disk within `argis-extensions`. The 71-pillar audit (`findings/71-pillar-2026-06-20-pheno-flags.md:5`) lists `Repo: KooshaPari/pheno-flags (v0.1.0)` but no such GitHub repo was created — this is a discrepancy worth flagging to Phase 2.

---

## 1. Source inventory (what is on disk)

```
pheno-flags/  (15 files, 5 subdirs)
├── AGENTS.md                      3 222 B  ✓
├── Cargo.toml                       929 B  ✓
├── deny.toml                        944 B  ✓
├── justfile                       2 879 B  ✓
├── llms.txt                       2 146 B  ✓
├── llvm-cov.toml                    940 B  ✓
├── src/
│   └── lib.rs                     7 803 B  ✓ (220 lines, 5 doctests)
├── tests/
│   └── flag_test.rs               4 434 B  ✓ (134 lines, 8 integration tests)
├── examples/
│   ├── quickstart.rs                899 B  ✓ (35 lines, compiles)
│   └── otel_quickstart.rs         1 539 B  ✗ (51 lines, references phantom API)
├── benches/
│   ├── Cargo.toml                   326 B  ✗ (separate crate; uses phantom API)
│   ├── flags_lookup.rs            1 718 B  ✗ (uses `pheno_flags::Flags` — does not exist)
│   └── flags_stress.rs            1 569 B  ✗ (uses `pheno_flags::Flags` — does not exist)
├── scripts/
│   └── coverage.sh                  509 B  ✓
├── .github/workflows/
│   └── ci.yml                      675 B  ✓ (minimal: test + coverage jobs only)
└── findings/
    └── 71-pillar-2026-06-20-pheno-flags.md  11 395 B  ✓ (the cycle-4 audit)
```

**Meta-bundle status (per ADR-023 Rule 3.1):**

| Item | Present? | Source of truth |
|---|---|---|
| `AGENTS.md` (spec) | ✓ | `pheno-flags/AGENTS.md` |
| `README.md` | ✗ MISSING | 71-pillar audit line 69 admits it; llms.txt:38 claims it; justfile `validate` recipe does not check for it |
| `llms.txt` (docs) | ✓ | `pheno-flags/llms.txt` |
| `CHANGELOG.md` | ✗ MISSING | `find pheno-flags -name CHANGELOG.md` returns nothing; justfile `validate` recipe line 57 checks for it and would fail; 71-pillar audit line 144 falsely claims it exists |
| `LICENSE` / `LICENSE-MIT` / `LICENSE-APACHE` | ✗ MISSING | llms.txt:39 claims dual license; 71-pillar audit line 155 admits "only MIT file present — Apache-2.0 file missing" — actually **neither** is present |
| `Cargo.toml` | ✓ | `pheno-flags/Cargo.toml` (with `license = "MIT OR Apache-2.0"` but no `LICENSE*` files) |
| `src/lib.rs` | ✓ | `pheno-flags/src/lib.rs` |
| `CONTRIBUTING.md` | ✗ MISSING | 71-pillar audit line 156 falsely claims it exists |
| `CODE_OF_CONDUCT.md` | ✗ MISSING | 71-pillar audit line 156 falsely claims it exists |
| `CODEOWNERS` | ✗ MISSING | 71-pillar audit line 156 falsely claims it exists |
| `PULL_REQUEST_TEMPLATE.md` | ✗ MISSING | 71-pillar audit line 156 falsely claims it exists |
| `ISSUE_TEMPLATE/*` | ✗ MISSING | 71-pillar audit line 156 falsely claims it exists |
| `SECURITY.md` | ✗ MISSING | 71-pillar audit line 112 falsely claims a disclosure process exists |

> The 71-pillar audit's claims about `CHANGELOG.md`, `CODEOWNERS`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `PULL_REQUEST_TEMPLATE.md`, `ISSUE_TEMPLATE/*`, and `SECURITY.md` are **demonstrably false** — none of those files exist on disk. This is a **HIGH** severity finding for the audit doc itself (see Bug P-1B-08).

**No `TODO` / `FIXME` / `XXX` / `HACK` markers anywhere in the subtree** (`rg 'TODO|FIXME|XXX|HACK' pheno-flags/` returns empty). The code is clean of explicit debt markers.

---

## 2. Docs / spec / intent extraction

### 2.1 README claims

**No `README.md` exists** in the subtree. Documentation is split across `AGENTS.md` (104 lines, spec/quickstart), `llms.txt` (57 lines, LLM-friendly API summary), and module-level rustdoc in `src/lib.rs:1-65` (5 doctests, 4 narrative sections).

### 2.2 `AGENTS.md` (full read, 104 lines)

- `:3-13` — **Substrate type:** `pheno-*-lib` (pure reusable library); canonical flags substrate per ADR-022 + ADR-031.
- `:15-25` — **Stack claims:** Rust 2021, `std` + `tokio` (async flag updates), `serde` + `serde_json` (flag persistence), `parking_lot::RwLock` (low-contention reads), `pheno-tracing` (observability). **Library-only, no CLI/binary.**
  - **None of these are present in `src/lib.rs`** — only `std::collections::{HashMap, BTreeMap}` and `thiserror` are imported (`src/lib.rs:67-69`). `tokio`, `serde`, `serde_json`, `parking_lot`, `tracing`/`pheno-tracing` are not in `[dependencies]` (`Cargo.toml:18-25`) and not used in source.
  - `serde_json` and `tokio` appear in `[dev-dependencies]` (`Cargo.toml:27-28`) but **nothing in `tests/flag_test.rs` uses them**.
- `:27-52` — **Key commands:** standard `cargo` flow; `cargo test` claims `standard library + tokio::test` (line 17), but **no test in `tests/flag_test.rs` uses `#[tokio::test]` or any tokio primitive** (`rg 'tokio|async' tests/flag_test.rs` returns empty).
- `:54-65` — **Substrate Quality (71-pillar targets):** spec + docs (`README.md` + `lib.rs` rustdoc) + tests + observability (`pheno-tracing`) + coverage gate (≥80%, ADR-040) + CI + worklog v2.1. **`README.md` does not exist; `pheno-tracing` is not in `Cargo.toml`; no worklog file exists.**
- `:66-78` — **Public API (Quickstart)**: shows code using `pheno_flags::{Flag, FlagStore, FlagValue}`, `FlagStore::new()`, `Flag::bool("dark_mode").with_default(false)`, `Flag::string("theme").with_default("light")`, `store.register(...)`, `store.get_bool(...)`, `store.set(..., FlagValue::Bool(true))`. **None of these symbols exist in `src/lib.rs`.** The real API is `FlagSet` with `new()`, `with()`, `from_env()`, `is_enabled()`, `snapshot()`. The AGENTS.md quickstart is **completely fabricated**.
- `:80-86` — **ADRs cited:** ADR-022, ADR-031, ADR-040, ADR-012 (the last one claims `pheno-tracing` as canonical tracing substrate).
- `:88-91` — **Forward (v12+):** mentions L29 justfile migration, L46 vuln mgmt, L57 perf regression — the justfile exists but L57 references `FlagStore::get` which doesn't exist.
- `:93-98` — **Related repos:** `pheno-config` (absorbed into Configra), `pheno-context` (also absorbed), `pheno-tracing`, `pheno-port-adapter`. **`pheno-context` and `pheno-tracing` do not exist on this monorepo's disk** (`find argis-extensions -name 'pheno-context' -o -name 'pheno-tracing'` returns empty). Only `config/` and `pheno-port-adapter/` exist in the argis-extensions root.

### 2.3 `llms.txt` (full read, 57 lines)

- `:8-17` — **Public API summary:**
  - `FlagSet` — `HashMap<String, bool>` wrapper, O(1) `is_enabled`, sorted `snapshot()` returning `BTreeMap<String, bool>`. **Accurate.**
  - `FlagSet::new()`, `.with(key, value)` — fluent builder. **Accurate.**
  - `FlagSet::from_env(prefix)` — truthy `1|true|yes`, falsy `0|false|no`, returns `Err(FlagError::InvalidValue)`. **Accurate.**
  - `FlagError` — `thiserror`-based error type with `UnknownKey`, `InvalidValue { key, value }`, `EmptyPrefix` variants. **WRONG.** Actual enum (`src/lib.rs:72-83`) has a single variant `InvalidValue(String)` carrying only the var name. There is **no `UnknownKey` variant, no `key, value` fields, no `EmptyPrefix` variant**.
  - `merge(base, overlay)` — overlay wins; identical keys collapse to the right-hand value. **DOES NOT EXIST.** No `merge` function in `src/lib.rs`.
- `:21-29` — **Quickstart:** uses `FlagSet::new().with(...)` — **accurate**, mirrors the rustdoc quickstart.
- `:32-39` — **Files:** lists `Cargo.toml`, `src/lib.rs`, `tests/flag_test.rs`, `examples/quickstart.rs`, `llvm-cov.toml`, `.github/workflows/ci.yml`, `LICENSE-MIT`, `LICENSE-APACHE`. **Two LICENSE files are claimed but neither exists** (see §1 table). **`examples/otel_quickstart.rs` is missing from the file list.**
- `:35` — "`tests/flag_test.rs` — env-var parsing, builder, **merge semantics**". **There are no merge tests** — `rg '\bmerge\b' tests/flag_test.rs` returns empty.
- `:38-39` — Claims `ci.yml` runs "build + test + coverage jobs" and that `LICENSE-MIT`/`LICENSE-APACHE` exist. **`ci.yml` has no build job, only `test` and `coverage` (lines 13-30). LICENSE files are missing.**
- `:42-49` — **Conventions:** "Public API surface fully documented (`#![warn(missing_docs)]`)". **The source has no `#![warn(missing_docs)]`** (`rg '#!\[warn\(missing_docs\)\]' src/lib.rs` returns empty; pheno-otel at `pheno-otel/src/lib.rs:33` has it, but this crate does not).

### 2.4 `Cargo.toml` (29 lines)

- `:5` — `version = "0.1.0"`.
- `:7` — `license = "MIT OR Apache-2.0"` (no LICENSE file on disk to back it).
- `:8` — `rust-version = "1.82"`.
- `:9` — `description = "Canonical synchronous, in-memory feature-flag set for the Phenotype monorepo. Reads boolean flags from environment variables with a configurable prefix."` — **accurate summary of the real API.**
- `:10` — `keywords = ["phenotype", "feature-flags", "config", "env", "ff-free"]` — **`"ff-free"` is not a recognized cargo keyword convention** (no harm, but unusual).
- `:14-16` — `[lib] name = "pheno_flags"`, `path = "src/lib.rs"`.
- `:18-25` — `[dependencies]`: only `thiserror = "2"` and `pheno-otel = { path = "../pheno-otel" }`. **The `pheno-otel` dependency is **never used in `src/lib.rs`**. No `use pheno_otel::...` appears anywhere in the source.** `rg 'pheno_otel' src/lib.rs` returns empty.
- `:27-28` — `[dev-dependencies]`: `serde_json = "1"`, `tokio = { version = "1", features = ["macros", "rt-multi-thread"] }`. **Neither is used in any test or example that would compile** (no `serde_json::` import in `tests/`, no `tokio::` import in `tests/`, but `examples/otel_quickstart.rs:17` imports `serde_json::json` and that example file is broken regardless).

### 2.5 Module-level doc comments (`src/lib.rs:1-65`)

- `:1` — `# pheno-flags — canonical feature-flag set`.
- `:3-5` — "Synchronous, in-memory boolean flag storage with optional environment-variable population. Intentionally minimal: no FFI, no async runtime, no network." **Accurate and matches implementation.**
- `:7-10` — "The on-disk storage is a `HashMap<String, bool>` for O(1) `is_enabled` lookups; [`FlagSet::snapshot`] returns a fresh `BTreeMap<String, bool>` for sorted, observability-friendly iteration." **Accurate.**
- `:12-24` — Quickstart doctest using `FlagSet::new().with(...).is_enabled(...)`. **Accurate, compiles.**
- `:26-45` — Environment-variable loading section. **Accurate.** Mentions `FlagError::InvalidValue` carrying the offending variable name (matches `src/lib.rs:78-82`).
- `:47-65` — Snapshot section. **Accurate.**

### 2.6 `pheno-flags/findings/` (1 file, 219 lines)

Only `findings/71-pillar-2026-06-20-pheno-flags.md` — the cycle-4 audit. Highlights:
- `:1-7` — Metadata: cycle 4, scored at `chore/tier-0-hygiene-orch-v10-025` commit (TBD).
- **Architecture domain: 2.67 / 3** (lines 28).
- **Performance domain: 2.43 / 3** (line 44) — **L19 (PGO) scored 1, but the audit admits "no benchmarks, no perf CI job" (line 42), which is incorrect since `benches/` has 2 criterion benches** (though they don't compile).
- **Quality domain: 2.13 / 3** (line 61) — L22 (property/fuzz) scored **0**, the audit recommends `proptest` (lines 192-197).
- **Observability domain: 1.63 / 3** (line 133) — L56/L57/L58 all scored **0**; the audit recommends adding `tracing`/`log` feature gates (lines 200-212). The audit's P0 fix contradicts the actual `Cargo.toml` which already has a `pheno-otel` path-dep that is **unused**.
- **Documentation domain: 2.00 / 3** (line 147) — L64 (README) scored 1, **admits no README exists** (line 141); L67 (CHANGELOG) scored **3** and falsely claims `CHANGELOG.md` follows Keep a Changelog format (line 144) — the file is **missing**.
- **L70 (Community Standards) scored 3** and lists `CODEOWNERS, CODE_OF_CONDUCT, CONTRIBUTING.md, PULL_REQUEST_TEMPLATE.md, ISSUE_TEMPLATE/*, SECURITY.md` (line 156) — **none of these exist on disk**.
- **L69 (License) scored 3** (line 155) but admits "only MIT file present — Apache-2.0 file missing" — actually **neither** is present.

---

## 3. Source-code feature inventory

### 3.1 Public API (what is actually exported)

**`src/lib.rs` — 220 lines, single file, no `mod` declarations.**

```rust
// src/lib.rs:67-69
use std::collections::{BTreeMap, HashMap};
use thiserror::Error;
```

| Line | Item | Kind | Signature |
|------|------|------|-----------|
| `src/lib.rs:73` | `pub enum FlagError` | enum | single variant `InvalidValue(String)` (`src/lib.rs:82`); derives `Debug, Error, PartialEq, Eq` (`:72`) |
| `src/lib.rs:94` | `pub struct FlagSet` | struct | field `flags: HashMap<String, bool>` (`:95`); derives `Debug, Clone, Default, PartialEq, Eq` (`:93`) |
| `src/lib.rs:108` | `pub fn FlagSet::new() -> Self` | ctor | `Self::default()` |
| `src/lib.rs:127` | `pub fn FlagSet::with(mut self, key: &str, value: bool) -> Self` | builder | `self.flags.insert(key.to_string(), value); self` |
| `src/lib.rs:146` | `pub fn FlagSet::from_env(prefix: &str) -> Result<Self, FlagError>` | loader | scans `std::env::vars()` for `<PREFIX>_*`, parses 6 canonical truthy/falsy forms |
| `src/lib.rs:196` | `pub fn FlagSet::is_enabled(&self, key: &str) -> bool` | lookup | `self.flags.get(key).copied().unwrap_or(false)` |
| `src/lib.rs:205` | `pub fn FlagSet::snapshot(&self) -> BTreeMap<String, bool>` | dump | `self.flags.iter().map(...).collect()` (sorted by key) |

**Public surface is 1 enum + 1 struct + 5 methods. No constants, no statics, no traits, no re-exports, no macros, no associated types/functions.**

### 3.2 Private helpers (visible to crate)

| Line | Item | Purpose |
|------|------|---------|
| `src/lib.rs:212` | `fn parse_bool(s: &str) -> Option<bool>` | Recognizes 6 canonical strings (case-insensitive): `1`, `true`, `yes` → `true`; `0`, `false`, `no` → `false`; anything else → `None` |

That's it. Two `let` bindings inside `from_env` (`src/lib.rs:152-153`) hold intermediate state but are not module-level.

### 3.3 Macros

**None.** No `macro_rules!`, no `pub macro`, no derive macros. The `thiserror::Error` derive is consumed at `src/lib.rs:72`.

### 3.4 Re-exports

**None.** `pub use` does not appear anywhere in `src/lib.rs` (`rg 'pub use' src/lib.rs` returns empty).

### 3.5 Feature flags

**None.** `Cargo.toml` has no `[features]` section (`rg '^\[features\]' Cargo.toml` returns empty). The `cargo test --all-features` invocation in `justfile:34` and `Cargo.toml:9` comment about `--all-features` are vacuous — there are no features to enable.

### 3.6 Dependencies

| Section | Crate | Version | Pinned? | Used in source? |
|---------|-------|---------|---------|-----------------|
| `[dependencies]` | `thiserror` | `2` (minor-wide) | No (Cargo resolves latest 2.x) | ✓ (`src/lib.rs:69`) |
| `[dependencies]` | `pheno-otel` | `path = "../pheno-otel"` (no version) | path-only | **✗ NO usage in `src/lib.rs`** (`rg 'pheno_otel' src/lib.rs` is empty) |
| `[dev-dependencies]` | `serde_json` | `1` (minor-wide) | No | ✗ unused (would be used by broken `otel_quickstart.rs:17` if that example were ever fixed and compiled) |
| `[dev-dependencies]` | `tokio` | `1` with `["macros", "rt-multi-thread"]` | No (feature set is pinned) | ✗ unused (no `#[tokio::test]` in any test file) |
| `[dev-dependencies]` (benches/Cargo.toml) | `criterion` | `0.5` with `default-features = false, features = ["cargo_bench_support"]` | minor-wide | ✗ the bench files import `criterion::{...}` (correctly) but **fail to compile** because `pheno_flags::Flags` doesn't exist |
| `[dev-dependencies]` (benches/Cargo.toml) | `pheno-flags` | `path = ".."` | path-only | ✗ the phantom API means benches never resolve |

**Direct deps: 1 used + 1 phantom.**
**Dev deps: 0 used + 2 phantom + 1 broken (criterion via separate benches/Cargo.toml).**

### 3.7 Build configuration

- `[lib]`: standard (`name = "pheno_flags"`, `path = "src/lib.rs"`) — no `crate-type`, no `test = false`, etc.
- `Cargo.toml:1` has `[workspace]` (empty) — declares this as a **standalone** crate, NOT a workspace member. This matches the substrate (`phenotype-flags/Cargo.toml` has the same pattern).
- `Cargo.toml:12` `publish = true` — declared as publishable, but no LICENSE files back the SPDX expression in `:7`.

---

## 4. Test inventory

### 4.1 Integration tests (`tests/flag_test.rs`, 134 lines)

The file declares a **process-global env lock** (`tests/flag_test.rs:23`):
```rust
static ENV_LOCK: Mutex<()> = Mutex::new(());
```
…to serialize the 3 env-mutating tests so they don't race on `PHENO_FLAGS_TEST_*` env vars.

| Line | Test fn | Assertion type(s) | Notes |
|------|---------|-------------------|-------|
| `:26` | `new_flagset_is_empty` | `assert!(snapshot().is_empty())` + `assert!(!is_enabled("anything"))` | Confirms `FlagSet::new()` and safe-default for unknown keys |
| `:39` | `with_sets_value` | `assert!(is_enabled)` + `assert_eq!(snapshot, BTreeMap::from([...]))` | Verifies builder inserts the (key, value) pair |
| `:50` | `is_enabled_returns_true_for_set_key` | Two `assert!`s on `is_enabled` for `alpha=true` / `beta=false` | |
| `:63` | `is_enabled_returns_false_for_unknown_key` | Two `assert!(!is_enabled(...))` | Safe-default for unknown keys |
| `:74` | `from_env_parses_truthy_values` | Loops over `["1", "true", "TRUE", "yes", "YES", "Yes"]`, each `set_var` + `is_enabled("TRUTHY")` | Uses `ENV_LOCK` |
| `:89` | `from_env_parses_falsy_values` | Loops over `["0", "false", "FALSE", "no", "NO", "No"]` | Uses `ENV_LOCK` |
| `:104` | `from_env_rejects_invalid_value` | `assert_eq!(result.err(), Some(FlagError::InvalidValue("PHENO_FLAGS_TEST_BAD".to_string())))` | Uses `ENV_LOCK` |
| `:117` | `snapshot_returns_sorted_keys` | `assert_eq!(keys, vec!["alpha", "mu", "zeta"])` + value assertions | Confirms BTreeMap sort order |

**Total: 8 integration tests.** All use plain `#[test]`. No `#[ignore]`, no `#[should_panic]`, no `#[tokio::test]`.

### 4.2 Doctests in `src/lib.rs`

`grep -c '```' src/lib.rs` returns **10** (5 fenced blocks: 3 ` ``` ` + 1 ` ```no_run ` + 1 ` ``` `). Breakdown:

| Line range | Marker | Verifies |
|------------|--------|----------|
| `:14-24` | ` ``` ` | Quickstart: `FlagSet::new().with(...).is_enabled(...)` |
| `:37-45` | ` ```no_run ` | Env loading: `FlagSet::from_env("MYAPP").unwrap()` (no_run because it depends on process env) |
| `:54-65` | ` ``` ` | Snapshot sorted-keys |
| `:102-107` | ` ``` ` | `FlagSet::new()` produces an empty snapshot |
| `:119-126` | ` ``` ` | `with()` last-write-wins |

**Total: 5 doctests** (3 run + 1 no_run + 1 run). The 71-pillar audit (line 52) rounds to "5 doc tests".

### 4.3 Property tests, fuzz tests, snapshot tests

**None.** `rg 'proptest|quickcheck|insta::assert_snapshot|cargo-fuzz' src/ tests/ examples/ benches/ Cargo.toml benches/Cargo.toml` returns **zero hits**. This matches the 71-pillar audit's L22 score of 0 (line 54), which itself recommends adding `proptest` (lines 192-197).

### 4.4 Unit tests inside `src/lib.rs`

**None.** The substrate (`pheno/crates/phenotype-flags/src/lib.rs:222-360`) has 12 `#[cfg(test)] mod tests { ... }` tests in-file, but the source repo has no in-source unit tests. **The source repo is integration-test-only**; the substrate is unit-test-only. The two crates have **non-overlapping** test architectures (and Phase 2 will need to decide which to keep).

### 4.5 Test totals

- Source repo: **8 integration + 5 doctests = 13 tests** (matches the 71-pillar audit's claim of "all 13 tests pass" at line 58).
- Substrate: **12 in-source unit tests + 5 doctests = 17 tests**.
- Property/fuzz/snapshot tests in either: **0**.

### 4.6 Bench tests (`benches/flags_lookup.rs`, `benches/flags_stress.rs`)

- `benches/Cargo.toml:11-17` declares 2 `[[bench]]` entries: `flags_lookup`, `flags_stress` (both `harness = false`).
- Both files (`benches/flags_lookup.rs:7`, `benches/flags_stress.rs:7`) `use pheno_flags::Flags;` and call `Flags::from_env_pairs(pairs.into_iter())` (e.g. `benches/flags_lookup.rs:15`). **`pheno_flags::Flags` does not exist** in `src/lib.rs` (the real type is `FlagSet`).
- `benches/flags_lookup.rs:23` calls `flags.get("FLAG_000500")`; the real method is `is_enabled`. **The benches would not compile against the real `pheno_flags` API.**
- The 71-pillar audit (line 42) scored L19 (PGO) = 1, citing "no benchmarks, no perf CI job" — which is **partially wrong**: 2 criterion bench files exist, they just don't compile. (See Bug P-1B-05.)

---

## 5. Examples

### 5.1 `examples/quickstart.rs` (35 lines)

**Compiles ✓.** All referenced symbols exist in `src/lib.rs`.

| Line | Reference | Exists? |
|------|-----------|---------|
| `examples/quickstart.rs:6` | `use pheno_flags::FlagSet;` | ✓ (`src/lib.rs:94`) |
| `:10` | `FlagSet::from_env("MYAPP")?` | ✓ (`src/lib.rs:146`) — returns `Result<Self, FlagError>` |
| `:14-15` | `.with("dark_mode", true).with("beta_export", false)` | ✓ (`src/lib.rs:127`) |
| `:18` | `flags.is_enabled("DARK_MODE")` | ✓ (`src/lib.rs:196`) |
| `:24` | `flags.is_enabled("BETA")` | ✓ |
| `:30` | `for (k, v) in flags.snapshot() { ... }` | ✓ (`src/lib.rs:205` returns `BTreeMap<String, bool>`) |

The example's docstring (`:3-4`) requires env vars to be set: `MYAPP_DARK_MODE=1 MYAPP_BETA=yes MYAPP_DEBUG=0 cargo run --example quickstart`. Note the **`MYAPP_DEBUG=0` env var is never checked** in the example body — cosmetic doc drift (see Bug P-1B-12).

### 5.2 `examples/otel_quickstart.rs` (51 lines)

**Would NOT compile ✗.** At least 8 distinct broken references:

| Line | Reference | Exists in `src/lib.rs`? | Exists in `pheno-otel`? |
|------|-----------|-------------------------|-------------------------|
| `:13` | `use pheno_flags::{Flag, FlagSet};` | `FlagSet` ✓; `Flag` ✗ (no such type) | n/a |
| `:14` | `use pheno_otel::exporters::stdout::StdoutExporter;` | n/a | ✓ (`pheno-otel/src/exporters/stdout.rs:10`) |
| `:15` | `use pheno_otel::trace::{emit, span};` | n/a | **✗ — `pheno_otel` has no `trace` module** (`pheno-otel/src/lib.rs:36,54,66,85,88` are the only public items at root) |
| `:16` | `use pheno_otel::ExporterConfig;` | n/a | **✗ — `ExporterConfig` lives at `pheno_otel::exporters::ExporterConfig`** (`pheno-otel/src/exporters/mod.rs:12`), not at crate root |
| `:24` | `FlagSet::new("otel-quickstart")` (with name arg) | **✗** — `new()` takes no args (`src/lib.rs:108`) | n/a |
| `:25-26` | `.flag(Flag::<String>::new("name", "koosha").short('n'))` | **✗** — no `Flag` type, no `.flag()` method, no `.short()` | n/a |
| `:32` | `flags.parse_from(std::env::args())` | **✗** — no `parse_from` method on `FlagSet` | n/a |
| `:32` | `let resolved = ...` | **✗** — no return type with `.get::<T>()` | n/a |
| `:38-39, 46-47` | `resolved.get::<String>("name")`, `resolved.get::<bool>("verbose")` | **✗** — no `get` method on the return type | n/a |
| `:50` | `exporter.export(b"pheno-flags quickstart flushed\n")` | n/a | ✗ — `StdoutExporter` has no `export(&[u8])` method (see `pheno-otel/src/exporters/stdout.rs:1-20`; only `new(ExporterConfig)` is exposed at that level) |

**Verdict:** the example is fabricated against an imagined CLI-flag library and an imagined tracing API. It would require a hypothetical `clap`/`pico-args`-style typed flag builder + a `tracing` module in `pheno-otel` to compile. (See Bug P-1B-03.)

The example's docstring (`:9-11`) shows the run command: `cargo run --example otel_quickstart -p pheno-flags -- --name koosha --verbose`. The `-p pheno-flags` flag is fine, but the example will never reach that point.

---

## 6. Bug tally

> Format: **ID | SEV | file:line | evidence | description | impact**

### P-1B-01 — **HIGH** — `Cargo.toml:25` — `pheno-otel` declared but never used
**Evidence:** `pheno-otel = { path = "../pheno-otel" }` in `[dependencies]`; `rg 'pheno_otel' src/lib.rs` returns 0 hits; `rg 'use pheno_otel' src/` returns 0 hits.
**Description:** The crate advertises itself as having OTLP observability wiring (per ADR-023 Rule 3.1, ADR-037 substrate adoption, the comment block at `Cargo.toml:20-24`), but the source contains no `use pheno_otel::...` and the dep compiles in dead. The 71-pillar audit (L58, L56, L57 all scored 0, lines 124-126) confirms the crate has no observability integration at all. The `pheno-otel` path is purely cosmetic — it inflates compile time, breaks the substrate for any consumer that depends on `pheno-flags` and may not have `pheno-otel` at `../pheno-otel`, and contradicts the lib's own comment ("`pheno-flags` uses `pheno-otel` to surface flag-set diffs").
**Impact:** Every downstream consumer pays a `path = "../pheno-otel"` dependency for zero functionality. The crate is not relocatable — it must live at exactly `argis-extensions/pheno-flags/`. The "observability substrate" claim is false. **High** because it is the most visible "governance theater" defect in the crate.

### P-1B-02 — **HIGH** — `AGENTS.md:66-78` — Quickstart API is fabricated
**Evidence:** `AGENTS.md:69` `use pheno_flags::{Flag, FlagStore, FlagValue};` plus 8 other symbol references; none of `Flag`, `FlagStore`, `FlagValue`, `Flag::bool`, `Flag::string`, `store.register`, `store.get_bool`, `store.set`, `FlagValue::Bool` exist in `src/lib.rs`.
**Description:** The "Public API (Quickstart)" block in `AGENTS.md` describes a typed flag-store with `bool`/`string` defaults, register/get/set semantics, and a `FlagValue` sum type. **None of this is implemented.** The real API is a 4-method `FlagSet` (new/with/from_env/is_enabled/snapshot). A new contributor copying the AGENTS.md quickstart into `src/main.rs` will get 9 unresolved-import errors.
**Impact:** First-touch onboarding is broken. The crate's most prominent doc file is wrong. This is the same severity as a broken README quickstart.

### P-1B-03 — **HIGH** — `examples/otel_quickstart.rs:13-50` — Example is a phantom-API sketch
**Evidence:** 8+ unresolved references (see §5.2 table); uses `pheno_flags::Flag`, `FlagSet::new("otel-quickstart")`, `.flag(Flag::<String>::new(...).short('n'))`, `flags.parse_from(...)`, `resolved.get::<String>(...)` — none defined in `src/lib.rs`. Imports `pheno_otel::trace::{emit, span}` and `pheno_otel::ExporterConfig` — neither path exists in `pheno-otel`.
**Description:** The example is written as if `pheno-flags` exposed a `clap`/`pico-args`-style typed CLI flag builder (with a `short()` shorthand and a generic `Flag<T>` type) and `pheno-otel` exposed a `trace` module with `emit`/`span` functions. Neither subsystem has anything like this. The example would not produce a single successful `cargo check --examples`.
**Impact:** `cargo build --examples` fails. The example is the only artifact in the `examples/` directory that mentions `pheno-otel`, so its failure is the visible signal that the cross-substrate integration story is unbuilt. The 71-pillar audit (line 43) gave L33 a 2/3 citing "`examples/quickstart.rs` works; no `cargo run` example alias" — but the **second** example doesn't work at all, and this isn't noted anywhere.

### P-1B-04 — **HIGH** — `benches/flags_lookup.rs:7-15` & `benches/flags_stress.rs:7-31` — Benches reference a phantom type `Flags`
**Evidence:** `use pheno_flags::Flags;` (lookup:7, stress:7); `Flags::from_env_pairs(pairs.into_iter())` (lookup:15, stress:18,31); `flags.get("FLAG_000500")` (lookup:23). The real type is `FlagSet` (`src/lib.rs:94`), with no `from_env_pairs` and no `get` method (the actual lookup is `is_enabled` returning `bool`, not a value).
**Description:** The benchmark files were written against an imagined API (string-valued flag store with a generic `get` method) and would not compile against the real `pheno_flags` crate. The benches also use `criterion` with `default-features = false, features = ["cargo_bench_support"]` (`benches/Cargo.toml:9`) — that feature name is real, but the rest of the API contract is fictional.
**Impact:** `cargo bench --bench flags_lookup` fails. The 71-pillar audit (L19, line 42) scored 1/3 with the note "No PGO, no benchmarks, no perf CI job" — **wrong** about the existence of benchmarks. The benches exist, they just don't compile. Any future perf-regression work (L57 in AGENTS.md:91) starts from a non-compiling baseline.

### P-1B-05 — **MEDIUM** — `llms.txt:14-17` — Public API summary is partly fabricated
**Evidence:** `llms.txt:14-15` claims `FlagError` has `UnknownKey`, `InvalidValue { key, value }`, `EmptyPrefix` variants; `llms.txt:16-17` claims `merge(base, overlay)` exists.
**Description:** The actual `FlagError` enum (`src/lib.rs:73-83`) has one variant `InvalidValue(String)` carrying only the variable name. The actual public surface has no `merge` function. The 71-pillar audit (L66, line 143) scored the API docs 3/3 citing "Thorough doc comments on every public item; 5 executable doc tests" — but `llms.txt` is also a public-API doc and it is wrong on 3 of 5 listed items.
**Impact:** An LLM (or developer) using `llms.txt` as the canonical API summary will write code that calls `.merge(a, b)` and pattern-matches on `FlagError::EmptyPrefix` — both of which will not compile. The 71-pillar audit's own L66 score of 3/3 should be revised to 1/3 for this crate.

### P-1B-06 — **MEDIUM** — `Cargo.toml:27-28` — Unused `[dev-dependencies]`: `serde_json` and `tokio`
**Evidence:** `[dev-dependencies] serde_json = "1"`; `[dev-dependencies] tokio = { version = "1", features = ["macros", "rt-multi-thread"] }`. `rg 'serde_json|tokio' tests/flag_test.rs` returns 0 hits. The only consumer of `serde_json` is the broken `examples/otel_quickstart.rs:17` (which wouldn't compile anyway). `rg 'tokio' src/ tests/ examples/ benches/` returns 0 hits.
**Description:** Two dev dependencies that nobody uses. The `tokio` features `["macros", "rt-multi-thread"]` are pointless without any `#[tokio::test]` or async fixture. `AGENTS.md:17` even claims "Test framework: `cargo test` (standard library + `tokio::test`)" — there is no `tokio::test` in the test suite.
**Impact:** The `Cargo.lock` ships deps that are never exercised, and the CI step `cargo test --all-features` (`.github/workflows/ci.yml:19`) will resolve them every run. The AGENTS.md description of the test framework is misleading.

### P-1B-07 — **MEDIUM** — `Cargo.toml:1` — `[workspace]` is empty + crate is not a member of the root monorepo
**Evidence:** `Cargo.toml:1` declares `[workspace]` (empty); the argis-extensions monorepo root has **no `Cargo.toml` at all** (`/Users/kooshapari/CodeProjects/Phenotype/repos/argis-extensions/Cargo.toml` does not exist). Compare: the substrate at `pheno/crates/phenotype-flags/Cargo.toml:1` has the same `[workspace]` empty pattern, but it lives inside the `pheno` monorepo (which has a root `Cargo.toml`).
**Description:** The `pheno-flags` subtree is a standalone package, not a workspace member. It cannot share a `Cargo.lock` with `argis-extensions` (the parent isn't a Cargo workspace). It also cannot share lockfiles with the substrate (`pheno/crates/phenotype-flags/`), which is in a different monorepo. This is fine **if** the subtree is intended to be lifted out as a standalone crate on `crates.io` (which `Cargo.toml:12 publish = true` suggests), but it is inconsistent with the "absorb into argis-extensions monorepo" workflow that AGENTS.md's "Stack" and "Key Commands" sections imply.
**Impact:** The crate's "substrate" status is ambiguous. It cannot be tested in lockstep with other `argis-extensions/pheno-*` siblings (e.g. `pheno-port-adapter`, `config`) because there is no `argis-extensions/Cargo.toml`. Phase 2 needs to decide: lift to a real workspace, or commit to standalone-on-crates.io.

### P-1B-08 — **HIGH** — `findings/71-pillar-2026-06-20-pheno-flags.md:156` — Audit falsely claims 6 community files exist
**Evidence:** Audit line 156 lists `CODEOWNERS, CODE_OF_CONDUCT, CONTRIBUTING.md, PULL_REQUEST_TEMPLATE.md, ISSUE_TEMPLATE/*, SECURITY.md` as present. `find pheno-flags -name 'CODEOWNERS' -o -name 'CODE_OF_CONDUCT.md' -o -name 'CONTRIBUTING.md' -o -name 'PULL_REQUEST_TEMPLATE.md' -o -name 'SECURITY.md' -o -path '*/ISSUE_TEMPLATE/*'` returns 0 hits. Line 144 falsely claims `CHANGELOG.md` follows Keep a Changelog format. Line 112 falsely claims `SECURITY.md` documents a disclosure process. Line 155 falsely claims "only MIT file present — Apache-2.0 file missing" — actually **neither** is present.
**Description:** The cycle-4 71-pillar audit is **systematically wrong** about the meta-bundle. The L70 score of 3/3 is a hallucination; the real L70 score should be 0/3 (nothing present). The L67 score of 3/3 should be 0/3 (no CHANGELOG). The L69 score of 3/3 should be 1/3 (Cargo.toml declares a SPDX expression but ships no LICENSE files). The L53 score of 3/3 should be 0/3 (no SECURITY.md).
**Impact:** The audit is the most recent governance artifact for this crate (cycle 4, dated 2026-06-20), and it has ~6-7 demonstrable false-positive pillar scores. Any reviewer using the audit to make a keep/deprecate decision will be misled. The audit was apparently written from the **AGENTS.md + llms.txt claims** rather than from `find`-based ground truth — a classic "doc-trusts-doc" failure mode.

### P-1B-09 — **MEDIUM** — `AGENTS.md:21-25` — Stack section claims 4 dependencies that aren't there
**Evidence:** Lines 21-25 list `tokio` (async flag updates), `serde` + `serde_json` (flag persistence), `parking_lot::RwLock` (low-contention reads), `pheno-tracing` (observability). `[dependencies]` has only `thiserror` + `pheno-otel` (the latter unused); no `tokio`, no `serde`, no `parking_lot`, no `tracing`/`pheno-tracing`. The `pheno-tracing` crate **does not exist** in `argis-extensions` (`find argis-extensions -name 'pheno-tracing' -type d` returns empty).
**Description:** The "Stack" section is a wishlist, not a description of reality. The `pheno-tracing` citation is a broken cross-reference (AGENTS.md:24 + AGENTS.md:98).
**Impact:** New contributors told to "use `pheno-tracing` for observability" (per AGENTS.md) will search the monorepo, find nothing, and have to ask. The Stack section is a top-3 read on first contact.

### P-1B-10 — **MEDIUM** — `llms.txt:38-39` — File inventory lists 2 LICENSE files that don't exist
**Evidence:** `llms.txt:38-39` lists `- LICENSE-MIT, LICENSE-APACHE — dual license`. `find pheno-flags -name 'LICENSE*'` returns 0 hits. `Cargo.toml:7` has `license = "MIT OR Apache-2.0"` (SPDX expression) but no files back it. `deny.toml:13-24` allows `MIT` and `Apache-2.0` but those allowlist entries are vacuous without the files. `justfile:55-60` `validate` recipe does not check for LICENSE files (gap).
**Description:** The crate declares dual-license but ships neither file. `cargo publish` would fail at the package validation step (cargo requires either a LICENSE file matching the SPDX expression, or a `license-file` field in `Cargo.toml`).
**Impact:** The crate cannot be published to crates.io in its current state. The license is metadata-only. This contradicts the "Substrate Quality" goal (ADR-023 Rule 3.1 calls for a release-ready crate).

### P-1B-11 — **MEDIUM** — `AGENTS.md:91` — Forward plan references nonexistent symbol `FlagStore::get`
**Evidence:** `AGENTS.md:91` `- v12 T9 (L57 perf regression) — benchmark FlagStore::get for hot-path latency`. `src/lib.rs` has no `FlagStore` type (it's `FlagSet`), and the real lookup method is `is_enabled` returning `bool`, not `get` returning a value.
**Description:** The v12 forward plan is anchored to a symbol that does not exist. The actual hot-path method is `is_enabled`; the bench files in `benches/` (see P-1B-04) are similarly miscalibrated on a phantom `Flags::get`.
**Impact:** The forward-looking plan is a no-op for the real codebase. If someone picks up L57 in v12, they'll have to re-spec it from scratch.

### P-1B-12 — **LOW** — `examples/quickstart.rs:4` — Docstring mentions `MYAPP_DEBUG=0` env var that is never read
**Evidence:** Line 4 docstring: `MYAPP_DARK_MODE=1 MYAPP_BETA=yes MYAPP_DEBUG=0 cargo run --example quickstart`. The example body (`:6-34`) only checks `DARK_MODE` (line 18) and `BETA` (line 24) — `DEBUG` is never queried.
**Description:** Cosmetic drift in the example's docstring. Probably the env was meant to be checked but the line was deleted; or the doc was written before the example was scoped down.
**Impact:** First-touch UX. A user following the docstring will set a `MYAPP_DEBUG=0` env var that the example ignores. Harmless, but exemplifies that even the one example that **does** compile has been edited without re-reading the header.

### P-1B-13 — **LOW** — `src/lib.rs:1-65` — Module docs link `[`FlagSet::snapshot`]` but no rustdoc-rendered `[`FlagSet::from_env`]` link target check
**Evidence:** Rustdoc intra-doc links `[`FlagSet::snapshot`]` and `[`FlagSet::from_env`]` resolve correctly in `cargo doc` because the items exist. **No bug** — this is a non-finding noted only to confirm intra-doc links are consistent.
**Impact:** None.

### P-1B-14 — **LOW** — `Cargo.toml:7-9` — `license` field has no backing file (consolidates P-1B-10 with the publish-blocking angle)
**Evidence:** SPDX `MIT OR Apache-2.0` (line 7) but no `LICENSE`, `LICENSE-MIT`, or `LICENSE-APACHE` files on disk.
**Description:** Repeat of P-1B-10 from the publish-blocking angle. Cargo will reject `cargo publish` until a LICENSE file is added.
**Impact:** `cargo publish` cannot succeed.

### P-1B-15 — **LOW** — `tests/flag_test.rs:23` — `ENV_LOCK` is acquired but `.unwrap_or_else(|e| e.into_inner())` is a poison-tolerant pattern
**Evidence:** Line 23 `static ENV_LOCK: Mutex<()> = Mutex::new(());`; lines 75, 90, 105 `_guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());`. Comment lines 13-22 explain why.
**Description:** Defensive lock pattern, not a bug. The 3 env-mutating tests correctly serialize; the 5 read-only tests do not acquire the lock. Pattern is correct. **Non-finding.**
**Impact:** None.

### P-1B-16 — **LOW** — `Cargo.toml:9` — `keywords` includes non-standard `"ff-free"`
**Evidence:** Line 10: `keywords = ["phenotype", "feature-flags", "config", "env", "ff-free"]`. `"ff-free"` is not a recognized cargo convention; `"feature-flags"` is the conventional spelling.
**Description:** Cosmetic. `"ff-free"` looks like a typo/abbreviation; if meant as "fossil-free" or "flag-flip-free" it should be expanded. Otherwise harmless — `cargo publish` will accept any 5 short keywords.
**Impact:** Cosmetic; unusual keyword may make the crate harder to discover on crates.io.

### P-1B-17 — **INFO** — `findings/71-pillar-2026-06-20-pheno-flags.md:6` — `Repo: KooshaPari/pheno-flags (v0.1.0)` but no such GitHub repo
**Evidence:** Audit metadata line 5-6: `Repo: KooshaPari/pheno-flags (v0.1.0)` / `Commit: TBD (scored at ref chore/tier-0-hygiene-orch-v10-025)`. The local subtree is at `argis-extensions/pheno-flags/`, not at a `KooshaPari/pheno-flags` GitHub repo. `gh repo view KooshaPari/pheno-flags` would need to be checked from the orchestrator (not done in Phase 1B).
**Description:** The 71-pillar audit's metadata block references a GitHub repo that may or may not exist. Phase 2 should verify with `gh api /repos/KooshaPari/pheno-flags` and resolve the discrepancy.
**Impact:** Unclear; depends on whether the repo exists upstream.

### P-1B-18 — **INFO** — `Cargo.toml:1` `[workspace]` declaration
**Evidence:** Line 1: `[workspace]` (empty table).
**Description:** The empty `[workspace]` table is a common pattern for "this crate is a package, not a workspace member". It tells cargo to treat `Cargo.toml` as a single-package manifest rather than inheriting from a parent. This is **not** a bug; it is a deliberate choice. Both the source repo and the substrate use this pattern. **Non-finding.**
**Impact:** None.

### P-1B-19 — **INFO** — Doctest at `src/lib.rs:14-24` uses `.with("dark_mode", true).with("beta_export", false)`
**Evidence:** Lines 14-24: same code as the substrate's doctest (which uses `phenotype_flags::FlagSet`).
**Description:** The source repo and substrate have **identical doctests** (modulo `pheno_flags` vs `phenotype_flags` import path). The doctest corpus is byte-equivalent after the import substitution. **Non-finding**, but useful for Phase 2: the public API surface appears to be a copy of the substrate.
**Impact:** None directly; informs the absorption decision.

### P-1B-20 — **INFO** — Substrate `phenotype-flags` has 12 in-file unit tests; source repo has 0
**Evidence:** `pheno/crates/phenotype-flags/src/lib.rs:222-360` has `#[cfg(test)] mod tests { ... }` with 12 `#[test]` fns (`test_new_is_empty`, `test_with_and_is_enabled`, `test_last_write_wins`, `test_snapshot_sorted`, `test_default_is_empty`, `test_clone_equality`, `test_parse_bool_truthy`, `test_parse_bool_falsy`, `test_parse_bool_invalid`, `test_from_env_invalid_value` (with `should_panic`), `test_from_env_skips_nonprefixed`, `test_from_env_skips_exact_prefix_match`, `test_from_env_empty_prefix_key_is_error`). Source repo `tests/flag_test.rs` has 0 unit tests in-file.
**Description:** The source repo has **different test architecture** from the substrate: integration-test-only vs. unit-test-only. Phase 2 will need to decide which to keep, or whether to merge the two corpora. The source repo's 8 integration tests cover the same behaviors as the substrate's 12 unit tests, plus a few extras (the `set_var`/`remove_var` cleanup pattern, the `is_enabled_returns_false_for_unknown_key` test).
**Impact:** Informs the merge strategy for Phase 2.

---

## 7. Comparison context (source vs substrate)

The 71-pillar audit refers to `pheno-flags` as a separate, parallel implementation of `phenotype-flags` (the substrate at `pheno/crates/phenotype-flags/`). The two crates are remarkably similar.

### 7.1 Module-level structure

| Aspect | Source `pheno-flags` | Substrate `phenotype-flags` |
|--------|----------------------|------------------------------|
| Crate name | `pheno-flags` | `phenotype-flags` |
| Lib name | `pheno_flags` | `phenotype_flags` |
| Lines of code (lib) | 220 | 360 (incl. 138 lines of in-source `#[cfg(test)] mod tests`) |
| Public items | `FlagSet` + `FlagError` (1 enum + 1 struct + 5 methods + 1 private `parse_bool`) | **Identical** public items |
| Doctests | 5 (3 run + 1 no_run + 1 run) | 5 (identical after `pheno_flags` → `phenotype_flags` substitution) |
| Tests | 0 in-source, 8 integration (`tests/flag_test.rs`) | 12 in-source, 0 integration |
| Test framework | `std::sync::Mutex<()>` for env serialization | raw `std::env::set_var` in unit tests (no lock — works because cargo test runs in parallel and `#[cfg(test)]` unit tests don't share process env across threads in the same way, though this is technically racy) |
| Dependencies | `thiserror` (used) + `pheno-otel` (UNUSED) + dev: `serde_json`, `tokio` (both UNUSED) | `thiserror` only (workspace-inherited) |
| `[features]` | None | None |
| Examples | `quickstart.rs` (compiles) + `otel_quickstart.rs` (broken) | (no examples dir) |
| Benches | 2 (both broken, reference phantom `Flags` type) | (no benches dir) |
| `AGENTS.md` / `llms.txt` | Both present; **both** contain phantom-API claims (see Bugs P-1B-02, P-1B-05, P-1B-09) | (AGENTS.md, llms.txt absent at substrate — substrate lives inside the `pheno` monorepo and inherits repo-level governance) |
| Coverage gate | `llvm-cov.toml` with lines=80, branches=75, funcs=80 | (no llvm-cov.toml — coverage is enforced at the monorepo root) |
| CI workflow | `.github/workflows/ci.yml` (31 lines, 2 jobs) | (no `.github/workflows` — inherited from `pheno` monorepo) |
| License files | **None** | Inherited from `pheno` monorepo |
| `publish` | `publish = true` (Cargo.toml:12) — but would fail validation | inherited from `pheno` workspace |

### 7.2 What is in the source but NOT in the substrate

1. **`AGENTS.md` + `llms.txt` + `justfile` + `deny.toml` + `llvm-cov.toml` + `coverage.sh`** — meta-bundle for the substrate is at the monorepo level, not per-crate. The source has these files (good intent) but their content is partly fabricated (Bugs P-1B-02/05/09).
2. **`.github/workflows/ci.yml`** — the source has its own minimal CI; the substrate inherits from `pheno`. The source's CI is real (would run test + coverage) but cannot run `cargo build --examples` because the example is broken.
3. **`examples/quickstart.rs`** — a real, compiling 35-line example. Substrate has no examples dir.
4. **`benches/{flags_lookup,flags_stress}.rs` + `benches/Cargo.toml`** — criterion-based benchmarks. They reference a phantom API (`pheno_flags::Flags`), so they don't compile, but the structure is right. Substrate has no benches.
5. **`Cargo.toml:8` `rust-version = "1.82"`** — pinned. Substrate inherits from workspace (likely an older MSRV).
6. **`Cargo.toml:9` `description`** — present and accurate. Substrate's description (line 6) is shorter but accurate too.
7. **The "Substrate Quality (71-Pillar Targets)" section in `AGENTS.md:54-65`** — source declares explicit coverage-gate contract. Substrate relies on the `pheno` monorepo's coverage policy.

### 7.3 What is in the substrate but NOT in the source

1. **In-source unit tests (`pheno/crates/phenotype-flags/src/lib.rs:222-360`)** — 12 unit tests including `test_from_env_invalid_value` (uses `#[should_panic]`), `test_from_env_skips_nonprefixed`, `test_from_env_skips_exact_prefix_match`, `test_from_env_empty_prefix_key_is_error`. The source's integration tests cover the same ground but using `Result<_, FlagError>` (no `should_panic`). See P-1B-20.
2. **Workspace-inherited versioning + license** — substrate is in a real Cargo workspace; source is standalone.
3. **The `repository`, `documentation`, `categories` fields in `Cargo.toml`** — substrate's Cargo.toml is minimal; source's adds `description`, `keywords`, `categories`, `publish`, `rust-version`, `readme` is absent.
4. **Substrate's doctest at `pheno/crates/phenotype-flags/src/lib.rs:222-360` has more edge cases** — e.g., `test_from_env_empty_prefix_key_is_error` checks the `<PREFIX>_` with no key case (source's integration test `from_env_rejects_invalid_value` only checks the bad-value case, not the empty-key case). **Actually wait** — let me re-check. The source's `from_env` (line 162-172) DOES treat empty keys as invalid (`src/lib.rs:162-172`), and the substrate has an explicit test for it. The source's `tests/flag_test.rs` does NOT have a corresponding integration test. **Subtle coverage gap** — see Bug P-1B-21 below.

### P-1B-21 — **LOW** — `tests/flag_test.rs` — Missing integration test for the empty-key edge case
**Evidence:** `src/lib.rs:162-172` treats `<PREFIX>_` (no key) as an invalid value (stashes the var name in `offending` and breaks). The substrate has `test_from_env_empty_prefix_key_is_error` (`pheno/crates/phenotype-flags/src/lib.rs:349-359`) explicitly testing this. The source's `tests/flag_test.rs` has no test for the empty-key case.
**Description:** The source's `from_env` is correct (verified by reading the code), but the test suite does not lock in the behavior. A future refactor could regress it silently. The 71-pillar audit (L25 Edge Cases, line 57) scores 2/3 and says "no empty-string key test" — so the audit **did** notice, but the gap was not closed.
**Impact:** Future regression risk. Low because the source code is small and the path is obvious, but the substrate has a one-line test that the source is missing.

---

## 8. Summary table (for Phase 2 input)

| Dimension | Source repo verdict | Severity of worst defect |
|---|---|---|
| Public API compiles & is consistent with `src/lib.rs` | Yes (1 enum + 1 struct + 5 methods) | — |
| Doctests in source | 5, all accurate | — |
| Integration tests | 8, all accurate; cover truthy/falsy/invalid env values; use `ENV_LOCK` to serialize process-global env | — |
| `examples/quickstart.rs` | Compiles ✓ | LOW (P-1B-12: docstring drift on `MYAPP_DEBUG`) |
| `examples/otel_quickstart.rs` | **Does not compile** (8+ phantom references) | **HIGH** (P-1B-03) |
| `benches/flags_lookup.rs`, `benches/flags_stress.rs` | **Do not compile** (phantom `pheno_flags::Flags` type) | **HIGH** (P-1B-04) |
| `Cargo.toml` `[dependencies]` | `thiserror` used; **`pheno-otel` is phantom** | **HIGH** (P-1B-01) |
| `Cargo.toml` `[dev-dependencies]` | `serde_json`, `tokio` are **both phantom** (no test uses them) | MEDIUM (P-1B-06) |
| `[features]` | None declared; `--all-features` is a no-op | INFO |
| `Cargo.toml` `license` field | SPDX `MIT OR Apache-2.0` but **no LICENSE files** | MEDIUM (P-1B-10, P-1B-14) — blocks `cargo publish` |
| `AGENTS.md` Quickstart | Fabricated API (9 phantom references) | **HIGH** (P-1B-02) |
| `AGENTS.md` Stack | Lists 4 deps not in Cargo.toml + 1 sibling crate that doesn't exist in this monorepo | MEDIUM (P-1B-09) |
| `llms.txt` Public API | Partly fabricated: `FlagError` variants, `merge()` function | MEDIUM (P-1B-05) |
| `llms.txt` Files list | Claims 2 LICENSE files; omits `otel_quickstart.rs` | MEDIUM (P-1B-10, cross-ref) |
| Meta-bundle (README, CHANGELOG, LICENSE, CODEOWNERS, CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, PR template, issue templates) | **None present**, despite 71-pillar audit claiming most are | **HIGH** (P-1B-08 — the audit itself is broken) |
| `71-pillar-2026-06-20-pheno-flags.md` audit | Cycle 4, 2.37/3 overall, but ~6-7 false-positive scores (L67 CHANGELOG, L70 community files, L69 LICENSE files, L53 SECURITY, L19 PGO/benchmarks) | **HIGH** (P-1B-08) |
| CI workflow | Real, runs `cargo test --all-features` and `cargo llvm-cov`. Does not build examples. | MEDIUM |
| Coverage gate | `llvm-cov.toml` lines=80/branches=75/funcs=80 + `scripts/coverage.sh` + `justfile:38` — but `ci.yml:28` does **not** pass `--fail-under-lines`, so the gate is not actually enforced in CI. **Coverage gate claim vs enforcement drift.** | MEDIUM (P-1B-22 below) |
| Substrate comparison | Public API byte-equivalent (modulo crate name); test architecture differs (integration-only vs unit-only); 12 substrate unit tests are not in source; 1 substrate edge-case test (empty-key) is missing from source's integration suite | LOW (P-1B-20, P-1B-21) |

### P-1B-22 — **MEDIUM** — `.github/workflows/ci.yml:28` + `llvm-cov.toml:14-17` — Coverage gate is not enforced in CI
**Evidence:** `ci.yml:28` runs `cargo llvm-cov --all-features --lcov --output-path lcov.info` (no `--fail-under-lines`); `llvm-cov.toml:14-17` sets `lines = 80`, `branches = 75`, `functions = 80` thresholds; `scripts/coverage.sh:14` runs `cargo llvm-cov --config llvm-cov.toml --summary-only --fail-under-lines 80`; `justfile:38` runs `cargo llvm-cov --html --fail-under-lines 80`. The CI workflow **never calls `coverage.sh` or `just coverage`** and **never passes `--fail-under-lines`**, so the 80% threshold is documented but not enforced in CI.
**Description:** The coverage gate is a policy that exists in 3 places (llvm-cov.toml, justfile, scripts/coverage.sh) and is **bypassed by the only job that actually runs in CI** (`.github/workflows/ci.yml:21-31`). The 71-pillar audit (L32, line 73) scored 3/3 with the note "llvm-cov.toml with 80% lines / 75% branches / 80% functions gate (ADR-040)" — but the gate is not wired into CI.
**Impact:** A 50% line-coverage regression would not fail the CI build. The "ADR-040 80% lib gate" is aspirational, not enforced.

---

## 9. Phase 2 inputs (one-line each)

For the matrix/decision phase:

- **Public API is sound** (5 methods on `FlagSet` + 1 error enum, all matching the substrate). Source compiles and tests pass (13 = 8 integration + 5 doctests, per 71-pillar audit line 58).
- **`Cargo.toml` needs surgery:** drop phantom `pheno-otel` dep (P-1B-01), drop phantom `serde_json` + `tokio` dev-deps (P-1B-06), add LICENSE files or drop the `publish = true` flag (P-1B-10, P-1B-14), wire the coverage gate into CI (P-1B-22).
- **Examples + benches are broken** at the API level (P-1B-03, P-1B-04) and need to be either rewritten against the real API or deleted.
- **All documentation files (`AGENTS.md`, `llms.txt`) describe a fabricated API** that doesn't exist in source (P-1B-02, P-1B-05, P-1B-09). They must be rewritten from `src/lib.rs` ground truth, not from one another.
- **The 71-pillar audit is itself broken** (P-1B-08): it claims 6 community files and a CHANGELOG that don't exist, and it scored the L19/L67/L69/L70/L53 pillars on those hallucinations. The audit doc needs to be re-scored against `find`-based ground truth before Phase 2 can trust it.
- **The substrate is byte-equivalent in public API** to the source (modulo `pheno_flags` vs `phenotype_flags` import path). Source has 0 in-source unit tests; substrate has 12. Phase 2 should consider whether to (a) absorb source into substrate and discard, (b) absorb substrate into source, or (c) keep both with the test-architecture divergence.
- **One behavioral coverage gap:** substrate has a test for `<PREFIX>_` empty-key invalid-value case; source has the implementation (`src/lib.rs:162-172`) but no test (P-1B-21).

**End of Phase 1B. Phase 2 (synthesis + decision) deferred.**
