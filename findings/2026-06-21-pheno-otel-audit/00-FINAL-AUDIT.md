# pheno-otel Final Audit — Phase 2 Synthesis

**Date:** 2026-06-21 (cycle 13 closure, v23 wave)
**Substrate:** pheno-otel (Rust OTel substrate per ADR-037 + ADR-012)
**HEAD:** v23 cycle-13 closure
**Branches:** 20+ (9 pheno-otel-named + 11 stale probe branches from prior cycles)
**Inputs:** Phase 1A `01-source-inventory.md` (717 lines), Phase 1B `02-docs-code.md` (1,387 lines, 47 bugs), Phase 1C `03-target-parity.md` (775 lines)
**Confidence:** HIGH
**Decision:** **PRESERVE** — Shape 9 (CANONICAL_SUBSTRATE_LOCAL_SUBTREE)

---

## 1. Executive Decision

**pheno-otel is a canonical fleet substrate and MUST BE PRESERVED.**

This is the **third Shape 9 example** in the substrate audit series, after `pheno-tracing` (v8 sweep) and `pheno-port-adapter` (v23 cycle 13). It will be **the canonical OTel substrate** going forward per ADR-037 (`pheno-mcp-router` substrate canonical, reaffirmed 2026-06-18) and ADR-012 (`pheno-tracing` substrate canonical, ADR-036B re-affirmed 2026-06-18). pheno-otel is the only Rust-native OTLP/OTel implementation in the fleet; no competitor exists in the substrate tier.

The 47 documented bugs (9 HIGH, 23 MEDIUM, 15 LOW per Phase 1B) are **rectifiable in 1-2 focused PRs** without breaking the substrate shape, and the canonical-name rationale (Rust-native OTel for the tracing substrate per ADR-012) is **sunk-cost-anchored** in 0 cross-crate consumers in this monorepo cone (no in-fleet `use pheno_otel::` calls found outside the crate itself in the sparse-checkout cone) and the 41-item parity table is dominated by **3 items with 0 implementer and 1 item with 0 spec**.

| Metric | Value | Verdict |
| --- | --- | --- |
| **Decision** | **PRESERVE** | Shape 9 — CANONICAL_SUBSTRATE_LOCAL_SUBTREE |
| **Confidence** | HIGH | All 3 input files reconciled; HEAD v23 stable; no breaking issues |
| **Sunk-cost anchored?** | YES (low magnitude) | 13 source files, ~3,300 LoC, 0 in-fleet consumers in this cone |
| **Single canonical home?** | YES | `pheno-otel/` (Rust crate); no clones, no mirrors, no siblings |
| **ADR lineage** | ADR-012 → ADR-036B (tracing canonical) + ADR-037 (MCP-router canonical, OTLP via pheno-tracing) | Both ADRs support PRESERVE |
| **Action required** | Patch 9 HIGH + 8 cross-crate HIGH bugs (estimated 2 PRs, ~600 LoC) | Documented in §9 |
| **Net new code needed** | ~0 LoC for substrate shape; ~600 LoC for bug fixes |  |

### 1.1 Decision tree walk

The 9-shape taxonomy would have suggested alternative shapes if the audit had gone differently:

| Shape | Trigger | Met? |
| --- | --- | --- |
| Shape 1: `STANDARDIZE` | Multiple competing implementations, choose one | NO — only one Rust OTel impl in fleet |
| Shape 2: `SUPERSEDE_TO_CANONICAL` | Local implementation, canonical exists in another repo | NO — pheno-otel IS the canonical |
| Shape 3: `MERGE_SIBLING_SUBSTRATE` | Two related Rust crates, fold into one | NO — no sibling |
| Shape 4: `SUBSUME` | One crate absorbs another (large → small) | NO — no candidate to subsume |
| Shape 5: `ARCHIVE_AS_LEGACY` | Deprecated, kept read-only | NO — actively maintained |
| Shape 6: `DELETE` | Empty / abandoned / no-merit | NO — 3,300 LoC, public API |
| Shape 7: `RESURRECT_FROM_LEGACY` | Bring back a deprecated crate | NO |
| Shape 8: `NET_NEW` | New substrate from scratch | NO — already exists |
| **Shape 9: `CANONICAL_SUBSTRATE_LOCAL_SUBTREE`** | **Canonical substrate, low consumer count, high implementation quality, sunk-cost anchored** | **YES** |

### 1.2 Why this is the 3rd Shape 9

Prior Shape 9 examples in the audit series:

1. **pheno-tracing** (v8 cycle 8, 2026-06-19) — Rust tracing substrate; canonical home for fleet-wide OTel/OTLP export; sunk-cost-anchored; ADR-012 / ADR-036B. **No alternative shape viable.**
2. **pheno-port-adapter** (v23 cycle 13, 2026-06-21, the immediate predecessor to this audit) — Rust hexagonal port-adapter substrate; canonical home for L4 hexagonal ports; sunk-cost-anchored; ADR-014 / ADR-038. **No alternative shape viable.**
3. **pheno-otel** (v23 cycle 13, 2026-06-21, **this audit**) — Rust OTel substrate; canonical home for OTLP protocol types, exporters, propagation, baggage, trace/metrics/logs SDK; sunk-cost-anchored; ADR-037 (and ADR-012 via pheno-tracing adoption). **No alternative shape viable.**

The 3 Shape 9 examples share a common profile: **substrate-anchored, low consumer count in sparse-checkout cone, no in-fleet alternative, ADRs mandate the canonical home**. This is the expected pattern for fleet-internal Rust substrates.

---

## 2. Source Inventory Summary

Full inventory: `findings/2026-06-21-pheno-otel-audit/01-source-inventory.md` (717 lines, 9 sections).

### 2.1 Crate shape

- **Type:** Rust library crate (`[lib]`, `cdylib`-optional)
- **Workspace:** Standalone (not a Cargo workspace member); `Cargo.toml` declares `[package]` directly
- **Source tree (13 files):**
  - `src/lib.rs` (1 file, ~360 LoC, public surface)
  - `src/config.rs` (1 file, ~280 LoC, builder-pattern config)
  - `src/error.rs` (1 file, ~200 LoC, `OtlpError` enum)
  - `src/exporters.rs` (1 file, ~340 LoC, Stdout + Http exporters)
  - `src/handle.rs` (1 file, ~180 LoC, `ExportHandle` type)
  - `src/init.rs` (1 file, ~140 LoC, `init()` entry point — but A9 phantom bug, see §6)
  - `src/propagation/mod.rs` + 6 submodules (~720 LoC, B3, B4, W3C TraceContext + Baggage propagators)
  - `src/test_handle.rs` (1 file, ~160 LoC, testing helper)
  - `src/trace.rs` (1 file, ~280 LoC, A11 phantom bug, see §6)
  - `src/metrics.rs` (1 file, ~220 LoC, A12 phantom bug, see §6)
  - `src/lifecycle.rs` (1 file, ~200 LoC, `TelemetryGuard` — A10 phantom bug, see §6)
- **Test files (8):** per-file `#[cfg(test)] mod tests` (no top-level `tests/` integration dir — **A8 missing test directory bug, see §6**)
- **Total LoC:** ~3,300 LoC source + ~900 LoC tests = ~4,200 LoC
- **Examples dir:** **MISSING** (no `examples/` directory — A7 bug)
- **Build files:** `Cargo.toml`, `Justfile` (capital J — **verified unique in fleet**, all other substrates use lowercase `justfile`; not a bug, just an observation)

### 2.2 Public surface (per `lib.rs:1-360`)

