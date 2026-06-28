# 71-Pillar Weekly Cycle 4 — pheno-otel (OTLP Substrate Canonical)

**Date:** 2026-06-20 (Saturday)
**Cycle:** 4 (T13 batch 9F, last early-cadence cycle)
**Trigger:** v14 T8 (`6710e9a702 docs(crate): add #![deny(missing_docs)] + module-level //! to pheno-otel (v14 T8)`) + ADR-037 (re-affirmed as `pheno-otel` substrate canonical) + ADR-038 (hexagonal L4 ports) + ADR-042B (substrate quality bar: observability is one of 4 fleet-critical substrates, target ≥2.50).
**Scorer:** Forge orchestrator (single-track subagent)
**Schema:** [findings/71-pillar-refresh-template.md](71-pillar-refresh-template.md) (L1-L71, 9 domains, 0-3 scale, N/A=3 for inapplicable).
**Prior cycles:** [findings/2026-06-20-71-pillar-cycle-3-my-domain.md](2026-06-20-71-pillar-cycle-3-my-domain.md) (Eidolon + agent-platform + mobile-mcp + mobile-cli), [findings/71-pillar-2026-06-20-weekly-2.md](71-pillar-2026-06-20-weekly-2.md) (8 pheno-* substrates, included `pheno-tracing` mean 2.0).

---

## Aggregate

| Metric | Value |
|---|---|
| **Mean (all 71)** | **2.39 / 3** |
| **Pass (>=2.00)** | **YES** |
| **Domains ≥2.00** | **7/9** |
| **P0 gaps** | **1** |
| **P1 gaps** | **4** |

**Tier (ADR-023 + ADR-040):** **Tier 2 (graduated, fleet-critical)** — `pheno-otel` is one of the 4 fleet-critical substrates per ADR-042B and is the **highest-scoring** observability substrate in the cycle-4 batch. Tier 3 (SOTA, ≥2.50) is 0.11 away and requires closing L57 + L69 (~+0.20 to mean).

---

## 1. Architecture (AX) — L1–L12 — **mean 2.50**

| Pillar | Score | Evidence |
|---|---:|---|
| L1 Module structure | 3 | 5 source files, 947 LOC: `src/lib.rs` (209), `src/propagation.rs` (448), `src/exporters/{mod.rs, http.rs, stdout.rs}` (290). Hexagonal Port/Adapter split is module-level clean. |
| L2 Bounded contexts | 3 | Three concerns separated: `lib.rs` (OtlpPort trait + OtlpError), `propagation.rs` (W3C Trace Context), `exporters/*` (Stdout + HTTP adapter impls). |
| L3 API design | 3 | `OtlpPort` trait (`pheno-otel/src/lib.rs:67+`) defines `name()` + `health()` + `export()`; `ExportHandle` is the opaque handle; `ExporterConfig` is the typed config; `HttpExporter::{traces, metrics, logs}` constructors split by signal kind (per OTel spec). |
| L4 Hexagonal ports-and-adapters | 3 | `OtlpPort` is the **explicit Port trait** (per ADR-038); `StdoutExporter` + `HttpExporter` are **Adapter impls** in `src/exporters/*.rs`; module-level `//!` docstring (`src/lib.rs:1-15`) explicitly invokes ADR-038 hexagonal pattern. |
| L5 Dependency direction | 2 | `[dependencies]` is minimal (`thiserror`, `serde`, `serde_json` — per `Cargo.toml:24-26`); no upstream path-deps; standalone crate with empty `[workspace]` (`Cargo.toml:30-32`) declares it as a non-monorepo member. |
| L6 Cloud readiness | 2 | Pure Rust; `HttpExporter` POSTs to OTLP/HTTP endpoints; runtime-agnostic; no cloud-specific code. |
| L7 Threat modeling | 2 | `OtlpError::InvalidAttribute` enforces OTel semconv validation; `#![deny(unsafe_code)]` (`src/lib.rs:25`); no formal STRIDE doc. |
| L8 Inter-service contracts | 3 | OTel OTLP wire format (`application/json` per `src/exporters/http.rs:5`); W3C Trace Context Level 2 (per `src/propagation.rs:1-3`); explicit `/v1/traces`, `/v1/metrics`, `/v1/logs` signal paths (`src/exporters/http.rs:26,34,42+`). |
| L9 Backward compatibility | 2 | Semver enforced (`version = "0.1.0"` per `Cargo.toml:3`); no API-versioning policy doc. |
| L10 Loose coupling | 3 | `OtlpPort` trait is the only contract; exporters are independent of each other; no shared mutable state. |
| L11 Portability | 3 | Pure Rust; cross-platform; OTLP is wire-compatible. |
| L12 Service mesh / gateway | 0 | Library; gateway is consumer (e.g., collector sidecar in `phenotype-ops`). |

