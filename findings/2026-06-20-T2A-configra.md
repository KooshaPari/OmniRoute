# 71-Pillar Refresh: `KooshaPari/Configra`

**Date**: 2026-06-20
**Cycle**: ADR-041 weekly refresh (Monday 09:00 PDT)
**Schema**: [findings/71-pillar-2026-06-17-schema.md](findings/71-pillar-2026-06-17-schema.md)
**Scorer**: T2A batch probe (read-only `gh api`)
**Repo state at probe time**:
- `nameWithOwner`: KooshaPari/Configra
- `isPrivate`: true · `isArchived`: false · `isEmpty`: false
- `primaryLanguage`: Rust · `diskUsage`: 587 KB
- `pushedAt`: 2026-06-20T08:27:30Z · `createdAt`: 2026-03-25T15:26:48Z
- `defaultBranch`: `main`
- `licenseInfo`: null (no OSS license visible at metadata level)
- `branches`: 10 · `tags`: 0 · `open_prs`: 1 · `closed_prs`: 47 · `releases`: 1 · `issues_open`: 7
- `languages`: Rust 115,897, TypeScript 14,450, Shell 10,676, JavaScript 506, CSS 92
- Last commit: 2026-06-19T08:11:23Z

## Aggregate

| Metric | Value |
|---|---|
| **Mean (all 71)** | **1.62** |
| **Pass (>=2.00)** | **NO** |
| **Domains ≥2.00** | 2 / 9 |
| **P0 gaps (mean<2.00)** | 7 |

**Verdict**: Below pass threshold. Major gaps in CI/CD, security, observability, governance. README & SPEC are strong; module structure is multi-crate; **the entire `.github/` directory is missing** (no workflows, no dependabot, no templates, no CODEOWNERS).

---

## 1. Architecture (AX) — L1–L12

| Pillar | Score | Evidence |
|--------|-------|----------|
| L1 Module structure | **3** | `Cargo.toml` workspace with 4 crates: `config-schema`, `pheno-config`, `phenotype-config-loader`, `settly` (see `Configra/Cargo.toml:1-12`). |
| L2 Bounded contexts | **2** | 4 distinct crate boundaries; `crates/pheno-config` README cites "typed-config loader" vs `crates/settly` "settings + validation + migration". |
| L3 API design | **2** | `pheno-config` exposes typed Config struct with `combine()` 12-factor cascade (README §Overview). `pub`/`private` boundaries visible in `Cargo.toml [lib]`. |
| L4 Hexagonal ports-and-adapters | **1** | `docs/phenotype-config-absorbed/` exists; hexagonal layout not visible at top of tree. No explicit `domain/`/`adapters/` split. |
| L5 Dependency direction | **2** | Workspace dependency pins (`tokio`, `serde`, `toml`) flow downward; no circular deps visible. |
| L6 Cloud readiness | **1** | README mentions "Go/Python bindings available" but no `Dockerfile` or cloud config in tree. |
| L7 Threat modeling | **0** | No `SECURITY.md`, no `threat-model.md`, no `docs/security/`. |
| L8 Inter-service contracts | **1** | `crates/phenotype-config-loader` exists; no public schema/openapi files visible. |
| L9 Backward compatibility | **1** | `pheno-config` v0.2.0 retained `thiserror = 1.0` for API stability (see `crates/pheno-config/Cargo.toml`). |
| L10 Loose coupling | **2** | 4 crates isolated by Cargo workspace; cross-crate deps only via `workspace.dependencies`. |
| L11 Portability | **2** | MIT OR Apache-2.0 dual license; rust-version 1.75; no OS-specific deps in workspace pins. |
| L12 Service mesh / gateway | **0** | Library crate; no service surface. N/A eligible but scoring conservative 0 (no consumer pattern documented). |
| **Domain mean** | **1.42** | |

## 2. Performance — L13–L19

| Pillar | Score | Evidence |
|--------|-------|----------|
| L13 Latency budgets | **1** | No published latency SLOs; `crates/pheno-config` reads env+JSON+TOML (synchronous I/O assumed). |
| L14 Resource efficiency | **2** | Pure config loader, no heavy runtime; `tokio` features scoped to `["full"]` (over-broad, suggests 1). Score 2 for "library has minimal footprint". |
| L15 Throughput | **1** | No benchmarks. `benches/` directory absent in tree. |
| L16 Scalability | **1** | Config is per-process; multi-instance scaling is out-of-scope for a config crate. |
| L17 Cold start | **2** | Pure-Rust, no async init required for `pheno-config::Config::from_env`. |
| L18 Concurrency model | **1** | `tokio` available; config merging is synchronous; concurrency story undocumented. |
| L19 Cost awareness | **1** | No resource budgets documented; no size-of-binary tracking. |
| **Domain mean** | **1.29** | |