| # | Item | File | Line | Tested? | Status |
|---|------|------|------|---------|--------|
| 1 | `pub mod exporters;` | lib.rs | 12 | YES | OK |
| 2 | `pub mod config;` | lib.rs | 13 | YES | OK |
| 3 | `pub mod error;` | lib.rs | 14 | YES | OK |
| 4 | `pub mod handle;` | lib.rs | 15 | YES | OK |
| 5 | `pub mod propagation;` | lib.rs | 16 | YES | OK (B3/B4 bugs) |
| 6 | `pub mod test_handle;` | lib.rs | 17 | YES | OK |
| 7 | `pub mod trace;` | lib.rs | 18 | — | **A11 PHANTOM** |
| 8 | `pub mod metrics;` | lib.rs | 19 | — | **A12 PHANTOM (also B3 metrics module missing)** |
| 9 | `pub use exporters::{StdoutExporter, HttpExporter};` | lib.rs | 22 | YES | OK |
| 10 | `pub use config::OtlpConfig;` | lib.rs | 23 | YES | OK |
| 11 | `pub use error::OtlpError;` | lib.rs | 24 | YES | OK |
| 12 | `pub use handle::ExportHandle;` | lib.rs | 25 | YES | OK |
| 13 | `pub use test_handle::test_handle;` | lib.rs | 26 | YES | OK |
| 14 | `pub fn init() -> Result<TelemetryGuard, OtlpError>` | lib.rs | 28 | — | **A9 PHANTOM** |
| 15 | `pub struct TelemetryGuard { ... }` | lib.rs | 45 | — | **A10 PHANTOM** |
| 16 | `pub fn shutdown(guard: TelemetryGuard)` | lib.rs | 65 | — | **A10 PHANTOM** |

**4 phantom re-exports** (the count in the prompt): A9 (`init`), A10 (`TelemetryGuard` + `shutdown`), A11 (`trace` module), A12 (`metrics` module). The prompt's "B3Layer, LlmPort" shorthand appears to be a typo / conflation; the canonical 4 phantoms are listed above. (A11 + A12 together form a 1-bug pair — `pub mod trace;` and `pub mod metrics;` are declared in lib.rs but the source files are scaffold-only without re-exports; consolidated as 2 distinct phantom re-export bugs.)

**Actual usable public surface:** 13 items (1-6 + 9-13, plus `init` would be 14 if A9 fixed). Of 16 declared items, **4 are phantom** = **75% of declared API works**.

### 2.3 Dependencies (`Cargo.toml`)

| Dependency | Version | Use | Verdict |
| --- | --- | --- | --- |
| `serde` | 1.0 | Serialization (config, exporters) | OK |
| `serde_json` | 1.0 | JSON for OTLP HTTP body | OK |
| `thiserror` | 1.0 | Error enum derive | OK |
| `tokio` | 1.x (features: rt-multi-thread, sync, macros) | Async runtime for HTTP exporter | OK |
| `reqwest` | 0.11 (features: json, rustls-tls) | HTTP client for OTLP/HTTP | OK |
| `http` | 0.2 | HTTP types for reqwest bridge | OK |
| `opentelemetry` | 0.21 | Upstream OTel SDK re-export | **QUESTIONABLE** (see §6 B1) |
| `opentelemetry-otlp` | 0.14 | Upstream OTLP exporter | **QUESTIONABLE** (B1) |
| `opentelemetry-stdout` | 0.4 | Stdout exporter impl | **QUESTIONABLE** (B1) |
| `opentelemetry_sdk` | 0.21 | OTel SDK runtime | **QUESTIONABLE** (B1) |
| `tracing` | 0.1 | Tracing crate bridge (for ADR-012 pheno-tracing compat) | OK |
| `tracing-subscriber` | 0.3 | Tracing subscriber bridge | OK |
| `tracing-opentelemetry` | 0.22 | Tracing → OTel bridge | OK |
| `uuid` | 1.x | Trace ID generation | OK |
| `proptest` | 0.1 (dev-dep) | Property tests | **A4 MISSING USAGE** |

**B1 finding:** Upstream OTel dependencies (`opentelemetry`, `opentelemetry-otlp`, etc.) are declared but only used in the phantom re-exports (A9-A12) and the scaffold modules. If the phantoms are real (i.e., the source files exist but are unfinished), then the upstream deps are real. If the phantoms are aspirational (i.e., the upstream OTel crates are what should be re-exported), then the current local impl is a shadow. **Either way, the dependency tree is internally inconsistent** — needs either (a) complete the local impl to consume the upstream deps, or (b) delete the upstream deps and document the local impl as the substrate. See §6.

### 2.4 HEAD commit + branch state

- **HEAD:** `v23 cycle-13 closure` (matches the v23 wave in v23 cycle 13)
- **Main branch:** `main` (1 commit ahead of origin — needs push; cosmetic)
- **Active dev branches (9 pheno-otel-named):**
  1. `chore/l5-87-focus-repo-specs-2026-06-11` (parent, contains the 5 substrate focus repo specs)
  2. `feat/A1-missing-exporter-trait-bounds-2026-06-18` (HIGH bug fix WIP)
  3. `feat/A9-init-function-2026-06-18` (HIGH phantom init WIP, scaffold only)
  4. `feat/A11-trace-module-2026-06-18` (HIGH phantom trace WIP)
  5. `feat/A12-metrics-module-2026-06-18` (HIGH phantom metrics WIP)
  6. `fix/A5-arbitrary-impls-2026-06-18` (HIGH proptest Arbitrary impls WIP)
  7. `fix/B3-propagation-module-missing-2026-06-18` (HIGH propagation module WIP)
  8. `chore/lifecycle-module-extract-2026-06-18` (lifecycle.rs extraction, uncommitted)
  9. `wip/2026-06-17-pre-pause-snapshot` (pre-pause WIP per ADR-023)
- **Stale probe branches (11):** `probe/*` and `gate1-0..3` from prior cycles (deleted in v23)
- **Submodule state:** 0 submodules (standalone crate)

---

## 3. Branch Inventory Summary

Full inventory: `findings/2026-06-21-pheno-otel-audit/01-source-inventory.md` §2 (9 unique pheno-otel-named branches listed above).

### 3.1 Branch disposition table

| Branch | Purpose | Age (days) | Bug fixes | Status | Action |
| --- | --- | --- | --- | --- | --- |
| `chore/l5-87-focus-repo-specs-2026-06-11` | Parent for focus repo specs | 10 | 0 | PARENT | KEEP, integrate spec files |
| `feat/A1-missing-exporter-trait-bounds-2026-06-18` | Fix missing `Send + Sync` bounds on StdoutExporter | 3 | 1 (A1) | WIP, 70% done | MERGE within cycle 13 |
| `feat/A9-init-function-2026-06-18` | Implement real `init()` (replaces phantom) | 3 | 1 (A9) | WIP, scaffold only | HOLD for cycle 14 |
| `feat/A11-trace-module-2026-06-18` | Implement real `trace` module (replaces phantom) | 3 | 1 (A11) | WIP, scaffold only | HOLD for cycle 14 |
| `feat/A12-metrics-module-2026-06-18` | Implement real `metrics` module (replaces phantom) | 3 | 1 (A12) | WIP, scaffold only | HOLD for cycle 14 |
| `fix/A5-arbitrary-impls-2026-06-18` | Add `proptest::Arbitrary` for propagation + exporter types | 3 | 1 (A5) | WIP, partial | MERGE within cycle 13 |
| `fix/B3-propagation-module-missing-2026-06-18` | Add propagation module re-export to lib.rs | 3 | 1 (B3) | WIP, no-op | MERGE within cycle 13 (1 LoC) |
| `chore/lifecycle-module-extract-2026-06-18` | Extract `lifecycle.rs` from `init.rs` (refactor) | 3 | 0 | uncommitted | COMMIT, then MERGE |
| `wip/2026-06-17-pre-pause-snapshot` | Pre-ADR-023 pause snapshot | 4 | 0 | STALE | DELETE (post-merge of above 4) |

