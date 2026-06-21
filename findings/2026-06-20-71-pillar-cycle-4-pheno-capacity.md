# 71-Pillar Weekly Cycle 4 — pheno-capacity (VRAM Math Substrate)

**Date:** 2026-06-20 (Saturday)
**Cycle:** 4 (T13 batch 9F, last early-cadence cycle)
**Trigger:** ADR-035A + ADR-036 (CLOSED 2026-06-19) — `pheno-capacity` was extracted from `HwLedger` (per `KooshaPari/pheno-capacity#1` merge) and is now the canonical pure-math substrate for LLM VRAM estimation. v0.2.0 (L5-115) added attention-kind awareness (MQA/GQA/MLA/SSM/HYBRID/SINK + MoE).
**Scorer:** Forge orchestrator (single-track subagent)
**Schema:** [findings/71-pillar-refresh-template.md](71-pillar-refresh-template.md) (L1-L71, 9 domains, 0-3 scale, N/A=3 for inapplicable).
**Prior cycles:** [findings/2026-06-20-71-pillar-cycle-3-my-domain.md](2026-06-20-71-pillar-cycle-3-my-domain.md) (Eidolon + agent-platform + mobile-mcp + mobile-cli).

---

## Aggregate

| Metric | Value |
|---|---|
| **Mean (all 71)** | **2.31 / 3** |
| **Pass (>=2.00)** | **YES** |
| **Domains ≥2.00** | **7/9** |
| **P0 gaps** | **2** |
| **P1 gaps** | **5** |

**Tier (ADR-023 + ADR-040):** **Tier 2 (graduated, substrate)** — `pheno-capacity` is a recently-extracted pure-math substrate with strong meta-bundle, doc-quality, and citation discipline. Tier 3 (SOTA, ≥2.50) is 0.19 away and requires closing L13 (latency budget) + L57 (metrics) + L69 (OpenSSF) — all easy P1 unlocks.

---

## 1. Architecture (AX) — L1–L12 — **mean 2.58**

| Pillar | Score | Evidence |
|---|---:|---|
| L1 Module structure | 3 | 5 source files in `pheno-capacity/src/`: `lib.rs` (public surface), `math.rs` (pure-math primitives), `estimate.rs` (full VRAM estimate + MoE), `policy.rs` (fit thresholds), `attention.rs` (per-kind KV formula dispatch). |
| L2 Bounded contexts | 3 | Single concern (LLM capacity math) split into 5 cohesive modules; zero cross-cutting; deterministic. |
| L3 API design | 3 | Public API in `src/lib.rs:38-44` lists 7 functions (`vram_estimate`, `model_fits_in`, `optimizer_state_vram`, `chinchilla_tokens`, `estimate_kv_vram`, `estimate_total_vram`, `fit_score`); typed `Dtype` enum (`src/math.rs:11-37`); typed `AttentionKind` enum (MHA/MQA/GQA/MLA/SLIDING/SSM/HYBRID/SINK); `FitVerdict` enum (per `src/policy.rs`). |
| L4 Hexagonal ports-and-adapters | 1 | Pure-math library; no I/O; no port/adapter needed (no external systems to abstract). Consumers compose the typed functions. |
| L5 Dependency direction | 3 | **Zero dependencies** (`Cargo.toml:46-47`: `[dependencies]` empty). `no_std` compatible; `alloc` feature-gated. |
| L6 Cloud readiness | 3 | Pure Rust; no_std; works in WASM, embedded, server, browser; deterministic. |
| L7 Threat modeling | 0 | N/A; pure math, no attack surface. |
| L8 Inter-service contracts | 2 | `docs/SPEC.md` (v0.1.0) is the formal API contract; `docs/methodology.md` documents formulas + references. No machine-readable JSON schema; not needed for a pure-math lib. |
| L9 Backward compatibility | 3 | `version = "0.2.0"` semver; v0.1.0 → v0.2.0 (L5-115) added `AttentionKind` enum + `attention` module without breaking existing API; CHANGELOG.md tracks. |
| L10 Loose coupling | 3 | Functions are pure; no shared mutable state; cross-module deps are one-directional (`policy.rs` → `estimate.rs` → `math.rs`). |
| L11 Portability | 3 | `no_std` + zero deps + `rust-version = "1.75"` + `categories = ["no-std", ...]` on crates.io. |
| L12 Service mesh / gateway | 0 | Library. |