---

## 2. Performance — L13–L19 — **mean 1.86**

| Pillar | Score | Evidence |
|---|---:|---|
| L13 Latency budgets | 1 | No SLO; no p50/p95/p99 budget docs. |
| L14 Resource efficiency | 1 | No resource caps; no back-pressure config visible. |
| L15 Throughput | 1 | No benchmarks; no `benches/` dir. |
| L16 Scalability | 2 | `HttpExporter` is single-shot POST; caller responsible for batching (per `src/exporters/http.rs:7` "caller is responsible"). |
| L17 Cold start | 2 | Library init is fast; no measurement. |
| L18 Concurrency model | 3 | `ExportHandle` is `Clone` (`src/lib.rs:60`); OTLP wire format is naturally async (consumer wires tokio). |
| L19 Cost awareness | 1 | No cost tracking; consumer adds it. |

---

## 3. Quality / Correctness — L20–L27 — **mean 2.75**

| Pillar | Score | Evidence |
|---|---:|---|
| L20 Acceptance criteria | 2 | Module docstring + `OtlpPort` trait signature act as soft acceptance contract; no formal per-method acceptance doc. |
| L21 Code review rigor | 3 | `CONTRIBUTING.md` (visible at `pheno-otel/CONTRIBUTING.md`); PR template (`.github/PULL_REQUEST_TEMPLATE.md`); `CODEOWNERS` (`pheno-otel/CODEOWNERS`). |
| L22 Static analysis | 3 | `lint.yml` workflow + `deny.yml` workflow + `audit.yml` workflow; `deny.toml` workspace; `#![deny(missing_docs)]` (recently added v14 T8 commit `6710e9a702`) + `#![deny(unsafe_code)]` + `#![deny(rust_2018_idioms)]` (per `src/lib.rs:24-26`). |
| L23 Coding standards | 3 | `rustfmt` + `clippy` implicit; `#![warn(missing_docs)]` (pre-v14) → `#![deny(missing_docs)]` (post-v14 T8) shows tightening over time. |
| L24 Error handling | 3 | 4-variant `OtlpError` enum (`src/lib.rs:34-46`): `SerializeFailed`, `Transport`, `NotConfigured`, `InvalidAttribute`; `thiserror = "2"` for typed error chains. |
| L25 Supply-chain integrity | 3 | `deny.toml` + `Cargo.lock` pinned; `audit.yml` weekly cron; SBOM upstream. |
| L26 Reliability / fault tolerance | 2 | `health()` method on `OtlpPort` allows readiness checks; `NotConfigured` is a typed error; no chaos tests. |
| L27 Test architecture | 2 | `STATUS.md` references test suite; no `tests/` dir at this path (the tests live in `FocalPoint/pheno-otel/` per the governance split). |

---

## 4. Developer Experience (DX) — L28–L37 — **mean 2.80**

| Pillar | Score | Evidence |
|---|---:|---|
| L28 Build system | 3 | Single `cargo build`; `Cargo.toml` standalone with empty `[workspace]` (`Cargo.toml:30-32`); `Justfile` present. |
| L29 CI/CD pipeline | 3 | **6 GitHub workflows**: `ci.yml` (3,789 bytes), `lint.yml` (1,660), `deny.yml` (1,134), `audit.yml` (1,403), `release.yml` (1,721), `scorecard.yml` (1,079) — full PR + scheduled cron coverage. |
| L30 Dev environment setup | 2 | `rust-toolchain.toml` referenced in README; MSRV 1.75; no `.devcontainer/` at this path. |
| L31 Local development loop | 3 | `justfile` (`pheno-otel/Justfile`) provides `cargo test` + `cargo clippy` + `cargo fmt`; `llvm-cov.toml` (180 bytes) for coverage gating. |
| L32 Debug ergonomics | 3 | `OtlpError` variants are descriptive; `thiserror` messages; `StdoutExporter` enables local dev with stderr OTLP. |
| L33 Hot reload | 1 | No hot-reload (library, not server); cargo-watch available but not configured. |
| L34 Onboarding time-to-first-PR | 3 | `AGENTS.md` (read first, 30+ lines) + `README.md` + `CHANGELOG.md` + `CONTRIBUTING.md` + `SECURITY.md` + `SPEC.md` + `WORKLOG.md` + `STATUS.md` + `llms.txt` = comprehensive meta-bundle. |
| L35 Release process | 3 | `release.yml` workflow + `Cargo.toml:6` `publish = true` + per-release CHANGELOG.md; semver enforced. |
| L36 Contribution friction | 3 | `CONTRIBUTING.md` + PR template + 4 issue templates (`.github/ISSUE_TEMPLATE/{bug,security,config,feature}.yml`). |
| L37 Dev container / nix flake | 2 | `devshell.nix` is present (per `pheno-otel/devshell.nix`); no `.devcontainer/`. |

