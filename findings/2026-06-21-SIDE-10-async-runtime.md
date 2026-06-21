# SIDE-10 — Async Runtime Consistency Across the pheno-* Rust Fleet

**Date:** 2026-06-21 (PDT)
**Author:** orchestrator (v19 cycle-9 P1 sweep)
**Status:** COMPLETE — 5/5 repos audited
**Track:** SIDE-10 (cross-cutting)
**Related:** v17 T6 / L10 async runtime decision (ADR-088 planned); v19 cycle-9 P1 reduction wave

> **Snapshot note (important).** This audit was performed against the working tree on 2026-06-21 between 13:30-13:50 PDT. During the audit window, several pheno-* subdirectories changed state (e.g. `pheno-context/` appeared, then disappeared; `pheno-config/` gained a `Cargo.lock` and `src/`). Where a file was present at audit time and absent at write time, this is noted in § 3 and § 8. All line citations below were re-verified against the working tree at 2026-06-21 13:50 PDT before publishing.

---

## 1. Executive Summary

The pheno-* Rust fleet is **100 % tokio** (for the 2 repos that need an async runtime). No `async-std` and no `smol` usage was found in any of the 5 audited repos or in the wider `pheno-*` source tree (full sweep, see § 5). This validates the v17 T6 / L10 decision (`plans/2026-06-21-v17-71-pillar-cycle-7-p0.md:43-45`) that named tokio as the existing precedent and target runtime.

**Per-repo runtime summary (5 repos):**

| # | Repo | Async runtime | Lock-resolved version | Feature policy | MSRV | Cargo.toml in cone? |
|---|---|---|---|---|---|---|
| 1 | `pheno-errors` | **none (sync)** | n/a | n/a | **unspecified** | yes |
| 2 | `pheno-otel` | **none (sync)** | n/a | n/a | 1.75 | yes |
| 3 | `pheno-config` | **none (sync)** | n/a (lock shows only `zeroize 1.9.0`) | n/a | unspecified (no Cargo.toml in cone) | **no (Cargo.lock only)** |
| 4 | `pheno-port-adapter` | **tokio** | **1.52.3** | minimal (`rt-multi-thread, macros, sync, time`) | 1.82 | yes |
| 5 | `pheno-tracing` | **tokio** | **1.52.3** | `full` | 1.75 | yes |

**Headline findings:**

- **F-1 (positive):** Both async-using repos converge on tokio. No fragmentation. ADR-088's target is already met.
- **F-2 (mismatch):** tokio feature-flag policy diverges between `pheno-port-adapter` (minimal: `rt-multi-thread, macros, sync, time`) and `pheno-tracing` (`full`). Both work, but the divergence is unjustified.
- **F-3 (gap):** `pheno-config` exists with `src/`, `tests/`, `Cargo.lock`, but its `Cargo.toml` is absent from this branch's sparse-checkout cone. Verifiability gap (cannot confirm MSRV or declared feature sets).
- **F-4 (gap):** The v17 T6 ADR doc (`docs/architecture/async-runtime-decision.md`) was approved in plan (`plans/2026-06-21-v17-71-pillar-cycle-7-p0.md:43-45`) but was never authored. This SIDE-10 doubles as the formal record.
- **F-5 (positive):** Lock-resolved tokio versions are identical (1.52.3) for both repos with lock files. `async-trait` is also identical (0.1.89). No patch-version drift.
- **F-6 (gap):** No fleet-wide policy banning `async-std` / `smol` from `pheno-*` Cargo.toml. The 100 % tokio adoption is convention, not enforcement.
- **F-7 (mismatch):** MSRV floor is divergent — `pheno-port-adapter` requires 1.82, `pheno-otel` and `pheno-tracing` require 1.75, `pheno-errors` and `pheno-config` declare no MSRV.

---

## 2. Methodology

For each of the 5 repos:

1. Read `Cargo.toml` (when present in the sparse-checkout cone) and capture declared async-runtime deps, feature flags, and MSRV.
2. Read `Cargo.lock` (when present) and record the lock-resolved version.
3. Scan `src/**/*.rs` and `tests/**/*.rs` for `use tokio`, `use async_std`, `use smol`, `use async_trait`, `async fn`, `.await`, `#[tokio::test]`, etc.
4. Note any declared but unused or used but undeclared runtime.
5. Cross-reference v17 T6 plan and any sibling ADRs.

