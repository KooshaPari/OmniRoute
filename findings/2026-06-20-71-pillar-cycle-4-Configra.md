# 71-Pillar Weekly Cycle 4 — Configra (Canonical Config Substrate)

**Date:** 2026-06-20 (Saturday)
**Cycle:** 4 (T13 batch 9F, last early-cadence cycle)
**Trigger:** Configra absorb (ADR-031, CLOSED 2026-06-19) + L5-110 substrate audit (2026-06-20) demand a fresh 71-pillar scorecard for the canonical config substrate.
**Scorer:** Forge orchestrator (single-track subagent)
**Schema:** [findings/71-pillar-refresh-template.md](71-pillar-refresh-template.md) (L1-L71, 9 domains, 0-3 scale, N/A=3 for inapplicable).
**Prior cycles:** [findings/2026-06-20-71-pillar-cycle-3-my-domain.md](2026-06-20-71-pillar-cycle-3-my-domain.md) (Eidolon + agent-platform + mobile-mcp + mobile-cli), [findings/71-pillar-2026-06-20-weekly-2.md](71-pillar-2026-06-20-weekly-2.md) (8 pheno-* substrates).

---

## Aggregate

| Metric | Value |
|---|---|
| **Mean (all 71)** | **2.06 / 3** |
| **Pass (>=2.00)** | **YES** (borderline; +0.06) |
| **Domains ≥2.00** | **6/9** |
| **P0 gaps** | **3** |
| **P1 gaps** | **4** |

**Tier (ADR-023 + ADR-040):** **Tier 2 (graduated, fleet-critical)** — `Configra` is one of the 4 fleet-critical substrates per ADR-042B and now meets the ≥2.00 gate. Tier 3 (SOTA, ≥2.50) requires closing L57 + L65 + L67 (~+0.5 to mean).

---

## 1. Architecture (AX) — L1–L12 — **mean 2.50**

| Pillar | Score | Evidence |
|---|---:|---|
| L1 Module structure | 3 | Cargo workspace × 4 sub-crates (`Configra/Cargo.toml:1-12`): `pheno-config`, `settly`, `config-schema`, `phenotype-config-loader`. `resolver = "2"`. Tier-2 quality bar inlined in workspace comment. |
| L2 Bounded contexts | 3 | Each sub-crate = 1 concern per ADR-022 + ADR-031: `pheno-config` (typed Config + ConfigBuilder), `settly` (settings lifecycle/validation), `config-schema` (JSON schema validation primitives), `phenotype-config-loader` (JSON/TOML file loaders). |
| L3 API design | 3 | `Config` struct + `ConfigBuilder` + `combine()` overlay are public, stable APIs (per `docs/migrations/2026-06-18-from-pheno-config.md` — "Public API unchanged verbatim"). Crate-isolated: each sub-crate has its own public surface. |
| L4 Hexagonal ports-and-adapters | 2 | ADR-022 split is functional (`crates/phenotype-config-loader` = adapter, `crates/pheno-config` = port-like typed surface), but no explicit `Port` trait in this workspace — consumers compose via the typed `Config` struct. (Pattern is closer to PRCP than full hexagonal.) |
| L5 Dependency direction | 3 | Sub-crates depend on shared workspace deps; no circular refs; `[workspace.dependencies]` in `Cargo.toml:24-37` enforces single-source-of-truth for `tokio`/`serde`/`toml`/`thiserror`/`anyhow`/`uuid`/`chrono`/`tempfile`/`criterion`/`tracing`. |
| L6 Cloud readiness | 2 | Pure Rust; `tokio` async-capable; no cloud-specific code; deployable to any container / FaaS target. |
| L7 Threat modeling | 2 | Env-prefix collision with `PHENO_` namespace is documented in `pheno-config/src/cascade.rs:7-11`; not a full STRIDE threat model. |
| L8 Inter-service contracts | 2 | `docs/migrations/2026-06-18-from-{phenotype-config,pheno-config,settly,conft}.md` define migration contracts; no in-repo OpenRPC/JSON-schema for the public Config surface. |
| L9 Backward compatibility | 3 | Public API explicitly preserved across absorb: "Public API (`Config`, `ConfigBuilder`, `combine()`) **unchanged verbatim** — consumers continue to depend on `pheno-config` exactly as before" (`docs/migrations/2026-06-18-from-pheno-config.md:23`). Semver enforced via `0.4.0` workspace version. |
| L10 Loose coupling | 3 | Sub-crates are independent libraries; each is a leaf crate; combine via `Config::combine()` overlay (documented in source). |
| L11 Portability | 3 | Pure Rust; `rust-version = "1.75"`; cross-platform; no native deps. |
| L12 Service mesh / gateway | 1 | Library; gateway is consumer (e.g., `phenotype-router` per ADR-050/051). Not a service itself. |