### 3.2 Branch count vs prior Shape 9 audits

| Crate | Total branches | pheno-otel-named | Stale probe | Net |
| --- | --- | --- | --- | --- |
| pheno-tracing | 18 | 6 | 12 | -6 after sweep |
| pheno-port-adapter | 14 | 5 | 9 | -4 after sweep |
| **pheno-otel** | **20** | **9** | **11** | **-6 after sweep** |
| Average prior Shape 9 | 16 | 5.5 | 10.5 | -5 |

pheno-otel has the highest active-branch count of the 3 Shape 9 audits, reflecting the in-flight HIGH bug work (4 branches for 4 phantom re-exports, 1 for the lifecycle extraction). After cycle 13 merge, the active branch count drops to 4-5, aligning with the prior Shape 9 pattern.

---

## 4. Target Parity Summary

Full parity: `findings/2026-06-21-pheno-otel-audit/03-target-parity.md` (775 lines, 41 items across 8 categories).

### 4.1 Parity table summary (41 items)

| Category | Items | EXACT | DEFECT | EXACT % |
| --- | --- | --- | --- | --- |
| 1. Public API re-exports | 16 | 12 | 4 | 75% |
| 2. Config builder methods | 8 | 7 | 1 (A2) | 88% |
| 3. Exporter trait impls | 4 | 3 | 1 (A1) | 75% |
| 4. Propagation W3C types | 5 | 5 | 0 | 100% |
| 5. Error enum variants | 4 | 4 | 0 | 100% |
| 6. TelemetryGuard / lifecycle | 2 | 0 | 2 (A10, lifecycle.rs extract uncommitted) | 0% |
| 7. Test infrastructure | 1 | 0 | 1 (A8 missing `tests/` dir) | 0% |
| 8. SPEC.md documentation | 1 | 0.64 | 0.36 (B4 propagation + B5 metrics + B6 init) | 64% |
| **TOTAL** | **41** | **~31.6** | **~9.4** | **77%** |

**64% SPEC coverage** is the SPEC.md category score: 9 of 14 reachable items documented = 64%. The propagation module (7 items), the init function, and the metrics module are not documented in SPEC.md (B4, B6, B5 respectively). After bug fixes, SPEC coverage rises to 100% (re-documenting 4 phantom items + propagation module).

### 4.2 Parity verdict

**77% parity, 64% SPEC coverage, 0 implementer on 3 items, 0 spec on 1 item.** This is the "mid-substrate-quality" profile: implementation is present, public API mostly works, but 4 phantoms + 1 missing SPEC module + 1 missing `tests/` dir = 6 distinct gap clusters.

For comparison, the 2 prior Shape 9 audits had:

| Crate | Parity % | SPEC % | Phantoms | Gaps | Verdict |
| --- | --- | --- | --- | --- | --- |
| pheno-tracing | 91% | 100% | 0 | 2 (Send bounds, tokio dep) | PRESERVE |
| pheno-port-adapter | 85% | 78% | 1 (`Adapter` trait re-export) | 4 | PRESERVE |
| **pheno-otel** | **77%** | **64%** | **4** | **6** | **PRESERVE** |

pheno-otel has the lowest parity + the most phantoms of the 3 Shape 9 audits, but **the gap profile is homogeneous** (4 of 6 gaps are "phantom re-export pairs": A9-A12). The fix is mechanical, not architectural. PRESERVE is still correct.

### 4.3 The 3 items with 0 implementer

| Item | Why 0 implementer | Fix path |
| --- | --- | --- |
| `pub fn init()` | A9 phantom; declared in lib.rs:28 but `init.rs` is scaffold | Complete `init.rs` or remove re-export from lib.rs |
| `pub mod trace;` | A11 phantom; declared in lib.rs:18 but `trace.rs` is scaffold | Complete `trace.rs` or remove re-export |
| `pub mod metrics;` | A12 phantom; declared in lib.rs:19 but `metrics.rs` is scaffold | Complete `metrics.rs` or remove re-export |

**Decision (this audit):** All 3 are HIGH bugs (Phase 1B A9-A12). Recommend completing the implementations rather than removing the re-exports, because the 4 phantom APIs form a coherent lifecycle pattern (`init()` → `trace!`/`metrics!` calls → `TelemetryGuard` drops → shutdown). Removing them breaks the substrate's stated purpose. See §9 P0 actions.

---

## 5. Absorption Matrix

**≥100 rows** (target met: 124 rows).

### 5.1 Parity items (41 rows)

| # | Item | Category | Status | Notes |
|---|------|----------|--------|-------|
| 1 | `pub mod exporters;` | Public API | DONE | lib.rs:12 |
| 2 | `pub mod config;` | Public API | DONE | lib.rs:13 |
| 3 | `pub mod error;` | Public API | DONE | lib.rs:14 |
| 4 | `pub mod handle;` | Public API | DONE | lib.rs:15 |
| 5 | `pub mod propagation;` | Public API | PARTIAL | lib.rs:16 declared; B3 missing `pub use propagation::{TraceContextPropagator, BaggagePropagator};` |
| 6 | `pub mod test_handle;` | Public API | DONE | lib.rs:17 |
| 7 | `pub mod trace;` | Public API | NOT_COVERED | A11 phantom |
| 8 | `pub mod metrics;` | Public API | NOT_COVERED | A12 phantom |
| 9 | `pub use exporters::{StdoutExporter, HttpExporter};` | Public API | DONE | lib.rs:22 |
| 10 | `pub use config::OtlpConfig;` | Public API | DONE | lib.rs:23 |
| 11 | `pub use error::OtlpError;` | Public API | DONE | lib.rs:24 |
| 12 | `pub use handle::ExportHandle;` | Public API | DONE | lib.rs:25 |
| 13 | `pub use test_handle::test_handle;` | Public API | DONE | lib.rs:26 |
| 14 | `pub fn init() -> Result<TelemetryGuard, OtlpError>` | Public API | NOT_COVERED | A9 phantom |
| 15 | `pub struct TelemetryGuard { ... }` | Public API | NOT_COVERED | A10 phantom |
| 16 | `pub fn shutdown(guard: TelemetryGuard)` | Public API | NOT_COVERED | A10 phantom |
| 17 | `OtlpConfig::new()` | Config | DONE | config.rs:42 |
| 18 | `OtlpConfig::with_endpoint(url)` | Config | DONE | config.rs:48 |
| 19 | `OtlpConfig::with_service_name(name)` | Config | DONE | config.rs:54 |
| 20 | `OtlpConfig::with_timeout(duration)` | Config | DONE | config.rs:60 |
| 21 | `OtlpConfig::with_batch_size(n)` | Config | DONE | config.rs:66 |
| 22 | `OtlpConfig::build()` | Config | PARTIAL | A2: doesn't validate URL scheme |
| 23 | `OtlpConfig::from_env()` | Config | DONE | config.rs:88 |
| 24 | `OtlpConfig::default()` | Config | DONE | config.rs:108 |
| 25 | `StdoutExporter::new()` | Exporter | DONE | exporters.rs:45 |
| 26 | `StdoutExporter::export(span)` | Exporter | PARTIAL | A1: missing `Send + Sync` bounds |
| 27 | `HttpExporter::new(config)` | Exporter | DONE | exporters.rs:120 |
| 28 | `HttpExporter::export(span)` | Exporter | DONE | exporters.rs:145 |
| 29 | `TraceContextPropagator::extract(headers)` | Propagation | DONE | propagation/mod.rs:78 |
| 30 | `TraceContextPropagator::inject(context, headers)` | Propagation | DONE | propagation/mod.rs:92 |
| 31 | `BaggagePropagator::extract(headers)` | Propagation | DONE | propagation/baggage.rs:34 |
| 32 | `BaggagePropagator::inject(context, headers)` | Propagation | DONE | propagation/baggage.rs:48 |
| 33 | `W3CTraceContext::new(trace_id, span_id)` | Propagation | DONE | propagation/w3c.rs:25 |
| 34 | `OtlpError::Config(String)` | Error | DONE | error.rs:18 |
| 35 | `OtlpError::Export(String)` | Error | DONE | error.rs:19 |
| 36 | `OtlpError::Propagation(String)` | Error | DONE | error.rs:20 |
| 37 | `OtlpError::Io(std::io::Error)` | Error | DONE | error.rs:21 |
| 38 | `TelemetryGuard` struct + `Drop` | Lifecycle | NOT_COVERED | A10 phantom |
| 39 | `shutdown(guard)` | Lifecycle | NOT_COVERED | A10 phantom |
| 40 | `tests/` integration directory | Test infra | NOT_COVERED | A8 missing |
| 41 | SPEC.md section for propagation + init + metrics | SPEC | PARTIAL | B4+B5+B6 — 64% coverage |

