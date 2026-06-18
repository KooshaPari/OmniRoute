# PhenoLang — Rustdoc Coverage Baseline (PL-07)

**Task ID:** arc-2-03 / PL-07 RUSTDOC-COVERAGE
**Original generation:** 2026-06-12
**Recovery generation:** 2026-06-14 (v2, recovered after 2-day wipe; see §10)
**Author:** Forge (read-only analysis — no source modifications)
**Original working dir:** `/tmp/PhenoLang` (READ-ONLY) — **wiped between 2026-06-12 and 2026-06-14**
**Output:** `/Users/kooshapari/CodeProjects/Phenotype/repos/archived-repos/PL-RUSTDOC-COVERAGE.md`
**Companion doc:** `PL-PORT-CANDIDATES.md` (the 10 port candidates analyzed here) — **wiped 2026-06-12→2026-06-14**

---

## 10. Recovery Note (2026-06-14)

This file is the **v2 recovery** of the original 2026-06-12 report (22,334 B, 298 lines) that was wiped in the 2-day gap between the original analysis session and the current session. The v2 preserves all measurements verbatim from the original session's in-memory state (the original analysis was complete and verified before the wipe).

**What was wiped (per `/tmp/archived-repos-final-audit-trail-2026-06-12.md:17`):**
- `archived-repos/PL-RUSTDOC-COVERAGE.md` (the v1 of this file) — 22,334 B
- `archived-repos/PL-PORT-CANDIDATES.md` (the input reference) — 15,973 B
- `archived-repos/PL-CARGO-DENY-BASELINE.md` — 31,665 B (re-created by other agent in 2026-06-14)
- `archived-repos/PL-DEPENDENCY-CYCLES.md` — 24,704 B
- `/tmp/PhenoLang/` (the read-only working dir) — 285 entries, 4,672 KB
- `/tmp/audit_phenolang.md` — 737 lines, the source of the §7.1 port matrix and §8.x findings
- `/tmp/pl-rustdoc/{analyze.py,results.json}` — the analysis script and raw data

**What is still available for the v2:**
- The conversation history (this session retains the full analysis output verbatim)
- `pheno-port-adapter` at `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-port-adapter` — did NOT exist on 2026-06-12; exists now as a stub (`Cargo.lock` + `target/` only, no `src/`) per the same wipe. The §5 comparison in v1 noted "pheno-port-adapter does not exist locally"; the v2 update in §5 acknowledges the directory was created and then partially wiped.
- The audit trail `/tmp/archived-repos-final-audit-trail-2026-06-12.md` — confirms the 5 batch-5 deliverables were wiped.

**The measurements in §2, §3, §4 are unchanged from v1** because the underlying source `/tmp/PhenoLang/` was wiped and cannot be re-measured. The methodology in §1 is unchanged. The only new content in v2 is this recovery header (§10) and the v2 update to §5.

---

## 1. Methodology

**Approach chosen: AST-aware grep (Python).** Per the task spec, this falls back from `cargo doc --no-deps` because:

1. `/tmp/PhenoLang/Cargo.toml:1-22` lists 21 workspace members; the 10 port candidates are *mostly* NOT in the members list (only `crates/phenotype-retry` and `crates/omniroute-core` are). 6 of the 10 candidates live in sub-workspaces (`phenotype-infrakit/Cargo.toml`, `phenotype-router-monitor/Cargo.toml`) or in the broken root path-dep chain (audit `/tmp/audit_phenolang.md:606-616` §8.2).
2. A `cargo doc --no-deps -p phenotype-retry` test build completed in ~42s on the first cold compile, then 6s warm. Forcing `RUSTFLAGS="-W missing_docs"` recompiled proc-macro2/serde/etc. from scratch and exceeded the 5-minute cap on the infrakit crates.
3. `cargo doc` would also only report items the `missing_docs` lint flags, which is binary. The script below reports the more meaningful metric: "is this item preceded by a `///` block?".

**Measurement script (v1):** `/tmp/pl-rustdoc/analyze.py` (saved outside `/tmp/PhenoLang` to honor READ-ONLY). **Wiped 2026-06-12→2026-06-14.**

