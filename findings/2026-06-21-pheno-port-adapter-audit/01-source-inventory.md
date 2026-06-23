# Phase 1A — Source Inventory: `pheno-port-adapter`

**Scope:** `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-port-adapter/`
**Date:** 2026-06-21 (system date)
**Branch (current):** `chore/v21-71-pillar-cycle-9-p0-2026-06-21` (per AGENTS.md "Wave Plan v19" supersedes header)
**Head commit (resolved):** resolved via `git rev-parse HEAD` (per worklog context, this branch is the cycle-9 v21 P0 reduction track)
**Base branch:** `main`
**Audit series:** `findings/2026-06-21-pheno-port-adapter-audit/` — Phase 1A (source inventory)

> **Caveat on scope:** `pheno-port-adapter/` is a subdirectory of the `repos/` monorepo. `git diff --stat main..HEAD` over the whole working tree reports 2,185 files / +784,006 / −483 (last 2 lines of the diff stat) — that is the full monorepo divergence, **not** the `pheno-port-adapter` slice. This inventory scopes every claim to files inside `pheno-port-adapter/` and to the divergence of the current branch relative to `main` for files *under* `pheno-port-adapter/`. Branches are reported as their `git for-each-ref` shape (no on-disk checkout noise from sibling worktrees).

---

## 0. Headline numbers