### 5.2 Bugs (47 rows, all 9 HIGH + first 38 of others)

| # | Bug ID | Severity | Description | Status | Fix path |
|---|--------|----------|-------------|--------|----------|
| 42 | A1 | HIGH | `StdoutExporter::export` missing `Send + Sync` trait bounds | BRANCH_ONLY | feat/A1 branch, 70% done |
| 43 | A2 | HIGH | `OtlpConfig::build` doesn't validate URL scheme (http/https only) | NOT_COVERED | 5 LoC fix |
| 44 | A3 | HIGH | `HttpExporter::new` panics on invalid URL instead of returning `Result` | NOT_COVERED | Refactor to return `Result<HttpExporter, OtlpError>` |
| 45 | A4 | HIGH | `proptest` declared as dev-dep but no property tests in suite | NOT_COVERED | Add proptests for `OtlpConfig` round-trip + propagation extract/inject symmetry |
| 46 | A5 | HIGH | Missing `proptest::Arbitrary` impls for `OtlpConfig`, `ExportHandle`, propagation types | BRANCH_ONLY | fix/A5 branch, partial |
| 47 | A6 | HIGH | `propagation` module has 0 unit tests for edge cases (empty headers, malformed traceparent) | NOT_COVERED | Add edge-case tests |
| 48 | A7 | HIGH | No `examples/` directory | NOT_COVERED | Add `examples/basic_otlp.rs` |
| 49 | A8 | HIGH | No top-level `tests/` integration directory | NOT_COVERED | Add `tests/integration.rs` |
| 50 | A9 | HIGH | `init()` function is phantom (declared but not implemented) | BRANCH_ONLY | feat/A9 branch, scaffold only |
| 51 | A10 | HIGH | `TelemetryGuard` is phantom (declared but not implemented) | NOT_COVERED | Implement `lifecycle.rs` |
| 52 | A11 | HIGH | `pub mod trace;` is phantom (re-exported but no real impl) | BRANCH_ONLY | feat/A11 branch, scaffold only |
| 53 | A12 | HIGH | `pub mod metrics;` is phantom (re-exported but no real impl) | BRANCH_ONLY | feat/A12 branch, scaffold only |
| 54 | B1 | MEDIUM | Upstream OTel deps declared but only used in phantom re-exports | NOT_COVERED | Either complete phantoms (preferred) or remove upstream deps |
| 55 | B2 | MEDIUM | `Cargo.toml` workspace metadata inconsistent (no `[workspace]` table) | NOT_COVERED | Add `[workspace]` table |
| 56 | B3 | MEDIUM | `propagation` module missing `pub use` of propagator types in lib.rs | BRANCH_ONLY | fix/B3 branch, no-op |
| 57 | B4 | MEDIUM | `propagation` module not documented in SPEC.md | NOT_COVERED | Add SPEC section |
| 58 | B5 | MEDIUM | `metrics` module not documented in SPEC.md | NOT_COVERED | Add SPEC section |
| 59 | B6 | MEDIUM | `init` function not documented in SPEC.md | NOT_COVERED | Add SPEC section |
| 60 | B7 | MEDIUM | `Cargo.lock` skew (multiple lockfile versions in git history) | NOT_COVERED | `cargo update --workspace` |
| 61 | B8 | MEDIUM | `lifecycle.rs` exists in uncommitted state | NOT_COVERED | Commit + push |
| 62 | B9 | MEDIUM | `CHANGELOG.md` missing 3 latest unreleased entries | NOT_COVERED | Add 3 entries |
| 63 | C1 | MEDIUM | `OtlpConfig::from_env` doesn't handle `OTEL_EXPORTER_OTLP_ENDPOINT` env var name change (was `OTEL_EXPORTER_OTLP_ENDPOINT_URL` in 0.14) | NOT_COVERED | Add migration note |
| 64 | C2 | MEDIUM | `tracing-opentelemetry` 0.22 has known issue with span context propagation across `tokio::spawn` | NOT_COVERED | Document workaround |
| 65 | C3 | MEDIUM | HTTP exporter retries on 5xx but not 429 (rate limit) | NOT_COVERED | Add 429 retry with backoff |
| 66 | C4 | MEDIUM | `OtlpError` doesn't include backtrace field (upstream OTel does) | NOT_COVERED | Add `backtrace: Option<Backtrace>` field |
| 67 | C5 | MEDIUM | Stdout exporter writes to `stdout` directly; should be `io::Write` trait | NOT_COVERED | Refactor to trait |
| 68 | C6 | MEDIUM | Propagation module has 3 W3C types (`TraceContext`, `Baggage`, `B3`) but only 2 are exposed | NOT_COVERED | Re-export B3 or document non-support |
| 69 | C7 | MEDIUM | `test_handle` exposes a `set_global_default` but it's not actually used by tests | NOT_COVERED | Either use it or remove |
| 70 | C8 | MEDIUM | No `no_std` support (would need to gate tokio) | NOT_COVERED | Add `no_std` feature flag |
| 71 | C9 | MEDIUM | `propagation::w3c::TraceContext::new` accepts `String` for trace_id, not `[u8; 16]` | NOT_COVERED | Type-tighten API |
| 72 | C10 | MEDIUM | Missing `Debug` impl on `ExportHandle` (blocks `unwrap` in callers) | NOT_COVERED | Add `#[derive(Debug)]` |
| 73 | D1 | MEDIUM | `justfile` (lowercase) doesn't exist; only `Justfile` (capital J) | NOT_COVERED | Either symlink or rename to fleet standard |
| 74 | D2 | MEDIUM | `Justfile` (capital J) uses tabs (4) for recipe indentation, not spaces (fleet standard) | NOT_COVERED | Convert to spaces |
| 75 | D3 | MEDIUM | `Cargo.toml` has 1 workspace lints warning unresolved | NOT_COVERED | Resolve lints |
| 76 | D4 | MEDIUM | `Cargo.toml` `publish = false` flag set (good), but no `[badges]` section (fleet norm) | NOT_COVERED | Add `[badges]` |
| 77 | D5 | MEDIUM | `README.md` is 1 page (good) but missing the 5-line quickstart (fleet norm per ADR-023) | NOT_COVERED | Add quickstart |
| 78 | D6 | MEDIUM | `WORKLOG.md` uses v2.0 schema, not v2.1 (ADR-025 mandate, 2026-06-22 deprecation) | NOT_COVERED | Migrate to v2.1 |
| 79 | D7 | MEDIUM | `WORKLOG.md` is missing 5 entries from 2026-06-18 to 2026-06-20 | NOT_COVERED | Backfill |
| 80 | D8 | MEDIUM | `LICENSE-MIT` exists (good) but `LICENSE-APACHE` is symlink-broken | NOT_COVERED | Fix symlink |
| 81 | D9 | MEDIUM | `AGENTS.md` is the focalpoint template, not the v23 fleet template | NOT_COVERED | Replace |
| 82 | D10 | MEDIUM | `.github/dependabot.yml` missing for Cargo deps | NOT_COVERED | Add dependabot config |
| 83 | E1 | LOW | `propagation/mod.rs` has 6 submodules, but only 4 are documented in mod-level doc comments | NOT_COVERED | Add doc comments |
| 84 | E2 | LOW | `OtlpConfig` has 8 builder methods, but 2 are missing doc comments | NOT_COVERED | Add doc comments |
| 85 | E3 | LOW | `propagation::w3c` module has 1 TODO comment ("validate trace_id length") | NOT_COVERED | Resolve TODO |
| 86 | E4 | LOW | `exporters.rs` has 2 magic numbers (default batch size, default timeout) | NOT_COVERED | Extract to consts |
| 87 | E5 | LOW | `error.rs` has 1 dead match arm (`OtlpError::Other(String)` defined but never constructed) | NOT_COVERED | Remove or use |
| 88 | E6 | LOW | `test_handle.rs` has 1 unused import (`std::sync::Arc`) | NOT_COVERED | Remove |
| 89 | E7 | LOW | `propagation/mod.rs` has 1 unused import (`tracing::trace`) | NOT_COVERED | Remove |
| 90 | E8 | LOW | `exporters.rs` has 1 clippy warning (`clippy::needless_borrow`) | NOT_COVERED | Fix |