Sparse-checkout cone for this branch (sparse-checkout cone-mode is `true`, see AGENTS.md "Stale / warnings"): excludes the actual `Cargo.toml` for `pheno-config`, `pheno-context`, and `pheno-flags`. The audit compensates by reading source files and any available `Cargo.lock`. A previous version of this draft used `pheno-context/src/oidc.rs` as the 5th repo's source of truth; that file disappeared from the working tree mid-audit (the v19 T3 OIDC federation track work landed and replaced it with a synchronous `parking_lot::RwLock`-based implementation in `FocalPoint/pheno-context/src/oidc.rs`). The 5th repo in this final draft is `pheno-config`, whose `Cargo.lock` is in the cone and whose `src/` tree shows zero async usage.

---

## 3. Per-Repo Findings

### 3.1 pheno-errors

**File:** `pheno-errors/Cargo.toml`

- Async runtime: **none** (sync only).
- Declared deps (`pheno-errors/Cargo.toml:9-17`):
  - `anyhow = "1"` (`pheno-errors/Cargo.toml:10`)
  - `thiserror = "2"` (`pheno-errors/Cargo.toml:11`)
  - `tracing = "0.1"` (`pheno-errors/Cargo.toml:12`)
  - `serde = { version = "1", features = ["derive"] }` (`pheno-errors/Cargo.toml:13`)
  - `pheno-otel = { path = "../pheno-otel" }` (`pheno-errors/Cargo.toml:17`)
- Dev-deps (`pheno-errors/Cargo.toml:19-21`):
  - `proptest = "1"` (`pheno-errors/Cargo.toml:20`)
  - `tracing-test = "0.2"` (`pheno-errors/Cargo.toml:21`)
- MSRV: **not declared** (no `rust-version` field anywhere in the file).
- Sync-only by design: pure error-substrate crate that consolidates 5 common error patterns into a single `AppError` type. No I/O, no async calls.

**Verdict:** No change needed. A substrate error crate should not depend on a runtime; staying sync keeps it usable from tokio, async-std, smol, and sync contexts alike.

---

### 3.2 pheno-otel

**File:** `pheno-otel/Cargo.toml`

- Async runtime: **none** (sync only).
- Declared deps (`pheno-otel/Cargo.toml:24-26`):
  - `thiserror = "2"`
  - `serde = { version = "1.0", features = ["derive"] }`
  - `serde_json = "1.0"`
- Dev-deps: empty (per comment: "Reserved for OTLP smoke test fixtures").
- MSRV: 1.75 (`pheno-otel/Cargo.toml:5`).
- Sync-only by design: pure wire-format substrate. It serializes OTLP messages to bytes; the *transport* (HTTP/gRPC) is the consumer's responsibility. ADR-037 / substrate-37 explicitly excludes a runtime so the substrate stays runtime-agnostic.

**Verdict:** No change needed. Sync wire-format is the right substrate boundary; transport adapters belong in a separate crate (e.g. `pheno-otel-transport` if one is needed).

**Note:** `pheno-otel/Cargo.toml:11` lists `categories = ["development-tools", "api-bindings", "asynchronous"]`. The `asynchronous` category is aspirational (the crate is OTLP-ready, runtime-agnostic); it does not imply a tokio dep. No action needed.

---

### 3.3 pheno-config

**Files:** `pheno-config/Cargo.lock` (present in cone); `pheno-config/src/cascade.rs`, `pheno-config/src/secrets.rs` (present); `pheno-config/Cargo.toml` **absent from this branch's sparse-checkout cone**.

- Async runtime: **none** (sync only).
- Lock-resolved deps (`pheno-config/Cargo.lock`): the only non-pheno-config package listed is `zeroize 1.9.0`. No tokio, async-trait, async-std, smol, or futures anywhere in the lock.
- Source usage scan (`pheno-config/src/*.rs`, `pheno-config/tests/*.rs`): zero matches for `use tokio`, `async fn`, `.await`, `#[tokio::test]`, `async-trait`, `async_std`, `smol`. Only matches were `#[test]` (4 instances in `cascade.rs` / `secrets.rs`).
- MSRV: **unknown** — no Cargo.toml in cone to inspect.

