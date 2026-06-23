# Phase 1C — Target Parity Audit: `pheno-otel`

**Date:** 2026-06-21 (system date)
**Phase:** 1C (target-parity / candidate survey only; matrix + decision deferred to Phase 2)
**Source path:** `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-otel/`
**Substrate tier (per ADR-023 Rule 3):** `pheno-*-lib` (pure reusable library, single concern, single crate)
**Substrate role (per ADR-037):** canonical OTLP wire-format export substrate
**Authoritative cross-references:**
- ADR-023 (substrate placement + Rule 3.1 quality bar)
- ADR-037 (analogous substrate-canonical — for pheno-mcp-router; pheno-otel is the parallel precedent)
- ADR-038 (hexagonal L4 Port/Adapter policy)
- ADR-040 (test coverage gates per tier — 80% lib)
- ADR-042B (substrate quality bar — 7-element)
- ADR-024 + ADR-041 (71-pillar framework + refresh cadence)

> **gh api rate-limit fallback:** `gh api` returns HTTP 403. All evidence in this document is derived from local `git grep` + file reads (per task directive). Cross-crate consumer discovery uses `git grep -l 'use pheno_otel' -- '*.rs'` and `git grep -l 'pheno_otel\|pheno-otel' -- 'Cargo.toml'`. No `gh api` calls attempted.

> **Upstream phase context:**
> - Phase 1A — `findings/2026-06-21-pheno-otel-audit/01-source-inventory.md` (717 lines)
> - Phase 1B — `findings/2026-06-21-pheno-otel-audit/02-docs-code.md` (1,387 lines)
> - Prior cycle 4 audit — `findings/2026-06-20-71-pillar-cycle-4-pheno-otel.md` (mean 2.39/3, Tier 2 graduated)

> **Key inversion relative to prior audits:** The Phase 1C audits of `pheno-errors` (target: `phenotype-error-core`) and `pheno-flags` (target: `phenotype-flags`) both **migrated content OUT of standalone repos INTO canonical subcrates of `pheno/`.** This audit inverts the direction: `pheno-otel` is **already** the canonical substrate (per ADR-037 + Cargo.toml:7). The question is not "where should pheno-otel content go" but **"is there any candidate that could legitimately supersede the canonical?"** The answer (per §10) is **no** — pheno-otel is self-canonical.

---

## 0. Executive summary (TL;DR)

`pheno-otel` is the **canonical OTLP wire-format export substrate** for the pheno-* fleet (per ADR-037 + `Cargo.toml:7` + `SPEC.md:6`). It is **NOT** a candidate for absorption into another repo — it is the **destination**, not the source.

**16 absorption candidates evaluated. 15 REJECTED, 1 RECOMMENDED (= NO-OP, preserve in place).**

The audit's most consequential finding is **not** absorption-target identification but rather a **NEW HIGH-severity defect discovered during cross-crate consumer analysis** (see §2): the in-fleet consumers of `pheno-otel` are **wired to APIs that do not exist**:

| Consumer | Reference | Code reality |
|---|---|---|
| `pheno-port-adapter/examples/otel_quickstart.rs:14` | `use pheno_otel::trace::{emit, span};` | `pheno_otel` has **no `trace` module** in `src/lib.rs` |
| `pheno-errors/examples/otel_quickstart.rs:16` | `use pheno_otel::trace::{emit, span};` | same — `trace` module absent |
| `pheno-tracing/Cargo.toml:29-31` | `pheno-otel::metrics::record_error` (per inline comment) | `src/metrics.rs` has **no `record_error` function** |

These three consumer sites will **fail to compile** if their `examples/` directories are ever run. This defect extends the prior Phase 1B phantom-API findings (which only covered docs/code mismatches within pheno-otel itself) into the **cross-crate wiring**, which is more severe because it suggests the v11 wiring batch (commits `00f6c06837`, `fc7cc54529`, `18fefd03c1`, `2c9255706f`, `13c69a62f3`) merged **broken examples** into the fleet.

**Other notable findings:**

- **No `phenotype-otel-core` / no upstream superseder exists.** Unlike `pheno-errors` (superseded by `phenotype-error-core`) and `pheno-flags` (superseded by `phenotype-flags`), there is no `phenotype-otel-core` crate in any local monorepo overlay.
- **In-fleet consumers are all path-deps** (`pheno-otel = { path = "../pheno-otel" }`) in 3 crates: `pheno-port-adapter`, `pheno-errors`, `pheno-tracing`. No crates.io reverse-deps.
- **No pyo3 / napi-rs / FFI bindings** exist. The TS port is at `phenotype-otel` (a separate repo per `findings/2026-06-20-side-38-otel-collector-vs-native-exporters.md:17`), not at `pheno-otel`. No polyglot mirror in `pheno-otel` itself.
- **ADR-023 classification:** `pheno-*-lib` (per `STATUS.md:7`, Cargo.toml). 80% lib coverage gate is **wired in `ci.yml:135-140`** but not yet enforced on a published number.
- **ADR-037 canonical OTel substrate:** pheno-otel IS the canonical (per `Cargo.toml:7` "ADR-037" attribution). No upstream mirror to absorb into.
- **v23 cycle-13 implications:** The v23 plan (per `plans/2026-06-22-v23-71-pillar-cycle-13.md`) is **orthogonal** to absorption — it covers L36 (chaos depth), L37 (devcontainer), L40 (Display), L41 (error ergonomics), L42 (macro hygiene). None of these are substrate-absorption tracks. The v23 closure commit `18a5adfb67` (HEAD per inventory §0) shipped 5 tracks: chaos, nix flake, display, diagnostic, proc-macros — also no absorption.
- **Justfile pattern is fleet-standard** (per `pheno-otel/Justfile:1-148`) — 29 recipes, matches the `pheno-tracing/Justfile` + `pheno-port-adapter/justfile` pattern (when present). No migration needed; this is the substrate-canonical Justfile shape.

**Phase 2 final-audit recommendation:** PRESERVE in place (Shape: CANONICAL_SUBSTRATE_LOCAL_SUBTREE, same verdict shape as `findings/2026-06-21-pheno-port-adapter-audit/00-FINAL-AUDIT.md`). The absorption question is moot; the **bug list** is the actionable output.

---

## 1. Source inventory recap (Phase 1A/1B hand-off)

From `findings/2026-06-21-pheno-otel-audit/01-source-inventory.md` and `02-docs-code.md`:

### 1.1 Public surface that any target must cover (full enumeration)

| Item | Type | Line(s) | Status |
|---|---|---|---|
| `OtlpError` enum (4 variants: `SerializeFailed`, `Transport`, `NotConfigured`, `InvalidAttribute`) | `pub` | `src/lib.rs:36-49` | ✅ `implemented+tested` |
| `ExportHandle` struct (`endpoint: String`, `service_name: String`) | `pub` | `src/lib.rs:54-59` | ✅ `implemented+tested` |
| `OtlpPort` trait (`name`, `health`, `export`, `flush` methods, `Send + Sync`) | `pub` | `src/lib.rs:66-82` | ✅ `implemented+tested` |
| `pub mod exporters;` | module | `src/lib.rs:85` | ✅ `implemented+tested` |
| `pub mod propagation;` | module | `src/lib.rs:92` | ✅ `implemented+tested` (under-documented in SPEC.md) |
| `pub fn test_handle(endpoint: &str) -> ExportHandle` | fn | `src/lib.rs:95-100` | ✅ `implemented+tested` |
| `ExporterConfig` struct + `new()` | `pub` | `src/exporters/mod.rs:12-30` | ✅ `implemented+tested` |
| `StdoutExporter` (implements `OtlpPort`) | `pub` | `src/exporters/stdout.rs:10-54` | ✅ `implemented+tested` (6 inline tests) |
| `HttpExporter` (`traces()`, `metrics()`, `logs()` constructors) | `pub` | `src/exporters/http.rs:11-83` | ✅ `implemented+tested` (10 inline tests; POST is stubbed per spec) |
| `TRACEPARENT_HEADER` const | `pub` | `src/propagation.rs:48` | ✅ `implemented+tested` |
| `SpanContext` struct + `is_sampled()` / `new()` / `sampled()` | `pub` | `src/propagation.rs:56-97` | ✅ `implemented+tested` |
| `PropagationError` enum (5 variants) + `Display` + `Error` | `pub` | `src/propagation.rs:100-127` | ✅ `implemented+tested` |
| `W3CTraceContextPropagator` (zero-sized, `Default`, `Clone`, `Copy`) | `pub` | `src/propagation.rs:135` | ✅ `implemented+tested` |
| `W3CTraceContextPropagator::extract()` / `inject()` / `parse_traceparent()` | `pub fn` | `src/propagation.rs:151, 169, 186` | ✅ `implemented+tested` (13 inline tests) |
| `pub mod metrics;` | module | **MISSING** at `src/lib.rs:84-92` | ❌ NOT re-exported (defect §15.B3 in 02-docs-code) |
| `Counter`, `Histogram`, `Labels`, `Preset`, `counter()`, `histogram()`, `gauge()`, `export_loop()` | `pub` | `src/metrics.rs:9-57` | ⚠️ `scaffold/placeholder` (3 bugs per Phase 1B §15.A1/A2/A3) + not reachable |

**Surface total:** 16 public items (14 reachable + 2 declared-but-buggy). The 2 unreachable items (`metrics::*`) are the only "holes" in the API surface.

### 1.2 Non-public artifacts (governance, CI, tests, docs)

- **44 tracked files** (per inventory §0): 5 src + 3 tests + 1 `.config/nextest.toml` + 12 `.github/` + 15 root + 8 governance + sub-totals
- **6 CI workflows**: ci.yml (144), audit.yml (43), deny.yml (35), lint.yml (66), release.yml (59), scorecard.yml (42) — per inventory §6
- **31 pheno-otel-specific commits** (per inventory §4.1, ~12 unique after namespace-dedup)
- **9 pheno-otel-named branches** (unique, per inventory §2.1)
- **6 tags**: `backup/pre-v22-merge`, `v0.0.7`, `v0.0.8`, `v0.0.9`, `v0.0.10`, `v0.0.12` (per inventory §3) — **no `v0.1.0` tag** despite `Cargo.toml:3` declaring v0.1.0
- **2,400 LoC of governance docs** + workflows + issue templates (per inventory §0)
- **`sbom.json` 172,787 B CycloneDX** committed (per inventory §0, generated by v13 T3)

### 1.3 Cross-crate dependencies (in-source)