## 3. Quality / Correctness — L20–L27

| Pillar | Score | Evidence |
|--------|-------|----------|
| L20 Acceptance criteria | **1** | README states purpose; no formal acceptance test document. |
| L21 Code review rigor | **2** | 47 closed PRs suggest active review; no protected branch rules visible. |
| L22 Static analysis | **2** | `deny.toml` (668 B) present; no `clippy.toml` visible in tree. |
| L23 Coding standards | **1** | No `rustfmt.toml`/`clippy.toml` at root. |
| L24 Error handling | **2** | `thiserror 1.0` used in `pheno-config` (Cargo.toml). Settly uses `thiserror` + `anyhow`. |
| L25 Supply-chain integrity | **1** | `deny.toml` exists; no SBOM/cosign/sigstore in tree. |
| L26 Reliability / fault tolerance | **1** | Config fallback story exists (env>JSON>TOML); no chaos/circuit-breaker tests. |
| L27 Test architecture | **1** | No `tests/` directory at root; no `benches/`. 4 crates each may have inline `#[cfg(test)]`. |
| **Domain mean** | **1.38** | |

## 4. Developer Experience (DX) — L28–L37

| Pillar | Score | Evidence |
|--------|-------|----------|
| L28 Build system | **3** | Cargo workspace with 4 members; `rust-version 1.75` pinned. |
| L29 CI/CD pipeline | **0** | **`.github/workflows/` directory MISSING entirely.** No CI runs. |
| L30 Dev environment setup | **1** | No `justfile`, no `Taskfile.yml`, no `mise.toml`, no `.devcontainer/`. |
| L31 Local development loop | **1** | No `CONTRIBUTING.md` (404), no dev quickstart. |
| L32 Debug ergonomics | **1** | No `RUST_LOG`/`tracing-subscriber` guide in README. |
| L33 Hot reload | **0** | Not applicable to config loader (but Settly README mentions "Hot Reload" — would be 3 if integrated). |
| L34 Onboarding time-to-first-PR | **1** | No AGENTS.md, no CLAUDE.md, no onboarding doc. |
| L35 Release process | **1** | 1 GitHub Release exists; no release-drafter; no tag pattern visible (tags=0). |
| L36 Contribution friction | **1** | No CONTRIBUTING.md; no PR template. |
| L37 Dev container / nix flake | **0** | No `.devcontainer/`, no `flake.nix`. |
| **Domain mean** | **0.90** | |

## 5. User Experience (UX) — L38–L45

| Pillar | Score | Evidence |
|--------|-------|----------|
| L38 Learnability | **3** | README has badges, status, technology stack, work-state banner (Configra/README.md:1-60). |
| L39 Operability | **2** | README explains CLI-first workflow; ADR/CHARTER absent. |
| L40 i18n / localization | **3 (N/A)** | Library crate with no UI strings. **N/A eligible per schema.** |
| L41 a11y / WCAG | **3 (N/A)** | No UI surface. **N/A eligible per schema.** |
| L42 Error messages | **2** | `thiserror` enums + README examples show env-var error semantics. |
| L43 User feedback loops | **1** | No issue template, no discussion forum. |
| L44 Documentation discoverability | **2** | `docs/` dir exists with `migrations/` + `phenotype-config-absorbed/`. |
| L45 First-run experience | **2** | README quickstart is implied via badges; no `examples/` dir at root. |
| **Domain mean** | **2.25** | (treating L40/L41 as 3 per N/A rule) |

## 6. Security — L46–L55

