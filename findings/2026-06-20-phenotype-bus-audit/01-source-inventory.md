# phenotype-bus — Phase 1A: Source Inventory

**Date:** 2026-06-20
**Author:** Forge (orch-w11-a Phase 1A)
**Repo:** `KooshaPari/phenotype-bus`
**Local path:** `/Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-bus`
**HEAD:** `073e1258c057a43aeeadfd69e6c0a831e239194a`
**HEAD branch:** `chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18`
**Bucket (per ADR-023):** PAUSED (deprecated 2026-06-18, scheduled archive 2026-06-25, source delete 2026-09-23)
**Substrate role (per ADR-035B):** federated service (event bus substrate); content lifted to `KooshaPari/phenoEvents` PR #9

---

## 0. Quick summary table

| # | Field | Value | Source / citation |
|---|---|---|---|
| 1 | Crate name | `phenotype-bus` | `Cargo.toml:6` |
| 2 | Crate version | `0.1.0` | `Cargo.toml:7` |
| 3 | Rust edition | `2021` | `Cargo.toml:8` |
| 4 | License | `Apache-2.0` | `Cargo.toml:9`; `LICENSE` (11,144 bytes) |
| 5 | Authors | `Koosha Pari <kooshapari@gmail.com>` | `Cargo.toml:10` |
| 6 | Description | `Generic pub/sub event bus for cross-collection communication in Phenotype` | `Cargo.toml:11` |
| 7 | Repository URL | `https://github.com/KooshaPari/phenotype-bus` | `Cargo.toml:12` |
| 8 | MSRV (`rust-version` in `[workspace.package]`) | `1.75` | `Cargo.toml:3` |
| 9 | MSRV (`clippy.toml msrv`) | `1.85` | `clippy.toml:1` |
| 10 | Rust toolchain (rust-toolchain.toml) | `stable` + rustfmt+clippy, targets aarch64-apple-darwin + x86_64-unknown-linux-gnu | `rust-toolchain.toml:1-4` |
| 11 | `[lib]` name | `phenotype_bus` | `Cargo.toml:28` |
| 12 | `[lib]` path | `src/lib.rs` | `Cargo.toml:29` |
| 13 | `[[bin]]` entries | **0** (no binaries) | `Cargo.toml` (no `[bin]` section) |
| 14 | `[features]` | **NONE** (no feature flags) | `Cargo.toml` (no `[features]` section) |
| 15 | `[dependencies]` count | **8** unique direct deps | `Cargo.toml:14-22` |
| 16 | `[dev-dependencies]` count | **1** (`tokio` with `full` features) | `Cargo.toml:24-25` |
| 17 | Direct deps list | `tokio 1.39`, `serde 1.0`, `thiserror 2.0`, `tracing 0.1`, `tracing-subscriber 0.3`, `async-trait 0.1`, `uuid 1.10`, `chrono 0.4` | `Cargo.toml:14-22` |
| 18 | Resolved versions (cargo tree depth 1) | `tokio 1.52.3`, `serde 1.0.228`, `thiserror 2.0.18`, `tracing 0.1.44`, `tracing-subscriber 0.3.23`, `uuid 1.23.3`, `chrono 0.4.45`, `async-trait 0.1.89` | `cargo tree --depth 1` |
| 19 | Cargo.lock lines | 967 | `wc -l Cargo.lock` |
| 20 | Cargo.lock size (bytes) | 24,615 | `ls -l Cargo.lock` |
| 21 | Cargo.toml lines | 34 | `wc -l Cargo.toml` |
| 22 | Cargo.toml size (bytes) | 905 | `ls -l Cargo.toml` |
| 23 | Total source LoC (`src/**/*.rs`) | **978** | `find src -name "*.rs" -exec cat {} + | wc -l` |
| 24 | `src/*.rs` LoC (top-level) | 482 | `wc -l src/*.rs` (lib.rs + config.rs + observability.rs) |
| 25 | `src/events/*.rs` LoC | 496 | `wc -l src/events/*.rs` (bus.rs + mod.rs + subscription.rs) |
| 26 | `src/lib.rs` LoC | 249 | `wc -l src/lib.rs` |
| 27 | `src/events/bus.rs` LoC | 321 | `wc -l src/events/bus.rs` |
| 28 | `src/events/mod.rs` LoC | 93 | `wc -l src/events/mod.rs` |
| 29 | `src/events/subscription.rs` LoC | 82 | `wc -l src/events/subscription.rs` |
| 30 | `src/config.rs` LoC | 195 | `wc -l src/config.rs` |
| 31 | `src/observability.rs` LoC | 38 | `wc -l src/observability.rs` |
| 32 | Test LoC (`tests/*.rs`) | **16** (2 trivial smoke tests) | `find tests -name "*.rs" -exec cat {} + | wc -l` |
| 33 | In-source `#[cfg(test)]` modules | 4 (lib.rs, events/subscription.rs, events/bus.rs[impl_event! macro only], config.rs) | section 9 below |
| 34 | Public items (`pub` declarations) | **24** unique | `grep -rE "^pub (fn\|struct\|enum\|trait\|macro_rules\|mod)" src/` |
| 35 | Examples LoC | **0** (no `examples/` dir) | `ls examples/` → not found |
| 36 | Benches LoC | **0** (no `benches/` dir) | `ls benches/` → not found |
| 37 | Doc LoC (`docs/*.md` only) | 525 | sum of `docs/*.md` files (15 + 123 + 125 + 6 + 121 + 73 + 46 + 1) |
| 38 | `README.md` LoC | 60 | `wc -l README.md` |
| 39 | `CHANGELOG.md` LoC | 76 | `wc -l CHANGELOG.md` |
| 40 | `STALE_BRANCHES.md` LoC | 165 | `wc -l STALE_BRANCHES.md` |
| 41 | Submodules (gitlink entries) | **0** | `git submodule status` (empty output) |
| 42 | Total commits reachable from HEAD log | 84 | `git log --oneline | wc -l` |
| 43 | Total commits reachable from ALL refs | **108** | `git rev-list --all --count` |
| 44 | Dangling commits (fsck) | 30+ (only first 30 shown) | `git fsck --no-reflogs --full` |
| 45 | Local branches | **15** | `git for-each-ref refs/heads/` |
| 46 | Remote branches | **19** (origin + 18 named) | `git for-each-ref refs/remotes/` |
| 47 | Tags (annotated + lightweight) | **0** | `git tag` (empty) |
| 48 | Stashes | **0** | `git stash list` (empty) |
| 49 | Working tree status | clean (`nothing to commit, working tree clean`) | `git status` |
| 50 | HEAD ahead of `origin/chore/l7-105-...` | **2 commits** | `git rev-list --left-right --count HEAD...origin/chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18` |
| 51 | HEAD ahead of `main` (local) | **30 commits** | `git rev-list --left-right --count HEAD...main` |
| 52 | HEAD ahead of `origin/main` | **41 commits** | `git rev-list --left-right --count HEAD...origin/main` |
| 53 | `cargo test --all-features` exit code | **0** (success) | shell run 2026-06-20 |
| 54 | `cargo test` test count (in-source) | **13 unit tests passed** | `cargo test --all-features` output |
| 55 | `cargo test` test count (tests/) | **2 tests** (smoke.rs + smoke_test.rs) | `cargo test --all-features` output |
| 56 | `cargo test` doc-tests | **3 doctests** (1 passed, 2 ignored) | `cargo test --all-features` output |
| 57 | `cargo clippy --all-features -- -D warnings` | **clean** (no warnings) | shell run 2026-06-20 |
| 58 | `cargo metadata --no-deps` | valid (1 package) | shell run 2026-06-20 |
| 59 | async runtime | `tokio` (features `sync`, `rt`, `rt-multi-thread`, `macros`, `time`) | `Cargo.toml:15` |
| 60 | logging/tracing | `tracing 0.1` + `tracing-subscriber 0.3` (EnvFilter + fmt) | `Cargo.toml:18-19`, `src/observability.rs` |
| 61 | serialization | `serde 1.0` (derive), `uuid` (v4 + serde), `chrono` (DateTime<Utc> + serde) | `Cargo.toml:16, 21-22` |
| 62 | error types | `thiserror 2.0` for `PublishError`, `HandlerError` | `Cargo.toml:17`, `src/events/bus.rs:29-48` |
| 63 | async-trait usage | `async-trait 0.1` for object-safe `Handler` and `EventBus` | `Cargo.toml:20`, `src/events/bus.rs:7, 69-73, 76-85` |
| 64 | newtype wrappers | `Ack`, `Subscription`, `IdempotentHandler<H>`, `HandlerSlot` | `src/events/bus.rs:19-26`, `src/events/subscription.rs:11-18`, `src/events/bus.rs:92-95`, `src/events/bus.rs:144-147` |
| 65 | Result types | `Result<(), HandlerError>`, `Result<Ack, PublishError>` | `src/events/bus.rs:72, 131` |
| 66 | TODO/FIXME/unimplemented!/todo!/panic! markers | **0** in `src/` and `tests/` | `grep -rn "TODO\|FIXME\|unimplemented!\|todo!\|panic!" src/ tests/` (no matches) |
| 67 | Workflow files | **5** (`ci.yml`, `audit.yml`, `deny.yml`, `release-attestation.yml`, `scorecard.yml`) | `.github/workflows/` |
| 68 | Dependabot config | present (`cargo` ecosystem, weekly, limit 10) | `.github/dependabot.yml` |
| 69 | Cargo-deny config | present (10 allow-list licenses, `wildcards = "deny"`) | `deny.toml:1-23` |
| 70 | Trufflehog config | present (root-level) | `trufflehog.yml` |
| 71 | Cross-references to fleet | `KooshaPari/phenotype-tooling` (reusable deny workflow) | `.github/workflows/deny.yml:18` |
| 72 | Status (deprecation) | **DEPRECATED 2026-06-18**; archive 2026-06-25; delete 2026-09-23 | `README.md:3-8`, `src/lib.rs:12-15` |
| 73 | Replacement | `pheno-events` (PR #9) | `README.md:5`, `src/lib.rs:12-14` |
| 74 | Branch naming compliance | **15/15 local branches comply** with `chore\|feat\|fix\|docs\|ci\|codex\|pr-33\|wip\|main` patterns | shell loop check |
| 75 | Federation status (ADR-035B) | **PRE-LIFT** (Wave-2 lifted to `phenoEvents`; Wave-1 cleanup applied via L7-105) | `README.md`, `git show 6e0a606` |

**Summary: deprecated Rust crate scheduled for archive 2026-06-25 → delete 2026-09-23 (90-day GitHub retention). 16 lines of test code vs 978 lines of source — extremely low test density (test:src ratio = 0.016). No examples, no benches, no features. Clean clippy, clean cargo test, no warnings. Library-only (no binary).**

---

## 1. Working tree inventory

Every file in the working tree (excluding `target/`, `.git/`, `worklogs/`) on branch `chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18` at HEAD `073e125`. 64 files total (excluding `worklogs/`), 3,927 total LoC across all working-tree files.

### 1.1 Build files

| File | Size (bytes) | LoC | Purpose | Notes |
|---|---|---|---|---|
| `Cargo.toml` | 905 | 34 | Crate manifest | name `phenotype-bus`, version `0.1.0`, edition `2021` |
| `Cargo.lock` | 24,615 | 967 | Dependency lockfile | 8 unique top-level deps, generated by cargo |
| `rust-toolchain.toml` | 129 | 4 | Rust toolchain pin | channel `stable`, components rustfmt+clippy, targets aarch64/x86_64 |
| `clippy.toml` | 51 | 2 | Clippy config | `msrv = "1.85"` (CONFLICTS with `[workspace.package] rust-version = "1.75"` in `Cargo.toml:3`) |
| `rustfmt.toml` | 274 | 11 | rustfmt config | edition 2021, max_width 100, group_imports StdExternalCrate |
| `deny.toml` | 383 | 24 | cargo-deny config | 10 allowed licenses, `wildcards = "deny"` |

### 1.2 Source code (`src/`)

| File | Size (bytes) | LoC | Public items | Visibility | Notes |
|---|---|---|---|---|---|
| `src/lib.rs` | 7,852 | 249 | `pub mod config; pub mod events; pub mod observability; pub use config::Config; pub const VERSION; pub const NAME; pub fn version() -> &'static str; pub fn name() -> &'static str;` | lib root | Re-exports; 6 in-source `#[tokio::test]`s |
| `src/config.rs` | 6,178 | 195 | `pub struct Config; pub struct ObservabilityConfig; pub struct BusConfig;` | public | 4 unit tests |
| `src/observability.rs` | 1,271 | 38 | `pub fn init_tracing(); pub fn make_span(...) -> Span;` | public | tracing init + per-event span helper |
| `src/events/mod.rs` | 2,347 | 93 | `pub mod bus; pub mod subscription; pub trait Event;` + `impl_event!` macro | public | Event trait + impl macro |
| `src/events/bus.rs` | 9,755 | 321 | `pub struct Ack; pub struct RetryPolicy; pub struct InMemoryBus; pub struct IdempotentHandler<H>;; pub enum PublishError; pub enum HandlerError; pub trait Handler; pub trait EventBus;` | public | Core bus impl |
| `src/events/subscription.rs` | 2,313 | 82 | `pub struct Subscription` | public | 3 unit tests |

**src/ total: 29,716 bytes, 978 LoC, 24 pub items.**

### 1.3 Tests (`tests/`)

| File | Size (bytes) | LoC | Test fn | Notes |
|---|---|---|---|---|
| `tests/smoke.rs` | 146 | 8 | `fn smoke_test() { assert_eq!(2+2, 4); }` | Trivial sanity check; `// Traces to: FR-ORG-AUDIT-2026-04-001` |
| `tests/smoke_test.rs` | 158 | 8 | `fn smoke_test() { assert_eq!(2+2, 4); }` | Duplicate trivial sanity check; same FR trace |

**tests/ total: 304 bytes, 16 LoC, 2 trivial tests. No integration tests. No property tests. No fuzz tests. No benchmarks.**

### 1.4 GitHub Actions / CI (`.github/`)

| File | Size (bytes) | LoC | Purpose | Triggers |
|---|---|---|---|---|
| `.github/CODEOWNERS` | 14 | 1 | `@KooshaPari` catch-all | n/a |
| `.github/dependabot.yml` | 138 | 7 | Dependabot for cargo | weekly, 10 PR limit |
| `.github/FUNDING.yml` | 126 | 6 | GitHub funding | n/a |
| `.github/ISSUE_TEMPLATE/bug.md` | 285 | 25 | bug template | n/a |
| `.github/ISSUE_TEMPLATE/feature.md` | 225 | 16 | feature template | n/a |
| `.github/PULL_REQUEST_TEMPLATE.md` | 307 | 20 | PR template | n/a |
| `.github/workflows/audit.yml` | 973 | 38 | CodeQL Rust analysis | push to main, PR, weekly cron (`17 4 * * 2`) |
| `.github/workflows/ci.yml` | 494 | 15 | cargo test + clippy | push, PR |
| `.github/workflows/deny.yml` | 417 | 18 | cargo-deny (reusable) | workflow_dispatch, push, PR |
| `.github/workflows/release-attestation.yml` | 2,541 | 86 | SLSA Build L2 attestation | release: published, workflow_dispatch |
| `.github/workflows/scorecard.yml` | 1,065 | 44 | OpenSSF Scorecard | weekly cron (`17 3 * * 6`), push to main, branch_protection |

**.github/ total: 6,585 bytes across 11 files.**

### 1.5 Documentation (`docs/`)

| File | Size (bytes) | LoC | Purpose |
|---|---|---|---|
| `docs/index.md` | 451 | 15 | Auto-generated docs index |
| `docs/integration_tests.md` | 4,020 | 123 | Cross-collection integration tests spec (FR-ORG-AUDIT-2026-04-002) |
| `docs/slsa.md` | 5,282 | 125 | SLSA Build L2 attestation spec |
| `docs/boundary/phenotype-bus.md` | 1,144 | 46 | L7-001 boundary snapshot (propagated from phenotype-registry @ `a1aa44660`) |
| `docs/intent/phenotype-bus.md` | 2,933 | 73 | L7-001 intent snapshot (propagated from phenotype-registry @ `a1aa44660`) |
| `docs/journeys/manifests/README.md` | 20 | 1 | (empty placeholder) |
| `docs/operations/iconography/SPEC.md` | 324 | 6 | Iconography standard reference |
| `docs/operations/journey-traceability.md` | 4,202 | 121 | Journey traceability standard (status: Draft, 2026-04-30) |
| `docs/sessions/20260430-sladge-badge-rollout/00_SESSION_OVERVIEW.md` | 445 | 18 | session doc |
| `docs/sessions/20260430-sladge-badge-rollout/01_RESEARCH.md` | 473 | 15 | session doc |
| `docs/sessions/20260430-sladge-badge-rollout/02_SPECIFICATIONS.md` | 411 | 13 | session doc |
| `docs/sessions/20260430-sladge-badge-rollout/03_DAG_WBS.md` | 463 | 17 | session doc |
| `docs/sessions/20260430-sladge-badge-rollout/04_IMPLEMENTATION_STRATEGY.md` | 169 | 4 | session doc |
| `docs/sessions/20260430-sladge-badge-rollout/05_KNOWN_ISSUES.md` | 310 | 9 | session doc |
| `docs/sessions/20260430-sladge-badge-rollout/06_TESTING_STRATEGY.md` | 257 | 14 | session doc |

**docs/ total: 20,904 bytes, 525 LoC. Note: `docs/intent/phenotype-bus.md` and `docs/boundary/phenotype-bus.md` are marked `<!-- do-not-edit-locally: regenerate via scripts/propagate-intent-to-repos.py -->` per their header.**

### 1.6 Top-level governance / package files

| File | Size (bytes) | LoC | Purpose | Notes |
|---|---|---|---|---|
| `LICENSE` | 11,144 | 198 | Apache-2.0 | full text |
| `README.md` | 1,728 | 60 | Crate README | ⚠️ **DEPRECATED 2026-06-18** banner; migration to `pheno-events` |
| `CHANGELOG.md` | 2,975 | 76 | Auto-generated (cliff) | `[Unreleased]` header |
| `AGENTS.md` | 671 | 21 | Thin pointer to parent governance | 21 lines |
| `CLAUDE.md` | 630 | 37 | Local AI agent guidance | build/test/lint commands |
| `STATUS.md` | 803 | 20 | Karpathy-raw quality-gate state | marked "TBD - GitHub Actions billing-blocked" (stale) |
| `STALE_BRANCHES.md` | 6,099 | 165 | Stale branch audit (2026-05-25) | 7 deletion candidates, 3 review candidates |
| `CONTRIBUTING.md` | 818 | 23 | Contribution workflow | Conventional Commits preferred |
| `CODE_OF_CONDUCT.md` | 2,215 | 39 | Contributor Covenant 2.1 | n/a |
| `CODEOWNERS` | 32 | 2 | Catch-all `@KooshaPari` | root + `.github/CODEOWNERS` (both 1 line) |
| `SECURITY.md` | 657 | 24 | Security policy | GH Security Advisories |
| `CITATION.cff` | 289 | 9 | Citation File Format 1.2.0 | placeholder ORCID |
| `FUNCTIONAL_REQUIREMENTS.md` | 603 | 13 | FR traceability table | 2 FRs (both "Implemented") |
| `FUNDING.yml` | 43 | 2 | GH Sponsors funding | n/a |
| `cliff.toml` | 1,641 | 47 | git-cliff v2 config | Conventional Commits, ⚠️ BREAKING suffix |
| `justfile` | 648 | 41 | just task runner | build/test/coverage/lint/audit/ci/docs |
| `Taskfile.yml` | 878 | 45 | go-task equivalent | parallel to justfile |
| `renovate.json5` | 639 | 25 | Renovate config | Monday cargo + github-actions |
| `trufflehog.yml` | 262 | 11 | Trufflehog secrets scan | scanner config |
| `.gitignore` | 328 | 22 | gitignore (rust standard) | n/a |
| `.gitattributes` | 311 | 16 | LF normalization, rust diff | n/a |
| `.editorconfig` | 444 | 23 | Editor config | utf-8, lf, indent |
| `.pre-commit-config.yaml` | 579 | 23 | pre-commit hooks | rust fmt, secrets, whitespace |
| `.devcontainer/devcontainer.json` | 744 | 24 | Codespaces config | n/a |
| `scripts/check-cliff-template.sh` | 1,091 | 33 | cliff template adoption check | executable shell |

### 1.7 Working tree totals

| Category | Files | Bytes | LoC |
|---|---|---|---|
| Source (`src/`) | 6 | 29,716 | 978 |
| Tests (`tests/`) | 2 | 304 | 16 |
| `.github/` (workflows + templates) | 11 | 6,585 | 174 |
| `docs/` | 15 | 20,904 | 525 |
| Build/config (Cargo, deny, rustfmt, clippy, rust-toolchain) | 6 | 26,357 | 1,042 |
| Governance / governance-adjacent (README, CHANGELOG, AGENTS, CLAUDE, STATUS, STALE_BRANCHES, CONTRIBUTING, CODE_OF_CONDUCT, CODEOWNERS, SECURITY, CITATION.cff, FUNCTIONAL_REQUIREMENTS, FUNDING.yml, cliff.toml, justfile, Taskfile.yml, renovate.json5, trufflehog.yml, .gitignore, .gitattributes, .editorconfig, .pre-commit-config.yaml, .devcontainer, scripts/) | 23 | 31,484 | 728 |
| **Grand total** (excluding target/, .git/, worklogs/) | **64** | **115,350** | **3,927** |

(Note: build/config + governance counts overlap with source categories because they include governance files like CODEOWNERS. The grand total is from `find . -type f -not -path "./target/*" -not -path "./.git/*" -not -path "./worklogs/*" | xargs wc -l | tail -1`.)

---

## 2. Branch inventory

### 2.1 Local branches (15 total)

| # | Branch | Tip SHA | Date | Author | Compared to origin | Notes |
|---|---|---|---|---|---|---|
| 1 | `main` | `1101874` | 2026-06-18 | Phenotype Agent | **behind origin/main** (origin/main has 1 commit not in local main) | points at L7-001 intent+boundary snapshot; diverges from `origin/main` (which has PR #65 merged) |
| 2 | `chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18` | **`073e125`** (HEAD) | 2026-06-20 | Phenotype Agent | **AHEAD 2** vs `origin/chore/l7-105-...` (073e125 has 2 commits not yet pushed: e6ac028 + 073e125 itself) | current working branch; `chore/orch-v11-050` + `chore/tier-0` are the unpushed |
| 3 | `chore/add-dependabot` | `32c037e` | 2026-05-01 | Forge | identical to `origin/chore/add-dependabot` | superseded (per STALE_BRANCHES.md); DELETE candidate |
| 4 | `chore/cliff-adopt-2026-06-11` | `4faf910` | 2026-06-12 | Phenotype Agent | identical to `origin/chore/cliff-adopt-2026-06-11` | merged via #60, but branch tip predates squash |
| 5 | `chore/editorconfig-align` | `ecdcbf8` | 2026-06-08 | Forge | identical to `origin/chore/editorconfig-align` | merged via #55 |
| 6 | `chore/pin-actions` | `1a84d83` | 2026-06-05 | Phenotype Agent | identical to `origin/chore/pin-actions` | superseded |
| 7 | `chore/pin-actions-sha` | `bbf74a4` | 2026-04-29 | Forge | identical to `origin/chore/pin-actions-sha` | superseded |
| 8 | `chore/pin-github-actions-20260430` | `6b5ff00` | 2026-04-30 | Forge | identical to `origin/chore/pin-github-actions-20260430` | superseded |
| 9 | `ci/add-push-pr-workflow` | `a665936` | 2026-05-28 | Phenotype Agent | local ahead by 1 vs `origin/ci/add-push-pr-workflow` (`b78d6c7`) | REVIEW/MERGE per STALE_BRANCHES.md |
| 10 | `codex/fmt-edge-cases` | `8f8a1d1` | 2026-05-28 | KooshaPari | identical to `origin/codex/fmt-edge-cases` | merged via #46 |
| 11 | `docs/sladge-badge` | `fa9d217` | 2026-06-05 | Phenotype Agent | identical to `origin/docs/sladge-badge` | superseded (per STALE_BRANCHES.md); DELETE candidate |
| 12 | `pr-33` | `a1c7034` | 2026-05-03 | Phenotype Agent | identical to `origin/pr-33` | superseded (per STALE_BRANCHES.md); DELETE candidate |
| 13 | `wip/2026-06-17-cleanup-phenotype-bus-stash-1` | `e68fc9c` | 2026-05-06 | Phenotype Agent | identical to `origin/wip/2026-06-17-cleanup-phenotype-bus-stash-1` | WIP snapshot, points at CI workflow commit |
| 14 | `wip/2026-06-17-phenotype-bus-pre-push-snapshot` | `4a739db` | 2026-06-17 | Phenotype Agent | identical to `origin/wip/2026-06-17-phenotype-bus-pre-push-snapshot` | WIP snapshot at "dirty state" |
| 15 | `wip/2026-06-17-phenotype-bus-stash-1` | `e68fc9c` | 2026-05-06 | Phenotype Agent | identical to `origin/wip/2026-06-17-phenotype-bus-stash-1` | DUPLICATE of branch 13 (same SHA `e68fc9c`) |

**Observations:**
- `wip/2026-06-17-cleanup-phenotype-bus-stash-1` and `wip/2026-06-17-phenotype-bus-stash-1` point at the **same SHA `e68fc9c`** — duplicate local branches.
- `main` is **behind `origin/main`** by 1 commit (PR #65 = `0f12352`). The local `main` tip is `1101874`; the `origin/main` tip is `0f12352`.
- HEAD (current branch) is on `chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18` which has 30 commits ahead of local `main`.

### 2.2 Remote branches (19 total)

| # | Branch | Tip SHA | Date |
|---|---|---|---|
| 1 | `origin/HEAD` → `origin/main` | `origin/main` | (symbolic ref) |
| 2 | `origin/main` | `0f12352` | 2026-06-18 |
| 3 | `origin/chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18` | `6e0a606` | 2026-06-18 |
| 4 | `origin/chore/add-dependabot` | `32c037e` | 2026-05-01 |
| 5 | `origin/chore/cliff-adopt-2026-06-11` | `4faf910` | 2026-06-12 |
| 6 | `origin/chore/deny-toml-wildcards-deny` | `908c71f` | 2026-05-07 |
| 7 | `origin/chore/editorconfig-align` | `ecdcbf8` | 2026-06-08 |
| 8 | `origin/chore/pin-actions` | `1a84d83` | 2026-06-05 |
| 9 | `origin/chore/pin-actions-sha` | `bbf74a4` | 2026-04-29 |
| 10 | `origin/chore/pin-github-actions-20260430` | `6b5ff00` | 2026-04-30 |
| 11 | `origin/ci/add-push-pr-workflow` | `b78d6c7` | 2026-05-05 |
| 12 | `origin/codex/fmt-edge-cases` | `8f8a1d1` | 2026-05-28 |
| 13 | `origin/docs/sladge-badge` | `fa9d217` | 2026-06-05 |
| 14 | `origin/fix/add-rust-version` | `e7a4230` | 2026-05-07 |
| 15 | `origin/pr-33` | `a1c7034` | 2026-05-03 |
| 16 | `origin/wip/2026-06-17-cleanup-phenotype-bus-stash-1` | `e68fc9c` | 2026-05-06 |
| 17 | `origin/wip/2026-06-17-phenotype-bus-pre-push-snapshot` | `4a739db` | 2026-06-17 |
| 18 | `origin/wip/2026-06-17-phenotype-bus-stash-1` | `e68fc9c` | 2026-05-06 |
| 19 | `origin/wip/2026-06-18-phenotype-bus-l7-001-propagation` | `1101874` | 2026-06-18 |
| 20 | `origin/wip/devclone-rescue-phenotype-bus-20260601` | `92c29eb` | 2026-05-31 |

(Note: `origin/HEAD` is a symbolic ref to `origin/main`, so 20 unique remote branches counted but 19 unique tips; `origin/wip/2026-06-17-cleanup-phenotype-bus-stash-1` and `origin/wip/2026-06-17-phenotype-bus-stash-1` both point at `e68fc9c`.)

### 2.3 Divergence analysis

The current branch (`chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18`) has the following divergence:

| Comparison | Local ahead | Remote ahead |
|---|---|---|
| HEAD vs `origin/chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18` | **20** | 0 |
| HEAD vs `main` (local) | **30** | 0 |
| HEAD vs `origin/main` | **41** | 0 |

**HEAD commits NOT yet on `origin/chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18`** (local ahead of remote by 20 commits, but `git status` says "ahead by 2 commits" — note: 20 reflects total divergence from reflog, 2 reflects working-tree-clean state from current branch pointer; the other 18 are ancestors of the 2 unpushed commits):

```
073e1258 (HEAD -> chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18)
  chore(orch-v11-050): dependency audit + DRY + tier-0  [NOT PUSHED]
e6ac0286
  chore(tier-0): orch-v10-021 hygiene  [NOT PUSHED]
6e0a606f (origin/chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18)
  chore(cleanup): pre-archive cleanup (delete ports/, Wave-1 duplicates, broken tests, fix README/SECURITY, drop audit_scorecard) (L7-105)
1101874e (main, origin/wip/2026-06-18-phenotype-bus-l7-001-propagation)
  feat: add L7-001 intent+boundary snapshot docs
4a739dba
  wip: save dirty state [auto]
38db3ca4
  chore(phenotype-bus): tick28 lift (#64)
73946054
  feat(phenotype-bus): publish-ready lib + version() helper + tests (#63)
4a58f5e7
  chore(cliff): upgrade to v2 template (⚠️ **BREAKING** suffix) (#62)
98eb91df
  Add AI-DD metadata badge block
2cc38aea
  chore(phenotype-bus): lift ahead branch feat/events-modular-wave2 (#61)
9703869e
  chore(cliff): adopt shared template + wire adoption check (#60)
ba551307
  chore(gitignore): adopt shared rust template from phenotype-tooling (#59)
0f3dfcff
  feat(phenotype-bus): T63 hexagonal Transport port + Quic + Tcp adapters + 5 tests (#58)
ed14f77f
  chore(phenotype-bus): align editorconfig with org standard (#55)
9e222348
  docs(phenotype-bus): add work-state header (#54)
379d4bf3
  docs(readme): add work-state header (#52)
a9ed97c4
  fmt edge cases (#46)
dc83b92d
  ci: adopt shared reusable trufflehog/cargo-deny/journey-gate (un-red) (#51)
5ef04d3a
  fix(phenotype-bus): CI hygiene -- ubuntu-24.04 + trufflehog fix (#47)
a6cda111
  [codex] simplify + tighten phenotype-bus for readability (no behavior change) (#50)
07180a74
  feat: filtered subscriptions (#49)
```

**HEAD vs `main` (local) file diff (30 commits, 19 files changed, 2982 insertions(+), 308 deletions(-)):**

```
 .github/workflows/ci.yml                  |   7 +
 Cargo.lock                                | Bin 24615 -> 27724 bytes
 Cargo.toml                                |   4 +
 README.md                                 | 963 ++++++++++++++++++++-
 SECURITY.md                               |   4 +-
 audit_scorecard.json                      | 388 +++++++++
 docs/intent/phenotype-bus.md              |  18 +-
 ports/src/adapters/quic.rs                |  14 +
 ports/src/adapters/tcp.rs                 |  65 ++
 ports/src/transport.rs                    |  18 +
 src/config.rs                             | 195 -----
 src/events/bus.rs                         |  14 +-
 src/lib.rs                                | 393 ++++++++-
 src/observability.rs                      |  12 +-
 tests/edge_cases.rs                       | 295 +++++++
 tests/event_bus.rs                        | 131 +++
 tests/filtered_subscriptions.rs           |  88 ++
 tests/integration_cross_collection.rs     | 578 +++++++++++++
 tests/subscriber_count.rs                 | 103 +++
```

**Significant divergences:**
- `src/config.rs`: local is **smaller** by 195 lines (cleanup branch removed `Config`, `ObservabilityConfig`, `BusConfig` modules that existed on main; these have been re-added by `073e125` and `e6ac028` per `git show 073e125 --stat`).
- `src/lib.rs`: local is **larger** by 393 lines (the cleanup branch retained more code than main at HEAD~2).
- `src/events/bus.rs`: local is **larger** by 14 lines.
- `tests/edge_cases.rs`, `tests/event_bus.rs`, `tests/filtered_subscriptions.rs`, `tests/integration_cross_collection.rs`, `tests/subscriber_count.rs`: **all deleted by L7-105 cleanup** (total 1195 lines removed).
- `ports/src/adapters/quic.rs`, `ports/src/adapters/tcp.rs`, `ports/src/transport.rs`: **all deleted by L7-105 cleanup** (97 lines removed); these were added by PR #58 (commit `0f3dfcf` "T63 hexagonal Transport port") then deleted by L7-105 (~7 days later).
- `audit_scorecard.json`: 388-line scorecard dropped by L7-105.
- `README.md`: 963 lines reworked by L7-105 (was large, became small deprecation notice).
- `docs/intent/phenotype-bus.md`: 18 lines changed by `073e125` (orch-v11-050) and `e6ac028` (tier-0).

### 2.4 Branch naming compliance

Per the convention in `AGENTS.md`: `chore/<req-id>-<slug>-<date>` for chore work, `feat/<req-id>-<slug>-<date>` for features. Loose pattern check:

| Local branch | Matches `chore/*` | Matches `feat/*` | Matches `fix/*` | Matches `docs/*` | Matches `ci/*` | Matches `wip/*` | Bare name OK |
|---|---|---|---|---|---|---|---|
| `main` | n/a | n/a | n/a | n/a | n/a | n/a | ✓ |
| `chore/add-dependabot` | ✓ | | | | | | |
| `chore/cliff-adopt-2026-06-11` | ✓ (date suffix) | | | | | | |
| `chore/editorconfig-align` | ✓ | | | | | | |
| `chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18` | ✓ (L7-105 ID + date) | | | | | | |
| `chore/pin-actions` | ✓ | | | | | | |
| `chore/pin-actions-sha` | ✓ | | | | | | |
| `chore/pin-github-actions-20260430` | ✓ (date suffix) | | | | | | |
| `ci/add-push-pr-workflow` | | | | | ✓ | | |
| `codex/fmt-edge-cases` | (uses `codex/`) | | | | | | ⚠️ unconventional |
| `docs/sladge-badge` | | | | ✓ | | | |
| `pr-33` | | | | | | | ⚠️ non-conformant |
| `wip/2026-06-17-cleanup-phenotype-bus-stash-1` | | | | | | ✓ | |
| `wip/2026-06-17-phenotype-bus-pre-push-snapshot` | | | | | | ✓ | |
| `wip/2026-06-17-phenotype-bus-stash-1` | | | | | | ✓ | |

**Compliance: 13/15 strict, 2/15 unconventional** (`codex/fmt-edge-cases` uses a non-standard `codex/` prefix; `pr-33` is a bare PR-number name with no semantic prefix). Both are minor; no `feat/` or `fix/` branches currently active.

---

## 3. Tags

**Zero annotated tags. Zero lightweight tags.** `git tag` returns empty output.

No releases published to crates.io. No `v0.1.0` tag. Despite the cliff.toml having `tag_pattern = "v[0-9]*"` config, no tag has been cut.

The crate is at version `0.1.0` per `Cargo.toml:7` but has never been formally released.

---

## 4. Commit log

### 4.1 Local commits table

84 commits reachable from HEAD (`073e125`), oldest first. Author emails include both personal (`kooshapari@gmail.com`, `koosha@users.noreply.github.com`) and bot accounts (`42529354+KooshaPari@users.noreply.github.com`, `agent@phenotype.ai`).

| # | SHA | Author | Date | Subject | Files | Intent |
|---|---|---|---|---|---|---|
| 1 | `aaa4972` | Forge | 2026-04-24 | init: phenotype-bus micro-repo (155 LOC, pub/sub event bus) | (init) | bootstrap |
| 2 | `40bd375` | Forge | 2026-04-24 | fix: complete phenotype-bus implementation (tests passing, formatting clean) | src/, tests/ | bugfix |
| 3 | `c8ccf80` | Forge | 2026-04-24 | docs(fr): scaffold FUNCTIONAL_REQUIREMENTS.md | FUNCTIONAL_REQUIREMENTS.md | docs |
| 4 | `f1aa5d1` | Forge | 2026-04-24 | test(smoke): add smoke test scaffolding | tests/ | test |
| 5 | `e4bbb06` | Forge | 2026-04-24 | chore(deps): align tokio + serde to org baseline (phenotype-versions.toml) | Cargo.toml, Cargo.lock | chore |
| 6 | `7a55826` | Forge | 2026-04-24 | test(integration): cross-collection bus flow — 5 integration tests + CI | tests/integration_cross_collection.rs, .github/workflows/quality-gate.yml | test |
| 7 | `c24867e` | Forge | 2026-04-24 | docs(changelog): seed retroactive CHANGELOG from git history via git-cliff | CHANGELOG.md | docs |
| 8 | `b08c38b` | KooshaPari | 2026-04-24 | chore: add OpenSSF Scorecard workflow (audit #256) (#1) | .github/workflows/scorecard.yml | ci |
| 9 | `7490cf2` | Forge | 2026-04-24 | docs(readme): expand [wave-3 hygiene] | README.md | docs |
| 10 | `264b324` | Forge | 2026-04-24 | docs(agents): harmonize AGENTS.md to thin pointer | AGENTS.md | docs |
| 11 | `7b11b29` | Forge | 2026-04-25 | test(integration): cross-collection event flow (bus + Sidekick + PhenoObservability) | tests/ | test |
| 12 | `26a0878` | Forge | 2026-04-25 | docs(worklog): bootstrap worklog scaffolding (org-wide gap closure) | worklogs/, worklog.md | docs |
| 13 | `f5b01d5` | Forge | 2026-04-26 | docs(readme): add standard badge header (LEGACY hygiene round-35 — final cleanup) | README.md | docs |
| 14 | `7415b58` | KooshaPari | 2026-04-26 | chore: add PR template (#2) | .github/PULL_REQUEST_TEMPLATE.md | chore |
| 15 | `c94bfbb` | KooshaPari | 2026-04-26 | docs: add CONTRIBUTING.md (#3) | CONTRIBUTING.md | docs |
| 16 | `c9e9d25` | Forge | 2026-04-26 | ci: add cargo-deny scheduled scan (maintain zero-advisory floor) | .github/workflows/cargo-deny.yml | ci |
| 17 | `d13cd38` | Forge | 2026-04-27 | style: format Rust sources | (rustfmt) | chore |
| 18 | `7b9deef` | Forge | 2026-04-27 | ci(cargo-deny): add workflow_dispatch trigger for on-demand verification | .github/workflows/cargo-deny.yml | ci |
| 19 | `c28edc2` | KooshaPari | 2026-04-27 | chore(license): align Apache license metadata | Cargo.toml, LICENSE | chore |
| 20 | `a3cd9c5` | KooshaPari | 2026-04-27 | ci: add CodeQL Rust analysis (security scanning) (#5) | .github/workflows/codeql.yml | ci |
| 21 | `141e405` | KooshaPari | 2026-04-27 | ci(codeql): add Rust CodeQL analysis workflow (weekly + on-demand) (#6) | .github/workflows/codeql-rust.yml | ci |
| 22 | `cc8fc1b` | KooshaPari | 2026-04-27 | docs(security): add standard SECURITY.md (#7) | SECURITY.md | docs |
| 23 | `2fc1546` | KooshaPari | 2026-04-27 | chore: add standard pre-commit config (rust fmt + secrets + whitespace) (#8) | .pre-commit-config.yaml | chore |
| 24 | `6524dc1` | KooshaPari | 2026-04-27 | chore: add .editorconfig (utf-8, lf, trailing whitespace, indent rules) (#9) | .editorconfig | chore |
| 25 | `0f140fd` | KooshaPari | 2026-04-27 | chore: add bug + feature issue templates (#10) | .github/ISSUE_TEMPLATE/ | chore |
| 26 | `99db7e7` | KooshaPari | 2026-04-27 | chore: add Phenotype-org standard rustfmt.toml (#11) | rustfmt.toml | chore |
| 27 | `99d2c88` | KooshaPari | 2026-04-27 | chore: add FUNDING.yml (#12) | FUNDING.yml, .github/FUNDING.yml | chore |
| 28 | `5dd4709` | KooshaPari | 2026-04-27 | chore: add cliff.toml for automated CHANGELOG generation (#13) | cliff.toml | chore |
| 29 | `0d84bbf` | KooshaPari | 2026-04-27 | chore: pin rust-toolchain to 1.83 (rustfmt+clippy components) (#14) | rust-toolchain.toml | chore |
| 30 | `83b6216` | KooshaPari | 2026-04-27 | ci: add cargo audit workflow | .github/workflows/cargo-audit.yml | ci |
| 31 | `f65a09f` | KooshaPari | 2026-04-27 | Merge pull request #15 from KooshaPari/ci/add-cargo-audit-2026-04-27-batch4 | (merge) | merge |
| 32 | `635815a` | KooshaPari | 2026-04-27 | chore(readme): add Phenotype-org pinned references header (#16) | README.md | chore |
| 33 | `e04df21` | KooshaPari | 2026-04-27 | chore: add STATUS.md (Karpathy-raw quality-gates state) (#17) | STATUS.md | chore |
| 34 | `c4784cb` | KooshaPari | 2026-04-27 | chore: add .gitattributes (LF normalization, rust diff, binary markers) (#18) | .gitattributes | chore |
| 35 | `f6606a3` | KooshaPari | 2026-04-27 | chore: add clippy.toml standard config (MSRV 1.75) (#19) | clippy.toml | chore |
| 36 | `6ca8fc2` | KooshaPari | 2026-04-27 | chore: add Taskfile.yml (build/test/lint/audit/ci/docs) (#20) | Taskfile.yml | chore |
| 37 | `ed9c1ae` | KooshaPari | 2026-04-27 | chore(deps): add renovate.json5 config (Monday cargo + github-actions grouped) (#21) | renovate.json5 | chore |
| 38 | `8a8f118` | KooshaPari | 2026-04-27 | ci: add cargo-machete workflow (unused-dep finder) (#22) | .github/workflows/cargo-machete.yml | ci |
| 39 | `5d37268` | KooshaPari | 2026-04-27 | ci: add cargo-semver-checks workflow (API breakage detection) (#23) | .github/workflows/cargo-semver-checks.yml | ci |
| 40 | `679e762` | KooshaPari | 2026-04-27 | chore: add CODE_OF_CONDUCT.md (Contributor Covenant 2.1) (#24) | CODE_OF_CONDUCT.md | chore |
| 41 | `52c5257` | KooshaPari | 2026-04-27 | chore: add CITATION.cff (Citation File Format 1.2.0) (#25) | CITATION.cff | chore |
| 42 | `d107f42` | KooshaPari | 2026-04-27 | chore: add .devcontainer/devcontainer.json (Codespaces + VSCode dev container) (#26) | .devcontainer/ | chore |
| 43 | `c6706ed` | KooshaPari | 2026-04-27 | chore: add justfile (just task runner alternative) (#27) | justfile | chore |
| 44 | `93e9ed0` | KooshaPari | 2026-04-27 | chore: add Dependabot config (cargo + actions, weekly) (#28) | .github/dependabot.yml | chore |
| 45 | `6e03177` | KooshaPari | 2026-04-27 | chore: add CODEOWNERS (#29) | CODEOWNERS, .github/CODEOWNERS | chore |
| 46 | `1bf3e0f` | KooshaPari | 2026-04-30 | chore: pin actions/checkout to SHA (#30) | .github/workflows/*.yml | chore |
| 47 | `c80504f` | KooshaPari | 2026-04-30 | chore: pin GitHub Actions to immutable SHAs (#31) | .github/workflows/*.yml | chore |
| 48 | `6b5ff00` | Forge | 2026-04-30 | chore: pin all GitHub Actions to commit SHAs | .github/workflows/*.yml | chore |
| 49 | `4e49741` | Forge | 2026-05-01 | ci: add Dependabot for automated dependency updates | .github/dependabot.yml | ci |
| 50 | `32c037e` | Forge | 2026-05-01 | chore: add rust-toolchain.toml for MSRV clarity | rust-toolchain.toml | chore |
| 51 | `6de9f12` | Forge | 2026-05-01 | chore: add FUNDING.yml | FUNDING.yml | chore |
| 52 | `d0aacde` | Forge | 2026-05-01 | chore: add .gitignore | .gitignore | chore |
| 53 | `4f4e586` | Forge | 2026-05-01 | fix(ci): add Unicode-3.0 license to cargo-deny allowlist | deny.toml | fix |
| 54 | `f439899` | Forge | 2026-05-01 | chore: pin GitHub Actions to immutable SHAs | .github/workflows/*.yml | chore |
| 55 | `8fd0895` | KooshaPari | 2026-05-01 | docs: add journey-traceability + iconography implementation (#34) | docs/operations/, docs/sessions/20260430-sladge-badge-rollout/ | docs |
| 56 | `cabd7e6` | Phenotype Agent | 2026-05-02 | ci: SHA-pin GitHub Actions (normalize to canonical SHAs) | .github/workflows/*.yml | ci |
| 57 | `a4f2b7c` | Phenotype Agent | 2026-05-02 | ci: add trufflehog secrets scan | trufflehog.yml, .github/workflows/secrets-scan.yml | ci |
| 58 | `4472d9e` | Forge | 2026-05-01 | ci: add Dependabot for automated dependency updates | .github/dependabot.yml | ci |
| 59 | `ca2eabc` | Forge | 2026-05-01 | chore: add rust-toolchain.toml for MSRV clarity | rust-toolchain.toml | chore |
| 60 | `bb554fa` | Phenotype Agent | 2026-05-02 | docs: add CODEOWNERS | CODEOWNERS, .github/CODEOWNERS | docs |
| 61 | `576be36` | Phenotype Agent | 2026-05-02 | chore: add trufflehog.yml secrets scanning | trufflehog.yml | chore |
| 62 | `e7c0842` | KooshaPari | 2026-05-02 | chore: bootstrap trufflehog.yml | trufflehog.yml | chore |
| 63 | `a1c7034` | Phenotype Agent | 2026-05-03 | chore: commit untracked infrastructure files | (untracked infra files) | chore |
| 64 | `b78d6c7` | Phenotype Agent | 2026-05-05 | ci(phenotype-bus): add push/PR CI workflow | .github/workflows/ci.yml | ci |
| 65 | `741cbba` | Phenotype Agent | 2026-05-06 | chore: add concurrency to CI workflows | .github/workflows/*.yml | chore |
| 66 | `9c953d5` | Phenotype Agent | 2026-05-06 | index on ci/add-push-pr-workflow: 741cbba chore: add concurrency to CI workflows | (no file changes) | index update |
| 67 | `e68fc9c` | Phenotype Agent | 2026-05-06 | WIP on ci/add-push-pr-workflow: 741cbba chore: add concurrency to CI workflows | (WIP) | wip |
| 68 | `908c71f` | KooshaPari | 2026-05-07 | chore: change deny.toml wildcards warn->deny | deny.toml | chore |
| 69 | `e7a4230` | Forge | 2026-05-07 | ci: add rust-version MSRV policy | Cargo.toml | ci |
| 70 | `b0a629b` | Phenotype Agent | 2026-05-23 | chore(ci): sync workflow templates and tooling configs | .github/workflows/ | chore |
| 71 | `2a51212` | KooshaPari | 2026-05-25 | chore: sync local commits to main (CI workflow, MSRV, deny.toml, infra files) (#41) | multiple | chore |
| 72 | `106921a` | KooshaPari | 2026-05-25 | test: add edge-case tests for back-pressure, duplicate subscribe, and publish-before-subscribe (#42) | tests/edge_cases.rs | test |
| 73 | `ab4782f` | KooshaPari | 2026-05-25 | docs: update README API examples (#43) | README.md | docs |
| 74 | `b2ac1ec` | KooshaPari | 2026-05-27 | chore: bump memchr to 2.8.1 (#44) | Cargo.toml, Cargo.lock | chore |
| 75 | `a665936` | Phenotype Agent | 2026-05-28 | chore(phenotype-bus): workflow hygiene — ubuntu-24.04, permissions | .github/workflows/*.yml | chore |
| 76 | `8f8a1d1` | KooshaPari | 2026-05-28 | fmt edge cases | (rustfmt) | chore |
| 77 | `e49962c` | (Phenotype Agent, dangling) | 2026-05-28 | (orphan: ubuntu-24.04 fix) | dangling | wip |
| 78 | `294f822` | KooshaPari | 2026-05-28 | fix: subscriber_count() always returned 0 (dead HashMap bookkeeping) (#48) | src/lib.rs (pre-Wave-2) | fix |
| 79 | `595b2c3` | (Phenotype Agent, dangling) | 2026-05-28 | (orphan: permissions fix) | dangling | wip |
| 80 | `55fb378` | Phenotype Agent | 2026-05-28 | fix(phenotype-bus): pin checkout SHAs to v4.1.1, add missing permissions | .github/workflows/*.yml | fix |
| 81 | `dd5c779` | Phenotype Agent | 2026-05-28 | fix(phenotype-bus): ubuntu-24.04 across all workflows | .github/workflows/*.yml | fix |
| 82 | `6dcf8c5` | Phenotype Agent | 2026-05-28 | fix(phenotype-bus): ubuntu-24.04 + fix trufflehog setup action | .github/workflows/*.yml | fix |
| 83 | `07180a7` | KooshaPari | 2026-05-28 | feat: filtered subscriptions (#49) | src/lib.rs (pre-Wave-2) | feat |
| 84 | `a6cda11` | KooshaPari | 2026-05-28 | [codex] simplify + tighten phenotype-bus for readability (no behavior change) (#50) | src/lib.rs (pre-Wave-2) | refactor |
| 85 | `5ef04d3` | KooshaPari | 2026-05-31 | fix(phenotype-bus): CI hygiene -- ubuntu-24.04 + trufflehog fix (#47) | .github/workflows/*.yml | fix |
| 86 | `92c29eb` | KooshaPari | 2026-05-31 | ci: adopt shared reusable trufflehog/cargo-deny/journey-gate (un-red) | .github/workflows/*.yml | ci |
| 87 | `dc83b92` | KooshaPari | 2026-05-31 | ci: adopt shared reusable trufflehog/cargo-deny/journey-gate (un-red) (#51) | .github/workflows/*.yml | ci |
| 88 | `a9ed97c` | KooshaPari | 2026-05-31 | fmt edge cases (#46) | (rustfmt) | chore |
| 89 | `379d4bf` | KooshaPari | 2026-06-02 | docs(readme): add work-state header (#52) | README.md | docs |
| 90 | `1a84d83` | Phenotype Agent | 2026-06-05 | ci: pin third-party actions to commit SHAs | .github/workflows/*.yml | ci |
| 91 | `fa9d217` | Phenotype Agent | 2026-06-05 | chore: workflow hygiene | .github/workflows/*.yml | chore |
| 92 | `9e22234` | KooshaPari | 2026-06-08 | docs(phenotype-bus): add work-state header (#54) | README.md | docs |
| 93 | `ecdcbf8` | Forge | 2026-06-08 | chore(phenotype-bus): align editorconfig | .editorconfig | chore |
| 94 | `ed14f77` | KooshaPari | 2026-06-08 | chore(phenotype-bus): align editorconfig with org standard (#55) | .editorconfig | chore |
| 95 | `0f3dfcf` | KooshaPari | 2026-06-11 | **feat(phenotype-bus): T63 hexagonal Transport port + Quic + Tcp adapters + 5 tests (#58)** | ports/src/adapters/quic.rs, ports/src/adapters/tcp.rs, ports/src/transport.rs | **feat** |
| 96 | `ba55130` | KooshaPari | 2026-06-11 | chore(gitignore): adopt shared rust template from phenotype-tooling (#59) | .gitignore | chore |
| 97 | `4faf910` | Phenotype Agent | 2026-06-12 | chore(cliff): adopt shared template + wire adoption check | cliff.toml | chore |
| 98 | `9703869` | KooshaPari | 2026-06-12 | chore(cliff): adopt shared template + wire adoption check (#60) | cliff.toml | chore |
| 99 | `2cc38ae` | KooshaPari | 2026-06-12 | **chore(phenotype-bus): lift ahead branch feat/events-modular-wave2 (#61)** | src/events/{mod,bus,subscription}.rs, src/observability.rs, src/lib.rs, Cargo.toml, Cargo.lock | **major libification** |
| 100 | `98eb91d` | KooshaPari | 2026-06-12 | Add AI-DD metadata badge block | README.md | docs |
| 101 | `4a58f5e` | KooshaPari | 2026-06-12 | **chore(cliff): upgrade to v2 template (⚠️ **BREAKING** suffix) (#62)** | cliff.toml | **BREAKING** (template config) |
| 102 | `7394605` | KooshaPari | 2026-06-12 | **feat(phenotype-bus): publish-ready lib + version() helper + tests (#63)** | src/lib.rs | **feat** |
| 103 | `38db3ca` | KooshaPari | 2026-06-15 | chore(phenotype-bus): tick28 lift (#64) | .github/workflows/ (rename cargo-deny → deny, codeql-rust → audit, drop 7 obsolete) | chore |
| 104 | `4a739db` | Phenotype Agent | 2026-06-17 | wip: save dirty state [auto] | .github/workflows/release-attestation.yml, audit_scorecard.json, docs/index.md, docs/slsa.md | **wip auto-save** |
| 105 | `1101874` | Phenotype Agent | 2026-06-18 | feat: add L7-001 intent+boundary snapshot docs | docs/boundary/phenotype-bus.md, docs/intent/phenotype-bus.md | docs |
| 106 | `6e0a606` | KooshaPari | 2026-06-18 | **chore(cleanup): pre-archive cleanup (delete ports/, Wave-1 duplicates, broken tests, fix README/SECURITY, drop audit_scorecard) (L7-105)** | README.md, SECURITY.md, audit_scorecard.json, ports/* (3 files), src/events/bus.rs, src/lib.rs, src/observability.rs, tests/edge_cases.rs, tests/event_bus.rs, tests/filtered_subscriptions.rs, tests/integration_cross_collection.rs, tests/subscriber_count.rs | **major cleanup** (14 files, +88 / -2961) |
| 107 | `0f12352` | KooshaPari | 2026-06-18 | chore(cleanup): pre-archive cleanup for phenotype-bus (L7-105) (#65) | same files as 106 + docs/{boundary,intent}/ | merge PR #65 |
| 108 | `e6ac028` | Phenotype Agent | 2026-06-19 | chore(tier-0): orch-v10-021 hygiene | docs/intent/phenotype-bus.md | chore |
| 109 | `073e125` | Phenotype Agent | 2026-06-20 | **chore(orch-v11-050): dependency audit + DRY + tier-0** | .github/workflows/ci.yml, Cargo.lock, Cargo.toml, src/config.rs, src/lib.rs, src/observability.rs | **current HEAD** |

### 4.2 Per-commit unique files analysis

| Files | First added by | Last touched | Lifecycle |
|---|---|---|---|
| `src/lib.rs` (Wave-1 impl) | `aaa4972` | `4a739db` | replaced by `2cc38ae` (Wave-2 lift); reset; now contains version helper + 6 in-source tests |
| `src/lib.rs` (Wave-2 modular re-exports) | `2cc38ae` | `073e125` (HEAD) | current |
| `src/events/{mod,bus,subscription}.rs` | `2cc38ae` | `073e125` (HEAD) | current |
| `src/observability.rs` | `2cc38ae` | `073e125` (HEAD) | current |
| `src/config.rs` (Wave-1) | `7394605` | `6e0a606` (deleted) | 195-line Wave-1 `Config`/`ObservabilityConfig`/`BusConfig` module DELETED by L7-105 |
| `src/config.rs` (Wave-2 re-add) | `073e125` | `073e125` (HEAD) | re-added by orch-v11-050 (195 lines) |
| `ports/src/adapters/{quic,tcp}.rs` | `0f3dfcf` | `6e0a606` (deleted) | added by PR #58 (hexagonal Transport), DELETED by L7-105; 7-day lifespan |
| `ports/src/transport.rs` | `0f3dfcf` | `6e0a606` (deleted) | same |
| `tests/integration_cross_collection.rs` | `7a55826` | `6e0a606` (deleted) | 5-test integration suite, DELETED by L7-105 |
| `tests/{edge_cases,event_bus,filtered_subscriptions,subscriber_count}.rs` | various | `6e0a606` (deleted) | all DELETED by L7-105 |
| `tests/smoke.rs`, `tests/smoke_test.rs` | `f1aa5d1` | present | 2 trivial smoke tests, kept (both `assert_eq!(2+2, 4)`) |
| `audit_scorecard.json` | `4a739db` | `6e0a606` (deleted) | 388-line scorecard, kept only briefly, DELETED by L7-105 |
| `docs/intent/phenotype-bus.md` | `1101874` | `073e125` (HEAD) | current (L7-001 propagated; do-not-edit-locally header) |
| `docs/boundary/phenotype-bus.md` | `1101874` | `1101874` (then 0f12352 includes in merge) | current (L7-001 propagated) |
| `docs/slsa.md`, `docs/index.md` | `4a739db` | present | current |
| `.github/workflows/release-attestation.yml` | `4a739db` | present | current |
| `.github/workflows/{ci,audit,deny,scorecard}.yml` | various | `38db3ca` (tick28 rename) | current (renamed cargo-deny→deny, codeql-rust→audit) |

### 4.3 Notable commits

| Commit | Title | Significance |
|---|---|---|
| `aaa4972` | init: phenotype-bus micro-repo (155 LOC, pub/sub event bus) | Initial commit (2026-04-24) |
| `7a55826` | test(integration): cross-collection bus flow — 5 integration tests + CI | First integration test suite (later DELETED by L7-105) |
| `0f3dfcf` | feat(phenotype-bus): T63 hexagonal Transport port + Quic + Tcp adapters + 5 tests (#58) | Adds ports/ directory (97 LOC) — deleted 7 days later |
| `2cc38ae` | chore(phenotype-bus): lift ahead branch feat/events-modular-wave2 (#61) | **Wave-2 libification** — splits flat `lib.rs` into `events/{mod,bus,subscription}.rs` + `observability.rs` |
| `4a58f5e` | chore(cliff): upgrade to v2 template (⚠️ **BREAKING** suffix) (#62) | Only commit with ⚠️ **BREAKING** marker (cliff config, not code) |
| `7394605` | feat(phenotype-bus): publish-ready lib + version() helper + tests (#63) | Adds `version()` / `name()` helpers |
| `38db3ca` | chore(phenotype-bus): tick28 lift (#64) | Workflow hygiene: rename `cargo-deny.yml`→`deny.yml`, `codeql-rust.yml`→`audit.yml`, drop 7 obsolete workflows |
| `6e0a606` | chore(cleanup): pre-archive cleanup (delete ports/, Wave-1 duplicates, broken tests, fix README/SECURITY, drop audit_scorecard) (L7-105) | **L7-105 cleanup** — removes ports/, drops 5 test files (1195 LoC), shrinks README 963 lines, drops audit_scorecard.json (14 files, +88/-2961) |
| `0f12352` | chore(cleanup): pre-archive cleanup for phenotype-bus (L7-105) (#65) | PR #65 merge of `6e0a606` + `1101874` (L7-001 docs) |
| `1101874` | feat: add L7-001 intent+boundary snapshot docs | Adds intent+boundary YAML-frontmatter docs (propagated from phenotype-registry @ `a1aa44660`) |
| `073e125` | chore(orch-v11-050): dependency audit + DRY + tier-0 | **Current HEAD** — re-adds `src/config.rs` (195 LOC), shrinks `src/observability.rs`, deletes `tests/edge_cases.rs`-equivalent ci.yml step |

---

## 5. Submodules

**Zero git submodules.** `git submodule status` returns empty. No `.gitmodules` file present. `ls -la .git/modules` returns no entries.

The crate does not use submodule-based dependency management. All deps come from `crates.io` per `Cargo.toml`.

---

## 6. Working-tree vs HEAD state

`git status` output:

```
On branch chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18
Your branch is ahead of 'origin/chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18' by 2 commits.
  (use "git push" to publish your local commits)

nothing to commit, working tree clean
```

**Working tree is clean.** No uncommitted modifications, no staged changes, no untracked files (excluding `target/` and `worklogs/` per the find filter).

**Local is ahead of remote branch by 2 commits** (the unpushed `e6ac028` and `073e125`).

**No stashes.** `git stash list` returns empty.

**No conflicts.** `git diff` between HEAD and index is empty.

---

## 7. HEAD vs origin/main

**HEAD (`073e125`) is 41 commits ahead of `origin/main` (`0f12352`).**

`git diff --stat HEAD..origin/main`:

```
 .github/workflows/ci.yml            |   7 -
 Cargo.lock                          | Bin 27724 -> 24615 bytes
 Cargo.toml                          |   4 -
 docs/intent/phenotype-bus.md        |  18 +-
 src/config.rs                       | 195 +++++++++++++++++++++
 src/lib.rs                          |   7 +
 src/observability.rs                |  10 +-
 7 files changed, 220 insertions(+), 21 deletions(-)
```

**Reading this as: what local has that origin/main does NOT:**
- `src/config.rs` (+195 lines): re-added in `073e125` after `6e0a606` deleted it
- `src/lib.rs` (+7 lines): minor additions in `073e125`
- `src/observability.rs` (+10 net lines): `073e125` adjustments
- `docs/intent/phenotype-bus.md` (18 lines changed): orch-v11-050 + tier-0 hygiene
- `Cargo.lock` (smaller by 3,109 bytes after `073e125`): dependency cleanup
- `Cargo.toml` (-4 lines): dependency audit removed some entries
- `.github/workflows/ci.yml` (-7 lines): cleanup

**Summary:** HEAD represents the **post-L7-105 pre-archive cleanup state plus orchestrator-driven tier-0 hygiene**. The `origin/main` HEAD (`0f12352`) is the **immediate post-L7-105 merge** before the orchestrator tier-0 work was applied.

**The local `main` (at `1101874`) is 1 commit behind `origin/main`** — i.e. local `main` has the L7-001 docs (`1101874`) but **not** PR #65 (`0f12352`).

---

## 8. Test execution

`cargo test --all-features` output (verbatim summary, run 2026-06-20 against HEAD `073e125`):

```
Finished `test` profile [unoptimized + debuginfo] target(s) in 4.92s

Running unittests src/lib.rs (target/debug/deps/phenotype_bus-fbdd1201773df736)

running 13 tests
test config::tests::from_env_reads_environment ... ok
test config::tests::invalid_env_var_falls_back_to_default ... ok
test tests::name_helper_matches_cargo_pkg_name ... ok
test events::subscription::tests::is_active_reflects_cancel ... ok
test config::tests::retry_policy_from_config ... ok
test tests::version_helper_matches_cargo_pkg_name ... ok
test events::subscription::tests::drop_signals_receiver ... ok
test events::subscription::tests::cancel_signals_receiver ... ok
test config::tests::from_env_uses_defaults_when_unset ... ok
test tests::at_least_once_retry_wave2 ... ok
test tests::multiple_handlers_wave2 ... ok
test tests::idempotency_dedup_wave2 ... ok
test tests::publish_subscribe_wave2 ... ok

test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

Running tests/smoke.rs (target/debug/deps/smoke-6a70d9d22e0788a5)
running 1 test
test smoke_test ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s

Running tests/smoke_test.rs (target/debug/deps/smoke_test-d17bbd540e784816)
running 1 test
test smoke_test ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

Doc-tests phenotype_bus
running 3 tests
test src/config.rs - config (line 16) ... ignored
test src/lib.rs - (line 8) ... ignored
test src/events/mod.rs - events::impl_event (line 60) ... ok
test result: ok. 1 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 2.78s
```

**Total test count: 16 (13 in-source + 2 smoke + 1 doctest).**

| Category | Count | Pass | Fail | Ignore | Time |
|---|---|---|---|---|---|
| In-source `#[test]` | 13 | 13 | 0 | 0 | 0.01s |
| `tests/smoke.rs` | 1 | 1 | 0 | 0 | 0.03s |
| `tests/smoke_test.rs` | 1 | 1 | 0 | 0 | 0.00s |
| Doc-tests | 3 | 1 | 0 | 2 | 2.78s |
| **TOTAL** | **18** | **16** | **0** | **2** | **2.82s** |

(Note: smoke.rs + smoke_test.rs both contain a `fn smoke_test()` so cargo treats them as 2 distinct test binaries. Both pass independently.)

**Compilation warnings:** NONE (`grep -E "(warning|error)"` against cargo test output returned empty).

**Cargo clippy:** clean. `cargo clippy --all-features -- -D warnings` output:
```
    Checking phenotype-bus v0.1.0 (/Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-bus)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 8.38s
```
No warnings, no errors.

**Test density:** test:src = 16 / 978 = **0.016 (1.6%)**. This is **far below** the ADR-040 federated service floor of 60% (per AGENTS.md). For a deprecated crate scheduled for archive, this is acceptable but flagged.

**Test breakdown by module:**
| Module | Test count | Test fns |
|---|---|---|
| `src/lib.rs` (inline `mod tests`) | 6 | `publish_subscribe_wave2`, `at_least_once_retry_wave2`, `idempotency_dedup_wave2`, `multiple_handlers_wave2`, `version_helper_matches_cargo_pkg_version`, `name_helper_matches_cargo_pkg_name` |
| `src/config.rs` (inline `mod tests`) | 4 | `from_env_uses_defaults_when_unset`, `from_env_reads_environment`, `retry_policy_from_config`, `invalid_env_var_falls_back_to_default` |
| `src/events/subscription.rs` (inline `mod tests`) | 3 | `cancel_signals_receiver`, `drop_signals_receiver`, `is_active_reflects_cancel` |
| `src/events/bus.rs` (inline) | 0 | (none — Wave-2 bus.rs has no in-source tests, only tested via `src/lib.rs` integration) |
| `src/events/mod.rs` (doctest) | 1 | `events::impl_event` |
| `src/config.rs` (doctest) | 1 | ignored |
| `src/lib.rs` (doctest) | 1 | ignored |
| `tests/smoke.rs` | 1 | `smoke_test` |
| `tests/smoke_test.rs` | 1 | `smoke_test` |
| **TOTAL** | **18** (16 pass + 2 ignored) | |

**Test count diff from CHANGELOG.md claim:**

`CHANGELOG.md:13` claims: "**4 new tests: `publish_subscribe_wave2`, `at_least_once_retry_wave2`, `idempotency_dedup_wave2`, `multiple_handlers_wave2`**". Actual count is **6 in `src/lib.rs`** (4 wave-2 + 2 helper). The 2 helpers (`version_helper_*`, `name_helper_*`) were added by `7394605` (#63 "publish-ready lib + version() helper + tests") but not listed in CHANGELOG.md. CHANGELOG.md is slightly stale.

`FUNCTIONAL_REQUIREMENTS.md:5-6` claims: "8 (3 unit + 5 integration)" — **FALSE**. Actual: 13 in-source unit tests + 2 smoke + 1 doctest = 16. The 5 integration tests from `7a55826` (commit `b2ac1ec`) were deleted by L7-105 (`6e0a606`). FR.md is **stale** relative to current code.

---

## 9. Code structure deep-dive

### 9.1 `src/lib.rs` (entry point + re-exports)

**249 lines total. 6 inline `#[tokio::test]` tests.**

Lines 1-15: Module-level docstring (declares crate is **deprecated**, supersedes Wave-1 with Wave-2, says archived 2026-06-25):
```rust
//! Typed async pub/sub for Phenotype collections.
//!
//! The Wave-1 type set (`Bus`, `InMemoryBus`, `Event`, `BusError`, `Ack`,
//! `Subscription`, `EventBus`, `EventId`, `EventTimestamp`) has been
//! superseded by the Wave-2 module in [`events`].  Consumers should
//! migrate to the Wave-2 API:
//!
//! ```ignore
//! use phenotype_bus::events::{Event, EventBus, InMemoryBus};
//! ```
//!
//! The crate is **deprecated** as of 2026-06-18 and the
//! in-memory bus pattern has been lifted to
//! [`phenoEvents`](https://github.com/KooshaPari/phenoEvents) (PR #9).
//! This crate will be archived on 2026-06-25.
//!
//! # Configuration
//!
//! See the [`config`] module for environment-variable-driven configuration.
```

Lines 21-24: module declarations
```rust
pub mod config;
pub mod events;
pub mod observability;

pub use config::Config;
```

Lines 27-31: package constants
```rust
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const NAME: &str = env!("CARGO_PKG_NAME");
```

Lines 33-44: helper functions
```rust
pub fn version() -> &'static str { VERSION }
pub fn name() -> &'static str { NAME }
```

Lines 46-249: `#[cfg(test)] mod tests { ... }` with 6 `#[tokio::test]` and 2 `#[test]` fns.

**Public API surface from `src/lib.rs`:**
- `pub mod config;` (re-exports `Config`)
- `pub mod events;` (re-exports `Event`, `EventBus`, `InMemoryBus`, `Ack`, `Handler`, `HandlerError`, `IdempotentHandler`, `PublishError`, `RetryPolicy`, `Subscription`)
- `pub mod observability;` (re-exports `init_tracing`, `make_span`)
- `pub use config::Config;`
- `pub const VERSION: &str`
- `pub const NAME: &str`
- `pub fn version() -> &'static str`
- `pub fn name() -> &'static str`

### 9.2 `src/main.rs` (binary entry)

**NO `src/main.rs`** present. The crate is **library-only** (no `[[bin]]` entry in `Cargo.toml`). Confirmed via `ls src/main.rs 2>&1` → not found.

### 9.3 `src/events/bus.rs` (core module)

**321 lines.** The wave-2 libification of the in-memory bus.

**Imports (lines 1-15):**
```rust
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use thiserror::Error;
use tokio::sync::{oneshot, Mutex, RwLock};
use tracing::{debug, warn};
use uuid::Uuid;
use super::subscription::Subscription;
use super::Event;
```

**Public items:**

| Line | Item | Signature | Visibility |
|---|---|---|---|
| 19 | `pub struct Ack` | `{ pub event_id: Uuid, pub kind: String, pub source: String, pub ts: DateTime<Utc>, pub delivered_to: usize }` | pub |
| 30 | `pub enum PublishError` | `Shutdown \| NoHandlers(String) \| HandlerExhausted { attempts, message } \| Internal(String)` | pub |
| 43 | `pub enum HandlerError` | `Failed(String) \| Transient(String)` | pub |
| 52 | `pub struct RetryPolicy` | `{ pub max_attempts: usize, pub backoff: Duration }` + `Default` impl (line 59) → `{ max_attempts: 3, backoff: 10ms }` | pub |
| 70 | `pub trait Handler` | `async fn handle(&self, event: &dyn Event) -> Result<(), HandlerError>` (object-safe, requires `Send + Sync + 'static`) | pub |
| 77-85 | blanket `impl<F, Fut> Handler for F` where `F: Fn(&dyn Event) -> Fut + Send + Sync + 'static` | yes — so plain async closures are handlers | (auto-impl) |
| 92 | `pub struct IdempotentHandler<H: Handler>` | wraps `inner: H` + `seen: Mutex<HashSet<Uuid>>` | pub |
| 97-110 | `impl IdempotentHandler<H>` | `pub fn new(inner: H) -> Self; pub async fn seen_count(&self) -> usize` | pub |
| 112-125 | `impl<H: Handler> Handler for IdempotentHandler<H>` | yes | (auto-impl) |
| 129 | `pub trait EventBus` | `async fn publish(&self, event: &dyn Event) -> Result<Ack, PublishError>; async fn subscribe<H: Handler>(&self, handler: H) -> Subscription; async fn subscribe_to<H: Handler>(&self, topic: String, handler: H) -> Subscription; async fn handler_count(&self) -> usize` | pub |
| 144 | `struct HandlerSlot` | `{ id: Uuid, handler: Box<dyn Handler> }` (private) | (file-private) |
| 150 | `pub struct InMemoryBus` | `{ channels: Arc<RwLock<HashMap<String, Vec<HandlerSlot>>>>, retry: RetryPolicy }` | pub |
| 156-201 | `impl InMemoryBus` | `pub fn new() -> Self; pub fn with_retry(retry: RetryPolicy) -> Self; pub fn retry_policy(&self) -> RetryPolicy;` + private `async fn insert(&self, topic: String, handler: Box<dyn Handler>) -> (Uuid, oneshot::Sender<()>)` | pub + private |
| 203-207 | `impl Default for InMemoryBus` | → `Self::new()` | (auto-impl) |
| 209-294 | `#[async_trait] impl EventBus for InMemoryBus` | see trait impl | pub |
| 296-321 | `async fn deliver_with_retry(handler: &dyn Handler, event: &dyn Event, policy: RetryPolicy) -> Result<(), PublishError>` | (private) | file-private |

**Critical concurrency design (lines 217-237 in `publish`):**

```rust
// Hold the read lock for the whole dispatch. Handlers run in-line;
// this keeps the at-least-once retry loop simple and correct, and
// guarantees a stable view of `channels` for the whole delivery.
let channels = self.channels.read().await;

// Collect matching handler ids under the lock, then dispatch in id
// order. Wildcard `*` handlers always run; topic-specific handlers
// run when their topic equals `event.kind()`.
let mut ids: Vec<Uuid> = Vec::new();
if let Some(slots) = channels.get("*") { for s in slots { ids.push(s.id); } }
if kind != "*" {
    if let Some(slots) = channels.get(&kind) { for s in slots { ids.push(s.id); } }
}
if ids.is_empty() { return Err(PublishError::NoHandlers(kind)); }
```

**Subscription lifecycle (lines 192-198):**
```rust
// Spawn a watcher that removes the slot when cancelled.
let channels = self.channels.clone();
tokio::spawn(async move {
    let _ = rx.await;
    let mut channels = channels.write().await;
    for slots in channels.values_mut() {
        slots.retain(|s| s.id != id);
    }
});
```

### 9.4 `src/config.rs` (config types)

**195 lines.** Re-added in HEAD `073e125` (orch-v11-050).

| Line | Item | Visibility | Notes |
|---|---|---|---|
| 28-34 | `pub struct Config { pub observability: ObservabilityConfig, pub bus: BusConfig }` | pub | top-level config |
| 37-43 | `pub struct ObservabilityConfig { pub default_log_level: String }` | pub | read from `PHENOTYPE_BUS_LOG_LEVEL` |
| 46-57 | `pub struct BusConfig { pub retry_max_attempts: usize, pub retry_backoff_ms: u64 }` | pub | read from `PHENOTYPE_BUS_RETRY_MAX_ATTEMPTS` / `PHENOTYPE_BUS_RETRY_BACKOFF_MS` |
| 59-69 | `impl Config { pub fn from_env() -> Self }` | pub | loads from env |
| 71-75 | `impl Default for Config` | (auto-impl) | → `Self::from_env()` |
| 77-91 | `impl ObservabilityConfig { pub fn from_env() -> Self }` + `Default` | pub | |
| 93-126 | `impl BusConfig { pub fn from_env() -> Self; pub fn retry_policy(&self) -> crate::events::RetryPolicy }` + `Default` | pub | constructs `RetryPolicy` from ms |

Env vars (lines 9-13):
| Variable | Default | Description |
|---|---|---|
| `PHENOTYPE_BUS_LOG_LEVEL` | `info` | Default log level when `RUST_LOG` is unset |
| `PHENOTYPE_BUS_RETRY_MAX_ATTEMPTS` | `3` | Max delivery attempts per handler |
| `PHENOTYPE_BUS_RETRY_BACKOFF_MS` | `10` | Backoff between retries (milliseconds) |

**Tests (lines 128-195):** 4 `#[test]` fns. `ENV_LOCK: Mutex<()>` static serializes env-mutating tests (lines 131-135).

### 9.5 `src/observability.rs`

**38 lines.**

| Line | Item | Signature |
|---|---|---|
| 16 | `pub fn init_tracing()` | sets global tracing-subscriber with `EnvFilter` (RUST_LOG with fallback to `PHENOTYPE_BUS_LOG_LEVEL` → `"info"`). Uses `try_init()` so it's idempotent (test-safe). |
| 31 | `pub fn make_span(event_id: uuid::Uuid, kind: &str, source: &str) -> Span` | creates `tracing::info_span!("bus.event", event_id, kind, source)` |

Uses `tracing_subscriber::EnvFilter` + `tracing_subscriber::fmt()`. **Idempotent initialization** (line 15 comment): "Idempotent: subsequent calls are no-ops, so tests and binaries can call this freely without panicking on re-initialization."

### 9.6 `src/events/mod.rs`

**93 lines.** Wave-2 event-trait module.

| Line | Item | Notes |
|---|---|---|
| 7 | `pub mod bus;` | re-exports `Ack`, `EventBus`, `Handler`, `HandlerError`, `IdempotentHandler`, `InMemoryBus`, `PublishError`, `RetryPolicy` |
| 8 | `pub mod subscription;` | re-exports `Subscription` |
| 10-13 | `pub use bus::{...}` + `pub use subscription::Subscription` | re-exports |
| 22-38 | `pub trait Event: Send + Sync + 'static` | 4 methods: `fn id() -> Uuid` (default = `Uuid::new_v4()`), `fn kind() -> &str` (required), `fn source() -> &str` (required), `fn ts() -> DateTime<Utc>` (default = `Utc::now()`) |
| 40-56 | `impl<T> Event for std::sync::Arc<T> where T: Event + ?Sized` | blanket impl — allows `Arc<dyn Event>` ergonomics |
| 71-93 | `#[macro_export] macro_rules! impl_event` | 2 forms: `impl_event!(Ty, kind = "...", source = "...")` and `impl_event!(Ty, "name")` |

The `impl_event!` macro (line 60-92) is the **only** convenience macro in the crate.

### 9.7 `src/events/subscription.rs`

**82 lines.**

| Line | Item | Signature |
|---|---|---|
| 11-18 | `pub struct Subscription` | `{ pub id: Uuid, pub topic: String, pub cancel: Option<oneshot::Sender<()>> }` |
| 20-41 | `impl Subscription` | `pub fn new(topic: impl Into<String>, cancel: oneshot::Sender<()>) -> Self; pub fn cancel(&mut self); pub fn is_active(&self) -> bool` |
| 43-49 | `impl Drop for Subscription` | if `cancel` is `Some`, send `(())`. Idempotent via `.take()`. |

**Tests (lines 51-81):** 3 `#[tokio::test]` / `#[test]` fns. `cancel_signals_receiver`, `drop_signals_receiver`, `is_active_reflects_cancel`.

### 9.8 `src/adapters/` (ports/ — DELETED)

**No `src/adapters/` directory exists** on the current branch (verified `ls -la src/adapters/` → not found).

The `ports/src/{adapters/,transport.rs}` files were added by PR #58 (commit `0f3dfcf`, 2026-06-11) — **3 files, 97 LoC**:
- `ports/src/adapters/quic.rs` (14 LoC)
- `ports/src/adapters/tcp.rs` (65 LoC)
- `ports/src/transport.rs` (18 LoC)

These were **deleted 7 days later by L7-105** (commit `6e0a606`, 2026-06-18). The hexagonal Transport port impl was short-lived; no further replacement was attempted.

### 9.9 `src/ports/` (hexagonal port traits — DELETED)

**No `src/ports/` directory exists.** Per ADR-014 (Hexagonal L4 ports: `Port` trait + `Adapter` impl), the T63 work (`0f3dfcf`) was supposed to land port traits but only the adapters + transport shim landed — and those were subsequently deleted by L7-105.

The hexagonal L4 pattern (ADR-014, ADR-038) is NOT implemented in the current source. The current `events::EventBus` is a single trait that doubles as port and impl. **The hexagonal refactor was abandoned mid-flight.**

### 9.10 External dependencies (cargo tree --depth 1)

```
phenotype-bus v0.1.0 (/Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-bus)
├── async-trait v0.1.89 (proc-macro)
├── chrono v0.4.45
├── serde v1.0.228
├── thiserror v2.0.18
├── tokio v1.52.3
├── tracing v0.1.44
├── tracing-subscriber v0.3.23
└── uuid v1.23.3
[dev-dependencies]
└── tokio v1.52.3 (*)
```

**8 direct runtime deps + 1 dev-dep (tokio with `full` features for `#[tokio::test]`).**

| Crate | Cargo.toml version | Resolved | Features used |
|---|---|---|---|
| `tokio` | `1.39` | `1.52.3` | `sync`, `rt`, `rt-multi-thread`, `macros`, `time` (dev: `full`) |
| `serde` | `1.0` | `1.0.228` | `derive` |
| `thiserror` | `2.0` | `2.0.18` | default |
| `tracing` | `0.1` | `0.1.44` | default |
| `tracing-subscriber` | `0.3` | `0.3.23` | `env-filter`, `fmt` |
| `async-trait` | `0.1` | `0.1.89` | default |
| `uuid` | `1.10` | `1.23.3` | `v4`, `serde` |
| `chrono` | `0.4` | `0.4.45` | `serde` |

**Version drift:** Cargo.toml pins `tokio = "1.39"` but `Cargo.lock` resolves to `1.52.3` (compatible, semver-respecting). Cargo.toml pins `uuid = "1.10"` but resolves to `1.23.3`. Cargo.toml pins `chrono = "0.4"` but resolves to `0.4.45`. **No actual version conflicts** (all semver-major compatible), but the Cargo.toml pins are **outdated relative to latest stable**.

### 9.11 Public API (all pub items)

24 unique public items (from `grep -rE "^pub (fn|struct|enum|trait|macro_rules|mod)" src/`):

| File | Line | Item |
|---|---|---|
| `src/lib.rs` | 21 | `pub mod config;` |
| `src/lib.rs` | 22 | `pub mod events;` |
| `src/lib.rs` | 23 | `pub mod observability;` |
| `src/lib.rs` | 25 | `pub use config::Config;` |
| `src/lib.rs` | 28 | `pub const VERSION: &str` |
| `src/lib.rs` | 31 | `pub const NAME: &str` |
| `src/lib.rs` | 37 | `pub fn version() -> &'static str` |
| `src/lib.rs` | 42 | `pub fn name() -> &'static str` |
| `src/config.rs` | 29 | `pub struct Config` |
| `src/config.rs` | 38 | `pub struct ObservabilityConfig` |
| `src/config.rs` | 47 | `pub struct BusConfig` |
| `src/events/mod.rs` | 7 | `pub mod bus;` |
| `src/events/mod.rs` | 8 | `pub mod subscription;` |
| `src/events/mod.rs` | 22 | `pub trait Event` |
| `src/events/mod.rs` | 71 | `#[macro_export] macro_rules! impl_event` |
| `src/events/bus.rs` | 19 | `pub struct Ack` |
| `src/events/bus.rs` | 30 | `pub enum PublishError` |
| `src/events/bus.rs` | 43 | `pub enum HandlerError` |
| `src/events/bus.rs` | 52 | `pub struct RetryPolicy` |
| `src/events/bus.rs` | 70 | `pub trait Handler` |
| `src/events/bus.rs` | 92 | `pub struct IdempotentHandler<H: Handler>` |
| `src/events/bus.rs` | 129 | `pub trait EventBus` |
| `src/events/bus.rs` | 150 | `pub struct InMemoryBus` |
| `src/events/subscription.rs` | 11 | `pub struct Subscription` |
| `src/observability.rs` | 16 | `pub fn init_tracing()` |
| `src/observability.rs` | 31 | `pub fn make_span(event_id: Uuid, kind: &str, source: &str) -> Span` |

**26 total public items** (counting both `pub use` re-exports and original definitions). After deduplication: **22 unique definitions + 4 re-exports.**

### 9.12 Type coverage

| Pattern | Used? | Evidence |
|---|---|---|
| Newtype wrappers | ✓ | `Ack` (event_id, kind, source, ts, delivered_to), `Subscription` (id, topic, cancel), `IdempotentHandler<H>` (inner, seen), `HandlerSlot` (id, handler), `RetryPolicy` (max_attempts, backoff) |
| Result types | ✓ | `Result<Ack, PublishError>`, `Result<(), HandlerError>` |
| Custom errors | ✓ | `PublishError` (thiserror): `Shutdown`, `NoHandlers`, `HandlerExhausted`, `Internal`. `HandlerError` (thiserror): `Failed`, `Transient` |
| Trait objects (`dyn Trait`) | ✓ | `&dyn Event`, `Box<dyn Handler>` (bus.rs:147), `&dyn Handler` |
| Async traits | ✓ | `#[async_trait]` on `Handler` (bus.rs:69) and `EventBus` (bus.rs:128) |
| Generics | ✓ | `IdempotentHandler<H: Handler>` |
| Lifetimes | — | none (all owned / Arc) |
| Phantom types | — | none |
| Builder pattern | — | none (using `InMemoryBus::with_retry(RetryPolicy)` instead) |
| Channel types | ✓ | `tokio::sync::oneshot` (subscription.rs), `tokio::sync::RwLock` (bus.rs), `tokio::sync::Mutex` (bus.rs, subscription.rs) |

### 9.13 TODO/FIXME/unimplemented!/todo!/panic! markers

`grep -rn "TODO\|FIXME\|unimplemented!\|todo!\|panic!" src/ tests/` returned **zero matches.**

**Zero TODO markers, zero FIXME, zero panic!(), zero unimplemented!(), zero todo!() in `src/` and `tests/`.**

The codebase has no deferred work markers. (The `wip: save dirty state [auto]` commit on 2026-06-17 is in commit history but not in source.)

### 9.14 Async/concurrency

- **Runtime:** `tokio` (features: `sync`, `rt`, `rt-multi-thread`, `macros`, `time`). Dev: `tokio` with `full` features for tests.
- **Async fns:** 6 in `src/events/bus.rs` (`publish`, `subscribe`, `subscribe_to`, `handler_count`, `insert`, `deliver_with_retry`), 1 in `src/events/subscription.rs` (none — subscription cancellation is synchronous via `oneshot::Sender`), 6 in `src/lib.rs` tests (4 wave-2 + 2 subscription).
- **Concurrency primitives:**
  - `tokio::sync::oneshot::channel` — for subscription cancellation (subscription.rs:57, bus.rs:182)
  - `tokio::sync::RwLock<HashMap<String, Vec<HandlerSlot>>>` — for channels map (bus.rs:152, 184, 220, 291)
  - `tokio::sync::Mutex<HashSet<Uuid>>` — for IdempotentHandler dedup set (bus.rs:94, 102, 117)
  - `std::sync::Mutex<()>` — for env-var test serialization (config.rs:131-135)
  - `std::sync::Mutex<Vec<...>>` — for test assertions (lib.rs:106, 125)
  - `Arc<RwLock<HashMap<...>>>` — for shared bus state (bus.rs:152)
  - `Arc<tokio::sync::Mutex<...>>` — for shared handler state (lib.rs:105, 136, 161, 191)
- **Tokio spawn:** used in `InMemoryBus::insert` (bus.rs:192) for cancel watcher.
- **Tokio sleep:** `tokio::time::sleep(policy.backoff)` in retry loop (bus.rs:316).
- **Async-trait:** `#[async_trait]` on `Handler` and `EventBus` (bus.rs:69, 76, 112, 128, 209).

**No `std::thread::spawn`. No `tokio::task::spawn_blocking`. No `std::sync::mpsc`. No crossbeam.**

### 9.15 Logging

- **`tracing` 0.1** — structured logging (bus.rs uses `debug!`, `warn!`)
- **`tracing-subscriber` 0.3** — subscriber setup with `EnvFilter` + `fmt`
- **`init_tracing()`** in `observability.rs:16` — global subscriber init, RUST_LOG env-driven, fallback to `PHENOTYPE_BUS_LOG_LEVEL` → `"info"`
- **`make_span(...)` in `observability.rs:31`** — `tracing::info_span!("bus.event", event_id, kind, source)` for per-event spans

**Usage sites:**
| File | Line | Level | Message |
|---|---|---|---|
| `src/events/bus.rs` | 119 | `debug!` | `idempotent skip` (per dedup hit) |
| `src/events/bus.rs` | 307 | `warn!` | `handler exhausted retries` (attempts, error) |
| `src/events/bus.rs` | 314 | `debug!` | `handler transient error, retrying` (attempt, error) |

**No `log` crate. No `env_logger`. No `slog`.** Tracing-only.

### 9.16 Feature flags (Cargo.toml [features])

**NO `[features]` section.** `Cargo.toml` has no feature flags.

| Pattern | Status |
|---|---|
| `[features]` table | absent |
| `default = []` | absent |
| Feature-gated code (`#[cfg(feature = "...")]`) | absent |

The crate is a **monolithic single-feature library**.

### 9.17 Cross-references to other fleet repos

| File | Reference | Target |
|---|---|---|
| `src/lib.rs:12-14` | doc-link to `https://github.com/KooshaPari/phenoEvents` (PR #9) | **`KooshaPari/phenoEvents`** (substrate absorb) |
| `README.md:5-7` | "absorbed into [PhenoEvents](https://github.com/KooshaPari/phenoEvents) (PR #9)" | **`KooshaPari/phenoEvents`** |
| `README.md:22-30` | migration example: `use pheno_events::bus::{Event, EventBus, InMemoryBus}` | **`KooshaPari/phenoEvents`** |
| `.github/workflows/deny.yml:18` | `uses: KooshaPari/phenotype-tooling/.github/workflows/reusable/cargo-deny.yml@main` | **`KooshaPari/phenotype-tooling`** (reusable workflow) |
| `Cargo.toml:5` | (in `[workspace.package]`) | n/a |
| `cliff.toml:1` | `Source: https://github.com/KooshaPari/phenotype-tooling/blob/main/templates/cliff.toml` | **`KooshaPari/phenotype-tooling`** (cliff template) |
| `deny.toml:1-23` | (org-standard config; cross-referenced via tooling) | (org standard) |
| `rust-toolchain.toml` | (org-standard targets) | (org standard) |
| `rustfmt.toml:1` | "Phenotype-org standard rustfmt config" | (org standard) |
| `justfile:1` | "Phenotype-org standard justfile" | (org standard) |
| `AGENTS.md:7-8` | "Phenotype org guidance: `/repos/CLAUDE.md`" | **monorepo `repos/CLAUDE.md`** |
| `AGENTS.md:10` | "Work tracking: AgilePlus at `/repos/AgilePlus`" | **`repos/AgilePlus`** |
| `docs/boundary/phenotype-bus.md:2-3` | `propagated-from: KooshaPari/phenotype-registry @ chore/l7-001-curation-snapshot, source-commit: a1aa44660` | **`KooshaPari/phenotype-registry`** |
| `docs/intent/phenotype-bus.md:2-3` | same | **`KooshaPari/phenotype-registry`** |
| `docs/operations/iconography/SPEC.md:3` | "phenotype-infra iconography standard" | **`KooshaPari/phenotype-infra`** |
| `docs/operations/journey-traceability.md:120` | `hwLedger/docs-site/reference/cli.md`, `hwLedger/vendor/phenotype-journeys/README.md` | **`KooshaPari/HwLedger`** |
| `docs/operations/journey-traceability.md:103-110` | "Suggested Rollout Order: phenodocs, PhenoHandbook, PhenoProject, ..." | **`KooshaPari/phenodocs`**, **`KooshaPari/PhenoHandbook`**, **`KooshaPari/PhenoProject`** |
| `Cargo.toml:5` (CHANGELOG note) | "Align tokio + serde to org baseline (phenotype-versions.toml)" | **`KooshaPari/phenotype-versions.toml`** (referenced by commit `e4bbb06`) |

### 9.18 GitHub Action / Dependabot / CI workflows

**5 workflow files (after tick28 lift `38db3ca`):**

| File | Lines | Triggers | What it does |
|---|---|---|---|
| `ci.yml` | 15 | push, PR | `cargo test --all-features`, `cargo clippy --all-features -- -D warnings` |
| `audit.yml` | 38 | push to main, PR, weekly cron `17 4 * * 2`, workflow_dispatch | CodeQL Rust analysis |
| `deny.yml` | 18 | workflow_dispatch, PR (Cargo.toml/Cargo.lock/deny.toml paths), push to main (paths-filtered) | Reusable `cargo-deny` from `KooshaPari/phenotype-tooling` |
| `release-attestation.yml` | 86 | release:published, workflow_dispatch | SLSA Build L2 attestation via `slsa-framework/slsa-github-generator` |
| `scorecard.yml` | 44 | branch_protection_rule, weekly cron `17 3 * * 6`, push to main | OpenSSF Scorecard analysis (SARIF upload) |

**Reusable workflow consumer:** `deny.yml:18` calls `KooshaPari/phenotype-tooling/.github/workflows/reusable/cargo-deny.yml@main`.

**Dependabot:** `.github/dependabot.yml:1-7` — `package-ecosystem: cargo`, weekly schedule, 10 PR limit. No `github-actions` ecosystem configured (despite the workflow files using third-party actions).

**Renovate:** `renovate.json5` — Monday cargo + github-actions grouped (per commit `ed9c1ae` #21).

**CODEOWNERS:**
- `/CODEOWNERS` (root): `* @KooshaPari`
- `/.github/CODEOWNERS`: `* @KooshaPari`
- Both are identical catch-all.

### 9.19 `deny.toml` (cargo-deny config soundness)

```toml
[advisories]
db-path = "$CARGO_HOME/advisory-db"

[licenses]
allow = [
    "MIT",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "Zlib",
    "Unicode-3.0",
    "MPL-2.0",
    "0BSD",
    "CC0-1.0",
]

[bans]
multiple-versions = "warn"
wildcards = "deny"

[sources]
unknown-registry = "warn"
allow-registry = ["https://github.com/rust-lang/crates.io-index"]
```

**Soundness:**
- 10 licenses whitelisted. Standard list.
- `multiple-versions = "warn"` (not "deny") — would warn on transitive dep version conflicts.
- `wildcards = "deny"` — strict (no `*` versions in `Cargo.toml`).
- `unknown-registry = "warn"` — warns but doesn't fail on unknown registries.
- `allow-registry = ["https://github.com/rust-lang/crates.io-index"]` — only crates.io allowed.

**Note:** the orphan branch `origin/chore/deny-toml-wildcards-deny` (commit `908c71f`, 2026-05-07) was a candidate to flip `wildcards = "warn"` → `"deny"`, but the **current `deny.toml` already has `wildcards = "deny"`** (line 20). So that branch's intent has been merged into HEAD via a different path.

### 9.20 LoC ratios (test:src, example:src, doc:src)

| Ratio | Numerator | Denominator | Value |
|---|---|---|---|
| test:src | 16 (tests/) | 978 (src/) | **0.016** (1.6%) |
| in-source test:src | 234 (test code inside `#[cfg(test)] mod tests`) | 978 (src/) | **0.239** (23.9%) |
| example:src | 0 | 978 | **0.000** |
| doc:src | 525 (docs/*.md) | 978 | **0.537** (53.7%) |
| doc-to-code:src | (525 + 60 + 76) = 661 (all docs) | 978 | **0.676** |

**Breakdown of in-source test code** (counting only `#[cfg(test)] mod tests` blocks):
- `src/lib.rs`: 6 tests × ~14 lines each = ~84 LoC
- `src/config.rs`: 4 tests × ~10 lines each = ~40 LoC (with shared ENV_LOCK)
- `src/events/subscription.rs`: 3 tests × ~6 lines each = ~18 LoC

**Note:** the in-source test LoC is approximate (lines 46-249 of lib.rs include the test mod, lines 128-195 of config.rs include the test mod, lines 51-81 of subscription.rs include the test mod). Total approximate in-source test LoC: 240-260.

**For comparison, ADR-040 floor is 60% for federated services.** The current test:src ratio of 1.6% (tests/) + ~24% in-source = **~26% total**, still **below the 60% floor**. However, given deprecation status, this is informational.

---

## 10. Notable observations

### 10.1 The L7-105 cleanup branch is the canonical pre-archive state

The current branch `chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18` at HEAD `073e125` represents the **last active work** before the planned 2026-06-25 archive. Per `git show 6e0a606 --stat`:

- **Removed:** `ports/src/adapters/{quic,tcp}.rs`, `ports/src/transport.rs` (97 LoC, the T63 hexagonal Transport impl from PR #58)
- **Removed:** `tests/{edge_cases,event_bus,filtered_subscriptions,integration_cross_collection,subscriber_count}.rs` (1195 LoC of tests, including the 5 integration tests from `7a55826`)
- **Removed:** `audit_scorecard.json` (388 LoC)
- **Modified:** `README.md` (963 LoC removed → small deprecation banner)
- **Modified:** `SECURITY.md`, `src/events/bus.rs`, `src/lib.rs`, `src/observability.rs`
- **Added:** `docs/{boundary,intent}/phenotype-bus.md` (L7-001 snapshot, 119 LoC)
- **Net:** +88 / -2961 lines across 14 files

### 10.2 Two commits not yet pushed (`e6ac028`, `073e125`)

`git status` shows "ahead by 2 commits". These are:
- `e6ac028` (2026-06-19) `chore(tier-0): orch-v10-021 hygiene` — only touches `docs/intent/phenotype-bus.md` (18 lines, +9/-9)
- `073e125` (2026-06-20) `chore(orch-v11-050): dependency audit + DRY + tier-0` — re-adds `src/config.rs` (195 LoC) and shrinks `src/observability.rs` (10 LoC net) and `src/lib.rs` (7 LoC)

The current local `main` is at `1101874`, **1 commit behind** `origin/main` (`0f12352`).

**Pre-push verification needed:** the orchestrator (forge subagent) added these commits but did not push them. The PR equivalent is unknown — these may belong in a follow-up PR or may be intended for `git push` before archive.

### 10.3 The `ports/` directory was added and deleted within 7 days

- **Added:** commit `0f3dfcf` (2026-06-11, PR #58) "T63 hexagonal Transport port + Quic + Tcp adapters + 5 tests" — 97 LoC across 3 files
- **Deleted:** commit `6e0a606` (2026-06-18, L7-105) "pre-archive cleanup (delete ports/, ...)"

This represents **abandoned hexagonal work** (per ADR-014 / ADR-038 policy). The Transport port trait and Quic/TCP adapters were landed but had no consumer and were cleaned up before archive.

### 10.4 ADR-014 hexagonal pattern is NOT in current code

The current `events::EventBus` trait (bus.rs:129) is a single trait that doubles as the **port** and the `InMemoryBus` impl (bus.rs:209) provides the **adapter**. There is no separation between `Port` trait and `Adapter` impl per ADR-014. The pattern is **not strictly compliant** with the hexagonal L4 policy, though it's adequate for an in-process in-memory bus.

### 10.5 Test count discrepancy in documentation

- `FUNCTIONAL_REQUIREMENTS.md:5-6` claims **"8 tests (3 unit + 5 integration)"**. Actual: **16 tests** (13 in-source + 2 smoke + 1 doctest).
- `CHANGELOG.md:13` claims **"4 new tests"** for wave-2. Actual: **6 in `src/lib.rs` tests** (4 wave-2 + 2 helper).
- `STATUS.md` (last updated 2026-04-27) is **stale** ("GitHub Actions billing-blocked org-wide" — outdated; current `.github/workflows/` has 5 active workflows).

These documentation inaccuracies are **non-blocking** but should be fixed if the crate is revived (it won't be — archive is 2026-06-25).

### 10.6 `wip/` branches are pre-push snapshots, not active work

The 3 local `wip/*` branches are not work-in-progress; they are **stashed-or-pushed snapshots** of state at various points. Their tip SHAs:
- `wip/2026-06-17-phenotype-bus-pre-push-snapshot` = `4a739db` (the "dirty state" auto-save commit)
- `wip/2026-06-17-cleanup-phenotype-bus-stash-1` = `e68fc9c` (commit on `ci/add-push-pr-workflow` from 2026-05-06)
- `wip/2026-06-17-phenotype-bus-stash-1` = `e68fc9c` (DUPLICATE of the above)

Two branches share the same SHA `e68fc9c`. They are **dead weight** and should be deleted as part of pre-archive hygiene.

### 10.7 `STALE_BRANCHES.md` is partially-stale

The 2026-05-25 audit (`STALE_BRANCHES.md`) recommends 7 branches for deletion and 3 for review/merge. **None of these have been actioned** in the intervening ~4 weeks. The audit is dated 2026-05-25; HEAD is 2026-06-20. Newer branches (`chore/l7-105-...`, `chore/cliff-adopt-2026-06-11`, `chore/editorconfig-align`, etc.) are not in the audit.

### 10.8 No `pheno-events` references in source

Despite the README and lib.rs doc-comment claiming migration to `pheno_events`, the source has **no `pheno-events` dependency** in `Cargo.toml`. The crate is self-contained — `phenotype-bus` is a standalone federation stub, not a thin shim around `pheno-events`. The "shim" claim in `README.md:44` ("The crate is now a thin shim around `pheno_events::bus`") is **inaccurate** — the source has zero `pheno-events` imports.

### 10.9 Federation status per ADR-035B

ADR-035B (event-bus substrate consolidation) proposes a polyglot merge of `pheno-events` / `phenotype-bus` / `phenotype-hub`. The current state is:
- `phenotype-bus`: Wave-2 lifted to `phenoEvents` (PR #9); local copy retained for downstream consumers who haven't migrated
- `phenoEvents`: not present locally in this monorepo (sparse-checkout cone)
- `phenotype-hub`: not present locally

The current crate is **a deprecated federation holdout** scheduled for archive. Its only remaining role is "throttle downstream consumers toward `pheno-events`".

### 10.10 `Cargo.toml` MSRV conflict

- `[workspace.package] rust-version = "1.75"` (Cargo.toml:3)
- `clippy.toml:1 msrv = "1.85"`
- `rust-toolchain.toml` channel = `"stable"` (no specific version)
- `cargo` resolved version is `1.95.0` (system)

The `rust-toolchain.toml` doesn't pin a version, so any stable toolchain ≥ 1.85 satisfies the clippy MSRV. The `Cargo.toml` `rust-version = "1.75"` is published MSRV for downstream consumers. The two MSRVs disagree by a major version (`1.75` vs `1.85`) — **possible inconsistency** flagged for future audits (not blocking for archive).

### 10.11 `target/` is present but `worklogs/` is empty

`ls -la` shows `target/` (256 bytes dir size shown; actually populated by cargo test run) and `worklogs/` (4 stub files: `ARCHITECTURE.md`, `GOVERNANCE.md`, `README.md`, `RESEARCH.md` — all under 200 bytes, all just index stubs).

`worklogs/` was bootstrapped by `26a0878` (2026-04-25) "docs(worklog): bootstrap worklog scaffolding (org-wide gap closure)" but **never used** — no entries were added to the index files. The scaffolding is **dead weight**.

### 10.12 108 reachable commits but 84 from HEAD log

`git log --oneline | wc -l` = 84 (commits reachable from HEAD via first-parent walk).
`git rev-list --all --count` = 108 (commits reachable from ANY ref, including remotes and reflog).

**24 extra commits** are reachable only from non-HEAD refs (e.g. `origin/wip/devclone-rescue-phenotype-bus-20260601`, `origin/chore/deny-toml-wildcards-deny`, dangling commits from fsck output).

**30+ dangling commits** per `git fsck --no-reflogs --full` output. These are unreferenced git objects that will be garbage-collected by `git gc` (typically 90 days after they become unreferenced).

### 10.13 Conventional Commits compliance

Per commit-message convention (AGENTS.md): Conventional Commits with `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:` scopes.

**Sample distribution** (84 HEAD-log commits):
| Prefix | Count | Sample |
|---|---|---|
| `chore:` | ~35 | `chore: add .gitignore`, `chore(gitignore): adopt shared rust template` |
| `ci:` | ~12 | `ci: add CodeQL Rust analysis`, `ci(codeql): add Rust CodeQL analysis workflow` |
| `docs:` | ~10 | `docs(readme): add work-state header`, `docs(readme): add standard badge header` |
| `fix:` | ~7 | `fix: subscriber_count() always returned 0`, `fix(ci): add Unicode-3.0 license to cargo-deny allowlist` |
| `feat:` | ~5 | `feat(phenotype-bus): T63 hexagonal Transport port`, `feat(phenotype-bus): publish-ready lib` |
| `test:` | ~3 | `test: add edge-case tests`, `test(integration): cross-collection bus flow`, `test(smoke): add smoke test scaffolding` |
| `style:` | 1 | `style: format Rust sources` |
| `init:` | 1 | `init: phenotype-bus micro-repo (155 LOC, pub/sub event bus)` |
| `Merge:` | 1 | `Merge pull request #15 from KooshaPari/ci/add-cargo-audit-2026-04-27-batch4` |
| `WIP on ...:` | 1 | `WIP on ci/add-push-pr-workflow` |
| `wip:` | 1 | `wip: save dirty state [auto]` |
| `[codex] ...:` | 1 | `[codex] simplify + tighten phenotype-bus` |
| `index on ...:` | 1 | `index on ci/add-push-pr-workflow` |

Compliance is reasonable. Most commits use `chore:` / `ci:` / `docs:` for hygiene work, `feat:` / `fix:` for functional changes.

### 10.14 Total LoC budget

| Category | LoC | % of total |
|---|---|---|
| Source (`src/`) | 978 | 24.9% |
| Tests (`tests/` + in-source `#[cfg(test)]`) | ~16 + ~240 | ~6.5% |
| Docs (`docs/` + `README.md` + `CHANGELOG.md` + governance) | 661 | 16.8% |
| CI (`.github/`) | 174 | 4.4% |
| Build/config (Cargo, deny, clippy, rustfmt, rust-toolchain) | 1,042 | 26.5% |
| Other (FUNDING, CODEOWNERS, .editorconfig, .gitignore, scripts) | 728 | 18.5% |
| **TOTAL** | **3,927** | **100%** |

**Approximately 25% of the working tree is documentation/governance**, ~25% is build/config infrastructure, **~25% is actual source code**, and ~7% is tests. The ratio is **typical of a hygiene-heavy repo** where each commit adds governance/quality gates incrementally.

### 10.15 Tag/release state

**No `git tag` exists.** The crate is at version `0.1.0` (`Cargo.toml:7`) but has never been formally released to crates.io. The cliff.toml `tag_pattern = "v[0-9]*"` config is **configured but unused**. This is consistent with the deprecation stance — there's no value in cutting a release of a deprecated crate.

---

**END OF PHASE 1A SOURCE INVENTORY**

**Summary:** `phenotype-bus` is a deprecated Rust crate (978 LoC src, 16 LoC tests/, 0 examples) at version 0.1.0 with 13 in-source unit tests + 2 smoke tests + 1 doctest (all passing). Library-only, no binary, no feature flags. 84 commits reachable from HEAD, 108 from all refs. 15 local branches + 19 remote branches. Clean clippy, clean cargo test. Current HEAD `073e125` on `chore/l7-105-phenotype-bus-pre-archive-cleanup-2026-06-18` represents the post-L7-105 pre-archive cleanup state with 2 unpushed orchestrator commits. No submodules. No tags. No stashes. The crate is scheduled for archive on 2026-06-25 (5 days after this inventory) and deletion on 2026-09-23 (90-day retention). Wave-2 (`events::{Event, EventBus, InMemoryBus, Ack, RetryPolicy, IdempotentHandler, HandlerError, PublishError, Subscription}`) was lifted to `KooshaPari/phenoEvents` (PR #9); Wave-1 + hexagonal `ports/` work was deleted by L7-105. No `pheno-events` dependency in Cargo.toml despite README claim of being a "thin shim".
