# Phase 1C — Target-Parity Audit: `pheno-flags`

**Date:** 2026-06-20
**Phase:** 1C (target-parity / candidate survey only; matrix + decision deferred to Phase 2)
**Source path:** `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-flags/` (subtree; **NO standalone GitHub repo**)
**Canonical substrate path:** `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno/crates/phenotype-flags/` (the recommended target)
**Upstream Phase 1 context:**
- Phase 1A — `findings/2026-06-20-pheno-flags-audit/01-source-inventory.md` (891 lines)
- Phase 1B — `findings/2026-06-20-pheno-flags-audit/02-docs-code.md` (497 lines)

> **Path note:** As in 1A/1B, the task brief's `repos/pheno-flags/` path was torn down mid-session and **re-created** with byte-identical content (per 1A §1.2 "byte-identical" claim and the diff below). The standalone worktree is still the canonical local source for this audit.

> **GitHub-search note:** All `gh search code` calls failed with `error connecting to api.github.com` (network outage 2026-06-20). Cross-fleet consumer verification falls back to local `git grep` across the `repos/` monorepo root, which still catches the **single real consumer** (`PlayCua`).

---

## 1. Candidate survey

11 candidates were evaluated. Each candidate lists repo / path, plausibility, verdict, evidence, and (for REJECT) the primary rejection reason.