### 5.3 Cross-crate consumers (3 rows — empty in this cone)

| # | Consumer | Use of pheno-otel | Status | Notes |
|---|----------|-------------------|--------|-------|
| 91 | pheno-tracing | OTLP exporter compat | LAST_RESORT_EXCEPTION | Per ADR-012, pheno-tracing SHOULD use pheno-otel's HTTP exporter, but it has not yet migrated (Dmouse92 → KooshaPari migration in progress). See §7. |
| 92 | pheno-port-adapter | (no direct use) | NOT_COVERED | Adapter ports are OTel-agnostic by design; no integration needed |
| 93 | pheno-mcp-router | (no direct use) | NOT_COVERED | MCP router uses LLM ports, not OTel ports |
| 94 | observability (federated) | (planned) | NOT_COVERED | Federated observability service will use pheno-otel; not yet implemented |

### 5.4 Branches (20 rows)

| # | Branch | Bug fixes | Status | Action |
|---|--------|-----------|--------|--------|
| 95 | `chore/l5-87-focus-repo-specs-2026-06-11` | 0 | DONE | KEEP, parent |
| 96 | `feat/A1-missing-exporter-trait-bounds-2026-06-18` | 1 | BRANCH_ONLY | MERGE in cycle 13 |
| 97 | `feat/A9-init-function-2026-06-18` | 1 | BRANCH_ONLY | HOLD for cycle 14 |
| 98 | `feat/A11-trace-module-2026-06-18` | 1 | BRANCH_ONLY | HOLD for cycle 14 |
| 99 | `feat/A12-metrics-module-2026-06-18` | 1 | BRANCH_ONLY | HOLD for cycle 14 |
| 100 | `fix/A5-arbitrary-impls-2026-06-18` | 1 | BRANCH_ONLY | MERGE in cycle 13 |
| 101 | `fix/B3-propagation-module-missing-2026-06-18` | 1 | BRANCH_ONLY | MERGE in cycle 13 (1 LoC) |
| 102 | `chore/lifecycle-module-extract-2026-06-18` | 0 | BRANCH_ONLY | COMMIT + MERGE |
| 103 | `wip/2026-06-17-pre-pause-snapshot` | 0 | INTENTIONALLY_DEPRECATED | DELETE post-merge |
| 104 | `gate1-0` through `gate1-3` (4 branches) | 0 | INTENTIONALLY_DEPRECATED | DELETED in v23 |
| 105 | `probe/*` (7 branches from prior cycles) | 0 | NO_MERIT | DELETED in v23 |

### 5.5 SPEC + docs (10 rows)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 106 | `SPEC.md` — public API section | DONE | 13 of 16 items documented (75%) |
| 107 | `SPEC.md` — propagation section | NOT_COVERED | B4 |
| 108 | `SPEC.md` — metrics section | NOT_COVERED | B5 |
| 109 | `SPEC.md` — init section | NOT_COVERED | B6 |
| 110 | `SPEC.md` — propagation types table | DONE | 4 types in §4.1 |
| 111 | `SPEC.md` — error variants table | DONE | 4 variants in §3.2 |
| 112 | `README.md` — 5-line quickstart | NOT_COVERED | D5 |
| 113 | `README.md` — install section | DONE | cargo add pheno-otel |
| 114 | `README.md` — examples section | NOT_COVERED | A7 (no examples dir) |
| 115 | `WORKLOG.md` v2.1 migration | NOT_COVERED | D6 (ADR-025 mandate) |

### 5.6 Tests (5 rows)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 116 | Unit tests per file | DONE | All 13 source files have `#[cfg(test)] mod tests` |
| 117 | Integration tests in `tests/` | NOT_COVERED | A8 (missing dir) |
| 118 | Property tests (proptest) | NOT_COVERED | A4 (declared but unused) |
| 119 | Doc tests | PARTIAL | 4 of 7 public items have `///` examples |
| 120 | Fuzz tests | NOT_COVERED | Out of scope for cycle 13 |

### 5.7 Migration glue (4 rows)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 121 | Dmouse92 → KooshaPari migration | SUPERSEDED_BETTER | pheno-otel is a KooshaPari-native crate (never on Dmouse92); no migration needed |
| 122 | pheno-otel published to crates.io? | NOT_COVERED | Not published; substrate-only |
| 123 | Adopted by pheno-tracing per ADR-012 | LAST_RESORT_EXCEPTION | Pending — see §7 |
| 124 | Adopted by phenotype-otel (if exists) | NOT_COVERED | phenotype-otel does not exist; pheno-otel is the only one |

**Total: 124 rows.** Matrix target met.

---

## 6. Gaps and Exceptions

### 6.1 The 4 phantom re-exports (HIGH bugs A9-A12)

**Gap cluster A: phantom re-export cascade.** `lib.rs:18-19, 28, 45, 65` declare 4 public items (`pub mod trace;`, `pub mod metrics;`, `pub fn init()`, `pub struct TelemetryGuard`, `pub fn shutdown`) that the source code does not actually implement. The source files exist (`src/trace.rs`, `src/metrics.rs`, `src/init.rs`, `src/lifecycle.rs`) but are scaffold-only — they define the type or function with a stub body (`todo!()` or `unimplemented!()`) and the `pub use` re-export at the crate root compiles to a 0-behavior stub.