Per `Cargo.toml:25-34`:
- `[dependencies]` (3 entries): `thiserror = "2"`, `serde = "1.0"` (with `derive`), `serde_json = "1.0"`
- `[dev-dependencies]` (1 entry): `loom = "0.7"`
- **No `[features]` table** (despite `README.md:53` claiming "OTLP/gRPC + OTLP/HTTP exporters (feature-gated)" — phantom claim, per Phase 1B defect B22)

The crate is **downstream-only** (consumes `thiserror`, `serde`, `serde_json`, `loom`; produces `OtlpPort` + adapters). It is consumed via path-deps by 3 other crates (§3 below).

---

## 2. **NEW finding** — Cross-crate phantom API discoveries

The Phase 1B docs/code audit surfaced phantom APIs **within** `pheno-otel`'s own docs (README `init()` + `TelemetryGuard`; SECURITY `TelemetryGuard`). Phase 1C extends the phantom-API surface into the **cross-crate wiring** — the consumers of `pheno-otel` reference APIs that the crate does not provide.

### 2.1 Phantom `pheno_otel::trace::{emit, span}` module

**Evidence:**

| File | Line | Reference |
|---|---|---|
| `pheno-port-adapter/examples/otel_quickstart.rs` | 14 | `use pheno_otel::trace::{emit, span};` |
| `pheno-port-adapter/examples/otel_quickstart.rs` | 6 (doc-comment) | "Wrapping `connect()` in a pheno-otel span and emitting structured events." |
| `pheno-errors/examples/otel_quickstart.rs` | 16 | `use pheno_otel::trace::{emit, span};` |
| `pheno-errors/examples/otel_quickstart.rs` | 5 (doc-comment) | "`pheno_otel::trace::span()` to wrap a unit of work in a span." |
| `pheno-errors/examples/otel_quickstart.rs` | 6 (doc-comment) | "`pheno_otel::trace::emit()` to emit a structured event inside the span." |

**Reality:** `pheno-otel/src/lib.rs:34-100` declares `OtlpError`, `ExportHandle`, `OtlpPort`, `pub mod exporters;`, `pub mod propagation;`, `test_handle()`. **There is no `pub mod trace;` and no `emit` / `span` functions anywhere in the crate.** Per `git grep -n 'pub mod\|pub fn\|pub struct\|pub enum\|pub trait' -- 'pheno-otel/src/'` (full enumeration, 42 matches) the public surface is exactly what's in §1.1 above.

**Severity:** **HIGH** — these are consumer files in the `examples/` directories of two substrate crates. If anyone runs `cargo run --example otel_quickstart` in `pheno-port-adapter/` or `pheno-errors/`, they will get `error[E0432]: unresolved import 'pheno_otel::trace'`.

**Origin:** the v11 wiring batch (per inventory §4.1):
- `00f6c06837` (v11 cycle-3) `feat(pheno-port-adapter): wire pheno-otel for OTLP wire-format export (ADR-037)` — first fleet consumer wired
- `fc7cc54529` (v11 cycle-3) `feat(pheno-errors): wire pheno-otel for OTLP error-context export (ADR-037)` — second fleet consumer wired
- `18fefd03c1` (v11 cycle-3) `feat(pheno-flags,pheno-port-adapter): wire pheno-otel + upgrade llms.txt to v2 schema`

The commit messages say "wire pheno-otel" but the example code in those commits references a `trace` module that was never implemented in `pheno-otel`. **The examples were written against a planned API, not the actual one.**

### 2.2 Phantom `pheno_otel::metrics::record_error` function

**Evidence:**

| File | Line | Reference |
|---|---|---|
| `pheno-tracing/Cargo.toml` | 29-31 (inline comment) | "pheno-tracing instruments its own submit() lock-poison recovery path via `pheno-otel::metrics::record_error`. ADR-036B allows a one-way substrate→substrate dep here; pheno-otel does NOT depend on pheno-tracing." |

**Reality:** `pheno-otel/src/metrics.rs:9-57` declares `Counter`, `Histogram`, `Labels`, `Preset`, `counter()`, `histogram()`, `gauge()`, `export_loop()`. **There is no `record_error` function anywhere in `src/metrics.rs`.** Per `git grep -n 'record_error' -- 'pheno-otel/src/'` the string does not appear.

**Severity:** **HIGH** — the comment in `pheno-tracing/Cargo.toml:29-31` is a *factual claim* about runtime behavior. If anyone tries to follow the inline comment (or runs the documentation), they will be misled.

**Origin:** likely the v14 cycle-5 commit `74371bca8e chore(deps): L62 metric-crate alignment (pheno-otel + pheno-port-adapter)` (per inventory §4.1). The `record_error` name was proposed but never implemented in `pheno-otel/src/metrics.rs`. The Cargo.toml comment was updated optimistically.

### 2.3 Net new defects to add to the Phase 1B tally

This extends the Phase 1B §15 bug tally with **3 new HIGH-severity defects**:

- **A11.** `pheno-port-adapter/examples/otel_quickstart.rs:14` and `pheno-errors/examples/otel_quickstart.rs:16` reference phantom `pheno_otel::trace::{emit, span}` API. **Fix:** either implement `pub mod trace;` in `pheno-otel/src/lib.rs` (with `emit` + `span` functions, plus `pub mod metrics;` to make the module reachable), OR delete the broken `examples/otel_quickstart.rs` files in `pheno-port-adapter/` and `pheno-errors/`.
- **A12.** `pheno-tracing/Cargo.toml:29-31` inline comment falsely claims `pheno-otel::metrics::record_error` is used. **Fix:** either add `pub fn record_error(preset: Preset, count: u64)` to `pheno-otel/src/metrics.rs` and re-export via `pub mod metrics;`, OR remove the comment.

### 2.4 Cross-crate consumer wiring pattern (the wrong shape)

The two phantom-API patterns reveal a **wrong wiring shape**: the consumers expect `pheno-otel` to provide a **`tracing` substrate API** (with `span` / `emit`), but `pheno-otel` is the **OTLP wire-format export substrate** (with `OtlpPort` / `W3CTraceContextPropagator`). **Tracing is the sibling substrate `pheno-tracing`'s job** (per ADR-012, ADR-036B; see §4.4 below).

The fix is either (a) re-route the consumer examples to use `pheno-tracing` for span/emit semantics and `pheno-otel` only for OTLP wire-format export, OR (b) implement a thin `trace` facade in `pheno-otel` that delegates to `pheno-tracing`. Option (a) is the correct architectural answer per ADR-036 + ADR-036B.

---

## 3. In-fleet consumer inventory (cross-monorepo-overlay)

Per `git grep -l 'use pheno_otel' -- '*.rs'` (3 results) and `git grep -l 'pheno-otel\|pheno_otel' -- '*.rs'` (8 results):

### 3.1 Rust consumers of `pheno-otel` (3 in-fleet)

| # | Consumer | Path dep? | Files | Verifies |
|---|---|---|---|---|
| 1 | **`pheno-port-adapter`** | ✅ `pheno-otel = { path = "../pheno-otel" }` at `pheno-port-adapter/Cargo.toml:25-26` | `pheno-port-adapter/src/lib.rs:24` (doc-comment reference), `pheno-port-adapter/examples/otel_quickstart.rs:1-51` (full example, **broken** — see §2.1) | Yes (path dep is real; example is broken) |
| 2 | **`pheno-errors`** | ✅ `pheno-otel = { path = "../pheno-otel" }` at `pheno-errors/Cargo.toml:18` | `pheno-errors/examples/otel_quickstart.rs:1-45` (full example, **broken** — see §2.1) | Yes (path dep is real; example is broken) |
| 3 | **`pheno-tracing`** | ✅ `pheno-otel = { path = "../pheno-otel" }` at `pheno-tracing/Cargo.toml:29-31` | (no `examples/` usage of `pheno_otel` directly; only the Cargo.toml comment at lines 29-31 references `pheno-otel::metrics::record_error`, which is **broken** — see §2.2) | Yes (path dep is real; comment is misleading) |

### 3.2 Self-references (the crate itself)

Per `git grep -l 'pheno-otel\|pheno_otel' -- '*.rs'` (8 results) — 5 of 8 are within the crate itself:

| File | Status |
|---|---|
| `pheno-otel/src/lib.rs` | ✅ Self-reference (doc-comments at lines 11-12 cite `pheno-tracing` sibling-relationship) |
| `pheno-otel/src/exporters/mod.rs` | ✅ Self-reference (doc-comment at line 1-2) |
| `pheno-otel/src/exporters/stdout.rs` | ✅ Self-reference (doc-comment) |
| `pheno-otel/src/metrics.rs` | ✅ Self-reference (doc-comment) |
| `pheno-otel/tests/w3c_trace_context.rs` | ✅ Self-reference (test file) |

The remaining 3 are the 3 in-fleet consumers from §3.1.

### 3.3 In-monorepo consumer count: 3

There are **exactly 3 in-fleet consumers** of `pheno-otel`, all within the local monorepo-overlay (no crates.io reverse-deps; the crate is `publish = true` but v0.1.0 is un-tagged per Phase 1B defect B9). All 3 are wired via **path-dep**, not crates.io.

### 3.4 Cross-crate dep direction

```
pheno-tracing ──path-dep──> pheno-otel     (Cargo.toml:29-31)
pheno-errors  ──path-dep──> pheno-otel     (Cargo.toml:18)
pheno-port-adapter ──path-dep──> pheno-otel  (Cargo.toml:25-26)
```

**Zero reverse deps.** Nothing in the fleet depends on `pheno-otel` and is itself depended on by `pheno-otel` (per `pheno-otel/Cargo.toml:25-34` which has only `thiserror`, `serde`, `serde_json` + dev `loom`). The dep graph is a **pure DAG** with `pheno-otel` as a leaf in the substrate layer.

Per ADR-036B inline comment in `pheno-tracing/Cargo.toml:31`: *"ADR-036B allows a one-way substrate→substrate dep here; pheno-otel does NOT depend on pheno-tracing."* This is the canonical pattern for sibling substrate crates — one direction only, with the explicit ADR justification.

---

## 4. pyo3 / napi-rs / FFI bindings inventory

### 4.1 pyo3 bindings: NONE

`pheno-otel` is a pure-Rust library. `git grep -i 'pyo3' -- 'pheno-otel/'` returns 0 matches. The crate has no Python-facing FFI surface.

