# Phase 1B — `pheno-errors` Docs/Code Audit

**Audit agent:** Phase 1B (docs/spec/intent + source code features)
**Date:** 2026-06-20
**Repo path:** `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-errors/`
**Branch context:** `chore/v12-71-pillar-p0-remediation-2026-06-20` (one of 22+ branches touching this dir; not the `main` of the upstream `KooshaPari/argis-extensions` monorepo that contains this sub-tree)
**Discovery note:** `pheno-errors/` is a sub-directory of the `KooshaPari/argis-extensions` monorepo clone at `repos/`, NOT a standalone git repo. `git rev-parse --show-toplevel` returns `/Users/kooshapari/CodeProjects/Phenotype/repos`. Remotes point to `KooshaPari/argis-extensions.git` and `KooshaPari/phenotype-apps.git`. There is no `pheno-errors/` git directory of its own at GitHub `KooshaPari/pheno-errors` either (HTTP probe 404 on `main` and `master`).

---

## 1. Doc / claim inventory

Every README / SPEC / ADR / session claim about `pheno-errors` traced to a file:line and classified.

### 1.1 In-tree (tracked) docs

| ID | File | Line(s) | Claim | Category | Status |
|----|------|---------|-------|----------|--------|
| D-01 | `pheno-errors/AGENTS.md` | 1–3 | "Date: 2026-06-20 / Status: ACTIVE / Substrate type: pheno-*-lib" | Metadata | **partial** — AGENTS.md exists, but no SPEC.md, README.md, CHANGELOG.md, SECURITY.md, LICENSE |
| D-02 | `pheno-errors/AGENTS.md` | 9–13 | "pheno-errors is the canonical error-type substrate for the pheno-* fleet. Provides a single Error enum that wraps domain-specific error variants with contextual metadata (kind, source location, cause chain, remediation hint)" | Intent | **contradicted** — actual type is `AppError` (not `Error`); no `kind`/`source`/`remediation hint` fields beyond a `kind()` method returning a tag string; no `cause chain` plumbing; no `source location` capture |
| D-03 | `pheno-errors/AGENTS.md` | 12 | "Designed to be the canonical errors substrate per ADR-018 (PRCP pattern)" | ADR reference | **partial** — `pheno-errors` is referenced in fleet ADRs but ADR-018 PRCP pattern document is not in this repo (it lives at `docs/adr/2026-06-15/ADR-018-prcp-pattern.md` in the monorepo's wider `docs/adr/` tree) |
| D-04 | `pheno-errors/AGENTS.md` | 16 | "Test framework: cargo test + insta snapshots" | Test stack | **contradicted** — no `insta` dependency in `Cargo.toml:9-19`; no snapshot tests exist; only `cargo test` (12 tests, all in `src/lib.rs` `mod tests`) + `proptest` (`Cargo.toml:19`) |
| D-05 | `pheno-errors/AGENTS.md` | 17 | "Observability: pheno-tracing (canonical per ADR-012, ADR-036B) + pheno-otel (OTLP wire per ADR-037)" | Observability | **contradicted** — `Cargo.toml:9-19` has `tracing = "0.1"` (direct dep, NOT `pheno-tracing`); has `pheno-otel = { path = "../pheno-otel" }` but `src/lib.rs` never `use`s `pheno_otel::*`; no OTLP emission code anywhere |
| D-06 | `pheno-errors/AGENTS.md` | 21 | "Runtime: std + thiserror (derive macros)" | Dependency | **valid** — `Cargo.toml:11` has `thiserror = "2"` |
| D-07 | `pheno-errors/AGENTS.md` | 22 | "Backtrace: std::backtrace (Rust 1.65+)" | Dependency | **contradicted** — no `#[backtrace]` field on any variant; `Backtrace` type not referenced in `src/lib.rs:1-379` |
| D-08 | `pheno-errors/AGENTS.md` | 23 | "Async: tokio (for From<tokio::io::Error> conversions)" | Dependency | **contradicted** — no `tokio` dep in `Cargo.toml:9-19`; no `impl From<tokio::io::Error>` in `src/lib.rs:190-235` (only `From<std::io::Error>`, `From<&'static str>`, `From<String>`, `From<anyhow::Error>`) |
| D-09 | `pheno-errors/AGENTS.md` | 24 | "OTel export: pheno-otel — error events emitted as OTLP log records with severity mapping (WARN/ERROR/FATAL)" | Observability | **contradicted** — no OTLP emission code; the only `tracing::*` calls are inside `log_warn`/`log_error` (`src/lib.rs:159-179`) which emit to local `tracing` subscribers, NOT pheno-otel |
| D-10 | `pheno-errors/AGENTS.md` | 25 | "No CLI / no binary — library-only crate" | Scope | **valid** — `Cargo.toml` has no `[[bin]]`; only `[package]` and `[dependencies]`/`[dev-dependencies]` |
| D-11 | `pheno-errors/AGENTS.md` | 31 | "cargo build --release / cargo build --all-features" | Commands | **partial** — release build works; `--all-features` is a no-op (no features defined in `Cargo.toml`) |
| D-12 | `pheno-errors/AGENTS.md` | 36 | "cargo test --features otlp-export   # OTLP wire test (requires collector)" | Commands | **contradicted** — no `otlp-export` feature in `Cargo.toml`; no test that requires an OTLP collector; no such feature toggle |
| D-13 | `pheno-errors/AGENTS.md` | 37 | "cargo test --features snapshot       # insta snapshot tests" | Commands | **contradicted** — no `snapshot` feature; no `insta` dep; no snapshot tests |
| D-14 | `pheno-errors/AGENTS.md` | 44 | "just coverage    # uses cargo-tarpaulin, gates at 80% (lib threshold per ADR-040)" | Commands | **contradicted** — `justfile:30-32` defines `unused: cargo machete` (NOT coverage); no `coverage` recipe in `justfile:1-42`; no `cargo-tarpaulin` anywhere |
| D-15 | `pheno-errors/AGENTS.md` | 50 | "Docs (README.md + lib.rs rustdoc — every variant has a /// doc)" | Documentation | **partial** — `lib.rs` rustdoc covers all 5 variants (`src/lib.rs:65-101`); NO `README.md` exists on this branch |
| D-16 | `pheno-errors/AGENTS.md` | 52 | "Observability — tracing::error!() on every Error::new(); OTLP wire via pheno-otel (L46 P0)" | Observability | **contradicted** — no `Error::new()` method exists; no `tracing::error!()` is called unconditionally in any constructor; `tracing::warn!`/`tracing::error!` are only invoked when caller explicitly invokes `.log_warn()`/`.log_error()` |
| D-17 | `pheno-errors/AGENTS.md` | 53 | "Coverage gate — ≥ 80% (lib threshold per ADR-040)" | Coverage | **partial** — `ci.yml:62-82` has a coverage job that uploads to codecov but does NOT enforce an 80% threshold (`fail_ci_if_error: false` on `ci.yml:81`); no `cargo-llvm-cov` threshold config in repo (no `llvm-cov.toml` on this branch) |
| D-18 | `pheno-errors/AGENTS.md` | 54 | "CI gate — pheno-ci-templates runs the test matrix + coverage gate + cargo audit" | CI | **partial** — `cargo audit` IS in workflows (`.github/workflows/cargo-audit.yml`), but no `pheno-ci-templates` reference; the CI gate here is the locally-defined workflows, not a shared template |
| D-19 | `pheno-errors/AGENTS.md` | 59–69 | Quickstart example: `use pheno_errors::{Error, ErrorKind, Result}; fn load_config(path: &Path) -> Result<Config> { ... Error::new(ErrorKind::Io, "config read failed").with_source(e).with_context("path", path.display().to_string()).with_hint("check file exists and is readable") ... }` | API example | **contradicted** — API does not exist. `Error`, `ErrorKind`, `Error::new`, `with_source`, `with_context`, `with_hint` are all invented. Actual: `AppError`, `AppResult<T>`, `AppError::domain(msg)`, `AppError::storage(msg)`, no builder methods, `From<std::io::Error>` for auto-conversion |
| D-20 | `pheno-errors/AGENTS.md` | 73–77 | "Active ADRs: ADR-018 (PRCP), ADR-037 (pheno-otel OTLP wire), ADR-012 (pheno-tracing canonical), ADR-040 (Test coverage gates per tier)" | ADR list | **partial** — ADRs exist in monorepo `docs/adr/2026-06-15/ADR-018-*.md` etc., but this sub-tree has no `docs/adr/` dir; ADR-037 implementation claim (line 75) is contradicted by D-09 |
| D-21 | `pheno-errors/AGENTS.md` | 81–93 | Error Kind Categories table: Io, Parse, Config, Auth, Network, Timeout, NotFound, Conflict, Internal, External (10 kinds) with OTel severity mapping | API surface | **contradicted** — actual enum has 5 variants (`src/lib.rs:64-102`): Domain, NotFound, Conflict, Validation, Storage. No Io/Parse/Config/Auth/Network/Timeout/Internal/External. No OTel severity field on any variant. |
| D-22 | `pheno-errors/AGENTS.md` | 96–98 | "v12 T1 (L46 OTLP wire) — pheno-otel integration landed" | Roadmap status | **contradicted** — pheno-otel is declared as a dep (`Cargo.toml:16`) but `src/lib.rs` has zero `use pheno_otel::*` statements; integration is not landed at the source-code level |
| D-23 | `pheno-errors/AGENTS.md` | 106–111 | "Branch naming: chore/<req-id>-<slug>-<date> / feat/<req-id>-<slug>-<date>; Commit messages: Conventional Commits; PR labels: governance for cleanup, L<n>-#<n> for tracking; Breaking changes: Require ADR + migration guide in CHANGELOG.md" | Conventions | **partial** — branch/commit conventions are fleet-wide and apply; no `CHANGELOG.md` exists in this sub-tree |
| D-24 | `pheno-errors/Cargo.toml` | 7 | "description = 'Canonical AppError type for the pheno-* fleet. Consolidates the 5 most-common error patterns into a single, dependency-light crate.'" | Description | **valid** — accurate description of what the crate actually does |
| D-25 | `pheno-errors/Cargo.toml` | 13–16 | "`pheno-errors` uses `pheno-otel` to surface structured error context to OTLP/HTTP collectors when wired into a wider observability stack" | Dependency rationale | **contradicted** — pheno-otel is declared but `src/lib.rs:1-379` has zero references to it; no OTLP/HTTP collection wiring |
| D-26 | `pheno-errors/src/lib.rs` | 1–3 | "Canonical [`AppError`] type for the `pheno-*` fleet. Consolidates the 5 most-common error patterns observed across the L1/L2 fleet audit (2026-06-10)" | Module docs | **valid** — matches actual 5-variant enum |
| D-27 | `pheno-errors/src/lib.rs` | 5–13 | 5-variant table: Domain / NotFound / Conflict / Validation / Storage with wire-code mapping | API surface | **valid** — matches `src/lib.rs:64-102` |
| D-28 | `pheno-errors/src/lib.rs` | 15–29 | "Built on thiserror, drops into anyhow via blanket impl, From impls for io::Error / anyhow::Error / &str / String, NO blanket From<E: Error> (Rust coherence rules)" | Design notes | **valid** — matches `src/lib.rs:63-235` |
| D-29 | `pheno-errors/src/lib.rs` | 31–34 | "Consumed by L5 #81–85 across the pheno-* fleet. See V3_EXECUTION_LOG_2026_06_10.md / 'L3 #46'" | Consumption log | **missing-target** — no `V3_EXECUTION_LOG_2026_06_10.md` exists in this branch's sub-tree |
| D-30 | `pheno-errors/src/lib.rs` | 45–62 | Doctest example using `AppError::validation`, `AppError::not_found`, `.kind() == "not_found"`, `.kind() == "validation"` | Doctest | **valid** — all API used matches actual implementation |
| D-31 | `pheno-errors/.github/workflows/governance.yml` | 27–33 | "Required files: SECURITY.md, .github/dependabot.yml, .github/workflows/scorecard.yml, .editorconfig, cliff.toml, .github/CODEOWNERS" | Required-files gate | **missing-target** — only `.github/CODEOWNERS` exists on this branch; the other 5 files are absent. Workflow currently uses `::warning` (not `::error`), so it logs warnings but does not block CI. |
| D-32 | `pheno-errors/.github/workflows/ci.yml` | 4–7 | "on: push branches [main, master], pull_request, workflow_dispatch" | Trigger config | **valid** — matches YAML |
| D-33 | `pheno-errors/.github/workflows/cargo-audit.yml` | 9–10 | "schedule: cron: '0 0 * * 3' (weekly Wednesday)" | Cron | **valid** — YAML config |
| D-34 | `pheno-errors/.github/workflows/cargo-deny.yml` | 15–16 | "schedule: cron: '0 9 * * 1' (weekly Monday 09:00 UTC, matches ADR-041 cadence)" | Cron | **valid** — YAML config |
| D-35 | `pheno-errors/.github/workflows/codeql-rust.yml` | 8–9 | "schedule: cron: '17 4 * * 2' (weekly Tuesday)" | Cron | **valid** — YAML config |
| D-36 | `pheno-errors/justfile` | 1–2 | "Phenotype-org standard justfile" | Standardization claim | **partial** — present but the AGENTS.md refers to recipes (`just coverage`) that are not defined here |
| D-37 | `pheno-errors/justfile` | 30–32 | "unused: cargo machete" | Recipe | **valid** — matches `justfile:30-32` |
| D-38 | `pheno-errors/deny.toml` | 1–5 | "Mirror of the Phenotype-org standard deny policy" | Standardization claim | **valid** — standard 21-license allowlist + `[sources]` allow-registry + `[bans]` empty deny |
| D-39 | `pheno-errors/.github/CODEOWNERS` | 4–5 | "Default owner: * @KooshaPari" | Ownership | **valid** — single-owner rule |
| D-40 | `pheno-errors/Cargo.toml` | 16 | "pheno-otel = { path = '../pheno-otel' }" | Path dep | **partial** — valid path dep, but `../pheno-otel` exists only when consumed from within the local monorepo clone; not portable to external consumers |

### 1.2 Cross-referenced (external) docs

| ID | Doc | Reference | Claim about pheno-errors | Status |
|----|-----|-----------|--------------------------|--------|
| D-41 | `findings/2026-06-19-dup-matrix.md` | row 1 | "AppError enum (Domain, NotFound, Conflict, Validation, Storage) — pheno-errors, various pheno-* crates → pheno-errors ✅ Absorbed v0.1.0 created" | **valid** — matches actual 5 variants |
| D-42 | `findings/2026-06-19-dup-matrix.md` | row 7 | "Error handling patterns (From impls, logging) — pheno-errors, pheno-shared, phenotype-sdk → pheno-errors ✅ Absorbed" | **valid** — From impls + log_warn/log_error exist |
| D-43 | `findings/2026-06-20-71-pillar-cycle-2-probe.md` | L38 row | "AGENTS.md per repo 1/3 → 3/3 closed by ca5ea5bfb4 (pheno-flags + pheno-errors AGENTS.md)" | **valid** — AGENTS.md was added in `ca5ea5bfb4` |
| D-44 | `findings/2026-06-20-71-pillar-cycle-2-probe.md` | scorecard row | "pheno-errors 1.4 → 2.2 +0.8" | **valid** — score improved |
| D-45 | `findings/2026-06-20-side-02-hexagonal-fleet-audit.md` | table | "pheno-errors — 0 ports — Concrete (thiserror enums only)" | **valid** — no Port/Adapter abstraction in src/lib.rs |
| D-46 | `findings/2026-06-20-side-02-hexagonal-fleet-audit.md` | skip list | "pheno-errors — already split (thiserror derives are the Port); refactoring would add ceremony without value" | **valid** — design rationale aligns with code |
| D-47 | `findings/2026-06-20-side-11-cargo-workspace-dup-audit.md` | list | "pheno-errors — no [workspace] block; leaf crate" | **valid** — `Cargo.toml:1-20` has no `[workspace]` table |
| D-48 | `plans/2026-06-20-v13-71-pillar-cycle-2-p0.md` | T2 | "pheno-errors/devshell.nix pins rustc 1.83, cargo-xtask, criterion, cargo-fuzz, dprint" | **missing-target** — no `devshell.nix` exists in this sub-tree on this branch (planned for v13 T2) |
| D-49 | `pheno-errors` (description in Cargo.toml:7) | reference to "L1/L2 fleet audit (2026-06-10)" | Source of 5-variant decision | **missing-target** — no L1/L2 audit doc on this branch |

### 1.3 Branch-only (other branches) docs that are NOT on `chore/v12-71-pillar-p0-remediation-2026-06-20`

The following docs were added on sibling branches but **NOT merged into the current branch** (`git merge-base --is-ancestor` returns false). They are therefore "branch-only / docs-only" per the audit rules.

| ID | File (branch-only path) | Source branch | Commit | Status on current branch |
|----|-------------------------|---------------|--------|--------------------------|
| D-50 | `pheno-errors/llms.txt` | `chore/m3-status-update-2026-06-20` | `10855a45bd` | **branch-only / docs-only** — file does not exist on current branch |
| D-51 | `pheno-errors/examples/otel_quickstart.rs` | `chore/m3-status-update-2026-06-20` | `5a31a8f780` | **branch-only** — file does not exist on current branch |
| D-52 | `pheno-errors/llvm-cov.toml` | `chore/m3-status-update-2026-06-20` | `5a31a8f780` | **branch-only** — file does not exist on current branch |
| D-53 | `pheno-errors/scripts/coverage.sh` | `chore/m3-status-update-2026-06-20` | `5a31a8f780` | **branch-only** — file does not exist on current branch |
| D-54 | `pheno-errors/examples/quickstart.rs` | `cce9873a82` (batched into `78f2c908b4`) | `78f2c908b4` | **attempted but removed** — file was added in commit history but deleted in `c583faf8c7`; uses an OLD API shape (`AppError::Validation { field, message }`) that doesn't match current code |
| D-55 | `pheno-errors/tests/smoke.rs` | same | same | **attempted but removed** — file was added then deleted |
| D-56 | `pheno-errors/tests/tracing_test.rs` | same | same | **attempted but removed** — uses `#![cfg(feature = "tracing")]` (no such feature) and the OLD `AppError::Validation { field, message }` shape |
| D-57 | `pheno-errors/archive/PhenoLang-errors-2026-06-20/...` | `chore/preserve-phenolang-errors-2026-06-20` | `212260ffa9` | **branch-only** — entire archive dir (ORIGIN.md + 9 archived files: phenotype-error-core, phenotype-error-macros, phenotype-errors) is on a different branch |

### 1.4 Source-code TODOs / placeholders / markers

Searched `pheno-errors/src/lib.rs:1-379` for `todo!`, `unimplemented!`, `panic!`, `FIXME`, `XXX`, `HACK`, `TODO`, `unsafe`, `#[allow(...)]` — **zero matches**.

No `unsafe { ... }` blocks, no `todo!()` / `unimplemented!()` / `panic!()` placeholders, no `#[allow(...)]` suppressions, no FIXME/XXX/HACK comments.

The only behavioral marker is the explicit comment block at `src/lib.rs:25-29` explaining why no blanket `From<E: Error>` impl is provided (Rust coherence vs concrete `From<std::io::Error>`).

---

## 2. Source code feature matrix

Every public API item in `pheno-errors/src/lib.rs` with signature, test coverage, doc-comment status.

### 2.1 Module-level items

| Item | Kind | Visibility | Location | Doc comment | Tests |
|------|------|-----------|----------|-------------|-------|
| `AppError` | enum | `pub` | `src/lib.rs:64-102` | yes (module `//!` + 5 per-variant `///`) | 9 tests + 1 proptest (`src/lib.rs:244-356`) |
| `AppResult<T>` | type alias | `pub` | `src/lib.rs:106` | yes (`///` 1-line) | 1 test (`src/lib.rs:330-335`) |

### 2.2 `AppError` variants (5)

| Variant | Shape | Doc | `Display` format | Tests |
|---------|-------|-----|-------------------|-------|
| `Domain(String)` | tuple | yes (`src/lib.rs:65-71`) | `"domain error: {0}"` (`src/lib.rs:71`) | `kind_returns_correct_tag` (`244`), `display_formats_variants` (`253-257`), `from_str_creates_domain` (`277-281`), `from_string_creates_domain` (`284-287`), `from_anyhow_creates_domain` (`297-301`), `from_anyhow_preserves_cause_chain` (`304-315`), `log_warn_preserves_error` (`318-321`), `proptest_domain_kind` (`340-356`) |
| `NotFound { entity: String, id: String }` | struct | yes (`src/lib.rs:74-78`) | `"not found: {entity} {id}"` (`src/lib.rs:78`) | `kind_returns_correct_tag`, `display_formats_variants` (`258-262`), `proptest_not_found_kind` (`362-378`) |
| `Conflict(String)` | tuple | yes (`src/lib.rs:81-86`) | `"conflict: {0}"` (`src/lib.rs:86`) | `kind_returns_correct_tag`, `display_formats_variants` (`263-265`) |
| `Validation(String)` | tuple | yes (`src/lib.rs:89-94`) | `"validation error: {0}"` (`src/lib.rs:93`) | `kind_returns_correct_tag`, `display_formats_variants` (`266-269`) |
| `Storage(String)` | tuple | yes (`src/lib.rs:96-101`) | `"storage error: {0}"` (`src/lib.rs:100`) | `kind_returns_correct_tag`, `display_formats_variants` (`270-273`), `from_io_error_creates_storage` (`290-294`), `log_error_preserves_error` (`324-327`) |

Note: 5-variant design is intentionally closed — no `#[non_exhaustive]` attribute (per `src/lib.rs:38-41` comment block). Variant count growth is treated as a breaking change requiring a new type.

### 2.3 `impl AppError` block — public methods (8)

| Method | Signature | Location | Doc | Returns self? | Test |
|--------|-----------|----------|-----|---------------|------|
| `kind` | `pub fn kind(&self) -> &'static str` | `src/lib.rs:113-121` | yes | no | `kind_returns_correct_tag` (`244-250`) |
| `domain` | `pub fn domain(msg: impl Into<String>) -> Self` | `src/lib.rs:126-128` | yes | no (constructor) | `kind_returns_correct_tag` + `proptest_domain_kind` + `from_str_creates_domain` + `from_string_creates_domain` + `from_anyhow_creates_domain` + `from_anyhow_preserves_cause_chain` + `log_warn_preserves_error` (indirectly) |
| `not_found` | `pub fn not_found(entity: impl Into<String>, id: impl Into<String>) -> Self` | `src/lib.rs:131-136` | yes | no (constructor) | `kind_returns_correct_tag` + `display_formats_variants` + `proptest_not_found_kind` |
| `conflict` | `pub fn conflict(msg: impl Into<String>) -> Self` | `src/lib.rs:139-141` | yes | no (constructor) | `kind_returns_correct_tag` + `display_formats_variants` |
| `validation` | `pub fn validation(msg: impl Into<String>) -> Self` | `src/lib.rs:144-146` | yes | no (constructor) | `kind_returns_correct_tag` + `display_formats_variants` |
| `storage` | `pub fn storage(msg: impl Into<String>) -> Self` | `src/lib.rs:149-151` | yes | no (constructor) | `kind_returns_correct_tag` + `display_formats_variants` + `from_io_error_creates_storage` + `log_error_preserves_error` |
| `log_warn` | `pub fn log_warn(self) -> Self` | `src/lib.rs:159-166` | yes | yes | `log_warn_preserves_error` (`318-321`) |
| `log_error` | `pub fn log_error(self) -> Self` | `src/lib.rs:172-179` | yes | yes | `log_error_preserves_error` (`324-327`) |

**Note:** `log_warn` and `log_error` only verify the error is preserved; they do NOT verify a log line is actually emitted. Tests don't use `tracing-test`'s `traced_test` macro (which is available in dev-deps at `Cargo.toml:19`). Could be enriched but is not strictly required for the contract.

### 2.4 `From` impls (4)

| From impl | Maps to | Location | Doc | Test |
|-----------|---------|----------|-----|------|
| `From<std::io::Error>` | `AppError::Storage(e.to_string())` | `src/lib.rs:190-194` | yes | `from_io_error_creates_storage` (`290-294`) |
| `From<&'static str>` | `AppError::Domain(msg.to_owned())` | `src/lib.rs:199-203` | yes | `from_str_creates_domain` (`277-281`) |
| `From<String>` | `AppError::Domain(msg)` | `src/lib.rs:206-210` | yes | `from_string_creates_domain` (`284-287`) |
| `From<anyhow::Error>` | `AppError::Domain(<walked chain>)` | `src/lib.rs:223-235` | yes | `from_anyhow_creates_domain` (`297-301`) + `from_anyhow_preserves_cause_chain` (`304-315`) |

**`From<anyhow::Error>` walks the cause chain** (`src/lib.rs:227-232`) to preserve context, with explicit comment that `anyhow::Error::Display` only renders outermost context otherwise. This is implemented-and-tested behaviour.

### 2.5 Total public API items

- 1 enum (`AppError`) with 5 variants = **6 pub items** at enum level
- 1 type alias (`AppResult<T>`)
- 8 pub methods in `impl AppError`
- 4 `From` impls
- **Total: 19 pub items** (counted with grep `pub fn|pub enum|pub type|impl From` at `src/lib.rs:64-235`)

### 2.6 Modules / files

The crate is a **single-file library** (`src/lib.rs`, 379 lines). No sub-modules, no `mod.rs` tree, no `pub mod` re-exports.

### 2.7 Unused / dead code

None observed. No `#[allow(dead_code)]`, no `#[cfg(...)]`-gated unused items, no dead code markers.

### 2.8 Unsafe code

None. `grep -E "unsafe|#\[allow" src/lib.rs` returns zero matches in the source.

---

## 3. Test coverage analysis

### 3.1 Test inventory

| # | Test name | Location | Type | Asserts |
|---|-----------|----------|------|---------|
| 1 | `kind_returns_correct_tag` | `src/lib.rs:243-250` | unit | each of 5 variants returns correct `kind()` string |
| 2 | `display_formats_variants` | `src/lib.rs:252-274` | unit | exact `Display` string for each of 5 variants |
| 3 | `from_str_creates_domain` | `src/lib.rs:276-281` | unit | `&'static str` → `Domain(_)` |
| 4 | `from_string_creates_domain` | `src/lib.rs:283-287` | unit | `String` → `Domain(_)` |
| 5 | `from_io_error_creates_storage` | `src/lib.rs:289-294` | unit | `io::Error` → `Storage(_)` |
| 6 | `from_anyhow_creates_domain` | `src/lib.rs:296-301` | unit | `anyhow::Error` → `Domain(_)` |
| 7 | `from_anyhow_preserves_cause_chain` | `src/lib.rs:303-315` | unit | chain `context()` x3 → rendered `Display` contains root/middle/inner |
| 8 | `log_warn_preserves_error` | `src/lib.rs:317-321` | unit | `Domain("ephemeral").log_warn().kind() == "domain"` |
| 9 | `log_error_preserves_error` | `src/lib.rs:323-327` | unit | `Storage("ephemeral").log_error().kind() == "storage"` |
| 10 | `appresult_alias_works` | `src/lib.rs:329-335` | unit | `AppResult<T>` alias round-trip |
| 11 | `proptest_domain_kind` | `src/lib.rs:339-356` | property | for any non-empty `String msg`: `domain(msg).kind() == "domain"` and `display.contains(msg)` (100 cases, default) |
| 12 | `proptest_not_found_kind` | `src/lib.rs:360-378` | property | for any non-empty `entity`/`id`: `not_found(entity, id).kind() == "not_found"` and display contains both (100 cases) |

**Total: 12 test functions** (10 unit + 2 property).

### 3.2 Doctests

| Doctest | Location | Status |
|---------|----------|--------|
| `lookup_user` example on `AppError` enum doc | `src/lib.rs:45-62` | **valid** — uses only APIs that exist (`AppError::validation`, `AppError::not_found`, `.kind()`); will compile and pass at `cargo test --doc` time. |

No other doctests exist (only 1 `//!` block + 95 `///` lines).

### 3.3 Coverage gap analysis

| Code path | Test coverage | Notes |
|-----------|---------------|-------|
| 5 variants construction (Domain, NotFound, Conflict, Validation, Storage) | covered via constructors | All 5 constructors exercised |
| `kind()` for all 5 variants | ✅ covered | `kind_returns_correct_tag` |
| `Display` for all 5 variants | ✅ covered | `display_formats_variants` |
| `From<std::io::Error>` | ✅ covered | `from_io_error_creates_storage` |
| `From<&'static str>` | ✅ covered | `from_str_creates_domain` |
| `From<String>` | ✅ covered | `from_string_creates_domain` |
| `From<anyhow::Error>` base case | ✅ covered | `from_anyhow_creates_domain` |
| `From<anyhow::Error>` cause chain | ✅ covered | `from_anyhow_preserves_cause_chain` |
| `log_warn` returns self | partial | `log_warn_preserves_error` only checks identity, NOT that `tracing::warn!` was emitted. Could use `traced_test` (dev-dep `tracing-test` is in `Cargo.toml:19`). |
| `log_error` returns self | partial | same gap as `log_warn` |
| Property: kind invariant for `domain` | ✅ covered | `proptest_domain_kind` (100 cases) |
| Property: kind invariant for `not_found` | ✅ covered | `proptest_not_found_kind` (100 cases) |

**Estimated line coverage:** ~95%+ of `src/lib.rs` is exercised. The only weakly-covered surface is the body of `log_warn` / `log_error` — `tracing::warn!` / `tracing::error!` invocations are not asserted.

### 3.4 CI coverage gate

`ci.yml:62-82` runs `cargo llvm-cov --all-features --lcov --output-path lcov.info` and uploads to codecov with `fail_ci_if_error: false`. **No 80% threshold enforced** (the local `.codecov.yml` / `llvm-cov.toml` from the branch-only commit `5a31a8f780` is not on this branch).

---

## 4. Examples analysis

### 4.1 Examples on current branch

**Zero.** `find /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-errors -type d -name examples` returns no result. AGENTS.md at line 37 says `cargo test --features snapshot` which implies examples should exist; they don't on this branch.

### 4.2 Examples on sibling branches (branch-only)

| Example | Source branch | Commit | Status |
|---------|---------------|--------|--------|
| `pheno-errors/examples/otel_quickstart.rs` | `chore/m3-status-update-2026-06-20` | `5a31a8f780` | **branch-only / would-not-compile** — references `pheno_errors::ErrorContext` (does not exist), `pheno_otel::trace::span` (does not exist — pheno-otel has no `trace` module), `AppError::from(e).with_context(...)` (`from()` exists only for `io::Error`/`&'static str`/`String`/`anyhow::Error`; no `with_context` method), `ExporterConfig::default()` (no `Default` impl, only `ExporterConfig::new()`) |
| `pheno-errors/examples/quickstart.rs` | `cce9873a82` (batched into `78f2c908b4`) | `78f2c908b4` | **branch-only / would-not-compile with current API** — uses `AppError::Validation { field: String, message: String }` (struct variant), but current code has `AppError::Validation(String)` (tuple variant). API mismatch. |

**Conclusion:** All existing examples that survived the historical churn reference APIs that don't match the current source. The current branch has no examples at all.

---

## 5. CI / workflow analysis

### 5.1 Workflow inventory

| Workflow | File | Triggers | Jobs | Notes |
|----------|------|----------|------|-------|
| `CI` | `.github/workflows/ci.yml` (82 lines) | push main/master, PR, manual | 4: `test`, `clippy`, `fmt`, `coverage` | Uses pinned SHAs (`actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683`, `dtolnay/rust-toolchain@4b32c170c36f565c8591d2c5e6c1e02cf26d5e6c`, `taiki-e/install-action@25435dc8dd3baed7417e0c96d3fe89013a5b2e09`, `codecov/codecov-action@0565863a31f2c772f9f3b7eecb0d484b0d1e54c4`). Concurrency group cancels in-progress runs. |
| `Cargo Audit` | `.github/workflows/cargo-audit.yml` (26 lines) | push on Cargo.toml/Cargo.lock changes, weekly Wed, manual | 1: `audit` | Uses `rustsec/audit-check@69366f33c96575abad1ee0dba8212993eecbe998` (floating ref, not SHA-pinned). |
| `cargo-deny` | `.github/workflows/cargo-deny.yml` (32 lines) | PR/push on Cargo.toml/Cargo.lock changes, weekly Mon, manual | 1: `cargo-deny` | Uses `EmbarkStudios/cargo-deny-action@91bf2b620e09e18d6eb78b92e7861937469acedb` (SHA-pinned). |
| `CodeQL (Rust)` | `.github/workflows/codeql-rust.yml` (33 lines) | push/PR main, weekly Tue, manual | 1: `analyze` | Uses `github/codeql-action/{init,autobuild,analyze}@b25d0ebf40e5b63ee81e1bd6d2a12b7c2aeb61` (SHA-pinned). |
| `Governance` | `.github/workflows/governance.yml` (60 lines) | push main/master, PR, weekly Mon | 2: `required-files`, `branch-policy` | Required-files job checks 6 files: SECURITY.md, dependabot.yml, scorecard.yml, .editorconfig, cliff.toml, .github/CODEOWNERS. Only CODEOWNERS exists. Workflow uses `::warning` (not `::error`) so it does NOT block CI. |

### 5.2 Required-files gate status

| Required file | Exists? | Source of truth |
|---------------|---------|-----------------|
| `SECURITY.md` | ❌ | — |
| `.github/dependabot.yml` | ❌ | — |
| `.github/workflows/scorecard.yml` | ❌ | — |
| `.editorconfig` | ❌ | — |
| `cliff.toml` | ❌ | — |
| `.github/CODEOWNERS` | ✅ | `.github/CODEOWNERS:1-5` |

**Result:** 5 of 6 governance files missing. Workflow currently emits warnings only (would have to be edited to `::error` to fail CI). See Bug #5.

### 5.3 Branch policy gate

`governance.yml:52-58` requires the default branch be `main` or `master`. Uses `gh repo view --json defaultBranchRef`. The monorepo's default branch (per `git remote show origin`) is `main`. ✅ passes.

### 5.4 CI invariants

- All workflows use `ubuntu-latest`.
- All actions are SHA-pinned (except `rustsec/audit-check` at `cargo-audit.yml:24`).
- All workflows have `timeout-minutes` set (15-360 min).
- `ci.yml` uses `concurrency` to cancel in-progress runs.

---

## 6. Code quality observations

### 6.1 Claimed-vs-actual mismatches

| # | Claim | Source | Reality | Severity |
|---|-------|--------|---------|----------|
| C-1 | API surface: `Error`, `ErrorKind`, `Error::new`, `with_source`, `with_context`, `with_hint` | `AGENTS.md:60-69` | None of these exist. Actual API is `AppError`, `AppResult<T>`, `AppError::domain/...` constructors, no builder methods. | HIGH |
| C-2 | "10 ErrorKind categories: Io, Parse, Config, Auth, Network, Timeout, NotFound, Conflict, Internal, External" | `AGENTS.md:81-93` | Only 5 variants exist: Domain, NotFound, Conflict, Validation, Storage. No Io/Parse/Config/Auth/Network/Timeout/Internal/External. | HIGH |
| C-3 | "tracing::error!() on every Error::new()" | `AGENTS.md:52` | No `Error::new()` exists. No unconditional tracing emission. Only `log_warn`/`log_error` opt-in helpers. | HIGH |
| C-4 | "Backtrace: std::backtrace (Rust 1.65+)" | `AGENTS.md:22` | No backtrace handling. No `#[backtrace]` field. | MEDIUM |
| C-5 | "Async: tokio (for From<tokio::io::Error> conversions)" | `AGENTS.md:23` | No `tokio` dep. No `From<tokio::io::Error>` impl. | MEDIUM |
| C-6 | "Test framework: cargo test + insta snapshots" | `AGENTS.md:16` | No `insta` dep. Zero snapshot tests. | MEDIUM |
| C-7 | "just coverage — uses cargo-tarpaulin, gates at 80%" | `AGENTS.md:44` | No `coverage` recipe in `justfile`. `cargo machete` is defined as `unused`. | MEDIUM |
| C-8 | "cargo test --features otlp-export   # OTLP wire test (requires collector)" | `AGENTS.md:36` | No `otlp-export` feature in `Cargo.toml`. | MEDIUM |
| C-9 | "cargo test --features snapshot" | `AGENTS.md:37` | No `snapshot` feature. | LOW |
| C-10 | "OTel export: pheno-otel — error events emitted as OTLP log records" | `AGENTS.md:24` | pheno-otel declared as dep but never imported in source. | HIGH |
| C-11 | "v12 T1 (L46 OTLP wire) — pheno-otel integration landed" | `AGENTS.md:96` | Not landed at source level. Path dep present, but no use statements. | HIGH |
| C-12 | "`pheno-errors` uses `pheno-otel` to surface structured error context to OTLP/HTTP collectors" | `Cargo.toml:13-16` | No such usage in src/lib.rs. | HIGH |
| C-13 | "Coverage gate ≥ 80% (lib threshold per ADR-040)" | `AGENTS.md:53` | `ci.yml` uses `fail_ci_if_error: false` for codecov upload; no 80% threshold enforced. | MEDIUM |

### 6.2 Design observations (no bugs, just notes)

- **Closed enum design (`src/lib.rs:38-41`)** is intentional — variant growth is treated as breaking-change requiring new type. This is documented in the module-level docstring.
- **`From<anyhow::Error>` walks the cause chain** (`src/lib.rs:227-232`) instead of relying on `Display`, with explicit comment explaining why. Well-designed.
- **All 5 variants are documented with multi-line `///`** explaining when to use each. Excellent UX for consumers.
- **No `#[non_exhaustive]`** is deliberate — comment at `src/lib.rs:38-41` explains the reasoning (match exhaustiveness checks useful at call sites).
- **PhenoLang archive at `pheno-errors/archive/PhenoLang-errors-2026-06-20/`** exists on branch `chore/preserve-phenolang-errors-2026-06-20` (commit `212260ffa9`) — preserves `phenotype-error-core`, `phenotype-error-macros`, `phenotype-errors` from `KooshaPari/PhenoLang`. This is a docs-only artifact, not part of current `pheno-errors` buildable surface.

### 6.3 Potential bugs / smells

- **Unused path dependency** (`Cargo.toml:16`): `pheno-otel` is declared but never used. `cargo` will warn at compile time if `pheno-otel` doesn't compile, but `pheno-errors` doesn't fail. Increases build-graph surface area without benefit.
- **`log_warn` / `log_error` consume self** (`src/lib.rs:159-179`): both take `self` by value. This is convenient for fluent pipelines but means callers can't log AND inspect after — they must clone if they want both. (Design choice, not a bug.)
- **No `Send + Sync` bounds** on `AppError` — since variants hold only `String` / struct-of-strings, this is implicitly `Send + Sync`. Worth verifying if used in async contexts. (Not a bug, but not asserted.)
- **`From<anyhow::Error>` always maps to `Domain`** (`src/lib.rs:223-235`) regardless of inner error type. A `From<std::io::Error>` upstream of an `anyhow::Error` would lose the `Storage` classification. Documented in comment, but worth noting.
- **No `std::error::Error::source()` chain** for any variant — `From<anyhow::Error>` collapses the chain into a single `Domain` message string. Loses the original `Error::source()` navigation. The cause-chain walk writes to the message but not as a `source()` chain.
- **`From<String>` and `From<&'static str>` both produce `Domain`** (`src/lib.rs:199-210`) — these can clash with intentional `From<std::io::Error> for Storage` because of Rust's blanket-impl restrictions. Documented, but tight.

---

## 7. Bug tally

| # | Location | Severity | Status | Description |
|---|----------|----------|--------|-------------|
| 1 | `pheno-errors/AGENTS.md:60-69` | HIGH | open | Quickstart code sample uses invented API (`Error`, `ErrorKind`, `Error::new`, `with_source`, `with_context`, `with_hint`) — none exist. If a new contributor copies this example, it will fail to compile. |
| 2 | `pheno-errors/AGENTS.md:81-93` | HIGH | open | Error Kind Categories table lists 10 variants; only 5 exist. Will mislead API consumers into looking for non-existent methods. |
| 3 | `pheno-errors/AGENTS.md:24,52,96` + `pheno-errors/Cargo.toml:13-16` | HIGH | open | Repeatedly claims `pheno-otel` integration; `src/lib.rs` has zero references to `pheno_otel::*`. OTLP wire integration is not landed despite T1 commit (`fc7cc54529`). |
| 4 | `pheno-errors/AGENTS.md:52` | HIGH | open | Claim "tracing::error!() on every Error::new()" — no `Error::new()` exists, no unconditional emission. |
| 5 | `pheno-errors/.github/workflows/governance.yml:36-44` | MEDIUM | open | Required-files check emits `::warning` only; 5 of 6 governance files missing (SECURITY.md, dependabot.yml, scorecard.yml, .editorconfig, cliff.toml). Workflow is not enforced. |
| 6 | `pheno-errors/AGENTS.md:22-23` | MEDIUM | open | Lists `std::backtrace` and `tokio` as runtime features; neither is a dependency. |
| 7 | `pheno-errors/AGENTS.md:16` | MEDIUM | open | Claims `insta` snapshot tests; no `insta` dep, no snapshot tests. |
| 8 | `pheno-errors/AGENTS.md:44` | MEDIUM | open | `just coverage` recipe claimed (cargo-tarpaulin, 80% gate); `justfile` has no `coverage` recipe, defines `unused: cargo machete` instead. |
| 9 | `pheno-errors/AGENTS.md:36-37` | MEDIUM | open | `cargo test --features otlp-export` and `--features snapshot` — neither feature exists in `Cargo.toml`. |
| 10 | `pheno-errors/Cargo.toml:16` | MEDIUM | open | `pheno-otel` declared as path dep but unused — bloats dependency graph; may pull in pheno-otel's transitive deps (`thiserror`, `serde`, `serde_json`) without value. |
| 11 | `pheno-errors/AGENTS.md:53` | MEDIUM | open | "Coverage gate ≥ 80%" — `ci.yml:81` uses `fail_ci_if_error: false` for codecov upload; no threshold enforced. |
| 12 | `pheno-errors/src/lib.rs:227-235` | LOW | open | `From<anyhow::Error>` collapses chain into single `Domain` message; `Error::source()` not preserved as navigable chain. Documented limitation but consumers may assume cause-chain navigation. |
| 13 | `pheno-errors/src/lib.rs:159-179` | LOW | open | `log_warn` / `log_error` not asserted in tests — only identity check. `tracing-test` dev-dep available but unused. |
| 14 | `pheno-errors/.github/workflows/cargo-audit.yml:24` | LOW | open | `rustsec/audit-check@69366f33c96575abad1ee0dba8212993eecbe998` is not SHA-pinned (only SHA, not commit; tag-style ref). Other workflows use pinned SHAs; consistency gap. |
| 15 | Branch-only `examples/otel_quickstart.rs` (commit `5a31a8f780`) | INFO | historical | References `pheno_errors::ErrorContext`, `pheno_otel::trace::span`, `AppError::from(e).with_context(...)` — none exist. Would not compile if resurrected. |
| 16 | Branch-only `examples/quickstart.rs` (commit `78f2c908b4`) | INFO | historical | Uses `AppError::Validation { field, message }` (struct) but current code has `AppError::Validation(String)` (tuple). API drift between branches. |
| 17 | Branch-only `tests/tracing_test.rs` (commit `78f2c908b4`) | INFO | historical | Uses `#![cfg(feature = "tracing")]` (no such feature) and old API shape. |
| 18 | `pheno-errors/src/lib.rs:31-34` | INFO | open | Doc references "V3_EXECUTION_LOG_2026_06_10.md / 'L3 #46'" — file does not exist in this branch's sub-tree. |
| 19 | `pheno-errors/.github/workflows/governance.yml:36-44` | INFO | open | Scorecard workflow (`.github/workflows/scorecard.yml`) referenced as required but does not exist on this branch. |

---

## 8. Appendix tables

### 8.1 File inventory on `chore/v12-71-pillar-p0-remediation-2026-06-20`

| File | Lines | Tracked? | Last modified commit |
|------|-------|----------|----------------------|
| `.github/CODEOWNERS` | 5 | yes | `aec7282070` |
| `.github/workflows/cargo-audit.yml` | 26 | yes | `aec7282070` |
| `.github/workflows/cargo-deny.yml` | 32 | yes | `aec7282070` |
| `.github/workflows/ci.yml` | 82 | yes | `aec7282070` |
| `.github/workflows/codeql-rust.yml` | 33 | yes | `aec7282070` |
| `.github/workflows/governance.yml` | 60 | yes | `aec7282070` |
| `AGENTS.md` | 111 | yes | `ca5ea5bfb4` |
| `Cargo.toml` | 20 | yes | `fc7cc54529` |
| `deny.toml` | 46 | yes | `aec7282070` |
| `justfile` | 42 | yes | `aec7282070` |
| `src/lib.rs` | 379 | yes | `7790368622` |
| **TOTAL** | **836** | | |

### 8.2 Files present on sibling branches but NOT on current branch

| File | Branch | Commit | Notes |
|------|--------|--------|-------|
| `llms.txt` | `chore/m3-status-update-2026-06-20` | `10855a45bd` | References APIs that don't exist (`OtlpError`, `serde_json::Error`, `reqwest::Error` `#[from]` impls) |
| `examples/otel_quickstart.rs` | `chore/m3-status-update-2026-06-20` | `5a31a8f780` | References `ErrorContext`, `trace::span/emit` (none exist) |
| `llvm-cov.toml` | `chore/m3-status-update-2026-06-20` | `5a31a8f780` | 80% threshold config |
| `scripts/coverage.sh` | `chore/m3-status-update-2026-06-20` | `5a31a8f780` | cargo-llvm-cov driver |
| `examples/quickstart.rs` | `78f2c908b4` → `c583faf8c7` deleted | `78f2c908b4` | Old API shape |
| `tests/smoke.rs` | `78f2c908b4` → `c583faf8c7` deleted | `78f2c908b4` | Old API shape (mostly compatible) |
| `tests/tracing_test.rs` | `78f2c908b4` → `c583faf8c7` deleted | `78f2c908b4` | Uses non-existent `tracing` feature |
| `archive/PhenoLang-errors-2026-06-20/...` | `chore/preserve-phenolang-errors-2026-06-20` | `212260ffa9` | 9 archived files: `phenotype-error-core/`, `phenotype-error-macros/`, `phenotype-errors/` (all from `KooshaPari/PhenoLang`) |

### 8.3 Dependency manifest (`Cargo.toml`)

```toml
[package]
name = "pheno-errors"
version = "0.1.0"
edition = "2021"
license = "MIT"
repository = "https://github.com/KooshaPari/pheno-errors"
description = "Canonical AppError type for the pheno-* fleet. Consolidates the 5 most-common error patterns into a single, dependency-light crate."

[dependencies]
anyhow = "1"
thiserror = "2"
tracing = "0.1"
pheno-otel = { path = "../pheno-otel" }     # DECLARED BUT UNUSED

[dev-dependencies]
proptest = "1"
tracing-test = "0.2"                          # DECLARED BUT UNUSED
```

No features defined. No `[lib]` overrides. No `[workspace]` table. No MSRV specified.

### 8.4 Verification checklist

- [x] All 11 tracked files inspected
- [x] All `src/**/*.rs` inspected (1 file: `src/lib.rs`)
- [x] All in-source tests inspected (`#[cfg(test)] mod tests` at `src/lib.rs:239-378`, 12 tests)
- [x] All `tests/*.rs` inspected (none on current branch; branch-only examples inspected for drift)
- [x] All `examples/*.rs` inspected (none on current branch)
- [x] All `Cargo.toml` / `deny.toml` / `justfile` inspected
- [x] All `.github/workflows/*.yml` inspected (5 workflows)
- [x] Git history searched for deleted files (`git log --all --diff-filter=D`)
- [x] Git history searched for files on sibling branches (`git merge-base --is-ancestor`)
- [x] Cross-referenced monorepo ADRs (`findings/`, `docs/adr/`, `plans/`)
- [x] Searched for `todo!` / `unimplemented!` / `panic!` / `FIXME` / `XXX` / `HACK` / `TODO` — zero matches
- [x] Searched for `unsafe { ... }` and `#[allow(...)]` — zero matches
- [x] Public items counted: **19** (1 enum + 5 variants + 1 type alias + 8 methods + 4 From impls)
- [x] Test functions counted: **12** (10 unit + 2 property)
- [x] Public items missing doc comments: **0**
- [x] `git remote -v` consulted: origin points to `KooshaPari/argis-extensions`, not standalone `pheno-errors`

### 8.5 Key cross-references

- `findings/2026-06-19-dup-matrix.md` rows 1, 7: pheno-errors absorbed 2 duplication targets
- `findings/2026-06-20-71-pillar-cycle-2-probe.md` L38: AGENTS.md gate (1/3 → 3/3, +0.8 mean)
- `findings/2026-06-20-side-02-hexagonal-fleet-audit.md`: pheno-errors is concrete (no Port/Adapter)
- `findings/2026-06-20-side-11-cargo-workspace-dup-audit.md`: pheno-errors has no [workspace] table (clean)
- `findings/2026-06-20-v12-cargo-audit-baseline.md`: pheno-errors passes cargo-audit baseline
- `plans/2026-06-20-v13-71-pillar-cycle-2-p0.md` T2: future `devshell.nix` for pheno-errors
- Monorepo ADRs in `docs/adr/2026-06-15/`: ADR-012 (pheno-tracing), ADR-018 (PRCP), ADR-037 (pheno-otel); in `docs/adr/2026-06-18/`: ADR-036B, ADR-037, ADR-040 (test coverage gates), ADR-042 (substrate quality bar)

---

**Audit summary:**

- **Public API items:** 19 (1 enum + 5 variants + 1 type alias + 8 methods + 4 From impls)
- **Test functions:** 12 (10 unit + 2 property + 1 doctest)
- **Public items with doc comments:** 19/19 (100%)
- **Source lines (lib.rs):** 379
- **Doc comments in source:** 95 `///` lines + module `//!` blocks
- **Public items without tests:** 0 (all 19 items have at least one test exercising them)
- **Bug count by severity:** HIGH 4, MEDIUM 7, LOW 3, INFO 5 — **total 19 bugs**