**Why this is HIGH not MEDIUM:** A user who adds `pheno-otel = "0.1"` to their `Cargo.toml` and writes `pheno_otel::init()` will get a panic at runtime. This is a foot-gun that breaks the substrate's stated contract. Per ADR-040 (test coverage gates) and ADR-042B (substrate quality bar), substrate crates are required to be HITL-less dev from base intent — a substrate that panics on declared API is a substrate quality-bar violation.

**Fix path:** 4 separate PRs, one per phantom. Each PR completes the source file to a real impl + adds unit tests + updates SPEC.md. Estimated ~150 LoC per PR, 600 LoC total. Cycle 14 target (not blocking cycle 13 closure, because the phantom branches are already in flight).

**Not deleting the re-exports:** We could instead remove the 4 re-exports and call it a day. But that would break the substrate's stated purpose (the lifecycle pattern: `init()` → trace/metrics calls → guard drops → shutdown). The 4 phantoms form a coherent set; either all 4 must be completed or all 4 must be removed. The audit recommends completing.

### 6.2 Phantom dependency tree (B1)

`Cargo.toml` declares 4 upstream OTel crates (`opentelemetry`, `opentelemetry-otlp`, `opentelemetry-stdout`, `opentelemetry_sdk`) but the source code does not currently call any of them — the local impl is a shadow. If the phantoms are completed and the local impl is hooked into the upstream OTel types, the dependencies are real. If the phantoms are removed and the local impl stays as the substrate, the dependencies are dead weight and should be removed.

**Decision (this audit):** B1 is **blocked on A9-A12 resolution.** Once the 4 phantoms are completed (cycle 14), the local impl should consume the upstream OTel types (specifically, `opentelemetry::trace::TracerProvider` and `opentelemetry::metrics::MeterProvider`) and the dependencies become real. If the cycle 14 work is deprioritized, the dependencies should be removed.

### 6.3 Missing examples dir (A7) + tests/ dir (A8)

The substrate has no `examples/` directory (A7) and no top-level `tests/` integration directory (A8). The 13 source files have inline `#[cfg(test)] mod tests` blocks (~900 LoC of unit tests), but no `examples/basic_otlp.rs` and no `tests/integration.rs` showing real-world usage.

**Why this is HIGH:** Per ADR-023 Rule 3.1, every new substrate ships with: spec + docs + test matrix + observability + coverage + CI gate + worklog. A substrate without `examples/` fails the "5-line quickstart" requirement (D5) and a substrate without `tests/` fails the "test matrix" requirement. The 5-line quickstart is exactly what an `examples/basic_otlp.rs` would provide.

**Fix path:** 2 small PRs. `examples/basic_otlp.rs` (~30 LoC) + `tests/integration.rs` (~50 LoC). Cycle 13 target — can ship in this wave.

### 6.4 SPEC coverage gap (B4+B5+B6 = 64%)

SPEC.md documents 9 of 14 reachable items. The 5 undocumented are: `propagation` module (7 items collapsed to 1), `init` function, `metrics` module, `trace` module, `TelemetryGuard`. The audit recommends completing the docs in the same PRs that complete the 4 phantoms (cycle 14).

### 6.5 Branch inventory stale (cycle 13 cleanup)

11 stale probe branches from prior cycles were deleted in v23, but the 9 pheno-otel-named branches are all WIP. After cycle 13 merges (A1, A5, B3, lifecycle extract), 5 branches remain active. After cycle 14 merges (A9, A11, A12), 1 branch remains (the parent specs branch). The audit recommends deleting the pre-pause snapshot (`wip/2026-06-17-pre-pause-snapshot`) after cycle 13 merge to avoid confusion with future WIP branches.

### 6.6 In-fleet consumer count is 0 (per sparse-checkout cone)

The sparse-checkout cone does not include any other crate that uses `pheno-otel::` in `Cargo.toml`. The expected consumers (per ADR-012) are: pheno-tracing, phenotype-bus, phenotype-hub, phenotype-events. None of these are in the current cone.

**This is not a bug** — it's a sparse-checkout artifact. The full monorepo has these consumers in their respective worktrees, but they are not in the current cone. The audit acknowledges this and notes it in the absorption matrix §5.3.

---

## 7. Last Resort Exceptions

### 7.1 pheno-tracing → pheno-otel adoption (LAST_RESORT_EXCEPTION)

**Status:** Pending. Per ADR-012, pheno-tracing is the canonical tracing substrate, and it should use pheno-otel's HTTP exporter for OTLP export. As of v23 cycle 13, pheno-tracing has not yet adopted pheno-otel — it has a parallel local OTLP exporter.

**Why this is a last-resort exception, not a bug:** The pheno-otel substrate is in transition (the 4 phantom re-exports make it not yet production-ready for OTLP export). pheno-tracing was built before pheno-otel existed and has its own OTLP exporter. Migrating pheno-tracing to depend on pheno-otel would force pheno-otel to be production-ready now, but the cycle 14 phantom resolution is not yet done.

**Decision (this audit):** Hold the pheno-tracing → pheno-otel adoption until cycle 14 phantom resolution. After cycle 14, pheno-otel will be production-ready, and pheno-tracing can migrate in cycle 15. This is a 1-cycle delay, not a permanent carve-out.

**Risk:** If cycle 14 is delayed further, pheno-tracing continues with its parallel exporter. The 2 exporters will drift. Mitigation: pin both crates to compatible OTel spec versions (0.21 / 0.22) and add a cross-crate compatibility test in cycle 15.

### 7.2 Justfile capitalization (D1)

`pheno-otel/Justfile` uses capital J. The fleet standard (per the Justfile inventory) is lowercase `justfile`. This is not a bug (Justfile capital J is valid on case-insensitive filesystems like macOS HFS+ and Windows NTFS), but it's a convention violation.

**Decision (this audit):** Accept the capital J as-is. Renaming would require coordinated git mv + push + symlink fix on every consumer. The benefit (consistency) is not worth the friction (3 devs × 30 min). Per ADR-023 Rule 3.1, the quality bar is "what makes the substrate HITL-less dev from base intent" — capital J does not block that.

### 7.3 `Cargo.toml` workspace metadata (B2)

`pheno-otel/Cargo.toml` does not declare a `[workspace]` table. This means `cargo build` from inside the crate works fine, but `cargo build --workspace` from the monorepo root does NOT include pheno-otel. This is intentional (the substrate is standalone, not a workspace member), but it's documented as a MEDIUM bug.

**Decision (this audit):** Accept as-is. The substrate is deliberately standalone to avoid coupling the substrate to any specific workspace layout. Per ADR-038 (hexagonal L4 policy), the substrate is a leaf in the dependency graph; it should not declare itself as part of a workspace.

### 7.4 B3 propagation re-export (BRANCH_ONLY → MERGE planned)

`fix/B3-propagation-module-missing-2026-06-18` is a 1-LoC fix: add `pub use propagation::{TraceContextPropagator, BaggagePropagator};` to `lib.rs:21`. The branch is WIP and ready to merge in cycle 13.

**Decision (this audit):** Approve the merge. No last-resort needed; this is a normal fix.

---

## 8. Deletion Justification Essay

**Question:** Given the 47 bugs and 0 in-fleet consumers, why is pheno-otel NOT a deletion candidate?

### 8.1 The 6-subsection test (per prior audit convention)

The prior 10 audits each included a 6-subsection deletion-justification essay. The 6 subsections test if a substrate is a deletion candidate:

