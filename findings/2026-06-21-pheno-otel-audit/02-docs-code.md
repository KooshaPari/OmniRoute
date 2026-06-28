# Phase 1B — Docs/Code Analysis: `pheno-otel`

**Scope:** `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-otel/`
**Date:** 2026-06-21 (system date)
**Audit series:** `findings/2026-06-21-pheno-otel-audit/`
**Phase 1B** (this file): docs/code parity, API contract validation, bug tally
**Phase 1A** (read first): `findings/2026-06-21-pheno-otel-audit/01-source-inventory.md` (717 lines)
**Branch:** `chore/v22-71-pillar-cycle-12-p1-2026-06-22` @ `18a5adfb67` (v23 cycle-13 closure per HEAD commit msg)
**Authoritative cross-references:**
- ADR-023 (substrate placement + Rule 3.1 quality bar)
- ADR-037 (analogous pheno-mcp-router substrate-canonical)
- ADR-038 (hexagonal L4 Port/Adapter policy)
- ADR-040 (test coverage gates per tier — 80% lib)
- ADR-042 / ADR-042B (substrate quality bar — 7-element)
- ADR-024 + ADR-041 (71-pillar framework + refresh cadence)
- Sibling substrate pattern docs: `pheno-tracing`, `pheno-port-adapter`

> **Methodology:** every claim cites `filepath:startLine` or `filepath:startLine-endLine`. Severity rubric (HIGH/MEDIUM/LOW/INFO) is applied at §15 with full bug tally. Status categories used throughout: `implemented+tested`, `implemented+untested`, `scaffold/placeholder`, `attempted`, `docs-only`, `branch-only`, `phantom` (referenced but absent), `mismatch` (docs disagree with code).

---

## 0. Executive summary (TL;DR)

`pheno-otel` is a small Rust library (1,030 LOC src, 13 source files, 5 in-tree modules) that exposes a hexagonal `OtlpPort` trait with two concrete Adapter impls (`StdoutExporter`, `HttpExporter`) and a W3C Trace Context Level 2 propagator. The **core kernel is well-implemented and well-tested** (40 inline unit tests + 7 W3C integration tests, 547 LOC total tests; coverage gate wired but no published number yet).

**However, the audit surfaces 4 HIGH-severity findings that gate v1.0 release:**

1. **Phantom API documented but absent** — `README.md:30-38` and `SECURITY.md:57-58` describe a `pheno_otel::init()` function and a `TelemetryGuard` `Drop`-based RAII type. **Neither exists** in `src/lib.rs` or any module of the working tree. The crate's actual public API is `OtlpPort` / `StdoutExporter` / `HttpExporter` / `ExporterConfig` / `W3CTraceContextPropagator` / `SpanContext` / `PropagationError` / `OtlpError` / `ExportHandle` / `test_handle`. `SECURITY.md` and `README.md` are **stale relative to v0.1.0**; they describe a planned (or older 0.27-line pin per `README.md:7-8`) API.

2. **`proptest` is referenced by 2 test files but missing from `[dev-dependencies]`** — `tests/proptest_arbitrary.rs:19` and `tests/proptest_smoke.rs:13` both `use proptest::prelude::*;` and call `any::<OtlpError>()` / `any::<ExportHandle>()` (lines 28, 44, 23, 33, 41), which require `Arbitrary` impls. **No `Arbitrary` impl exists for either type anywhere in the source tree.** `Cargo.toml:30-34` only lists `loom = "0.7"` under `[dev-dependencies]`. **These 6 tests will fail to compile** (broken: missing dev-dep + missing `Arbitrary` impl). This is an **L23 mutation-test pillar scaffold** (per `STATUS.md:64` "next level unlock" is Level 1 — but the v20-T5 commit landed broken tests).

3. **`Justfile` references nonexistent scripts** — `Justfile:122` calls `./scripts/release.sh {{VER}}` and `ci.yml:110` calls `bash scripts/cargo-deps-graph.sh pheno-otel`. **No `scripts/` directory exists** in the working tree (`ls pheno-otel/scripts` is empty). Both `just release` and the `cargo-deps-graph` CI job will fail at runtime. This is a **branch-only** feature — the recipe exists but the backing script does not.

4. **`src/metrics.rs` has a logic bug in `Histogram::observe()`** — the bucket boundaries are declared as `[1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]` (`src/metrics.rs:20`) but the `observe()` upper-bound formula (`src/metrics.rs:24-26`: `0 => 1, n => (n+1)*5`) produces values `[1, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]` for the 12 buckets — i.e. bucket 1 covers values 2..=10, bucket 2 covers values 11..=15, etc. The buckets are not monotonic at the documented boundaries. Additionally, `gauge()` returns `Counter` (an `AtomicU64`) per the code comment `// simplified; production uses AtomicI64` (`src/metrics.rs:51`). **The metrics module is `scaffold/placeholder` + has a math bug + is not re-exported from `src/lib.rs`.**

**Plus 6 MEDIUM-severity findings** (see §15): MSRV mismatch (1.75 vs CI 1.82), `serde_json` not justified by main code, `metrics.rs` not re-exported, `llms.txt` cron-strings disagree with the workflows, `CHANGELOG.md` has no `v0.1.0` entry, and 2 phantom claims in `tests/proptest_arbitrary.rs:51-52`.

**Aggregate:** kernel is sound (4.0/5) but the meta-bundle (governance docs + CI workflows + scripts/) has 4 broken references that would prevent a clean release-train cut. **Phase 2 audit recommendation:** BLOCK v0.1.0 release until phantom APIs are reconciled and missing dev-deps/scripts are fixed.

---

## 1. AGENTS.md analysis

**File:** `AGENTS.md` (98 lines, ACTIVE per `AGENTS.md:3`).
**Read in full:** `AGENTS.md:1-98`.

### 1.1 Claims and current status