**Verdict:** sync, no async deps. Adding `Cargo.toml` to the sparse-checkout cone is the only outstanding action; no async consistency work needed in the crate itself.

---

### 3.4 pheno-port-adapter

**File:** `pheno-port-adapter/Cargo.toml`

- Async runtime: **tokio** (declared and locked).
- Declared deps (`pheno-port-adapter/Cargo.toml:9-30`):
  - `thiserror = "2.0"` (`pheno-port-adapter/Cargo.toml:10`)
  - **tokio** = `{ version = "1", features = ["rt-multi-thread", "macros", "sync", "time"] }` (`pheno-port-adapter/Cargo.toml:16`)
  - `async-trait = "0.1"` (`pheno-port-adapter/Cargo.toml:20`)
  - `redis = { version = "0.27", default-features = false, features = ["tokio-comp", "connection-manager"] }` (`pheno-port-adapter/Cargo.toml:24`)
  - `pheno-otel = { path = "../pheno-otel" }` (`pheno-port-adapter/Cargo.toml:30`)
- Dev-deps (`pheno-port-adapter/Cargo.toml:32-34`):
  - `serde_json = "1"` (`pheno-port-adapter/Cargo.toml:33`)
  - **dev-deps tokio** = `{ version = "1", features = ["macros", "rt-multi-thread"] }` (`pheno-port-adapter/Cargo.toml:34`)
- Cargo.toml comment (`pheno-port-adapter/Cargo.toml:11-15`) explicitly justifies the tokio choice: *"Async runtime backing the hex-port traits (HexCachePort, HexTimePort, ...). Kept as a normal dep (not just dev-deps) because the hex-port adapters return `impl Future` from their `async fn` methods; tokio's macros and runtime are needed at compile time even when callers drive the adapters from a different executor."*
- Lock-resolved versions (`pheno-port-adapter/Cargo.lock`):
  - `tokio` → **1.52.3**
  - `async-trait` → **0.1.89**
  - `futures` → **0.3.32** (transitive via `redis 0.27`)
- MSRV: **1.82** (`pheno-port-adapter/Cargo.toml:5`).
- Fuzz crate (`pheno-port-adapter/fuzz/Cargo.toml`): no tokio — `libfuzzer-sys = "0.4"` only.

**Feature-flag analysis:**

- Main (`pheno-port-adapter/Cargo.toml:16`): `rt-multi-thread + macros + sync + time`. Does *not* include `rt` explicitly, but `rt-multi-thread` is a superset of `rt`, so the runtime is always available.
- Dev (`pheno-port-adapter/Cargo.toml:34`): `macros + rt-multi-thread` only — drops `sync` and `time`. Tests that touch `tokio::sync::*` or `tokio::time::*` would fail to compile. No such test exists today; this is a latent footgun if a future test touches `tokio::sync::RwLock` or `tokio::time::timeout`.

**Verdict:** tokio, minimal-feature philosophy. Version-alignment is perfect (1.52.3). The feature split between main and dev-deps is risky (see § 6 R-2).

---

### 3.5 pheno-tracing

**File:** `pheno-tracing/Cargo.toml`

- Async runtime: **tokio** (declared and locked).
- Declared deps (`pheno-tracing/Cargo.toml:25-38`):
  - `async-trait = "0.1"` (`pheno-tracing/Cargo.toml:26`)
  - `pheno-otel = { path = "../pheno-otel" }` (`pheno-tracing/Cargo.toml:31`)
  - `serde = { version = "1.0", features = ["derive"] }` (`pheno-tracing/Cargo.toml:32`)
  - `serde_json = "1.0"` (`pheno-tracing/Cargo.toml:33`)
  - `thiserror = "2"` (`pheno-tracing/Cargo.toml:34`)
  - **tokio** = `{ version = "1", features = ["full"] }` (`pheno-tracing/Cargo.toml:35`)
  - `tracing = "0.1"` (`pheno-tracing/Cargo.toml:36`)
  - `tracing-subscriber = { version = "0.3", features = ["env-filter", "fmt", "json"] }` (`pheno-tracing/Cargo.toml:37`)
  - `chrono = { version = "0.4", features = ["serde"] }` (`pheno-tracing/Cargo.toml:38`)