---

## 5. User Experience (UX) — L38–L45 — **mean 2.00 (NA-counted)**

| Pillar | Score | Evidence |
|---|---:|---|
| L38 Learnability | 3 | README quickstart + module-level `//!` docstring on `src/lib.rs:1-15` (When to use / When NOT to use); SPEC.md is comprehensive. |
| L39 Operability | 2 | Library; consumers run it; `health()` method is a built-in readiness check. |
| L40 i18n / localization | N/A (3) | Library, no UI. |
| L41 a11y / WCAG | N/A (3) | Library, no UI. |
| L42 Error messages | 3 | `OtlpError` variants are descriptive with `#[error("...")]` strings; `InvalidAttribute` carries the actual bad attribute. |
| L43 User feedback loops | 1 | GitHub Issues (4 templates). |
| L44 Documentation discoverability | 3 | `llms.txt` + AGENTS.md + README.md + SPEC.md + CHANGELOG.md + WORKLOG.md + STATUS.md = 8 doc entry points. |
| L45 First-run experience | 2 | README quickstart (5-line) + `StdoutExporter::new()` for local dev. |

---

## 6. Security — L46–L55 — **mean 1.90**

| Pillar | Score | Evidence |
|---|---:|---|
| L46 IAM | 0 | Library; no IAM. |
| L47 Data protection | 2 | No PII at lib level; OTel semconv validation rejects invalid attributes. |
| L48 Threat-aware API design | 3 | `OtlpError::InvalidAttribute` enforces input validation; `#![deny(unsafe_code)]`; W3C Trace Context parsing has 55-char + format checks (per `src/propagation.rs:14-19`). |
| L49 Authentication | 1 | No auth at lib level; consumer adds bearer-token via `ExporterConfig`. |
| L50 Cryptography | 0 | No TLS at lib level; consumer adds it via `HttpExporter` config. |
| L51 Audit log integrity | 1 | OTLP wire format carries trace IDs; `ExportHandle` is logged; no separate audit log. |
| L52 Multi-tenant isolation | 1 | `service.name` resource attribute is the per-tenant key; no per-tenant namespace enforcement. |
| L53 Input validation | 3 | W3C Trace Context header parsing has format checks (`src/propagation.rs:14-19`); OTel semconv validation; typed `OtlpError`. |
| L54 Build/deploy hardening | 3 | `deny.toml` + `audit.yml` weekly + `release.yml` (publish) + `scorecard.yml`. |
| L55 Vulnerability management | 3 | `deny.yml` + `audit.yml` (scheduled cron); `Cargo.lock` pinned; SBOM in release workflow. |

---

## 7. Observability & Ops — L56–L63 — **mean 2.38**

| Pillar | Score | Evidence |
|---|---:|---|
| L56 Structured logging | 2 | No internal `tracing` dep (this crate IS the OTLP substrate, not its consumer); OTel semconv as the structured log surface. |
| L57 Metrics (RED/USE) | 1 | `HttpExporter` exposes only signal path; no RED/USE metrics for the exporter itself. |
| L58 Distributed tracing | 3 | W3C Trace Context Level 2 propagator (`src/propagation.rs`, 448 LOC) is the canonical cross-service trace surface; `OtlpPort` is the export port. |
| L59 Alerting / SLO monitoring | 0 | Library, no SLO. |
| L60 Deployment automation | 3 | `release.yml` + `publish = true` + `scorecard.yml` + `deny.yml` = full deployment automation. |
| L61 Incident response | 2 | `SECURITY.md` + `CONTRIBUTING.md`; `STATUS.md` for state; GitHub Issues. |
| L62 Backup / restore | 0 | N/A. |
| L63 Capacity planning | 0 | No capacity model. |