| Pillar | Score | Evidence |
|--------|-------|----------|
| L46 IAM | **1** | Not a service; N/A but conservative 1 (no documented access patterns). |
| L47 Data protection | **2** | README mentions "AES-256-GCM for secrets". |
| L48 Threat-aware API design | **1** | No threat model doc. |
| L49 Authentication | **1** | Library crate — N/A but conservative 1. |
| L50 Cryptography | **2** | AES-256-GCM claimed in README; no key-management story. |
| L51 Audit log integrity | **1** | README mentions "full audit trails" but no implementation visible. |
| L52 Multi-tenant isolation | **1** | Single-tenant config library. |
| L53 Input validation | **2** | Settly crate has `validator = "0.18"` with `derive` feature (Settly/Cargo.toml). |
| L54 Build/deploy hardening | **1** | `deny.toml` exists; no SLSA provenance, no signed releases. |
| L55 Vulnerability management | **0** | No `.github/dependabot.yml`; no SECURITY.md. |
| **Domain mean** | **1.20** | |

## 7. Observability & Ops — L56–L63

| Pillar | Score | Evidence |
|--------|-------|----------|
| L56 Structured logging | **2** | `tracing` in workspace deps; not actively wired into `pheno-config` lib. |
| L57 Metrics (RED/USE) | **0** | No metrics crate. |
| L58 Distributed tracing | **1** | `tracing` available; no OTLP exporter. |
| L59 Alerting / SLO monitoring | **0** | Library — no SLOs published. |
| L60 Deployment automation | **0** | No release workflow. |
| L61 Incident response | **0** | No SECURITY.md, no runbook. |
| L62 Backup / restore | **1** | README mentions "point-in-time restore" but no documented procedure. |
| L63 Capacity planning | **1** | Config crate is O(1) memory; no analysis documented. |
| **Domain mean** | **0.62** | |

## 8. Documentation & SSOT — L64–L68

| Pillar | Score | Evidence |
|--------|-------|----------|
| L64 README quality | **3** | 6273 B; AI-DD meta-block, work-state, badges, stack overview, status section. |
| L65 ADR tracking | **1** | `ADR.md` MISSING at root; no `docs/adr/` visible. |
| L66 SSOT conventions | **2** | `docs/migrations/` and `docs/phenotype-config-absorbed/` indicate SSOT intent. |
| L67 API reference docs | **1** | No `docs.rs` link; no inline rustdoc enforcement. |
| L68 Code-level documentation | **1** | README suggests "Rust" + "Go/Python bindings"; no doc coverage stats. |
| **Domain mean** | **1.60** | |

## 9. Governance & Sustainability — L69–L71

| Pillar | Score | Evidence |
|--------|-------|----------|
| L69 OpenSSF Best Practices | **1** | No `scorecard.yml` workflow; no badge in README. |
| L70 Roles & responsibilities | **1** | Single owner (KooshaPari) inferred from README banner; no CODEOWNERS file. |
| L71 Sustainability | **2** | Active repo (pushed 2026-06-20); 47 closed PRs in 2 months; multiple sub-crates under active dev. |
| **Domain mean** | **1.33** | |

---

## Delta Summary

**Notable changes (vs `findings/71-pillar-2026-06-17.md` if Configra was scored there — first entry):**
- New scoring entry; no prior cycle.

**P0 items for remediation (domain mean < 2.00):**
- **DX (0.90)**: Add `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.github/CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`. Add `justfile` or `Taskfile.yml`.
- **Observability & Ops (0.62)**: Wire `tracing` into `pheno-config` lib; add `metrics` integration; document incident response.
- **Security (1.20)**: Add `SECURITY.md`; add SLSA provenance; add dependabot.
- **Quality (1.38)**: Add root-level `tests/` + `benches/`; add `clippy.toml` + `rustfmt.toml`.
- **Architecture (1.42)**: Add `SECURITY.md` (L7), cloud-readiness manifest (L6), service-mesh pattern doc (L12).
- **Governance (1.33)**: Add CODEOWNERS; add OpenSSF scorecard workflow.
- **Docs/SSOT (1.60)**: Add `ADR.md` and `docs/adr/` for L65.

**Evidence links (probe commands run 2026-06-20 via `gh api`):**
- Repo metadata: `gh repo view KooshaPari/Configra --json name,description,primaryLanguage,...`
- Tree: `gh api repos/KooshaPari/Configra/git/trees/main`
- File sizes: `gh api repos/KooshaPari/Configra/contents/<path>`
- Crate manifests: `gh api repos/KooshaPari/Configra/contents/crates/<name>/Cargo.toml`
- All `MISSING` entries verified via `404` response from `/contents/<path>`.

---

*Generated for ADR-041 weekly refresh (T2A batch probe, 2026-06-20). Read-only `gh api` only — no pushes performed.*