- Dev-deps (`pheno-tracing/Cargo.toml:40-41`):
  - **dev-deps tokio** = `{ version = "1", features = ["rt", "macros", "test-util"] }` (`pheno-tracing/Cargo.toml:41`)
- Lock-resolved versions (`pheno-tracing/Cargo.lock`):
  - `tokio` → **1.52.3**
  - `async-trait` → **0.1.89**
- MSRV: **1.75** (`pheno-tracing/Cargo.toml:5`).
- Forward-compat shim (`pheno-tracing/Cargo.toml:43-50`): `tracing-0-2 = []` feature, no-op today, gated against `tracing 0.2` GA.

**Feature-flag analysis:**

- Main (`pheno-tracing/Cargo.toml:35`): `full`. Pulls in every tokio feature, including `fs`, `process`, `signal`, `parking_lot`, etc. — most of which a tracing substrate does not need.
- Dev (`pheno-tracing/Cargo.toml:41`): `rt + macros + test-util` — minimal, single-threaded runtime for tests.

**Verdict:** tokio, `full` feature philosophy. The `full` feature set inflates compile time and binary size for a substrate whose only tokio surface area is `tokio::spawn` (background flush workers), `tokio::sync::Mutex` (in-memory buffer), and `tokio::time` (debounce timers). Recommend trimming to a minimal explicit set (see § 6 R-1).

---

## 4. Fleet-Wide Consistency Matrix

| Dimension | pheno-errors | pheno-otel | pheno-config | pheno-port-adapter | pheno-tracing | Fleet verdict |
|---|---|---|---|---|---|---|
| **Runtime choice** | sync | sync | sync | tokio | tokio | 100 % tokio (2/2 async repos) |
| **tokio version (locked)** | n/a | n/a | n/a | **1.52.3** | **1.52.3** | identical where known |
| **tokio version (declared)** | n/a | n/a | n/a | `"1"` | `"1"` | identical where known |
| **Feature policy** | n/a | n/a | n/a | minimal | `full` | **divergent (see F-2)** |
| **`async-trait`** | n/a | n/a | n/a | `0.1.89` | `0.1.89` | identical where known |
| **MSRV** | unspecified | 1.75 | unspecified | **1.82** | 1.75 | **divergent (1.75 vs 1.82, plus 2 unspecified)** |
| **`async-std` usage** | none | none | none | none | none | 0/5 |
| **`smol` usage** | none | none | none | none | none | 0/5 |
| **Cargo.toml in cone?** | yes | yes | **no (lock only)** | yes | yes | sparse-checkout gap |

**No version mismatches found** between `pheno-port-adapter` and `pheno-tracing`. Both declare `tokio = "1"` and both resolve to `1.52.3`. `async-trait` is identical at `0.1.89`.

**Two divergences worth fixing:**

1. **Feature policy**: minimal vs `full`. Both work; both compile. The fleet should pick one.
2. **MSRV**: 1.75 (`pheno-otel`, `pheno-tracing`) vs 1.82 (`pheno-port-adapter`) vs unspecified (`pheno-errors`, `pheno-config`). The 1.82 floor blocks tokio-version upgrades that might land on a 1.75-only release branch. Align to 1.82 fleet-wide, or document why `pheno-port-adapter` needs the higher floor (likely a `tokio::task::unconstrained` or another 1.80+ feature — needs verification).

---

## 5. async-std / smol Absence — Sweep

To rule out accidental adoption of a competing runtime, the following was verified across the entire `pheno-*` Rust source tree (root + `pheno-config`, `pheno-errors`, `pheno-flags`, `pheno-otel`, `pheno-port-adapter`, `pheno-tracing` — note: `pheno-context/` was empty at the time of this sweep):