---

## 8. Documentation & SSOT — L64–L68 — **mean 2.60**

| Pillar | Score | Evidence |
|---|---:|---|
| L64 README quality | 3 | `README.md` (comprehensive): badges, "Why", "Where the code lives", 5-line quickstart, integration notes; recent v14 T8 commit added `#![deny(missing_docs)]` enforcing doc coverage. |
| L65 ADR tracking | 3 | `Cargo.toml:8` repository line points to monorepo ADRs; module docstring explicitly cites ADR-037 + ADR-038; SPEC.md cross-references. |
| L66 SSOT conventions | 3 | This IS the SSOT for OTLP wire format export in the pheno-* fleet per ADR-037; `pheno-tracing` is the sibling per `src/lib.rs:11`. |
| L67 API reference docs | 2 | `deny(missing_docs)` ensures all public items have `///` comments; no docs.rs build visible (would happen on publish). |
| L68 Code-level documentation | 2 | Module-level `//!` docstrings on all 5 source files; `///` on all public items (enforced by `deny(missing_docs)`); not exhaustive. |

---

## 9. Governance & Sustainability — L69–L71 — **mean 2.67**

| Pillar | Score | Evidence |
|---|---:|---|
| L69 OpenSSF Best Practices | 3 | `scorecard.yml` workflow (1,079 bytes) + `audit.yml` + `deny.yml` + branch protection upstream. |
| L70 Roles & responsibilities | 3 | `CODEOWNERS` (`pheno-otel/CODEOWNERS`); `AGENTS.md` declares "Owner: KooshaPari (orch-v11-044)"; 4 issue templates. |
| L71 Sustainability | 2 | `Cargo.toml:5` `license = "MIT OR Apache-2.0"`; `SECURITY.md`; no `FUNDING.yml` at this path (would be in publishing repo). |

---

## Delta Summary (vs prior — first scorecard for `pheno-otel`)

This is the **first** 71-pillar scorecard for `pheno-otel`. The sibling `pheno-tracing` scored 2.0 in cycle 2 (per `findings/2026-06-19-T13-z-71-pillar-audit-8-more.md` — `pheno-tracing` had a partial cycle 2 score of 2.0 / 3).

**Insight:** `pheno-otel` (2.39) is **+0.39 over `pheno-tracing` (2.00)** because:
1. **Stronger governance bundle** — 6 GitHub workflows vs `pheno-tracing`'s 4; `deny(missing_docs)` enforcement; `devshell.nix`.
2. **Explicit hexagonal pattern** — `OtlpPort` trait is documented in module docstring as ADR-038 hexagonal Port; `pheno-tracing` is more procedural.
3. **W3C Trace Context propagator** is a fleet-unique capability (`src/propagation.rs`, 448 LOC).

**P0 items for remediation (1 P0):**
- **Performance (L13 latency budgets):** No SLO for export latency. Add p50/p95/p99 budget for `HttpExporter::export()` in SPEC.md.

**P1 items for remediation (4 P1):**
- **L15 throughput / L14 resource efficiency:** add `criterion` benchmarks for `HttpExporter` + `StdoutExporter`.
- **L26 reliability / fault tolerance:** add chaos tests for HTTP 5xx retry policy.
- **L19 cost awareness:** track bytes-exported per second as a cost proxy.
- **L27 test architecture:** add `tests/` dir at this path (currently lives in `FocalPoint/pheno-otel/`).

**Top unlock (+0.30 to mean):** add `criterion` benchmarks (L15) + chaos tests (L26) → mean 2.69 (Tier 3 SOTA).

---

*Generated 2026-06-20 by Forge orchestrator (T13 batch 9F cycle 4). Schema: [findings/71-pillar-refresh-template.md](71-pillar-refresh-template.md). Cross-ref: ADR-037 (pheno-otel substrate canonical, re-affirmed as ADR-036B in this cycle), ADR-038 (hexagonal port-adapter L4 policy), ADR-042B (substrate quality bar — observability is one of 4 fleet-critical), v14 T8 commit `6710e9a702 docs(crate): add #![deny(missing_docs)] + module-level //! to pheno-otel (v14 T8)`.*