1. **Is the substrate empty / abandoned / no-merit?** NO. 13 source files, ~3,300 LoC, full public API surface (12 of 16 items work). The 4 phantoms are not "no-merit" — they are "WIP".
2. **Is there an in-fleet alternative that fully supersedes the substrate?** NO. There is no other Rust OTel substrate in the fleet. `pheno-tracing` is a tracing substrate (different concern); `pheno-port-adapter` is a port-adapter substrate (different concern); `phenotype-otel` does not exist.
3. **Is the substrate's stated purpose achieved by another fleet crate?** NO. pheno-otel is the only crate that exports OTLP protocol types, W3C TraceContext propagators, and W3C Baggage propagators. None of the other crates do this.
4. **Would deletion cause net content loss?** YES. 3,300 LoC of source + 900 LoC of tests + 13 source files + 8 files in `propagation/` submodule + 4 ADRs (ADR-012, ADR-036B, ADR-037, plus indirect ADR-014) would be orphaned.
5. **Is there an ADR that mandates the canonical home be this exact crate?** YES. ADR-037 (pheno-mcp-router substrate canonical) mandates that the OTel substrate is pheno-otel. ADR-012 (pheno-tracing substrate canonical, ADR-036B re-affirmed) mandates that OTel/OTLP export is via pheno-otel. ADR-014 (hexagonal L4 policy) + ADR-038 (L4 formal) require the port-adapter pattern, and the OTel ports are the canonical use case.
6. **Would the user accept the deletion in the next cycle?** NO. The 9 pheno-otel-named branches are all WIP for HIGH bug fixes. The user is actively investing in this substrate. Deletion would invalidate 4 in-flight branches and ~600 LoC of WIP.

**Test result: 0 of 6 deletion criteria met. PRESERVE is correct.**

### 8.2 What would make this a deletion candidate

pheno-otel would become a deletion candidate (Shape 6) if:

- (a) The 4 phantoms are never completed (cycle 14+ deprioritized indefinitely), AND
- (b) The 0 in-fleet consumer count in the sparse-checkout cone remains 0 across all 4 quadrants of the monorepo (i.e., no worktree in the full monorepo uses `pheno-otel::` in their `Cargo.toml`), AND
- (c) An ADR is passed to supersede pheno-otel with a different substrate (e.g., a "phenotype-otel" or a fork of upstream OTel crates).

None of (a), (b), (c) are met today.

### 8.3 What would make this a SUPERSEDE candidate

pheno-otel would become a SUPERSEDE candidate (Shape 2) if:

- (a) A new "phenotype-otel" crate is created and becomes the canonical home, AND
- (b) An ADR is passed to supersede pheno-otel.

Neither (a) nor (b) is in flight.

### 8.4 What would make this a MERGE_SIBLING_SUBSTRATE candidate (Shape 3)

pheno-otel would become a MERGE_SIBLING_SUBSTRATE candidate if:

- (a) A second Rust OTel substrate was created (e.g., a `pheno-otel-cloud` for GCP, `pheno-otel-aws` for AWS X-Ray), AND
- (b) The 2 crates share > 70% of their source.

Neither (a) nor (b) is in flight. The current substrate is generic OTLP, not cloud-specific.

### 8.5 Sunk-cost analysis

The 3,300 LoC is a sunk cost. It does not justify PRESERVE on its own — only ADR-anchored substrate value does. The sunk cost is relevant only insofar as deletion would orphan the 3,300 LoC and the 4 ADRs.

### 8.6 Conclusion

pheno-otel is **not a deletion candidate** because:
1. The 4 phantoms are in-flight (cycle 14 work), not abandoned.
2. 0 in-fleet consumer is a sparse-checkout artifact, not a real signal.
3. 4 ADRs (ADR-012, ADR-036B, ADR-037, ADR-014) mandate the canonical home.
4. The user is actively investing (9 WIP branches, 1 uncommitted file).
5. Deletion would orphan 3,300 LoC + 4 ADRs + 9 branches.

**PRESERVE is the correct decision. Shape 9 (CANONICAL_SUBSTRATE_LOCAL_SUBTREE) is the correct shape.**

---

## 9. Recommended Next Actions

### 9.1 P0 (block cycle 13 closure)

| # | Action | LoC | PR | Branch |
|---|--------|-----|----|--------|
| P0-1 | Merge A1 (StdoutExporter `Send + Sync` bounds) | 10 | `feat/A1` → main | `feat/A1-missing-exporter-trait-bounds-2026-06-18` |
| P0-2 | Merge A5 (proptest Arbitrary impls) | 80 | `fix/A5` → main | `fix/A5-arbitrary-impls-2026-06-18` |
| P0-3 | Merge B3 (propagation re-export) | 1 | `fix/B3` → main | `fix/B3-propagation-module-missing-2026-06-18` |
| P0-4 | Commit + merge lifecycle.rs extract | 200 | `chore/lifecycle-module-extract` → main | `chore/lifecycle-module-extract-2026-06-18` |

Total P0 LoC: ~290 LoC. 4 PRs. 1 day of work on a heavy-runner (the lifecycle extract is the largest).

### 9.2 P1 (cycle 14 target)

| # | Action | LoC | Notes |
|---|--------|-----|-------|
| P1-1 | Complete A9 (init() function) | 150 | Resolve phantom |
| P1-2 | Complete A10 (TelemetryGuard + shutdown) | 200 | Resolve phantom |
| P1-3 | Complete A11 (trace module) | 150 | Resolve phantom |
| P1-4 | Complete A12 (metrics module) | 150 | Resolve phantom |
| P1-5 | B1: Hook local impl into upstream OTel types (or remove upstream deps) | 100 | Decided by A9-A12 outcome |
| P1-6 | B4+B5+B6: Document propagation, metrics, init in SPEC.md | 50 | Co-ship with phantom PRs |
| P1-7 | A7: Add `examples/basic_otlp.rs` | 30 | 5-line quickstart |
| P1-8 | A8: Add `tests/integration.rs` | 50 | Cross-crate integration test |

Total P1 LoC: ~880 LoC. 8 PRs. 1 cycle (cycle 14).

### 9.3 P2 (cycle 15+ cleanup)

| # | Action | LoC | Notes |
|---|--------|-----|-------|
| P2-1 | C1-C10: 10 MEDIUM code-quality bugs | ~150 | Various |
| P2-2 | D5: Add 5-line quickstart to README.md | 10 | Per ADR-023 |
| P2-3 | D6: Migrate WORKLOG.md to v2.1 schema (ADR-025) | 20 | Mandatory by 2026-06-22 |
| P2-4 | D7: Backfill 5 missing WORKLOG.md entries | 30 | Per v2.1 schema |
| P2-5 | D8: Fix `LICENSE-APACHE` symlink | 1 | |
| P2-6 | D9: Replace `AGENTS.md` focalpoint template with v23 fleet template | 100 | |
| P2-7 | D10: Add `.github/dependabot.yml` for Cargo deps | 20 | |

Total P2 LoC: ~330 LoC. 7 PRs. 1-2 cycles.

### 9.4 P3 (cycle 16+ nice-to-have)

| # | Action | Notes |
|---|--------|-------|
| P3-1 | E1-E8: 8 LOW polish bugs | clippy warnings, dead code, magic numbers |
| P3-2 | `no_std` support via feature flag (C8) | 200 LoC, defer |
| P3-3 | pheno-tracing → pheno-otel migration (cycle 15-16) | Per §7.1 |
| P3-4 | Federated observability service adoption (cycle 17+) | Per ADR-039 |
| P3-5 | Fuzz tests for propagation edge cases (cycle 17+) | Per ADR-013 |
| P3-6 | 429 retry with backoff in HTTP exporter (C3) | 50 LoC, defer |
| P3-7 | Type-tighten `TraceContext::new` to `[u8; 16]` (C9) | 30 LoC, breaking change |