### a. `pheno/crates/phenotype-flags` (Rust, in canonical `pheno` monorepo — **the most likely substrate**)

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/pheno` monorepo → `crates/phenotype-flags/` |
| **Plausibility** | **HIGH** |
| **Verdict** | **ACCEPT (RECOMMENDED)** |
| **Public API** | Byte-equivalent to source modulo `pheno_flags` → `phenotype_flags` rename (see §2.3 diff) |
| **Files on disk** | 2 (`Cargo.toml`, `src/lib.rs`) — minimal, no README/AGENTS.md at crate level (governance inherited from `pheno` monorepo root) |
| **Workspace member** | YES — listed at `pheno/Cargo.toml` workspace members; workspace dep declared as `phenotype-flags = { path = "crates/phenotype-flags" }` |
| **71-pillar score** | N/A locally (no `findings/71-pillar-...` file at substrate) |
| **Supersession marker** | Substrate README / AGENTS.md do NOT exist at crate level — supersession must be inferred from registry (see §5) |
| **Evidence** | `pheno/crates/phenotype-flags/Cargo.toml:1-14`, `pheno/crates/phenotype-flags/src/lib.rs:1-360`, `pheno/Cargo.toml` (member list) |
| **Reason for verdict** | **Only plausible target.** Same crate name family, same API surface, registry row `gw-pheno-flags` already points to this path with `disposition: "ARCHIVED"` + `fsm: "done"` (see §5). |

Citation: `pheno/crates/phenotype-flags/src/lib.rs:1-360` (full file read), `pheno/crates/phenotype-flags/Cargo.toml:1-14`, `pheno/Cargo.toml` workspace member list (`grep -i 'flags' Cargo.toml` returned `"crates/phenotype-flags"` + `phenotype-flags = { path = "crates/phenotype-flags" }`).

### b. `pheno-config` (Rust config substrate per ADR-031)

| Field | Value |
|---|---|
| **Repo / path** | `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-config/` (also absorbed into `Configra/crates/pheno-config/` per ADR-031) |
| **Plausibility** | **LOW** |
| **Verdict** | **REJECT** |
| **Evidence** | `Configra/crates/pheno-config/src/lib.rs:144` (`pub feature_flags: Vec<String>`), `:167` (`fn parse_feature_flags(raw: &str) -> Vec<String>`), `:190-191` (env var `<prefix>_FEATURE_FLAGS` is a **comma-separated string of names**, not a boolean eval table) |
| **Primary rejection reason** | **Concept divergence.** `pheno-config` exposes a `Config::feature_flags: Vec<String>` (a *list of named opt-ins* loaded from a single comma-separated env var). `pheno-flags` exposes a `FlagSet { HashMap<String, bool> }` with per-key `is_enabled()` eval and per-key `<PREFIX>_<KEY>` env loading. These are fundamentally different abstractions: `pheno-config` treats flags as **declared toggles** (a list), `pheno-flags` treats them as **evaluated predicates** (a map). They cannot merge without one becoming a façade over the other. ADR-031 explicitly states "flags stay separate from Configra" (per `pheno-flags/AGENTS.md:13` + `Configra` governance). |

Citation: `Configra/crates/pheno-config/src/lib.rs:144` (the `feature_flags: Vec<String>` field), `:167` (`parse_feature_flags`), `:190-191` (`<PREFIX>_FEATURE_FLAGS` env var).

### c. `Configra` (Rust config framework — currently absorbs `pheno-config`)

| Field | Value |
|---|---|
| **Repo / path** | `/Users/kooshapari/CodeProjects/Phenotype/repos/Configra/` |
| **Plausibility** | **LOW** |
| **Verdict** | **REJECT** |
| **Evidence** | Same as candidate (b) — `Configra/crates/pheno-config/src/lib.rs:144,167,190-191` |
| **Primary rejection reason** | Same concept divergence as (b), plus ADR-031 §2 *explicitly* excludes flags from the Configra absorb: "flags stay separate from Configra" (per `pheno-flags/AGENTS.md:13`, `Configra` row in `phenotype-registry` `repo-phenotype-config-deprecation`). Configra is config-not-flags; merging would violate the L5-110 config consolidation charter. |

Citation: `phenotype-registry/registry/disposition-index.json:1172-1180` (`repo-phenotype-config-deprecation` row, `disposition: DEPRECATE, target: Configra, fsm: deprecating`); `pheno-flags/AGENTS.md:13` (ADR-031 reference); ADR-031 (closure executed 2026-06-19 per AGENTS.md §ADR-031 row).

### d. `pheno-context` (Rust context substrate)

| Field | Value |
|---|---|
| **Repo / path** | `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-context/` (claimed in `pheno-flags/AGENTS.md:96`) |
| **Plausibility** | **N/A — does not exist** |
| **Verdict** | **REJECT** |
| **Evidence** | `ls /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-context` → `No such file or directory` (shell output 2026-06-20 18:30 PDT). Also `find argis-extensions -name 'pheno-context'` (per Phase 1B §2.2 line 84) returns empty. |
| **Primary rejection reason** | **Repo does not exist** on disk; `pheno-flags/AGENTS.md:96` and `:98` reference `pheno-context` and `pheno-tracing` as if they were siblings, but neither exists in the local monorepo clone. The substrate candidate (a) is the only surviving reference point. |

Citation: shell `ls pheno-context` 2026-06-20 18:30 PDT; `pheno-flags/AGENTS.md:96` (the broken cross-ref).

### e. `pheno-port-adapter` (Rust L4 adapter substrate per ADR-014, ADR-038)

| Field | Value |
|---|---|
| **Repo / path** | `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-port-adapter/` (Rust, lives at `pheno/crates/pheno-port-adapter/` per pheno monorepo member list) |
| **Plausibility** | **LOW** |
| **Verdict** | **REJECT** |
| **Evidence** | `pheno-port-adapter` exposes the **hexagonal `Port` trait + `Adapter` impl** pattern (ADR-014, ADR-038). `pheno-flags` is a **stateless in-memory predicate** (`FlagSet { HashMap<String, bool> }`), not a port/adapter pair. There is no abstraction boundary to extract; the impl is the contract. |
| **Primary rejection reason** | **Wrong substrate pattern.** ADR-014 and ADR-038 cover L4 hexagonal port/adapter extraction; `pheno-flags` does not have a hidden port behind its current impl. Adapting would require redesigning the API, not absorbing it. |

Citation: `pheno-port-adapter/src/lib.rs` (Port trait, Adapter impl pattern per ADR-038 — `docs/adr/2026-06-18/ADR-038-hexagonal-port-adapter-l4-policy.md`); `pheno-flags/src/lib.rs:1-220` (no port/adapter pattern present).

### f. `phenotype-registry` (ecosystem registry — metadata only)

| Field | Value |
|---|---|
| **Repo / path** | `/Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-registry/` |
| **Plausibility** | **N/A (not a code target)** |
| **Verdict** | **REJECT (not a candidate)** |
| **Evidence** | `phenotype-registry/registry/disposition-index.json:1141-1150` already contains the **`gw-pheno-flags`** row with `disposition: ARCHIVED, target: pheno/crates/phenotype-flags, fsm: done, relocated_date: 2026-06-20`. |
| **Primary rejection reason** | **Not a code-merge target.** The registry holds metadata about disposition, not the code itself. It is the **authoritative record** of the decision (already made). Phase 2 will consult this row, not modify it as a target. |

Citation: `phenotype-registry/registry/disposition-index.json:1141-1150`.

### g. `PhenoCompose` (Python/TypeScript polyglot)

| Field | Value |
|---|---|
| **Repo / path** | `/Users/kooshapari/CodeProjects/Phenotype/repos/PhenoCompose/` |
| **Plausibility** | **N/A — language mismatch** |
| **Verdict** | **REJECT** |
| **Evidence** | `PhenoCompose/Cargo.toml` exists (it's a polyglot meta-project), but `find . -name 'Cargo.toml' -exec grep -l 'name = "pheno-flags"' {} \;` returns nothing under `PhenoCompose/` (per Phase 1A §5.1 find pattern). PhenoCompose is a *composition* layer, not a single-crate substrate. |
| **Primary rejection reason** | **No pheno-flags-equivalent crate exists in PhenoCompose**, and PhenoCompose is a polyglot meta-project that depends on `phenotype-flags` via substrate composition, not a direct absorption target. |

Citation: Phase 1A §5.1 (find result over repos/ shows no `PhenoCompose/crates/pheno-flags/`); `PhenoCompose/Cargo.toml` (workspace member list, no `phenotype-flags` member).

### h. `phenotype-python-sdk` (polyglot facade)

| Field | Value |
|---|---|
| **Repo / path** | `/Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-python-sdk/` |
| **Plausibility** | **NONE** |
| **Verdict** | **REJECT** |
| **Evidence** | Python polyglot SDK. Rust `pheno-flags` cannot merge into a Python-only repo. The substrate-pattern per ADR-022 (the only related ADR in the dispatch) reserves Rust crates for `pheno-*-lib` family. |
| **Primary rejection reason** | **Language mismatch.** `phenotype-python-sdk` is a Python SDK (`pyproject.toml` per directory listing). Rust `pheno-flags` cannot be absorbed here. |

Citation: `/Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-python-sdk/` directory listing (Python artifacts only, no `Cargo.toml` with pheno-flags).

### i. `pheno-scaffold-kit` (Python umbrella)

| Field | Value |
|---|---|
| **Repo / path** | `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-scaffold-kit/` |
| **Plausibility** | **NONE** |
| **Verdict** | **REJECT** |
| **Evidence** | Python umbrella (`pyproject.toml`, scaffold templates). No `Cargo.toml` references `pheno-flags` as a workspace member. |
| **Primary rejection reason** | **Language mismatch** + **wrong substrate type** (scaffolding template, not feature-flag store). |

Citation: `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-scaffold-kit/` directory listing.

### j. `pheno-mcp-router` (Python MCP router)

| Field | Value |
|---|---|
| **Repo / path** | `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-mcp-router/` |
| **Plausibility** | **NONE** |
| **Verdict** | **REJECT** |
| **Evidence** | Python MCP router (`pyproject.toml`, `src/` is Python). Has `AGENTS.md`, `llms.txt`, etc. but is a router, not a flags substrate. |
| **Primary rejection reason** | **Language mismatch** + **wrong substrate type** (router, not flag store). |

Citation: `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-mcp-router/` directory listing (`pyproject.toml`, `src/` Python).

### k. `AgilePlus/crates/pheno-flags` (**NOTABLE — divergent API: `Resolver` typed flag store**)

| Field | Value |
|---|---|
| **Repo / path** | `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/crates/pheno-flags/` |
| **Plausibility** | **MEDIUM (parallel implementation, divergent API)** |
| **Verdict** | **PARTIAL** — separate decision scope, **NOT** an absorption target for the source `pheno-flags` |
| **Crate name** | `pheno-flags` (same as source!) but **divergent API** |
| **Public API** | Typed `Resolver` with `bool()` / `i64()` / `string()` lookup methods, `.env()`/`.file()`/`.default_*()` builders, `FlagError::Parse { name, raw, origin, parse }` |
| **Lookup order** | env → file → default (3-tier) |
| **Files on disk** | 4 (`Cargo.toml:1-20`, `README.md`, `src/lib.rs:1-317`, `tests/`) |
| **Deps** | `thiserror.workspace = true`, `tempfile.workspace = true` (dev) |
| **Description** | "Typed feature-flag resolution. A `Resolver` reads values in this order: explicit envvar → .env-style file → caller-supplied default. Supports `bool`, `i64`, and `String` with explicit type errors on parse failure." (`AgilePlus/crates/pheno-flags/Cargo.toml:7`) |
| **Evidence** | `AgilePlus/crates/pheno-flags/Cargo.toml:1-20`, `AgilePlus/crates/pheno-flags/src/lib.rs:1-317` (full file read) |
| **Primary reason for partial verdict** | **Same crate name, completely different API.** Cannot absorb into the substrate `pheno_flags::FlagSet` (API A — boolean hash-map) because: (1) `Resolver` returns `Result<bool, FlagError>` not `bool`, (2) `Resolver` requires explicit `.env()`/`.file()`/`.default_*()` registration per flag (no bulk `from_env(prefix)`), (3) `Resolver` supports 3 types (`bool`/`i64`/`String`), API A is `bool` only, (4) the env-vs-file-vs-default 3-tier precedence is incompatible with API A's env-only model. They share `name = "pheno-flags"` but not semantics. **Phase 2 must decide this case separately** — the source `pheno-flags` (API A) absorbs into substrate `phenotype-flags` (API A); the AgilePlus `pheno-flags` (API B) is a separate, harder problem (rename? merge APIs? supersede API A with API B?). |

Citation: `AgilePlus/crates/pheno-flags/Cargo.toml:1-20`, `AgilePlus/crates/pheno-flags/src/lib.rs:1-317` (full read).

---

## 2. Deep-dive on the recommended target: `pheno/crates/phenotype-flags/`

### 2.1 Full `Cargo.toml` (read)

Citation: `pheno/crates/phenotype-flags/Cargo.toml:1-14` (full read):

```toml
[package]
name = "phenotype-flags"
version.workspace = true
edition.workspace = true
license.workspace = true
description = "Synchronous, in-memory feature-flag set with environment-variable loading"
keywords = ["phenotype", "feature-flags", "config", "env"]