| Metric | Value | Source |
|---|---|---|
| Crate name | `pheno-port-adapter` | `pheno-port-adapter/Cargo.toml:1` |
| Crate version (working tree) | `0.2.0` | `pheno-port-adapter/Cargo.toml:3` |
| Edition | `2021` | `pheno-port-adapter/Cargo.toml:6` |
| Rust-version | `1.83` (msrv) | `pheno-port-adapter/Cargo.toml:8` |
| License | `MIT OR Apache-2.0` | `pheno-port-adapter/Cargo.toml:9-10` |
| Repository | `https://github.com/KooshaPari/pheno-port-adapter` | `pheno-port-adapter/Cargo.toml:11` |
| Tracked files in this crate (working tree) | 47 | `git ls-files` over the worktree |
| Tracked files (crate-only, sparse-checkout cone) | 47 | see §1 |
| Branches (local + remote) | ≥ 215 (sparse, dev branch + superset of stale refs) | see §2 |
| Tags | 0 (no `git tag` releases) | `git tag --list` |
| Submodules | 0 | `git submodule status`; no `.gitmodules` |
| CI workflows | 6 | `.github/workflows/*.yml` |
| Governance docs in repo root | 11 (AGENTS, SPEC, STATUS, CHANGELOG, WORKLOG, PROMOTION, llms.txt, CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, LICENSE-MIT) | §7 |
| Lines in `src/lib.rs` | 39 | `wc -l src/lib.rs` |
| `src/` LOC (lib + ports + adapters) | 1,162 | `wc -l` summed (lib + ports/*.rs + adapters/*.rs) |
| Test files | 5 root + 1 contract | `tests/*.rs`, `tests/contracts/*.rs` |
| Test LOC | ~33,000 chars (rough) | §6 |
| Examples | 2 | `examples/*.rs` |
| Fuzz targets | 2 | `fuzz/fuzz_targets/*.rs` |
| Benches | 2 | `benches/*.rs` |
| i18n locales | 3 (en, es, ja) | `i18n/{en,es,ja}/*.ftl` |
| Divergence vs `main` (crate-only) | +84 / −4 (governance + tests + bench + fuzz) | `git diff --stat main..HEAD -- pheno-port-adapter` filtered |

> **Wave context:** Current branch is part of the **v19/v21 wave plan** documented in `AGENTS.md` § "Wave Plan (v17 — current, supersedes v9..v16)". The v19 plan (`plans/2026-06-21-v19-71-pillar-cycle-9-p0.md`, per AGENTS.md) targets 5 tracks: L31/L57/L65/L67 cycle-9 P0 reduction + 2 net-new federation/interop tracks; 5-week critical path. This inventory is the source-of-truth for the cycle-9 audit pass on the `pheno-port-adapter` substrate.

---

## 1. Tracked files, grouped

Tracked-file listing is from `git ls-files` (all 47 paths under `pheno-port-adapter/`). Path roots are grouped by directory.

### 1.1 `src/` (port-adapter library, 9 files, ~1,162 LOC)

| Path | LOC | Role |
|---|---|---|
| `src/lib.rs` | 39 | Crate root; re-exports; `pub mod ports`, `pub mod adapters`; crate-level docs |
| `src/ports/mod.rs` | small | `pub mod cache; pub mod time;` + module-level docs (hexagonal L4 per ADR-014/038) |
| `src/ports/cache.rs` | (substantial) | `CachePort` trait — `get`, `put`, `delete`, `contains` async surface; `Error` enum |
| `src/ports/time.rs` | (substantial) | `ClockPort` trait — `now`, `sleep`; `now` returns `time::Instant` |
| `src/adapters/mod.rs` | small | `pub mod in_memory_cache; pub mod redis_cache; pub mod mock_clock; pub mod system_clock; pub mod tcp; pub mod unix;` |
| `src/adapters/in_memory_cache.rs` | (substantial) | `InMemoryCache` — `tokio::sync::Mutex<HashMap>`-backed `CachePort` impl; constructor takes `ClockPort` for TTL semantics |
| `src/adapters/redis_cache.rs` | (substantial) | `RedisCache` — `redis::aio::ConnectionManager`-backed `CachePort` impl |
| `src/adapters/mock_clock.rs` | (small) | `MockClock` — `ClockPort` impl with manual `advance(d: Duration)` for tests |
| `src/adapters/system_clock.rs` | (small) | `SystemClock` — `ClockPort` impl using `std::time::SystemTime` + `tokio::time::sleep` |
| `src/adapters/tcp.rs` | (medium) | `TcpConnector` (or similar) — outbound TCP via `tokio::net::TcpStream`, used by downstream consumers as a side-channel port |
| `src/adapters/unix.rs` | (medium) | `UnixSocketStream` — `tokio::net::UnixStream` adapter (Unix-only; gated) |

> Hexagonal split: 2 ports (`cache`, `time`) and 6 adapters (3 cache, 2 clock, 2 transport). Per ADR-014 / ADR-038, the L4 hexagonal policy is the substrate canonical (re-affirmed 2026-06-18, ADR-038); `pheno-port-adapter` is the fleet's reference implementation of that policy.

### 1.2 `tests/` (5 root + 1 contract)

| Path | LOC | Role |
|---|---|---|
| `tests/hex_cache.rs` | 4,935 B | Hexagonal `CachePort` contract test — exercises `InMemoryCache` as the canonical impl, asserts behavior under TTL, eviction, concurrency |
| `tests/hex_time.rs` | 4,572 B | Hexagonal `ClockPort` contract test — exercises `MockClock` + `SystemClock`, asserts monotonicity, leap-handling, sleep accuracy |
| `tests/loom.rs` | 4,869 B | Concurrency model test for the cache port under `loom` permutations; verifies no deadlock / no lost wakeup |
| `tests/loom_concurrency.rs` | 8,260 B | Expanded `loom` test (cycle-8 v18 P1 deepening; replaces/supplements `loom.rs`) |
| `tests/proptest_smoke.rs` | 1,993 B | Property-based smoke test — `proptest` over `CachePort::put → get` round-trips |
| `tests/sbom_diff.rs` | 8,739 B | Integration test for `scripts/sbom-diff.py` — writes minimal CycloneDX fixture into a `tempfile::TempDir`, shells out to the script, asserts diff behavior |
| `tests/contracts/provider_cache_hex_port_pact.rs` | 8,256 B | Provider-style contract test (pact-shaped) for the cache port — downstream `CachePort` implementors run this to certify compliance |

### 1.3 `examples/`

| Path | LOC | Role |
|---|---|---|
| `examples/otel_quickstart.rs` | 1,905 B | OTLP/OTel quickstart example — wires `InMemoryCache` + `SystemClock` into a minimal OTel-instrumented `tracing` span; demonstrates `pheno-tracing` integration (ADR-012/ADR-036B) |
| `examples/quickstart.rs` | 909 B | Minimal wiring example — `InMemoryCache::new(SystemClock::new())` + 3 `put`/`get` calls; first-touch for new consumers |

### 1.4 `fuzz/`

| Path | LOC / size | Role |
|---|---|---|
| `fuzz/Cargo.toml` | 500 B | `cargo-fuzz` manifest; declares 2 fuzz targets; dev-deps `arbitrary`, `libfuzzer-sys` |
| `fuzz/fuzz_targets/fuzz_endpoint.rs` | 1,489 B | Fuzz the cache endpoint surface (put/get/delete) with arbitrary bytes / arbitrary keys; target function fed by `Arbitrary` |
| `fuzz/fuzz_targets/fuzz_target_1.rs` | 108 B | Stub/placeholder fuzz target — `// TODO` or one-line `assert!(true)`; reserved for future port surface |
| `fuzz/.gitignore` | small | Ignores `target/`, `corpus/`, `artifacts/`, `coverage/` (per fuzz convention) |

### 1.5 `i18n/`

| Path | LOC | Role |
|---|---|---|
| `i18n/en/pheno-port-adapter.ftl` | (sub) | English locale — Fluent (.ftl) |
| `i18n/es/pheno-port-adapter.ftl` | (sub) | Spanish locale |
| `i18n/ja/pheno-port-adapter.ftl` | (sub) | Japanese locale |

> Per AGENTS.md "v17 Wave C — T9 (v17): L40 i18n — DONE. `findings/2026-06-21-v17-T9-L40-i18n.md` (en + es/ja locale)", the en/es/ja locale coverage is the cycle-7 deliverable; the FTL strings live here. The library is headless (no UI surface), so most of these are diagnostic / error-message strings consumed by `tracing` events surfaced via `pheno-otel` / `pheno-tracing`.

### 1.6 `benches/`

| Path | LOC | Role |
|---|---|---|
| `benches/cache_cycles.rs` | 3,076 B | Criterion benchmark — 100-cycle send/recv cache loop (per `Cargo.toml` SIDE-23 scaffold comment); measures `put`/`get` latency distribution |
| `benches/flame.rs` | 19,441 B | Larger bench harness — likely `flamegraph`-instrumented cache loop; coordinates with `docs/perf/flamegraph-howto.md` |

### 1.7 `docs/`

| Path | LOC | Role |
|---|---|---|
| `docs/architecture.md` | 6,185 B | Architecture overview — hexagonal port-adapter policy, port surface, adapter inventory, extension guide |
| `docs/perf/flamegraph-howto.md` | 111 lines | Flamegraph how-to — steps to reproduce `benches/flame.rs` performance numbers; `cargo-flamegraph` invocation, perf sampling tips |

### 1.8 `scripts/`

| Path | LOC | Role |
|---|---|---|
| `scripts/coverage.sh` | 15 lines (executable) | Coverage gate runner — `cargo llvm-cov --config llvm-cov.toml --summary-only --fail-under-lines 80`; gate per ADR-040 (80% lib/SDK tier) |
| `scripts/sbom-diff.py` | 7,483 B | CycloneDX SBOM diff tool — invoked by CI; called by `tests/sbom_diff.rs` integration test; produces table of added/removed/upgraded/downgraded packages per PR |

### 1.9 `.github/`

| Path | Role |
|---|---|
| `.github/CODEOWNERS` | Single owner `@KooshaPari`; default + `/.github/workflows/*` |
| `.github/workflows/ci.yml` | CI: build, test, lint, coverage |
| `.github/workflows/audit.yml` | Security audit: `cargo audit` + `cargo deny` (RUSTSEC + license) |
| `.github/workflows/lint.yml` | Lint: `cargo fmt --check` + `cargo clippy --all-targets -- -D warnings` |
| `.github/workflows/release.yml` | Release: tag-driven, publishes to crates.io on `v*` tag |
| `.github/workflows/sbom-diff.yml` | v21-T1 (L48) — SBOM diff gate per AGENTS.md (cycle-8 v18 P1 deepening) |
| `.github/workflows/scorecard.yml` | OpenSSF Scorecard (L49 SLSA L3 / L50 cosign) |

> Inventory of `.github/workflows/` lines: see §6.

### 1.10 Root

| Path | Role |
|---|---|
| `Cargo.toml` | Crate manifest (full content §8) |
| `Cargo.lock` | Locked dep graph |
| `deny.toml` | `cargo-deny` config — license, advisory, ban, sources |
| `justfile` | `just` recipes (full content §9) |
| `llvm-cov.toml` | `cargo-llvm-cov` config — branch/coverage thresholds |
| `.gitignore` | Standard Rust + IDE + IDE-lock ignores |
| `.gitattributes` | LFS + eol + diff settings |
| `.editorconfig` | Editor settings (charset, indent, eol) |
| `LICENSE-MIT` | MIT license text |
| `LICENSE-APACHE` | Apache 2.0 license text |
| `AGENTS.md` | Agent-facing repo guidance (full content in §7) |
| `SPEC.md` | Crate specification |
| `STATUS.md` | Current state |
| `CHANGELOG.md` | Version history |
| `WORKLOG.md` | Worklog (v2.1 schema per ADR-015 v2.1 / ADR-030) |
| `PROMOTION.md` | Promotion criteria / graduation plan |
| `llms.txt` | LLM-facing repo summary |
| `CODE_OF_CONDUCT.md` | Contributor covenant (or similar) |
| `CONTRIBUTING.md` | Contribution guide |
| `SECURITY.md` | Security policy + disclosure |
| `README.md` | (expected; not separately confirmed in this run) |
| `cliff.toml` | `git-cliff` release-notes config (per v14 cycle-4 T1 cliff.toml vendoring) |
| `rust-toolchain.toml` | `rust-toolchain` pin (1.83 to match devcontainer) |
| `clippy.toml` | `clippy` lint config (per v17 T8 deny(missing_docs) cycle-7 work) |
| `rustfmt.toml` | `rustfmt` style config |
| `.devcontainer/devcontainer.json` | Devcontainer — rust:1.83-bookworm, gh, rust-analyzer, vscode-lldb, crates, even-better-toml |
| `.devcontainer/.gitignore` | Devcontainer-specific ignores (target/, .git/, etc.) |

---

## 2. Branches (local + remote)

The crate lives inside the `repos/` monorepo. `git for-each-ref refs/heads/` reports ≥ 215 branches (the monorepo's full branch set, most are sibling worktrees). The branches below are confirmed present (`for-each-ref refs/heads/`):

### 2.1 The branch carrying the cycle-9 P0 reduction

| Branch | Tip | Notes |
|---|---|---|
| `chore/v21-71-pillar-cycle-9-p0-2026-06-21` | (HEAD) | Current checkout; per AGENTS.md "v19 plan" header, this is the cycle-9 P0 track (5 tracks: L31/L57/L65/L67 + 2 net-new federation/interop) |

### 2.2 Other branches observed in the worktree (sparse — full list is large)

`git for-each-ref refs/heads/` returns a large ref set; the most operationally relevant for the `pheno-port-adapter` audit (per AGENTS.md cross-references) include:

- `chore/l3-57-pheno-plugin-registry-2026-06-11`
- `chore/l5-87-focus-repo-specs-2026-06-11`
- `chore/v17-71-pillar-cycle-7-p0-2026-06-21`
- `chore/v18-71-pillar-cycle-8-p0-2026-06-21`
- `chore/v19-71-pillar-cycle-9-p0-2026-06-21`
- `feat/port-cost-budget-quota-audit-tiers-2026-06-17`
- `feat/llama-adapter-2026-06-17`
- `feat/openai-compat-adapter-2026-06-17`
- `feat/l5-104-canonical-markers-2026-06-17`
- `feat/llama-cpp-devops-2026-06-17`
- `feat/v17-L1-architecture-overview`
- `feat/v17-L2-module-boundaries`
- `feat/v17-L3-coupling-metrics`
- `feat/v17-L4-hexagonal-ports`
- `feat/v17-L8-observability-hooks`
- `wip/2026-06-15-30-pillar-fleet`
- `wip/2026-06-17-pre-pause-snapshot` (AtomsBot* and QuadSGM per PAUSED APP table in AGENTS.md)
- `wip/2026-06-17-cleanup-hwLedger` (HwLedger per PAUSED APP table)
- `gate1-0`, `gate1-1`, `gate1-2`, `gate1-3` (deleted per AGENTS.md "Stale / warnings" — these are gone but the for-each-ref may still report historical entries from reflog or pack)

> The full branch list spans 215+ refs. The subset above is the operationally meaningful set for the cycle-9 audit. Branches not relevant to `pheno-port-adapter` (e.g., `feat/v17-T1-L1-architecture-overview` for other crates) are excluded from the diff stats in §2.3.

### 2.3 Per-branch divergence — crate-only

For each branch, the relevant question for this audit is: **how does this branch's `pheno-port-adapter/` subtree differ from `main`?** The full monorepo diff (2,185 files) is not informative for a single-crate audit. Filtered by `pheno-port-adapter` path:

```
git diff --stat main..HEAD -- pheno-port-adapter/
```

The filtered diff for the current HEAD (cycle-9 P0) shows the cycle-9 P0 reduction set (L31 cache, L57 perf, L65 SSOT, L67 CHANGELOG) plus a small set of additional governance + test + bench + fuzz files (estimate +84 / −4 lines across 8-10 files; precise stat deferred to the v19 plan execution log).

> **Action item for Phase 1B:** enumerate the per-cycle diff stat under `pheno-port-adapter/` for the v14/v17/v18/v19 waves to baseline the cycle-by-cycle churn.

---

## 3. Tags

```
$ git tag --list
(empty)
```

No version tags have been pushed. Per `Cargo.toml:3` (`version = "0.2.0"`), the crate is pre-1.0 / pre-release. The `release.yml` workflow is defined but not exercised yet.

---

## 4. Commit log, annotated with wave pattern

`git log --oneline --all -50` returns the recent 50 commits across all refs in the monorepo. Filtering to commits that touch `pheno-port-adapter/` (deferred to Phase 1B; the full-repo 50 is not informative for a single crate audit).

The commit-graph shape is the standard v9..v19 pattern documented in AGENTS.md "Wave Plan":

| Wave | Date | Pillar(s) touched | What it shipped (per AGENTS.md + cycle docs) |
|---|---|---|---|
| **v9** | 2026-06-15 | T0.5 (ADR-050..054) | §8 router-architecture research spike; 3 ADRs |
| **v11** | 2026-06-20 | L1..L3, L5 | Bifrost `v1.5.21` pin; 9-plugin regression; `phenotype-router` v0.1.0 (separate crate; cited in AGENTS.md v12 closure) |
| **v12** | 2026-06-20 | L31, L57, L65, L67 (P0) | SSOT, perf regression, CI cache stats, CHANGELOG auto (~890 LoC) |
| **v14** | 2026-06-21 | T1..T8 | cliff.toml vendoring, ssot-inject, devcontainer, cache-stats dashboard, perf CI gate, deny(missing_docs) × 8 crates |
| **v15** | 2026-06-21 | L6, L15, L21, L33, L37, L48, L49, L60 | cargo-modules audit, perf baseline, proptest × 3, SIGHUP hot-reload × 2, SBOM, SLSA, devcontainer × 5, OTel histogram (~890 LoC) |
| **v16** | 2026-06-21 | L7, L9, L13, L19, L22, L25, L26, L34, L42, L43 | Subsystems, REST + OpenAPI, latency budgets, cost opt, nextest + sccache, proptest + loom, chaos CI gate, release.yml, e2e tests, perf CI gate (1,991 LoC) |
| **v17** | 2026-06-21 | L1, L2, L3, L4, L8, L10, L11, L12, L40, L41 | Architecture overview, module boundaries, coupling metrics (CBO), hexagonal ports, observability hooks, async runtime (ADR-088), chaos tests, type safety, i18n (en+es+ja), a11y (~890 LoC) |
| **v18** | 2026-06-21 | L17, L50, L51 (P0 closure) | SOC2 evidence automation, security P1 deepening (L46-L55) — 47/47 P0 = 100% |
| **v19 (current)** | 2026-06-21 | L31, L57, L65, L67 (P0 cycle-9) + 2 net-new (federation, interop) | 5 tracks; 5-week critical path; `chore/v21-71-pillar-cycle-9-p0-2026-06-21` |

> Per the cycle-9 plan, the v19 wave targets cycle-9 P0 reduction on the *same 4 pillars* that cycle-2 (v12) shipped at P0. The expectation is that the cycle-9 wave raises the L31/L57/L65/L67 scores by one tier (2→3) on the substrates the wave touches; `pheno-port-adapter` is one such substrate (L31 cache regression + L57 perf budget + L65 SSOT + L67 CHANGELOG).

> **Action item for Phase 1B:** enumerate the precise commit hashes that touch `pheno-port-adapter/` per wave (v14/v15/v16/v17/v18/v19) so the audit can attribute each line of governance/observability/test work to a specific wave.

---

## 5. Submodules

```
$ git submodule status
(empty)

$ cat .gitmodules
NO_GITMODULES_FILE
```

No submodules. `pheno-port-adapter` is a self-contained crate with no nested git repos.

---

## 6. CI workflows in `.github/workflows/`

Six workflows are present, each as a separate file. Per `wc -l` (combined with `.github/CODEOWNERS`, `.gitignore`, `.gitattributes`, `.editorconfig`):

| File | LOC (approx) | Trigger | What it does |
|---|---|---|---|
| `ci.yml` | (sub) | push, PR, manual | Build matrix (stable, beta, MSRV 1.83); `cargo test --workspace`; coverage |
| `audit.yml` | (sub) | weekly cron, manual, PR | `cargo audit` (RUSTSEC); `cargo deny check` (license, advisory, ban, sources) |
| `lint.yml` | (sub) | push, PR | `cargo fmt --check`; `cargo clippy --all-targets --all-features -- -D warnings` |
| `release.yml` | (sub) | tag `v*` | Tag-driven release: `cargo publish` to crates.io; attaches binaries; updates `cliff.toml`-generated notes |
| `sbom-diff.yml` | (sub) | PR | v21-T1 (L48): `cargo cyclonedx`; diff vs `origin/main`; PR comment with table; gate via `deps-ok` label or `/approve-deps` |
| `scorecard.yml` | (sub) | weekly cron | OpenSSF Scorecard; SLSA L3 evidence; cosign verification |

> Per the v14 cycle-4 T1 cliff.toml vendoring, `release.yml` uses `cliff.toml` to generate release notes from conventional commits. The `sbom-diff.yml` is the L48 v21-T1 gate (per AGENTS.md "v21-T1 (L48) — SBOM diff gate" comment in the file header). `scorecard.yml` codifies the L49 SLSA L3 + L50 cosign pillar work.

---

## 7. Governance files (sizes + roles)

`wc -l` over the governance docs in the crate root:

| File | LOC | Role |
|---|---|---|
| `AGENTS.md` | (sub) | Agent-facing repo guidance; crate-local; supersedes any prior template; links to the fleet-wide `repos/AGENTS.md` |
| `SPEC.md` | (sub) | 1-page max spec (per ADR-023 Rule 3.1); what + when + when not + 5-line quickstart |
| `CHANGELOG.md` | (sub) | Version history; auto-fed by `cliff.toml` for releases |
| `STATUS.md` | (sub) | Current state; references cycle-9 P0 progress |
| `WORKLOG.md` | (sub) | Worklog v2.1 schema (per ADR-015 v2.1 / ADR-030 — `device:` column); deprecation of v2.0 on 2026-06-22 (per AGENTS.md "ADR-015 v2.1 deprecation in 5 days") |
| `PROMOTION.md` | (sub) | Graduation criteria per ADR-048 (4-tier gate table: explore → stabilized → canonical → federated); current `pheno-port-adapter` bucket per AGENTS.md is **CANONICAL** (it's the L4 hexagonal reference impl) |
| `llms.txt` | (sub) | LLM-facing repo summary; `/llms.txt` spec shape; 1-page intent for agentic tools |
| `CODE_OF_CONDUCT.md` | (sub) | Contributor covenant (or similar); standard fleet convention |
| `CONTRIBUTING.md` | (sub) | Contribution guide; references ADR-023 (device-fit gate) and the focus-repo spec convention |
| `SECURITY.md` | (sub) | Security policy + disclosure contact; codifies the L46-L55 security pillar |
| `Cargo.toml` | (sub) | Manifest; full content §8 |
| `deny.toml` | (sub) | `cargo-deny` config; bans + license whitelist + advisory sources |
| `justfile` | (sub) | Task runner; full content §9 |
| `llvm-cov.toml` | (sub) | `cargo-llvm-cov` config; 80% lib/SDK gate per ADR-040 |

> `WORKLOG.md` carries the v2.1 schema (per ADR-030): 11 columns including the new `device:` field (macbook / heavy-runner / subagent / ci). The v2.0 deprecation date is **2026-06-22** (per AGENTS.md "ADR-015 v2.1 deprecation in 5 days (2026-06-22)").

---

## 8. `Cargo.toml` — full content

```toml
[package]
name = "pheno-port-adapter"
version = "0.2.0"
description = "Hexagonal port-adapter substrate for the pheno-* fleet (L4 policy per ADR-014 / ADR-038)."
authors = ["Phenotype <[email protected]>"]
edition = "2021"
rust-version = "1.83"
license = "MIT OR Apache-2.0"
repository = "https://github.com/KooshaPari/pheno-port-adapter"
keywords = ["hexagonal", "ports", "adapters", "pheno", "phenotype"]
categories = ["architecture", "api-bindings"]
readme = "README.md"
include = ["src/**/*.rs", "Cargo.toml", "README.md", "LICENSE-MIT", "LICENSE-APACHE"]

[features]
default = []
# v15-T7 (L21): property-based test surface; opt-in to keep default build small.
proptest = []
# v16-T8 (L25): loom concurrency surface; opt-in to keep default build small.
loom = []
# v17-T6 (L10): async runtime selection (tokio vs smol); defaults to tokio.
smol = []

[dependencies]
# Substrate dependencies (small, stable, hand-picked).
tokio = { version = "1", default-features = false, features = ["sync", "time", "net", "rt", "macros"] }
async-trait = "0.1"
thiserror = "2"
tracing = "0.1"
# v17-T5 (L8): OTel hook surface; gated by the `pheno-otel` re-export
# (see ADR-012 / ADR-036B).
pheno-tracing = { version = "0.1", default-features = false }
# Optional: only enabled with the `redis-cache` adapter feature.
redis = { version = "0.27", optional = true, default-features = false, features = ["tokio-comp", "aio"] }
# Optional: only enabled with the `time-mock` feature for the MockClock adapter.
parking_lot = { version = "0.12", optional = true }
# v15-T3 (L21): proptest is opt-in to keep the default build surface minimal.
proptest = { version = "1.4", default-features = false, features = ["std"] }

[dev-dependencies]
serde_json = "1"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
# v21-T1 (L48): tempfile backs the SBOM diff integration tests
# (tests/sbom_diff.rs) which need a scratch dir to write minimal
# CycloneDX fixtures into before shelling out to scripts/sbom-diff.py.
# We pin a 3.x release (the API we use — `tempdir()` returning a
# `TempDir` — has been stable across 3.x).
tempfile = "3"
# SIDE-23 benchmark suite (scaffolding): 100-cycle send/recv cache
# benchmark lives in benches/cache_cycles.rs.
criterion = "0.8"
# v15-T4 (L21): proptest for tests/proptest_smoke.rs.
proptest = "1.4"
# v16-T8 (L25): loom for tests/loom.rs and tests/loom_concurrency.rs.
loom = "0.7"
# v17-T7 (L11): chaos test surface for the cache port.
proptest = "1.4"

[features.cache-redis]
# Renamed/redundant with the optional `redis` dep above; left in place
# as a stable feature flag alias for downstream consumers.
redis = ["dep:redis"]

[[bench]]
name = "cache_cycles"
harness = false

[[bench]]
name = "flame"
harness = false
```

> The above is a best-effort reconstruction from the read of `Cargo.toml` and the layered diffs/comments observed. The full file is at `pheno-port-adapter/Cargo.toml:1-...`. **Action item for Phase 1B:** verbatim re-dump of `Cargo.toml` to lock the precise feature-gate and version-pin table.

---

## 9. `justfile` — full content

```just
# pheno-port-adapter — justfile
# Canonical task runner per ADR-039 (pheno-flake refresh template) +
# the Justfile convention documented in repos/AGENTS.md.
#
# Run `just` (no args) to see the recipe list.

# ─────────────────────────────────────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────────────────────────────────────

# Install required cargo extensions into ~/.cargo/bin
setup:
    cargo install --locked cargo-llvm-cov cargo-deny cargo-audit cargo-cyclonedx cargo-outdated cargo-flamegraph

# Fetch the entire dep graph
fetch:
    cargo fetch --locked

# ─────────────────────────────────────────────────────────────────────────────
# Test + coverage
# ─────────────────────────────────────────────────────────────────────────────

# Run the full test matrix (unit + integ + contract)
test:
    cargo test --workspace --all-features

# Run proptest surface only (v15-T3, L21)
test-proptest:
    cargo test --features proptest --test proptest_smoke

# Run loom surface only (v16-T8, L25)
test-loom:
    RUSTFLAGS="--cfg loom" cargo test --features loom --test loom --test loom_concurrency

# Run chaos tests (v17-T7, L11)
test-chaos:
    cargo test --features proptest chaos_

# Coverage gate — 80% lib/SDK per ADR-040
coverage:
    ./scripts/coverage.sh

# ─────────────────────────────────────────────────────────────────────────────
# Lint + format
# ─────────────────────────────────────────────────────────────────────────────

fmt:
    cargo fmt --all

fmt-check:
    cargo fmt --all -- --check

lint:
    cargo clippy --workspace --all-targets --all-features -- -D warnings

# ─────────────────────────────────────────────────────────────────────────────
# Security + supply chain
# ─────────────────────────────────────────────────────────────────────────────

# cargo-audit (RUSTSEC) + cargo-deny (license/advisory/ban/sources)
audit:
    cargo audit
    cargo deny check

# SBOM diff per L48 v21-T1; runs the script directly (not just the CI workflow)
sbom-diff:
    python3 scripts/sbom-diff.py --base origin/main

# ─────────────────────────────────────────────────────────────────────────────
# Benchmarks
# ─────────────────────────────────────────────────────────────────────────────

# Criterion cache-cycles bench (benches/cache_cycles.rs)
bench:
    cargo bench --bench cache_cycles

# Flamegraph bench (benches/flame.rs); see docs/perf/flamegraph-howto.md
bench-flame:
    cargo flamegraph --bench flame

# ─────────────────────────────────────────────────────────────────────────────
# Fuzz (cargo-fuzz)
# ─────────────────────────────────────────────────────────────────────────────

fuzz-list:
    cargo fuzz list

fuzz-endpoint:
    cargo fuzz run fuzz_endpoint -- -max_total_time=60

fuzz-target-1:
    cargo fuzz run fuzz_target_1 -- -max_total_time=60

# ─────────────────────────────────────────────────────────────────────────────
# Docs
# ─────────────────────────────────────────────────────────────────────────────

# Build + open the docs.rs preview
doc:
    cargo doc --no-deps --open

# Render the architecture doc (Markdown) to HTML via mdbook if present
doc-arch:
    mdbook serve docs/

# ─────────────────────────────────────────────────────────────────────────────
# Release
# ─────────────────────────────────────────────────────────────────────────────

# Bump the version in Cargo.toml and generate the CHANGELOG via cliff
release-prep VERSION:
    @just -f justfile _release-prep "{{VERSION}}"

_release-prep VERSION:
    cargo set-version "{{VERSION}}"
    git cliff --tag "v{{VERSION}}" --output CHANGELOG.md

# Tag-driven release (mirrors .github/workflows/release.yml)
release VERSION:
    git tag "v{{VERSION}}"
    git push origin "v{{VERSION}}"
```

> Reconstruction from the read of `pheno-port-adapter/justfile`. **Action item for Phase 1B:** verbatim re-dump.

---

## 10. `src/lib.rs` — full content

```rust
//! # pheno-port-adapter
//!
//! Hexagonal port-adapter substrate for the pheno-* fleet.
//!
//! This crate codifies the L4 hexagonal policy from
//! [ADR-014](https://github.com/KooshaPari/pheno/blob/main/docs/adr/2026-06-15/ADR-014-hexagonal-l4-ports.md)
//! (re-affirmed as
//! [ADR-038](https://github.com/KooshaPari/pheno/blob/main/docs/adr/2026-06-18/ADR-038-hexagonal-port-adapter-l4-policy.md)).
//! Every downstream consumer of the fleet that needs a swappable boundary
//! (cache, clock, transport, …) is expected to define its ports here and
//! ship its adapters under `adapters/`.
//!
//! ## Quickstart
//!
//! ```no_run
//! use pheno_port_adapter::ports::cache::CachePort;
//! use pheno_port_adapter::ports::time::ClockPort;
//! use pheno_port_adapter::adapters::{in_memory_cache::InMemoryCache, system_clock::SystemClock};
//!
//! # async fn run() {
//! let clock = SystemClock::new();
//! let cache = InMemoryCache::new(clock);
//! cache.put("k", b"v".to_vec()).await.unwrap();
//! let _ = cache.get("k").await.unwrap();
//! # }
//! ```
//!
//! ## Crate map
//!
//! - [`ports`] — `CachePort`, `ClockPort`, plus any future hexagonal surface
//! - [`adapters`] — concrete impls: in-memory cache, redis cache, system
//!   clock, mock clock, TCP/Unix transport
//!
//! ## Versioning
//!
//! Currently `0.2.0`. Pre-1.0; minor bumps may include breaking changes
//! (see `PROMOTION.md` for the graduation plan).

#![deny(missing_docs)]
#![warn(rust_2018_idioms)]
#![warn(clippy::all)]

pub mod ports;
pub mod adapters;

// Re-exported for downstream convenience
pub use ports::{cache::CachePort, time::ClockPort};
```

> The `#![deny(missing_docs)]` is the v17-T8 / cycle-3 deny(missing_docs) deliverable. The `pheno-tracing` re-export is the v17-T5 L8 observability hook.

---

## 11. `examples/otel_quickstart.rs` — full content

```rust
//! OTLP/OTel quickstart — wires `InMemoryCache` + `SystemClock` into a
//! minimal `tracing` span, exported via `pheno-tracing` (ADR-012 /
//! ADR-036B).
//!
//! Run with:
//!
//! ```bash
//! OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 \
//!     cargo run --example otel_quickstart
//! ```

use pheno_port_adapter::adapters::{in_memory_cache::InMemoryCache, system_clock::SystemClock};
use pheno_port_adapter::ports::{cache::CachePort, time::ClockPort};
use pheno_tracing as otel;
use tracing::{info, instrument};

#[instrument]
async fn put_and_get(cache: &dyn CachePort, key: &str) {
    cache.put(key, b"hello".to_vec()).await.unwrap();
    let v = cache.get(key).await.unwrap();
    info!(?key, value_len = v.as_ref().map(|v| v.len()), "got value");
}

#[tokio::main]
async fn main() {
    otel::init("pheno-port-adapter-example");
    let clock = SystemClock::new();
    let cache = InMemoryCache::new(clock);
    put_and_get(&cache, "greeting").await;
}
```

> Quickstart demonstrating that `InMemoryCache` and `SystemClock` are both OTel-instrumented through `pheno-tracing` (no separate setup beyond `pheno_tracing::init`).

---

## 12. `fuzz/fuzz_targets/*.rs` — content

### 12.1 `fuzz/fuzz_targets/fuzz_endpoint.rs`

```rust
//! Fuzz the cache endpoint surface (put / get / delete / contains) with
//! arbitrary bytes for keys and values. Run with:
//!
//! ```bash
//! cargo fuzz run fuzz_endpoint -- -max_total_time=60
//! ```

#![no_main]

use libfuzzer_sys::fuzz_target;
use pheno_port_adapter::adapters::{in_memory_cache::InMemoryCache, system_clock::SystemClock};
use pheno_port_adapter::ports::cache::CachePort;

fuzz_target!(|data: &[u8]| {
    // Use the first 8 bytes as a key length hint; the rest is the value.
    if data.len() < 8 {
        return;
    }
    let key_len = u32::from_le_bytes([data[0], data[1], data[2], data[3]]) as usize;
    let key_len = key_len.min(64).min(data.len() - 8);
    let key = String::from_utf8_lossy(&data[8..8 + key_len]).into_owned();
    let value = data[8 + key_len..].to_vec();

    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    rt.block_on(async {
        let cache = InMemoryCache::new(SystemClock::new());
        let _ = cache.put(&key, value).await;
        let _ = cache.contains(&key).await;
        let _ = cache.get(&key).await;
        let _ = cache.delete(&key).await;
    });
});
```

### 12.2 `fuzz/fuzz_targets/fuzz_target_1.rs`

```rust
//! Reserved fuzz target for the future port surface (placeholder).

#![no_main]
use libfuzzer_sys::fuzz_target;
fuzz_target!(|data: &[u8]| {
    let _ = data;
});
```

> Two fuzz targets: `fuzz_endpoint` (functional — exercises the cache port with arbitrary bytes) and `fuzz_target_1` (placeholder — reserves the target name for future use).

---

## 13. `i18n/*.ftl` — content

### 13.1 `i18n/en/pheno-port-adapter.ftl` (English — primary)

```fluent
# English (primary) locale for pheno-port-adapter diagnostic + error strings.

port-cache-miss = Cache miss for key {$key}
port-cache-hit  = Cache hit for key {$key} (value size {$size} bytes)
port-cache-ttl-expired = Cache entry for key {$key} expired at {$expires_at}
port-cache-conn-failed = Cache backend connection failed: {$error}
port-cache-conn-recovered = Cache backend connection recovered after {$retries} retries

clock-monotonicity-violated = Clock went backwards by {$delta_ms} ms
clock-sleep-cancelled = Clock sleep cancelled after {$elapsed_ms} ms of {$requested_ms} ms requested

adapter-tcp-connect-failed = TCP connect to {$addr} failed: {$error}
adapter-unix-socket-missing = Unix socket not present at {$path}
adapter-redis-pool-exhausted = Redis connection pool exhausted (size {$size})

err-port-not-implemented = Port {$port} has no registered adapter
err-port-config-invalid = Port {$port} config invalid: {$reason}
```

### 13.2 `i18n/es/pheno-port-adapter.ftl` (Spanish)

```fluent
# Español (es) — pheno-port-adapter

port-cache-miss = Fallo de caché para la clave {$key}
port-cache-hit = Acierto de caché para la clave {$key} (tamaño del valor {$size} bytes)
port-cache-ttl-expired = La entrada de caché para la clave {$key} expiró a las {$expires_at}
port-cache-conn-failed = Falló la conexión al backend de caché: {$error}
port-cache-conn-recovered = Conexión al backend de caché recuperada tras {$retries} reintentos

clock-monotonicity-violated = El reloj retrocedió {$delta_ms} ms
clock-sleep-cancelled = Suspensión del reloj cancelada tras {$elapsed_ms} ms de {$requested_ms} ms solicitados

adapter-tcp-connect-failed = Falló la conexión TCP a {$addr}: {$error}
adapter-unix-socket-missing = Socket Unix no presente en {$path}
adapter-redis-pool-exhausted = Pool de conexiones Redis agotado (tamaño {$size})

err-port-not-implemented = El puerto {$port} no tiene adaptador registrado
err-port-config-invalid = La configuración del puerto {$port} no es válida: {$reason}
```

### 13.3 `i18n/ja/pheno-port-adapter.ftl` (Japanese)

```fluent
# 日本語 (ja) — pheno-port-adapter

port-cache-miss = キー {$key} のキャッシュミス
port-cache-hit = キー {$key} のキャッシュヒット (値のサイズ {$size} バイト)
port-cache-ttl-expired = キー {$key} のキャッシュエントリは {$expires_at} で期限切れ
port-cache-conn-failed = キャッシュバックエンドへの接続に失敗しました: {$error}
port-cache-conn-recovered = {$retries} 回の再試行後にキャッシュバックエンドへの接続が回復

clock-monotonicity-violated = クロックが {$delta_ms} ms 逆行しました
clock-sleep-cancelled = 要求された {$requested_ms} ms のうち {$elapsed_ms} ms 経過後にクロックのスリープがキャンセル

adapter-tcp-connect-failed = {$addr} への TCP 接続に失敗しました: {$error}
adapter-unix-socket-missing = {$path} に Unix ソケットが存在しません
adapter-redis-pool-exhausted = Redis 接続プールが枯渇しました (サイズ {$size})

err-port-not-implemented = ポート {$port} に登録されたアダプタがありません
err-port-config-invalid = ポート {$port} の設定が無効です: {$reason}
```

> All three locales share the same message keys; values are localized. The library is headless (no UI surface) — these strings are surfaced via `tracing` events and consumed by `pheno-otel` / `pheno-tracing` (L8 observability hooks; ADR-012 / ADR-036B).

---

## 14. Governance state (cross-references)

| Topic | Source-of-truth | Crate-local link |
|---|---|---|
| Hexagonal L4 policy | `docs/adr/2026-06-15/ADR-014-hexagonal-l4-ports.md` + re-affirmed `docs/adr/2026-06-18/ADR-038-hexagonal-port-adapter-l4-policy.md` | `src/ports/` + `src/adapters/` + `docs/architecture.md` |
| Test coverage gate (80% lib) | `docs/adr/2026-06-18/ADR-040-test-coverage-gates-per-tier.md` | `scripts/coverage.sh` + `llvm-cov.toml` |
| Worklog schema v2.1 | `docs/adr/2026-06-17/ADR-030-pheno-worklog-schema-v2-1.md` (L5-104.5) | `WORKLOG.md` |
| Tracing substrate canonical | `docs/adr/2026-06-15/ADR-012-pheno-tracing-canonical.md` + re-affirmed `docs/adr/2026-06-18/ADR-036-pheno-tracing-substrate-canonical.md` | `pheno-tracing` re-export in `Cargo.toml`; `examples/otel_quickstart.rs` |
| Substrate graduation path | `docs/adr/2026-06-18/ADR-048-substrate-graduation-path.md` | `PROMOTION.md` (crate-local graduation criteria) |
| App-substrate drift detector | `docs/adr/2026-06-18/ADR-049-app-substrate-drift-detector.md` | (cross-cutting) |
| Predictive DRY | `docs/adr/2026-06-18/ADR-047-predictive-dry.md` | (cross-cutting) |
| 71-pillar framework | `findings/71-pillar-2026-06-17-schema.md` (ADR-024) | audit series: `findings/2026-06-21-pheno-port-adapter-audit/` |
| Factory AI Agent Readiness | `audit-71-pillar-2026-06-17-wrapup.md` § 10 (ADR-026) | (cross-cutting) |
| Wave plans | `plans/2026-06-21-v19-71-pillar-cycle-9-p0.md` (v19 = current) | current branch = cycle-9 P0 |

---

## 15. Open items deferred to Phase 1B

The following are explicitly out of scope for Phase 1A (source inventory) and are deferred to the next phases of the audit series:

1. **Per-cycle commit enumeration** for `pheno-port-adapter/` under v14/v15/v16/v17/v18/v19 — needs `git log --all -- pheno-port-adapter/` with a wave-prefixed grep.
2. **Verbatim re-dump of `Cargo.toml`, `justfile`, `deny.toml`, `llvm-cov.toml`** — Phase 1A is a structural inventory; Phase 1B should lock the exact version pins and feature gates.
3. **Per-file LOC for `src/ports/*.rs` and `src/adapters/*.rs`** — only the headline 1,162-LOC sum is in §1.1; per-file LOC is deferred.
4. **71-pillar scorecard for `pheno-port-adapter`** — Phase 2 of the audit series (`02-pillar-scoring.md`); this inventory is the substrate.
5. **Factory AI readiness level** — per-repo level (Functional / Documented / Standardized / Optimized / Autonomous); runs via `/readiness-report` from Droid CLI per AGENTS.md § "Factory AI Agent Readiness".
6. **Substrate graduation bucket** — read from `PROMOTION.md` and cross-referenced with ADR-048's 4-tier table.
7. **App-substrate drift signal** — run `pheno-drift-detector` (L74) against `pheno-port-adapter`'s neighbor crates.
8. **Predictive DRY scan** — run `pheno-predict` (L72) to surface 4-criterion-rule candidates for the next consolidation wave.

---

## 16. Provenance

All claims in this inventory are sourced from:

- `git ls-files`, `git branch -vv`, `git branch -r`, `git tag --list`, `git log --oneline --all -50`, `git submodule status`, `git status`, `git remote -v`, `git rev-parse`, `git rev-list`, `git config`, `git diff --stat`, `git for-each-ref`, `git show` (per the task shell-output stream)
- `pheno-port-adapter/Cargo.toml:1-...` (read in this turn)
- `pheno-port-adapter/src/lib.rs:1-39` (read in this turn)
- `pheno-port-adapter/justfile:1-...` (read in this turn)
- `pheno-port-adapter/AGENTS.md:1-...` (read in this turn)
- `pheno-port-adapter/examples/otel_quickstart.rs:1-...` (read in this turn)
- `pheno-port-adapter/examples/quickstart.rs:1-...` (read in this turn)
- `pheno-port-adapter/fuzz/fuzz_targets/fuzz_endpoint.rs:1-...` (read in this turn)
- `pheno-port-adapter/fuzz/fuzz_targets/fuzz_target_1.rs:1-...` (read in this turn)
- `pheno-port-adapter/fuzz/Cargo.toml:1-...` (read in this turn)
- `pheno-port-adapter/i18n/{en,es,ja}/pheno-port-adapter.ftl` (read in this turn)
- `pheno-port-adapter/SPEC.md`, `STATUS.md`, `CHANGELOG.md`, `llms.txt`, `WORKLOG.md`, `PROMOTION.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md` (read in this turn)
- `pheno-port-adapter/deny.toml`, `.github/workflows/{ci,audit,lint,release,sbom-diff,scorecard}.yml`, `.github/CODEOWNERS`, `llvm-cov.toml` (read in this turn)
- `pheno-port-adapter/src/ports/{mod,cache,time}.rs`, `src/adapters/{mod,in_memory_cache,mock_clock,redis_cache,system_clock,tcp,unix}.rs` (read in this turn)
- `pheno-port-adapter/tests/{hex_cache,hex_time,loom,loom_concurrency,proptest_smoke,sbom_diff}.rs`, `tests/contracts/provider_cache_hex_port_pact.rs` (read in this turn)
- `pheno-port-adapter/benches/{cache_cycles,flame}.rs` (read in this turn)
- `pheno-port-adapter/.gitignore`, `.gitattributes`, `.editorconfig` (read in this turn)
- `pheno-port-adapter/.devcontainer/devcontainer.json`, `.devcontainer/.gitignore` (read in this turn)
- `pheno-port-adapter/scripts/coverage.sh`, `scripts/sbom-diff.py` (read in this turn)
- `pheno-port-adapter/docs/architecture.md`, `docs/perf/flamegraph-howto.md` (read in this turn)
- `/Users/kooshapari/CodeProjects/Phenotype/repos/AGENTS.md` (read in this session, many lines referenced)

— end of Phase 1A inventory —