| Pattern | Files matched | Repos matched |
|---|---|---|
| `use async_std` / `use async_std::` | 0 | 0/5 |
| `use smol` / `use smol::` | 0 | 0/5 |
| `async_std =` in any Cargo.toml | 0 | 0/5 |
| `smol =` in any Cargo.toml | 0 | 0/5 |
| `async-std-runtime` feature on any dep | 0 | 0/5 |
| `tokio` (any) | 6 lines | 2/5 (pheno-port-adapter, pheno-tracing) |

**Conclusion:** Zero adoption of `async-std` or `smol` anywhere in the audited fleet. The 100 % tokio stance is intact.

---

## 6. Recommendations

### R-1 (P3 / nice-to-have): Standardize tokio feature-flag policy

Pick **explicit minimal feature sets** as the fleet default. `full` is a code smell for a substrate — it pulls in tokio components the crate does not need, hurts incremental compile times, and obscures the actual tokio surface area in code review.

**Proposed canonical feature set for tokio-using pheno-* substrates:**

```toml
tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time"] }
```

This matches `pheno-port-adapter`'s main-dep choice (`pheno-port-adapter/Cargo.toml:16`) and is the smallest set that supports hex-port adapters (return `impl Future` + drive tests).

**Action:**

- Update `pheno-tracing/Cargo.toml:35` to use the minimal explicit set instead of `"full"`. Audit which tokio features `pheno-tracing`'s `src/` actually uses; promote any that are missing.
- Add a fleet policy note in `docs/architecture/async-runtime-decision.md` (see R-4) that documents the chosen feature set and the rationale.
- Add a CI lint that fails any `pheno-*` Cargo.toml containing `tokio = { version = "1", features = ["full"] }` (allowlist: none).

### R-2 (P3 / latent footgun): Unify main + dev tokio feature sets

`pheno-port-adapter/Cargo.toml:16` and `pheno-port-adapter/Cargo.toml:34` declare different tokio feature sets in `[dependencies]` and `[dev-dependencies]`. The dev-dep set is a strict subset. A test that uses `tokio::sync` or `tokio::time` will fail to compile.

**Action:**

- Unify both crates' dev-dep tokio features with the main-dep set. Tests should exercise the same surface area the crate ships.
- Update `pheno-port-adapter/Cargo.toml:34` to add `"sync", "time"` to the dev-deps tokio feature list.

### R-3 (P3 / hygiene): Fix sparse-checkout cone for pheno-config

`pheno-config/` exists with `src/`, `tests/`, and `Cargo.lock` in this branch but contains no `Cargo.toml`. The lock file references `pheno-config 0.1.0` (`pheno-config/Cargo.lock:6-8`) but cannot confirm MSRV or declared feature sets.

**Action:**

- Update `.git/info/sparse-checkout` to include `pheno-config/Cargo.toml` (and likewise for `pheno-context`, `pheno-flags`, and any other pheno-* Rust repo missing its manifest).
- Alternatively, push the audit to verify against `KooshaPari/pheno-config` on GitHub directly.

### R-4 (P3 / governance gap): Author the v17 T6 ADR doc

The v17 plan (`plans/2026-06-21-v17-71-pillar-cycle-7-p0.md:43-45`) approved an ADR at `docs/architecture/async-runtime-decision.md` but the file was never written. This SIDE-10 fills the gap as an audit record, but the formal ADR should still be authored.

**Action:**

- Create `docs/architecture/async-runtime-decision.md` mirroring the structure of `docs/architecture/hexagonal-ports.md` and `docs/architecture/type-safety-convention.md`. Cite this SIDE-10 as the audit basis.
- Number it ADR-088 (per the v17 T6 plan reference).
- Promote to `docs/adr/2026-06-21/ADR-088-tokio-canonical-runtime.md` if the file moves to the ADR directory.

### R-5 (P3 / enforcement): Add deny.toml lint for forbidden runtimes

Neither `pheno-port-adapter/deny.toml` nor `pheno-tracing/deny.toml` currently bans `async-std` or `smol` as transitive deps. The 100 % tokio stance is convention only.

**Action:**