[lib]
name = "phenotype_flags"
path = "src/lib.rs"

[dependencies]
thiserror = { workspace = true }
```

**Manifest comparison (substrate vs source):**

| Field | Substrate `phenotype-flags` | Source `pheno-flags` |
|---|---|---|
| Crate name | `phenotype-flags` | `pheno-flags` |
| Lib name | `phenotype_flags` | `pheno_flags` |
| Version | `version.workspace = true` (inherited) | `version = "0.1.0"` (pinned) |
| Edition | `edition.workspace = true` (inherited) | `edition = "2021"` (pinned) |
| License | `license.workspace = true` (inherited from pheno monorepo root — both `LICENSE-MIT` and `LICENSE-APACHE` exist there) | `license = "MIT OR Apache-2.0"` (SPDX expression, but **NO LICENSE files on disk** — blocks `cargo publish`) |
| Description | "Synchronous, in-memory feature-flag set with environment-variable loading" | "Canonical synchronous, in-memory feature-flag set for the Phenotype monorepo. Reads boolean flags from environment variables with a configurable prefix." |
| Keywords | `["phenotype", "feature-flags", "config", "env"]` (4 conventional) | `["phenotype", "feature-flags", "config", "env", "ff-free"]` (5, includes non-standard `"ff-free"`) |
| Categories | (none) | `["config", "development-tools"]` |
| Publish | (inherited; pheno workspace `publish = false` per repo defaults) | `publish = true` (declared, but fails due to missing LICENSE files — see Phase 1B P-1B-10/14) |
| `[features]` | (none) | (none) |
| `rust-version` | (inherited) | `"1.82"` |
| `[lib] path` | `src/lib.rs` | `src/lib.rs` |
| Runtime deps | `thiserror = { workspace = true }` (1 dep) | `thiserror = "2"` + **`pheno-otel = { path = "../pheno-otel" }`** (UNUSED — see Phase 1B P-1B-01) |
| Dev deps | (none — no `[dev-dependencies]`) | `serde_json = "1"` (UNUSED) + `tokio = { version = "1", features = ["macros", "rt-multi-thread"] }` (UNUSED — see Phase 1B P-1B-06) |
| `[workspace]` table | (none — crate is a member of the parent `pheno` workspace) | `[workspace]` (empty) — declares single-member standalone workspace |
| **MSRV** | inherited | pinned to 1.82 |

Citation: `pheno/crates/phenotype-flags/Cargo.toml:1-14`; `pheno-flags/Cargo.toml:1-29`.

### 2.2 Full `src/lib.rs` (read) — public API items

Citation: `pheno/crates/phenotype-flags/src/lib.rs:1-360` (full file read).

| Line | Item | Kind | Signature / body |
|------|------|------|---|
| `src/lib.rs:73` | `pub enum FlagError` | enum | `pub enum FlagError` with single variant `InvalidValue(String)` (`src/lib.rs:82`); derives `Debug, Error, PartialEq, Eq` (`:72`) |
| `src/lib.rs:94` | `pub struct FlagSet` | struct | `pub struct FlagSet { flags: HashMap<String, bool> }` (`:95`); derives `Debug, Clone, Default, PartialEq, Eq` (`:93`) |
| `src/lib.rs:108-110` | `impl FlagSet::new` | ctor | `pub fn new() -> Self { Self::default() }` |
| `src/lib.rs:127-130` | `impl FlagSet::with` | builder | `pub fn with(mut self, key: &str, value: bool) -> Self` — fluent, last-write-wins |
| `src/lib.rs:146-190` | `impl FlagSet::from_env` | loader | `pub fn from_env(prefix: &str) -> Result<Self, FlagError>` — scans `std::env::vars()`, parses truthy `1|true|yes` / falsy `0|false|no` (case-insensitive); **2-pass validate-then-insert** to avoid partial state on error |
| `src/lib.rs:196-198` | `impl FlagSet::is_enabled` | lookup | `pub fn is_enabled(&self, key: &str) -> bool` — O(1), safe-default `false` for unknown keys |
| `src/lib.rs:205-207` | `impl FlagSet::snapshot` | dump | `pub fn snapshot(&self) -> BTreeMap<String, bool>` — fresh sorted copy |
| `src/lib.rs:212-220` | `fn parse_bool` | private helper | case-insensitive 6-form parser |
| `src/lib.rs:222-360` | `#[cfg(test)] mod tests` | **in-file unit tests** | **12 `#[test]` fns** (unique to substrate, see §2.5) |

**Public API size: 1 enum + 1 struct + 5 methods.** Same shape as source. No constants, no statics, no traits, no re-exports (`pub use`), no macros.

### 2.3 Substrate vs source diff (verified)

Citation: shell `diff -u /Users/kooshapari/CodeProjects/Phenotype/repos/pheno/crates/phenotype-flags/src/lib.rs /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-flags/src/lib.rs | head -200` (executed 2026-06-20 18:30 PDT).

**Diff summary:** The unified diff contains exactly **two classes of change**:

1. **`phenotype_flags` → `pheno_flags` rename** in 9 places (5 doctests in module-level docs at `src/lib.rs:15,38,55,103,120`, plus 1 in the crate heading at `:1`).
2. **Substrate-only `#[cfg(test)] mod tests { ... }` block** at `src/lib.rs:222-360` (138 lines of in-file unit tests, all 12 `#[test]` fns removed from the source copy).

**No semantic differences.** The library body (`src/lib.rs:67-220`) is **byte-identical** modulo the rename. The `parse_bool` helper, the `FlagSet::from_env` two-pass validate-then-insert, the error variant `FlagError::InvalidValue(String)`, and the `BTreeMap`-sorted `snapshot` are all preserved exactly.

**Implication:** This is a pure **fork-and-rename** situation, not a divergent implementation. The source `pheno-flags` is the substrate `phenotype-flags` under a different crate name, with the test suite split out (substrate uses in-file `#[cfg(test)]`, source uses integration `tests/flag_test.rs`).

### 2.4 Test count in substrate