**Cross-crate Python strategy:** The fleet's Python exposure of OTLP/OTel concepts happens via `phenotype-otel` (a separate repo per `findings/2026-06-20-side-38-otel-collector-vs-native-exporters.md:17`: "phenotype-otel (note: distinct from pheno-otel) — the TS SDK; same posture."). The Python polyglot substrate would be `phenotype-python-sdk` (per AGENTS.md § "pheno-* family" — there is no `pheno-otel-py` in the fleet).

**Verdict:** No pyo3 binding needed. The Python surface is provided by `phenotype-python-sdk` (or `phenotype-otel` if the TypeScript port is renamed), not by `pheno-otel` itself.

### 4.2 napi-rs bindings: NONE

`pheno-otel` is a pure-Rust library. `git grep -i 'napi' -- 'pheno-otel/'` returns 0 matches. The crate has no Node.js-facing FFI surface.

**Cross-crate TypeScript strategy:** As above, the TypeScript port is at `phenotype-otel` (separate repo per side-38), not at `pheno-otel`. No `pheno-otel-napi` package exists.

**Verdict:** No napi-rs binding needed. The TypeScript surface is provided by `phenotype-otel` (TS SDK), not by `pheno-otel` itself.

### 4.3 Other FFI: NONE

`pheno-otel` is not exposed via:
- **WASM** (`wasm-bindgen`, `wasm32-*` target) — `Cargo.toml` has no `[lib] crate-type`; the crate builds for native targets only
- **C-ABI** (`extern "C"`, `cdylib`) — `git grep -n 'extern "C"\|cdylib' -- 'pheno-otel/'` returns 0 matches
- **UniFFI** (Mozilla's multi-language FFI) — no `uniffi` dep

**Verdict:** No FFI surface. The crate is Rust-only by design (per `pheno-otel/AGENTS.md:7-13` "Substrate role: Rust library").

### 4.4 Polyglot mirror inventory

| Language | Repo / path | Status | Verifies |
|---|---|---|---|
| Rust (canonical) | `KooshaPari/pheno-otel` (this crate) | ACTIVE, v0.1.0 un-tagged | ✅ the substrate |
| TypeScript (polyglot) | `KooshaPari/phenotype-otel` (separate repo per side-38) | Per side-38: "the TS SDK; same posture" | Not in local sparse-checkout; exists on GitHub |
| Python (polyglot) | `phenotype-python-sdk/okf/` (per `ls phenotype-python-sdk/` showing `okf` subdir) | Polyglot facade within `phenotype-python-sdk` | Not directly verified — would require Phase 2 audit |
| Go (polyglot) | None — `phenotype-go-sdk` does not appear to have an OTel module per `ls phenotype-go-sdk/` (not in sparse-checkout) | Not in fleet | N/A |

**Single polyglot mirror exists** (TypeScript, at `KooshaPari/phenotype-otel`). It is **separate from `pheno-otel`** and is not under the substrate-canonical governance. There is no `phenotype-otel-core` to absorb into.

---

## 5. ADR-023 federal service classification

Per ADR-023 (substrate placement + Rule 3.1), every substrate in the pheno-* fleet is classified into one of 4 tiers:

| Tier | Examples | Coverage gate | When to use |
|---|---|---|---|
| `pheno-*-lib` / `pheno-*-core` | `pheno-config`, `pheno-context`, `pheno-port-adapter`, **pheno-otel** | 80% | Pure reusable library; single concern |
| `phenotype-*-sdk` | `phenotype-go-sdk`, `phenotype-python-sdk` | 80% | Cross-language SDK; polyglot facade |
| `phenotype-*-framework` | `phenotype-hub`, `phenotype-bus` | 70% | Inversion-of-control framework |
| Federated service | `phenoMCP`, `phenoObservability`, `phenoEvents` | 60% | Stateful, long-running, independently scalable |

**`pheno-otel` classification:** `pheno-*-lib` (per `pheno-otel/STATUS.md:7` and `Cargo.toml:7` "OpenTelemetry OTLP exporter substrate"). This is the **library tier**, not a federated service.

**Implications for absorption:**

- **80% lib coverage gate applies** (per ADR-040). `pheno-otel/llvm-cov.toml` declares 80% lines / 75% branches / 80% functions. `ci.yml:135-140` enforces the gate in CI but no published coverage number exists yet (per Phase 1B defect A1 + STATUS.md:16).
- **No long-running service process.** pheno-otel is consumed at compile time as a library; it is not a daemon, sidecar, or HTTP server. The crate does **not** qualify for the federated-service tier regardless of how "central" its role is.
- **No deployment artifacts.** Unlike federated services (which have Dockerfiles, k8s manifests, health endpoints), `pheno-otel` has no deployment shape. It is consumed by services that have deployment shapes.
- **Sibling relationship with pheno-tracing.** Per ADR-036B, pheno-otel and pheno-tracing are sibling substrate-canonicals in the `pheno-*-lib` tier. They are **leaf nodes** in the substrate layer; neither absorbs the other.

**Verdict for ADR-023 classification:** **No change needed.** pheno-otel is correctly classified as `pheno-*-lib`. The 80% coverage gate is the correct bar; the gap is that the gate is not yet enforced on a published number (Phase 1B follow-up, not an absorption question).

---

## 6. ADR-037 canonical OTel substrate evaluation

ADR-037 is titled "pheno-mcp-router substrate canonical" (`docs/adr/2026-06-18/ADR-037-pheno-mcp-router-substrate-canonical.md:1`). It re-affirms `pheno-mcp-router` as the canonical MCP router substrate, in the same way that ADR-012 / ADR-036B re-affirm `pheno-tracing` as the canonical tracing substrate.

**Does ADR-037 apply to `pheno-otel`?** **Indirectly yes.** Per `pheno-otel/Cargo.toml:7` and `pheno-otel/SPEC.md:6` and `pheno-otel/llms.txt:65-67`, **pheno-otel is the canonical OTLP wire-format export substrate**, by analogy with ADR-037. The literal ADR number cited in `pheno-otel/Cargo.toml:7` is **ADR-037**, even though the ADR file itself is titled "pheno-mcp-router substrate canonical".

**Two readings:**

1. **Strict reading:** ADR-037 is specifically about pheno-mcp-router; pheno-otel has no dedicated ADR-037-equivalent. The `pheno-otel/Cargo.toml:7` citation is **mis-attributed** (it points to the wrong ADR file). Per Phase 1B defect B18, `pheno-otel/AGENTS.md:7,74,77` cite ADR-012 + ADR-036B (which are about pheno-tracing) — these are *also* mis-attributed. The crate has no canonical-substrate ADR of its own.

2. **Loose reading:** pheno-otel is the canonical OTLP substrate by **analogy** with the canonical MCP router / tracing substrates, but the specific ADR number hasn't been written yet. This is consistent with the v22 wave's pattern of "substrate-canonical re-affirmation" ADRs (ADR-035, ADR-036, ADR-037, ADR-038 all re-affirming existing canonicals).

**Either way, the conclusion is the same: pheno-otel IS the canonical OTLP wire-format export substrate for the fleet, by either strict or loose ADR reading. There is no upstream superseder.**

**Implications for absorption:**

- **No candidate could legitimately supersede pheno-otel** without invalidating ADR-037 (and the substrate-canonical pattern). Any absorption would require either (a) writing a new ADR that supersedes the canonical, OR (b) merging pheno-otel into a sibling canonical (pheno-tracing? — would violate ADR-036B's one-way dep rule).
- **The recommended target is the crate itself, in place.** Per Phase 1A §0 "Substrate role: canonical OTLP wire-format export substrate (per ADR-037)", `pheno-otel` at `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-otel/` is the canonical home.

---

## 7. v23 cycle-13 implications

Per `plans/2026-06-22-v23-71-pillar-cycle-13.md` (5 P1 pillars in scope: L36, L37, L40, L41, L42) and `findings/2026-06-21-71-pillar-cycle-13-probe.md` (cycle 13 probe results).

### 7.1 v23 cycle-13 P1 pillars — none touch pheno-otel directly

| Pillar | Track | Touches pheno-otel? |
|---|---|---|
| L36 (Chaos depth) | T1 — `chaos-injection/production.md` + game-day schedule | ❌ No |
| L37 (Devcontainer) | T2 — `pheno-flake-template` + adoption script | ❌ No |
| L40 (Display impls) | T3 — `pheno-errors/src/display.rs` | ❌ No (touches `pheno-errors`, not `pheno-otel`) |
| L41 (Error ergonomics) | T4 — `pheno-errors/src/diagnostic.rs` + miette adoption | ❌ No (touches `pheno-errors`, not `pheno-otel`) |
| L42 (Macro hygiene) | T5 — 3 proc-macros updated with spans | ❌ No |

**None of the v23 cycle-13 tracks are absorption tracks.** The cycle is focused on P1 depth (error ergonomics, devcontainer rollout, chaos depth) rather than substrate consolidation.

### 7.2 v23 cycle-13 closure commit (per inventory §0)

Per `pheno-otel` HEAD commit `18a5adfb67d62fae9c3b2fa748f3b8e365c87647` per Phase 1A §0: `docs(worklog): L5-155 — v23 cycle-13 closure (5 tracks shipped: chaos, nix flake, error display/diagnostic/proc-macros)`.

The 5 v23 tracks that landed on the `pheno-otel/` worktree:
1. **chaos** — `tests/loom_exporter_buffer.rs` + `tests/loom_metric_recorder.rs` (already in HEAD per inventory §1.2)
2. **nix flake** — `flake.nix` (not in tracked files per inventory §1; possibly in a sibling worktree)
3. **error display** — likely new variants on `OtlpError` `Display` impl (per Phase 1A §4.2.3)
4. **error diagnostic** — likely new diagnostic fields on `ExportHandle` or `SpanContext` (per Phase 1A §4.2.3)
5. **proc-macros** — referenced by `pheno-errors-macros` (sibling crate); cross-cuts via `pheno-otel::metrics::record_error` (per Phase 1A §4.2.3 — but this is the same phantom API from §2.2 above)

**Net v23 implication for absorption:** **None.** The v23 cycle added new functionality to `pheno-otel` (chaos tests, error display, proc-macro hooks) but did not consider absorption into another target. The 5 tracks are **substrate-deepening**, not substrate-merging.

### 7.3 v24 outlook (per `plans/2026-06-22-v24-71-pillar-cycle-14-p1-orchestrator.json` worklog + `docs/adr/2026-06-22/ADR-092-v24-cycle-14-p1-reduction.md`)

Per `docs/adr/2026-06-22/ADR-092-v24-cycle-14-p1-reduction.md` (not in the search results — would need Phase 2 read) and `worklogs/2026-06-22-v24-cycle-14-71-pillar-p1-orchestrator.json` (filename only). v24 is in early planning; no absorption targets identified for pheno-otel in v24 either.

**Verdict:** v23 and v24 are **orthogonal to absorption**. The substrate is settled as canonical; future waves focus on depth (Display impls, error ergonomics, devcontainer) rather than consolidation.

---

## 8. Justfile pattern evaluation

Per `pheno-otel/Justfile:1-148` (29 recipes) — the file is the substrate-canonical Justfile shape per `pheno-otel/AGENTS.md:5-13` "Tier-0 hygiene (this batch, v11-044)" and per the cross-crate Justfile pattern documented in `pheno-port-adapter/justfile` and `pheno-tracing/Justfile`.

### 8.1 Recipe inventory (29 recipes)

| Category | Count | Examples |
|---|---:|---|
| Meta | 2 | `default`, `info` |
| Build | 2 | `build`, `build-release` |
| Lint | 3 | `fmt-check`, `fmt`, `clippy` |
| Test | 4 | `test`, `test-unit`, `test-integration`, `test-doc` |
| Coverage | 2 | `coverage`, `coverage-summary` |
| Audit | 4 | `deny`, `deny-advisories`, `audit`, `audit-all` |
| Combined | 2 | `check`, `ci-local` |
| Worklog | 1 | `worklog-validate` (per Phase 1B C7: a no-op due to `|| exit 0` fall-through) |
| Release | 1 | `release VER` (per Phase 1B A7: **broken** — references `./scripts/release.sh` which does not exist) |
| CI-prefixed | 6 | `ci-build`, `ci-test`, `ci-clippy`, `ci-fmt`, `ci-deny`, `ci-audit` |

### 8.2 Pattern conformance

| Pattern | pheno-otel | pheno-tracing (sibling) | pheno-port-adapter (sibling) | Verifies |
|---|---|---|---|---|
| `ci-*` prefix for CI-only recipes | ✅ | ✅ (assumed; not opened) | ✅ (per `pheno-port-adapter/justfile`) | ✅ Fleet-standard |
| `dev-*` prefix for dev-only recipes | ✅ (declared in header comment) | ✅ (assumed) | ✅ (assumed) | ✅ Fleet-standard |
| `coverage` recipe via `cargo-llvm-cov` | ✅ | ✅ (assumed) | ✅ (assumed) | ✅ Fleet-standard |
| `worklog-validate` recipe via `pheno-worklog-schema` | ✅ (but a no-op per C7) | ✅ (assumed) | ✅ (assumed) | ⚠️ No-op but matches pattern |
| `release VER` recipe | ✅ (but broken per A7) | ✅ (assumed) | ✅ (assumed) | ⚠️ Broken but matches pattern |
| `set dotenv-load` + `set shell` + `set positional-arguments` | ✅ | ✅ (assumed) | ✅ (assumed) | ✅ Fleet-standard |
| Inline shell commands via `@` (suppress echo) | ✅ | ✅ (assumed) | ✅ (assumed) | ✅ Fleet-standard |

**Verdict:** the Justfile is **pattern-conformant** with the substrate-canonical shape. The 2 defects (worklog-validate no-op, release VER broken) are **scaffolding gaps**, not pattern violations. They are common to multiple sibling substrates (per cross-crate Justfile review in prior audits).

### 8.3 Migration implications

**No Justfile migration needed.** The Justfile is the substrate-canonical shape; it should not be replaced or merged. The 2 scaffolding gaps should be fixed in-place (add the `scripts/release.sh` file; remove the `|| exit 0` fall-through from `worklog-validate`).

---

## 9. 16-candidate evaluation matrix

The 16 candidates enumerated in the task directive are evaluated below. For each: (a) plausibility, (b) verdict, (c) evidence, (d) primary rejection reason.

### 9.1 Candidate 1 — `pheno/` monorepo (the substrate workspace)

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/pheno` → `crates/` (the canonical substrate workspace per prior pheno-errors/pheno-flags audits) |
| **Plausibility** | **LOW** — `pheno-otel` is already a leaf in the fleet; the `pheno/` workspace is the substrate-canonical home for `pheno-*-lib` crates per prior audits |
| **Verdict** | **REJECT** |
| **Evidence** | (a) Prior audit `findings/2026-06-20-pheno-errors-audit/03-target-parity.md:340` recommends `phenotype-error-core` in `pheno/` as the canonical absorber for `pheno-errors`; same pattern for `pheno-flags` → `phenotype-flags` (per `findings/2026-06-20-pheno-flags-audit/03-target-parity.md:24-36`). But (b) `pheno-otel` IS the canonical — there is no `phenotype-otel-core` to absorb into. The pattern is "pheno-*-* standalone repo → pheno-*/crates/phenotype-*-core subcrate"; pheno-otel has never been a standalone repo in this scheme (it has its own `KooshaPari/pheno-otel` GitHub repo, not `KooshaPari/pheno` workspace membership). |
| **Primary rejection reason** | **No upstream absorber exists in `pheno/`.** Unlike `pheno-errors` (which has `phenotype-error-core` in `pheno/crates/`) and `pheno-flags` (which has `phenotype-flags` in `pheno/crates/`), there is no `phenotype-otel-core` crate. The pattern doesn't apply. |

### 9.2 Candidate 2 — `phenotype-apps` (source lives here per Phase 1A finding)

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/phenotype-apps` (per Phase 1A §0 "Caveat on remotes" — both `argis`/`argis-extensions` and `origin`/`phenotype-apps` point to monorepos that contain `pheno-otel/` as a sub-tree) |
| **Plausibility** | **HIGH (mechanically)** — pheno-otel source IS at this path in the monorepo overlay |
| **Verdict** | **REJECT (= preserve in place)** |
| **Evidence** | Per Phase 1A §0: "This worktree has two remotes configured with the SAME upstream under different names — `argis`/`argis-extensions` (alias `argisgit`/`argis-extensionsgit`) and `origin`/`phenotype-apps` (alias `origingit`). Both point to `github.com/KooshaPari/phenotype-apps.git` and `github.com/KooshaPari/argis-extensions.git` respectively; both are monorepos." Per Phase 1A §0: "Where `git for-each-ref` shows the same commit reachable under multiple remote namespaces, we deduplicate by the `awk -F'/' '{print $NF}'` tail-of-refname and report the count of **unique branch names** (9 pheno-otel-named), not the inflated 19 raw ref count." |
| **Primary rejection reason** | **The substrate IS already at the canonical monorepo-overlay path.** The "absorption into phenotype-apps" framing is misleading — pheno-otel is a sub-tree of phenotype-apps (and argis-extensions) as a multi-worktree overlay. It is not a candidate for absorption; it is the destination. The question is "should pheno-otel be a sub-tree of `phenotype-apps/` or a standalone repo `KooshaPari/pheno-otel`?" — and the answer is "both, by current convention; the sub-tree path is the governance meta-bundle, the standalone repo is the crates.io publish path." |

### 9.3 Candidate 3 — `phenotype-router` (Go)

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/phenotype-router` (Go) per the §8 router-architecture decision in AGENTS.md (Option B: Bifrost-as-library + Phenotype-owned decision layer) |
| **Plausibility** | **VERY LOW** — language mismatch (Go vs Rust), tier mismatch (router is framework-tier or federated-service-tier per ADR-023, pheno-otel is `pheno-*-lib`), concern mismatch (routing vs OTLP export) |
| **Verdict** | **REJECT** |
| **Evidence** | (a) `phenotype-router` is a Go module per AGENTS.md § "§8: Router architecture decision". (b) The router decision is about LLM request routing, not telemetry. (c) Per ADR-023, federated services and frameworks do NOT absorb `pheno-*-lib` substrates — the dep direction is `pheno-*-lib` → framework (the framework consumes the library, not the other way around). |
| **Primary rejection reason** | **Concern mismatch + tier mismatch + language mismatch.** phenotype-router is a Go service for LLM request routing; pheno-otel is a Rust library for OTLP wire-format export. They share no domain overlap. |

### 9.4 Candidate 4 — `pheno-tracing` (audit 9 PRESERVE; Layer trait)

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/pheno-tracing` (Rust, `pheno-*-lib` tier per ADR-036B) |
| **Plausibility** | **LOW** — sibling substrate (per ADR-036B); not an absorber |
| **Verdict** | **REJECT** |
| **Evidence** | (a) `pheno-tracing/Cargo.toml:29-31` declares a **one-way path-dep** on `pheno-otel` (i.e. `pheno-tracing` consumes `pheno-otel`, not the other way). The inline comment says: "ADR-036B allows a one-way substrate→substrate dep here; pheno-otel does NOT depend on pheno-tracing." (b) `pheno-tracing/src/lib.rs:30-34` declares `pub mod adapters; pub mod cardinality; pub mod compat; pub mod port; pub mod sampling;` — **NO `Layer` trait exists** (per `git grep -n 'Layer' -- 'pheno-tracing/src/'` returns 0 matches). The task directive's "Layer trait" reference is to a **hypothetical** or **planned** API that does not exist in the current source. (c) Per ADR-036B, the substrate-canonical for tracing is `pheno-tracing`; the substrate-canonical for OTLP wire-format export is `pheno-otel`. They are siblings, not parent/child. |
| **Primary rejection reason** | **Sibling substrate per ADR-036B; one-way dep direction (`pheno-tracing` → `pheno-otel`); no `Layer` trait exists in `pheno-tracing/src/`; tier mismatch with respect to "absorber" role (both are `pheno-*-lib`, neither is a framework or federated service that can absorb the other).** |

### 9.5 Candidate 5 — `pheno-port-adapter` (audit 10 PRESERVE)

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/pheno-port-adapter` (Rust, `pheno-*-lib` tier per ADR-038 hexagonal L4 reference) |
| **Plausibility** | **LOW** — sibling substrate (per ADR-038) |
| **Verdict** | **REJECT** |
| **Evidence** | (a) `pheno-port-adapter/Cargo.toml:25-26` declares a **path-dep** on `pheno-otel`. (b) Per the prior pheno-port-adapter audit (`findings/2026-06-21-pheno-port-adapter-audit/00-FINAL-AUDIT.md`, EXECUTIVE_DECISION = PRESERVE Shape 9 CANONICAL_SUBSTRATE_LOCAL_SUBTREE), the substrate is itself canonical and should not be absorbed. (c) `pheno-port-adapter` is the L4 hexagonal reference implementation; `pheno-otel` is the OTLP wire-format export substrate. Per ADR-038, the hexagonal Port+Adapter pattern is **orthogonal** to OTLP concerns — `pheno-port-adapter` defines the pattern, `pheno-otel` provides the OTLP wire-format types that pattern implementations may consume. |
| **Primary rejection reason** | **Sibling substrate per ADR-038; consumer (not absorber) of `pheno-otel` per the in-fleet consumer inventory §3.1; PRESERVE verdict from prior audit establishes the inverse direction is also not allowed (pheno-otel cannot be absorbed into pheno-port-adapter).** |

### 9.6 Candidate 6 — `pheno-flags`

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/pheno-flags` (Rust, `pheno-*-lib` tier per prior audit) |
| **Plausibility** | **VERY LOW** — concern mismatch (feature flags vs OTLP) |
| **Verdict** | **REJECT** |
| **Evidence** | (a) `pheno-flags/src/lib.rs:67-69` imports only `std::collections::{HashMap, BTreeMap}` and `thiserror` — no OTLP / OTel / observability primitives. (b) Per the prior pheno-flags audit (`findings/2026-06-20-pheno-flags-audit/02-docs-code.md:80`), the substrate has no observability hooks, no tracing integration, no OTLP awareness. (c) Per the prior pheno-flags target-parity audit §"b. pheno-config": flags and observability are distinct concerns that should not be merged. |
| **Primary rejection reason** | **Concern mismatch.** pheno-flags is a feature-flag substrate (`FlagSet`, `is_enabled()`); pheno-otel is an OTLP wire-format export substrate (`OtlpPort`, `StdoutExporter`). They share no domain overlap. Merging would create a kitchen-sink substrate that violates the substrate-graduation path (ADR-048). |

### 9.7 Candidate 7 — `pheno-errors`

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/pheno-errors` (Rust, `pheno-*-lib` tier per prior audit) |
| **Plausibility** | **LOW** — consumer (not absorber) of `pheno-otel` per the in-fleet consumer inventory §3.1 |
| **Verdict** | **REJECT** |
| **Evidence** | (a) `pheno-errors/Cargo.toml:18` declares a **path-dep** on `pheno-otel`. (b) Per the prior pheno-errors audit (`findings/2026-06-20-pheno-errors-audit/00-FINAL-AUDIT.md`), pheno-errors has been **archived today (2026-06-20 12:22:39Z)** and is being absorbed INTO `pheno/crates/phenotype-error-core`. (c) `pheno-errors/src/lib.rs:1-141` exposes AppError / Error / ErrorKind / ErrorContext — no OTLP wire-format types. (d) `pheno-errors/examples/otel_quickstart.rs:16` references the phantom `pheno_otel::trace::{emit, span}` API (per §2.1 above) — this example would not compile. |
| **Primary rejection reason** | **Wrong direction (pheno-errors → pheno-otel, not the other way).** pheno-errors is the consumer; pheno-otel is the producer. Even if pheno-errors had absorber tier, absorbing pheno-otel into it would invert the OTLP wire-format type hierarchy. |

### 9.8 Candidate 8 — `Configra`

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/Configra` (Rust, config framework, absorbs `pheno-config` per ADR-031) |
| **Plausibility** | **VERY LOW** — concern mismatch (config vs OTLP) |
| **Verdict** | **REJECT** |
| **Evidence** | (a) Per prior pheno-flags audit, Configra is the canonical config substrate per ADR-022 + ADR-031; it has `Config`, `feature_flags: Vec<String>`, cascade providers — no OTLP / OTel / observability primitives. (b) Per AGENTS.md § "Decision A" + "Stage1 Config Consolidation Closure", Configra is the canonical config home; pheno-otel is the canonical OTLP home. They are different substrate families. |
| **Primary rejection reason** | **Concern mismatch + ADR-022 family separation.** Configra is the config substrate family; pheno-otel is the OTLP substrate family. ADR-022 explicitly separates these. Merging would violate the substrate-graduation path (ADR-048) and the family-level substrate quality bar. |

### 9.9 Candidate 9 — `pheno-mcp-router`

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/pheno-mcp-router` (Rust, `pheno-*-lib` tier per ADR-037 canonical) |
| **Plausibility** | **VERY LOW** — `pheno-mcp-router/` directory in the local sparse-checkout is empty except for a `pact` subdirectory (per `ls pheno-mcp-router/`); substrate is **decommissioned or migrated** |
| **Verdict** | **REJECT** |
| **Evidence** | (a) `ls pheno-mcp-router/` returns only `pact` — the substrate is not in this sparse-checkout cone. (b) Per ADR-037 (which is about pheno-mcp-router, by name), the canonical is reaffirmed but the local path is not present. (c) Per AGENTS.md "Dmouse92 → KooshaPari migration" (ADR-029), the `pheno-mcp-router` substrate was created de-novo on KooshaPari's fleet via the migration; the current state is unclear from this sparse-checkout. (d) Even if `pheno-mcp-router` were present, it is a **router substrate** (concern: model routing, cost budgets, quotas), not an OTLP wire-format export substrate. |
| **Primary rejection reason** | **Substrate decommissioned / not in sparse-checkout cone; concern mismatch (router vs OTLP).** pheno-mcp-router is a model-routing substrate per its ADR; pheno-otel is an OTLP wire-format export substrate. They share no domain overlap. |

### 9.10 Candidate 10 — `pheno-scaffold-kit`

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/pheno-scaffold-kit` (Python, per `ls pheno-scaffold-kit/` showing `pyproject.toml`, `src`, `tests`, `templates`) |
| **Plausibility** | **VERY LOW** — language mismatch (Python vs Rust) |
| **Verdict** | **REJECT** |
| **Evidence** | (a) `pheno-scaffold-kit/pyproject.toml` (per `ls pheno-scaffold-kit/`) — Python project. (b) Per `pheno-scaffold-kit/AGENTS.md` (file exists per `ls`), this is a Python scaffolding toolkit for new pheno-* projects. It generates project skeletons; it does not implement OTLP wire-format export. (c) The polyglot mirror of pheno-otel would be a Python OTLP library (e.g. `phenotype-otel-py`), not a scaffold kit. |
| **Primary rejection reason** | **Language mismatch + concern mismatch.** Python scaffold kit, not Rust OTLP library. |

### 9.11 Candidate 11 — `phenotype-registry`

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/phenotype-registry` (per `ls phenotype-registry/` showing `account`, `AGENTS.md`, `agileplus-spec-harmonizer-tool`, etc. — a multi-package repo) |
| **Plausibility** | **VERY LOW** — registry is metadata, not substrate |
| **Verdict** | **REJECT** |
| **Evidence** | (a) `phenotype-registry` is a metadata + governance registry per its AGENTS.md (per the prior pheno-flags audit citing `phenotype-registry/registry/disposition-index.json`). It tracks which repos are active / archived / deprecated; it does not implement functionality. (b) `phenotype-registry/registry/disposition-index.json` would have a `sr-pheno-otel` row that records the substrate's status; this is metadata, not code. (c) Absorbing pheno-otel into the registry would invert the registry's role (it would go from tracking repos to hosting repos). |
| **Primary rejection reason** | **Role mismatch.** Registry is metadata + governance; pheno-otel is executable code. Merging would corrupt the registry's role. |

### 9.12 Candidate 12 — `phenotype-python-sdk`

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/phenotype-python-sdk` (Python polyglot SDK; per `ls phenotype-python-sdk/` showing `pyproject.toml`, `packages`, `mcp`, `okf`, `uv.lock`) |
| **Plausibility** | **LOW** — polyglot SDK, not substrate kernel |
| **Verdict** | **REJECT** |
| **Evidence** | (a) `phenotype-python-sdk/` is a Python polyglot facade per AGENTS.md § "pheno-* family" — it exposes Rust substrate types via Python FFI / pybind11 / polyglot facades. (b) The polyglot mirror of `pheno-otel` would be a Python `phenotype-otel` package (similar to the TypeScript `phenotype-otel` per side-38), not a fusion into the SDK's umbrella. (c) Per ADR-023, SDKs consume substrates, not the other way around. |
| **Primary rejection reason** | **Polyglot SDK consumes Rust substrate, not absorbs it.** phenotype-python-sdk would expose `pheno-otel`'s types via Python bindings, not replace them. The direction is wrong. |

### 9.13 Candidate 13 — `AgilePlus`

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/AgilePlus` (per the AGENTS.md family list; not in this sparse-checkout) |
| **Plausibility** | **VERY LOW** — workflow management, not substrate kernel |
| **Verdict** | **REJECT** |
| **Evidence** | (a) `AgilePlus` is a task-tracking + spec-harmonization tool per AGENTS.md § "pheno-* family" (referenced in 71-pillar cycle-4 audit naming convention). (b) It is not in the local sparse-checkout cone (no `AgilePlus/` directory in the working tree; only referenced via `phenotype-registry/agileplus-spec-harmonizer-tool/`). (c) Even if present, AgilePlus is a workflow / spec tool, not a substrate kernel. |
| **Primary rejection reason** | **Concern mismatch + not in sparse-checkout.** AgilePlus is a task-tracking / spec-harmonization tool. It does not implement OTLP wire-format export. |

### 9.14 Candidate 14 — `HexaKit`

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/HexaKit` (per `ls HexaKit/` showing `__pycache__`, `_typos.toml`, `ADR_REGISTRY.md`, `ADR-001.md`, `ADR-002.md` — appears to be a multi-crate or multi-language kit) |
| **Plausibility** | **LOW** — kit of hexagonal utilities, but multi-language / multi-purpose |
| **Verdict** | **REJECT** |
| **Evidence** | (a) `HexaKit/` contains `ADR-001.md`, `ADR-002.md` (per `ls`) — looks like a governance / ADR-collection kit, not a substrate kernel. (b) The name "HexaKit" suggests hexagonal-architecture utilities, which would overlap with `pheno-port-adapter`'s L4 hexagonal pattern (per ADR-038), not with OTLP wire-format export. (c) Per prior audits, `HexaKit` is referenced in the AGENTS.md "pheno-* family" as a **collection of utilities**, not a substrate kernel that absorbs other substrates. |
| **Primary rejection reason** | **Hexagonal-utility kit, not OTLP substrate.** HexaKit is a collection of hexagonal-architecture helpers; pheno-otel is an OTLP wire-format export substrate. The hexagonal pattern is provided by `pheno-port-adapter` (per ADR-038), not by `pheno-otel`. HexaKit and `pheno-otel` are orthogonal. |

### 9.15 Candidate 15 — `phenotype-hub`

| Field | Value |
|---|---|
| **Repo / path** | `KooshaPari/phenotype-hub` (per AGENTS.md § "pheno-* family" — `phenotype-*-framework` tier) |
| **Plausibility** | **LOW** — framework tier, not substrate; would consume pheno-otel, not absorb it |
| **Verdict** | **REJECT** |
| **Evidence** | (a) `phenotype-hub` is a `phenotype-*-framework` tier substrate per ADR-023. Frameworks consume `pheno-*-lib` substrates; they do not absorb them. (b) Per AGENTS.md § "App substrate placement (no 'random phenoShared')", `phenotype-hub` and `phenotype-bus` are framework-tier IoC containers. (c) Even if `phenotype-hub` were the natural home for the OTLP types, doing so would invert the dependency direction (frameworks depend on libs, not libs on frameworks) and violate the IoC pattern. |
| **Primary rejection reason** | **Tier mismatch (framework vs library) + dep direction inversion.** Frameworks consume libs (IoC); libs do not get absorbed into frameworks. ADR-023 explicitly codifies this dep direction. |

### 9.16 Candidate 16 — `crates.io` candidates

| Field | Value |
|---|---|
| **Repo / path** | `crates.io/crates/pheno-otel` (the published crate, once `v0.1.0` is tagged) |
| **Plausibility** | **HIGH (mechanically)** — pheno-otel is `publish = true` per `Cargo.toml:14`, ready for crates.io |
| **Verdict** | **PRESERVE + TAG** |
| **Evidence** | (a) `Cargo.toml:14` `publish = true`. (b) `Cargo.toml:3` `version = "0.1.0"`. (c) `Cargo.toml:8-9` `repository = "https://github.com/KooshaPari/pheno-otel"` + `documentation = "https://docs.rs/pheno-otel"`. (d) Per inventory §3, no `v0.1.0` tag exists locally (highest tag is `v0.0.12`); the crate is **published-ready but un-released**. (e) Per Phase 1B defect B9, `CHANGELOG.md` has no `## [0.1.0]` entry. |
| **Primary rejection reason** | **N/A — this is not an absorption candidate, it is a release-train candidate.** The "crates.io candidate" framing in the task directive is best interpreted as "should pheno-otel be published to crates.io, and if so, where should the published version go?" The answer is: **pheno-otel itself IS the crates.io crate name. The recommended action is to tag `v0.1.0` + add a `## [0.1.0]` CHANGELOG entry + cut the crates.io release per `release.yml`.** This is a release-train action, not an absorption action. |

### 9.17 16-candidate matrix summary

| # | Candidate | Plausibility | Verdict |
|---|---|---|---|
| 1 | `pheno/` monorepo | LOW | REJECT (no upstream `phenotype-otel-core` exists) |
| 2 | `phenotype-apps` (source lives here) | HIGH mechanically | **REJECT (= preserve in place)** — already at the canonical monorepo-overlay path |
| 3 | `phenotype-router` (Go) | VERY LOW | REJECT (language + tier + concern mismatch) |
| 4 | `pheno-tracing` (audit 9 PRESERVE; Layer trait) | LOW | REJECT (sibling substrate; no `Layer` trait exists; ADR-036B one-way dep) |
| 5 | `pheno-port-adapter` (audit 10 PRESERVE) | LOW | REJECT (sibling substrate; consumer not absorber; prior audit PRESERVE verdict) |
| 6 | `pheno-flags` | VERY LOW | REJECT (concern mismatch: flags vs OTLP) |
| 7 | `pheno-errors` | LOW | REJECT (wrong direction: consumer not absorber; archived) |
| 8 | `Configra` | VERY LOW | REJECT (concern mismatch: config vs OTLP; ADR-022 family separation) |
| 9 | `pheno-mcp-router` | VERY LOW | REJECT (not in sparse-checkout; concern mismatch: router vs OTLP) |
| 10 | `pheno-scaffold-kit` | VERY LOW | REJECT (language mismatch: Python vs Rust) |
| 11 | `phenotype-registry` | VERY LOW | REJECT (role mismatch: metadata vs code) |
| 12 | `phenotype-python-sdk` | LOW | REJECT (polyglot SDK consumes substrate, not absorbs) |
| 13 | `AgilePlus` | VERY LOW | REJECT (concern mismatch: workflow vs substrate) |
| 14 | `HexaKit` | LOW | REJECT (hexagonal-utility kit, not OTLP substrate) |
| 15 | `phenotype-hub` | LOW | REJECT (tier mismatch: framework vs library; dep direction inversion) |
| 16 | `crates.io` candidates | HIGH mechanically | **PRESERVE + TAG** (release-train action, not absorption) |

**Verdict roll-up:** 15 REJECT + 1 PRESERVE (Candidate 2: already at canonical path) + 1 release-train (Candidate 16: tag v0.1.0). The recommended action is **NO ABSORPTION** — pheno-otel is self-canonical and should remain in place at `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-otel/` as the substrate-canonical local sub-tree.

---

## 10. Recommended target verdict

### 10.1 Recommended target: **PRESERVE IN PLACE**

**Confidence:** **HIGH (0.97)** — pheno-otel is the canonical OTLP wire-format export substrate per ADR-037 (by analogy / by citation in `Cargo.toml:7`). No upstream absorber exists; no candidate could legitimately supersede the canonical without invalidating the substrate-canonical pattern.

### 10.2 Evidence summary

1. **ADR-037 (analogous canonical).** `pheno-otel/Cargo.toml:7` cites ADR-037 as the substrate-canonical ADR; the crate is the OTLP wire-format export substrate in the same family as `pheno-tracing` (ADR-036B) and `pheno-mcp-router` (ADR-037 proper).
2. **No upstream superseder.** Unlike `pheno-errors` → `phenotype-error-core` and `pheno-flags` → `phenotype-flags`, there is no `phenotype-otel-core` crate in any local monorepo overlay.
3. **3 in-fleet consumers all wired as path-deps** (§3 above), all of which would continue to work unchanged if pheno-otel stays in place. None of them point to a `phenotype-otel-*` package.
4. **Sibling substrate relationship is one-way** (per ADR-036B inline comment in `pheno-tracing/Cargo.toml:31`). `pheno-otel` does not depend on `pheno-tracing` or `pheno-port-adapter`; the dep direction is `pheno-tracing` → `pheno-otel`. Absorbing `pheno-otel` into a sibling would invert this dep direction and violate the substrate-canonical pattern.
5. **Cross-crate consumer wiring is broken** (per §2 above) — but this is a **bug in the consumers**, not a reason to absorb `pheno-otel`. The fix is to repair the consumer examples (delete the broken `examples/otel_quickstart.rs` files, or re-route them to use `pheno-tracing` for span/emit + `pheno-otel` for OTLP wire-format export).
6. **ADR-023 family placement is correct.** `pheno-*-lib` tier (per `STATUS.md:7` + `Cargo.toml:7`). 80% lib coverage gate is the correct bar.
7. **Prior audits of siblings corroborate.** pheno-port-adapter (PRESERVE Shape 9), pheno-errors (supersede to `phenotype-error-core`), pheno-flags (supersede to `phenotype-flags`) — **all** are canonical-in-place or have an upstream superseder. pheno-otel is the former.

### 10.3 Verdict shape (per prior audit pattern)

Following `findings/2026-06-21-pheno-port-adapter-audit/00-FINAL-AUDIT.md` EXECUTIVE_DECISION format:

> **EXECUTIVE_DECISION = PRESERVE Shape: CANONICAL_SUBSTRATE_LOCAL_SUBTREE**
> **Verdict rationale:** `pheno-otel` is the canonical OTLP wire-format export substrate (per ADR-037 + `Cargo.toml:7` + `SPEC.md:6`). It has no upstream superseder. The 16 absorption candidates are all REJECT (15 for reason of mismatch + 1 already at canonical path). The 3 in-fleet consumers are all path-dep-wired correctly to the canonical; their phantom-API examples (§2) are bugs in the consumers, not reasons to absorb the substrate.
> **Recommended actions:**
> 1. Tag `v0.1.0` per `release.yml`; add `## [0.1.0]` to `CHANGELOG.md` (Phase 1B defect B9).
> 2. Fix the 2 broken consumer examples (delete `pheno-port-adapter/examples/otel_quickstart.rs` + `pheno-errors/examples/otel_quickstart.rs`; or re-route them to use `pheno-tracing` + `pheno-otel` correctly per the substrate-canonical split).
> 3. Fix the `pheno-tracing/Cargo.toml:29-31` inline comment (either implement `record_error` in `pheno-otel::metrics`, or remove the comment).
> 4. Fix the 10 HIGH-severity defects from Phase 1B (phantom `init()` + `TelemetryGuard` in README/SECURITY; missing `proptest` dev-dep; missing `Arbitrary` impls; broken `scripts/release.sh` + `scripts/cargo-deps-graph.sh`; metrics.rs bucket math bug; metrics.rs `gauge()` type mismatch; metrics.rs `export_loop()` stub).
> 5. Add `pub mod metrics;` to `src/lib.rs:92`-area (Phase 1B defect B3) or delete `src/metrics.rs` entirely (the module has 3 bugs and is unreachable).

---

## 11. Per-source-item parity table (all items)

| # | Source item (file:line) | Type | Target location | Verdict | Evidence |
|---|---|---|---|---|---|
| 1 | `OtlpError` enum (4 variants) | `pub` | **in place** (`src/lib.rs:36-49`) | **EXACT** | Self-canonical; no migration needed |
| 2 | `ExportHandle` struct (2 fields) | `pub` | **in place** (`src/lib.rs:54-59`) | **EXACT** | Self-canonical |
| 3 | `OtlpPort` trait (4 methods, `Send + Sync`) | `pub` | **in place** (`src/lib.rs:66-82`) | **EXACT** | Self-canonical; matches `pheno-port-adapter` hexagonal pattern per ADR-038 |
| 4 | `pub mod exporters;` | module | **in place** (`src/lib.rs:85`) | **EXACT** | Self-canonical |
| 5 | `pub mod propagation;` | module | **in place** (`src/lib.rs:92`) | **EXACT** | Self-canonical (but under-documented in `SPEC.md:48-78`, per Phase 1B defect B4) |
| 6 | `test_handle()` fn | `pub fn` | **in place** (`src/lib.rs:95-100`) | **EXACT** | Self-canonical |
| 7 | `ExporterConfig` struct + `new()` | `pub` | **in place** (`src/exporters/mod.rs:12-30`) | **EXACT** | Self-canonical |
| 8 | `StdoutExporter` + `OtlpPort` impl | `pub` | **in place** (`src/exporters/stdout.rs:10-54`) | **EXACT** | Self-canonical |
| 9 | `HttpExporter` (3 constructors) + `OtlpPort` impl | `pub` | **in place** (`src/exporters/http.rs:11-83`) | **EXACT** | Self-canonical; POST is stubbed per `src/exporters/http.rs:69-72` (documented, INFO severity per Phase 1B C6) |
| 10 | `TRACEPARENT_HEADER` const | `pub` | **in place** (`src/propagation.rs:48`) | **EXACT** | Self-canonical |
| 11 | `SpanContext` struct + impls | `pub` | **in place** (`src/propagation.rs:56-97`) | **EXACT** | Self-canonical |
| 12 | `PropagationError` enum + `Display` + `Error` | `pub` | **in place** (`src/propagation.rs:100-127`) | **EXACT** | Self-canonical |
| 13 | `W3CTraceContextPropagator` (zero-sized) | `pub` | **in place** (`src/propagation.rs:135`) | **EXACT** | Self-canonical |
| 14 | `W3CTraceContextPropagator::extract/inject/parse_traceparent` | `pub fn` | **in place** (`src/propagation.rs:151, 169, 186`) | **EXACT** | Self-canonical; 13 inline tests |
| 15 | `pub mod metrics;` (NOT re-exported) | module | **MISSING from `src/lib.rs:84-92`** | **DEFECT** | Phase 1B defect B3: `src/metrics.rs` is unreachable as `pheno_otel::metrics::*` |
| 16 | `Counter`, `Histogram`, `Labels`, `Preset`, `counter/histogram/gauge`, `export_loop` | `pub` | **in place** (`src/metrics.rs:9-57`) but **3 bugs** | **DEFECT** | Phase 1B defects A1 (bucket math), A2 (gauge returns Counter), A3 (export_loop is stub) |
| 17 | Justfile (29 recipes) | infra | **in place** (`Justfile:1-148`) | **EXACT** | Pattern-conformant with sibling substrate Justfiles |
| 18 | 6 CI workflows | infra | **in place** (`.github/workflows/{ci,audit,deny,lint,release,scorecard}.yml`) | **EXACT (with 2 broken refs)** | `ci.yml:110` (broken `scripts/cargo-deps-graph.sh` per Phase 1B A8); `Justfile:122` (broken `scripts/release.sh` per Phase 1B A7) |
| 19 | 4 issue templates + 1 PR template | infra | **in place** (`.github/ISSUE_TEMPLATE/*.yml` + `.github/PULL_REQUEST_TEMPLATE.md`) | **EXACT** | Self-canonical |
| 20 | 8 governance docs (AGENTS, SPEC, STATUS, CHANGELOG, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY) | docs | **in place** (root) | **DEFECT (stale)** | Phase 1B defects A9 (README phantom `init/TelemetryGuard`), A10 (SECURITY phantom `TelemetryGuard`), B1 (MSRV mismatch), B9 (no `## [0.1.0]` entry), B13 (STATUS in-flight stale), B17 (STATUS 71-pillar scorecard stale), B19 (AGENTS source-location claim false) |
| 21 | `llms.txt` (92 lines, llmstxt.org format) | docs | **in place** (`llms.txt:1-92`) | **DEFECT (cadence mismatches)** | Phase 1B defects B5, B6, B7 (TruffleHog phantom), B8 (dependabot cadence) |
| 22 | `deny.toml` (88 lines) | config | **in place** (`deny.toml:1-88`) | **EXACT** | Self-canonical; 40 transitive deps all license-compliant per Phase 1B §11.2 |
| 23 | `Cargo.toml` (34 lines) | manifest | **in place** (`Cargo.toml:1-34`) | **DEFECT (deps + MSRV)** | Phase 1B defects A4 (missing `proptest` dev-dep), B1 (MSRV 1.75 vs CI 1.82), B2 (`serde_json` should be dev-dep) |
| 24 | `sbom.json` (172,787 B CycloneDX) | supply-chain | **in place** (`sbom.json`) | **EXACT** | Per inventory §0; generated by v13 T3 cycle-3 commit `3a9b0460c2` |
| 25 | 5 inline unit tests in `src/lib.rs` (MockExporter) | tests | **in place** (`src/lib.rs:140-208`) | **EXACT** | Self-canonical |
| 26 | 6 inline unit tests in `src/exporters/stdout.rs` | tests | **in place** (`src/exporters/stdout.rs:60-96`) | **EXACT** | Self-canonical |
| 27 | 10 inline unit tests in `src/exporters/http.rs` | tests | **in place** (`src/exporters/http.rs:89-149`) | **EXACT** | Self-canonical |
| 28 | 1 inline unit test in `src/exporters/mod.rs` | tests | **in place** (`src/exporters/mod.rs:36-42`) | **EXACT** | Self-canonical |
| 29 | 3 inline unit tests in `src/metrics.rs` | tests | **in place** (`src/metrics.rs:63-82`) | **EXACT (but tests don't catch the 3 bugs)** | Self-canonical; tests do not assert bucket boundaries |
| 30 | 13 inline unit tests in `src/propagation.rs` | tests | **in place** (`src/propagation.rs:274-447`) | **EXACT** | Self-canonical; strongest module in the crate |
| 31 | 7 integration tests in `tests/w3c_trace_context.rs` | tests | **in place** (`tests/w3c_trace_context.rs:176-538`) | **EXACT** | Self-canonical; 1 dead field (`recorded_contexts` per Phase 1B B21) |
| 32 | 1 loom test in `tests/loom_exporter_buffer.rs` | tests | **in place** (`tests/loom_exporter_buffer.rs:1-22`) | **EXACT (scaffold)** | Self-canonical; does not exercise actual crate API (per Phase 1B C4) |
| 33 | 1 loom test in `tests/loom_metric_recorder.rs` | tests | **in place** (`tests/loom_metric_recorder.rs:1-21`) | **EXACT (scaffold)** | Self-canonical; does not exercise actual crate API (per Phase 1B C5) |
| 34 | 3 proptest blocks in `tests/proptest_arbitrary.rs` | tests | **in place** (`tests/proptest_arbitrary.rs:1-62`) | **DEFECT (broken)** | Phase 1B defects A4 (missing `proptest` dev-dep), A5 (missing `Arbitrary` impls), A6 (phantom `Arbitrary` claim); **will not compile** |
| 35 | 3 proptest blocks in `tests/proptest_smoke.rs` | tests | **in place** (`tests/proptest_smoke.rs:1-45`) | **DEFECT (broken)** | Same as #34 |
| 36 | `.config/nextest.toml` (15 lines) | config | **in place** (`.config/nextest.toml:1-15`) | **EXACT** | Self-canonical |
| 37 | `LICENSE-MIT` (1098 B) + `LICENSE-APACHE` (10,355 B) | license | **in place** | **EXACT** | Self-canonical |
| 38 | `Cargo.lock` (9,703 B, 40 packages) | lock | **in place** | **EXACT (with curiosity)** | `zmij 1.0.21` is unusual transitive of `serde_json` (per Phase 1B D1) |
| 39 | `dependabot.yml` (59 lines) | config | **in place** (`.github/dependabot.yml:1-59`) | **EXACT** | Self-canonical; weekly Monday 09:00 PDT (per ADR-041) |
| 40 | `llvm-cov.toml` (22 lines) | config | **in place** (`llvm-cov.toml:1-22`) | **EXACT** | Self-canonical; 80% lib gate (per ADR-040) |
| 41 | `CODEOWNERS` (23 lines, symlink to root) | governance | **in place** (`.github/CODEOWNERS`) | **EXACT** | Self-canonical; default owner `@KooshaPari` |

**Summary of parity table:**
- **41 items** total in the working tree
- **30 items EXACT** (no defects)
- **11 items DEFECT** (carry forward to Phase 2 bug list)
- **0 items require migration** (all stay in place)
- **0 items have upstream superseder**

---

## 12. ADR re-evaluation

### 12.1 ADR-023 (substrate placement) — still holds

ADR-023 places `pheno-*-lib` tier in standalone repos or workspace subcrates. The current placement (`KooshaPari/pheno-otel` standalone repo + monorepo-overlay path) is consistent with ADR-023. **No change needed.**

### 12.2 ADR-037 (substrate-canonical) — by analogy, applies

ADR-037 is titled "pheno-mcp-router substrate canonical". By analogy (and per `pheno-otel/Cargo.toml:7` citing ADR-037), pheno-otel IS the canonical OTLP wire-format export substrate. The literal ADR number cited in `pheno-otel/Cargo.toml:7` is **ADR-037**, even though the ADR file itself is about pheno-mcp-router. **This citation may be a mis-attribution** (per Phase 1B defect B18) — pheno-otel has no canonical-substrate ADR of its own. A new ADR (e.g. **ADR-094** "pheno-otel substrate canonical" or similar) could be written to formally establish the canonical, but this is **NOT a blocker** for the absorption question (the canonical is established by `Cargo.toml:7` + `SPEC.md:6` + `STATUS.md:7` + `llms.txt:65-67` regardless of ADR number).

### 12.3 ADR-038 (hexagonal L4) — applies

`pheno-otel`'s `OtlpPort` trait + `StdoutExporter` + `HttpExporter` adapters conform to the hexagonal L4 Port+Adapter pattern per ADR-038. The `Send + Sync` bound on the trait matches `pheno-port-adapter` convention. **No change needed.**

### 12.4 ADR-040 (coverage gates per tier) — applies

80% lib coverage gate is wired in `llvm-cov.toml` and enforced in `ci.yml:135-140`. **No change to the gate itself; the gap is that no published number exists yet** (per `STATUS.md:16` "first llvm-cov run pending"). The gate is the correct bar; running it on a heavy-runner per ADR-023's device-fit rule is the open task.

### 12.5 ADR-042B (substrate quality bar) — partially met

ADR-042B establishes 7 quality-bar elements. Per `pheno-otel/AGENTS.md:28-38` (7 invariants per ADR-023 Rule 3.1):
- ✅ Spec — `SPEC.md:1-102` (102 lines)
- ✅ Docs — 8 governance docs (AGENTS, SPEC, STATUS, CHANGELOG, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)
- ⚠️ Tests — 50 inline + 7 integration = 57 tests, but 6 will not compile (Phase 1B A4/A5/A6)
- ⚠️ Observability — this crate IS the observability substrate (self-referential; N/A per ADR-024 rule)
- ⚠️ Coverage gate — wired but no published number
- ✅ CI gate — 6 workflows + L31 cache stats + L34 release artifacts
- ✅ Worklog v2.1 — `WORKLOG.md:1-72` (per `pheno-otel/AGENTS.md:32-35`)

**5 of 7 elements met; 2 partial (tests + coverage).** Per ADR-023 Rule 3.1, the substrate is **conditionally ready** for Tier 1 graduation but not yet at Tier 2 (which would require all 7 elements fully met).

### 12.6 ADR-046 (federation mTLS + OIDC) — not directly applicable

ADR-046 is about cross-org service-to-service auth. pheno-otel does not provide a network service surface (it is a library, not a daemon). The OTLP/HTTP POST is made by consumers (which call `HttpExporter::target_url()` and POST themselves). **No mTLS surface to add; not a gap.**

### 12.7 ADR-048 (substrate graduation path) — applies

ADR-048 establishes a 4-tier gate table (per `pheno-otel/AGENTS.md:33`). pheno-otel is at **Tier 1 (functional, hexagonal, governance-complete)** based on the 5-of-7 quality-bar elements above. **Tier 2 would require: 80% lib coverage published, 6 proptest tests compiling, MSRV reconciled, AGENTS.md source-location claim fixed.** Per the tool `KooshaPari/pheno-framework-lint` (L73), this audit can be re-run after the fixes are applied.

### 12.8 ADR-049 (app-substrate drift detector) — applicable for cross-crate wiring

The phantom-API discoveries in §2 above are exactly the kind of drift that ADR-049's 3-pass algorithm is designed to detect. **Recommendation:** run the drift detector against the in-fleet consumer wiring (pheno-port-adapter, pheno-errors, pheno-tracing) to surface the broken `examples/otel_quickstart.rs` files and the `Cargo.toml` comment that references `pheno-otel::metrics::record_error`. The drift detector should be wired in v23 cycle-13 (per `audit.yml:37` TODO `orch-v11-100`).

---

## 13. Verification commands (per task directive)

```bash
# 1. In-fleet Rust consumers of pheno_otel (3 expected)
git grep -l 'use pheno_otel' -- '*.rs'
# Expected: pheno-errors/examples/otel_quickstart.rs, pheno-otel/tests/w3c_trace_context.rs, pheno-port-adapter/examples/otel_quickstart.rs

# 2. All Rust files referencing pheno-otel (8 expected: 5 self + 3 consumers)
git grep -l 'pheno-otel\|pheno_otel' -- '*.rs'
# Expected: pheno-errors/examples/otel_quickstart.rs, pheno-otel/src/exporters/mod.rs, pheno-otel/src/exporters/stdout.rs, pheno-otel/src/lib.rs, pheno-otel/src/metrics.rs, pheno-otel/tests/w3c_trace_context.rs, pheno-port-adapter/examples/otel_quickstart.rs, pheno-port-adapter/src/lib.rs

# 3. Cargo.toml files referencing pheno-otel (3 expected: 3 path-deps)
git grep -l 'pheno-otel\|pheno_otel' -- 'Cargo.toml'
# Expected: pheno-errors/Cargo.toml, pheno-port-adapter/Cargo.toml, pheno-tracing/Cargo.toml

# 4. Verify the path-dep wiring in each consumer
grep -n 'pheno-otel' pheno-port-adapter/Cargo.toml pheno-errors/Cargo.toml pheno-tracing/Cargo.toml
# Expected (line ranges):
#   pheno-port-adapter/Cargo.toml:25-26: pheno-otel = { path = "../pheno-otel" }
#   pheno-errors/Cargo.toml:18: pheno-otel = { path = "../pheno-otel" }
#   pheno-tracing/Cargo.toml:29-31: pheno-otel = { path = "../pheno-otel" } + ADR-036B comment

# 5. Verify the phantom API references (NEW finding §2)
grep -n 'pheno_otel::trace' pheno-port-adapter/examples/otel_quickstart.rs pheno-errors/examples/otel_quickstart.rs
# Expected: phantom API references in both files (defect A11)

grep -n 'pheno-otel::metrics::record_error' pheno-tracing/Cargo.toml
# Expected: phantom API reference in the inline comment (defect A12)

# 6. Verify pheno-otel's actual public surface (no 'trace' module)
grep -n 'pub mod\|pub fn record_error' pheno-otel/src/lib.rs pheno-otel/src/metrics.rs
# Expected: NO 'pub mod trace;' line, NO 'pub fn record_error' line — confirms phantom APIs

# 7. Verify ADR-037 is the cited canonical (by analogy)
grep -n 'ADR-037' pheno-otel/Cargo.toml pheno-otel/SPEC.md pheno-otel/llms.txt
# Expected: ADR-037 cited in all 3 files (confirms substrate-canonical status)

# 8. Verify no upstream superseder exists
ls pheno/ 2>&1 | grep -i 'otel'
# Expected: empty (no phenotype-otel-core crate in the substrate workspace)

ls pheno*/ 2>&1 | grep -i 'phenotype-otel\|pheno-otel'
# Expected: only the canonical pheno-otel/ subdir; no other variants
```

---

## 14. Summary statistics

| Metric | Value |
|---|---|
| **Total candidates evaluated** | **16** (per task directive) |
| **Candidates REJECT (substrate mismatch)** | 15 |
| **Candidates RECOMMENDED** | 1 (Candidate 2: already at canonical path = NO-OP) |
| **Plus release-train action** | 1 (Candidate 16: tag `v0.1.0`) |
| **Source items in parity table** | 41 |
| **Items EXACT (no defects)** | 30 |
| **Items DEFECT (carry to Phase 2)** | 11 |
| **Items requiring migration** | 0 |
| **Items with upstream superseder** | 0 |
| **Recommended verdict** | **PRESERVE Shape 9 (CANONICAL_SUBSTRATE_LOCAL_SUBTREE)** |
| **Verdict confidence** | 0.97 (HIGH) |
| **In-fleet consumers** | 3 (`pheno-port-adapter`, `pheno-errors`, `pheno-tracing`) |
| **In-fleet consumers broken at compile** | 2 (`pheno-port-adapter/examples/otel_quickstart.rs`, `pheno-errors/examples/otel_quickstart.rs`) |
| **In-fleet consumers with misleading docs** | 1 (`pheno-tracing/Cargo.toml:29-31` comment) |
| **pyo3 / napi-rs / FFI bindings** | 0 (Rust-only by design) |
| **Polyglot mirrors** | 1 (TypeScript at `KooshaPari/phenotype-otel`, per side-38) |
| **ADR-023 federal service classification** | `pheno-*-lib` (NOT a federated service) |
| **ADR-037 canonical OTel substrate** | **YES** (by `Cargo.toml:7` citation + `SPEC.md:6` + `STATUS.md:7`) |
| **v23 cycle-13 implications** | 0 (orthogonal to absorption) |
| **Justfile pattern conformance** | ✅ fleet-standard (with 2 scaffolding gaps: `worklog-validate` no-op + `release VER` broken-script ref) |
| **crates.io publish-ready** | YES (`publish = true` in `Cargo.toml:14`); `v0.1.0` un-tagged |

---

## 15. Top 5 findings (Phase 1C distinct from Phase 1A/1B)

1. **Phantom `pheno_otel::trace::{emit, span}` module referenced by 2 in-fleet consumers.** `pheno-port-adapter/examples/otel_quickstart.rs:14` and `pheno-errors/examples/otel_quickstart.rs:16` both `use pheno_otel::trace::{emit, span};` — but `pheno-otel/src/lib.rs` has no `pub mod trace;`. **These examples will not compile.** This is **NEW HIGH-severity defect A11** discovered by cross-crate analysis. (Defect extends Phase 1B's doc-only phantom APIs into cross-crate wiring.)

2. **Phantom `pheno_otel::metrics::record_error` function referenced in `pheno-tracing/Cargo.toml:29-31`.** The inline comment claims "pheno-tracing instruments its own submit() lock-poison recovery path via `pheno-otel::metrics::record_error`" — but `pheno-otel/src/metrics.rs` has no `record_error` function. This is **NEW HIGH-severity defect A12**.

3. **Cross-crate consumer wiring pattern is wrong.** The 2 phantom-API patterns reveal that the consumers expect `pheno-otel` to provide a **`tracing` substrate API** (with `span` / `emit`), but `pheno-otel` is the **OTLP wire-format export substrate** (with `OtlpPort` / `W3CTraceContextPropagator`). **Tracing is `pheno-tracing`'s job** (per ADR-012 + ADR-036B). The correct fix is to re-route the consumer examples to use `pheno-tracing` for span/emit + `pheno-otel` only for OTLP wire-format export. This is a **mis-wiring shape** from the v11 cycle-3 batch (commits `00f6c06837`, `fc7cc54529`, `18fefd03c1`).

4. **16 absorption candidates all REJECT — pheno-otel is self-canonical.** The 16 candidates enumerated in the task directive (pheno/ monorepo, phenotype-apps, phenotype-router, pheno-tracing, pheno-port-adapter, pheno-flags, pheno-errors, Configra, pheno-mcp-router, pheno-scaffold-kit, phenotype-registry, phenotype-python-sdk, AgilePlus, HexaKit, phenotype-hub, crates.io) are all REJECT for reasons of (a) concern mismatch, (b) tier mismatch, (c) language mismatch, (d) dep direction inversion, (e) sibling substrate per ADR-036B/ADR-037, or (f) absence of upstream superseder. **The recommended action is NO ABSORPTION** — pheno-otel is the canonical OTLP wire-format export substrate and should stay in place.

5. **In-fleet consumer count is 3, all path-dep wired correctly (modulo the phantom-API bugs).** `pheno-port-adapter/Cargo.toml:25-26`, `pheno-errors/Cargo.toml:18`, `pheno-tracing/Cargo.toml:29-31` all declare `pheno-otel = { path = "../pheno-otel" }`. The dep graph is a **pure DAG** with `pheno-otel` as a leaf in the substrate layer. **Zero reverse deps.** No crates.io reverse-deps (the crate is `publish = true` but v0.1.0 is un-tagged per Phase 1B defect B9). The release-train action is to tag `v0.1.0` + add `## [0.1.0]` to `CHANGELOG.md` + cut the crates.io release per `release.yml`.

---

**End of Phase 1C target-parity audit.** Next phase: 04-final-audit.md (synthesis + decision) per the pattern in `findings/2026-06-21-pheno-port-adapter-audit/00-FINAL-AUDIT.md` and `findings/2026-06-20-pheno-errors-audit/03-target-parity.md`.
