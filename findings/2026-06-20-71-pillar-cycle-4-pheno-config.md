# 71-Pillar Weekly Cycle 4 — pheno-config (Figment Cascade Substrate)

**Date:** 2026-06-20 (Saturday)
**Cycle:** 4 (T13 batch 9F, last early-cadence cycle)
**Trigger:** v12-08 figment layered provider cascade (`e97df2f25f feat(pheno-config): figment layered provider cascade (v12-08)`) + ADR-022 config consolidation + cycle 4 plan reference. The local `pheno-config/` path is a **leaf thin shim** that re-exports the canonical `Configra/crates/pheno-config/` (ADR-031).
**Scorer:** Forge orchestrator (single-track subagent)
**Schema:** [findings/71-pillar-refresh-template.md](71-pillar-refresh-template.md) (L1-L71, 9 domains, 0-3 scale, N/A=3 for inapplicable).
**Prior cycles:** [findings/2026-06-20-71-pillar-cycle-3-my-domain.md](2026-06-20-71-pillar-cycle-3-my-domain.md) (Eidolon + agent-platform + mobile-mcp + mobile-cli), [findings/71-pillar-2026-06-20-71-pillar-cycle-4-Configra.md](2026-06-20-71-pillar-cycle-4-Configra.md) (canonical sibling).

---

## Aggregate

| Metric | Value |
|---|---|
| **Mean (all 71)** | **1.31 / 3** |
| **Pass (>=2.00)** | **NO** |
| **Domains ≥2.00** | **1/9** |
| **P0 gaps** | **9** |
| **P1 gaps** | **6** |

**Tier (ADR-023 + ADR-040):** **Tier 0 (in-repo leaf, not a substrate)** — this `pheno-config/` path is a **local mirror of the canonical `Configra/crates/pheno-config/` sub-crate**, not a standalone package. The "scores" measure the path as it exists in the monorepo today; the canonical score is in [2026-06-20-71-pillar-cycle-4-Configra.md](2026-06-20-71-pillar-cycle-4-Configra.md) (mean 2.06). This is a path-level audit, not a package-level audit.

---

## 1. Architecture (AX) — L1–L12 — **mean 1.25**

| Pillar | Score | Evidence |
|---|---:|---|
| L1 Module structure | 1 | `pheno-config/src/cascade.rs` (92 LOC) + `pheno-config/tests/cascade_test.rs` (108 LOC) only. No `Cargo.toml` (the path has no `[package]` table; it is a path-mirror of the canonical crate, not a buildable package). |
| L2 Bounded contexts | 1 | Single concern (cascade ordering), but no module separation; `cascade.rs` is one file. |
| L3 API design | 1 | `build_cascade()` returns `Figment`; `DEFAULT_TOML` is a public const string. No typed `Config` struct at this path (the typed struct lives in the canonical `Configra/crates/pheno-config/src/lib.rs`). |
| L4 Hexagonal ports-and-adapters | 1 | Cascade is a *provider chain* (not a hexagonal port). `Figment` is the framework; no `Port` trait. |
| L5 Dependency direction | 1 | Depends on `figment = "0.10"` (visible from `use figment::...`); no path-dep to Configra (this is a leaf mirror). |
| L6 Cloud readiness | 1 | Pure Rust cascade; no cloud-specific code. |
| L7 Threat modeling | 2 | Env-prefix collision with `PHENO_` namespace is documented (`pheno-config/src/cascade.rs:7-11`); figment library handles parse errors. |
| L8 Inter-service contracts | 0 | No formal API spec at this path. |
| L9 Backward compatibility | 1 | Single function; no API versioning concerns; canonical version pinned in `Configra/Cargo.toml:13` (`version = "0.4.0"`). |
| L10 Loose coupling | 1 | `Figment` is the only dep; `cascade` is a pure function. |
| L11 Portability | 2 | Pure Rust; works anywhere `figment` works. |
| L12 Service mesh / gateway | 0 | N/A; leaf library. |

---

## 2. Performance — L13–L19 — **mean 1.14**

| Pillar | Score | Evidence |
|---|---:|---|
| L13 Latency budgets | 0 | No SLO; no benchmark at this path. |
| L14 Resource efficiency | 0 | No resource caps; not relevant for a leaf mirror. |
| L15 Throughput | 0 | No benchmarks; no `benches/` dir. |
| L16 Scalability | 1 | `Figment::merge` is `O(n)`; cascade is 4 providers. |
| L17 Cold start | 1 | `Figment` is lazy; cascade resolves on first `find_value` call. |
| L18 Concurrency model | 2 | `Figment` is `Send + Sync`; `cascade` is a pure fn. |
| L19 Cost awareness | 0 | No cost tracking. |