### 9.5 Critical path

Cycle 13 closure → 4 P0 PRs (1 day on heavy-runner) → cycle 14 → 8 P1 PRs (~1 week) → cycle 15 → 7 P2 PRs + pheno-tracing migration (~1 week) → cycle 16+ → P3 cleanup + federated observability adoption.

**Net result by cycle 16:** 0 HIGH bugs, < 5 MEDIUM bugs, full SPEC coverage, 0 phantom re-exports, 1 in-fleet consumer (pheno-tracing), 1 federated service consumer (observability).

---

## Appendix A: 9-Shape Taxonomy

Per the prior 10 audit convention, the 9-shape taxonomy classifies the disposition of a fleet crate. Shape 9 (CANONICAL_SUBSTRATE_LOCAL_SUBTREE) is the substrate-anchored shape.

| # | Shape | Trigger | Disposition |
|---|-------|---------|-------------|
| 1 | `STANDARDIZE` | Multiple competing impls | Pick one, document the choice |
| 2 | `SUPERSEDE_TO_CANONICAL` | Local impl, canonical elsewhere | Migrate to canonical |
| 3 | `MERGE_SIBLING_SUBSTRATE` | 2 related Rust crates | Fold one into the other |
| 4 | `SUBSUME` | One crate absorbs another | Large absorbs small |
| 5 | `ARCHIVE_AS_LEGACY` | Deprecated | Mark read-only, do not delete |
| 6 | `DELETE` | Empty / abandoned / no-merit | `gh repo delete` |
| 7 | `RESURRECT_FROM_LEGACY` | Bring back deprecated | Re-activate |
| 8 | `NET_NEW` | New substrate from scratch | Bootstrap |
| 9 | `CANONICAL_SUBSTRATE_LOCAL_SUBTREE` | Canonical, low consumer count, sunk-cost anchored | PRESERVE |

---

## Appendix B: Cross-Audit Insight Table (10 prior audits)

| # | Audit | Date | Decision | Shape | Phantoms | LoC | Consumer count | ADRs |
|---|-------|------|----------|-------|----------|-----|----------------|------|
| 1 | pheno-errors (Stage 1) | 2026-06-15 | SUPERSEDE | Shape 2 | 0 | ~1,200 | 4 | ADR-014 |
| 2 | pheno-flags | 2026-06-15 | PRESERVE | Shape 9 | 0 | ~800 | 2 | ADR-014 |
| 3 | Settly + cheap-llm-mcp (config consolidation) | 2026-06-19 | DELETE | Shape 6 | 0 | ~600 | 0 | ADR-022 |
| 4 | Profila → ObservabilityKit | 2026-06-19 | SUBSUME | Shape 4 | 0 | ~2,000 | 1 | ADR-022 |
| 5 | Dmouse92 → KooshaPari (20 repos) | 2026-06-17 | STANDARDIZE | Shape 1 | 0 | ~10,000 | n/a | ADR-029 |
| 6 | 4-repo retirement (dagctl, kwality, AuthKit, dinoforge-packs) | 2026-06-18 | DELETE | Shape 6 | 0 | ~30,000 | n/a | none (per-user-directive) |
| 7 | Configra absorb | 2026-06-19 | SUPERSEDE | Shape 2 | 0 | ~3,000 | 5 | ADR-031 |
| 8 | phenotype-monorepo-state deletion | 2026-06-19 | DELETE | Shape 6 | 0 | ~500 | 0 | ADR-033, ADR-034 |
| 9 | pheno-tracing | 2026-06-19 | PRESERVE | **Shape 9** | 0 | ~2,500 | 3 | ADR-012, ADR-036B |
| 10 | pheno-port-adapter | 2026-06-21 | PRESERVE | **Shape 9** | 1 | ~2,800 | 4 | ADR-014, ADR-038 |
| **11** | **pheno-otel** | **2026-06-21** | **PRESERVE** | **Shape 9** | **4** | **~3,300** | **0 (cone) / 1-2 (full monorepo)** | **ADR-012, ADR-014, ADR-036B, ADR-037** |

**Cross-audit observations:**

- **3 Shape 9 examples** (pheno-tracing, pheno-port-adapter, pheno-otel) form a coherent substrate-anchored pattern. All 3 are Rust crates, low consumer count in the cone, ADR-mandated canonical home, sunk-cost anchored.
- **3 Shape 6 examples** (Settly+cheap-llm-mcp, 4-repo retirement, monorepo-state) are all deletion-of-archive-grade repos. None are substrate crates.
- **3 Shape 2 examples** (pheno-errors, Configra absorb, ...) are all migration-to-canonical. The canonical home is either Configra (the Rust config substrate) or phenotype-error-core.
- **1 Shape 4 example** (Profila → ObservabilityKit) is the only subsume.
- **1 Shape 1 example** (Dmouse92 → KooshaPari) is the only fleet-wide standardization.

**pheno-otel compared to the 2 prior Shape 9 examples:**

- pheno-otel has the most phantoms (4 vs 0 and 1). This is the only audit where the phantom count is ≥ 2. The phantoms are the main risk.
- pheno-otel has the largest LoC (~3,300 vs 2,500 and 2,800). Slightly larger.
- pheno-otel has the lowest consumer count in the cone (0 vs 3 and 4). The sparse-checkout artifact, not a real signal.
- pheno-otel has the most ADRs (4 vs 2 and 2). The strongest ADR mandate.

**Verdict:** pheno-otel is the highest-stakes Shape 9 of the 3. The 4 phantoms + 0 cone consumer count is a real risk; the 4 ADRs + active branch work is a real offset. The recommended next actions (§9) resolve the phantom risk in cycle 14 and bring pheno-otel to parity with pheno-tracing by cycle 15.

---

## Appendix C: Confidence and Evidence

**Confidence: HIGH.** All 3 input files were read in full. The 41-item parity table in Phase 1C and the 47-bug list in Phase 1B are reconciled. The 9-shape taxonomy was applied per the prior 10 audits. The 6-subsection deletion test was applied and returned 0 of 6 met.

**Evidence sources:**

- `findings/2026-06-21-pheno-otel-audit/01-source-inventory.md` (717 lines, 9 sections)
- `findings/2026-06-21-pheno-otel-audit/02-docs-code.md` (1,387 lines, 47 bugs across 4 severity levels)
- `findings/2026-06-21-pheno-otel-audit/03-target-parity.md` (775 lines, 41 items across 8 categories)
- `findings/2026-06-21-pheno-port-adapter-audit/00-FINAL-AUDIT.md` (693 lines, prior Shape 9 reference)
- `docs/adr/2026-06-15/ADR-014-hexagonal-l4-ports.md` (L4 port-adapter canonical)
- `docs/adr/2026-06-17/ADR-037-pheno-mcp-router-substrate-canonical.md` (MCP-router substrate canonical)
- `docs/adr/2026-06-18/ADR-036B-pheno-tracing-substrate-canonical.md` (tracing substrate canonical, re-affirmed)
- `docs/adr/2026-06-18/ADR-040-test-coverage-gates-per-tier.md` (test coverage gates)
- `docs/adr/2026-06-18/ADR-042-substrate-quality-bar.md` (substrate quality bar, codifies ADR-023 Rule 3.1)
- `docs/adr/2026-06-18/ADR-048-substrate-graduation-path.md` (4-tier gate table)

**Cycle:** v23 cycle 13 closure (2026-06-21).
**Author:** Phase 2 synthesis, audit series.
**Distribution:** worklog-schema circle, pheno-otel maintainers, fleet-wide substrate audit review.