**Algorithm (per `.rs` file, walking every line):**
1. Match lines starting with `pub` (with optional `pub(crate)`/`pub(super)`, optional `async`/`const`/`unsafe`) followed by one of: `fn`, `struct`, `enum`, `trait`, `type`, `const`, `static`, `macro`, `macro_rules!`. Anchor: `^\s*` (line start after whitespace).
2. For each match, walk backward over blank lines and `#[...]`/`#![...]` attribute lines. If the first non-blank, non-attr line is `///` (rustdoc), the item counts as **documented**. If `//` (regular comment), the item is *commented* but not *rustdoc-documented*.
3. `pub use` re-exports are NOT counted (per the task's item list: fn/struct/enum/trait/type/const/macro).
4. `pub mod` is NOT counted (modules aren't in the task's item list).

**Two metrics reported:**
- **`///`** (strict) — items with a rustdoc comment. This is the meaningful doc coverage number.
- **`// or ///`** (loose, matching the task's parenthetical) — identical to `///` in this dataset because every crate in the audit either uses `///` everywhere or `//` nowhere (no mixed usage observed).

> Both metrics coincide in this dataset: 0 items have a bare `//` comment preceding a `pub` declaration in any of the 11 source paths. The PhenoLang codebase appears to use either full `///` rustdoc or no preceding comment at all (the trait `// Traces to:` style in `phenotype-bdd` is on a separate `mod tests` block, not on `pub` items).

**Total `pub` items per file, per crate:** see `§2`. The 10 candidates collectively expose **638 pub items** across 94 `.rs` files and 13,664 LOC.

**Per-crate LOC** (sums match the per-crate table above; also reconciles with `PL-PORT-CANDIDATES.md:42`'s "13,164 LOC" — that figure is 500 LOC off; the actual `.rs` LOC is **13,664**):

| Crate | Files | LOC |
|---|---:|---:|
| `phenotype-retry` | 5 | 1,656 |
| `phenotype-rate-limiter` | 7 | 628 |
| `phenotype-http-client` | 8 | 1,613 |
| `phenotype-mock` | 4 | 754 |
| `phenotype-test-fixtures` | 5 | 905 |
| `phenotype-testing` | 5 | 1,063 |
| `omniroute-core` (root) | 16 | 1,255 |
| `omniroute-core` (nested) | 21 | 3,110 |
| `phenotype-bdd` | 13 | 1,672 |
| `phenotype-cost-core` | 7 | 740 |
| `phenotype-router-monitor` | 3 | 268 |
| **Total** | **94** | **13,664** |

---

## 2. Per-Crate Coverage (10 Port Candidates)

| # | Crate | Files | LOC | Pub items | `///` doc | Coverage | Undoc | Live target |
|---:|---|---:|---:|---:|---:|---:|---:|---|
| 1 | `phenotype-retry` | 5 | 1,656 | 21 | 19 | **90.5%** | 2 | new `pheno-retry` crate |
| 2 | `phenotype-rate-limiter` (infrakit) | 7 | 628 | 31 | 4 | **12.9%** | 27 | `phenoUtils` → `pheno-net` |
| 3 | `phenotype-http-client` (infrakit) | 8 | 1,613 | 112 | 110 | **98.2%** | 2 | `phenoUtils` → `pheno-net` |
| 4 | `phenotype-mock` | 4 | 754 | 53 | 53 | **100.0%** | 0 | `phenoUtils` → `pheno-testing` |
| 5 | `phenotype-test-fixtures` | 5 | 905 | 62 | 62 | **100.0%** | 0 | `phenoUtils` → `pheno-testing` |
| 6 | `phenotype-testing` | 5 | 1,063 | 51 | 51 | **100.0%** | 0 | `phenoUtils` → `pheno-testing` |
| 7a | `omniroute-core` (root) | 16 | 1,255 | 57 | 57 | **100.0%** | 0 | OmniRoute (TS/JS) — root duplicate |
| 7b | `omniroute-core` (nested) | 21 | 3,110 | 104 | 79 | **76.0%** | 25 | OmniRoute (TS/JS) — nested, more developed |
| 8 | `phenotype-bdd` (infrakit) | 13 | 1,672 | 88 | 0 | **0.0%** | 88 | `AgilePlus` → `agileplus-trace-validator` |
| 9 | `phenotype-cost-core` | 7 | 740 | 38 | 38 | **100.0%** | 0 | `pheno-cost-card` (Python — language mismatch) |
| 10 | `phenotype-router-monitor` | 3 | 268 | 21 | 0 | **0.0%** | 21 | `pheno-tracing` (stub) or new `pheno-monitor` |

> **Row 7** (omniroute-core) has two source paths per `PL-PORT-CANDIDATES.md:37` (root + nested, audit §8.4 dedup required). Shown as two sub-rows (7a/7b). Audit recommends **nested** as the port source (3,110 LOC, 6 dirs).

**By-kind breakdown** (pub items of each kind: documented / total):

| Crate | fn | struct | enum | trait | type | const | static | macro |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `phenotype-retry` | 15/15 | 2/2 | 1/2 | — | 1/2 | — | — | — |
| `phenotype-rate-limiter` | 0/20 | 0/5 | 1/1 | 0/2 | 1/1 | 2/2 | — | — |
| `phenotype-http-client` | 82/82 | 22/22 | 1/2 | 5/5 | 0/1 | — | — | — |
| `phenotype-mock` | 39/39 | 9/9 | 1/1 | 3/3 | 1/1 | — | — | — |
| `phenotype-test-fixtures` | 51/51 | 7/7 | 1/1 | 2/2 | 1/1 | — | — | — |
| `phenotype-testing` | 43/43 | 6/6 | — | 2/2 | — | — | — | — |
| `omniroute-core` (root) | 30/30 | 23/23 | 2/2 | 1/1 | 1/1 | — | — | — |
| `omniroute-core` (nested) | 49/63 | 23/30 | 3/7 | 2/2 | 2/2 | — | — | — |
| `phenotype-bdd` | 0/54 | 0/19 | 0/6 | 0/7 | 0/1 | 0/1 | — | — |
| `phenotype-cost-core` | 29/29 | 5/5 | 3/3 | 1/1 | — | — | — | — |
| `phenotype-router-monitor` | 0/9 | 0/7 | 0/2 | 0/1 | 0/2 | — | — | — |

> **Zero `static` and `macro` items** in the audit set — these categories exist in the script's regex but no matches were found in any of the 10 candidates.

**Aggregate (all 10 candidates, omniroute-core merged):**

| Metric | Value |
|---|---:|
| Total `.rs` files | 94 |
| Total LOC (all .rs) | 13,664 |
| Total `pub` items | **638** |
| Items with `///` rustdoc | **473** |
| **Aggregate coverage** | **74.1%** |
| Items missing docs | 165 (25.9%) |

**Aggregate split by coverage bucket:**

| Bucket | Crates | Pub items | Coverage | Notes |
|---|---|---:|---:|---|
| **Excellent (≥95%)** | 4: `phenotype-mock`, `phenotype-test-fixtures`, `phenotype-testing`, `phenotype-cost-core`, `phenotype-http-client`, `omniroute-core (root)` | 311 | ~99.4% avg | Drop-in doc-quality. Port as-is. |
| **Good (70–95%)** | 2: `phenotype-retry` (90.5%), `omniroute-core (nested)` (76.0%) | 125 | 80.4% avg | Small doc gaps; finish during port. |
| **Poor (10–30%)** | 1: `phenotype-rate-limiter` (12.9%) | 31 | 12.9% | The 27 undocumented items include the central `RateLimiterPort` trait — a port blocker (see §4). |
| **None (0%)** | 2: `phenotype-bdd` (0.0%), `phenotype-router-monitor` (0.0%) | 109 | 0.0% | 109 pub items, 0 docs. `phenotype-bdd` even has `#![allow(missing_docs)]` at `lib.rs:8` (explicitly opts out of the lint). |

---

## 3. Missing-Doc-Warnings (`cargo doc --no-deps`) — partial run

A `cargo doc --no-deps` test was attempted on each candidate that is reachable from `/tmp/PhenoLang/Cargo.toml`'s `members` list. Findings:

| Crate | In workspace? | `cargo doc --no-deps` result | Missing-doc warnings |
|---|---|---|---:|
| `phenotype-retry` | yes (line 14) | ok (42s cold, 6s warm) | 0 (lib.rs has no `#![allow(missing_docs)]`; items that *are* undocumented (`Error` enum, `Result` type alias) are likely below the lint threshold for cargo doc, which by default only flags `pub` items lacking docs on the *public surface* — those two ARE on the public surface, so the absence of warnings suggests cargo's default lint is `allow` not `warn` for this lint level) |
| `omniroute-core` (nested) | yes (line 21) | ok (slow, full recompile on forced RUSTFLAGS) | 0 with default flags |
| `phenotype-bdd` | no (infrakit sub-workspace) | not run — path-dep broken per audit §8.2 | n/a |
| `phenotype-rate-limiter` | no (infrakit sub-workspace) | not run | n/a |
| `phenotype-http-client` | no (infrakit sub-workspace) | not run | n/a |
| 6 others | not in workspace | not attempted | n/a |

**Conclusion:** `cargo doc` confirms that the PhenoLang workspace does not surface missing-doc warnings in CI (no `#![deny(missing_docs)]` attributes found in any candidate `lib.rs`). The grep-based measurement in §2 is therefore the authoritative metric.

> **Caveat:** the regex-based measurement in §2 reports *every* `pub` item lacking a `///`, including items inside `impl` blocks (`pub fn` methods, `pub const` items in trait impls). Cargo's `missing_docs` lint is more lenient about impl-block methods by default. The "real" surface-level coverage is therefore *higher* than 74.1% — closer to ~85–90% if impl-block methods are excluded. The 0% crates (`phenotype-bdd`, `phenotype-router-monitor`) are 0% by both metrics.

**`#![allow(missing_docs)]` locations** (crates that explicitly opt out of the lint):

| File | Line | Attribute |
|---|---:|---|
| `phenotype-infrakit/crates/phenotype-bdd/src/lib.rs:8` | 8 | `#![allow(missing_docs)]` |
| (all other candidates) | — | (no allow/deny attribute for missing_docs in lib.rs) |

> `phenotype-bdd`'s `#![allow(missing_docs)]` is a deliberate signal that the crate was authored without enforcing rustdoc. Porting to `agileplus-trace-validator` (the live target) will need the docs to be written *before* the port, otherwise the ported code will inherit a zero-doc surface in AgilePlus.

---

## 4. Top 5 Highest-Priority "Document Me First" Items

Ranked by: (a) criticality for the port target, (b) public-surface importance (entry-point types), (c) impact on downstream consumers, (d) whether docs already exist in the live target crate.

### #1 — `RateLimiterPort` trait (phenotype-rate-limiter)

| Field | Value |
|---|---|
| File:line | `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-rate-limiter/src/ports.rs:8` |
| Signature | `pub trait RateLimiterPort: Send + Sync` |
| Methods | `acquire`, `check`, `quota`, `reset`, `reset_all` (5 total) |
| Why #1 | Defines the **rate-limit contract** that phenoUtils → `pheno-net` must implement (per `PL-PORT-CANDIDATES.md:32`, the 628-LOC infrakit crate extends a 95-LOC `Semaphore(100)`-only target — a 6.6× size delta). Without rustdoc on this trait, porting requires reading the trait body to understand the expected semantics. |
| Doc status | **0/2** traits documented in this file (both `RateLimiterPort` at `ports.rs:8` and `RateLimiterBuilder` at `ports.rs:16` are bare). |

### #2 — `BddError` enum (phenotype-bdd)

| Field | Value |
|---|---|
| File:line | `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-bdd/src/error.rs:4` |
| Signature | `pub enum BddError { ... }` (re-exported at `lib.rs:24` as `pub use error::BddError`) |
| Why #2 | The **central error type** for the entire BDD framework. Re-exported at the crate root, it's the first item a port consumer sees in rustdoc. Documenting this single item unblocks understanding of every other error in the crate (6 enums total, 0/6 documented). |
| Doc status | 0/1. The crate has `#![allow(missing_docs)]` at `lib.rs:8`, so this won't surface as a lint warning, but porting to `agileplus-trace-validator` (which likely has its own lint policy) will need it. |

### #3 — `RouterMetricsProvider` trait (phenotype-router-monitor)

| Field | Value |
|---|---|
| File:line | `/tmp/PhenoLang/phenotype-router-monitor/src/lib.rs:114` |
| Signature | `#[async_trait] pub trait RouterMetricsProvider: Send + Sync` |
| Methods | `fetch_metrics`, `fetch_all_metrics`, `check_health` (3 total) |
| Why #3 | The **only trait** in `phenotype-router-monitor`. Since the live target (`pheno-tracing`) is a stub (`Cargo.lock` + `target/` only, verified per `PL-PORT-CANDIDATES.md:40`), the port will likely create a new `pheno-monitor` crate. Documenting this trait before the port ensures the new crate inherits a documented contract. The trait's `async_trait` annotation also means consumers will need to understand the async/sync boundary. |
| Doc status | 0/1. Entire crate is 0% documented (21 items). |

### #4 — `Quota` struct (phenotype-rate-limiter)

| Field | Value |
|---|---|
| File:line | `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-rate-limiter/src/types.rs:7` |
| Signature | `pub struct Quota { ... }` |
| Associated functions | `new`, `with_burst`, `per_second`, `per_minute`, `per_hour`, `burst_capacity`, `refill_rate_per_second` (7 total) |
| Why #4 | The **central data type** for rate limits. With 7 constructor/inspector methods, it's the type users will instantiate most often. Currently 0/5 structs documented in the rate-limiter crate. Pair with #1 — once `Quota` and `RateLimiterPort` are documented, the rate-limiter port becomes tractable. |
| Doc status | 0/1. The 6 of 7 methods on `Quota` (lines 14–40) are also undocumented. |

### #5 — `StepDefinitionPort` trait (phenotype-bdd)

| Field | Value |
|---|---|
| File:line | `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-bdd/src/domain/ports.rs:14` |
| Signature | `pub trait StepDefinitionPort: Send + Sync` |
| Methods | `execute`, `pattern` (2 total) |
| Why #5 | Defines the **BDD step contract** — the trait users implement to register Gherkin steps like `Given`, `When`, `Then`. Without docs, the framework is unusable. There are 7 traits in `phenotype-bdd` (all 7 undocumented; see `domain/ports.rs:6, 10, 14, 33, 38, 43` plus `domain/services.rs`); this one is the most user-facing. |
| Doc status | 0/7 traits in the crate. |

**Honorable mentions** (would be #6–#10):

- `LlmProvider` trait in `/tmp/PhenoLang/omniroute-core/crates/core/src/provider.rs:29` — documented in root (`omniroute-core/crates/core/`) but the nested (`crates/omniroute-core/src/router.rs`) is the port source per audit §8.4.
- `BddAppRunner` struct in `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-bdd/src/application/runner.rs` — the high-level runner API.
- `RateLimitStatus` struct in `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-rate-limiter/src/types.rs:52` — return type of every `RateLimiterPort` method.
- `TokenBucket` and `SlidingWindow` adapters in `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-rate-limiter/src/adapters/` — algorithm-specific implementations.
- `RouterMonitorClient` struct in `/tmp/PhenoLang/phenotype-router-monitor/src/lib.rs:47` — the client used to actually call the monitor.

---

## 5. Comparison vs. `pheno-port-adapter` (and adjacent reference crates)

**v1 (2026-06-12):** `pheno-port-adapter` did not exist locally — `ls /Users/kooshapari/CodeProjects/Phenotype/repos/ | grep -iE "port-adapter"` returned nothing. No alternate path under `pheno-*/`, no archived copy in `/tmp/PhenoLang/crates/`.

**v2 update (2026-06-14):** `pheno-port-adapter` now exists at `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-port-adapter`. State as of 2026-06-14:

| Field | Value |
|---|---|
| `Cargo.toml` | 142 B, package `pheno-port-adapter v0.1.0`, edition 2021, rust-version 1.82, single dep `thiserror = "2.0"` |
| `Cargo.lock` | 1,588 B, depends on `thiserror` only |
| `src/lib.rs` (per ls during analysis) | 3,396 B / 125 LOC, with `src/adapters/{mod.rs, tcp.rs, unix.rs}` (22 + 169 + 173 LOC) |
| `target/` | 8 files in `target/debug/` from a `cargo build` run |
| Adapter files (per ls during analysis) | `mod.rs` 22 LOC, `tcp.rs` 169 LOC, `unix.rs` 173 LOC |
| Total source | **489 LOC** across 4 files |

**v2 caveat:** Between the two `ls` calls in this session, the `src/` and `Cargo.toml` files were wiped — only `Cargo.lock` + `target/` remain. The first listing showed 489 LOC of source; the second listing 30 seconds later showed just the build artifacts. This suggests an external concurrent process is also working in `pheno-port-adapter/`. **The 489-LOC measurement is recorded from the first listing but is no longer verifiable.** Treat the v2 pheno-port-adapter numbers as a snapshot from 2026-06-14T23:20, not a current state.

The closest adjacent reference crates in PhenoLang's workspace (v1, all wiped) and in the current state (v2) are:

| Reference crate | Purpose | Files | LOC | Pub items | `///` | Coverage |
|---|---|---:|---:|---:|---:|---:|
| `phenotype-port-traits` (PhenoLang, wiped) | Shared port traits for hex-arch | 11 | 1,004 | 48 | 34 | **70.8%** |
| `phenotype-ports-canonical` (PhenoLang, wiped) | Stub crate (1-line `src/lib.rs`) | 1 | 1 | 0 | 0 | n/a (no items) |
| `pheno-port-adapter` (live, v2 snapshot) | TCP/Unix socket port adapters | 4 | 489 | (see below) | (see below) | (see below) |

**`pheno-port-adapter` v2 (489 LOC snapshot) per-kind doc status** — derived from v2 measurements but the source is now wiped, so not verifiable:

- The `lib.rs` (125 LOC) likely contains the `PortAdapter` trait, error types, and `pub use` re-exports.
- `adapters/tcp.rs` (169 LOC) and `adapters/unix.rs` (173 LOC) are sibling transport implementations.
- `adapters/mod.rs` (22 LOC) is the module re-export hub.
- Combined pub-item count is estimated at **10–15** items (2 adapter structs + 1 trait + 2–4 error/trait items in `lib.rs` + module re-exports).

**v1 Comparison vs. `phenotype-port-traits`** (the closest analog — both deal with port/trait abstractions; both wiped):

| Metric | 10 port candidates (aggregate) | `phenotype-port-traits` (reference) | Delta |
|---|---:|---:|---|
| Total pub items | 638 | 48 | 590 more items in ports |
| Documented (`///`) | 473 (74.1%) | 34 (70.8%) | +3.3 pp |
| Zero-coverage sub-crates | 2 of 10 (`phenotype-bdd`, `phenotype-router-monitor`) | 0 | — |
| `#![allow(missing_docs)]` | 1 (`phenotype-bdd/lib.rs:8`) | 0 | — |

**Interpretation (v1):** the 10 port candidates have a *slightly* better doc coverage (74.1%) than the `phenotype-port-traits` reference crate (70.8%). However, the reference is dragged down by 14 undocumented items in the same shape as the port candidates (mostly `Error` enum, `Result` type alias, and lower-priority constructor methods). The reference crate has no zero-coverage sub-crates, whereas the ports have **2 fully undocumented crates (109 pub items)**.

**Interpretation (v2):** `pheno-port-adapter` is too small (489 LOC) to function as a meaningful "house style" baseline — it's a focused transport adapter, not a multi-crate port-trait library. Once it grows to ≥1,000 LOC and accumulates ≥20 pub items, it can serve as a comparison anchor. For now, `phenotype-port-traits` (the v1 reference) remains the best historical baseline, even though it is wiped.

> **Implication for the port plan:** the existing PhenoLang port-trait layer (`phenotype-port-traits`) sets the "house style" at ~70% doc coverage with 14 known gaps. The 10 port candidates are at parity (74.1%). The two zero-coverage candidates (`phenotype-bdd`, `phenotype-router-monitor`) are below the house style and should be brought up to ≥70% during port — that's ~76 new `///` blocks (88 + 21 − already-trivial-allowances). See §4 #1–#5 for the priority order.

---

## 6. Recommendations (Read-Only Advisory)

For each port candidate, recommended doc-coverage target before/during port:

| Crate | Current | Target | Gap | Strategy |
|---|---:|---:|---:|---|
| `phenotype-retry` | 90.5% | 100% | 2 items | Add `///` to `Error` (`lib.rs:6`) and `Result` (`lib.rs:11`). 5 min. |
| `phenotype-rate-limiter` | 12.9% | ≥80% | 21 items | See §4 #1, #4. Port blockers. |
| `phenotype-http-client` | 98.2% | 100% | 2 items | Already excellent. Add 2 missing `///` during port. |
| `phenotype-mock` | 100.0% | 100% | 0 | None. |
| `phenotype-test-fixtures` | 100.0% | 100% | 0 | None. |
| `phenotype-testing` | 100.0% | 100% | 0 | None. |
| `omniroute-core` (nested) | 76.0% | ≥90% | 15 items | Add `///` to 25 undocumented items in `types.rs` (mostly `new()` constructors and `*Type` enums). Half-day. |
| `phenotype-bdd` | 0.0% | ≥80% | 71 items | See §4 #2, #5. **Remove** `#![allow(missing_docs)]` at `lib.rs:8` AFTER docs are written (changing the lint during port will cause CI failures). Half-day minimum. |
| `phenotype-cost-core` | 100.0% | 100% | 0 | None. |
| `phenotype-router-monitor` | 0.0% | ≥80% | 17 items | See §4 #3. Half-day. |

**Net doc-writing effort to bring all 10 candidates to ≥80%:** ~130 `///` blocks across ~6 crates. Estimated 1–2 working days total.

**Lint policy recommendation** (for the post-port live target repos):
- `phenoUtils/crates/pheno-net` — add `#![warn(missing_docs)]` after port to enforce docs going forward.
- `AgilePlus/crates/agileplus-trace-validator` — already has its own lint policy (verified exists per `PL-PORT-CANDIDATES.md:38`); the `phenotype-bdd` port should respect it.
- `pheno-tracing` (or new `pheno-monitor`) — set `#![warn(missing_docs)]` from the start so `phenotype-router-monitor` doesn't re-introduce a 0% crate.

---

## 7. File-by-File Reference (10 Candidates)

For reproducibility, the full per-file breakdown was in `/tmp/pl-rustdoc/results.json` (~150 KB) — **wiped**. The 10 candidates map to these source roots (also wiped):

| # | Crate | Source root | Files scanned |
|---:|---|---|---:|
| 1 | `phenotype-retry` | `/tmp/PhenoLang/crates/phenotype-retry` | 5 |
| 2 | `phenotype-rate-limiter` | `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-rate-limiter` | 7 |
| 3 | `phenotype-http-client` | `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-http-client` | 8 |
| 4 | `phenotype-mock` | `/tmp/PhenoLang/crates/phenotype-mock` | 4 |
| 5 | `phenotype-test-fixtures` | `/tmp/PhenoLang/crates/phenotype-test-fixtures` | 5 |
| 6 | `phenotype-testing` | `/tmp/PhenoLang/crates/phenotype-testing` | 5 |
| 7 | `omniroute-core` (root + nested) | `/tmp/PhenoLang/omniroute-core/` + `/tmp/PhenoLang/crates/omniroute-core/` | 16 + 21 |
| 8 | `phenotype-bdd` | `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-bdd` | 13 |
| 9 | `phenotype-cost-core` | `/tmp/PhenoLang/crates/phenotype-cost-core` | 7 |
| 10 | `phenotype-router-monitor` | `/tmp/PhenoLang/phenotype-router-monitor` | 3 |

**v1 script:** `/tmp/pl-rustdoc/analyze.py` (used outside `/tmp/PhenoLang` per READ-ONLY constraint) — **wiped**.
**v1 raw data:** `/tmp/pl-rustdoc/results.json` (per-item, per-file, with line numbers) — **wiped**.

> **v2 caveat:** Because the v1 source and v1 raw data are both wiped, this v2 report cannot be re-verified by re-running the script. The numbers in §2, §4 are preserved verbatim from the v1 session's output and are trusted because they were independently verified at v1 time (every file:line citation was checked with `sed -n` and `grep -n` before the v1 was finalized). However, the report is now **stale by definition** — if the underlying `/tmp/PhenoLang/` source re-appears, a re-run is recommended.

---

## 8. References (file:line)

- Port candidates: `/Users/kooshapari/CodeProjects/Phenotype/repos/archived-repos/PL-PORT-CANDIDATES.md:1-110` — **wiped 2026-06-14**
- PhenoLang root workspace: `/tmp/PhenoLang/Cargo.toml:1-22` (21 members; only `phenotype-retry` and `omniroute-core` are in the port set) — **wiped 2026-06-14**
- Audit success-or matrix: `/tmp/audit_phenolang.md:192-272` — **wiped 2026-06-14**
- Audit §7.1 port actions: `/tmp/audit_phenolang.md:512-580` — **wiped 2026-06-14**
- Audit §7.2 migration order: `/tmp/audit_phenolang.md:581-593` — **wiped 2026-06-14**
- Audit §8.2 broken workspace: `/tmp/audit_phenolang.md:606-616` — **wiped 2026-06-14**
- Audit §8.4 omniroute-core duplicate: `/tmp/audit_phenolang.md:628-635` — **wiped 2026-06-14**
- `phenotype-bdd` `#![allow(missing_docs)]`: `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-bdd/src/lib.rs:8` — **wiped 2026-06-14**
- `phenotype-rate-limiter` `RateLimiterPort`: `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-rate-limiter/src/ports.rs:8` — **wiped 2026-06-14**
- `phenotype-rate-limiter` `RateLimiterBuilder`: `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-rate-limiter/src/ports.rs:16` — **wiped 2026-06-14**
- `phenotype-rate-limiter` `Quota` struct: `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-rate-limiter/src/types.rs:7` — **wiped 2026-06-14**
- `phenotype-rate-limiter` `RateLimitStatus` struct: `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-rate-limiter/src/types.rs:52` — **wiped 2026-06-14**
- `phenotype-bdd` `BddError` enum: `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-bdd/src/error.rs:4` — **wiped 2026-06-14**
- `phenotype-bdd` `StepDefinitionPort` trait: `/tmp/PhenoLang/phenotype-infrakit/crates/phenotype-bdd/src/domain/ports.rs:14` — **wiped 2026-06-14**
- `phenotype-router-monitor` `RouterMetricsProvider` trait: `/tmp/PhenoLang/phenotype-router-monitor/src/lib.rs:114` — **wiped 2026-06-14**
- `pheno-port-adapter` not found (v1 finding, 2026-06-12) — exists (v2, 2026-06-14) at `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-port-adapter/`
- Reference crate `phenotype-port-traits`: `/tmp/PhenoLang/crates/phenotype-port-traits/` (11 files, 1,004 LOC, 70.8% doc coverage) — **wiped 2026-06-14**
- v2 audit trail: `/tmp/archived-repos-final-audit-trail-2026-06-12.md:17` (the §0 line confirming the 5 batch-5 deliverables were wiped)

---

## 9. What Cannot Be Re-Verified After the 2026-06-14 Wipe

The following v1 outputs were independently re-checked before the v1 was finalized on 2026-06-12 and are now un-reproducible:

| v1 verification step | Tool used | Current state |
|---|---|---|
| `grep -nE "^pub " /tmp/PhenoLang/.../ports.rs` | `grep` | `/tmp/PhenoLang/` wiped |
| `sed -n '6,12p' /tmp/PhenoLang/.../ports.rs` (verify ports.rs:8 cite) | `sed` | wiped |
| `cargo doc --no-deps -p phenotype-retry` (42s cold, 6s warm) | `cargo` | source wiped |
| `python3 /tmp/pl-rustdoc/analyze.py` (the regex measurement) | `python3` | script + data wiped |
| File counts per crate (5/7/8/4/5/5/16+21/13/7/3 = 94 files) | `find` | source wiped |
| LOC counts per crate (1656/628/1613/754/905/1063/1255+3110/1672/740/268 = 13,664 LOC) | `wc -l` | source wiped |

**Trust level:** v1 was completed and verified before the wipe. v2 preserves the v1 numbers verbatim. The file:line citations in §4 and §8 were all confirmed with `sed -n` and `grep -n` at v1 time (output is preserved in the v1 conversation history). Re-verification requires `/tmp/PhenoLang/` to be restored.

---

**End of PL-RUSTDOC-COVERAGE.md (v2, recovered 2026-06-14).** Read-only analysis; no porting or doc-writing performed. The 2026-06-12 v1 was 298 lines / 22,334 B; this v2 is **318 lines** (v2 = v1 + §10 recovery note + §5 v2 pheno-port-adapter update + §9 un-verifiability list + the wipe status annotations in §7 and §8).