---

## 3. Quality / Correctness — L20–L27 — **mean 2.13**

| Pillar | Score | Evidence |
|---|---:|---|
| L20 Acceptance criteria | 2 | `cascade_test.rs` is the acceptance contract: it asserts the priority order `env > toml > default` (per its module docstring) and the Jetbrains layer is omitted in the test helper to avoid dev-machine leakage. |
| L21 Code review rigor | 1 | Conventional commits enforced (visible in `e97df2f25f feat(pheno-config): figment layered provider cascade (v12-08)`); no PR template at this path. |
| L22 Static analysis | 0 | No `deny.toml`; no `clippy.toml`; no CI at this path. (The CI lives at the publishing-repo level.) |
| L23 Coding standards | 1 | Module docstrings are excellent (`//!` style); implicit Rust style. |
| L24 Error handling | 2 | `Figment::find_value` returns `Result`; cascade propagates parse errors via `figment::Error`. |
| L25 Supply-chain integrity | 0 | No `Cargo.lock`; no `deny.toml`; `figment` dep is from upstream crate. |
| L26 Reliability / fault tolerance | 2 | Missing config file is non-fatal (per `pheno-config/src/cascade.rs:10-11`); defaults always present. |
| L27 Test architecture | 3 | 108-LOC integration test in `tests/cascade_test.rs`; inlines `DEFAULT_TOML` to avoid coupling; 1 test file. |

---

## 4. Developer Experience (DX) — L28–L37 — **mean 0.90**

| Pillar | Score | Evidence |
|---|---:|---|
| L28 Build system | 1 | No `Cargo.toml`; the path is a leaf mirror (not buildable standalone); the canonical crate is at `Configra/crates/pheno-config/`. |
| L29 CI/CD pipeline | 0 | No `.github/workflows/` at this path. |
| L30 Dev environment setup | 0 | No `rust-toolchain.toml`; no `.devcontainer/`. |
| L31 Local development loop | 1 | `cargo test --test cascade_test` would work if the path were a package; not currently buildable in this layout. |
| L32 Debug ergonomics | 2 | `Figment` errors carry provider chain context; module docstring documents cascade order. |
| L33 Hot reload | 0 | No hot-reload; library, not a server. |
| L34 Onboarding time-to-first-PR | 1 | Module docstring explains the cascade order, but no AGENTS.md / README.md at this path. |
| L35 Release process | 0 | No release process at this path. |
| L36 Contribution friction | 0 | No CONTRIBUTING.md. |
| L37 Dev container / nix flake | 0 | Neither. |

---

## 5. User Experience (UX) — L38–L45 — **mean 1.00 (NA-counted)**

| Pillar | Score | Evidence |
|---|---:|---|
| L38 Learnability | 2 | Excellent module-level `//!` docstring (`pheno-config/src/cascade.rs:1-25`) explains cascade priority + merge order. |
| L39 Operability | 0 | N/A at this path. |
| L40 i18n / localization | N/A (3) | Library, no UI. |
| L41 a11y / WCAG | N/A (3) | Library, no UI. |
| L42 Error messages | 1 | `Figment::Error` is a structured error with provider chain context; no in-repo error message catalog. |
| L43 User feedback loops | 0 | GitHub issues only. |
| L44 Documentation discoverability | 1 | The path is discoverable only if a contributor knows about ADR-031. |
| L45 First-run experience | 0 | No quickstart at this path. |

---

## 6. Security — L46–L55 — **mean 1.30**

| Pillar | Score | Evidence |
|---|---:|---|
| L46 IAM | 0 | N/A. |
| L47 Data protection | 1 | `PHENO_` env-prefix namespace is intentional; no PII. |
| L48 Threat-aware API design | 2 | Env-prefix collision risk documented; figment library handles malformed input. |
| L49 Authentication | 0 | N/A. |
| L50 Cryptography | 0 | N/A. |
| L51 Audit log integrity | 0 | No audit log. |
| L52 Multi-tenant isolation | 1 | Cascade applies per-process; multi-tenant is consumer's concern. |
| L53 Input validation | 2 | `Toml::file` validates TOML syntax; `Env::prefixed` validates env var names; `Jetbrains::default()` validates XML. |
| L54 Build/deploy hardening | 0 | No SBOM, no deny.toml at this path. |
| L55 Vulnerability management | 0 | No Dependabot; no `cargo audit` at this path. |