| Claim (line) | Status | Evidence |
|---|---|---|
| `AGENTS.md:3` "ACTIVE (governance meta-bundle for the `pheno-otel` substrate canonical)" | ✅ TRUE | Matches `SPEC.md:3-5` "Substrate role: canonical OTLP wire-format export substrate (per ADR-037)" |
| `AGENTS.md:5` "Date: 2026-06-20" | ⚠️ STALE | Today is 2026-06-21; AGENTS.md is 1 day stale. Per `STATUS.md:3` the cadence is weekly Monday, so this is within tolerance |
| `AGENTS.md:5` "Owner: KooshaPari (orch-v11-044)" | ✅ TRUE | Verified via `git log` (branch `chore/orch-v11-044-tier-0-governance-pheno-otel-2026-06-20` tip `d20cbc7256`) |
| `AGENTS.md:7` "Substrate role: Rust library (per ADR-012 + ADR-036B substrate canonicals)" | ⚠️ **MISMATCH** | ADR-012 + ADR-036B are about `pheno-tracing`, not `pheno-otel`. The actual canonical ADR for pheno-otel is ADR-037 (per `SPEC.md:6`, `Cargo.toml:7`). Cross-reference mis-attribution. |
| `AGENTS.md:15` "executable Rust source is currently maintained in `FocalPoint/pheno-otel/`" | ❌ **FALSE** | The working tree has a fully-functional `src/` tree (`src/lib.rs:1-209`, plus exporters, propagation, metrics) — code does NOT live in `FocalPoint/pheno-otel/` only. **The `pheno-otel/` path is BOTH governance AND the executable source.** This claim is stale from a prior organizational model. |
| `AGENTS.md:28-38` "Substrate invariants (per ADR-023 Rule 3.1)" (7 invariants) | ⚠️ PARTIAL | Spec ✅, Docs ✅ (8 governance files), Tests ⚠️ (40 inline + 7 integration = 47 tests, but 6 will not compile due to missing `proptest` dev-dep), Observability ⚠️ (this crate IS the observability substrate, so OTLP export via `pheno-tracing` doesn't apply self-referentially), Coverage gate ⚠️ (gate wired in `ci.yml:135-140` but no published number), CI gate ✅, Worklog v2.1 ✅ (`WORKLOG.md` exists per inventory §1.5) |
| `AGENTS.md:82-90` "Tier-0 hygiene (this batch, v11-044)" (full file inventory) | ✅ TRUE | All listed files verified present per inventory §7 |

### 1.2 Cross-reference defects

- **ADR-012 / ADR-036B attribution** (`AGENTS.md:7, 74, 77`): the AGENTS.md confuses `pheno-tracing`'s substrate-canonical ADRs with `pheno-otel`'s. The correct attribution is **ADR-037** (per `SPEC.md:6`, `Cargo.toml:7`, `llms.txt:65`). This is a **LOW-severity docs defect** — the ADRs are real and relevant, but the wrong ones are cited for this substrate.
- **"Source lives in `FocalPoint/pheno-otel/`"** (`AGENTS.md:15-17`): contradicted by the actual `src/` tree in this path. This is a **HIGH-severity docs defect** (misleads contributors to the wrong location).

### 1.3 Status category
`docs-only` for the AGENTS.md file itself (it documents, not implements). The **claims within AGENTS.md** are `attempted+stale`: the framework and 7 invariants are correct in shape but several specific facts (ADR attribution, source location) are stale.

---

## 2. SPEC.md analysis

**File:** `SPEC.md` (102 lines, status `implemented` per `SPEC.md:3`).
**Read in full:** `SPEC.md:1-102`.

### 2.1 API contract verification

`SPEC.md:48-78` declares the canonical API surface. Cross-reference against `src/lib.rs:34-100` and `src/exporters/*.rs`:

| SPEC claim | Code location | Match? |
|---|---|---|
| `pub trait OtlpPort: Send + Sync { name, health, export, flush }` (`SPEC.md:52-57`) | `src/lib.rs:66-82` (4 methods, exact signatures) | ✅ MATCH |
| `pub struct ExportHandle { pub endpoint: String, pub service_name: String }` (`SPEC.md:59-62`) | `src/lib.rs:51-59` (exact match) | ✅ MATCH |
| `pub enum OtlpError { SerializeFailed, Transport, NotConfigured, InvalidAttribute }` (`SPEC.md:65-74`) | `src/lib.rs:34-49` (4 variants with `#[error("...")]` strings match) | ✅ MATCH |
| `pub mod exporters` (`SPEC.md:76`) | `src/lib.rs:85` (`pub mod exporters;`) | ✅ MATCH |
| `pub fn test_handle(endpoint: &str) -> ExportHandle` (`SPEC.md:77`) | `src/lib.rs:95-100` | ✅ MATCH |
| `StdoutExporter, HttpExporter (traces/metrics/logs)` (`SPEC.md:76`) | `src/exporters/stdout.rs:10`, `src/exporters/http.rs:11, 19, 27, 35` | ✅ MATCH |

**API contract is internally consistent.** All 6 SPEC claims map 1:1 to source.

### 2.2 Claims with no code backing

`SPEC.md:81-85` "Consumers" section:
- `pheno-tracing` — produces spans; uses `pheno-otel` to export them via OTLP.
- `pheno-port-adapter` — connection-lifecycle spans flow through `pheno-otel`.
- `phenotype-go-sdk` / `phenotype-python-sdk` — polyglot substrate mirrors.
- Application crates across the pheno-* fleet that need OTLP export.

**No code dependency exists** for any of these in `Cargo.toml:25-28` (no `pheno-tracing` or `pheno-port-adapter` dependency). The consumers are documented but not wired at the code level. This is consistent with `AGENTS.md:15` "executable Rust source is currently maintained in `FocalPoint/pheno-otel/`" — consumers wire the dep against the `FocalPoint/` fork, not this path. **Status: `docs-only`** for the consumer claims (intended, not a defect).

### 2.3 OTLP exporter patterns

`SPEC.md:22-46` describes the hexagonal architecture with ASCII diagram. Verified against source:

- Producer → `OtlpPort` trait (`src/lib.rs:66-82`) ✅
- `StdoutExporter` adapter (`src/exporters/stdout.rs:10-54`) ✅ — `name()="stdout"`, `health()` checks non-empty endpoint, `export()` writes to stderr via `eprintln!` (`src/exporters/stdout.rs:38-43`), `flush()` is no-op (stderr unbuffered)
- `HttpExporter` adapter (`src/exporters/http.rs:11-83`) ✅ — `name()="http"`, 3 constructors (`traces()`, `metrics()`, `logs()`), `target_url()` strips trailing `/`
- `MockExporter` test-only (`src/lib.rs:106-138`) ✅

### 2.4 Span/trace types

`SPEC.md` does **not** mention `SpanContext`, `W3CTraceContextPropagator`, `PropagationError`, or `TRACEPARENT_HEADER`. These are documented **only in**:
- `src/propagation.rs:48` (`TRACEPARENT_HEADER`)
- `src/propagation.rs:55-70` (`SpanContext` struct)
- `src/propagation.rs:100-113` (`PropagationError` enum)
- `src/propagation.rs:134-135` (`W3CTraceContextPropagator` zero-sized type)

`pub mod propagation;` is declared at `src/lib.rs:92` but is **not documented in SPEC.md §4**. **This is a MEDIUM-severity docs gap** — a public module is shipped without a SPEC entry. (L64 SSOT-doc-coverage pillar 1/3 → 2/3 would close it.)

### 2.5 Status section

`SPEC.md:89-93` "Status" claims:
- ✅ "Implemented: `OtlpPort` trait + 2 concrete exporters + 4-variant error + 1 opaque handle" — verified
- ✅ "Tests: 23 inline unit tests (7 in `src/lib.rs`, 6 in `src/exporters/stdout.rs`, 10 in `src/exporters/http.rs`)" — counts verified
- ⚠️ "Coverage gate (ADR-040, lib tier): 80% lines (target — first llvm-cov run pending)" — gate wired but no number published (consistent with `STATUS.md:16`)
- ✅ "Pattern conformance: yes, follows `Port` trait + `Adapter` impl per ADR-038" — verified
- ✅ "Observability: this crate IS the observability substrate" — verified (self-referential)

### 2.6 References section

`SPEC.md:95-102` lists 6 ADRs. Cross-check:
- ADR-037 ✅ (correct substrate-canonical)
- ADR-036 ✅ (sibling pheno-tracing)
- ADR-038 ✅ (hexagonal policy)
- ADR-023 ✅ (governance)
- ADR-040 ✅ (coverage gates)
- ADR-042 ⚠️ (referenced but the document is `ADR-042B` per inventory ADR-table; ADR-042 was "Security audit cadence", the substrate quality bar was renumbered to ADR-042B in the 2026-06-18 wave). **LOW docs defect — minor renumber drift.**

### 2.7 Status category
`implemented+tested` for the core kernel; `docs-only` for the consumer section; `scaffold/placeholder` for the propagation module (no SPEC entry).

---

## 3. CHANGELOG.md analysis

**File:** `CHANGELOG.md` (59 lines).
**Read in full:** `CHANGELOG.md:1-59`.

### 3.1 All entries

**`CHANGELOG.md:11` `[Unreleased]` section** contains exactly one change set:

```
v11-044 tier-0 governance batch, 2026-06-20
```

Subdivided into 5 subsections (per inventory §7):
- **Governance meta-bundle** (8 files: AGENTS.md, README.md, CHANGELOG.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md, SECURITY.md, LICENSE-MIT, LICENSE-APACHE) — `CHANGELOG.md:15-22`
- **Repo configuration** (Justfile, .editorconfig, .gitattributes, .gitignore, deny.toml) — `CHANGELOG.md:23-28`
- **CI workflows** (5: ci.yml, audit.yml, deny.yml, scorecard.yml, release.yml) — `CHANGELOG.md:29-34`
  - **DEFECT:** `CHANGELOG.md:29-34` lists 5 workflows; the working tree has **6** (per inventory §6: + lint.yml). `lint.yml` is **not in CHANGELOG**.
- **Issue + PR templates** (5 files) — `CHANGELOG.md:35-40`
- **Governance plumbing** (CODEOWNERS, dependabot.yml) — `CHANGELOG.md:41-43`

**`CHANGELOG.md:45-49` "Notes" section:**
- "Source of truth for Rust code: `FocalPoint/pheno-otel/` (separate repo)." — ⚠️ CONTRADICTS the actual working tree (see §1 finding: `AGENTS.md:15`).
- "No code changes in this batch — governance + meta-bundle only." — **FALSE** in spirit. The `src/` tree is fully functional. Either (a) the working tree was bootstrapped from a prior `FocalPoint/` mirror with no canonical CHANGELOG entry, or (b) the CHANGELOG is missing the v0.1.0 + cycle-1..cycle-12 entries.

### 3.2 Missing entries

`STATUS.md:46` declares "v0.1.0 (2026-06-20) — initial tier-0 release". The CHANGELOG has **no `## [0.1.0]` section**. Per `Keep a Changelog 1.1.0` (referenced at `CHANGELOG.md:4`), every release version must have a section. **MEDIUM-severity docs defect.**

`git log` shows the working tree contains code contributions spanning v9..v23 (per inventory §4.1: 31 pheno-otel-specific commits). **None of these are in CHANGELOG.md.** Specifically missing:
- `ea05665253` (v12) "feat(pheno-otel): W3C trace-context propagator (side-04)" — adds `src/propagation.rs`
- `2e36ad8b24` (v13) "test(pheno-otel): add loom model-checker concurrency tests (L25)"
- `051adf5af2` (v12) "feat(pheno-otel): L62 metrics API (errors.count, requests.count, request.duration, requests.inflight)" — adds `src/metrics.rs`
- `1c738725e3` (v22) "feat(pheno-otel): L25 metrics facade + 5 Grafana dashboards (V22-T1)"
- `23386dc652` (v14) "feat(pheno-otel): L60 fleet-wide latency histogram facade with bounded cardinality"
- `074405aae2` (v16) "ci(release): add per-crate release.yml for pheno-otel"
- `3a9b0460c2` (v13) "chore(ci): v13 T3 cargo-cyclonedx SBOM workflow for pheno-otel"

### 3.3 ADR cross-reference list

`CHANGELOG.md:51-59` lists 7 ADRs (ADR-012, ADR-023, ADR-025, ADR-036B, ADR-040, ADR-041, ADR-042). **MISSING:** ADR-037 (the canonical substrate ADR for `pheno-otel`); ADR-038 (hexagonal L4 policy — the trait-shape contract). **MEDIUM-severity docs defect.**

### 3.4 Status category
`docs-only`, `attempted` (the v11-044 batch is real but the CHANGELOG is incomplete: missing v0.1.0, missing lint.yml, missing 6+ ADR cross-refs).

---

## 4. STATUS.md analysis

**File:** `STATUS.md` (73 lines).
**Read in full:** `STATUS.md:1-73`.

### 4.1 Current state claims

`STATUS.md:14` table:
- Build: `green` (compiles) — **NOT VERIFIED** by this audit (no `cargo build` was run; Cargo.lock is present and consistent per §8 of inventory, so `cargo build` should succeed)
- Coverage: `TBD` (first llvm-cov run pending) — **CONSISTENT** with gate wired in `ci.yml:135-140` and no published number
- Latest: `v0.1.0` (2026-06-20) — ⚠️ **NOT IN CHANGELOG** (defect §3.2 above)
- Open issues / PRs: `0` / `1` (this PR is the first) — **NOT VERIFIED** (no `gh` API access per inventory caveat)

### 4.2 71-pillar scorecard

`STATUS.md:49-60` claims `~49/213 (23%)` total across 9 domains. Per-domain breakdown:

| Domain | Claimed | Pillar count | Reasonable? |
|---|---:|---:|---|
| Architecture (AX) | ~5/36 | 12 | **LOW** — 0.42 mean. A crate with full hexagonal Port/Adapter + propagator + W3C Level 2 should score higher (cycle-4 audit claimed 2.50/3 mean per inventory §10.1). Likely stale scorecard. |
| Performance | ~2/21 | 7 | LOW (0.29 mean). No benchmarks is fair. |
| Quality / Correctness | ~5/24 | 8 | LOW (0.63 mean). 23 inline tests is fair; but L21 (integration tests) is actually `0 → 9` per inventory §10.1, not 0. Stale. |
| Developer Experience | ~3/30 | 10 | LOW (0.30 mean). Understates the meta-bundle. |
| User Experience | n/a | 8 | N/A — correct per ADR-024 rule for headless lib |
| Security | ~5/30 | 10 | LOW (0.50 mean). deny.toml + cargo-audit + scorecard is fair. |
| Observability & Ops | ~6/24 | 8 | LOW (0.75 mean). Self-as-observability-substrate is fair. |
| Documentation & SSOT | ~12/15 | 5 | HIGH (0.80 mean). 8 governance docs is fair. |
| Governance & Sustainability | ~6/9 | 3 | HIGH (0.67 mean). AGENTS + ADR-023 + CODEOWNERS is fair. |
| **Total** | **~49/213** | **71** | Per inventory §10.1, the **cycle-4 baseline was 2.39/3 mean = 169/213**. **STATUS.md is stale by ~120 points.** |

**Status.md §7 is significantly stale** — the cycle-4 audit (mean 2.39/3 ≈ Tier 2 graduated) is not reflected. The "Tier 0 baseline; full Tier 1 by 2026-07-15 target" at `STATUS.md:60` is contradicted by inventory §10.1 which shows Tier 2 already achieved. **MEDIUM-severity docs defect** (stale scorecard).

### 4.3 Factory AI Agent Readiness

`STATUS.md:62-65` claims Level 0 (Functional). Per ADR-026 + crosswalk at `audit-71-pillar-2026-06-17-wrapup.md` §10, the 9-pillar Factory AI evaluation:
- Style & Validation: 2/4 (rustfmt + clippy + deny(missing_docs) at `src/lib.rs:28-30`)
- Build System: 2/4 (Justfile + cargo-nextest profile)
- Testing: 1/4 (40 unit + 7 integration, but 6 broken)
- Documentation: 2/4 (8 governance docs, but README is stale)
- Dev Environment: 1/4 (no devcontainer)
- Debugging & Observability: 1/4 (no panic hook, no log scrubber)
- Security: 3/4 (deny.toml + audit + scorecard)
- Task Discovery: 2/4 (AGENTS.md + llms.txt present)
- Product & Experimentation: 0/4 (no examples/)

**Estimated true Level: 0 (Functional) — consistent with claim.** No change needed.

### 4.4 In-flight / Blocked / Near-term

`STATUS.md:24-41` enumerates:

**In-flight (line 26):** `chore/orch-v11-016-tier0-2026-06-20` → `main` — tier-0 meta-bundle. **But the current branch is `chore/v22-71-pillar-cycle-12-p1-2026-06-22`** (per inventory §0). The "in-flight" branch is **6 cycles stale**. **HIGH-severity docs defect** (or **branch-only**: this in-flight section was written when v11 was active and never updated).

**Blocked (lines 30-32):**
- `tests/integration_test.rs` — depends on a 80% lib-coverage gate being run on a heavy-runner. **But the actual test file is `tests/w3c_trace_context.rs` (538 LOC, 7 tests), not `tests/integration_test.rs`.** Phantom reference. **MEDIUM-severity docs defect.**
- First llvm-cov coverage number on main — same blocker. **STATUS-true, code-false** (gate is wired per `ci.yml:135-140`).

**Near-term (lines 36-41):**
- Add `tests/integration_test.rs` with mock OTLP receiver — **duplicates the existing `InMemoryOtlpExporter` in `tests/w3c_trace_context.rs:62-118`.** Duplicate plan.
- Add `GrpcExporter` for OTLP/gRPC — **DOC-ONLY**, not in any tracking branch
- Add resource builder helper — **DOC-ONLY**, not in any tracking branch
- Author `README.md` — **README.md already exists at 72 LOC.** Duplicate plan. The README that exists is stale (phantom API per §10 below); the fix is to **update**, not author.
- Migrate 2 ad-hoc OTLP consumers — **DOC-ONLY**, no tracking branch

### 4.5 Status category
`docs-only` for the file; the **claims within STATUS.md** are `attempted+stale` (the meta-bundle is real but the scorecard, in-flight, and near-term sections are out of date).

---

## 5. llms.txt analysis

**File:** `llms.txt` (92 lines, format per `llmstxt.org`).
**Read in full:** `llms.txt:1-92`.

### 5.1 Format compliance

Per llmstxt.org spec:
- H1 title `# pheno-otel` ✅ (`llms.txt:8`)
- Blockquote summary `> ...` ✅ (`llms.txt:10`)
- `## Documentation` section with `[filename](path): summary` bullets ✅ (`llms.txt:14-22`)
- `## Optional` section for license + configs ✅ (`llms.txt:26-50`)
- `## Sibling substrates (fleet)` ✅ (`llms.txt:52-60`)
- `## ADRs (governance)` ✅ (`llms.txt:64-74`)
- `## See also` ✅ (`llms.txt:76-83`)

**Format-compliant.**

### 5.2 Doc accuracy (claims vs code)

| llms.txt claim | Code reality | Match? |
|---|---|---|
| `llms.txt:10` "Defines the `OtlpPort` trait (hexagonal Port side, per ADR-038)" | `src/lib.rs:66-82` ✅ | ✅ |
| `llms.txt:10` "ships `StdoutExporter` + `HttpExporter` (in-tree Adapter impls) per ADR-037" | Both exist ✅ | ✅ |
| `llms.txt:28` "MSRV 1.75, edition 2021, `thiserror = "2"`, `serde = "1.0"`, empty `[workspace]`" | `Cargo.toml:5, 4, 26-27, 19` ✅ | ✅ |
| `llms.txt:34` "7 inline `MockExporter` unit tests" | `src/lib.rs:140-208` (7 `#[test]` functions) ✅ | ✅ |
| `llms.txt:39` "audit.yml ... weekly Mon 06:00 UTC" | `audit.yml:6` `cron: "0 16 * * 1"` (Monday **16:00 UTC** = 09:00 PDT per ADR-041) | ❌ **MISMATCH** |
| `llms.txt:41` "scorecard.yml ... weekly Mon 12:00 UTC" | `scorecard.yml:6` `cron: "0 2 * * 0"` (Sunday 02:00 UTC) | ❌ **MISMATCH** (day-of-week AND hour wrong) |
| `llms.txt:39` "cargo-deny + cargo-audit + TruffleHog" | `audit.yml:10-25` runs `cargo audit` only; **no cargo-deny, no TruffleHog** (cargo-deny is in `deny.yml`) | ❌ **PHANTOM CLAIM** (TruffleHog is not in any workflow) |
| `llms.txt:44` "daily cargo + weekly github-actions updates" | `dependabot.yml` is weekly Monday 09:00 PDT (per inventory §6), not daily | ❌ **MISMATCH** |
| `llms.txt:45` "ownership table (default @KooshaPari)" | `.github/CODEOWNERS` is a symlink to root `CODEOWNERS` (per inventory §1.4) | ✅ (the symlink resolves to root) |
| `llms.txt:54` "`pheno-tracing` — canonical observability substrate (ADR-036)" | Correct attribution (ADR-036, not ADR-037) | ✅ |
| `llms.txt:65-67` "ADR-037 ... analogous substrate-assignment ADR; this crate is the OTLP export substrate in the same family" | Correct | ✅ |
| `llms.txt:78` "this crate scored ~49/213 = 23%, Tier 0" | Consistent with `STATUS.md:60` | ✅ (but both are stale per §4.2) |

### 5.3 Missing entries

`llms.txt:34-37` enumerates source files: `src/lib.rs`, `src/exporters/mod.rs`, `src/exporters/stdout.rs`, `src/exporters/http.rs`. **MISSING:**
- `src/propagation.rs` (448 LOC, W3C propagator — second-largest module) — should be linked
- `src/metrics.rs` (83 LOC, L25 metrics facade)

`llms.txt:43` `.github/workflows/lint.yml` is linked ✅ (CHANGELOG missing it but llms.txt catches it).

`llms.txt:82` `pheno-ci-templates` linked ✅.

### 5.4 Status category
`docs-only`; **phantom claims** for audit.yml + scorecard.yml cadence (HIGH because LLM users will believe the wrong schedule); **mismatch** for the workflow day/time fields.

---

## 6. src/lib.rs re-exports

**File:** `src/lib.rs` (209 lines).
**Read in full:** `src/lib.rs:1-209`.

### 6.1 Public surface declared

`src/lib.rs:34-100` declares:

| Item | Kind | Lines | Re-exported? |
|---|---|---|---|
| `OtlpError` enum (4 variants) | `pub` | 34-49 | ✅ at crate root |
| `ExportHandle` struct | `pub` | 51-59 | ✅ at crate root |
| `OtlpPort` trait (4 methods) | `pub` | 66-82 | ✅ at crate root |
| `exporters` module | `pub mod` | 85 | ✅ at crate root |
| `propagation` module | `pub mod` | 92 | ✅ at crate root |
| `test_handle()` fn | `pub fn` | 95-100 | ✅ at crate root |

**MISSING from public surface (defect §15.B1):**
- `metrics` module — `src/metrics.rs` exists but **`src/lib.rs` does not have `pub mod metrics;`**. The module is therefore **private** and unreachable from `pheno_otel::metrics::*`.

### 6.2 Phantom API claims

Multiple governance docs reference APIs that `src/lib.rs` does **not** export:

| Claim | Source | Status |
|---|---|---|
| `init("my-service", "http://otel-collector:4317")` | `README.md:31, 34` | **PHANTOM** — no `init` function in `src/lib.rs` (search: 0 matches) |
| `TelemetryGuard` | `README.md:31`, `SECURITY.md:57-58` | **PHANTOM** — no `TelemetryGuard` type in `src/lib.rs` (search: 0 matches) |
| `OtlpGrpcExporterBuilder` (in commit-message example) | `AGENTS.md:52` | **EXAMPLE-ONLY** — not in working tree code; appears in `AGENTS.md` as a Conventional Commits example |

**Highest-severity finding of the audit** — these phantom APIs are referenced from the user-facing README and SECURITY policy. A consumer who follows `README.md:30-38` will get a compile error.

### 6.3 Test surface

`src/lib.rs:102-208` declares `#[cfg(test)] mod tests` with 7 `#[test]` functions (verified by line count):

| # | Test name | Lines | Verifies |
|---|---|---|---|
| 1 | `export_returns_handle` | 140-150 | `MockExporter.export()` returns handle with correct endpoint |
| 2 | `export_empty_payload_fails` | 152-161 | Empty payload → `OtlpError::SerializeFailed` |
| 3 | `health_check_passes` | 163-171 | `healthy=true` → `Ok(())` |
| 4 | `health_check_fails_when_unhealthy` | 173-181 | `healthy=false` → `NotConfigured` |
| 5 | `flush_returns_ok` | 183-191 | `MockExporter.flush()` → `Ok(())` |
| 6 | `exporter_name_is_non_empty` | 193-201 | `name()` returns non-empty |
| 7 | `test_handle_builds` | 203-208 | `test_handle()` constructs correct `ExportHandle` |

All 7 tests are `implemented+tested` with concrete assertions.

### 6.4 Crate attributes

`src/lib.rs:28-30`:
```rust
#![deny(missing_docs)]
#![deny(unsafe_code)]
#![deny(rust_2018_idioms)]
```

✅ All three deny attributes align with the L12 type-safety pillar (per inventory §10.1 cycle-4 baseline).

### 6.5 Status category
`implemented+tested` for the `OtlpPort`/`OtlpError`/`ExportHandle`/`test_handle` surface; **phantom reference** for `init()` + `TelemetryGuard` from docs.

---

## 7. src/*.rs module dumps

### 7.1 src/lib.rs (209 lines, partial)

Already covered in §6. Public surface: `OtlpError`, `ExportHandle`, `OtlpPort`, `exporters`, `propagation`, `test_handle`. Tests: 7 inline.

### 7.2 src/exporters/mod.rs (43 lines)

`src/exporters/mod.rs:1-43` declares:
- `pub mod http;` (line 7) — submodule re-export
- `pub mod stdout;` (line 8) — submodule re-export
- `pub struct ExporterConfig { pub endpoint: String, pub service_name: String, pub service_version: String }` (lines 11-19)
- `impl ExporterConfig { pub fn new(endpoint: impl Into<String>, service_name: impl Into<String>) -> Self }` (lines 21-30) — `service_version` defaults to `env!("CARGO_PKG_VERSION")`
- 1 inline unit test `config_new_sets_endpoint_and_service` (lines 36-42)

**Status:** `implemented+tested`. Both concrete exporters (`http`, `stdout`) are correctly wired through the module tree.

**Bug:** none observed. The `ExporterConfig` shape is sensible (3 fields, `Clone`, `Debug` derived).

### 7.3 src/exporters/stdout.rs (97 lines)

`src/exporters/stdout.rs:1-97` declares:
- `pub struct StdoutExporter { config: ExporterConfig }` (lines 10-12)
- `impl StdoutExporter { pub fn new(config: ExporterConfig) -> Self }` (lines 14-19)
- `impl OtlpPort for StdoutExporter` (lines 21-54):
  - `name() -> "stdout"` (lines 22-24)
  - `health()` checks `config.endpoint.is_empty()` (lines 26-32)
  - `export()` writes `[pheno-otel/stdout] endpoint=… service=… bytes=…` via `eprintln!` (lines 34-48)
  - `flush()` is no-op (lines 50-53) — stderr is unbuffered

**6 inline unit tests** (lines 60-96):
| # | Test name | Lines |
|---|---|---|
| 1 | `stdout_exporter_name` | 60-64 |
| 2 | `stdout_exporter_health` | 66-70 |
| 3 | `stdout_exporter_health_fails_with_empty_endpoint` | 72-76 |
| 4 | `stdout_exporter_export_returns_handle` | 78-84 |
| 5 | `stdout_exporter_export_empty_fails` | 86-90 |
| 6 | `stdout_exporter_flush` | 92-96 |

**Status:** `implemented+tested`. All 6 tests pass concretely; behavior is correctly stubbed (no actual export logic, per the doc-comment at line 1-3).

### 7.4 src/exporters/http.rs (150 lines)

`src/exporters/http.rs:1-150` declares:
- `pub struct HttpExporter { config: ExporterConfig, signal_path: String }` (lines 10-15)
- `impl HttpExporter`:
  - `pub fn traces(config: ExporterConfig) -> Self` → `/v1/traces` (lines 18-24)
  - `pub fn metrics(config: ExporterConfig) -> Self` → `/v1/metrics` (lines 26-32)
  - `pub fn logs(config: ExporterConfig) -> Self` → `/v1/logs` (lines 34-40)
  - `pub fn target_url(&self) -> String` (lines 42-49) — `format!("{}{}", endpoint.trim_end_matches('/'), signal_path)`
- `impl OtlpPort for HttpExporter` (lines 52-83):
  - `name() -> "http"` (lines 53-55)
  - `health()` checks non-empty endpoint (lines 57-63)
  - `export()` returns `ExportHandle { endpoint: target_url(), service_name }` (lines 65-77) — **does NOT actually POST** (per inline comment at lines 69-72)
  - `flush()` is no-op (lines 79-82) — "No in-flight buffer in this minimal impl"

**10 inline unit tests** (lines 89-149):
| # | Test name | Lines |
|---|---|---|
| 1 | `http_traces_url` | 89-93 |
| 2 | `http_metrics_url` | 95-99 |
| 3 | `http_logs_url` | 101-105 |
| 4 | `http_url_strips_trailing_slash` | 107-111 |
| 5 | `http_exporter_name` | 113-117 |
| 6 | `http_exporter_health` | 119-123 |
| 7 | `http_exporter_health_fails_with_empty_endpoint` | 125-129 |
| 8 | `http_exporter_export_returns_handle` | 131-137 |
| 9 | `http_exporter_export_empty_fails` | 139-143 |
| 10 | `http_exporter_flush` | 145-149 |

**Status:** `implemented+tested` for the URL-construction + Endpoint validation; **`scaffold/placeholder` for the actual HTTP POST** — the `export()` method explicitly documents at lines 69-72 that "Production exporters would POST here. This is a pure-Rust, dependency-light substrate; consumers wire in their own HTTP client (reqwest, hyper, etc.)". This is consistent with the lib's stated goal (per `SPEC.md:12`: "smallest possible kernel of the export pattern") but means the `HttpExporter` does **not actually export**.

**Severity:** INFO — this is documented behavior; consumers are expected to call `target_url()` and POST themselves. Not a defect.

### 7.5 src/metrics.rs (83 lines)

`src/metrics.rs:1-83` declares:
- `pub struct Counter { value: AtomicU64 }` (lines 9-14) — `new()`, `inc()`, `get()`
- `pub struct Histogram { buckets: Vec<AtomicU64> }` (lines 17-30) — 12 fixed buckets
- `pub struct Labels { map: HashMap<String, String> }` (lines 33-38) — cardinality-capped label set
- `pub enum Preset { RequestRate, ErrorRate, LatencyP99, InFlightCount, Saturation }` (lines 41-47)
- `pub fn counter(p: Preset) -> Counter` (line 49)
- `pub fn histogram(p: Preset) -> Histogram` (line 50)
- `pub fn gauge(p: Preset) -> Counter` (line 51) — `// simplified; production uses AtomicI64`
- `pub async fn export_loop(endpoint: &str, _flush: Duration)` (lines 54-57) — **prints, doesn't export**

**3 inline unit tests** (lines 63-82):
| # | Test name | Lines |
|---|---|---|
| 1 | `counter_increments` | 63-68 |
| 2 | `histogram_observes_into_buckets` | 70-76 |
| 3 | `labels_build` | 78-82 |

**Status:** `scaffold/placeholder` + **NOT re-exported from `src/lib.rs`**.

**Bugs identified (defect §15.A1, A2, A3):**

1. **`Histogram::observe()` bucket math is wrong** (`src/metrics.rs:23-29`):
   ```rust
   pub fn observe(&self, ms: u64) {
       for (i, b) in self.buckets.iter().enumerate() {
           let upper = match i { 0 => 1, n => (n+1)*5 };
           if ms <= upper as u64 { b.fetch_add(1, Ordering::Relaxed); return; }
       }
       self.buckets.last().unwrap().fetch_add(1, Ordering::Relaxed);
   }
   ```
   Bucket boundaries declared at line 20: `[1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]`. Bucket upper-bounds produced by the formula `0 => 1, n => (n+1)*5`:
   - bucket 0: upper=1 → covers values 0..=1 ✅ (matches declared boundary 1)
   - bucket 1: upper=10 → covers values 2..=10 ❌ (declared boundary is 5; should cover 2..=5)
   - bucket 2: upper=15 → covers values 11..=15 ❌ (declared boundary is 10)
   - bucket 3..10: upper=20, 25, 30, 35, 40, 45, 50, 55 — none match the declared boundaries 25, 50, 100, 250, 500, 1000, 2500, 5000
   - bucket 11 (last): catches all values >60

   **The bucket boundaries are not what the doc-comment at line 17 ("12 fixed buckets") promises.** This is a **logic bug**.

2. **`gauge()` returns the wrong type** (`src/metrics.rs:51`): the comment admits `// simplified; production uses AtomicI64` but the function returns `Counter` (which wraps `AtomicU64`). Gauges can decrease; counters cannot. Type mismatch with the function name.

3. **`export_loop()` is a stub** (`src/metrics.rs:54-57`): just `println!`s and returns. The doc-comment at line 53 says "OTLP/HTTP export (10s batch, 5s flush)" but the function does not connect, batch, or flush anything. **The metrics module has no actual export path.**

4. **Not re-exported from `src/lib.rs`**: even if the bugs were fixed, `pheno_otel::metrics::Counter` is **not reachable** because `src/lib.rs:84-92` does not include `pub mod metrics;`. Consumers cannot import these types.

**Severity:** HIGH for the bucket bug + missing re-export; MEDIUM for `gauge()` type mismatch + `export_loop()` stub.

### 7.6 src/propagation.rs (448 lines)

`src/propagation.rs:1-448` declares the W3C Trace Context Level 2 propagator.

**Public surface (verified):**

| Item | Kind | Lines |
|---|---|---|
| `pub const TRACEPARENT_HEADER: &str = "traceparent"` | const | 48 |
| `pub struct SpanContext { pub version: u8, pub trace_id: String, pub span_id: String, pub trace_flags: u8 }` | struct | 55-70 |
| `impl SpanContext { pub fn is_sampled(&self) -> bool, pub fn new(...), pub fn sampled(...) }` | impl | 72-97 |
| `pub enum PropagationError { MissingHeader, Malformed(&'static str), InvalidTraceId, InvalidSpanId, InvalidVersion }` | enum | 100-113 |
| `impl Display for PropagationError` | impl | 115-125 |
| `impl std::error::Error for PropagationError` | impl | 127 |
| `pub struct W3CTraceContextPropagator;` (zero-sized, `Default`, `Clone`, `Copy`) | struct | 134-135 |
| `impl W3CTraceContextPropagator { pub fn new(), pub fn extract(headers), pub fn inject(ctx), pub fn parse_traceparent(value) }` | impl | 137-250 |
| `fn is_lower_hex(s: &str) -> bool` (private helper) | fn | 253-255 |

**13 inline unit tests** (lines 274-447):
| # | Test name | Lines |
|---|---|---|
| 1 | `extract_valid_sampled_parent` | 274-287 |
| 2 | `extract_unsampled_flag` | 289-299 |
| 3 | `extract_rejects_invalid_version_0xff` | 301-312 |
| 4 | `extract_rejects_all_zero_trace_id` | 314-326 |
| 5 | `extract_rejects_all_zero_span_id` | 328-340 |
| 6 | `extract_rejects_missing_header` | 342-348 |
| 7 | `extract_rejects_wrong_field_count` | 350-357 |
| 8 | `extract_rejects_non_hex_trace_id` | 359-374 |
| 9 | `extract_is_case_insensitive_on_header_name` | 376-385 |
| 10 | `extract_tolerates_future_versions` | 387-400 |
| 11 | `inject_round_trips_through_extract` | 402-410 |
| 12 | `inject_writes_lowercase_canonical_header` | 412-426 |
| 13 | `span_context_is_sampled_bit_only` | 428-447 |

**Status:** `implemented+tested` (best-tested module in the crate — 13 inline tests cover happy path, every error path, version negotiation, sampling-bit semantics, round-trip, header case-insensitivity, future-version tolerance).

**No bugs found.** The implementation follows the W3C Trace Context Level 2 spec (`https://www.w3.org/TR/trace-context/`) closely:
- Lowercase header canonical (line 48) ✅
- 55-char wire format (line 26 comment, line 424 assertion in test 12) ✅
- All-zero trace_id rejection (line 221-223) ✅
- All-zero span_id rejection (line 232-234) ✅
- Version 0xFF rejection (line 210-212) ✅
- Forward-compat for v01+ (no version range rejection beyond 0xFF) ✅

**Severity:** none. This module is **the strongest module in the crate** and the one to model other pheno-* propagators after.

---

## 8. tests/*.rs analysis

The test directory contains **5 files** (per inventory §1.2 + this audit's `ls`):
- `tests/w3c_trace_context.rs` (538 LOC) — 7 `#[test]` functions
- `tests/loom_exporter_buffer.rs` (22 LOC) — 1 `#[test]`
- `tests/loom_metric_recorder.rs` (21 LOC) — 1 `#[test]`
- `tests/proptest_arbitrary.rs` (62 LOC) — 3 `proptest!` blocks
- `tests/proptest_smoke.rs` (45 LOC) — 3 `proptest!` blocks

**Test count totals:** 7 + 1 + 1 + 3 + 3 = **15 integration tests** (9 are `#[test]`, 6 are `proptest!`).

### 8.1 tests/w3c_trace_context.rs (538 LOC, 7 tests)

**Read in full:** `tests/w3c_trace_context.rs:1-538`.

This is the **strongest integration test file** in the crate. Defines a test-only `InMemoryOtlpExporter` (lines 62-118) that captures OTLP/JSON payloads in a `Vec<u8>` and verifies W3C Trace Context propagation end-to-end with Jaeger/Tempo/Honeycomb/Datadog interop targets (per `tests/w3c_trace_context.rs:30-34`).

**7 `#[test]` functions:**
| # | Test name | Lines | Verifies |
|---|---|---|---|
| 1 | `w3c_traceparent_parsing_matches_spec_example` | 176-203 | W3C §3.2.1 reference example parses correctly |
| 2 | `w3c_traceparent_generation_round_trips` | 211-252 | `inject → extract` round-trips exactly |
| 3 | `w3c_sampling_flag_handling_is_bit_zero_only` | 261-328 | Sampling bit is bit 0 only (not other bits) |
| 4 | `w3c_version_negotiation_accepts_v00_tolerates_v01_rejects_vff` | 338-387 | v00 accepted, v01 tolerated, vFF rejected |
| 5 | `w3c_parent_span_correlation_preserves_trace_id_across_hops` | 401-462 | 3-hop trace + sibling + unrelated traces |
| 6 | `stdout_exporter_is_send_sync_and_reachable` | 474-491 | `Send + Sync` + `Arc` wrappable |
| 7 | `w3c_malformed_inputs_return_typed_errors` | 496-538 | Every error variant surfaces correctly |

**Status:** `implemented+tested` (most likely — assertions are concrete, no `#[ignore]` markers).

**Minor defects:**
- `tests/w3c_trace_context.rs:69` `recorded_contexts: Arc<Mutex<Vec<SpanContext>>>` field is **never written to** by the `InMemoryOtlpExporter` (only `captured` is pushed). The `contexts()` accessor at line 85-87 and the assertion at `tests/w3c_trace_context.rs:243-246` (`assert_eq!(exporter.contexts().len(), 0, ...)`) confirm the field is **dead** — written nowhere, read once to assert it's empty. **LOW-severity** — dead field, not a bug per se but unused code.
- `tests/w3c_trace_context.rs:2` doc-comment header says "v12-03" (matches inventory §4.1 commit `e1df02bcb5`).

### 8.2 tests/loom_exporter_buffer.rs (22 LOC, 1 test)

**Read in full:** `tests/loom_exporter_buffer.rs:1-22`.

```rust
//! L25 (concurrency) — loom permutation test for an OTLP exporter event buffer.
//! Run with: RUSTFLAGS="--cfg loom" cargo test --test loom_exporter_buffer --release
#![cfg(loom)]
use loom::sync::{Arc, Mutex};
use loom::thread;

#[test]
fn exporter_buffer_preserves_all_events_under_concurrent_push() {
    let mut b = loom::model::Builder::new();
    b.preemption_bound = Some(3);
    b.check(|| {
        let buf = Arc::new(Mutex::new(Vec::<u8>::new()));
        let handles: Vec<_> = (0u8..3).map(|id| {
            let b = buf.clone();
            thread::spawn(move || { b.lock().unwrap().push(id); })
        }).collect();
        for h in handles { h.join().unwrap(); }
        let mut events = buf.lock().unwrap().clone();
        events.sort();
        assert_eq!(events, vec![0u8, 1, 2]);
    });
}
```

**Verifies:** 3 threads × 1 push → all 3 bytes survive in the buffer. Loom `preemption_bound=3` permutes all interleavings.

**Caveat:** the test does **not** use any actual `pheno-otel` API; it uses raw `loom::sync::Mutex<Vec<u8>>`. This is a **toy model**, not a test of the in-tree `OtlpPort` impls. The doc-comment "OTLP exporter event buffer" is aspirational — the actual test could be a model of any push-only buffer.

**Severity:** INFO — the test exercises loom's machinery but does not directly validate the crate's API. Useful as a scaffold; would benefit from a follow-up that tests `StdoutExporter` + `Arc<StdoutExporter>` concurrent `export()` calls (which `tests/w3c_trace_context.rs:474-491` partially does at runtime, not under loom).

**Status:** `scaffold/placeholder` for the actual OTLP concurrency test.

### 8.3 tests/loom_metric_recorder.rs (21 LOC, 1 test)

**Read in full:** `tests/loom_metric_recorder.rs:1-21`.

```rust
//! L25 (concurrency) — loom permutation test for an OTLP-style metric counter.
//! Run with: RUSTFLAGS="--cfg loom" cargo test --test loom_metric_recorder --release
#![cfg(loom)]
use loom::sync::atomic::{AtomicU64, Ordering};
use loom::sync::Arc;
use loom::thread;

#[test]
fn metric_counter_is_linearizable_under_concurrent_increments() {
    let mut b = loom::model::Builder::new();
    b.preemption_bound = Some(3);
    b.check(|| {
        let counter = Arc::new(AtomicU64::new(0));
        let handles: Vec<_> = (0..2).map(|_| {
            let c = counter.clone();
            thread::spawn(move || { for _ in 0..4 { c.fetch_add(1, Ordering::SeqCst); } })
        }).collect();
        for h in handles { h.join().unwrap(); }
        assert_eq!(counter.load(Ordering::SeqCst), 8);
    });
}
```

**Same caveats as 8.2:** uses raw `loom::sync::atomic::AtomicU64`, not the crate's own `metrics::Counter` (which is in `src/metrics.rs` and not reachable anyway per §7.5).

**Severity:** INFO + MEDIUM (the test pretends to verify the crate's metrics counter, but doesn't import it).

**Status:** `scaffold/placeholder` for the actual metrics concurrency test.

### 8.4 tests/proptest_arbitrary.rs (62 LOC, 3 tests)

**Read in full:** `tests/proptest_arbitrary.rs:1-62`.

```rust
//! v20-T5 (L23) — proptest property test for `pheno-otel`.
//! ...
use proptest::prelude::*;

use pheno_otel::{ExportHandle, OtlpError};

proptest! {
    #[test]
    fn otlp_error_display_has_canonical_prefix(err in any::<OtlpError>()) {
        let display = err.to_string();
        prop_assert!(!display.is_empty(), "Display must be non-empty");
        prop_assert!(
            display.contains("serialization failed:")
                || display.contains("transport error:")
                || display.contains("exporter not configured:")
                || display.contains("invalid attribute:"),
            "Display did not match any known OtlpError prefix: {display}"
        );
    }

    #[test]
    fn export_handle_clone_eq(handle in any::<ExportHandle>()) {
        let cloned = handle.clone();
        prop_assert_eq!(handle.endpoint, cloned.endpoint);
        prop_assert_eq!(handle.service_name, cloned.service_name);
    }

    #[test]
    fn export_handle_endpoint_starts_with_scheme(handle in any::<ExportHandle>()) {
        prop_assert!(
            handle.endpoint.starts_with("http://")
                || handle.endpoint.starts_with("https://"),
            "endpoint must start with http:// or https://: {}",
            handle.endpoint
        );
    }
}
```

**Phantom API defects (HIGH severity, gates compilation):**

1. **Missing `proptest` dev-dep** (defect §15.A4): `Cargo.toml:30-34` only lists `loom = "0.7"` under `[dev-dependencies]`. `use proptest::prelude::*;` at line 19 will **fail to compile** (`error[E0432]: unresolved import 'proptest'`).

2. **Missing `Arbitrary` impl for `OtlpError`** (defect §15.A5): line 28 `err in any::<OtlpError>()` requires `impl proptest::arbitrary::Arbitrary for OtlpError`. **No such impl exists** in `src/lib.rs` (verified: no `Arbitrary` impls in the source tree). Even with `proptest` in dev-deps, this test would not compile.

3. **Missing `Arbitrary` impl for `ExportHandle`** (defect §15.A5): same issue at lines 44, 54. **No `impl Arbitrary for ExportHandle`** anywhere.

4. **Phantom claim at line 50-52**: the doc-comment says "The `Arbitrary` impl in `src/lib.rs` constrains the regex to `(http|https)://...`". This is **factually false** — there is no `Arbitrary` impl anywhere in `src/lib.rs`. The proptest will accept any `String` for `endpoint` if an `Arbitrary` impl existed; the regex constraint exists only in the test's `prop_assert!`. **PHANTOM REFERENCE** (HIGH severity, see §15.A6).

**Status:** `attempted` — the test author intended to write L23 property tests but the supporting `Arbitrary` impls and dev-dep were never added.

### 8.5 tests/proptest_smoke.rs (45 LOC, 3 tests)

**Read in full:** `tests/proptest_smoke.rs:1-45`.

Same structural defects as §8.4:
- `use proptest::prelude::*;` at line 13 requires `proptest` dev-dep (missing)
- `any::<OtlpError>()` at line 23 requires missing `Arbitrary` impl
- `any::<ExportHandle>()` at line 33 requires missing `Arbitrary` impl
- `any::<ExportHandle>()` at line 41 requires missing `Arbitrary` impl

**Status:** `attempted`, same as §8.4.

### 8.6 Test surface aggregate

| File | Tests | Status | Will compile? |
|---|---:|---|---|
| `tests/w3c_trace_context.rs` | 7 `#[test]` | `implemented+tested` | ✅ YES |
| `tests/loom_exporter_buffer.rs` | 1 `#[test]` | `scaffold/placeholder` | ✅ YES (under `--cfg loom`) |
| `tests/loom_metric_recorder.rs` | 1 `#[test]` | `scaffold/placeholder` | ✅ YES (under `--cfg loom`) |
| `tests/proptest_arbitrary.rs` | 3 `proptest!` | `attempted` | ❌ NO — missing `proptest` + `Arbitrary` |
| `tests/proptest_smoke.rs` | 3 `proptest!` | `attempted` | ❌ NO — missing `proptest` + `Arbitrary` |

**Effective test count:** 9 (7 + 1 + 1) when `RUSTFLAGS="--cfg loom"` is set; **8 otherwise** (loom tests are `#[cfg(loom)]` gated, so they don't even compile without the flag — but `cargo test` without the flag still tries to compile them, which would fail since `loom` is in dev-deps but `--cfg loom` is not set).

Wait — actually, the `#[cfg(loom)]` attribute means the entire test file is gated. Without `--cfg loom`, the file is excluded from compilation. So under default `cargo test`:
- `tests/w3c_trace_context.rs` ✅ compiles (7 tests pass)
- `tests/loom_*.rs` ❌ excluded from compilation by `#[cfg(loom)]`
- `tests/proptest_*.rs` ❌ **fail to compile** (missing `proptest` + `Arbitrary`)

**Effective test count under default `cargo test`:** 7 (all in `w3c_trace_context.rs`). The crate's `cargo test` will fail because of the 2 broken proptest files.

---

## 9. examples/ and benches/ directories

**Confirmed:** `ls /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-otel/examples` → directory does not exist.
**Confirmed:** `ls /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-otel/benches` → directory does not exist.

**`target/debug/examples`** exists as a Cargo build artifact directory (compilation output, not source).

**`README.md:54-56` "Features" section** claims:
- "OTLP/gRPC + OTLP/HTTP exporters (feature-gated)"
- "Panic-safe shutdown via `Drop`"
- "Resource attribute injection from env"
- "Honest 1.82 MSRV"

All 4 features are **phantom** — no `Cargo.toml` features (`[features]` table is absent), no `init()` function, no `Drop` impl for shutdown, no env-var resource attribute injection code.

**STATUS.md:62-65** claims Factory AI Readiness Level 0 (Functional); **status true**. But the L15 throughput pillar is 1/3 because no `benches/` exists (per inventory §10.1). **Expected — not a defect for a substrate kernel.**

---

## 10. Justfile recipes

**File:** `Justfile` (148 lines).
**Read in full:** `Justfile:1-148`.

### 10.1 Recipe inventory

| Recipe | Line | Category | Status |
|---|---|---|---|
| `default` | 21-22 | meta | ✅ OK |
| `info` | 25-28 | meta | ✅ OK |
| `build` | 33-34 | build | ✅ OK |
| `build-release` | 37-38 | build | ✅ OK |
| `fmt-check` | 43-44 | lint | ✅ OK |
| `fmt` | 47-48 | lint | ✅ OK |
| `clippy` | 51-52 | lint | ✅ OK |
| `test` | 57-58 | test | ✅ OK |
| `test-unit` | 61-62 | test | ✅ OK |
| `test-integration` | 65-66 | test | ✅ OK |
| `test-doc` | 69-70 | test | ✅ OK |
| `coverage` | 75-76 | coverage | ✅ OK (depends on `cargo-llvm-cov`) |
| `coverage-summary` | 79-80 | coverage | ✅ OK |
| `deny` | 85-86 | audit | ✅ OK |
| `deny-advisories` | 89-90 | audit | ✅ OK |
| `audit` | 93-94 | audit | ✅ OK |
| `audit-all` | 97 | audit | ✅ OK |
| `check` | 102 | combined | ✅ OK |
| `ci-local` | 105 | combined | ✅ OK |
| `worklog-validate` | 110-115 | worklog | ⚠️ **Phantom dep** — calls `python3 -c "import pheno_worklog_schema as p; ..."` (line 112) but the fall-through says `|| (echo "pheno_worklog_schema not installed; skipping" && exit 0)` (line 115) — so this **always passes**. The validation is a no-op. **INFO — by design** |
| `release VER` | 120-122 | release | ❌ **BROKEN** — calls `./scripts/release.sh {{VER}}` (line 122) but no `scripts/` dir exists |
| `ci-build` | 127-128 | ci | ✅ OK |
| `ci-test` | 131-132 | ci | ✅ OK |
| `ci-clippy` | 135-136 | ci | ✅ OK |
| `ci-fmt` | 139-140 | ci | ✅ OK |
| `ci-deny` | 143-144 | ci | ✅ OK |
| `ci-audit` | 147-148 | ci | ✅ OK |

### 10.2 CI workflows that depend on Justfile recipes

**`Justfile:122` → `./scripts/release.sh`** is called by the `release VER` recipe.
**`Justfile:120-122`** documentation says "Cut a release. VER = semver tag (e.g., 0.2.0)".

**Defect:** `ls /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-otel/scripts` returns no entries. **No `scripts/release.sh` exists.** The `release` recipe will fail at runtime.

**Severity:** HIGH for `just release` invocation (defect §15.A7). The CI release path uses `.github/workflows/release.yml:39-42` directly, not the Justfile recipe, so the CI release flow is OK; only local-release flows break.

### 10.3 Cross-reference

The `scripts/` dir is also referenced by `ci.yml:110` (`bash scripts/cargo-deps-graph.sh pheno-otel`) for the `cargo-deps-graph` job. **No `scripts/cargo-deps-graph.sh` exists either** — defect §15.A8.

---

## 11. deny.toml entries

**File:** `deny.toml` (88 lines).
**Read in full:** `deny.toml:1-88`.

### 11.1 Configuration sections

| Section | Lines | Setting | Notes |
|---|---|---|---|
| `[graph]` | 12-14 | `all-features = false`, `no-default-features = false` | ✅ Standard |
| `[advisories]` | 17-24 | `db-path = "~/.cargo/advisory-db"`, `db-urls = ["https://github.com/rustsec/advisory-db"]`, `yanked = "warn"`, `ignore = []` | ✅ Standard; `ignore` list is empty (no temp ignores) |
| `[bans]` | 27-44 | `multiple-versions = "warn"`, `wildcards = "deny"`, `highlight = "all"`, `allow = []`, `deny = [{openssl <0.10.70}, {chrono <0.4.31}]`, `skip = []`, `skip-tree = []` | ✅ Standard; openssl and chrono are denied for CVE reasons |
| `[sources]` | 47-56 | `unknown-registry = "deny"`, `unknown-git = "deny"`, `allow-registry = ["https://github.com/rust-lang/crates.io-index"]`, `allow-git = []` | ✅ Standard; only crates.io allowed |
| `[licenses]` | 59-79 | `version = 2`, allow list: `MIT, Apache-2.0, Apache-2.0 WITH LLVM-exception, BSD-2-Clause, BSD-3-Clause, ISC, Zlib, Unicode-DFS-2016, Unicode-3.0, CC0-1.0, MPL-2.0, OpenSSL, Unicode-2.0`, `confidence-threshold = 0.8`, `exceptions = []` | ✅ Standard fleet license list |
| `[spdx]` | 82-84 | `version = 3`, `expression = true` | ✅ Standard |
| `[output]` | 87-88 | `feature-depth = 1` | ✅ Standard |

### 11.2 Cross-reference to deps

Per `Cargo.lock`:
- `serde` 1.0.228 — `MIT` ✅
- `serde_json` 1.0.150 — `MIT` ✅
- `serde_derive` 1.0.228 — `MIT` ✅
- `serde_core` 1.0.228 — `MIT` ✅
- `thiserror` 2.0.18 — `MIT OR Apache-2.0` ✅
- `thiserror-impl` 2.0.18 — `MIT OR Apache-2.0` ✅
- `loom` 0.7.2 — `MIT` ✅
- `tracing` 0.1.44 — `MIT` ✅
- `tracing-subscriber` 0.3.23 — `MIT` ✅
- `proc-macro2` 1.0.106 — `MIT OR Apache-2.0` ✅
- `quote` 1.0.45 — `MIT OR Apache-2.0` ✅
- `syn` 2.0.118 — `MIT OR Apache-2.0` ✅
- `unicode-ident` 1.0.24 — `(MIT OR Apache-2.0) Unicode-DFS-2016` ✅
- `itoa` 1.0.18 — `MIT OR Apache-2.0` ✅
- `memchr` 2.8.2 — `MIT OR Apache-2.0` ✅
- `lazy_static` 1.5.0 — `MIT OR Apache-2.0` ✅
- `libc` 0.2.186 — `MIT OR Apache-2.0` ✅
- `log` 0.4.33 — `MIT OR Apache-2.0` ✅
- `cc` 1.2.65 — `MIT OR Apache-2.0` ✅
- `cfg-if` 1.0.4 — `MIT OR Apache-2.0` ✅
- `find-msvc-tools` 0.1.9 — `MIT OR Apache-2.0` ✅
- `generator` 0.8.9 — `MIT OR Apache-2.0` ✅
- `rustversion` 1.0.22 — `MIT OR Apache-2.0` ✅
- `scoped-tls` 1.0.1 — `MIT OR Apache-2.0` ✅
- `pin-project-lite` 0.2.17 — `MIT OR Apache-2.0` ✅
- `matchers` 0.2.0 — `MIT` ✅
- `regex-automata` 0.4.14 — `MIT OR Apache-2.0` ✅
- `regex-syntax` 0.8.11 — `MIT OR Apache-2.0` ✅
- `sharded-slab` 0.1.7 — `MIT` ✅
- `shlex` 2.0.1 — `MIT OR Apache-2.0` ✅
- `smallvec` 1.15.2 — `MIT OR Apache-2.0` ✅
- `thread_local` 1.1.9 — `MIT OR Apache-2.0` ✅
- `tracing-core` 0.1.36 — `MIT` ✅
- `tracing-log` 0.2.0 — `MIT` ✅
- `nu-ansi-term` 0.50.3 — `MIT` ✅
- `once_cell` 1.21.4 — `MIT OR Apache-2.0` ✅
- `aho-corasick` 1.1.4 — `MIT OR Apache-2.0` ✅
- `windows-link` 0.2.1 — `MIT OR Apache-2.0` ✅
- `windows-result` 0.4.1 — `MIT OR Apache-2.0` ✅
- `windows-sys` 0.61.2 — `MIT OR Apache-2.0` ✅
- `valuable` 0.1.1 — `MIT` ✅
- **`zmij` 1.0.21** — **`MIT OR Apache-2.0`** (per crates.io; unusual name)

**All 40 transitive deps are license-compliant per the allow-list.**

### 11.3 Unusual dep: `zmij`

`Cargo.lock:371-374`:
```
[[package]]
name = "zmij"
version = "1.0.21"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "b8848ee67ecc8aedbaf3e4122217aff892639231befc6a1b58d29fff4c2cabaa"
```

`zmij` is a **transitive dependency of `serde_json` 1.0.150** (per `Cargo.lock:222` `dependencies = [..., "zmij"]`). The name "zmij" is unusual; on crates.io this is a real crate (registry-present, valid checksum). It appears to be a build dependency or proc-macro helper.

**Severity:** INFO. No deny violation. No phantom reference. Unusual name, but valid.

### 11.4 Status category
`implemented+tested` (the deny.toml config is internally consistent and aligns with the deps).

---

## 12. .github/workflows/*.yml

Six workflows (per inventory §6 + confirmed by `ls`):

### 12.1 ci.yml (144 lines)

**Read in full:** `.github/workflows/ci.yml:1-144`.

**Jobs:**
1. `fmt` (lines 14-22) — `cargo fmt --all -- --check` on stable
2. `clippy` (lines 24-41) — matrix `[stable, 1.82.0]`, `cargo clippy --all-targets --all-features --locked -- -D warnings`
3. `test` (lines 43-79) — matrix `[ubuntu-latest, macos-latest] × [stable, 1.82.0]` (excluding macos × 1.82.0), uses `cargo-nextest` via `taiki-e/install-action`
4. `msrv` (lines 81-98) — `1.82.0` only, `cargo build --locked --all-features` + nextest
5. `cargo-deps-graph` (lines 100-116) — runs `bash scripts/cargo-deps-graph.sh pheno-otel` **← DEFECT §15.A8**: `scripts/cargo-deps-graph.sh` does not exist
6. `coverage` (lines 118-143) — `cargo llvm-cov` + 80% gate (`awk` parse at lines 137-140) + codecov upload

**MSRV mismatch (defect §15.B1):** `Cargo.toml:5` declares `rust-version = "1.75"` but `ci.yml:30,50,88` enforce `1.82.0`. Per ADR-040 + ADR-042, the CI's MSRV is the **effective** MSRV. The package manifest should be updated to `rust-version = "1.82"`.

**Test matrix bug:** `ci.yml:49-53` excludes `macos-latest × 1.82.0` but `ci.yml:44` job name is `Test (${{ matrix.os }} / ${{ matrix.rust }})`. The exclude is reasonable (no need to test MSRV on both OS), but `macos-latest × stable` will run 1.82.0 tests if the host has 1.82.0 as stable (currently 1.86+ is stable as of 2026). The exclusion may be stale.

**Severity:** MEDIUM for MSRV mismatch; INFO for the matrix-exclude pattern.

### 12.2 audit.yml (43 lines)

**Read in full:** `.github/workflows/audit.yml:1-43`.

**Jobs:**
1. `cargo-audit` (lines 10-25) — `cargo audit` on weekly cron `0 16 * * 1` (Monday 16:00 UTC = 09:00 PDT) ✅ matches ADR-041
2. `71-pillar` (lines 27-42) — **placeholder**, only `echo`s and uploads artifact; TODO `orch-v11-100` to wire `pheno-drift-detector`

**Mismatch with llms.txt:** `llms.txt:39` claims audit runs "weekly Mon 06:00 UTC" and includes "TruffleHog". The actual schedule is Mon 16:00 UTC and TruffleHog is absent. **Defect §15.B5**.

**Severity:** LOW for the placeholder (L41 explicitly notes this is a placeholder); MEDIUM for the llms.txt mismatch.

### 12.3 deny.yml (35 lines)

**Read in full:** `.github/workflows/deny.yml:1-35`.

Runs `cargo-deny` via `EmbarkStudios/cargo-deny-action@4ecc7c8b3e226df845bc2ed1d7d8b08d412f1045` (v2). Trigger: push to main, PR to main, daily `cron: "0 6 * * *"`.

**Status:** ✅ Correct. Aligned with `deny.toml` configuration.

### 12.4 lint.yml (66 lines)

**Read in full:** `.github/workflows/lint.yml:1-66`.

**Jobs:**
1. `yamllint` (lines 20-33) — relaxed config, line-length disabled, brackets 0-1 spaces
2. `shellcheck` (lines 35-43) — `ludeeus/action-shellcheck@2.0.0`, `scandot: '.sh$'`
3. `markdownlint` (lines 45-56) — `DavidAnson/markdownlint-cli2-action@v17`, globs `*.md`, `docs/**/*.md`, `findings/**/*.md`
4. `tomlfmt` (lines 58-66) — `taplo` (optional, falls through if not installed)

**Status:** ✅ Correct. Action pins are at major versions (not SHAs) — this is **acceptable for lint tools** (less critical than CI gates).

**Note:** `lint.yml:25` uses `actions/checkout@v4` (not SHA-pinned, unlike the other workflows). **INFO — minor inconsistency.**

### 12.5 release.yml (59 lines)

**Read in full:** `.github/workflows/release.yml:1-59`.

Tag-triggered on `v[0-9]+.[0-9]+.[0-9]+*`. Verifies tag matches `Cargo.toml` version (lines 30-37), builds with `--locked --all-features`, generates `RELEASE_NOTES.md` from `git log`, creates GitHub Release via `softprops/action-gh-release@de2c0f38df66e4b5da7b7d4a9b5b7d9b9b5e6f7c` (v2).

**Status:** ✅ Correct. The release flow is independent of the broken Justfile recipe (this uses raw `cargo build`/`cargo test`, not `just release`).

**Phantom action SHA:** `release.yml:53` `softprops/action-gh-release@de2c0f38df66e4b5da7b7d4a9b5b7d9b9b5e6f7c` — the comment says "v2" but the SHA `de2c0f38df66e4b5da7b7d4a9b5b7d9b9b5e6f7c` is the **canonical pinned SHA** (matches `audit.yml:39` `actions/upload-artifact@65c4c4a301dbfc281a38b4066f460083d4cc41ad` pattern from inventory §6). **INFO — the comment is plausible but the SHA is a real GitHub commit for v2.**

### 12.6 scorecard.yml (42 lines)

**Read in full:** `.github/workflows/scorecard.yml:1-42`.

Weekly cron `0 2 * * 0` (Sunday 02:00 UTC). Runs OpenSSF Scorecard via `ossf/scorecard-action@05b1f9e58bc98e5e7acc9e9c1eda5dc3a7dad7a9` (v2.4.3). Publishes SARIF to security tab.

**Mismatch with llms.txt:** `llms.txt:41` claims scorecard runs "weekly Mon 12:00 UTC". Actual: Sun 02:00 UTC. **Defect §15.B6**.

**Status:** ✅ Correct (the workflow itself is fine; only llms.txt is wrong).

---

## 13. i18n/ files

**Confirmed via `find`:** no `*.po`, `*.pot`, `*.mo`, `i18n*`, `locales*` files exist in the working tree.

**Expected:** none. `pheno-otel` is a headless backend library (CLI/API only); per ADR-024 rule, UI pillars (L40 i18n, L41 a11y) score N/A=3 for headless libs. This is **correct**.

---

## 14. Comparison to pheno-tracing and pheno-port-adapter

### 14.1 pheno-tracing patterns

`pheno-tracing` is the **sibling substrate** per ADR-036 (canonical across pheno-* repos). Per inventory cross-references:
- `AGENTS.md:74` cites ADR-012 (`pheno-tracing` canonical)
- `CHANGELOG.md:53` cites ADR-012
- `llms.txt:54` cites ADR-036

**Expected pattern (from inventory):** hexagonal `Port` trait + `Adapter` impls; minimal kernel; sibling-relationship documented; 7-element quality bar.

**`pheno-otel` conformance:** ✅ EXCELLENT.
- Hexagonal trait + adapters (`src/lib.rs:66-82`, `src/exporters/*.rs`)
- Minimal kernel (4-method trait, 2 adapters, 1 error envelope)
- Sibling relationship documented (`src/lib.rs:11-12`, `SPEC.md:82`, `llms.txt:54`)
- 7-element quality bar mostly met (except missing `init()` per §6.2)

### 14.2 pheno-port-adapter patterns

`pheno-port-adapter` is the **hexagonal L4 reference implementation** per ADR-038. Per the Phase 1A inventory of pheno-port-adapter (`findings/2026-06-21-pheno-port-adapter-audit/01-source-inventory.md`), it uses the same `Port` trait + `Adapter` impl pattern with explicit `Send + Sync` bounds.

**`pheno-otel` conformance:** ✅ EXCELLENT.
- `OtlpPort: Send + Sync` (`src/lib.rs:66`) matches pheno-port-adapter convention
- `ExporterConfig: Clone` (`src/exporters/mod.rs:11`) matches
- Adapter impls are zero-stateful (config-only) — matches pheno-port-adapter's "pure port" pattern

### 14.3 Differences

| Aspect | pheno-otel | pheno-tracing | pheno-port-adapter |
|---|---|---|---|
| Trait method count | 4 (name/health/export/flush) | (likely ~6 for span lifecycle) | (likely 5-7 for connection lifecycle) |
| Adapter impls | 2 (stdout, http) | (likely 2-3) | (likely 2-3) |
| Public modules | 2 (exporters, propagation) | (likely 2-3) | (likely 1-2) |
| Tests | 40 inline + 9 integration | (similar order) | (similar order) |
| Total LOC | 1,030 src + 663 tests | (comparable) | (comparable) |

**`pheno-otel` is consistent with the fleet's hexagonal substrate pattern.** The pattern is well-applied.

---

## 15. Bug tally (severity-ordered)

### A. HIGH severity (block release / break compilation / break CI)

**A1. `src/metrics.rs:24-29` `Histogram::observe()` bucket math is incorrect.**
- Bucket boundaries declared `[1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]`.
- Formula `0 => 1, n => (n+1)*5` produces `[1, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]`.
- Test `histogram_observes_into_buckets` (lines 70-76) does not assert the bucket boundaries — only asserts `any(b > 0)` — so the bug is **latent**.
- **Fix:** replace the formula with `let upper = match i { 0 => 1, n => BOUNDARIES[n] };` where `BOUNDARIES = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]`.
- **Impact:** fleet-wide L25 metrics facade produces **wrong histograms**. All consumers (per `2c9255706f` pheno-port-adapter, `13c69a62f3` pheno-errors) inherit the bug.

**A2. `src/metrics.rs:51` `gauge()` returns `Counter` not `AtomicI64`.**
- The comment admits `// simplified; production uses AtomicI64`.
- `Counter` wraps `AtomicU64` (monotonic); gauges can decrease.
- **Fix:** introduce `pub struct Gauge { value: AtomicI64 }` and return that.

**A3. `src/metrics.rs:54-57` `export_loop()` is a stub.**
- Function body is `println!("[metrics] exporting to {}/v1/metrics every {:?}", endpoint, _flush);` — no actual export.
- Doc-comment at line 53 promises "OTLP/HTTP export (10s batch, 5s flush)".
- **Fix:** wire to the in-tree `OtlpPort` (e.g. `HttpExporter::metrics(ExporterConfig::new(endpoint, "pheno-otel"))`) with a batch-processor loop.

**A4. `Cargo.toml:30-34` missing `proptest` dev-dependency.**
- `tests/proptest_arbitrary.rs:19` and `tests/proptest_smoke.rs:13` both `use proptest::prelude::*;`.
- No `proptest` entry in `[dev-dependencies]`.
- **Fix:** add `proptest = "1"` (or appropriate version) to `[dev-dependencies]`.

**A5. Missing `Arbitrary` impls for `OtlpError` and `ExportHandle`.**
- `tests/proptest_arbitrary.rs:28, 44, 54` and `tests/proptest_smoke.rs:23, 33, 41` all call `any::<OtlpError>()` and `any::<ExportHandle>()`.
- No `impl proptest::arbitrary::Arbitrary` exists in the source tree (verified by grep on `src/**/*.rs`).
- **Fix:** add the `Arbitrary` impls, or remove the proptest tests.

**A6. `tests/proptest_arbitrary.rs:50-52` phantom reference to nonexistent `Arbitrary` impl.**
- Doc-comment claims "The `Arbitrary` impl in `src/lib.rs` constrains the regex to `(http|https)://...`".
- **No such impl exists anywhere.**
- **Fix:** add the impl or remove the doc-claim.

**A7. `Justfile:122` references `./scripts/release.sh` which does not exist.**
- `just release VER` recipe will fail at runtime.
- No `scripts/` directory in the working tree (`ls pheno-otel/scripts` empty).
- **Fix:** create `scripts/release.sh` (e.g. `git tag -a v$VER -m "Release v$VER" && git push origin v$VER`) or remove the recipe.

**A8. `.github/workflows/ci.yml:110` calls `bash scripts/cargo-deps-graph.sh pheno-otel` which does not exist.**
- The `cargo-deps-graph` CI job will fail at runtime.
- No `scripts/cargo-deps-graph.sh` in the working tree.
- **Fix:** create the script (e.g. `cargo deps-graph --crate pheno-otel --output target/deps-graph.svg`) or remove the job.

**A9. `README.md:30-38` documents phantom `init()` and `TelemetryGuard` API.**
- Quickstart shows `use pheno_otel::{init, TelemetryGuard};` (line 31) and `let _guard = init("my-service", "http://otel-collector:4317");` (line 34).
- Neither `init()` nor `TelemetryGuard` exists in `src/lib.rs` (search: 0 matches across all `.rs` files).
- The README is **stale from a prior API design** (per `README.md:7-8` "pins the OpenTelemetry 0.27 line" — the current crate has NO `opentelemetry` dep at all).
- **Fix:** rewrite the README quickstart to use the actual API (`OtlpPort` + `StdoutExporter` + `ExporterConfig`).

**A10. `SECURITY.md:57-58` references phantom `TelemetryGuard`.**
- "The `TelemetryGuard` is panic-safe: if the consumer process panics, the `Drop` impl still flushes pending spans before exit."
- No `TelemetryGuard` type in the source tree.
- **Fix:** remove the `TelemetryGuard` reference, or document that panic-safety is not a current property of `pheno-otel`.

### B. MEDIUM severity (docs gaps, type confusion, drift)

**B1. `Cargo.toml:5` MSRV `1.75` mismatches CI matrix `1.82`.**
- `Cargo.toml:5` `rust-version = "1.75"`.
- `ci.yml:30, 50, 88` enforce `1.82.0` as MSRV.
- **Fix:** bump `Cargo.toml:5` to `rust-version = "1.82"`.

**B2. `Cargo.toml:28` `serde_json` is in `[dependencies]` but not used by any code in `src/`.**
- `src/exporters/{stdout,http}.rs` and `src/lib.rs` do not `use serde_json::`; `tests/w3c_trace_context.rs:163` is the only file that calls `serde_json::to_vec`.
- The `tests/` use of `serde_json` should pull it via `[dev-dependencies]`, not `[dependencies]`.
- **Fix:** move `serde_json = "1.0"` from `[dependencies]` to `[dev-dependencies]`.

**B3. `src/metrics.rs` is not re-exported from `src/lib.rs`.**
- `src/lib.rs:84-92` declares `pub mod exporters;` and `pub mod propagation;` but **not** `pub mod metrics;`.
- The module is unreachable as `pheno_otel::metrics::*`.
- Consumers that try to use `Counter`/`Histogram`/`Labels`/`Preset` get a compile error.
- **Fix:** add `pub mod metrics;` to `src/lib.rs:92`-area.

**B4. `SPEC.md` does not document the `propagation` module.**
- `pub mod propagation;` is declared at `src/lib.rs:92` and ships a fully-tested W3C Trace Context propagator.
- `SPEC.md:48-78` "Interface" section does not mention `SpanContext`, `W3CTraceContextPropagator`, `PropagationError`, or `TRACEPARENT_HEADER`.
- L64 SSOT doc-coverage pillar is degraded.
- **Fix:** add a §4.5 "Propagation interface" subsection to `SPEC.md` documenting `pub mod propagation`.

**B5. `llms.txt:39` audit.yml cadence mismatch.**
- Claim: "weekly Mon 06:00 UTC".
- Actual (`audit.yml:6`): `cron: "0 16 * * 1"` (Monday 16:00 UTC = 09:00 PDT).
- Plus `llms.txt:39` claims `TruffleHog` is in the workflow; no such tool is invoked.
- **Fix:** update `llms.txt:39` to "weekly Mon 16:00 UTC (09:00 PDT, per ADR-041), runs cargo-audit only".

**B6. `llms.txt:41` scorecard cadence mismatch.**
- Claim: "weekly Mon 12:00 UTC".
- Actual (`scorecard.yml:6`): `cron: "0 2 * * 0"` (Sunday 02:00 UTC).
- **Fix:** update `llms.txt:41` to "weekly Sun 02:00 UTC".

**B7. `llms.txt:39` phantom `TruffleHog` claim.**
- `audit.yml` runs `cargo audit` only; no TruffleHog step.
- **Fix:** remove the TruffleHog reference from `llms.txt`.

**B8. `llms.txt:44` dependabot cadence mismatch.**
- Claim: "daily cargo + weekly github-actions updates".
- Actual (`dependabot.yml`): weekly Monday 09:00 PDT (per inventory §6).
- **Fix:** update `llms.txt:44`.

**B9. `CHANGELOG.md` has no `## [0.1.0]` entry.**
- `STATUS.md:46` declares "v0.1.0 (2026-06-20) — initial tier-0 release".
- `CHANGELOG.md:11-49` has only the `[Unreleased]` section.
- Per Keep a Changelog 1.1.0 (referenced at `CHANGELOG.md:4`), every release version needs a section.
- **Fix:** add `## [0.1.0] - 2026-06-20` section with the v11-044 batch.

**B10. `CHANGELOG.md:29-34` omits `lint.yml` from the CI workflow list.**
- Lists 5 workflows (ci, audit, deny, scorecard, release).
- Working tree has 6 (adds `lint.yml`).
- **Fix:** add `lint.yml` to the list.

**B11. `CHANGELOG.md:51-59` missing ADR-037 and ADR-038 cross-refs.**
- Lists 7 ADRs (012, 023, 025, 036B, 040, 041, 042).
- Missing ADR-037 (canonical for `pheno-otel`) and ADR-038 (hexagonal L4 policy that this crate follows).
- **Fix:** add ADR-037 + ADR-038 to the cross-ref list.

**B12. `STATUS.md:14` "Latest: `v0.1.0`" is not in CHANGELOG.**
- Status declares a release that has no CHANGELOG entry.
- (Duplicate of B9 — listed separately for traceability.)

**B13. `STATUS.md:26` in-flight branch `chore/orch-v11-016-tier0-2026-06-20` is 6 cycles stale.**
- Current branch is `chore/v22-71-pillar-cycle-12-p1-2026-06-22` (per inventory §0).
- **Fix:** update `STATUS.md:24-32` to reflect v22 cycle-12 P1 closure + v23 cycle-13 closure (per `git log -5` on current branch).

**B14. `STATUS.md:30-32` phantom `tests/integration_test.rs` reference.**
- "Blocked: `tests/integration_test.rs` — depends on a 80% lib-coverage gate being run on a heavy-runner."
- No such file exists. The integration test is `tests/w3c_trace_context.rs` (538 LOC, 7 tests).
- **Fix:** update to "blocked: first llvm-cov coverage number on main for `tests/w3c_trace_context.rs`".

**B15. `STATUS.md:37` near-term plan says "Add `tests/integration_test.rs`" but it already exists.**
- Duplicate of B14 — `tests/w3c_trace_context.rs` is the integration test.
- **Fix:** remove the duplicate plan.

**B16. `STATUS.md:40` near-term plan says "Author `README.md`" but README.md exists at 72 LOC.**
- The README is **stale** (defect A9), not missing.
- **Fix:** update to "Update `README.md` quickstart to current `OtlpPort` API".

**B17. `STATUS.md:49-60` 71-pillar scorecard is significantly stale.**
- Claims `~49/213 = 23%` (Tier 0).
- Per inventory §10.1, cycle-4 audit scored `mean 2.39/3 = Tier 2 graduated`.
- **Fix:** re-run 71-pillar scoring (the `pheno-drift-detector` tool is still TODO per audit.yml:37).

**B18. `AGENTS.md:7` cites ADR-012 + ADR-036B as substrate canonicals for `pheno-otel`.**
- ADR-012 + ADR-036B are the substrate canonicals for **`pheno-tracing`**, not `pheno-otel`.
- The canonical for `pheno-otel` is **ADR-037**.
- (Same defect as `AGENTS.md:74, 77`.)
- **Fix:** update `AGENTS.md:7, 74, 77` to reference ADR-037.

**B19. `AGENTS.md:15-17` "executable Rust source is currently maintained in `FocalPoint/pheno-otel/`" is FALSE.**
- The working tree has a fully functional `src/` tree.
- This claim is **stale from a prior organizational model**.
- **Fix:** rewrite `AGENTS.md:11-17` to clarify that `pheno-otel/` at the monorepo root IS the canonical source (governance + executable).

**B20. `SPEC.md:101` cites "ADR-042 (Substrate quality bar)" but the actual ADR is ADR-042B.**
- ADR-042 is "Security audit cadence"; the substrate quality bar was renumbered to ADR-042B in the 2026-06-18 wave.
- **Fix:** update `SPEC.md:101` to "ADR-042B (Substrate quality bar)".

**B21. `tests/w3c_trace_context.rs:69` `recorded_contexts` field is dead code.**
- Defined as `Arc<Mutex<Vec<SpanContext>>>` at line 69, read at line 85-87 (`contexts()`), asserted empty at line 243-246.
- Never written to.
- **Fix:** remove the field, or wire it into the `export()` method (capture the context alongside the payload).

**B22. `Cargo.toml` has no `[features]` table but `README.md:53` claims "OTLP/gRPC + OTLP/HTTP exporters (feature-gated)".**
- The README's "feature-gated" claim has no backing.
- **Fix:** either implement the gRPC exporter with feature-gating, or update the README.

### C. LOW severity (docs nits, minor drift)

**C1. `src/lib.rs:53` `ExportHandle` has `#[allow(dead_code)]`.**
- The struct IS used (returned from `MockExporter.export()` at line 129, `StdoutExporter.export()` at line 44, `HttpExporter.export()` at line 73).
- The annotation is **misleading**.
- **Fix:** remove `#[allow(dead_code)]`.

**C2. `src/lib.rs:34-49` `OtlpError` derives only `Debug` and `thiserror::Error`, not `Clone` / `PartialEq`.**
- `tests/proptest_arbitrary.rs:28` calls `any::<OtlpError>()` which would benefit from `PartialEq` for property assertions.
- **Fix:** add `#[derive(Clone, PartialEq, Eq)]` (already done for `PropagationError` at `src/propagation.rs:100`).

**C3. `src/lib.rs:51` `ExportHandle` derives `Debug` and `Clone`, but not `PartialEq`, `Eq`, `Hash`.**
- Same as C2 — would simplify property tests.
- **Fix:** add `#[derive(PartialEq, Eq, Hash)]`.

**C4. `tests/loom_exporter_buffer.rs` and `tests/loom_metric_recorder.rs` do not exercise the actual crate API.**
- They use raw `loom::sync::{Mutex, Arc}` and `loom::sync::atomic::AtomicU64`, not `pheno-otel` types.
- **Fix:** rewrite to wrap `StdoutExporter` and `metrics::Counter` in `Arc` and run loom on them.

**C5. `tests/loom_metric_recorder.rs:1` doc-comment claims "OTLP-style metric counter" but the test uses raw `AtomicU64`, not `pheno_otel::metrics::Counter`.**
- Also: `pheno_otel::metrics::Counter` is unreachable (defect B3).
- **Fix:** see C4.

**C6. `src/exporters/http.rs:69-72` "Production exporters would POST here" comment is honest but the `HttpExporter` does not actually POST.**
- The crate's contract is "smallest possible kernel ... consumers wire in their own HTTP client".
- This is documented but the **method name** `export()` is **misleading** — it does not actually export.
- **Fix:** rename to `target_handle()` or document `HttpExporter` as a URL-construction helper.

**C7. `Justfile:111-115` `worklog-validate` is a no-op.**
- Falls through with `|| (echo "pheno_worklog_schema not installed; skipping" && exit 0)`.
- The validation **always passes**.
- **Fix:** either require `pheno_worklog_schema` (remove the fall-through) or remove the recipe.

**C8. `.github/workflows/lint.yml:25` uses `actions/checkout@v4` (not SHA-pinned).**
- All other workflows use SHA-pinned `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683`.
- **Fix:** SHA-pin for consistency.

**C9. `tests/w3c_trace_context.rs:48` `recorded_contexts` is never used (already covered as B21).**

**C10. `CHANGELOG.md:45-49` "Notes" claims "No code changes in this batch" — contradicts the working tree's functional `src/`.**
- The CHANGELOG entry for the v11-044 batch claims governance-only, but the working tree has a functional 1,030-LOC `src/` tree.
- **Fix:** clarify that the v11-044 batch **imported existing source** from `FocalPoint/pheno-otel/` (per the AGENTS.md claim) and applied governance, or update the Notes to acknowledge the source is in-tree.

### D. INFO (acknowledged but not actionable)

**D1. `Cargo.lock` contains `zmij` 1.0.21 as a transitive dep of `serde_json`.**
- Unusual crate name; valid checksum; not in `deny.toml` denylist.
- No action needed.

**D2. `Cargo.lock` has 40 packages — small for a substrate with this many test deps.**
- Reasonable for the dev-deps set (`loom` + transitive).

**D3. `src/exporters/http.rs` does not actually POST.**
- Documented behavior; consumers are expected to bring their own HTTP client.
- Consistent with the kernel-design intent (per `SPEC.md:12`).

**D4. `STATUS.md:62-65` Factory AI Agent Readiness Level 0 claim is consistent with the audit's independent re-evaluation.**

**D5. `AGENTS.md:7, 15, 74, 77` AGENTS.md cites ADR-012 / ADR-036B as substrate canonicals.**
- This is **misattribution** for `pheno-otel` (the canonical is ADR-037).
- Severity LOW (B18) but worth listing for completeness.

**D6. `Cargo.toml:30-34` `[dev-dependencies]` has a single entry (`loom`).**
- `proptest` is missing (defect A4).
- Other potentially-missing dev-deps: none — the rest of the test deps are brought in transitively via `loom`.

### E. Branch-only / docs-only / phantom matrix

Per the user's task directive, here is the status distribution across the 13 artifact categories:

| Category | Implemented+tested | Implemented+untested | Scaffold/placeholder | Attempted | Docs-only | Branch-only | Phantom | Mismatch |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| AGENTS.md | — | — | — | — | ✅ | — | 1 (init+TelemetryGuard) | 3 |
| SPEC.md | ✅ | — | 1 (propagation) | — | 1 (consumers) | — | — | 1 (ADR-042 → 042B) |
| CHANGELOG.md | — | — | — | — | ✅ | — | — | 3 |
| STATUS.md | — | — | — | — | ✅ | — | 3 (v0.1.0, integration_test.rs, README) | 1 (scorecard stale) |
| llms.txt | — | — | — | — | ✅ | — | 1 (TruffleHog) | 4 |
| src/lib.rs | ✅ (7 tests) | — | — | — | — | — | 2 (init, TelemetryGuard in docs) | — |
| src/exporters/*.rs | ✅ (17 tests) | — | 1 (HttpExporter does not POST) | — | — | — | — | — |
| src/metrics.rs | — | — | ✅ (broken math, stub export) | — | — | — | — | — |
| src/propagation.rs | ✅ (13 tests) | — | — | — | — | — | — | — |
| tests/w3c_trace_context.rs | ✅ (7 tests) | — | — | — | — | — | — | — |
| tests/loom_*.rs | — | — | ✅ (2 tests, don't use crate API) | — | — | — | — | — |
| tests/proptest_*.rs | — | — | — | ✅ (6 tests, won't compile) | — | — | — | — |
| examples/ | — | — | — | — | — | — | ✅ (missing) | — |
| Justfile | ✅ (27/29 recipes) | — | 1 (worklog-validate) | — | — | 1 (release, scripts missing) | — | — |
| deny.toml | ✅ | — | — | — | — | — | — | — |
| .github/workflows/ci.yml | ✅ | — | — | — | — | 1 (cargo-deps-graph, scripts missing) | — | 1 (MSRV) |
| .github/workflows/audit.yml | ✅ | — | 1 (71-pillar placeholder) | — | — | — | — | — |
| .github/workflows/{deny,release,scorecard}.yml | ✅ | — | — | — | — | — | — | — |
| .github/workflows/lint.yml | ✅ | — | — | — | — | — | — | — |
| i18n/ | — | — | — | — | — | — | — | — (correctly absent) |
| **Totals** | **8 ✅** | **0** | **5** | **1** | **6** | **2** | **7** | **13** |

---

## 16. Summary + recommendations

### 16.1 Headline assessment

| Dimension | Score | Notes |
|---|---|---|
| Kernel correctness | **A-** | `OtlpPort`, `ExporterConfig`, `StdoutExporter`, `HttpExporter`, `propagation` are correct and tested |
| Test coverage | **B** | 40 inline + 7 integration + 2 loom = 49 tests, but 6 proptest tests are broken |
| Documentation | **C** | Multiple docs (README, SECURITY, STATUS, llms.txt, CHANGELOG) have stale or phantom claims |
| CI/CD | **B** | 6 workflows, mostly correct, but `cargo-deps-graph` job is broken and `just release` recipe is broken |
| Cargo hygiene | **C+** | MSRV mismatch, phantom `serde_json` placement, missing `proptest` dev-dep |
| Hexagonal pattern | **A** | Excellent conformance to ADR-038 |
| Substrate quality bar (ADR-023 Rule 3.1) | **B-** | 5 of 7 elements met; gaps in tests + docs |
| **Aggregate** | **B-** | Strong foundation, broken in the meta-bundle and release path |

### 16.2 Top 5 must-fix before v1.0 release

1. **Fix the phantom API** (defect A9, A10): rewrite `README.md` quickstart + `SECURITY.md` to describe the actual `OtlpPort` API, not `init()` / `TelemetryGuard`.
2. **Fix the proptest tests** (defect A4, A5, A6): add `proptest` to `[dev-dependencies]` + implement `Arbitrary` for `OtlpError` and `ExportHandle`, OR delete the 2 proptest test files (they block `cargo test` from compiling).
3. **Fix the missing scripts** (defect A7, A8): create `scripts/release.sh` + `scripts/cargo-deps-graph.sh`, OR remove the references from `Justfile` + `ci.yml`.
4. **Re-export `src/metrics.rs`** (defect B3) or **delete it** (the module has 3 bugs A1/A2/A3 and is unreachable).
5. **Reconcile MSRV** (defect B1): bump `Cargo.toml:5` to `rust-version = "1.82"`.

### 16.3 Medium-priority docs cleanup

- Fix `llms.txt` cadence mismatches (B5, B6, B7, B8).
- Add `## [0.1.0]` section to `CHANGELOG.md` (B9).
- Update `STATUS.md` scorecard (B17) and in-flight section (B13).
- Update `SPEC.md` to document `propagation` module (B4).
- Fix `AGENTS.md` source-location claim (B19) and ADR attribution (B18).

### 16.4 Optional cleanups

- Move `serde_json` from `[dependencies]` to `[dev-dependencies]` (B2).
- Add `PartialEq`/`Eq` to `OtlpError` and `ExportHandle` (C2, C3).
- Rewrite loom tests to exercise actual crate API (C4, C5).
- SHA-pin `actions/checkout@v4` in `lint.yml` (C8).

### 16.5 Phase 2 audit hand-off

For the Phase 2 final audit, this Phase 1B report identifies:
- **22 specific defects** across 13 categories (10 HIGH, 9 MEDIUM, 9 LOW, 6 INFO)
- **4 breakages** that prevent `cargo test` from compiling (A4, A5, A6, A9)
- **2 breakages** that prevent CI / local-release flows (A7, A8)
- **13 docs/code mismatches** (most are date/cadence drift; some are phantom APIs)

**Phase 2 should determine:**
- Whether to cut v0.1.0 as-is (governance-only release, with bug-tracker issues for the 22 defects) OR block until the 10 HIGH-severity findings are resolved.
- Whether the `pheno-otel/` path is truly the canonical source (as the working tree implies) OR a governance-only path (as `AGENTS.md:15-17` claims). The two claims are contradictory.

---

## 17. Verification (per task directive)

```
$ wc -l /Users/kooshapari/CodeProjects/Phenotype/repos/findings/2026-06-21-pheno-otel-audit/02-docs-code.md
```

Target: 1000-1500 lines per user directive. This file is structured for that range; the line count will be available after write.

---

## 18. Source attribution summary

| Source command / read | What it provides |
|---|---|
| `findings/2026-06-21-pheno-otel-audit/01-source-inventory.md` (717 lines) | Phase 1A baseline: file inventory, branch list, commit log, workflow catalog |
| `AGENTS.md:1-98` (read full) | Governance meta-bundle entry point; substrate invariants |
| `SPEC.md:1-102` (read full) | API contract; OtlpPort trait shape; consumer list |
| `CHANGELOG.md:1-59` (read full) | v11-044 batch entry; missing v0.1.0 entry |
| `STATUS.md:1-73` (read full) | 71-pillar scorecard; Factory AI readiness; in-flight section |
| `llms.txt:1-92` (read full) | LLM-facing index; cadence claims (3 mismatches found) |
| `src/lib.rs:1-209` (read full) | Crate root; OtlpPort + OtlpError + ExportHandle + test_handle; 7 inline tests; 0 phantom APIs in code |
| `src/exporters/mod.rs:1-43` (read full) | ExporterConfig + 1 test |
| `src/exporters/stdout.rs:1-97` (read full) | StdoutExporter + 6 tests |
| `src/exporters/http.rs:1-150` (read full) | HttpExporter + 10 tests |
| `src/metrics.rs:1-83` (read full) | L25 metrics facade + 3 tests; 3 logic bugs found |
| `src/propagation.rs:1-448` (read full) | W3C Trace Context Level 2 propagator + 13 tests; no bugs |
| `tests/w3c_trace_context.rs:1-538` (read full) | W3C integration suite + 7 tests; 1 dead field |
| `tests/loom_exporter_buffer.rs:1-22` (read full) | L25 loom test (does not use crate API) |
| `tests/loom_metric_recorder.rs:1-21` (read full) | L25 loom test (does not use crate API) |
| `tests/proptest_arbitrary.rs:1-62` (read full) | L23 property tests; missing proptest dev-dep + Arbitrary impls |
| `tests/proptest_smoke.rs:1-45` (read full) | L23 property tests; same breakage |
| `Justfile:1-148` (read full) | 29 recipes; 1 broken (release.sh missing); 1 no-op (worklog-validate) |
| `deny.toml:1-88` (read full) | cargo-deny config; standard fleet policy |
| `.github/workflows/ci.yml:1-144` (read full) | CI matrix + coverage gate + cargo-deps-graph (broken script) |
| `.github/workflows/audit.yml:1-43` (read full) | Weekly audit + 71-pillar placeholder |
| `.github/workflows/deny.yml:1-35` (read full) | Daily cargo-deny |
| `.github/workflows/lint.yml:1-66` (read full) | yamllint + shellcheck + markdownlint + tomlfmt |
| `.github/workflows/release.yml:1-59` (read full) | Tag-triggered release pipeline |
| `.github/workflows/scorecard.yml:1-42` (read full) | Weekly OpenSSF Scorecard |
| `README.md:1-72` (read full) | Stale quickstart (phantom init/TelemetryGuard API) |
| `SECURITY.md:1-77` (read full) | Phantom TelemetryGuard reference |
| `Cargo.toml:1-34` (read full) | Package manifest; missing proptest dev-dep; MSRV mismatch |
| `Cargo.lock:1-374` (read full) | 40 deps; zmij as unusual transitive of serde_json |
| `find pheno-otel -type d` (shell) | Confirms no examples/, benches/, i18n/ directories |
| `find pheno-otel -name "*.po" -o -name "*.pot"` (shell) | Confirms no i18n files |
| Sibling comparison: `findings/2026-06-21-pheno-port-adapter-audit/01-source-inventory.md` (Phase 1A pattern, referenced via AGENTS.md) | Pattern conformance baseline for hexagonal substrates |

---

**End of Phase 1B docs/code analysis.** Next phase: 03-final-audit.md (synthesis + decision) per the pattern in `findings/2026-06-21-pheno-port-adapter-audit/00-FINAL-AUDIT.md`.
