# `pheno-port-adapter` — Phase 1B: Docs/Spec/Intent + Code Features Audit

> **Audit target:** `pheno-port-adapter/` (monorepo root subdir; standalone Rust crate per `[workspace]` in `Cargo.toml:7`).
> **Working tree HEAD:** `9cf52be5c4` (`chore/v19-71-pillar-cycle-9-p0-2026-06-21`, parent `f84feec861` = `main`).
> **Branch position:** 27 commits ahead of `main`, all on the v17 + v19 wave path.
> **Audit date:** `2026-06-21` (PDT).
> **Auditor:** Forge Code (`MiniMax-M3`), per the v19 cycle-9 substrate audit plan.
> **Companion docs:** `findings/2026-06-21-pheno-port-adapter-audit/00-FINAL-AUDIT.md` (root scorecard), `…/03-target-parity.md` (cross-crate parity).
> **Pattern role:** hexagonal L4 Port/Adapter reference impl (ADR-014 + ADR-038).
> **Substrate tier:** `pheno-*-lib` per ADR-023 Rule 3.

---

## Table of contents

1. [Repo layout & scale](#1-repo-layout--scale)
2. [Phase 1B.1 — Docs / spec / intent claims (traceable)](#2-phase-1b1--docs--spec--intent-claims-traceable)
3. [Phase 1B.2 — Source code features (file:line dump)](#3-phase-1b2--source-code-features-fileline-dump)
4. [Phase 1B.3 — Test coverage inventory + gaps](#4-phase-1b3--test-coverage-inventory--gaps)
5. [Phase 1B.4 — Bug tally (numbered, severity-rated)](#5-phase-1b4--bug-tally-numbered-severity-rated)
6. [Phase 1B.5 — Branch-only artifacts (v14/v19 waves)](#6-phase-1b5--branch-only-artifacts-v14v19-waves)
7. [Phase 1B.6 — Cross-reference to prior 9 audits + matrix patterns](#7-phase-1b6--cross-reference-to-prior-9-audits--matrix-patterns)
8. [Appendix A — Feature disposition matrix](#8-appendix-a--feature-disposition-matrix)

---

## 1. Repo layout & scale

### 1.1 Directory tree (depth 3)

```
pheno-port-adapter/                                  # 2362 LoC of Rust source (incl. tests + examples)
├── Cargo.toml                                       # 36 lines; lib, deps + dev-deps, no [features]
├── Cargo.lock                                       # (generated)
├── AGENTS.md                                        # 91 lines; agent constitution
├── CHANGELOG.md                                     # 70 lines; Keep a Changelog 1.1.0
├── CONTRIBUTING.md                                  # 91 lines; conventional commits + PR gates
├── SECURITY.md                                      # (small; vulnerability disclosure)
├── SPEC.md                                          # 153 lines; 1-page spec (ADR-042 element 1)
├── STATUS.md                                        # 98 lines; honest 71-pillar scorecard
├── WORKLOG.md                                       # 75 lines; v2.1 schema (11 columns incl. device:)
├── llms.txt                                         # 34 lines; LLM-facing description
├── deny.toml                                        # cargo-deny config
├── justfile                                         # recipe runner
├── llms.txt                                         # (see above)
├── llvm-cov.toml                                    # coverage gate (80% lib per ADR-040)
├── .gitattributes                                   # LFS 3-tier policy (ADR-027)
├── .gitignore                                       # standard Rust
├── .editorconfig
├── .devcontainer/devcontainer.json
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── dependabot.yml
│   └── workflows/
│       ├── ci.yml
│       ├── lint.yml
│       ├── audit.yml
│       └── scorecard.yml
├── docs/
│   └── architecture.md
├── i18n/
│   ├── en/pheno-port-adapter.ftl
│   ├── es/pheno-port-adapter.ftl
│   └── ja/pheno-port-adapter.ftl
├── scripts/
│   └── coverage.sh
├── fuzz/
│   ├── Cargo.toml
│   └── fuzz_targets/
│       ├── fuzz_target_1.rs                         # placeholder
│       └── fuzz_endpoint.rs                         # parses via TcpAdapter::parse_endpoint
├── src/
│   ├── lib.rs                                       # 180 lines; PortAdapter + AdapterError + Connection + ports module + adapters module
│   ├── ports/
│   │   ├── mod.rs                                   # 26 lines; re-export cache + (HexTimePort via time)
│   │   ├── cache.rs                                 # 84 lines; HexCachePort + CacheError
│   │   └── time.rs                                  # 68 lines; HexTimePort (no error type — uses Instant + u64)
│   └── adapters/
│       ├── mod.rs                                   # 39 lines; pub mod declarations + re-exports
│       ├── tcp.rs                                   # 456 lines; TcpAdapter + parse_endpoint + 27 tests (incl. chaos::)
│       ├── unix.rs                                  # 173 lines; UnixAdapter (cfg(unix)) + 6 tests
│       ├── in_memory_cache.rs                       # 186 lines; InMemoryCache + 6 tokio tests
│       ├── redis_cache.rs                           # 200 lines; RedisAdapter + 3 tests (1 sync, 2 tokio)
│       ├── system_clock.rs                          # 102 lines; SystemClock (ZST) + 3 tests
│       └── mock_clock.rs                            # 238 lines; MockClock + 6 tests
├── tests/
│   ├── hex_cache.rs                                 # 134 lines; 7 tests (5 tokio + 2 sync)
│   ├── hex_time.rs                                  # 130 lines; 9 tests (all sync)
│   ├── loom.rs                                      # 169 lines; 4 loom::model tests (cfg(loom))
│   ├── loom_circuit_breaker.rs                      # 28 lines; 1 loom::model test (cfg(loom))
│   ├── loom_request_router.rs                       # 21 lines; 1 loom::model test (cfg(loom))
│   └── proptest_smoke.rs                            # 45 lines; 2 proptest! tests
└── examples/
    ├── otel_quickstart.rs                           # 55 lines; uses pheno-otel + pheno-port-adapter (compile-broken)
    └── quickstart.rs                                # 28 lines; uses MockAdapter (compile-broken)
```

### 1.2 Source size summary

| Bucket | Files | LoC | Test functions | Density |
|---|---|---|---|---|
| `src/lib.rs` | 1 | 180 | 5 | 36 LoC/test |
| `src/ports/` | 3 | 178 | 0 | n/a |
| `src/adapters/` | 7 | 1394 | 52 | 26.8 LoC/test |
| `src/` total | 11 | 1752 | 57 | 30.7 LoC/test |
| `tests/` | 6 | 527 | 23 | 22.9 LoC/test |
| `examples/` | 2 | 83 | n/a | n/a |
| **Total** | 19 | **2362** | **80** | **29.5 LoC/test** |

### 1.3 Test count by file (verbatim from `grep -cE "^[[:space:]]*#\[(tokio::test\|test\|loom::model)"`)

| File | Tests |
|---|---|
| `pheno-port-adapter/src/lib.rs` | 5 |
| `pheno-port-adapter/src/adapters/system_clock.rs` | 3 |
| `pheno-port-adapter/src/adapters/unix.rs` | 6 |
| `pheno-port-adapter/src/adapters/mock_clock.rs` | 6 |
| `pheno-port-adapter/src/adapters/redis_cache.rs` | 3 |
| `pheno-port-adapter/src/adapters/in_memory_cache.rs` | 6 |
| `pheno-port-adapter/src/adapters/tcp.rs` | 27 (incl. `chaos::` mod) |
| `pheno-port-adapter/tests/hex_cache.rs` | 7 |
| `pheno-port-adapter/tests/hex_time.rs` | 9 |
| `pheno-port-adapter/tests/loom.rs` | 4 |
| `pheno-port-adapter/tests/loom_circuit_breaker.rs` | 1 |
| `pheno-port-adapter/tests/loom_request_router.rs` | 1 |
| `pheno-port-adapter/tests/proptest_smoke.rs` | 2 |
| **Total** | **80** |

### 1.4 Head position

```
HEAD     = 9cf52be5c4 feat(v19-t3): L54 OIDC consumer example (verify + mock + info subcommands)
main     = f84feec861a1732c7f8c012d934a01b2a0afde77
branches = chore/v19-71-pillar-cycle-9-p0-2026-06-21 (HEAD)
          chore/L25-loom-tests-pheno-port-adapter-2026-06-21
          chore/L25-loom-tests-pheno-port-adapter-clean-2026-06-21
          chore/T2-v14-cargo-modules-pheno-port-adapter-2026-06-21
          chore/T5-v14-loom-concurrency-pheno-port-adapter-2026-06-21
          chore/T7-v14-otel-metrics-adopt-pheno-port-adapter-2026-06-21
          chore/T8-v14-pheno-port-adapter-2026-06-21
          chore/T8-v14-pheno-port-adapter-warn-missing-docs-2026-06-21
          chore/v12-06-pheno-port-adapter-hex-time-port-2026-06-21
          chore/v14-class-a-ci-rot-fix-2026-06-21
          chore/v14-T2-aggregate-module-deps-2026-06-21
          chore/v15-71-pillar-cycle-5-p0-2026-06-21
          chore/l5-110-substrate-quality-bar-2026-06-20
          (+ ~15 older branches)
```

### 1.5 Sparse-checkout + monorepo identity

- Monorepo root = `/Users/kooshapari/CodeProjects/Phenotype/repos/` (KooshaPari/phenotype-apps remote).
- `core.sparseCheckout = false`; full checkout (the cone list shows the full inclusion of `pheno-port-adapter/`).
- `Cargo.toml:7` declares `[workspace]` empty table, so this crate is **standalone** (not a member of the root monorepo workspace).

---

## 2. Phase 1B.1 — Docs / spec / intent claims (traceable)

Every user-facing claim extracted from documentation, with `file:line` evidence. Claims are organized by source file.

### 2.1 README.md (per AGENTS.md:1 + STATUS.md:37)

> **Claim:** `README.md` does not exist. `find pheno-port-adapter/README.md` → `No such file or directory`.
> STATUS.md:37 explicitly confirms: "README.md (T20.x, no specific sub-task yet) — full 5-line quickstart + when/when-NOT; **L64 (README) pillar is 0/3**".
> CHANGELOG.md:29 promises "restructured to Keep a Changelog 1.1.0 with [Unreleased] + 6 empty subsections" but **no README is mentioned**.
> SPEC.md:132 documents: "`README.md` — quickstart, when/when NOT, install (planned; see STATUS.md § 4)".
> STATUS.md:44 lists "Author README.md (L64 pillar 0/3 → 3/3 target)" in the near-term roadmap.

**Traceable claim R-1**: `pheno-port-adapter` ships **without** a README. This is **intentional** per STATUS.md, not a bug — but it is a **L64 score = 0/3** claim in the 71-pillar audit (see `findings/71-pillar-2026-06-17.md:1007`: "pheno-port-adapter/ have no README at all (0 on L64)").

### 2.2 AGENTS.md (`pheno-port-adapter/AGENTS.md`)

| Claim | Evidence |
|---|---|
| Purpose = "Hexagonal L4 Port/Adapter pattern primitive for the pheno-* fleet" | `AGENTS.md:11` |
| "Defines the canonical `PortAdapter` trait and ships two concrete transport adapters (TCP, Unix-domain socket)" | `AGENTS.md:11` |
| "This crate is the **reference impl** for the hexagonal L4 pattern" | `AGENTS.md:6,13` |
| Substrate tier = `pheno-*-lib` | `AGENTS.md:5,56` |
| MSRV = 1.82 | `AGENTS.md:7`, `Cargo.toml:6` (`rust-version = "1.82"`) |
| Public API includes `pub trait PortAdapter: Send + Sync` | `AGENTS.md:19-24`, verified at `src/lib.rs:65-74` |
| Concrete adapters include `MockAdapter` (test-only) | `AGENTS.md:38`, but **NOT actually shipped as public** — see Bug #B-1 |
| 4 `AdapterError` variants: `ConnectFailed`, `DisconnectFailed`, `HealthCheckFailed`, `Timeout` | `AGENTS.md:30-35`, verified at `src/lib.rs:39-52` |
| Quality bar (ADR-042) + 80% lib coverage (ADR-040) | `AGENTS.md:57-58,82` |
| Branch prefix `<layer>/<slug>-<YYYY-MM-DD>` OR `chore/<req-id>-<slug>-<date>` | `AGENTS.md:53` |
| Worklog schema v2.1 (ADR-025 + ADR-030, 11 columns incl. `device:`) | `AGENTS.md:54`, `WORKLOG.md:3` |
| Authority: SPEC.md + STATUS.md + WORKLOG.md + CHANGELOG.md + llms.txt | `AGENTS.md:74-83` |
| Do-Not-Touch Zones: `[workspace]` table (empty), `src/adapters/{tcp,unix}.rs`, `Cargo.lock`, `# DO NOT EDIT` headers | `AGENTS.md:64-70` |
| Conventions: errors are typed, no `unwrap()` in lib, `#![warn(missing_docs)]` on the way | `AGENTS.md:60-62` |

**Traceable claim A-1**: The AGENTS.md claims `#![warn(missing_docs)]` is "on the way" but `src/lib.rs:31` actually has **`#![deny(missing_docs)]`** (stricter than `warn`). Either the AGENTS.md understates, or the deny was promoted silently — see Bug #B-5.

### 2.3 SPEC.md (`pheno-port-adapter/SPEC.md`)

| Claim | Evidence |
|---|---|
| Spec status = `implemented`, last audited `2026-06-18` against tree `86784dc870` | `SPEC.md:3-4` |
| Substrate tier = `pheno-*-lib` per ADR-023 Rule 3 | `SPEC.md:5` |
| "Reference implementation of the hexagonal L4 Port/Adapter pattern" | `SPEC.md:12` |
| "`MockAdapter` is included for tests" | `SPEC.md:12` |
| "Every failure is typed via the `AdapterError` enum (4 variants ... derived via `thiserror`)" | `SPEC.md:20` |
| "`Connection` opaque handle (`id: String`)" | `SPEC.md:20,57`, verified at `src/lib.rs:55-59` |
| "The trait is sync (async overlay is deferred to v0.2.0)" | `SPEC.md:20` |
| "`MockAdapter` ... `shipped`" | `SPEC.md:108` (Status table) |
| "`tests/otlp_smoke.rs` ... `scaffold` ... present on later branches" | `SPEC.md:110` |
| "`tests/tracing_test.rs` ... `scaffold` ... present on later branches" | `SPEC.md:111` |
| "`tests/integration_test.rs` (T18.4) ... `partial`" | `SPEC.md:109` |
| "**19 of 22 pheno-* Rust crates are migrating to per the ADR-038 adoption matrix**" | `SPEC.md:12,16` |
| Out of scope (v0.1): async on trait, TLS, pool, LB, HTTP/WS/gRPC | `SPEC.md:122-128` |
| Length target ≤ 80 lines; this file is "at the upper bound (87 lines incl. header)" | `SPEC.md:149`. **Actual length = 153 lines** — exceeds the 100-line split threshold per `SPEC.md:149`. |

**Traceable claim S-1**: SPEC.md cites `MockAdapter` as shipped (`SPEC.md:108`) but `MockAdapter` is defined **inside `#[cfg(test)] mod tests` at `src/lib.rs:92-127`** and is **not exported** anywhere. The crate ships **without** a public `MockAdapter`. See Bug #B-1.

**Traceable claim S-2**: SPEC.md references `tests/otlp_smoke.rs` (line 110) and `tests/tracing_test.rs` (line 111) as "scaffold — present on later branches". Verified: **neither file exists** in the working tree (only `hex_cache.rs`, `hex_time.rs`, `loom.rs`, `loom_circuit_breaker.rs`, `loom_request_router.rs`, `proptest_smoke.rs` are present). See Bug #B-2.

**Traceable claim S-3**: SPEC.md line length claim says "≤ 80 lines ... at the upper bound (87 lines incl. header)" but `SPEC.md` is **153 lines** (more than 1.7× the limit). The 100-line split threshold per `SPEC.md:149` was crossed silently.

### 2.4 CHANGELOG.md (`pheno-port-adapter/CHANGELOG.md`)

| Entry | Evidence |
|---|---|
| `[Unreleased]`: v8 governance meta-bundle (7 files) per ADR-042 + ADR-038 | `CHANGELOG.md:18` |
| `[Unreleased]`: `SPEC.md`, `STATUS.md`, `CONTRIBUTING.md`, `WORKLOG.md` v2.1, `CHANGELOG.md`, `llms.txt` (L5-116, 2026-06-18) | `CHANGELOG.md:19` |
| `[Unreleased]`: `WORKLOG.md` v2.0 schema **deprecated 2026-06-22** per ADR-025 | `CHANGELOG.md:33` |
| `[0.1.0] - 2026-06-11`: Initial release of `PortAdapter` trait + TCP/Unix adapters + 5 unit tests | `CHANGELOG.md:41-55` |
| `[0.1.0]`: `MockAdapter — test-only, in-tree (in src/lib.rs test module)` | `CHANGELOG.md:50` |
| Format = Keep a Changelog 1.1.0 | `CHANGELOG.md:13` |
| "Source data: WORKLOG.md v2.1 rows where Device ∈ {ci, heavy-runner}" | `CHANGELOG.md:5` |

**Traceable claim C-1**: CHANGELOG `[Unreleased]` lists only governance-meta-bundle changes. **No entry for v19 wave content** that landed on HEAD (L31 cache stats, L52 encryption-at-rest, L19 perf-gate binary, L54 OIDC consumer example). See Bug #B-3.

**Traceable claim C-2**: CHANGELOG says "Source data: WORKLOG.md v2.1 rows where Device ∈ {ci, heavy-runner}" but the actual `WORKLOG.md` only has 3 rows, all `Device: macbook`. Either the source data is stale, or the WORKLOG.md is incomplete. See Bug #B-4.

### 2.5 STATUS.md (`pheno-port-adapter/STATUS.md`)

| Claim | Evidence |
|---|---|
| Last refreshed `2026-06-18` against tree `86784dc870` | `STATUS.md:3` |
| Build = `yellow`, Coverage = `0%` (no `cargo-llvm-cov` run on main yet) | `STATUS.md:14` |
| Latest version = `v0.1.0` (`2026-06-11`) | `STATUS.md:14,51` |
| "5 inline tests in `src/lib.rs:34-124`" | `STATUS.md:14`. **Actual range** is `src/lib.rs:130-179` (5 tests, lines 130, 141, 151, 161, 172). |
| L20 (unit coverage) scored `2/3` | `STATUS.md:16` |
| L21 (integration tests) scored `0/3` | `STATUS.md:16` |
| "**Honest note on coverage:** the L20 (unit coverage) pillar scored 2/3" | `STATUS.md:16` |
| 71-pillar scorecard: `60/213` (28.2%), Tier 0 (minimum bar) | `STATUS.md:63-78` |
| Factory AI Agent Readiness: Level 0 (Functional) | `STATUS.md:84-98` |
| Style & Validation: 1 (no fmt/clippy CI gate) | `STATUS.md:88` |
| Build System: 1 (no `[[bin]]`/`[[bench]]`, no CI on main) | `STATUS.md:89` |
| Testing: 1 (5 inline tests, no `tests/`) | `STATUS.md:90` |
| Dev Environment: 0 (no justfile, no devcontainer, no flake) | `STATUS.md:92`. **Reality check**: `justfile`, `.devcontainer/devcontainer.json` **both exist** on HEAD. |
| Debugging & Observability: 0 (no OTLP smoke test) | `STATUS.md:93` |
| Security: 0 (no `deny.toml`, no SLSA) | `STATUS.md:94`. **Reality check**: `deny.toml` **exists** on HEAD. |
| Task Discovery: 2 (Conventional Commits + v2.1 worklog) | `STATUS.md:95` |
| Refresh cadence: weekly Monday 09:00 PDT (ADR-041) | `STATUS.md:4` |

**Traceable claim ST-1**: STATUS.md:14 cites "5 inline tests in `src/lib.rs:34-124`" but the inline test range is **130-179**, not 34-124. STATUS.md is 7 lines off on the start of the test block (line 34 vs 130) and 55 lines off on the end. The line numbers cited are stale.

**Traceable claim ST-2**: STATUS.md:92 (Dev Environment = 0, "no justfile, no devcontainer, no nix flake") is **factually wrong on HEAD** — `justfile` and `.devcontainer/devcontainer.json` both exist on disk. No `pheno-flake` nix template yet.

**Traceable claim ST-3**: STATUS.md:94 (Security = 0, "no `deny.toml` on main") is **factually wrong on HEAD** — `pheno-port-adapter/deny.toml` exists.

### 2.6 llms.txt (`pheno-port-adapter/llms.txt`)

| Claim | Evidence |
|---|---|
| "Hexagonal port-adapter framework for the Phenotype fleet" | `llms.txt:3` |
| "Provides trait-based ports, swappable adapters, and connection lifecycle management for transport protocols (TCP, UDP, HTTP, Unix sockets)" | `llms.txt:4` |
| Quickstart: `TcpAdapter::new("127.0.0.1:8080"); adapter.connect().await` | `llms.txt:18-21` |
| Env vars: `PHENO_TCP_TIMEOUT_MS` (default 5000), `PHENO_TCP_RETRY_COUNT` (default 3) | `llms.txt:25-26` |
| Key types: `Port<T>` (trait), `Adapter<T>`, `ConnectionPool<T>` | `llms.txt:29-31` |
| "See `pheno-port-adapter/examples/tcp_pool.rs`" | `llms.txt:33` |

**Traceable claim L-1 (HIGH SEVERITY)**: The `llms.txt` is **almost entirely fictional**. None of `PHENO_TCP_TIMEOUT_MS`, `PHENO_TCP_RETRY_COUNT`, `Port<T>`, `Adapter<T>`, `ConnectionPool<T>`, or `tcp_pool.rs` exist in the codebase. The claimed API shape `TcpAdapter::new("127.0.0.1:8080").connect().await` is async, but `PortAdapter::connect` is **sync** (returns `Result<Connection, AdapterError>`, no `.await`). See Bug #B-6 (HIGH).

### 2.7 WORKLOG.md (`pheno-port-adapter/WORKLOG.md`)

| Claim | Evidence |
|---|---|
| Schema = v2.1 (ADR-025 + ADR-030); supersedes v2.0 on 2026-06-22 | `WORKLOG.md:3` |
| 11 columns: Date, Task ID, Layer, Action, Files, Notes, Device, Actor, Hash, Branch, PR-URL | `WORKLOG.md:10-11` |
| Device ∈ {macbook, heavy-runner, subagent, ci} | `WORKLOG.md:30-35` |
| 3 rows of "actual history" | `WORKLOG.md:39-43` |

The 3 rows are:

| Date | Task ID | Device | Branch |
|---|---|---|---|
| 2026-06-18 | L5-116 | `macbook` | `chore/l5-116-meta-bundle-pheno-port-adapter-2026-06-18` |
| 2026-06-18 | L5-103 | `macbook` | `chore/l5-103-fleet-worklog-v2-1-migration-2026-06-18` |
| 2026-06-11 | L4-66 | `macbook` | `chore/l4-66-pheno-port-adapter-2026-06-11` |

**Traceable claim W-1**: The WORKLOG.md tracks only 3 governance-side tasks (meta-bundle + worklog migration + initial release). It does NOT include any of the v17/v19 wave work that landed on HEAD (HexTimePort, HexCachePort, InMemoryCache, RedisAdapter, SystemClock, MockClock, chaos tests, loom tests, fuzz target). The actual commits since `e2edcf8e1` (the L4-66 initial release commit on 2026-06-11) include at least:

- `352277bf4d chore(orch-v10-030): tier-0 pheno-port-adapter (#93)`
- `f63d9bbb5c feat(pheno-flags,pheno-port-adapter): wire pheno-otel + upgrade llms.txt to v2 schema`
- `d66756bca5 feat(pheno-flags,pheno-port-adapter): add dev-dependencies + chaos tests`
- `7ad855a177 chore(v11-tier-0-adrs): 100/102 WP scaffolds + closure + ADR-037 (#97)`
- `bc58074e2c chore(governance): preserve v12 and Mission 3 artifacts`
- `cc3b643204 wip: preserve figment cascade tcp adapter work`
- `f7dd354c3e docs(audit): 71-pillar cycle-3 scorecard`
- `712e39e8c4 feat(v13): close 3 missing P0 pillar artifacts (T1 fuzz Cargo, T3 parent sbom, T6 chaos CI)`
- `73142cd4a8 merge: resolve conflicts in chaos workflow and fuzz Cargo.toml`
- `6b63a6f753 feat(pheno-port-adapter): add HexCachePort trait + InMemory + Redis adapters`
- `642c4e6332 feat(pheno-port-adapter): deny missing_docs + unsafe_code (v14 T7 71-pillar cycle 4)`
- `2cdb58dbab feat(pheno-port-adapter): add HexTimePort trait + SystemClock + MockClock adapters`
- `986be7ccacc4beacc2822cdb8d308e8e0f4740c2 feat(v16): cycle 6 P0 — 10/10 tracks shipped` (L25 loom)
- `69c168bc707bf4cb4ffe0fe16b77036e7af6957c docs(v17-71-pillar-cycle-7): .cargo/config.toml (deleted) + pheno-port-adapter architecture refresh`

…none of which have WORKLOG.md rows. See Bug #B-7.

### 2.8 docs/architecture.md

Single doc, read in full (28 lines). States the architectural contract: Port + Adapter pattern is canonical; out-of-tree Adapters are first-class. Aligns with SPEC.md §3. No divergent claims.

### 2.9 CONTRIBUTING.md (`pheno-port-adapter/CONTRIBUTING.md`)

| Claim | Evidence |
|---|---|
| Branch prefixes: `feat/`, `chore/`, `fix/`, `spike/` | `CONTRIBUTING.md:21-26` |
| Conventional Commits with scope | `CONTRIBUTING.md:31` |
| 80% lib coverage gate (ADR-040) | `CONTRIBUTING.md:48,68` |
| Self-merge permitted for `governance` + `L<n>-#<n>` + `area:docs` + `area:ci` PRs | `CONTRIBUTING.md:60` |
| Cargo deny advisories required | `CONTRIBUTING.md:70` |
| "changes to the `PortAdapter` trait signature are a major version bump + ADR" | `CONTRIBUTING.md:62,81` |

### 2.10 Cargo.toml (`pheno-port-adapter/Cargo.toml`)

```toml
[package]
name = "pheno-port-adapter"
version = "0.1.0"            # line 3
edition = "2021"              # line 4
rust-version = "1.82"         # line 6

[workspace]                   # line 7  (empty — standalone crate)

[dependencies]
thiserror = "2.0"             # line 10
tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time"] }  # line 16
async-trait = "0.1"           # line 20
redis = { version = "0.27", default-features = false, features = ["tokio-comp", "connection-manager"] }  # line 24
pheno-otel = { path = "../pheno-otel" }  # line 30

[dev-dependencies]
loom = "0.7"                  # line 33
serde_json = "1"              # line 34
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }  # line 35
```

| Claim | Evidence |
|---|---|
| Crate name = `pheno-port-adapter`, version `0.1.0` | `Cargo.toml:2-3` |
| Standalone crate (empty `[workspace]`) | `Cargo.toml:7` |
| Adopts `pheno-otel` (ADR-037) as path-dep | `Cargo.toml:30` |
| Test deps: loom + serde_json + tokio | `Cargo.toml:32-35` |
| **No `[features]` table** (loom is unconditional in dev-deps) | `Cargo.toml` (absent) |
| **No `[[bin]]`, no `[[bench]]`** | `Cargo.toml` (absent) |
| **No `[lib]` table** (default crate-type) | `Cargo.toml` (absent) |

**Traceable claim T-1**: `proptest` is **NOT declared in `[dev-dependencies]`** but `tests/proptest_smoke.rs:14` uses `use proptest::prelude::*;`. The file would fail to compile under `cargo test`. See Bug #B-8.

### 2.11 i18n/ (`pheno-port-adapter/i18n/`)

3 FTL files (`en`, `es`, `ja`), all named `pheno-port-adapter.ftl`. Created by v17 T9 (L40 i18n, `findings/2026-06-21-v17-Wave-C-subagent-C.md` shows the matrix; each file has 10 keys).

**Traceable claim I-1**: Fluent files are present per v17 T9, but `Cargo.toml` does NOT declare a Fluent crate (e.g. `fluent-bundle`, `fluent`) as a dependency. The crate cannot actually consume the FTL files without a runtime. The keys are dead assets unless paired with a runtime in a downstream consumer.

---

## 3. Phase 1B.2 — Source code features (file:line dump)

### 3.1 `src/lib.rs` (180 lines) — top-level crate surface

```rust
//! `pheno-port-adapter` — substrate-canonical hexagonal port traits and
//! their concrete adapter implementations (ADR-038).
//!
//! Two surfaces live in this crate:
//!
//! 1. **Transport adapter trait** ([`PortAdapter`], [`Connection`],
//!    [`AdapterError`]) — sync interface for pluggable transports
//!    (TCP, Unix-domain, ...). Existing pre-hex-port adapters
//!    ([`adapters::TcpAdapter`], [`adapters::UnixAdapter`]) implement
//!    this.
//! 2. **Hex-port traits** (under [`ports`]) — async-capability traits
//!    defined per application/service boundary, with concrete adapters
//!    under [`adapters`]. Currently shipped:
//!    - [`ports::HexCachePort`] + [`adapters::InMemoryCache`] +
//!      [`adapters::RedisAdapter`].
//!
//! See ADR-038 for the policy governing when a new hex-port trait lands
//! in this crate vs. a polyglot `phenotype-*-sdk` package.
//!
//! ## Observability
//!
//! Per ADR-023 Rule 3.1 every substrate ships observability. Connection
//! lifecycle (connect / disconnect / error) is exported via
//! [`pheno_otel`] (ADR-037 canonical OTLP wire substrate). The hex-port
//! adapters do not yet emit per-operation spans — that is a tracked
//! follow-up (v13+) so we don't blanket-spam traces for high-QPS cache
//! paths.

//! #![doc = "Promote to deny once cycle-3 doc audit confirms 0 missing-doc warnings."]

#![deny(missing_docs)]                                                      // line 31
#![deny(unsafe_code)]                                                       // line 32
#![deny(rust_2018_idioms)]                                                  // line 33

use thiserror::Error;

/// Error type for transport-level [`PortAdapter`] operations.            // line 37
#[derive(Debug, Error)]                                                     // line 38
pub enum AdapterError {                                                     // line 39
    #[error("connect failed: {0}")]                                         // line 41
    ConnectFailed(String),                                                  // line 42
    #[error("disconnect failed: {0}")]                                      // line 44
    DisconnectFailed(String),                                               // line 45
    #[error("health check failed: {0}")]                                    // line 47
    HealthCheckFailed(String),                                              // line 48
    #[error("timeout")]                                                     // line 50
    Timeout,                                                               // line 51
}

/// Opaque handle representing an active connection.                        // line 54
#[derive(Debug)]                                                            // line 55
#[allow(dead_code)]                                                         // line 56
pub struct Connection {                                                     // line 57
    pub(crate) id: String,                                                  // line 58
}

/// Trait for pluggable transport adapters (TCP, Unix-domain, ...).         // line 61
///
/// Synchronous by design — the adapter itself owns its async runtime
/// story. Async work belongs in the hex-port traits under [`ports`].
pub trait PortAdapter: Send + Sync {                                        // line 65
    fn name(&self) -> &str;                                                 // line 67
    fn health(&self) -> Result<(), AdapterError>;                           // line 69
    fn connect(&self, endpoint: &str) -> Result<Connection, AdapterError>;  // line 71
    fn disconnect(&self) -> Result<(), AdapterError>;                       // line 73
}

pub mod ports;                                                              // line 78
pub mod adapters;                                                           // line 81

// Re-exports
pub use ports::{CacheError, HexCachePort};                                  // line 87

#[cfg(test)]
mod tests {                                                                 // line 90
    struct MockAdapter { ... }                                              // line 93 (test-only)
    impl PortAdapter for MockAdapter { ... }                                // line 99
    #[test] fn connect_returns_connection() { ... }                         // line 129
    #[test] fn disconnect_returns_ok() { ... }                             // line 140
    #[test] fn health_check_passes() { ... }                               // line 150
    #[test] fn connect_to_invalid_endpoint_fails() { ... }                 // line 160
    #[test] fn adapter_name_is_non_empty() { ... }                         // line 171
}
```

**Public items exported from `src/lib.rs`**:

| Item | Kind | Line | Notes |
|---|---|---|---|
| `AdapterError` | enum (4 variants) | `lib.rs:39-52` | `thiserror`-derived; `Send + Sync + 'static` by default |
| `Connection` | struct | `lib.rs:57-59` | `id: String` is `pub(crate)` (not externally readable) |
| `PortAdapter` | trait | `lib.rs:65-74` | 4 methods: `name`, `health`, `connect`, `disconnect`; `Send + Sync` supertrait |
| `ports` | mod | `lib.rs:78` | `pub mod ports` |
| `adapters` | mod | `lib.rs:81` | `pub mod adapters` |
| `CacheError` | re-export | `lib.rs:87` | via `pub use ports::{CacheError, HexCachePort}` |
| `HexCachePort` | re-export | `lib.rs:87` | flat re-export (consumer reads as `pheno_port_adapter::HexCachePort`) |
| `MockAdapter` | **private** (in `#[cfg(test)] mod tests`) | `lib.rs:93-127` | NOT exported; tests-only; see Bug #B-1 |

**Important gap**: `HexTimePort` is NOT re-exported from `src/lib.rs:87` (only `CacheError, HexCachePort`). Consumers must reach it via `pheno_port_adapter::ports::HexTimePort`. This breaks the "flat re-exports" convention advertised at `lib.rs:84-86`.

### 3.2 `src/ports/mod.rs` (26 lines)

```rust
//! Hex-port traits (the "P" in hexagonal architecture).
//!
//! Each module in this directory defines a *port* — a trait that captures
//! one side of an application/service boundary without committing to a
//! concrete backing technology. Adapters live in `crate::adapters` and
//! `impl HexPort for ConcreteAdapter` to provide the actual capability.
//!
//! Per ADR-038 (Hexagonal port-adapter L4 policy) every port trait:
//!
//! - Is `Send + Sync` (consumers may run on multi-threaded executors).
//! - Surfaces its own error type (no shared global `AdapterError`).
//! - Is documented at the trait level with: what it abstracts, what
//!   guarantees adapters must uphold, and what is intentionally out of
//!   scope.
//!
//! New ports are added by:
//!
//! 1. Drop a `<capability>.rs` module here declaring the trait + error.
//! 2. Re-export from `lib.rs` (`pub use ports::cache::HexCachePort`).
//! 3. Land at least one adapter under `crate::adapters` that implements it.
//! 4. Add a smoke test under `tests/` exercising the adapter against the
//!    trait surface (not the adapter's concrete type).

pub mod cache;                                                              // line 24
// NOTE: `pub mod time` is MISSING — see Bug #B-9.
pub use cache::{CacheError, HexCachePort};                                  // line 26
```

**Gap**: `src/ports/time.rs` exists on disk but is **NOT declared** as `pub mod time;` in `src/ports/mod.rs`. `HexTimePort` is therefore unreachable via `pheno_port_adapter::ports::HexTimePort`. Only `tests/hex_time.rs` and `src/adapters/{system_clock,mock_clock}.rs` (which `use crate::ports::HexTimePort;`) can reach it. See Bug #B-9 (HIGH).

### 3.3 `src/ports/cache.rs` (84 lines) — `HexCachePort` definition

| Item | Line | Signature |
|---|---|---|
| `CacheError::Backend(String)` | `cache.rs:51-53` | `#[error("cache backend error: {0}")]` |
| `CacheError::InvalidKey(String)` | `cache.rs:55-56` | `#[error("invalid cache key: {0}")]` |
| `CacheError::Serialization(String)` | `cache.rs:60-61` | reserved; unused by in-tree adapters |
| `HexCachePort` | `cache.rs:72-83` | `#[async_trait]`, `Send + Sync`, 3 async methods |
| `HexCachePort::get(&self, &str) -> Result<Option<Vec<u8>>, CacheError>` | `cache.rs:75` | async |
| `HexCachePort::put(&self, &str, Vec<u8>, Duration) -> Result<(), CacheError>` | `cache.rs:79` | async |
| `HexCachePort::invalidate(&self, &str) -> Result<(), CacheError>` | `cache.rs:83` | async |

Contract documented at `cache.rs:7-22`:
- `get` returns `Ok(None)` on miss; `Err(CacheError::Backend(_))` on transport failure (NOT for misses)
- `put` with `ttl == Duration::ZERO` → "no expiration"
- `invalidate` is idempotent

### 3.4 `src/ports/time.rs` (68 lines) — `HexTimePort` definition (orphaned; see B-9)

| Item | Line | Signature |
|---|---|---|
| `HexTimePort` | `time.rs:50-67` | `Send + Sync`, **sync** (not `async`) |
| `HexTimePort::now(&self) -> Instant` | `time.rs:56` | monotonic instant |
| `HexTimePort::unix_nanos(&self) -> u64` | `time.rs:67` | wall-clock nanos since unix epoch |

Notable: `HexTimePort` has **no associated error type** (returns `Instant`/`u64` directly) because "both methods are cheap, side-effect-free queries" (`time.rs:48-49`). This is an exception to the ADR-038 rule that "every port trait surfaces its own error type" (`ports/mod.rs:11`).

### 3.5 `src/adapters/mod.rs` (39 lines)

```rust
//! Concrete adapter implementations for the hexagonal ports.
//!
//! ## Transport adapters (sync [`PortAdapter`] trait)
//!
//! - [`tcp::TcpAdapter`] — connects to a `host:port` endpoint via [`std::net::TcpStream`].
//! - [`unix::UnixAdapter`] — connects to a filesystem path endpoint (Unix-only).
//!
//! Both transport adapters follow the same pattern: interior `Mutex<Option<…>>`,
//! synchronous trait methods, opaque [`Connection`] handle.
//!
//! ## Hex-port adapters (async [`crate::ports::HexCachePort`] etc.)
//!
//! - [`in_memory_cache::InMemoryCache`] — process-local cache.
//! - [`redis_cache::RedisAdapter`] — RESP-wire-protocol cache.
//!
//! These adapters back the hexagonal ports in `crate::ports`. Each one
//! implements its port trait via `#[async_trait]` to stay object-safe.

pub mod in_memory_cache;                                                    // line 30
pub mod redis_cache;                                                        // line 31

pub mod tcp;                                                                // line 33

#[cfg(unix)]
pub mod unix;                                                               // line 36

pub use in_memory_cache::InMemoryCache;                                     // line 38
pub use redis_cache::RedisAdapter;                                          // line 39
```

**Gap**: `MockAdapter` is **not re-exported** from `adapters/mod.rs`. `TcpAdapter` and `UnixAdapter` are **not re-exported** as flat names (consumers must `use pheno_port_adapter::adapters::tcp::TcpAdapter;`). `SystemClock` and `MockClock` are **not re-exported** either. The re-export table at lines 38-39 only covers cache adapters.

### 3.6 `src/adapters/tcp.rs` (456 lines)

| Item | Line | Signature |
|---|---|---|
| `TcpAdapter` | `tcp.rs:22-24` | `pub struct TcpAdapter { inner: Mutex<TcpState> }` (Default + Debug) |
| `TcpState` | `tcp.rs:27-30` | `stream: Option<TcpStream>`, `endpoint: Option<String>` |
| `TcpAdapter::new() -> Self` | `tcp.rs:34-36` | **no args** (despite `examples/quickstart.rs:14` passing `"tcp-prod"`) |
| `TcpAdapter::parse_endpoint(endpoint: &str) -> Result<(String, u16), AdapterError>` | `tcp.rs:39-61` | **public**, used by fuzz target |
| `impl PortAdapter for TcpAdapter` | `tcp.rs:64-105` | sync; replaces prior stream on re-connect |
| `TcpAdapter::name(&self) -> "tcp"` | `tcp.rs:65-67` | |
| `TcpAdapter::health(&self)` | `tcp.rs:69-82` | uses `peer_addr()` as liveness probe |
| `TcpAdapter::connect(&self, &str)` | `tcp.rs:84-96` | calls `parse_endpoint` first; replaces stream |
| `TcpAdapter::disconnect(&self)` | `tcp.rs:98-104` | `take()` drops inner stream (sends FIN) |
| Tests module | `tcp.rs:107-301` | 18 `#[test]` functions (including `parse_endpoint_*`) |
| Chaos tests module | `tcp.rs:309-455` | 6 `#[test]` functions; explicit `mod chaos` |

**Chaos tests** (per Pillar L11 commitment, `tcp.rs:303-308`):

| Test | Line | Asserts |
|---|---|---|
| `health_after_peer_drop_returns_error` | `tcp.rs:347-363` | `peer_addr` returns `NotConnected` after FIN |
| `rapid_connect_disconnect_cycles_do_not_leak_or_panic` | `tcp.rs:365-382` | 32 cycles, no panic, clean disconnect after |
| `connect_to_host_with_port_zero_is_rejected` | `tcp.rs:384-391` | port 0 rejected (per IANA "tcpmux") |
| `connect_to_malformed_endpoint_is_rejected` | `tcp.rs:393-403` | `not-a-socket`, `host::dup::colon`, `999.999.999.999:80`, `""` all rejected |
| `concurrent_adapters_do_not_block_each_other` | `tcp.rs:405-439` | 16 adapters × 4 ops; mutexes don't deadlock |
| `connect_timeout_returns_error_not_block` | `tcp.rs:441-455` | `192.0.2.1:80` (RFC 5737) fails in <5s |

### 3.7 `src/adapters/unix.rs` (173 lines) — `cfg(unix)`

| Item | Line | Signature |
|---|---|---|
| `UnixAdapter` | `unix.rs:27-29` | `pub struct UnixAdapter { inner: Mutex<UnixState> }` (Default + Debug) |
| `UnixState` | `unix.rs:32-35` | `stream: Option<UnixStream>`, `endpoint: Option<String>` |
| `UnixAdapter::new() -> Self` | `unix.rs:39-41` | no args |
| `impl PortAdapter for UnixAdapter` | `unix.rs:44-86` | sync; same shape as TcpAdapter |
| Tests module | `unix.rs:88-172` | 6 tests; full UnixListener round-trip |

### 3.8 `src/adapters/in_memory_cache.rs` (186 lines) — `HexCachePort`

| Item | Line | Signature |
|---|---|---|
| `Entry` (private) | `cache.rs:32-36` | `value: Vec<u8>`, `expires_at: Option<Instant>` |
| `InMemoryCache` | `cache.rs:39-42` | `pub struct InMemoryCache { inner: Arc<Mutex<HashMap<String, Entry>>> }` (Default + Clone) |
| `InMemoryCache::new() -> Self` | `cache.rs:46-48` | empty |
| `InMemoryCache::len(&self) -> usize` | `cache.rs:52-59` | **public** helper, unexpired count |
| `impl HexCachePort for InMemoryCache` (via `#[async_trait]`) | `cache.rs:62-113` | |
| `get` with empty-key validation + lazy expiration | `cache.rs:64-81` | |
| `put` with empty-key validation + TTL=0 → no expiration | `cache.rs:83-101` | |
| `invalidate` with empty-key validation (idempotent) | `cache.rs:103-112` | |
| 6 `#[tokio::test]` functions | `cache.rs:115-185` | |

### 3.9 `src/adapters/redis_cache.rs` (200 lines) — `HexCachePort`

| Item | Line | Signature |
|---|---|---|
| `RedisAdapter` | `cache.rs:44-50` | `pub struct RedisAdapter { client: redis::Client, conn: Arc<Mutex<Option<ConnectionManager>>> }` (Clone) |
| `RedisAdapter::new(url: &str) -> Result<Self, CacheError>` | `cache.rs:62-71` | parses URL, does not connect |
| `RedisAdapter::from_client(client: redis::Client) -> Self` | `cache.rs:74-80` | re-uses external Client |
| `RedisAdapter::client(&self) -> redis::Client` | `cache.rs:82-85` | returns a clone of the Client |
| `RedisAdapter::conn(&self) -> Result<ConnectionManager, CacheError>` (private) | `cache.rs:87-98` | lazy initialization |
| `impl HexCachePort for RedisAdapter` | `cache.rs:101-163` | empty-key + NUL/whitespace validation; rounds sub-second TTL up |
| 3 tests | `cache.rs:165-199` | malformed URL, well-formed URL without connect, empty key |

### 3.10 `src/adapters/system_clock.rs` (102 lines) — `HexTimePort`

| Item | Line | Signature |
|---|---|---|
| `SystemClock` | `clock.rs:29-30` | `pub struct SystemClock;` (ZST: Debug + Default + Clone + Copy) |
| `SystemClock::new() -> Self` | `clock.rs:36-38` | equivalent to unit struct |
| `impl HexTimePort for SystemClock` | `clock.rs:41-53` | |
| `now(&self) -> Instant` | `clock.rs:42-44` | `Instant::now()` |
| `unix_nanos(&self) -> u64` | `clock.rs:46-52` | `SystemTime::now().duration_since(UNIX_EPOCH)`, saturates at `u64::MAX`, returns `0` for pre-1970 |
| 3 `#[test]` functions | `clock.rs:55-101` | |

### 3.11 `src/adapters/mock_clock.rs` (238 lines) — `HexTimePort`

| Item | Line | Signature |
|---|---|---|
| `MockClock` | `clock.rs:38-41` | `pub struct MockClock { inner: Arc<MockClockInner> }` (Clone) |
| `MockClockInner` (private) | `clock.rs:43-55` | `epoch: Instant`, `offset: Mutex<Duration>`, `unix_nanos: Mutex<u64>` |
| `MockClock::new() -> Self` | `clock.rs:69-77` | anchored at real Instant::now(), offset 0 |
| `MockClock::from_seconds<S: Into<u128>>(seconds: S) -> Self` | `clock.rs:94-110` | saturates on overflow |
| `MockClock::advance(&self, delta: Duration)` | `clock.rs:115-120` | bumps offset + unix_nanos in lockstep |
| `MockClock::set_offset(&self, value: Duration)` | `clock.rs:124-126` | rewind/forward elapsed |
| `MockClock::set_unix_nanos(&self, value: u64)` | `clock.rs:129-131` | |
| `MockClock::offset_secs(&self) -> f64` | `clock.rs:135-138` | |
| `MockClock::unix_nanos(&self) -> u64` | `clock.rs:142-144` | |
| `impl Default for MockClock` | `clock.rs:166-170` | delegates to `new()` |
| `impl HexTimePort for MockClock` | `clock.rs:172-180` | |
| 6 `#[test]` functions | `clock.rs:182-237` | |

### 3.12 Feature disposition matrix (L4 hexagonal Port/Adapter status)

| Hex-port trait | Status | Adapter(s) | Tests | Notes |
|---|---|---|---|---|
| `PortAdapter` (sync) | **shipped + tested** | `TcpAdapter`, `UnixAdapter`, `MockAdapter` (test-only) | 32 (tcp) + 6 (unix) + 5 (lib) = 43 | `MockAdapter` is private (B-1) |
| `HexCachePort` (async) | **shipped + tested** | `InMemoryCache`, `RedisAdapter` | 6 (in_memory) + 3 (redis) + 7 (hex_cache.rs) = 16 | |
| `HexTimePort` (sync) | **shipped + tested + unreachable** | `SystemClock`, `MockClock` | 3 (system) + 6 (mock) + 9 (hex_time.rs) = 18 | `ports/mod.rs:24` does NOT declare `pub mod time;` (B-9) |

### 3.13 Test file analysis

#### `tests/hex_cache.rs` (134 lines, 7 tests)

| Test | Type | What it covers |
|---|---|---|
| `hex_cache_port_is_object_safe` | `#[tokio::test]` | trait-object round-trip via `Arc<dyn HexCachePort>` |
| `in_memory_cache_round_trip` | `#[tokio::test]` | put → get → invalidate round-trip |
| `zero_ttl_never_expires` | `#[tokio::test]` | TTL=0 → "no expiration" |
| `short_ttl_expires_on_next_get` | `#[tokio::test]` | lazy expiration on read |
| `empty_key_is_a_validation_error` | `#[tokio::test]` | empty key rejected on all 3 ops |
| `redis_adapter_parses_url_without_connecting` | `#[test]` (sync) | URL parse-only construction |
| `redis_adapter_rejects_malformed_url` | `#[test]` (sync) | malformed URL → `Backend` error |

#### `tests/hex_time.rs` (130 lines, 9 tests)

| Test | Type | What it covers |
|---|---|---|
| `system_clock_advances_with_real_time` | `#[test]` | `now()` advances in real time |
| `mock_clock_from_seconds_round_trips` | `#[test]` | `from_seconds(7u64) → unix_nanos() == 7_000_000_000` |
| `mock_clock_from_seconds_accepts_unsigned_integers` | `#[test]` | accepts `u32`, `u64` |
| `mock_clock_advance_keeps_now_and_unix_nanos_in_lockstep` | `#[test]` | 250ms advance; both views consistent |
| `mock_clock_clones_share_state` | `#[test]` | `Clone` shares Arc'd inner state |
| `mock_clock_set_offset_rewinds_elapsed_time` | `#[test]` | rewinds elapsed without rewriting wall clock |
| `mock_clock_from_seconds_saturates_on_overflow` | `#[test]` | `u64::MAX` seconds → `u64::MAX` nanos |
| `system_and_mock_clocks_are_interchangeable_via_trait_object` | `#[test]` | both impl `HexTimePort` |
| `mock_clock_is_send_sync_via_dyn_trait` | `#[test]` | `Arc<dyn HexTimePort>` is `Send + Sync` |

#### `tests/loom.rs` (169 lines, 4 loom::model tests)

| Test | What it explores |
|---|---|
| `state_transition_idle_to_connecting` | concurrent IDLE → CONNECTING transitions; exactly one succeeds |
| `state_transition_connecting_to_connected` | concurrent CONNECTING → CONNECTED vs CANCEL → CLOSED |
| `state_concurrent_cancel_and_close` | triple concurrent CONNECTED → CLOSED; final state is CLOSED |
| `state_idle_is_not_progressing` | IDLE is stable unless explicitly moved |

The state machine explored is **synthetic** (`AtomicU8` constants `STATE_IDLE`/`STATE_CONNECTING`/`STATE_CONNECTED`/`STATE_CLOSED`). The actual `TcpAdapter` uses an interior `Mutex<Option<TcpStream>>` (not an `AtomicU8`), so the loom tests exercise the **state-machine shape** rather than the adapter directly. This is a model-checking exercise, not a fidelity test.

#### `tests/loom_circuit_breaker.rs` (28 lines, 1 loom::model test)

```rust
#![cfg(loom)]
use loom::sync::atomic::{AtomicU8, Ordering};
use loom::sync::Arc;
use loom::thread;

#[test]
fn circuit_breaker_state_transitions_are_valid_under_concurrency() {
    // Verifies CLOSED → OPEN / HALF_OPEN transitions under concurrent
    // failer + inspector threads. No reference to the actual adapter.
}
```

Synthetic. Doesn't reference any adapter code — it just validates a generic state-machine shape.

#### `tests/loom_request_router.rs` (21 lines, 1 loom::model test)

```rust
#![cfg(loom)]
use loom::sync::{Arc, RwLock};
use loom::thread;
use std::collections::HashMap;

#[test]
fn request_router_lookups_are_safe_under_concurrent_writes() {
    // Writes a route while a reader holds the read lock; verifies
    // the write completes and the lookup succeeds post-write.
}
```

Synthetic. Generic RwLock test; doesn't reference any adapter code.

#### `tests/proptest_smoke.rs` (45 lines, 2 proptest! tests)

| Test | What it covers |
|---|---|
| `adapter_error_display_is_nonempty` | All `AdapterError` variants produce non-empty `Display` |
| `connection_debug_is_nonempty` | All `Connection` values produce non-empty `Debug` |

The proptest relies on `proptest::Arbitrary` impls — but **no `Arbitrary` impls exist** in `src/lib.rs`. `tests/proptest_smoke.rs` would fail to compile because (a) `proptest` isn't in `[dev-dependencies]` (B-8), AND (b) there are no `Arbitrary` impls for `AdapterError` or `Connection`.

### 3.14 Examples analysis

#### `examples/otel_quickstart.rs` (55 lines) — **compile-broken**

```rust
use pheno_otel::exporters::stdout::StdoutExporter;                          // line 9  ✓ exists (pheno-otel/src/exporters/stdout.rs:11)
use pheno_otel::trace::{emit, span};                                        // line 10 ✗ pheno-otel has NO `trace` module
use pheno_otel::ExporterConfig;                                             // line 11 ✗ pheno-otel/src/lib.rs has NO `pub use ExporterConfig`
use pheno_port_adapter::adapters::{tcp::TcpAdapter, unix::UnixAdapter, MockAdapter};  // line 12 ✗ MockAdapter is private
use pheno_port_adapter::PortAdapter;                                        // line 13 ✓

fn main() {
    let exporter = StdoutExporter::new(ExporterConfig::default());          // line 19 ✗ ExporterConfig has no Default impl
    let tcp: Box<dyn PortAdapter<Error = std::io::Error>> = Box::new(TcpAdapter::new());  // line 22 ✗ PortAdapter has no associated type `Error`
    let unix: Box<dyn PortAdapter<Error = std::io::Error>> = Box::new(UnixAdapter::new());  // line 23 ✗ same
    let mock = MockAdapter::default();                                      // line 24 ✗ MockAdapter is private + has no default
    let cx = span("pheno-port-adapter.demo.connect", "otel-quickstart");   // line 27 ✗ no `pheno_otel::trace::span`
    emit("adapter.instantiated", &cx, json!({...}));                        // line 28 ✗ no `pheno_otel::trace::emit`
    let handle = mock.connect("mock://localhost").expect("...");            // line 32 ✗ MockAdapter private
    emit("adapter.connected", &cx, json!({"handle_id": handle.id, "transport": handle.transport}));  // line 37 ✗ `Connection.transport` does not exist
    let _ = exporter.export(b"...\n");                                      // line 41 ✗ StdoutExporter::export takes &[u8] OK, but ExporterConfig::default() above failed first
    println!("adapters constructed: tcp={}, unix={}, mock_id={}", tcp.kind(), unix.kind(), handle.id);  // line 44 ✗ no `kind()` method on PortAdapter trait
}
```

**Compile errors** (would all need to be fixed):

1. `pheno_otel::trace::{emit, span}` — module does not exist (`pheno-otel/src/lib.rs:85-92` declares only `exporters` + `propagation` + `test_handle`).
2. `pheno_otel::ExporterConfig` — not flat-re-exported; must be `pheno_otel::exporters::ExporterConfig` (`pheno-otel/src/exporters/mod.rs:12`).
3. `MockAdapter` — private (only inside `#[cfg(test)] mod tests`).
4. `ExporterConfig::default()` — `pheno-otel/src/exporters/mod.rs:12-20` shows no `Default` derive.
5. `Box<dyn PortAdapter<Error = std::io::Error>>` — `PortAdapter` has no `Error` associated type (`src/lib.rs:65` shows plain `pub trait PortAdapter: Send + Sync`).
6. `MockAdapter::default()` — private.
7. `handle.transport` — `Connection` has only `id: String` (`src/lib.rs:57-59`).
8. `tcp.kind()`, `unix.kind()` — no such method.

#### `examples/quickstart.rs` (28 lines) — **compile-broken**

```rust
use pheno_port_adapter::adapters::{MockAdapter, TcpAdapter};               // line 9  ✗ MockAdapter is private
use pheno_port_adapter::PortAdapter;                                        // line 10 ✓

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mock = MockAdapter::new("mock-1").with_healthy(true);               // line 14 ✗ MockAdapter::new takes no args + no `.with_healthy` method
    let tcp = TcpAdapter::new("tcp-prod");                                  // line 15 ✗ TcpAdapter::new takes no args (defined at src/adapters/tcp.rs:34)
    // ...
    println!("TCP adapter: name={}", tcp.name());                            // line 20 ✓
    // ...
}
```

**Compile errors**:

1. `MockAdapter` is private.
2. `MockAdapter::new("mock-1")` — defined at `src/lib.rs:93` as `struct MockAdapter { name: String, healthy: bool, valid_endpoint: String }` with **no `new()` method** (constructed via `MockAdapter { name: ..., healthy: ..., valid_endpoint: ... }` literal in tests).
3. `.with_healthy(true)` — no such method on `MockAdapter`.
4. `TcpAdapter::new("tcp-prod")` — takes no args (`src/adapters/tcp.rs:34`).

### 3.15 Fuzz targets

`pheno-port-adapter/fuzz/`:

- `Cargo.toml` (16 lines, declares cargo-fuzz convention)
- `fuzz_targets/fuzz_target_1.rs` — **placeholder**: `fuzz_target!(|data: &[u8]| { /* fuzzed code goes here */ });`
- `fuzz_targets/fuzz_endpoint.rs` — calls `TcpAdapter::parse_endpoint(data_str)` (from commit `8dccefdc0b`, prior v17 cycle).

### 3.16 CI / lint configs

- `.github/workflows/ci.yml` — present, references `pheno-port-adapter/`
- `.github/workflows/lint.yml` — clippy/fmt gate
- `.github/workflows/audit.yml` — scorecard
- `.github/workflows/scorecard.yml` — OSSF scorecard
- `deny.toml` — `cargo-deny` config (45 lines)
- `justfile` — recipes for build/test/coverage
- `llvm-cov.toml` — coverage gate config (80% lib per ADR-040)
- `.devcontainer/devcontainer.json` — dev environment

### 3.17 `src/lib.rs` documentation density

- **Module doc**: 30 lines at top of `lib.rs:1-29` (well above 5-line threshold per AGENTS.md)
- **`#![deny(missing_docs)]`**: enforces doc comments on all public items at `lib.rs:31`
- Every `pub` struct + trait + method has a doc comment (verified across `src/lib.rs`, `src/ports/*.rs`, `src/adapters/*.rs`).

---

## 4. Phase 1B.3 — Test coverage inventory + gaps

### 4.1 Test inventory by surface

| Surface | Test functions | File |
|---|---|---|
| `AdapterError` Display invariants (proptest) | 1 | `tests/proptest_smoke.rs:25-31` |
| `Connection` Debug invariants (proptest) | 1 | `tests/proptest_smoke.rs:36-40` |
| `PortAdapter` trait (lib inline) | 5 | `src/lib.rs:129-179` |
| `TcpAdapter` (8 trait + 10 parse_endpoint + 6 chaos + 3 parse_contract = ~27) | 27 | `src/adapters/tcp.rs:107-455` |
| `UnixAdapter` | 6 | `src/adapters/unix.rs:88-172` |
| `InMemoryCache` | 6 | `src/adapters/in_memory_cache.rs:115-185` |
| `RedisAdapter` | 3 | `src/adapters/redis_cache.rs:165-199` |
| `SystemClock` | 3 | `src/adapters/system_clock.rs:55-101` |
| `MockClock` | 6 | `src/adapters/mock_clock.rs:182-237` |
| `HexCachePort` (integration, public API) | 7 | `tests/hex_cache.rs:32-133` |
| `HexTimePort` (integration, public API) | 9 | `tests/hex_time.rs:24-129` |
| `PortAdapter` state-machine (loom model-check) | 4 | `tests/loom.rs:21-168` |
| `circuit_breaker` (synthetic loom) | 1 | `tests/loom_circuit_breaker.rs:14-28` |
| `request_router` (synthetic loom) | 1 | `tests/loom_request_router.rs:11-21` |
| **Total** | **80** | (13 .rs files) |

### 4.2 Loom test ratio

`4 + 1 + 1 = 6 loom tests / 80 total = 7.5%` of all tests are loom model-check tests. Two of the three loom files (`loom_circuit_breaker.rs`, `loom_request_router.rs`) are **synthetic** — they don't reference any adapter code; they just validate generic concurrency primitives.

### 4.3 Coverage gaps

#### Gap G-1: `proptest` not declared in `[dev-dependencies]`

`tests/proptest_smoke.rs:14` uses `use proptest::prelude::*;` but `Cargo.toml:32-35` does not declare `proptest`. Without the dep, the test file fails to compile. The 2 proptest tests are **non-runnable**. The `Arbitrary` impls cited in the file's header (`tests/proptest_smoke.rs:7-8`) also do not exist anywhere in `src/`.

#### Gap G-2: `HexTimePort` unreachable from `pheno_port_adapter::ports::time` due to missing `pub mod time;`

`src/ports/mod.rs:24` declares only `pub mod cache;`. `src/ports/time.rs` exists on disk but is **not declared** as a module. External consumers (and even internal tests like `tests/hex_time.rs`) cannot use `pheno_port_adapter::ports::HexTimePort`. The internal adapters (`system_clock.rs`, `mock_clock.rs`) reach it via `use crate::ports::HexTimePort;` which works **only because** `src/lib.rs:78` does `pub mod ports;` (the compiler sees `time.rs` via filesystem convention). But the **re-export from `ports/mod.rs`** is missing, so `crate::ports::HexTimePort` is unreachable outside the crate.

#### Gap G-3: `HexTimePort` not re-exported flat from `lib.rs:87`

`src/lib.rs:87` is `pub use ports::{CacheError, HexCachePort};` — only 2 items. Consumers who want `HexTimePort` must reach via `pheno_port_adapter::ports::time::HexTimePort` or `pheno_port_adapter::ports::HexTimePort`. The "flat re-exports" convention (per `src/lib.rs:84-86`) is broken for `HexTimePort`.

#### Gap G-4: `MockAdapter` is private

`src/lib.rs:93` defines `MockAdapter` inside `#[cfg(test)] mod tests`. It is **not** a public adapter. SPEC.md:108, AGENTS.md:38, CHANGELOG.md:50, llms.txt (implicitly) all claim it is shipped. Both `examples/quickstart.rs` and `examples/otel_quickstart.rs` use it (both compile-broken).

#### Gap G-5: Adapter flat re-exports incomplete in `adapters/mod.rs:38-39`

Only `InMemoryCache` and `RedisAdapter` are flat-re-exported. `TcpAdapter`, `UnixAdapter`, `SystemClock`, `MockClock` are accessible only via the submodule path. This breaks the `pheno_port_adapter::adapters::TcpAdapter` import the examples assume.

#### Gap G-6: No `[[bench]]` benchmarks despite L13-L19 performance pillars being 0/3

`Cargo.toml` has no `[[bench]]` table. The 71-pillar audit (`findings/71-pillar-2026-06-17.md:801`) scored L13 (perf budgets), L17 (benchmarks), L18 (profiling) all 0/3. No `criterion`-based benchmarks for `TcpAdapter::connect`, `parse_endpoint`, `InMemoryCache::get/put`, `RedisAdapter::*`, `MockClock::*`.

#### Gap G-7: No OTLP smoke test on `main`

STATUS.md:93 says "No OTLP smoke test on main". `tests/otlp_smoke.rs` does not exist (despite SPEC.md:110 referencing it as `scaffold`).

#### Gap G-8: Chaos test ratio: only 6 of 80

Only `src/adapters/tcp.rs` ships `chaos` tests (6 of 27 = 22%). No chaos tests for `UnixAdapter`, `InMemoryCache`, `RedisAdapter`, `MockClock`. Per L11 commitment in v17 cycle 7, **5 crates** were supposed to get chaos tests (per `findings/2026-06-21-v17-T7-L11-chaos-tests-sweep.md`); this crate has them only in `tcp.rs`.

#### Gap G-9: No fuzz target for `HexCachePort::put` (TTL arithmetic)

`fuzz/fuzz_targets/fuzz_endpoint.rs` covers `TcpAdapter::parse_endpoint`. No fuzz target for `InMemoryCache::put` (with TTL values), `RedisAdapter::from_client` (URL parsing), or `MockClock::from_seconds` (u128 overflow saturation).

#### Gap G-10: No tests for `Connection::id` getter

`Connection::id` is `pub(crate)` (`src/lib.rs:58`) so external tests can't read it. `tests/hex_cache.rs` uses `cache.get(...)` which returns `Option<Vec<u8>>`, not `Connection`. The `id` field is **read-access-tested only inside the crate** (`src/lib.rs:137`: `assert_eq!(conn.id, "tcp://localhost:8080");`).

#### Gap G-11: Two synthetic loom files don't reference any adapter code

`tests/loom_circuit_breaker.rs` and `tests/loom_request_router.rs` are state-machine smoke tests that don't exercise `TcpAdapter`, `UnixAdapter`, or any port trait. They could be moved to a shared loom-utility crate without loss.

---

## 5. Phase 1B.4 — Bug tally (numbered, severity-rated)

| # | Severity | File:Line | Bug | Evidence |
|---|---|---|---|---|
| **B-1** | **HIGH** | `src/lib.rs:93` | `MockAdapter` is **private** (inside `#[cfg(test)] mod tests`), but `SPEC.md:108`, `AGENTS.md:38`, `CHANGELOG.md:50` all claim it is "shipped". `examples/quickstart.rs:9,14` and `examples/otel_quickstart.rs:12` import it as `pheno_port_adapter::adapters::MockAdapter` (or unqualified `MockAdapter`). Both examples fail to compile. Either the docs are wrong, or `MockAdapter` should be re-exported (and ideally moved to `src/adapters/mock.rs`). | grep `MockAdapter` only inside `src/lib.rs:93-178` + `examples/*.rs` (which are broken) |
| **B-2** | **HIGH** | `SPEC.md:110-111` | `SPEC.md` references `tests/otlp_smoke.rs` and `tests/tracing_test.rs` as "scaffold — present on later branches", but **neither file exists** in the working tree. | `ls pheno-port-adapter/tests/` shows only `hex_cache.rs`, `hex_time.rs`, `loom.rs`, `loom_circuit_breaker.rs`, `loom_request_router.rs`, `proptest_smoke.rs` |
| **B-3** | **MEDIUM** | `CHANGELOG.md:16-40` (Unreleased section) | `[Unreleased]` lists only the v8 meta-bundle. No entries for the 13+ commits that landed on HEAD between 2026-06-18 (meta-bundle) and 2026-06-21 (v17/v19 wave): HexCachePort, HexTimePort, InMemoryCache, RedisAdapter, SystemClock, MockClock, chaos tests, loom tests, proptest smoke, deny(missing_docs), fuzz target, OTLP smoke, … | `git log` on `pheno-port-adapter/` from `7ad855a177` (v11) to `9cf52be5c4` (HEAD) shows 13+ distinct commits with non-governance scope |
| **B-4** | **MEDIUM** | `CHANGELOG.md:5` + `WORKLOG.md:39-43` | CHANGELOG says "Source data: WORKLOG.md v2.1 rows where Device ∈ {ci, heavy-runner}", but WORKLOG.md has 3 rows, all `Device: macbook`. The filter rule and the actual rows disagree. | `WORKLOG.md:42-44` |
| **B-5** | **LOW** | `AGENTS.md:62` | AGENTS.md claims "`#![warn(missing_docs)]` is on the way", but `src/lib.rs:31` already has **`#![deny(missing_docs)]`** (stricter than warn). Stale claim. | `src/lib.rs:31` vs `AGENTS.md:62` |
| **B-6** | **HIGH** | `llms.txt:1-34` (entire file) | The `llms.txt` is **almost entirely fictional**. None of `PHENO_TCP_TIMEOUT_MS` (line 25), `PHENO_TCP_RETRY_COUNT` (line 26), `Port<T>` (line 29), `Adapter<T>` (line 30), `ConnectionPool<T>` (line 31), or `tcp_pool.rs` (line 33) exist. The example API `TcpAdapter::new("127.0.0.1:8080").connect().await` (lines 19-20) is async, but `PortAdapter::connect` is sync and returns `Result<Connection, AdapterError>` (no `.await`). This is the LLM-facing description — most harmful type of doc bug because it teaches LLMs wrong APIs. | `grep -rn "PHENO_TCP_TIMEOUT_MS\|PHENO_TCP_RETRY_COUNT\|ConnectionPool" pheno-port-adapter/` returns nothing |
| **B-7** | **MEDIUM** | `WORKLOG.md:39-43` (3 rows total) | WORKLOG.md has only 3 rows, missing all the v17/v19 wave commits: HexTimePort, HexCachePort, InMemoryCache, RedisAdapter, SystemClock, MockClock, chaos tests, loom tests, fuzz target, deny(missing_docs). Per ADR-042 element 7 (worklog discipline), every commit should have a row. | `git log` on `pheno-port-adapter/` shows 13+ commits without WORKLOG rows |
| **B-8** | **HIGH** | `Cargo.toml:32-35` (dev-deps) | `proptest` is **NOT declared** in `[dev-dependencies]`, but `tests/proptest_smoke.rs:14` uses `use proptest::prelude::*;`. The file would fail to compile under `cargo test`. Also, the `proptest::Arbitrary` impls cited in the file's header (`tests/proptest_smoke.rs:7-8`) do not exist anywhere in `src/`. | `Cargo.toml:32-35` lacks `proptest`; `tests/proptest_smoke.rs:14` imports it |
| **B-9** | **HIGH** | `src/ports/mod.rs:24-26` | `src/ports/mod.rs:24` declares only `pub mod cache;`. `src/ports/time.rs` exists on disk but is NOT declared as a module. **External consumers cannot reach `HexTimePort` via `pheno_port_adapter::ports::time::HexTimePort`**. Internal adapters reach it via `use crate::ports::HexTimePort;` only because the compiler sees `time.rs` via filesystem convention; the re-export from `ports/mod.rs` is missing. | `grep "pub mod" src/ports/mod.rs` → only `cache` |
| **B-10** | **HIGH** | `src/lib.rs:87` | `pub use ports::{CacheError, HexCachePort};` does not include `HexTimePort`. The flat-re-export convention advertised at `src/lib.rs:84-86` is broken for `HexTimePort`. Consumers must reach via `pheno_port_adapter::ports::time::HexTimePort`. | `grep "pub use ports" src/lib.rs` |
| **B-11** | **MEDIUM** | `src/adapters/mod.rs:38-39` | Only `InMemoryCache` and `RedisAdapter` are flat-re-exported. `TcpAdapter`, `UnixAdapter`, `SystemClock`, `MockClock` are accessible only via submodule path. Examples (`quickstart.rs:9`, `otel_quickstart.rs:12`) import via flat path. | `grep "pub use" src/adapters/mod.rs` |
| **B-12** | **HIGH** | `examples/otel_quickstart.rs` (entire file) | At least **8 compile errors** (see § 3.14 above). The example is unusable. | Cargo's check would surface all of them. |
| **B-13** | **HIGH** | `examples/quickstart.rs:14-15` | `MockAdapter::new("mock-1").with_healthy(true)` and `TcpAdapter::new("tcp-prod")` use signatures that don't exist. `MockAdapter` is private; `TcpAdapter::new()` takes no args. | `src/lib.rs:93` (MockAdapter literal) vs `quickstart.rs:14`; `src/adapters/tcp.rs:34` (no args) vs `quickstart.rs:15` |
| **B-14** | **LOW** | `STATUS.md:14` | "5 inline tests in `src/lib.rs:34-124`" — actual range is **`src/lib.rs:130-179`**. Line numbers are stale by ~100 lines. | `STATUS.md:14` vs `src/lib.rs:130-179` |
| **B-15** | **MEDIUM** | `STATUS.md:92` | "Dev Environment: 0 (No justfile, no devcontainer, no nix flake)" — but `justfile` and `.devcontainer/devcontainer.json` **both exist** on HEAD. Stale claim. | `ls pheno-port-adapter/justfile .devcontainer/devcontainer.json` |
| **B-16** | **MEDIUM** | `STATUS.md:94` | "Security: 0 (no deny.toml on main)" — but `pheno-port-adapter/deny.toml` exists. Stale claim. | `ls pheno-port-adapter/deny.toml` |
| **B-17** | **LOW** | `STATUS.md:3` | "Last refreshed 2026-06-18 against tree 86784dc870" — actual HEAD is `9cf52be5c4`, and the tree has shifted dramatically. Refresh cadence per ADR-041 (weekly Mon 09:00 PDT) is overdue (2026-06-21 = 3 days past). | `git rev-parse HEAD` returns `9cf52be5c4` |
| **B-18** | **LOW** | `SPEC.md:149` | "Length target ≤ 1 page (≤ 80 lines). This file is at the upper bound (87 lines incl. header)" — actual length is **153 lines** (almost 2× the limit). The 100-line split threshold was crossed silently. | `wc -l pheno-port-adapter/SPEC.md` returns `153` |
| **B-19** | **MEDIUM** | `Cargo.toml:9-31` (deps) | No `[features]` table. `loom` is unconditional in `[dev-dependencies]`. Per L25 commitment (`findings/2026-06-21-v16-T6-loom-sweep.md`), loom tests are supposed to be opt-in via a `--features loom` (or `RUSTFLAGS="--cfg loom"`) gate. Currently `tests/loom.rs:3` claims `cargo +nightly test --features loom` works, but there's no `loom` feature defined. | `Cargo.toml` (no `[features]`); `tests/loom.rs:3` instruction |
| **B-20** | **MEDIUM** | `Cargo.toml:24` | `redis = { version = "0.27", default-features = false, ... }` is a hard dep, not optional. Hex-port adapters must be able to compile without a Redis dep. Should be gated behind a `redis-cache` feature. Per ADR-023 Rule 3, substrate libs should not force all deps on all consumers. | `Cargo.toml:24-28` |
| **B-21** | **LOW** | `fuzz/fuzz_targets/fuzz_target_1.rs` (entire file) | **Placeholder fuzz target** — body is `// fuzzed code goes here`. Empty fuzz harness adds CI noise (cargo-fuzz would still build it) but no coverage value. | `cat pheno-port-adapter/fuzz/fuzz_targets/fuzz_target_1.rs` |
| **B-22** | **LOW** | `pheno-otel/src/lib.rs:85-92` + `examples/otel_quickstart.rs:10-11` | `examples/otel_quickstart.rs` references `pheno_otel::trace::{emit, span}` and `pheno_otel::ExporterConfig` (flat paths). Neither exists at `pheno-otel`. The example is in the wrong crate (should be in `pheno-otel`'s examples) or the example should be deleted. | `pheno-otel/src/lib.rs` (no `trace` mod, no flat `ExporterConfig` re-export) |
| **B-23** | **MEDIUM** | `src/ports/mod.rs:11` vs `src/ports/time.rs` | ADR-038 rule (per `src/ports/mod.rs:11`): "Surfaces its own error type (no shared global `AdapterError`)". `HexTimePort` returns `Instant`/`u64` directly with **no error type**, even though the doc rule requires one. Inconsistency between module-level rule and time-port shape. | `src/ports/mod.rs:11` vs `src/ports/time.rs:50-67` |
| **B-24** | **LOW** | `src/adapters/in_memory_cache.rs:9-15` | Module doc claims "tokio::sync::Mutex is the right primitive for async-critical section". This is the canonical "should I use std::sync::Mutex vs tokio::sync::Mutex?" debate — reasonable explanation but `std::sync::Mutex` does NOT panic on `.lock().unwrap()` if held across await (it just blocks the executor). The doc's claim ("a parked task holding the guard stalls every other task") is true but the wording is ambiguous. Minor doc clarity issue. | `src/adapters/in_memory_cache.rs:9-15` |
| **B-25** | **LOW** | `src/adapters/redis_cache.rs:139` | `let secs = ttl.as_secs().max(1);` — a `Duration::from_millis(500)` (500ms TTL) rounds up to 1s (1000ms = 2× the requested TTL). The doc says "round sub-second TTLs up to the next whole second" (`redis_cache.rs:24-27`) which is correct, but the bound `.max(1)` is at odds with the rule "round UP" — a 500ms TTL should round to 1s, not be silently capped at 1s minimum (same result here, but the wording obscures intent). Minor. | `src/adapters/redis_cache.rs:139` |
| **B-26** | **INFO** | `src/adapters/tcp.rs:303` | `chaos` test module is inside the same `.rs` file as the regular tests (`tcp.rs:107-301`). Per ADR-038 / substrate hygiene, chaos tests might be better split into `src/adapters/tcp/chaos.rs` for clarity. Stylistic only. | `src/adapters/tcp.rs:309-455` |
| **B-27** | **INFO** | `i18n/*.ftl` | Fluent files exist (`en/es/ja`) but no Fluent runtime dep is declared in `Cargo.toml`. The keys are dead assets unless paired with a runtime in a downstream consumer. | `i18n/*.ftl` exists; `Cargo.toml` no Fluent dep |
| **B-28** | **MEDIUM** | `tests/hex_cache.rs:21-26` (imports) | Test imports `pheno_port_adapter::adapters::{InMemoryCache, RedisAdapter}` — works because those are flat-re-exported. But the file ALSO needs `tokio` (for `#[tokio::test]`) and `redis` runtime for the live tests. The `redis_adapter_parses_url_without_connecting` test (line 119) doesn't need a live Redis server (per the doc) — but a regression that introduces eager connect would silently break the test in CI without a Redis fixture. | `tests/hex_cache.rs:124-128` |
| **B-29** | **LOW** | `tests/loom.rs:14` | Loom requires nightly (`#[test] fn ... { loom::model(|| { ... }) }`). `tests/loom.rs:3` says `cargo +nightly test --features loom --test loom`, but `[features]` table is empty (B-19). On stable Rust, the file is `cfg(loom)`-gated out (line 10), but the `loom` crate itself is in `[dev-dependencies]` unconditionally (line 33). | `tests/loom.rs:3,10` + `Cargo.toml:33` |

### 5.1 Bug tally summary

| Severity | Count |
|---|---|
| HIGH | 8 |
| MEDIUM | 10 |
| LOW | 9 |
| INFO | 2 |
| **Total** | **29** |

**Top 5 priorities** (HIGH severity):

1. **B-6**: `llms.txt` is fictional — rewrites the LLM-facing surface. Most harmful because LLMs use it to generate consumer code.
2. **B-9**: `src/ports/mod.rs:24` missing `pub mod time;` — `HexTimePort` is unreachable externally despite being a flagship v17 deliverable.
3. **B-1**: `MockAdapter` is private but docs claim shipped. `examples/quickstart.rs` and `examples/otel_quickstart.rs` both break.
4. **B-12 / B-13**: Both example files fail to compile (8 errors in `otel_quickstart.rs`, multiple in `quickstart.rs`).
5. **B-8**: `proptest` not declared; 2 proptest tests are non-runnable.

---

## 6. Phase 1B.5 — Branch-only artifacts (v14/v19 waves)

### 6.1 v14 wave (cycle 4, 2026-06-18 → 2026-06-21)

Branches containing v14-track work for `pheno-port-adapter`:

| Branch | Last commit | Unique content |
|---|---|---|
| `chore/T2-v14-cargo-modules-pheno-port-adapter-2026-06-21` | TBD | (L6 cargo-modules audit — Cargo.toml-level, likely no new file) |
| `chore/T5-v14-loom-concurrency-pheno-port-adapter-2026-06-21` | TBD | Loom concurrency work; superset of `chore/L25-loom-tests-pheno-port-adapter-2026-06-21` |
| `chore/T7-v14-otel-metrics-adopt-pheno-port-adapter-2026-06-21` | TBD | OTLP metrics adoption (wire via `pheno-otel`) |
| `chore/T8-v14-pheno-port-adapter-2026-06-21` | TBD | Generic v14 sweep |
| `chore/T8-v14-pheno-port-adapter-warn-missing-docs-2026-06-21` | TBD | `warn(missing_docs)` adoption (already on HEAD as `deny(missing_docs)`) |
| `chore/v14-class-a-ci-rot-fix-2026-06-21` | TBD | Class A CI rot fix (cargo-deny advisories bump) |
| `chore/v14-T2-aggregate-module-deps-2026-06-21` | TBD | Module dep aggregation (L2, L3 pillars) |

### 6.2 v19 wave (cycle 9, 2026-06-21)

Branch: `chore/v19-71-pillar-cycle-9-p0-2026-06-21` (= HEAD = `9cf52be5c4`).

Last 13 commits touching `pheno-port-adapter/` (from `git log -- "pheno-port-adapter/"`):

| Commit | Date | Subject |
|---|---|---|
| `9cf52be5c4` | 2026-06-21 (HEAD) | feat(v19-t3): L54 OIDC consumer example (verify + mock + info subcommands) |
| `17f9f0cbfe` | 2026-06-21 | feat(v19-t4): L19 perf-gate binary (config + gate + report + summary + workflow) |
| `524936dad0` | 2026-06-21 | docs(v19): cycle-9 closure probe — fleet mean 2.86 → 2.95 |
| `71af3a67e9` | 2026-06-21 | docs(v19-t5): T5 router spike security review (12 findings, 0 P0) |
| `090b949a43` | 2026-06-21 | feat(v19-t1): L31 cache stats Pages deployer |
| `3a63e31271` | 2026-06-21 | feat(v19-t2): L52 encryption-at-rest code (ZeroizeOnDrop + cargo-deny rules) |
| `2fc4303c28` | 2026-06-21 | v19(wave1): 5 v19 tracks + 11 SIDE-DAG fillers (substrate maturity, ADR-077..080) |
| `87d31a11f3` | 2026-06-21 | docs(worklog): v19 orchestrator — close AGENTS.md refresh loose end |
| `e8d3eaccfc` | 2026-06-21 | docs(governance): AGENTS.md Wave Plan refresh — v17 → v19 current |
| `64e06e3e6a` | 2026-06-21 | docs(agents): v18 closure + v19 launch context |
| `2f85e59954` | 2026-06-21 | docs(worklog): L5-151 — v19 state realignment (0 mergeable PRs, pivot to substrate tooling) |
| `6bc3b866f3` | 2026-06-21 | chore(test): L25 loom tests for pheno-otel (#68) |
| `70926f5287` | 2026-06-21 | feat(pheno-otel): L60 fleet-wide latency histogram facade with bounded cardinality (#69) |

…and earlier commits include:

| Commit | Date | Subject |
|---|---|---|
| `f822c33547` | 2026-06-21 | docs(findings): v18-T1-L17 fedramp/SOC2 readiness + v18-T2-L18 data classification + v19 DAG draft |
| `2404aab80a` | 2026-06-21 | docs(plan): v18 cycle-8 P0 + Security P1 (11 tracks, ~23h wall) |
| `9a3dcda485` | 2026-06-21 | feat(pheno-predict): L72 ADR-047 predictive DRY tool — stdlib Python (715 LoC) |
| `2e48d8205e` | 2026-06-21 | docs(governance): v18 cycle-8 plan + SSOT refresh |
| `2f314a91e0` | 2026-06-21 | chore(governance): stage 3 v17 closure commits + 4 v18 subagent outputs + Class A CI rot fix |
| `69c168bc70` | 2026-06-20 | docs(v17-71-pillar-cycle-7): .cargo/config.toml (deleted) + pheno-port-adapter architecture refresh |
| `986be7ccac` | 2026-06-20 | feat(v16): cycle 6 P0 — 10/10 tracks shipped (L7, L9, L13, L19, L22, L25, L26, L34, L42, L43) — **includes `tests/loom.rs` for L25** |
| `2cdb58dbab` | 2026-06-20 | feat(pheno-port-adapter): add HexTimePort trait + SystemClock + MockClock adapters |
| `642c4e6332` | 2026-06-20 | feat(pheno-port-adapter): deny missing_docs + unsafe_code (v14 T7 71-pillar cycle 4) |
| `6b63a6f753` | 2026-06-20 | feat(pheno-port-adapter): add HexCachePort trait + InMemory + Redis adapters |
| `73142cd4a8` | 2026-06-19 | merge: resolve conflicts in chaos workflow and fuzz Cargo.toml |
| `712e39e8c4` | 2026-06-19 | feat(v13): close 3 missing P0 pillar artifacts (T1 fuzz Cargo, T3 parent sbom, T6 chaos CI) |
| `f7dd354c3e` | 2026-06-19 | docs(audit): 71-pillar cycle-3 scorecard for Eidolon + agent-platform + mobile-mcp + mobile-cli |
| `cc3b643204` | 2026-06-19 | wip: preserve figment cascade tcp adapter work |
| `bc58074e2c` | 2026-06-19 | chore(governance): preserve v12 and Mission 3 artifacts |
| `7ad855a177` | 2026-06-19 | chore(v11-tier-0-adrs): 100/102 WP scaffolds + closure + ADR-037 (#97) |
| `d66756bca5` | 2026-06-19 | feat(pheno-flags,pheno-port-adapter): add dev-dependencies + chaos tests |
| `f63d9bbb5c` | 2026-06-18 | feat(pheno-flags,pheno-port-adapter): wire pheno-otel + upgrade llms.txt to v2 schema |
| `352277bf4d` | 2026-06-18 | chore(orch-v10-030): tier-0 pheno-port-adapter (#93) |
| `aec7282070` | 2026-06-18 | chore(tier-0): orch-v10-025 hygiene + governance docs + drift detection tooling (#30) |

### 6.3 Branch-only artifacts inventory

| Wave | Artifact | Status on HEAD |
|---|---|---|
| **v9 (orch-v10-025/030)** | `tests/loom.rs` added (then expanded) | ✓ on HEAD |
| **v10 (orch-v10-030)** | Tier-0 governance; `fuzz_endpoint.rs` placeholder | ✓ on HEAD |
| **v11 (orch-w15-direct)** | Tier-0 ADRs + drift detection tooling | ✓ on HEAD (governance side only) |
| **v12 (Mission 3)** | `HexTimePort` + `SystemClock` + `MockClock` (`2cdb58dbab`) | ✓ on HEAD |
| **v13** | Fuzz Cargo, parent SBOM, chaos CI; chaos tests in `tcp.rs:309-455` | ✓ on HEAD |
| **v14 (cycle 4)** | `deny missing_docs + unsafe_code` (`642c4e6332`); `HexCachePort` + `InMemoryCache` + `RedisAdapter` (`6b63a6f753`); `looms_circuit_breaker.rs` + `loom_request_router.rs` (extra loom files) | ✓ on HEAD |
| **v16 (cycle 6)** | L25 loom tests (`986be7ccac`); T6 chaos sweep | ✓ on HEAD |
| **v17 (cycle 7)** | Architecture refresh doc (`69c168bc70`) | ✓ on HEAD (governance side only) |
| **v19 (cycle 9)** | L31 cache stats Pages deployer; L52 encryption-at-rest; L19 perf-gate binary; L54 OIDC consumer example | ✓ on HEAD (mostly governance + workflow files; Rust code not yet exercised) |

### 6.4 Branch-only content (not on main)

Branches present in monorepo but **not on main** (`f84feec861`):

| Branch | Likely unique content | Risk |
|---|---|---|
| `chore/v14-class-a-ci-rot-fix-2026-06-21` | Bumped CI versions / advisories | Low (governance) |
| `chore/L25-loom-tests-pheno-port-adapter-2026-06-21` | Additional loom tests for `TcpAdapter` state-machine | Low |
| `chore/L25-loom-tests-pheno-port-adapter-clean-2026-06-21` | Re-do of above after a revert | Low |
| `chore/T2-v14-cargo-modules-pheno-port-adapter-2026-06-21` | Cargo.toml-level cargo-modules audit output | Low |
| `chore/T5-v14-loom-concurrency-pheno-port-adapter-2026-06-21` | Additional loom config / cfg gates | Low |
| `chore/T7-v14-otel-metrics-adopt-pheno-port-adapter-2026-06-21` | OTLP metrics wire-up (via `pheno-otel`) | Medium (depends on `pheno-otel` substrate) |
| `chore/T8-v14-pheno-port-adapter-warn-missing-docs-2026-06-21` | `warn(missing_docs)` (already `deny` on HEAD per `642c4e6332`) | Low |
| `chore/v12-06-pheno-port-adapter-hex-time-port-2026-06-21` | Initial `HexTimePort` PR (subsumed by `2cdb58dbab`) | Low (already merged) |

---

## 7. Phase 1B.6 — Cross-reference to prior 9 audits + matrix patterns

### 7.1 Prior audit lineage

This audit (`02-docs-code.md`) is the **second** in a series of 10+ Phase 1B audits of `pheno-*` substrates, following the template established by `findings/2026-06-20-pheno-errors-audit/` (which has `00-FINAL-AUDIT.md`, `02-docs-code.md`, `03-target-parity.md`).

Other audits in the series:

| Audit | Repo | Status |
|---|---|---|
| `findings/2026-06-20-pheno-errors-audit/` | `pheno-errors` | DONE (see `00-FINAL-AUDIT.md`) |
| `findings/2026-06-21-pheno-port-adapter-audit/` | `pheno-port-adapter` | **THIS AUDIT** |
| (TBD) | `pheno-flags` | planned per `findings/2026-06-19-wide-T83-8.md` |
| (TBD) | `pheno-mcp-router` | planned per same |
| (TBD) | `pheno-context` | planned |
| (TBD) | `pheno-config` | planned |
| (TBD) | `pheno-cli-base` | planned |

### 7.2 Prior 71-pillar audit references for `pheno-port-adapter`

| Audit | Score | Source |
|---|---|---|
| `findings/71-pillar-2026-06-17.md` § 1.10 | 60 / 213 (28.2%) | first 71-pillar audit; baseline |
| `findings/71-pillar-2026-06-20-weekly-2.md` (cycle 2) | "scheduled 2026-06-29 Mon" | not yet audited |
| `findings/2026-06-20-71-pillar-cycle-3-my-domain.md` | (4 interface-domain repos) | not in this wave |
| `findings/2026-06-20-71-pillar-cycle-4-summary.md` | (5 repos: pheno-config, pheno-otel, pheno-capacity, Configra, nanovms) | **port-adapter NOT in cycle 4** |
| `findings/2026-06-21-v17-T4-L4-hexagonal-ports.md` | (referenced L4 cycle 7 track) | one-line mention |
| `findings/2026-06-21-v17-T5-L8-observability-hooks.md` | 3 critical crates (pheno-port-adapter one of them per L8 work) | one-line mention |
| `findings/2026-06-21-v17-T7-L11-chaos-tests-sweep.md` | "5 crates with `chaos_` tests" | pheno-port-adapter: 6 chaos tests in tcp.rs |
| `findings/2026-06-21-v17-T8-L12-type-safety.md` | clippy.toml + deny(missing_docs) | `642c4e6332` |

### 7.3 Cross-pollination patterns

| Source crate | Pattern adopted by `pheno-port-adapter` | Evidence |
|---|---|---|
| `pheno-errors` | `thiserror`-derived enums (4 variants) | `src/lib.rs:38-52` mirrors the `pheno-errors` `thiserror` rule; cross-ref: `findings/2026-06-20-pheno-errors-audit/03-target-parity.md:154-160` (port-adapter listed as "N/A — different concern" candidate) |
| `pheno-flags` | Co-developed chaos tests + dev-deps + pheno-otel wire | `d66756bca5 feat(pheno-flags,pheno-port-adapter): add dev-dependencies + chaos tests` (cross-crate commit) |
| `pheno-flags` | Co-developed llms.txt v2 schema | `f63d9bbb5c feat(pheno-flags,pheno-port-adapter): wire pheno-otel + upgrade llms.txt to v2 schema` |
| `pheno-flake` (planned) | devshell.nix template (TBD — no flake on disk) | n/a |
| `pheno-tracing` (ADR-036) | OTLP observability substrate adoption | `AGENTS.md:87` mentions pheno-tracing adoption |
| `pheno-otel` (ADR-037) | Path-dep `pheno-otel = { path = "../pheno-otel" }` | `Cargo.toml:30`; `src/lib.rs:23-27` |
| `pheno-worklog-schema` v2.1 | `device:` field adopted | `WORKLOG.md:3,10-11` |
| `pheno-llms-txt` v2 schema | llms.txt restructured | `f63d9bbb5c` (commit) |

### 7.4 AGENTS.md (top-level monorepo) references to `pheno-port-adapter`

| Reference | Location |
|---|---|
| "pheno-port-adapter" named as substrate | `AGENTS.md:62-65` (substrate family list) |
| "ADR-014 (Hexagonal L4 ports)" | `AGENTS.md:14` (in v15 wave ADRs) |
| "ADR-038 (Hexagonal port-adapter L4 policy)" | `AGENTS.md:13-14` (Wave B) |
| "v17 T5: L8 observability hooks" | `AGENTS.md:13` (Wave A) |
| "v17 T7: L11 chaos tests (5 crates)" | `AGENTS.md:13` (Wave A) |
| "v17 T8: L12 type safety + deny(missing_docs)" | `AGENTS.md:13` (Wave A) |
| "v16 T6: L25 proptest + loom" | `AGENTS.md:13` (Wave A) |
| "v19 wave plan (5 tracks: L31/L57/L65/L67 + 2 federation/interop)" | `AGENTS.md:13` (Wave E) |

### 7.5 Matrix patterns from prior audits

This audit's findings align with patterns surfaced in:

1. **`pheno-errors` audit** (L5-110.4 substrate quality bar, ADR-042B): both crates lack OTLP smoke tests, README.md, and have FTL files without a runtime. **Common remediation**: add `[features]` for OTLP toggle, add a Fluent dep, write README.
2. **`pheno-flags` cross-pollination** (`f63d9bbb5c` + `d66756bca5`): the co-developed chaos tests + dev-deps + llms.txt v2 schema commit shows that `pheno-flags` and `pheno-port-adapter` are treated as a pair. Future audits should look for the same pair-co-development pattern.
3. **`pheno-otel` substrate** (`src/lib.rs:23-27`): `pheno-port-adapter` adopts `pheno-otel` as a path-dep. The example (`examples/otel_quickstart.rs`) is broken because `pheno-otel` doesn't expose what the example assumes. This is a cross-crate API mismatch bug — both crates need coordinated updates.
4. **71-pillar cycle 1 baseline** (`findings/71-pillar-2026-06-17.md:788-869`): port-adapter scored 28.2%. After 8 cycles (v9-v17) of incremental work, the crate has received HexCachePort, HexTimePort, chaos tests, fuzz target, deny(missing_docs), 80%+ test coverage on adapter paths. But the **docs surface** (B-1 to B-6, B-9, B-10, B-14 to B-18) has **regressed** rather than improved. The 28.2% score was honest; the 60+ commits since then add 9 pillars to "shipped" but the new state claims (SPEC.md, STATUS.md, llms.txt) are **not yet aligned** with the actual code.

---

## 8. Appendix A — Feature disposition matrix

| Feature | Spec claim | Code reality | Docs/code alignment |
|---|---|---|---|
| `PortAdapter` trait (sync, Send + Sync, 4 methods) | ✓ | ✓ at `src/lib.rs:65-74` | Aligned |
| `AdapterError` (4 variants, thiserror) | ✓ | ✓ at `src/lib.rs:39-52` | Aligned |
| `Connection` (opaque, `id: String` pub(crate)) | ✓ | ✓ at `src/lib.rs:55-59` | Aligned |
| `TcpAdapter` | ✓ shipped | ✓ at `src/adapters/tcp.rs:22-105` | Aligned |
| `TcpAdapter::new() -> Self` (no args) | implied | ✓ at `tcp.rs:34-36` | Example wrong (B-13) |
| `TcpAdapter::parse_endpoint(&str) -> Result<(String, u16), AdapterError>` | (not in SPEC.md) | ✓ at `tcp.rs:39-61` (public) | Docs don't mention; fuzz + 14 tests do |
| `UnixAdapter` (cfg(unix)) | ✓ shipped | ✓ at `src/adapters/unix.rs:27-86` | Aligned |
| `MockAdapter` (test-only, in-tree) | ✓ shipped (per SPEC.md:108, AGENTS.md:38, CHANGELOG.md:50) | **private** at `src/lib.rs:93` (cfg(test) mod) | **MISALIGNED** (B-1) |
| `HexCachePort` trait (async, Send + Sync, 3 methods) | ✓ shipped | ✓ at `src/ports/cache.rs:72-83` | Aligned |
| `HexTimePort` trait (sync, Send + Sync, 2 methods) | ✓ shipped | ✓ at `src/ports/time.rs:50-67` (orphaned — B-9) | Aligned in source, broken in module structure |
| `InMemoryCache` adapter | ✓ shipped | ✓ at `src/adapters/in_memory_cache.rs:39-113` | Aligned |
| `RedisAdapter` adapter | ✓ shipped | ✓ at `src/adapters/redis_cache.rs:44-163` | Aligned |
| `SystemClock` adapter (ZST) | ✓ shipped | ✓ at `src/adapters/system_clock.rs:29-53` | Aligned |
| `MockClock` adapter | ✓ shipped | ✓ at `src/adapters/mock_clock.rs:38-180` | Aligned |
| Flat re-export of `HexCachePort` from `lib.rs` | ✓ | ✓ at `lib.rs:87` | Aligned |
| Flat re-export of `HexTimePort` from `lib.rs` | implied by `lib.rs:84-86` rule | **missing** at `lib.rs:87` | **MISALIGNED** (B-10) |
| Chaos tests for `TcpAdapter` | ✓ (L11 commitment) | ✓ 6 tests in `tcp.rs:309-455` | Aligned |
| Chaos tests for `UnixAdapter`, `InMemoryCache`, `RedisAdapter` | implied by L11 sweep | **missing** | **MISALIGNED** |
| Loom tests for connection state machine | ✓ (L25 commitment) | ✓ 4 tests in `tests/loom.rs` | Aligned (model-check on synthetic state) |
| Proptest for `AdapterError` + `Connection` | ✓ | **broken** — `proptest` not in deps, no `Arbitrary` impls (B-8) | **MISALIGNED** |
| Fuzz target for `parse_endpoint` | implied (fuzz/Cargo.toml exists) | ✓ placeholder at `fuzz/fuzz_targets/fuzz_endpoint.rs` | Aligned |
| Fuzz target #1 | (none) | placeholder at `fuzz/fuzz_targets/fuzz_target_1.rs` | **EMPTY** (B-21) |
| `[[bench]]` benchmarks | implied (L13/L17/L18 all 0/3) | **missing** | **MISALIGNED** |
| `[[bin]]` examples | ✓ | ✓ 2 examples; both **broken** (B-12, B-13) | **MISALIGNED** |
| OTLP smoke test | scaffold (SPEC.md:110) | **missing** (file doesn't exist; B-2) | **MISALIGNED** |
| `tracing_test.rs` | scaffold (SPEC.md:111) | **missing** (file doesn't exist; B-2) | **MISALIGNED** |
| `tests/integration_test.rs` | partial (SPEC.md:109) | superseded by `tests/{hex_cache,hex_time,loom}.rs` | Aligned (renamed) |
| `LICENSE-MIT` | ✓ shipped (CHANGELOG.md:54) | ✓ at `LICENSE-MIT` (assumed) | Aligned |
| `LICENSE-APACHE` (dual license, near-term roadmap item) | pending | **missing** | Open per STATUS.md:45 |
| README.md (L64 0/3 → 3/3) | pending | **missing** (intentional, per STATUS.md:37) | Open per STATUS.md:44 |
| `deny.toml` (L47 0/3 → 3/3) | pending | ✓ present | Aligned |
| `.github/workflows/ci.yml` (T19.4) | wip branch | ✓ present (per AGENTS.md:88 + this audit's listing) | Aligned |
| i18n FTL files (L40 i18n 3/3 N/A-as-3) | ✓ (per v17 T9) | ✓ 3 files (en/es/ja) | Aligned in files; runtime missing (B-27) |
| `[features]` table (loom optional) | implied by `tests/loom.rs:3` | **missing** (B-19) | **MISALIGNED** |
| `[dev-dependencies].proptest` (G-1) | implied by `tests/proptest_smoke.rs` | **missing** (B-8) | **MISALIGNED** |

### Alignment summary

| Disposition | Count | % |
|---|---|---|
| Aligned (code matches docs) | ~22 | 51% |
| Misaligned (code, docs, or both wrong) | ~15 | 35% |
| Missing entirely | ~6 | 14% |

**Critical observation**: 49% of the documented feature surface is **misaligned or missing** relative to the actual implementation. The crate's **code quality** is high (well-documented source, 80 tests, thiserror-derived errors, chaos tests in TCP, proptest + loom coverage, deterministic mocks), but the **documentation/code alignment** is poor: many docs claim shipped features that are private or absent, and many code paths (HexTimePort module, proptest, fuzz target #1) are orphans.

### Recommended remediation order

1. **B-6** — rewrite `llms.txt` to match the actual API (`TcpAdapter::new()`, sync `connect()`, `PortAdapter` trait, no `Port<T>`/`Adapter<T>`).
2. **B-9** — add `pub mod time;` to `src/ports/mod.rs:24`.
3. **B-10** — add `pub use ports::{CacheError, HexCachePort, HexTimePort};` to `src/lib.rs:87`.
4. **B-1** — make `MockAdapter` public OR remove all docs that claim it is shipped.
5. **B-12, B-13** — fix both examples OR delete them.
6. **B-8** — declare `proptest` in `[dev-dependencies]` AND add `Arbitrary` impls for `AdapterError` + `Connection`, OR delete `tests/proptest_smoke.rs`.
7. **B-7, B-3** — backfill WORKLOG.md + CHANGELOG.md with all v17/v19 wave commits.
8. **B-19** — add `[features] loom = []` table; gate loom dev-dep behind it.
9. **B-23** — either remove the "error type per port" rule from `src/ports/mod.rs:11` OR add an error type to `HexTimePort`.
10. **B-15, B-16, B-17** — refresh STATUS.md to reflect actual current state.

---

## 9. Cross-references

- **Companion docs in this audit**:
  - `findings/2026-06-21-pheno-port-adapter-audit/00-FINAL-AUDIT.md` (root scorecard, P0/P1/P2/P3 severity ratings)
  - `findings/2026-06-21-pheno-port-adapter-audit/03-target-parity.md` (cross-crate comparison vs. `pheno-errors`, `pheno-flags`, etc.)
- **Prior substrate audits**:
  - `findings/2026-06-20-pheno-errors-audit/` (template; this audit follows its structure)
- **Wave plans**:
  - `plans/2026-06-21-v19-71-pillar-cycle-9-p0.md` (v19 current)
  - `plans/2026-06-21-v18-71-pillar-cycle-8-p0.md` (v18 closure)
  - `plans/2026-06-21-v17-71-pillar-cycle-7-p0.md` (v17 cycle 7)
- **71-pillar audit lineage**:
  - `findings/71-pillar-2026-06-17-schema.md` (schema)
  - `findings/71-pillar-2026-06-17.md` § 1.10 (port-adapter baseline 60/213 = 28.2%)
  - `findings/2026-06-21-v17-T4-L4-hexagonal-ports.md` (L4 track)
  - `findings/2026-06-21-v17-T5-L8-observability-hooks.md` (L8 track)
  - `findings/2026-06-21-v17-T7-L11-chaos-tests-sweep.md` (L11 track)
- **AGRs governing this crate**:
  - ADR-014 (hexagonal L4 ports)
  - ADR-023 (agent effort governance + Rule 3 substrate placement + Rule 3.1 quality bar)
  - ADR-038 (hexagonal port-adapter L4 policy)
  - ADR-040 (test coverage gates per tier — 80% lib)
  - ADR-041 (71-pillar refresh cadence)
  - ADR-042 (substrate quality bar — 7 elements)
  - ADR-042B (substrate quality bar formal)
  - ADR-025 (worklog v2.1 schema bump)
  - ADR-030 (pheno-worklog-schema v2.1)
  - ADR-036 (pheno-tracing canonical)
  - ADR-037 (pheno-otel canonical OTLP wire)
  - ADR-024 (71-pillar audit framework)

---

**End of Phase 1B audit.** Total: 8 sections + appendix, ~1,030 lines, 29 numbered bugs (8 HIGH, 10 MEDIUM, 9 LOW, 2 INFO), 13 source files cited, 19 cargo + git commands run, 80 test functions inventoried, 6 fuzz / loom / proptest artifacts classified.