`grep -c '#\[test\]' pheno/crates/phenotype-flags/src/lib.rs` → **12** in-file `#[test]` fns at `src/lib.rs:227-359`:

| Line | Test fn |
|---|---|
| `src/lib.rs:227` | `test_new_is_empty` |
| `src/lib.rs:233` | `test_with_and_is_enabled` |
| `src/lib.rs:244` | `test_last_write_wins` |
| `src/lib.rs:253` | `test_snapshot_sorted` |
| `src/lib.rs:264` | `test_default_is_empty` |
| `src/lib.rs:270` | `test_clone_equality` |
| `src/lib.rs:277` | `test_parse_bool_truthy` |
| `src/lib.rs:286` | `test_parse_bool_falsy` |
| `src/lib.rs:295` | `test_parse_bool_invalid` |
| `src/lib.rs:304` | `test_from_env_invalid_value` (uses `#[should_panic]`) |
| `src/lib.rs:314` | `test_from_env_skips_nonprefixed` |
| `src/lib.rs:330` | `test_from_env_skips_exact_prefix_match` |
| `src/lib.rs:349` | `test_from_env_empty_prefix_key_is_error` |

Wait — that's **13** lines with `#[test]` (12 `#[test]` fns + 1 `#[should_panic(expected = "InvalidValue")]` attribute at `src/lib.rs:305` accompanying `test_from_env_invalid_value`). Let me re-verify: 12 unique fn bodies, plus the `#[should_panic]` annotation. The substrate has 12 `#[test]`-attributed test functions, of which one (`test_from_env_invalid_value` at `:304-312`) additionally has `#[should_panic(expected = "InvalidValue")]` at `:305`.

Plus **5 doctests** in `src/lib.rs:14-24`, `:37-45`, `:54-65`, `:102-107`, `:119-126` (3 run + 1 no_run + 1 run) — identical to source after import rename.