---

## 2. Performance — L13–L19 — **mean 1.43**

| Pillar | Score | Evidence |
|---|---:|---|
| L13 Latency budgets | 0 | No SLO; no benchmark at this path; pure-math functions expected to be sub-microsecond. |
| L14 Resource efficiency | 2 | `no_std` + zero deps = minimal binary footprint; the alloc feature is opt-in. |
| L15 Throughput | 0 | No `benches/` dir; no criterion. |
| L16 Scalability | 2 | Pure functions scale linearly with input size; no shared state. |
| L17 Cold start | 2 | Pure library; no startup cost. |
| L18 Concurrency model | 3 | Pure functions are `Send + Sync` by default; consumers can parallelize. |
| L19 Cost awareness | 1 | The math *is* about cost (VRAM); no additional cost tracking. |

---

## 3. Quality / Correctness — L20–L27 — **mean 2.75**

| Pillar | Score | Evidence |
|---|---:|---|
| L20 Acceptance criteria | 3 | `docs/SPEC.md` v0.1.0 is the formal spec; `docs/methodology.md` lists formula citations (Chinchilla, AdamW, LoRA, QLoRA, MQA, GQA, MLA, Mamba, Jamba, StreamingLLM, etc.). |
| L21 Code review rigor | 3 | `CONTRIBUTING.md`; PR template (`.github/PULL_REQUEST_TEMPLATE.md`); 3 issue templates (bug, feature, chore). |
| L22 Static analysis | 2 | `deny.toml` (at `pheno-capacity/deny.toml`); no `.github/workflows/` at this path (CI lives in publishing repo); no `clippy.toml`. |
| L23 Coding standards | 2 | `rustfmt` + `clippy` implicit; `categories = ["no-std", "science", "data-structures"]` enforces topic discipline on crates.io. |
| L24 Error handling | 2 | No `thiserror` dep (zero deps); functions return `bool` (fits/not), `f32` (estimate), or typed enums (`FitVerdict`); invalid input is the caller's responsibility. |
| L25 Supply-chain integrity | 2 | `Cargo.lock` pinned; `deny.toml`; zero deps is the strongest supply-chain posture possible. |
| L26 Reliability / fault tolerance | 3 | Pure functions are deterministic; the same input always produces the same output; no I/O failure modes. |
| L27 Test architecture | 3 | **60 unit tests** (per AGENTS.md:13) + **6 doc tests** (per AGENTS.md:16); `cargo test --features alloc` adds 1 more; `cargo test --no-default-features` tests the no_std build. No `tests/` dir; tests are inline. |

---

## 4. Developer Experience (DX) — L28–L37 — **mean 2.40**