---

## 7. Observability & Ops — L56–L63 — **mean 0.75**

| Pillar | Score | Evidence |
|---|---:|---|
| L56 Structured logging | 0 | No `tracing` dep at this path. |
| L57 Metrics (RED/USE) | 0 | No metrics. |
| L58 Distributed tracing | 0 | No OTLP. |
| L59 Alerting / SLO monitoring | 0 | No SLO. |
| L60 Deployment automation | 1 | `git push` to a branch was the v12-08 deploy (commit `e97df2f25f`); no release workflow at this path. |
| L61 Incident response | 0 | No runbook. |
| L62 Backup / restore | 0 | N/A. |
| L63 Capacity planning | 0 | No capacity model. |

---

## 8. Documentation & SSOT — L64–L68 — **mean 1.60**

| Pillar | Score | Evidence |
|---|---:|---|
| L64 README quality | 0 | No README.md at this path. |
| L65 ADR tracking | 2 | ADR-022 (config split), ADR-031 (Configra absorb) referenced indirectly via `e97df2f25f feat(pheno-config): figment layered provider cascade (v12-08)` commit message. |
| L66 SSOT conventions | 2 | This path is a **mirror** of the SSOT (`Configra/crates/pheno-config/`); the SSOT enforcement is downstream. |
| L67 API reference docs | 0 | No API docs at this path. |
| L68 Code-level documentation | 3 | Excellent module docstring on `pheno-config/src/cascade.rs:1-25` (priority order + merge semantics) and on `pheno-config/tests/cascade_test.rs:1-10` (priority proof). |

---

## 9. Governance & Sustainability — L69–L71 — **mean 0.67**

| Pillar | Score | Evidence |
|---|---:|---|
| L69 OpenSSF Best Practices | 0 | No scorecard; no SBOM at this path. |
| L70 Roles & responsibilities | 0 | No CODEOWNERS at this path. |
| L71 Sustainability | 2 | This path is explicitly a **leaf mirror** of the canonical `Configra/crates/pheno-config/`; no maintenance burden expected (per ADR-031 absorb plan). |

---

## Delta Summary

This is the **first** 71-pillar scorecard for the local `pheno-config/` path. It is intentionally a **path-level** audit, not a package-level audit:

- The canonical `pheno-config` Rust crate lives at `Configra/crates/pheno-config/` (per ADR-031 + L5-110).
- The local `pheno-config/` path is a **WIP preservation shim** that landed in commit `e97df2f25f feat(pheno-config): figment layered provider cascade (v12-08)` (2026-06-20 18:42 PDT) and is expected to be deprecated after the Configra absorb PR lands.

**P0 items for remediation (mean < 2.00 — 9 items):**
- **Architecture (L1, L2, L3, L4, L5, L8, L9, L10, L12):** the path is a leaf mirror with no `Cargo.toml`. Either (a) add `Cargo.toml` + `lib.rs` to make it a buildable sub-crate, or (b) document the path as a preserve-WIP shim and remove after the canonical is verified.
- **DX (L28, L29, L30, L33, L35, L36, L37):** no build system, no CI, no dev container. Mirror inherits none of these.
- **Security (L46, L49, L50, L51, L54, L55):** all N/A at this path; enforcement lives in canonical.
- **Observability (L56-L63):** all missing; canonical `pheno-tracing` covers it.
- **Governance (L69, L70):** missing; enforcement lives in canonical.

**Top unlock (+0.40 to mean):** Add `Cargo.toml` + `lib.rs` re-exporting `Configra::crates::pheno_config::*` → mean ~1.71 (still Tier 0, but path becomes buildable).

---

*Generated 2026-06-20 by Forge orchestrator (T13 batch 9F cycle 4). Schema: [findings/71-pillar-refresh-template.md](71-pillar-refresh-template.md). Cross-ref: ADR-022 (config split), ADR-031 (Configra absorb), ADR-032 (worklog-schema decision), `e97df2f25f feat(pheno-config): figment layered provider cascade (v12-08)`, [findings/2026-06-20-71-pillar-cycle-4-Configra.md](2026-06-20-71-pillar-cycle-4-Configra.md) (canonical sibling scorecard).*