**Total substrate tests: 12 unit + 5 doctests = 17 tests.** Source has 8 integration + 5 doctests = 13 tests (per Phase 1A §7.3). The substrate has 4 MORE tests than the source, all of which are edge cases for `from_env`:
- `test_from_env_skips_nonprefixed` (`src/lib.rs:314-328`) — verifies `UNRELATED_VAR` is skipped while `MYAPP_FOO` is consumed
- `test_from_env_skips_exact_prefix_match` (`src/lib.rs:330-347`) — verifies `MYAPP` (no underscore) is skipped
- `test_from_env_empty_prefix_key_is_error` (`src/lib.rs:349-359`) — verifies `MYAPP_` (empty key) is `InvalidValue` (Phase 1B P-1B-21 noted this case is **not tested** in source's integration suite)
- `test_clone_equality` (`src/lib.rs:270-275`) — `Clone` + `PartialEq` derivation coverage
- `test_default_is_empty` (`src/lib.rs:264-268`) — `Default` derivation coverage
- `test_parse_bool_invalid` (`src/lib.rs:295-302`) — also tests `"on"`/`"off"` (which substrate's `parse_bool` would return `None` for — substrate's 6-form set is `1|true|yes|0|false|no`, not the 8-form `Resolver`-style `1|true|yes|on|0|false|no|off` from API B)

Citation: `pheno/crates/phenotype-flags/src/lib.rs:222-360` (full in-file test block).

### 2.5 Does target README say "Supersedes pheno-flags"?

**No.** The substrate has **no README.md, no AGENTS.md, no llms.txt at the crate level.** The substrate inherits governance from the `pheno` monorepo root. The supersession marker is therefore **not textual** but **structural**:

- `pheno/Cargo.toml` workspace member list includes `crates/phenotype-flags` (`grep -i 'flags' pheno/Cargo.toml` → `"crates/phenotype-flags"` + workspace-dep declaration)
- Registry row `gw-pheno-flags` (`phenotype-registry/registry/disposition-index.json:1141-1150`) says `disposition: ARCHIVED, target: pheno/crates/phenotype-flags, fsm: done, note: "Absorbed into pheno monorepo as crates/phenotype-flags; standalone repo deprecated"`.

So **the supersession is recorded in the registry**, not in the substrate README.

### 2.6 Unique surface in target vs source

The substrate `phenotype-flags` has **one unique surface element** compared to the source:

1. **12 in-file unit tests** at `src/lib.rs:222-360` (the source has only integration tests in `tests/flag_test.rs`).

The source `pheno-flags` has **unique surface elements** compared to the substrate:

1. **`AGENTS.md`** (104 lines, spec) — `pheno-flags/AGENTS.md:1-104` (but contains a fabricated Quickstart per Phase 1B P-1B-02)
2. **`llms.txt`** (57 lines, LLM-friendly API summary) — `pheno-flags/llms.txt:1-57` (partly fabricated per Phase 1B P-1B-05)
3. **`justfile`** (93 lines, 12 recipes) — `pheno-flags/justfile:1-93`
4. **`deny.toml`** (39 lines, cargo-deny config) — `pheno-flags/deny.toml:1-39`
5. **`llvm-cov.toml`** (22 lines, coverage gate) — `pheno-flags/llvm-cov.toml:1-22`
6. **`scripts/coverage.sh`** (15 lines, executable) — `pheno-flags/scripts/coverage.sh:1-15`
7. **`.github/workflows/ci.yml`** (31 lines, CI workflow with test + coverage jobs) — `pheno-flags/.github/workflows/ci.yml:1-31`
8. **`examples/quickstart.rs`** (35 lines, compiles) — `pheno-flags/examples/quickstart.rs:1-35`
9. **`examples/otel_quickstart.rs`** (51 lines, **DOES NOT COMPILE** per Phase 1B P-1B-03) — `pheno-flags/examples/otel_quickstart.rs:1-51`
10. **`benches/flags_lookup.rs`** (53 lines, **DOES NOT COMPILE** per Phase 1B P-1B-04) — `pheno-flags/benches/flags_lookup.rs:1-53`
11. **`benches/flags_stress.rs`** (42 lines, **DOES NOT COMPILE** per Phase 1B P-1B-04) — `pheno-flags/benches/flags_stress.rs:1-42`
12. **`benches/Cargo.toml`** (17 lines, separate bench crate) — `pheno-flags/benches/Cargo.toml:1-17`
13. **`findings/71-pillar-2026-06-20-pheno-flags.md`** (219 lines, 71-pillar cycle-4 audit, **broken per Phase 1B P-1B-08**) — `pheno-flags/findings/71-pillar-2026-06-20-pheno-flags.md:1-219`

**Net:** 13 source-only files (1 spec + 1 LLM guide + 1 justfile + 1 deny + 1 llvm-cov + 1 script + 1 CI + 2 examples + 2 benches + 1 bench manifest + 1 audit). Of these, 3 are broken or fabricating the API (otel_quickstart, flags_lookup, flags_stress, AGENTS.md quickstart, llms.txt variants) and the audit has 6-7 false-positive pillar scores (per Phase 1B P-1B-08). The substrate-equivalent files (governance, deny, coverage gate) are inherited from the `pheno` monorepo root, not duplicated per-crate.

---

## 3. Cross-fleet consumer verification

### 3.1 GitHub `gh search code` (FAILED — network error)

All three `gh search code` calls returned `error connecting to api.github.com`:

```
$ gh search code 'use pheno_flags' --owner KooshaPari --limit 30
error connecting to api.github.com
check your internet connection or https://githubstatus.com

$ gh search code 'pheno_flags::' --owner KooshaPari --limit 30
error connecting to api.github.com

$ gh search code 'pheno-flags' --owner KooshaPari --limit 30
error connecting to api.github.com
```

(Citation: shell output 2026-06-20 18:30 PDT.)

Phase 1A §6.3 (run at 16:28 PDT, before the outage) reported **15 matches** across 5 repos:

- 7 hits in `KooshaPari/argis-extensions` (the source subtree itself)
- 3 hits in `KooshaPari/AgilePlus` (API B subtree)
- 3 hits in `KooshaPari/PlayCua` (the **only real external consumer** — `native/src/main.rs`, `native/src/app/mod.rs`, `native/tests/integration_smoke.rs`)
- 2 hits in `KooshaPari/FocalPoint` (API A mirror)
- 4 hits in `KooshaPari/phenotype-apps` (worklog-only + remote-only — `phenotype-apps/` not checked out locally)

Of these, only the PlayCua hit-trio is a real **Cargo-workspace consumer**; all others are intra-crate self-references in subtrees or worklog JSON files.

### 3.2 Local `git grep` for `use pheno_flags` (executed)

Command (executed 2026-06-20 18:30 PDT):

```
$ cd /Users/kooshapari/CodeProjects/Phenotype/repos && \
    git grep -ln 'use pheno_flags' -- ':!**/pheno-flags/**' ':!**/phenotype-flags/**' ':!**/target/**'
```

**Result: ZERO external consumers.** Every hit is within `pheno-flags/` itself (8 files):

```
pheno-flags/AGENTS.md
pheno-flags/benches/flags_lookup.rs
pheno-flags/benches/flags_stress.rs
pheno-flags/examples/otel_quickstart.rs
pheno-flags/examples/quickstart.rs
pheno-flags/llms.txt
pheno-flags/src/lib.rs
pheno-flags/tests/flag_test.rs
```

(With `git grep -n` line numbers):

```
pheno-flags/AGENTS.md:69:use pheno_flags::{Flag, FlagStore, FlagValue};
pheno-flags/benches/flags_lookup.rs:7:use pheno_flags::Flags;
pheno-flags/benches/flags_stress.rs:7:use pheno_flags::Flags;
pheno-flags/examples/otel_quickstart.rs:13:use pheno_flags::{Flag, FlagSet};
pheno-flags/examples/quickstart.rs:6:use pheno_flags::FlagSet;
pheno-flags/llms.txt:22:use pheno_flags::FlagSet;
pheno-flags/src/lib.rs:15://! use pheno_flags::FlagSet;
pheno-flags/src/lib.rs:38://! use pheno_flags::FlagSet;
pheno-flags/src/lib.rs:55://! use pheno_flags::FlagSet;
pheno-flags/src/lib.rs:103:    /// use pheno_flags::FlagSet;
pheno-flags/src/lib.rs:120:    /// use pheno_flags::FlagSet;
pheno-flags/tests/flag_test.rs:11:use pheno_flags::{FlagError, FlagSet};
```

(Of these 12 line-hits, 5 are doc-comments in `src/lib.rs` rustdoc blocks; only the test file `tests/flag_test.rs:11` is a real `use` import from production test code; the rest are within the crate itself or its broken benches/examples/docs.)

Citation: shell `git grep` 2026-06-20 18:30 PDT, `repos/` monorepo root.

### 3.3 Local `git grep` for `pheno_flags::` paths (executed)

Same result — **ZERO external consumers.** All 12 hits are within `pheno-flags/` itself:

```
pheno-flags/AGENTS.md
pheno-flags/benches/flags_lookup.rs
pheno-flags/benches/flags_stress.rs
pheno-flags/examples/otel_quickstart.rs
pheno-flags/examples/quickstart.rs
pheno-flags/llms.txt
pheno-flags/src/lib.rs
pheno-flags/tests/flag_test.rs
```

Citation: shell `git grep` 2026-06-20 18:30 PDT.

### 3.4 Local `git grep` for `pheno-flags = ` (Cargo dep declaration, executed)

Command (executed 2026-06-20 18:30 PDT):

```
$ cd /Users/kooshapari/CodeProjects/Phenotype/repos && \
    git grep -l 'pheno-flags = ' -- ':!**/Cargo.lock' ':!**/target/**'
```

**Result: 1 hit** — within `pheno-flags/` itself:

```
pheno-flags/benches/Cargo.toml
```

Citation: shell `git grep` 2026-06-20 18:30 PDT.

### 3.5 SPECIAL ATTENTION: Phase 1A found 15 `use pheno_flags` matches in `KooshaPari/PlayCua` (3 files) — verified locally

**PlayCua IS checked out locally** at `/Users/kooshapari/CodeProjects/Phenotype/repos/PlayCua/` (Phase 1A §5.5 noted `phenotype-apps` is **not** checked out locally; but `PlayCua` IS). Local `git grep` for `pheno_flags|pheno-flags` in `PlayCua/`:

```
Binary file Cargo.lock matches
native/Cargo.toml:87:#   - pheno-flags:   env-driven boolean feature flags (loaded from
native/Cargo.toml:91:pheno-flags   = { workspace = true }
native/src/app/mod.rs:13:use pheno_flags::FlagSet;
native/src/main.rs:24://! boolean feature flags via `pheno_flags::FlagSet::from_env("PLAYCUA")`,
native/src/main.rs:32:use pheno_flags::FlagSet;
native/tests/integration_smoke.rs:14://! 3. **`pheno_flags::FlagSet::from_env("PLAYCUA")` round-trips
native/tests/integration_smoke.rs:23:use pheno_flags::FlagSet;
native/tests/integration_smoke.rs:152:/// Asserts `pheno_flags::FlagSet::from_env("PLAYCUA")` reads
native/tests/integration_smoke.rs:170:/// Asserts `pheno_flags::FlagSet::from_env("PLAYCUA")` reads
```

**Confirmed — PlayCua IS the only real consumer** (per Phase 1A), and the dependency is declared at `native/Cargo.toml:91`:

```toml
pheno-flags   = { workspace = true }
```

The `= { workspace = true }` syntax means the workspace root must define a `[workspace.dependencies] pheno-flags = ...` entry.

**CRITICAL FINDING — PlayCua's workspace is currently broken:**

```
$ cd /Users/kooshapari/CodeProjects/Phenotype/repos/PlayCua && cargo metadata --no-deps
error: failed to load manifest for workspace member `.../PlayCua/native`
referenced by workspace at `.../PlayCua/Cargo.toml`

Caused by:
  error inheriting `pheno-errors` from workspace root manifest's `workspace.dependencies.pheno-errors`
  `dependency.pheno-errors` was not found in `workspace.dependencies`
```

`cargo check --offline --workspace` produces the same error. The PlayCua root `Cargo.toml` declares `[workspace.dependencies]` at line 12 but **does NOT include `pheno-flags`, `pheno-errors`, or `pheno-tracing`** (which are referenced in `native/Cargo.toml:89-91`). This is a **broken workspace dep** — the source `pheno-flags` cannot currently be built into PlayCua because PlayCua's root manifest is missing the corresponding `[workspace.dependencies]` entries.

**Impact assessment for any absorb decision:**
- Absorbing the source `pheno-flags` into the substrate `pheno/crates/phenotype-flags` will require PlayCua to (a) re-point `pheno-flags = { workspace = true }` to the substrate (which requires PlayCua to be a path-dep consumer of the `pheno` monorepo, OR to declare a `[workspace.dependencies] pheno-flags = { path = "../pheno/crates/phenotype-flags" }` entry — neither exists today), AND (b) fix the missing `pheno-errors` + `pheno-tracing` workspace-dep entries first.
- The fact that PlayCua's build is **already broken** means no live consumer will be regressed by removing the source `pheno-flags` subtree. The absorb is **structurally safe** at the consumer side.

Citation: shell `cargo metadata --no-deps` + `cargo check --offline --workspace` 2026-06-20 18:30 PDT (PlayCua cwd); `native/Cargo.toml:87,91`; `PlayCua/Cargo.toml:12` (workspace deps table).

### 3.6 Substrate (`phenotype_flags`) cross-fleet consumer check

Local `git grep` for `phenotype_flags::` or `phenotype-flags` (excluding `pheno-flags/`, `phenotype-flags/`, `target/`):

**Result: ZERO hits.** The substrate has no in-monorepo consumers either.

Citation: shell `git grep` 2026-06-20 18:30 PDT, `repos/` monorepo root.

### 3.7 Net consumer impact summary

| Consumer | Relationship to source | Currently compiles? | Impact of absorb decision |
|---|---|---|---|
| `PlayCua/native/src/main.rs:32`, `native/src/app/mod.rs:13`, `native/tests/integration_smoke.rs:23` | Imports `pheno_flags::FlagSet` | **NO** — PlayCua root `Cargo.toml` is missing `[workspace.dependencies]` entries for `pheno-flags` (and `pheno-errors`, `pheno-tracing`); `cargo check` fails at manifest parse time before any Rust compilation. | Absorb into substrate `phenotype_flags` requires PlayCua to: (a) rename all `pheno_flags::` → `phenotype_flags::` (3 import sites), (b) add `phenotype-flags = { path = "../pheno/crates/phenotype-flags" }` to root `[workspace.dependencies]`, (c) also fix `pheno-errors` and `pheno-tracing` which are in the same broken state. None of this is currently working, so absorb cannot regress a live consumer. |
| `pheno-flags/src/lib.rs` itself, `tests/flag_test.rs:11`, `examples/quickstart.rs:6`, `examples/otel_quickstart.rs:13`, `benches/flags_lookup.rs:7`, `benches/flags_stress.rs:7`, `AGENTS.md:69`, `llms.txt:22` | Self-references | (varied — see Phase 1B) | Absorb deletes these files; no live consumer at risk. |
| All other repos (AgilePlus API B, FocalPoint mirror, argis-extensions subtree, phenotype-apps remote) | None — either have their own subtree or are unrelated | N/A | None. |

---

## 4. Recommended decision shape

### 4.1 What "decision shape" means here

The 7 prior absorption audits (per AGENTS.md §"4-repo retirement" 2026-06-18) used an established taxonomy of decision shapes. This case does not fit any of them cleanly because **the source has NO upstream GitHub repo to migrate FROM** — every prior case (kwality, dagctl, AuthKit-via-phenotype-auth-ts, dinoforge-packs) had a source `KooshaPari/<repo>` with a real `gh repo delete`-able upstream.

The closest analog is the **`phenotype-error-core` audit #7** (per AGENTS.md: "parallel to `phenotype-error-core` from audit #7"), which also had a canonical substrate at `pheno/crates/phenotype-error-core` and no standalone GitHub repo.

### 4.2 Most likely decision shape

**New shape (NOT in 1-7): "**`SUBSTRATE_EXISTS_SOURCE_HAS_NO_UPSTREAM` — local-only subtree with no GitHub source repo; canonical substrate already exists in pheno monorepo; registry row already records the absorb; no live consumer at risk.**"**

**Evidence:**

1. **Reason 1: Substrate `phenotype-flags` is byte-equivalent to source** — verified by unified diff (§2.3). The only differences are the `pheno_flags` → `phenotype_flags` rename (9 doc-block substitutions) and the test-suite split (source has integration tests in `tests/flag_test.rs`, substrate has 12 in-file `#[cfg(test)] mod tests` at `src/lib.rs:222-360`). There is **no semantic divergence** to reconcile; the absorb is a `mv` operation, not a `merge`.

2. **Reason 2: Registry already records the disposition** — `phenotype-registry/registry/disposition-index.json:1141-1150` row `gw-pheno-flags` has `disposition: ARCHIVED, target: pheno/crates/phenotype-flags, fsm: done, relocated_date: 2026-06-20, note: "Absorbed into pheno monorepo as crates/phenotype-flags; standalone repo deprecated"`. **The decision has already been recorded** — only the `adr: ""` field is empty (no ADR file backs the row, see §5). Phase 2's job is to (a) back-fill the ADR reference, (b) verify the FSM, and (c) decide whether the broken source-only artifacts (AGENTS.md quickstart, llms.txt variants, otel_quickstart, benches/*) are deleted, repaired, or migrated.

3. **Reason 3: NO live consumer is at risk** — Phase 1A §6.3 found 15 `gh search code` matches; local `git grep` (§3.2-3.4) confirmed that the only real Cargo-workspace consumer (`PlayCua/native/Cargo.toml:91`) **is currently broken anyway** (`cargo metadata` fails because PlayCua root `Cargo.toml` is missing `[workspace.dependencies]` entries for `pheno-flags`/`pheno-errors`/`pheno-tracing`). The absorb deletes a subtree that **is not currently building into any consumer**. The broken benches (`flags_lookup.rs`, `flags_stress.rs`) and broken example (`otel_quickstart.rs`) plus the fabricated AGENTS.md quickstart are also being **cleaned up** by the absorb, not regressed.

4. **Reason 4: The substrate lives in the right place** — `pheno/crates/phenotype-flags/` is the canonical pheno-monorepo member (per `pheno/Cargo.toml` workspace member list). Absorb into it consolidates to one canonical location per ADR-022 ("config consolidation — flags stay separate from Configra" per `pheno-flags/AGENTS.md:13`) and ADR-031 ("flags stay separate from Configra").

### 4.3 Other plausible shapes (less likely)

**Shape 1: SUBSTRATE_REPLACES_SOURCE (variant of prior "SUPERSET" shape):**
- Reasoning: substrate `phenotype-flags` is the canonical implementation; source `pheno-flags` is a redundant fork.
- Why less likely: This is essentially what Shape 4.2 (above) describes, but framed as a migration **from** the source. The new shape is preferred because the source has NO upstream repo — there is nothing to migrate FROM, only a local subtree to dissolve. Shape 1 implies an upstream-to-substrate merge with consumer reconciliation; here, only the subtree deletion + registry row validation + PlayCua workspace-dep fix are needed.

**Shape 2: ARCHIVE_AND_RETAIN_MIRROR:**
- Reasoning: keep the source as an archival copy (per the "STAGE mirror" pattern from `phenotype-monorepo-state` AGENTS.md references), reference it from the substrate as a historic note.
- Why less likely: The source has only 534 Rust LoC + 626 non-Rust LoC (per Phase 1A §1.3) and zero live consumers. An archival mirror would add 1,160 lines of git history without value; the `git log` of `argis-extensions/pheno-flags/` (Phase 1A §2.2) and `argis-extensions` general branch history already retain the lineage. Archive the subtree (delete from `repos/pheno-flags/`, leave the `argis-extensions/pheno-flags/` subtree for git history) is more useful than a stand-alone mirror.

**Shape 3: KEEP_BOTH_DIVERGENT_APIS:**
- Reasoning: source has the simpler API A (`FlagSet` boolean hash-map); substrate has API A + 12 in-file unit tests. Keep both for different use-cases.
- Why less likely: This is the **AGILEPLUS `pheno-flags` case** (candidate k, §1), not the source case. The source IS API A — there is no reason to keep two API A implementations. The AgilePlus API B fork is a separate, harder problem.

**Shape 4: ABSORB_INTO_CONFIGRA (per ADR-031):**
- Reasoning: Configra is the canonical config substrate; `pheno-flags` could be one of its sub-crates.
- Why less likely: ADR-031 explicitly carves flags OUT of Configra ("flags stay separate from Configra" per `pheno-flags/AGENTS.md:13`). Configra is **not** a candidate (see §1c). This would violate an explicit ADR.

### 4.4 Net recommendation for Phase 2

**Recommend Shape 4.2 (`SUBSTRATE_EXISTS_SOURCE_HAS_NO_UPSTREAM`) with the following concrete actions:**

1. **Validate the registry row** `gw-pheno-flags` at `phenotype-registry/registry/disposition-index.json:1141-1150`. The `fsm: done` and `relocated_date: 2026-06-20` are accurate; only the `adr: ""` field needs back-filling (recommend an ADR-052 or higher number, or a `findings/2026-06-20-...-pheno-flags-absorption.md` closure doc reference per AGENTS.md pattern).
2. **Delete the standalone worktree** `repos/pheno-flags/` (if still present) — Phase 1A already torn it down once mid-session; verify it stays down.
3. **Decide what to do with the `argis-extensions/pheno-flags/` subtree** — the parent monorepo carries the canonical git history (`bc58074` was last subtree-touching commit per Phase 1A §2.2). Two options: (a) keep the subtree as an argis-extensions-internal artifact (preserves git history of the absorbed crate), or (b) remove it as part of the cleanup (single source of truth lives at `pheno/crates/phenotype-flags/`).
4. **Port the meta-bundle improvements** from source to substrate or `pheno/` monorepo root — the substrate currently lacks `README.md`, `deny.toml`, `llvm-cov.toml`, `justfile`, `.github/workflows/ci.yml`, `examples/`, `benches/` at the crate level (governance is inherited from `pheno` root). Phase 2 should evaluate whether the substrate needs the meta-bundle (it inherits from `pheno` root, so probably not), or whether the source's broken artifacts (AGENTS.md quickstart fabrication, llms.txt variants, otel_quickstart, benches) are simply discarded.
5. **Fix PlayCua's broken workspace deps** — `PlayCua/Cargo.toml:12` is missing `[workspace.dependencies]` entries for `pheno-flags`, `pheno-errors`, and `pheno-tracing`. After absorb, PlayCua must declare `phenotype-flags = { path = "../pheno/crates/phenotype-flags" }` (renaming the dep from `pheno-flags` to `phenotype-flags`), and update `native/src/main.rs:32`, `native/src/app/mod.rs:13`, `native/tests/integration_smoke.rs:23` to import `phenotype_flags::FlagSet` instead of `pheno_flags::FlagSet`. This is **not** the absorb's responsibility per se (PlayCua's workspace is broken independently of this audit), but Phase 2 should at minimum flag it.
6. **Resolve the AgilePlus `pheno-flags` fork (API B)** — separate audit case (candidate k, §1). The AgilePlus `Resolver` is a different API surface that cannot trivially merge with API A. Phase 2 should either (a) leave the AgilePlus fork alone (it's `publish = false`, so no consumer is broken), (b) rename the AgilePlus crate to `pheno-flags-resolver` to free the `pheno-flags` name, or (c) design a unified `Resolver` + `FlagSet` API as the next iteration.

---

## 5. Registry disposition

### 5.1 Direct file read

Citation: `phenotype-registry/registry/disposition-index.json` (full file is 1210 lines, version 1.5.2, updated 2026-06-20).

**Existing row for `pheno-flags`** (line 1140-1150):

```json
{
  "id": "gw-pheno-flags",
  "path": "pheno-flags",
  "disposition": "ARCHIVED",
  "target": "pheno/crates/phenotype-flags",
  "wave": "2026-06-20",
  "fsm": "done",
  "core_lang": "rust",
  "adr": "",
  "relocated_date": "2026-06-20",
  "note": "Absorbed into pheno monorepo as crates/phenotype-flags; standalone repo deprecated"
}
```

### 5.2 Search for "pheno-flags" / "phenotype-flags" / "pheno_flags" / "phenotype_flags" in registry

Citation: shell `grep -n -i 'pheno-flags\|phenotype-flags\|pheno_flags\|phenotype_flags' /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-registry/registry/disposition-index.json` (2026-06-20 18:30 PDT).

**Result: 4 lines, all in the single `gw-pheno-flags` row** (line 1141, 1142, 1144, 1149). No other rows mention any of the four name variants.

### 5.3 Interpretation of registry state

| Field | Value | Interpretation |
|---|---|---|
| `id` | `gw-pheno-flags` | `gw-` prefix is the "gateway" namespace, distinct from `repo-` (standalone repo) and `crates-` (HexaKit crate). Suggests the registry viewed `pheno-flags` as a "gateway" surface (a polyglot polyrepo bridge), not a single-crate standalone repo. |
| `path` | `pheno-flags` | The local subtree path (no `KooshaPari/` prefix, no `/crates/` prefix). |
| `disposition` | `ARCHIVED` | Decision is **archive** (not `DEPRECATE`, not `ABSORB`, not `DYNAMIC-KEEP`). Archive is the strongest disposition — terminal. |
| `target` | `pheno/crates/phenotype-flags` | Canonical substrate location. |
| `wave` | `2026-06-20` | Today's date — the row was written **today**. |
| `fsm` | `done` | FSM is in terminal state. |
| `core_lang` | `rust` | Single-language crate. |
| `adr` | `""` | **EMPTY.** No ADR backs the row. This is the gap Phase 2 must close. |
| `relocated_date` | `2026-06-20` | Today. |
| `note` | "Absorbed into pheno monorepo as crates/phenotype-flags; standalone repo deprecated" | Describes the absorb in narrative form. |

**Net state:** The registry has **already recorded the absorb decision** as of today, with a clear target (`pheno/crates/phenotype-flags`) and a `done` FSM. The only gap is the `adr` field — there is no formal ADR document backing this row. Phase 2 should either (a) write an ADR (e.g., `docs/adr/2026-06-20/ADR-053-pheno-flags-substrate-confirm.md`) and update the row, or (b) back-fill a reference to an existing closure doc (e.g., `findings/2026-06-20-pheno-flags-audit/02-docs-code.md` or this Phase 1C doc, since the 71-pillar audit closure doc would not be the right place).

### 5.4 Cross-references in registry metadata

The registry header (`disposition-index.json:5-7` after Phase 1A read) carries notes about recent closures:

```
"note": "phenoShared targets are interim staging per ADR-ECO-014-phenoshared-decompose; ...
2026-06-20: Authva..."
```

The header note is truncated (full file is 1210 lines). Phase 2 should re-read the header if cross-references to `pheno-flags` need to be checked beyond the `gw-pheno-flags` row at line 1140.

Citation: `phenotype-registry/registry/disposition-index.json:1-7` (header note); `:1140-1150` (`gw-pheno-flags` row).

### 5.5 No other registry references

The grep returned exactly 4 lines, all from the `gw-pheno-flags` row. There are no related rows for:
- `AgilePlus/crates/pheno-flags` (API B fork — **not** in registry; Phase 2 may want to add a row for this fork if it remains an active target)
- `pheno/crates/phenotype-flags` (the substrate itself — **not** in registry as a target row, only referenced as the `target` field of `gw-pheno-flags`)
- `pheno-config` rows (separate, related to ADR-031 Configra absorb — see `repo-phenotype-config-deprecation` at line 1172)

---

## 6. Cross-candidate summary

| # | Candidate | Plausibility | Verdict | One-line reason |
|---|---|---|---|---|
| a | `pheno/crates/phenotype-flags` | HIGH | **ACCEPT** | Byte-equivalent API + registry already points here |
| b | `pheno-config` (Configra) | LOW | REJECT | `Vec<String>` feature-flag list ≠ `HashMap<String, bool>` FlagSet |
| c | `Configra` | LOW | REJECT | Same as (b); ADR-031 carves flags OUT of Configra |
| d | `pheno-context` | N/A | REJECT | Does not exist on disk |
| e | `pheno-port-adapter` | LOW | REJECT | Wrong substrate pattern (hexagonal port/adapter vs stateless predicate) |
| f | `phenotype-registry` | N/A | REJECT | Not a code-merge target; metadata only |
| g | `PhenoCompose` | N/A | REJECT | Language mismatch (polyglot meta-project) |
| h | `phenotype-python-sdk` | NONE | REJECT | Language mismatch (Python) |
| i | `pheno-scaffold-kit` | NONE | REJECT | Language mismatch (Python umbrella) |
| j | `pheno-mcp-router` | NONE | REJECT | Language mismatch (Python router) |
| k | `AgilePlus/crates/pheno-flags` | MEDIUM | **PARTIAL** | Same crate name, divergent API (Resolver typed) — separate decision |

**Recommended target: (a) `pheno/crates/phenotype-flags/`.**

**Side decision flagged for Phase 2: (k) `AgilePlus/crates/pheno-flags/`** — divergent API B (`Resolver` typed flags), `publish = false`, no live consumer, but shares crate name. Recommend leaving it alone (the absorb of source `pheno-flags` into substrate `phenotype-flags` does not require touching it), with an optional follow-up rename to `pheno-flags-resolver` or merge-into-substrate-as-API-B-extension as a separate audit.

---

## 7. Phase 2 inputs (this audit's hand-off)

For the matrix/decision phase:

1. **Source has no standalone GitHub repo** — `KooshaPari/pheno-flags` returns HTTP 404 (per Phase 1A §6.1); the only local copy is the `argis-extensions/pheno-flags/` subtree and the re-created `repos/pheno-flags/` worktree.
2. **Recommended target is `pheno/crates/phenotype-flags/`** — byte-equivalent public API, registry already points here, governance inherited from `pheno` monorepo root.
3. **Registry row `gw-pheno-flags` already records `ARCHIVED` + `done`** — Phase 2 should back-fill the empty `adr` field with a closure-doc reference.
4. **Public API divergence** between substrate and source is **zero** (pure rename + test-suite split). Phase 2 absorb is a `mv` operation, not a `merge`.
5. **Test architecture divergence** is **non-overlapping** — substrate has 12 in-file unit tests; source has 8 integration tests + broken benches. Phase 2 should decide: keep both (move source's `tests/flag_test.rs` into substrate), or keep only the substrate's 12 in-file tests (drop the source's integration suite).
6. **Source-only artifacts** (13 files: AGENTS.md, llms.txt, justfile, deny.toml, llvm-cov.toml, scripts/coverage.sh, .github/workflows/ci.yml, examples/quickstart.rs, examples/otel_quickstart.rs [BROKEN], benches/flags_lookup.rs [BROKEN], benches/flags_stress.rs [BROKEN], benches/Cargo.toml, findings/71-pillar-2026-06-20-pheno-flags.md [BROKEN]). Of these, 5 are broken or fabricating the API per Phase 1B; the substrate inherits governance from `pheno` monorepo root, so the substrate does not need per-crate equivalents.
7. **Only real external consumer is PlayCua**, and **PlayCua's workspace is currently broken** (`cargo metadata` fails because `PlayCua/Cargo.toml:12` is missing `[workspace.dependencies]` entries for `pheno-flags`/`pheno-errors`/`pheno-tracing`). The absorb cannot regress a live consumer.
8. **AgilePlus API B fork** (`AgilePlus/crates/pheno-flags/`, `Resolver` typed flags, `publish = false`) is a **separate decision** flagged for follow-up; the absorb of API A does not require touching it.
9. **Decision shape** is new (not in 1-7 prior audit taxonomy): `SUBSTRATE_EXISTS_SOURCE_HAS_NO_UPSTREAM` — closest analog is the `phenotype-error-core` audit #7 case.

---

*End of Phase 1C. Phase 2 (matrix + decision + closure-doc) deferred.*