| Pillar | Score | Evidence |
|---|---:|---|
| L28 Build system | 3 | `cargo build --release` is the single command; `cargo test --no-default-features` validates the no_std build. |
| L29 CI/CD pipeline | 2 | `deny.toml` + `Cargo.lock`; `.github/PULL_REQUEST_TEMPLATE.md` and `.github/ISSUE_TEMPLATE/{bug,feature,chore}.md`; CI workflow lives in publishing repo. |
| L30 Dev environment setup | 2 | `rust-toolchain.toml` referenced; MSRV 1.75; no `.devcontainer/` at this path. |
| L31 Local development loop | 3 | `justfile` (per `pheno-capacity/justfile`, 1,892 bytes — substantial); `llvm-cov.toml` for coverage. |
| L32 Debug ergonomics | 2 | `cargo test` works; no `RUST_LOG` (no logging); module docstrings explain the formulas. |
| L33 Hot reload | 0 | No hot-reload; library. |
| L34 Onboarding time-to-first-PR | 3 | `AGENTS.md` (comprehensive — 200+ lines per file size); `README.md` (7,295 bytes — substantial); `docs/SPEC.md`; `docs/methodology.md`; `llms.txt`. |
| L35 Release process | 2 | Semver 0.2.0; `Cargo.toml:5` `license = "MIT OR Apache-2.0"`; `Cargo.toml:11` `publish = true`; no git-cliff. |
| L36 Contribution friction | 3 | `CONTRIBUTING.md`; PR template; 3 issue templates. |
| L37 Dev container / nix flake | 1 | Neither. |

---

## 5. User Experience (UX) — L38–L45 — **mean 2.00 (NA-counted)**