- Add a `[bans].multiple-versions = "allow"` exception for `tokio` and `async-trait` (so legitimate bumps don't trip the lint).
- Document the fleet convention in a comment at the top of each `deny.toml`: "pheno-* convention: tokio is the sole async runtime. async-std / smol / futures-runtime are forbidden."

### R-6 (P3 / MSRV): Document and align the Rust MSRV floor

`pheno-port-adapter/Cargo.toml:5` declares `rust-version = "1.82"`. `pheno-tracing/Cargo.toml:5` and `pheno-otel/Cargo.toml:5` declare `rust-version = "1.75"`. `pheno-errors/Cargo.toml` and `pheno-config/Cargo.toml` declare no MSRV at all.

**Action:**

- Add `rust-version = "1.82"` to `pheno-errors/Cargo.toml` and verify it builds.
- Decide whether the fleet floor should be 1.75 (lower barrier) or 1.82 (matches the highest individual crate). Document the choice in the new ADR-088.
- If 1.82 is the floor, verify no other pheno-* crate pins `< 1.82`.

---

## 7. Decision Matrix — Accept / Modify / Defer

| Rec | Effort | Value | Recommendation |
|---|---|---|---|
| R-1 (minimal tokio features) | 1h | M | **ACCEPT** — trim `pheno-tracing`'s `"full"` to the canonical set; add CI lint |
| R-2 (unify dev-deps tokio features) | 15m | M | **ACCEPT** — one-line patch in `pheno-port-adapter/Cargo.toml:34` |
| R-3 (sparse-checkout fix for pheno-config) | 5m | L | **ACCEPT** — update `.git/info/sparse-checkout` cone |
| R-4 (author ADR-088 doc) | 1h | M | **ACCEPT** — write `docs/architecture/async-runtime-decision.md` |
| R-5 (deny.toml ban on competing runtimes) | 30m | L | **ACCEPT** — convention-enforcement, low-cost |
| R-6 (align MSRV floor) | 30m | M | **ACCEPT** — pick 1.82, update 3 Cargo.toml files |

**Combined effort:** ~3.5h wall, ~150 LoC across 5-7 files. All P3 (informational / nice-to-have). No P0/P1/P2 blockers found.

---

## 8. Working-Tree Volatility Note

During the audit window (2026-06-21 13:30-13:50 PDT), the monorepo's working tree changed in ways that affected this audit:

- `pheno-context/` was present with `src/oidc.rs` at audit start, and contained tokio usage (`use tokio::sync::RwLock`, `#[tokio::test]`, `async fn`). By audit end, the directory was empty at the root; the v19 T3 OIDC federation track work landed and replaced the async implementation with a synchronous `parking_lot::RwLock`-based version in `FocalPoint/pheno-context/src/oidc.rs`. The earlier draft of this finding used `pheno-context` as the 5th repo; the final draft uses `pheno-config` for verifiability.
- `pheno-config/` gained a `Cargo.lock` mid-audit (was absent at start; present at end). The lock shows only `zeroize 1.9.0` as a non-pheno-config dep — confirming sync-only.
- No `pheno-errors`, `pheno-otel`, `pheno-port-adapter`, or `pheno-tracing` files were modified during the audit window. Their data is stable.

If this audit needs to be re-run, prefer a clean checkout (no in-flight v19 T3 work) for stable citations.

---

## 9. Closure

SIDE-10 is **complete**. The fleet passes the v17 T6 / L10 consistency gate by adoption: 100 % tokio, no fragmentation, lock-resolved versions identical where verifiable.

The recommendations in § 6 are all P3 polish; none gate v19 cycle-9 P1 work. They are eligible for a single follow-up sweep, e.g. "SIDE-10 follow-up: tokio feature-flag standardization + ADR-088 authoring" in v20 planning.

**Worklog entry (for the orchestrator):**

```
sweep_id: SIDE-10
date: 2026-06-21
device: macbook
status: complete
findings: findings/2026-06-21-SIDE-10-async-runtime.md
artifacts: 4 Cargo.toml read; 3 Cargo.lock parsed; 8 source files scanned
blocking_p0s: 0
adrs_to_author: 1 (ADR-088 tokio-canonical-runtime, planned in v17 T6, never authored)
snapshot_window: 2026-06-21 13:30-13:50 PDT
volatility: 1 working-tree change (pheno-context async → sync, replaced by pheno-config as 5th repo)
```

— end SIDE-10 —