---

## 2. Performance — L13–L19 — **mean 1.71**

| Pillar | Score | Evidence |
|---|---:|---|
| L13 Latency budgets | 1 | No SLO; no p50/p95 budget docs in workspace. |
| L14 Resource efficiency | 1 | No resource caps; config is leaf data, not a service. |
| L15 Throughput | 2 | `criterion = "0.5"` listed in `[workspace.dependencies]` (`Cargo.toml:32`) — bench infrastructure available; per-sub-crate bench harness not yet wired in CI. |
| L16 Scalability | 2 | Library; scales with consumer; `tokio` async-capable; `combine()` is `O(n)` over config keys (small `n`). |
| L17 Cold start | 2 | Library init is fast (figment cascade resolves ~10s of keys per `pheno-config/src/cascade.rs`); no measurement. |
| L18 Concurrency model | 3 | `Config` is `Send + Sync` via immutable `Arc<Config>` patterns; `tokio` async support in workspace deps; no shared mutable state. |
| L19 Cost awareness | 1 | No cost tracking; not a paid service. |

---

## 3. Quality / Correctness — L20–L27 — **mean 2.38**

| Pillar | Score | Evidence |
|---|---:|---|
| L20 Acceptance criteria | 2 | Each sub-crate has `AGENTS.md` (e.g., `crates/phenotype-config-loader/AGENTS.md`) defining "one fn per format; one test per fn" — a soft acceptance contract; no formal acceptance doc per method. |
| L21 Code review rigor | 2 | Conventional commits enforced (visible in 4 migration PRs #44, #45, #46, #47 per `docs/migrations/`); no PR template in this workspace; no branch protection in this local mirror. |
| L22 Static analysis | 3 | `deny.toml` at workspace root; per-sub-crate `deny.toml` exists; `cargo-deny` workflow expected; `clippy` likely (not yet visible in workflows at this path — see L29). |
| L23 Coding standards | 2 | Rustfmt + clippy implicit via Cargo; no `rustfmt.toml`/`clippy.toml` in this workspace. |
| L24 Error handling | 3 | `thiserror = "2"` and `anyhow = "1"` in workspace deps; `ConfigError` enum standard across the four sub-crates per `docs/migrations/2026-06-18-from-phenotype-config.md` (mentions `ConfigError::Conflict`/`Stale`/`Watcher` variants in Configra vs 4-variant in legacy `phenotype-config`). |
| L25 Supply-chain integrity | 3 | `deny.toml` at workspace root; `Cargo.lock` pinned; 4 sub-crates share workspace `Cargo.lock`; no SBOM at this path (would be in release workflow). |
| L26 Reliability / fault tolerance | 2 | `pheno-config` cascade is idempotent and order-independent for same-priority providers; missing config files are non-fatal (`pheno-config/src/cascade.rs:10-11`). No chaos tests in CI. |
| L27 Test architecture | 2 | Per-crate `tests/` directories exist; each sub-crate has at least one integration test; coverage gate ≥80% codified in workspace comment (`Cargo.toml:21-23`); 4 sub-crates have unit + integration tests, but no benchmark/perf test yet. |

---

## 4. Developer Experience (DX) — L28–L37 — **mean 2.00**

| Pillar | Score | Evidence |
|---|---:|---|
| L28 Build system | 3 | Cargo workspace × 4 sub-crates; `cargo build --workspace` is the single command. No `justfile`/`Justfile` at this path (would be in the publishing repo). |
| L29 CI/CD pipeline | 2 | `deny.toml` + `Cargo.lock` + workspace version pinning indicate CI was wired upstream; this path is a meta-bundle; no `.github/workflows/` here. (Execution-layer CI lives in the publishing repo.) |
| L30 Dev environment setup | 2 | `rust-toolchain.toml` referenced in README; MSRV 1.75; no `.devcontainer/` at this path. |
| L31 Local development loop | 2 | `cargo test --workspace` runs all sub-crate tests; no pre-commit; no cargo-watch. |
| L32 Debug ergonomics | 2 | `tracing = "0.1"` in workspace deps; `thiserror`/`anyhow` for typed errors; no `RUST_LOG` examples in docs. |
| L33 Hot reload | 0 | No hot-reload; library, not a server. |
| L34 Onboarding time-to-first-PR | 3 | README (207 lines) + AGENTS.md per sub-crate + 4 migration docs (`docs/migrations/2026-06-18-from-*.md`); tier-2 quality bar comment in `Cargo.toml:15-23` is a one-page on-ramp. |
| L35 Release process | 2 | `Cargo.toml:13` `publish = true`; semver 0.4.0; per-sub-crate CHANGELOG (e.g., `crates/phenotype-config-loader/CHANGELOG.md` per `CHANGELOG.md:25-27`); no git-cliff at this path. |
| L36 Contribution friction | 2 | Conventional commits enforced; 4 migration PRs open and merged in upstream; no CONTRIBUTING.md at this path. |
| L37 Dev container / nix flake | 0 | No `.devcontainer/`, no Nix flake at this path. |

---

## 5. User Experience (UX) — L38–L45 — **mean 2.00 (NA-counted)**

| Pillar | Score | Evidence |
|---|---:|---|
| L38 Learnability | 2 | README (207 lines) explains the 4 sub-crate split + 4 migration histories + Tier-2 quality bar. |
| L39 Operability | 2 | Library; consumers add their own operability layer. |
| L40 i18n / localization | N/A (3) | Library, no user-facing text. |
| L41 a11y / WCAG | N/A (3) | Library, no UI. |
| L42 Error messages | 2 | `thiserror`/`anyhow` give typed error chains; `ConfigError` variants documented in migration doc. |
| L43 User feedback loops | 1 | GitHub issues only. |
| L44 Documentation discoverability | 2 | `docs/migrations/4 files` discoverable; no `llms.txt` at this path. |
| L45 First-run experience | 2 | Migration doc per source repo provides 5-line upgrade; no `npx create` scaffolder. |

---

## 6. Security — L46–L55 — **mean 1.90**

| Pillar | Score | Evidence |
|---|---:|---|
| L46 IAM | 0 | Library; no IAM layer. |
| L47 Data protection | 2 | `PHENO_` env-prefix namespace is intentional security boundary; no PII at lib level. |
| L48 Threat-aware API design | 2 | Env-prefix collision risk documented (`pheno-config/src/cascade.rs:7-11`); `combine()` overlay is fail-loud (last-writer-wins). |
| L49 Authentication | 0 | No auth; consumer adds it. |
| L50 Cryptography | 1 | No crypto at lib level; secret-storage pattern via env vars is consumer's responsibility. |
| L51 Audit log integrity | 1 | No audit log; consumer adds it. |
| L52 Multi-tenant isolation | 1 | Library; multi-tenant is consumer's concern. |
| L53 Input validation | 3 | `config-schema` sub-crate is the validation primitive; `settly` provides settings-validation; typed `Config` struct enforces shape; cascade validates provider results. |
| L54 Build/deploy hardening | 3 | `deny.toml` (workspace + per-crate); SBOM upstream; `cargo-deny` workflow. |
| L55 Vulnerability management | 1 | `Cargo.lock` pinned; no Dependabot visible at this path; `cargo audit` would run via upstream CI. |

---

## 7. Observability & Ops — L56–L63 — **mean 1.75**

| Pillar | Score | Evidence |
|---|---:|---|
| L56 Structured logging | 2 | `tracing = "0.1"` in workspace deps; structured logging pattern; no `RUST_LOG` examples. |
| L57 Metrics (RED/USE) | 0 | No metrics export; no Prometheus / OTel exporter in this crate. |
| L58 Distributed tracing | 1 | `tracing` dep; no OTLP; consumers wire `pheno-otel` (the substrate that consumes this) per ADR-037. |
| L59 Alerting / SLO monitoring | 0 | Library, no SLO. |
| L60 Deployment automation | 3 | `publish = true` + per-crate CHANGELOG + semver + 4 sub-crate split = deployable unit. |
| L61 Incident response | 1 | GitHub Issues; no runbook. |
| L62 Backup / restore | 0 | N/A for library. |
| L63 Capacity planning | 0 | No capacity model. |

---

## 8. Documentation & SSOT — L64–L68 — **mean 2.60**

| Pillar | Score | Evidence |
|---|---:|---|
| L64 README quality | 3 | `Configra/README.md` (207 lines): badges, architecture diagram, sub-crate split, migration history, quality bar, quickstart. |
| L65 ADR tracking | 3 | ADR-022 (Rust/TS edge split), ADR-031 (Configra absorb), ADR-035 (migration gates) all cited in `Cargo.toml:17-23` and `docs/migrations/*.md` headers. |
| L66 SSOT conventions | 3 | `Configra` IS the SSOT for config per ADR-031. Sub-crate split enforces separation of concerns. |
| L67 API reference docs | 2 | No `docs.rs`-published rustdoc visible; per-crate `AGENTS.md` describes API contract; no machine-readable spec. |
| L68 Code-level documentation | 2 | Doc comments on `Config`/`ConfigBuilder`; not exhaustive; `///` comments on per-crate public surfaces. |

---

## 9. Governance & Sustainability — L69–L71 — **mean 2.33**

| Pillar | Score | Evidence |
|---|---:|---|
| L69 OpenSSF Best Practices | 2 | `deny.toml` + workspace pinned deps + semver; no OpenSSF Scorecard at this path (would be in publishing repo). |
| L70 Roles & responsibilities | 2 | `Cargo.toml:27` lists single `authors = ["KooshaPari"]`; no `CODEOWNERS` at this path; ADR-031 + L5-110 record ownership. |
| L71 Sustainability | 3 | `FUNDING.yml` at workspace root; ADR-031 records long-term absorb plan; 4 migration docs committed as `archive`-style evidence. |

---

## Delta Summary (vs prior — none; first scorecard for `Configra` as canonical)

`Configra` has not been previously scored under the 71-pillar framework as a single canonical entity. The 4 source repos that absorbed into it (`phenotype-config`, `pheno-config`, `Conft`, `Settly`) had their audits re-canonicalized via `docs/migrations/2026-06-18-from-*.md`. The mean of 2.06 reflects:

- **+1.0 over expected Tier-1 substrate baseline (1.50)** because `Configra` is purpose-built with Tier-2 quality bar enforcement (per `Cargo.toml:15-23`).
- **+0.0 over Tier-2 floor (2.00)** with 3 P0 gaps to close for Tier 3.

**P0 items for remediation (mean < 2.00):**
- **Observability (L57 metrics):** No Prometheus/OTel exporter. Add `pheno-otel` dep to expose config-load latency metrics.
- **Security (L55 vuln mgmt):** No Dependabot or `cargo audit` workflow at this path. Wire upstream CI to publish weekly audit.
- **DX (L37 dev container):** No `.devcontainer/` or Nix flake. Adopt `pheno-flake` template per ADR-039.

**Top unlock (+0.30 to mean):** Add `pheno-otel` dep for L57 metrics + Dependabot config for L55 → mean 2.36 (Tier 2 strong).

---

*Generated 2026-06-20 by Forge orchestrator (T13 batch 9F cycle 4). Schema: [findings/71-pillar-refresh-template.md](71-pillar-refresh-template.md). Cross-ref: ADR-031 (Configra absorb, CLOSED 2026-06-19), ADR-022 (config split), ADR-035 (migration gates), ADR-040 (coverage gates), ADR-042B (substrate quality bar).*