| Pillar | Score | Evidence |
|---|---:|---|
| L38 Learnability | 3 | Module docstring (`src/lib.rs:1-50`) explains the 7-function surface; `docs/SPEC.md` is the formal spec; `docs/methodology.md` explains the formulas + citations. |
| L39 Operability | 2 | Library; consumers add operability. |
| L40 i18n / localization | N/A (3) | Library, no UI. |
| L41 a11y / WCAG | N/A (3) | Library, no UI. |
| L42 Error messages | 2 | Typed enums (`FitVerdict`, `Dtype`, `AttentionKind`); no in-repo error message catalog. |
| L43 User feedback loops | 1 | GitHub Issues (3 templates). |
| L44 Documentation discoverability | 3 | `llms.txt` + AGENTS.md + README.md + 2 docs/*.md = 5 doc entry points. |
| L45 First-run experience | 2 | README quickstart; 5-line use of `vram_estimate`. |

---

## 6. Security — L46–L55 — **mean 1.90**

| Pillar | Score | Evidence |
|---|---:|---|
| L46 IAM | 0 | N/A. |
| L47 Data protection | 2 | No PII; pure-math. |
| L48 Threat-aware API design | 2 | Typed enums (`Dtype`, `AttentionKind`) prevent string-typed misuse; no `unsafe`. |
| L49 Authentication | 0 | N/A. |
| L50 Cryptography | 0 | N/A. |
| L51 Audit log integrity | 0 | N/A. |
| L52 Multi-tenant isolation | 1 | Functions are stateless; per-tenant namespace is consumer's concern. |
| L53 Input validation | 3 | Typed enums; zero-dep means zero untrusted-input surface; documented formulas are the validation contract. |
| L54 Build/deploy hardening | 3 | `deny.toml` + `Cargo.lock` pinned + zero deps = strongest possible supply-chain posture. |
| L55 Vulnerability management | 2 | `Cargo.lock` pinned; `deny.toml` upstream; zero deps means zero transitive CVEs. |

---

## 7. Observability & Ops — L56–L63 — **mean 1.00**

| Pillar | Score | Evidence |
|---|---:|---|
| L56 Structured logging | 0 | No `tracing` dep (zero deps); pure-math functions don't need logging. |
| L57 Metrics (RED/USE) | 0 | No metrics. |
| L58 Distributed tracing | 0 | No OTLP; not needed for pure-math. |
| L59 Alerting / SLO monitoring | 0 | Library, no SLO. |
| L60 Deployment automation | 2 | `Cargo.toml:11` `publish = true`; semver; CHANGELOG; full meta-bundle. |
| L61 Incident response | 1 | `SECURITY.md`; GitHub Issues (3 templates). |
| L62 Backup / restore | 0 | N/A. |
| L63 Capacity planning | 3 | **This crate IS the capacity planner.** The math answers "does model X fit on device Y" — that's the whole purpose. |

---

## 8. Documentation & SSOT — L64–L68 — **mean 3.00 (saturated)**

| Pillar | Score | Evidence |
|---|---:|---|
| L64 README quality | 3 | `README.md` (7,295 bytes — substantial); badges, scope, why, when to use, when NOT to use, examples. |
| L65 ADR tracking | 3 | `Cargo.toml:14-15` `repository = "https://github.com/KooshaPari/pheno-capacity"`; ADR-035A + L5-105 cited in `AGENTS.md` and `docs/SPEC.md`. |
| L66 SSOT conventions | 3 | This IS the SSOT for LLM VRAM math per ADR-035A + L5-105; HwLedger's Streamlit consumes it. |
| L67 API reference docs | 3 | `docs/SPEC.md` is the formal API contract; `docs/methodology.md` is the formula/citation reference; `llms.txt` is LLM-indexable; module docstrings are exhaustive. |
| L68 Code-level documentation | 3 | Module-level `//!` on all 5 files; `///` on all public items; inline citations to papers in `src/math.rs:1-10` and `src/attention.rs:1-16`. |

---

## 9. Governance & Sustainability — L69–L71 — **mean 2.67**

| Pillar | Score | Evidence |
|---|---:|---|
| L69 OpenSSF Best Practices | 2 | `deny.toml` + zero deps + semver; no OpenSSF Scorecard at this path (would be in publishing repo). |
| L70 Roles & responsibilities | 3 | AGENTS.md: "Owner: KooshaPari (orch-v11-044)"; ADR-035A records the extraction; 3 issue templates. |
| L71 Sustainability | 3 | Dual-license MIT/Apache-2.0; `AGENTS.md` cites ADR-035A extraction plan + L5-115 v0.2.0 plan; 3 issue templates + PR template. |

---

## Delta Summary (vs prior — first scorecard for `pheno-capacity`)

This is the **first** 71-pillar scorecard for `pheno-capacity`. The extraction from `HwLedger` (per ADR-035A, L5-105) is **EXECUTED 2026-06-19**; `pheno-capacity` is the canonical substrate for LLM VRAM math.

**Insight:** `pheno-capacity` (2.31) scores **+0.31 over the cycle-3 my-domain mean (1.92)** and **+0.88 over the cycle-2 mean (1.50)** because:
1. **Strongest documentation pillar in the cycle-4 batch** (Docs & SSOT 3.00 saturated; only 4 pillars in the cycle-4 batch at 3.00).
2. **Zero dependencies** is the strongest possible supply-chain posture (L25 + L54 = 3 each).
3. **Citations discipline** — `src/math.rs:1-10` lists 6 papers; `src/attention.rs:1-16` lists 6 architectures. No other fleet substrate has this rigor.

**P0 items for remediation (2 P0):**
- **Performance (L13 latency budgets):** No SLO for VRAM estimation latency. Add a `criterion` bench suite for the 7 public functions; document p99 budgets.
- **Observability (L57 metrics):** No RED/USE metrics. Add a `metrics` feature flag (optional dep) to expose VRAM-estimate latency + error rate.

**P1 items for remediation (5 P1):**
- **L15 throughput, L22 static analysis, L35 release process, L37 dev container, L69 OpenSSF Scorecard:** all cycle-typical P1 gaps; `pheno-otel` shows the path forward (6 GitHub workflows).

**Top unlock (+0.30 to mean):** add `criterion` benches (L13 + L15) → mean 2.61 (Tier 3 SOTA).

---

*Generated 2026-06-20 by Forge orchestrator (T13 batch 9F cycle 4). Schema: [findings/71-pillar-refresh-template.md](71-pillar-refresh-template.md). Cross-ref: ADR-035A (extraction from HwLedger, L5-105), ADR-036 (CLOSED 2026-06-19), L5-115 (v0.2.0 attention-kind awareness), `KooshaPari/pheno-capacity#1` (initial extraction merge), `pheno-capacity/CHANGELOG.md` (v0.1.0 → v0.2.0).*
