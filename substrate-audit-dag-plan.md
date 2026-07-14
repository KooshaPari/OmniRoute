# Substrate Audit Remediation: omniroute-rust

## Score Summary

| Metric | Value |
|---|---|
| **Total Pillars** | 140 |
| **Satisfied** | 30 (21.4%) |
| **Partial** | 25 (17.9%) |
| **Missing** | 85 (60.7%) |
| **Score** | 30.4% (D-) |

### Assessment Note

This project is **pre-alpha** (v0.1.0). The code architecture and quality are solid (C+ domains for code quality and architecture), but **everything around the code** — CI/CD, security, documentation, releases, governance, testing infrastructure — is missing. This is typical for a project at this stage and represents a fresh codebase with minimal DevOps scaffolding.

### Target Progression

| Phase | Target Grade | Target Score |
|---|---|---|
| Phase 0 | D+ | 45% |
| Phase 1 | C- | 55% |
| Phase 2 | C | 65% |
| Phase 3 | C+ | 72% |

---

## Phase 0: Hygiene Backbone (Config files, governance docs)

**Target: 45% → Grade D+**
**Est. effort: 14h**

| ID | Task | Effort | Rationale |
|---|---|---|---|
| OR-P0-01 | Create `.github/workflows/ci.yml` with build + test | 2h | CI-01 through CI-05 all missing |
| OR-P0-02 | Create `deny.toml` with license allowlist, bans, advisories | 1h | SC-02/03/04/05 missing |
| OR-P0-03 | Create `SECURITY.md` | 0.5h | SEC-01 missing |
| OR-P0-04 | Create `CONTRIBUTING.md` | 1h | DOC-05 missing |
| OR-P0-05 | Create `CODE_OF_CONDUCT.md` | 0.5h | Governance gap |
| OR-P0-06 | Create `AGENTS.md` with agent constitution | 1h | AR-02 missing |
| OR-P0-07 | Create `CHANGELOG.md` with keep-a-changelog format | 0.5h | DOC-07 missing |
| OR-P0-08 | Add `LICENSE` file to repository (MIT) | 0.5h | DOC-08 partial |
| OR-P0-09 | Create `.editorconfig` with per-language settings | 0.5h | DX-06 missing |
| OR-P0-10 | Create `.gitattributes` | 0.5h | Git hygiene |
| OR-P0-11 | Create `.pre-commit-config.yaml` with clippy + fmt + deny | 1h | SEC-15 missing, DX-04 missing |
| OR-P0-12 | Create `.github/dependabot.yml` for weekly cargo updates | 0.5h | CI-07 missing |
| OR-P0-13 | Create `.github/CODEOWNERS` | 0.5h | CI-13 missing |
| OR-P0-14 | Create issue templates (bug_report, feature_request, config) | 1h | CI-14 missing, DX-11 missing |
| OR-P0-15 | Create PULL_REQUEST_TEMPLATE.md | 0.5h | DX-12 missing |
| OR-P0-16 | Add `Cargo.lock` to committed files (remove from .gitignore) | 0.5h | SC-01 missing: lockfile should be committed |
| OR-P0-17 | Create `.gitleaks.toml` | 0.5h | SEC-03 missing |
| OR-P0-18 | Add `#![deny(missing_docs)]` to all crates | 2h | CQ-06 missing |

---

## Phase 1: Observability + Testing (Tracing, fuzz, coverage, OpenAPI)

**Target: 55% → Grade C-**
**Est. effort: 22h**

| ID | Task | Effort | Rationale |
|---|---|---|---|
| OR-P1-01 | Add `cargo test --workspace` to CI | 0.5h | CI-03 missing |
| OR-P1-02 | Add `cargo clippy -- -D warnings` to CI | 1h | CI-04 missing |
| OR-P1-03 | Add `cargo fmt --check` to CI | 0.5h | CI-05 missing |
| OR-P1-04 | Add `cargo-deny check` to CI | 0.5h | CI-06 missing |
| OR-P1-05 | Create integration test suite in `tests/` | 4h | TEST-02 missing |
| OR-P1-06 | Add property-based tests with proptest | 3h | TEST-03 missing |
| OR-P1-07 | Add fuzz harness for chat request parsing | 2h | TEST-04 missing |
| OR-P1-08 | Add coverage reporting (cargo-llvm-cov) to CI | 1h | TEST-05 missing |
| OR-P1-09 | Implement cargo-nextest for parallel test execution | 1h | TEST-06 missing |
| OR-P1-10 | Add snapshot testing with insta | 2h | TEST-07 missing |
| OR-P1-11 | Add mutation testing with cargo-mutants | 2h | TEST-08 missing |
| OR-P1-12 | Add load test CI bench step (via criterion) | 1h | TEST-09 partial |
| OR-P1-13 | Implement structured logging consistency | 1h | OBS-03 partial |
| OR-P1-14 | Add OTel exporter integration | 2h | OBS-04 missing |
| OR-P1-15 | Add W3C trace context propagation | 1h | OBS-07 missing |
| OR-P1-16 | Add env config documentation for RUST_LOG | 0.5h | OBS-09 missing |

---

## Phase 2: Security + Ops (SBOM, SLSA, Docker, runbook)

**Target: 65% → Grade C**
**Est. effort: 16h**

| ID | Task | Effort | Rationale |
|---|---|---|---|
| OR-P2-01 | Add gitleaks secret scanning workflow | 1h | SEC-04 missing |
| OR-P2-02 | Add cargo-audit CI step | 0.5h | SEC-09 missing |
| OR-P2-03 | Add CycloneDX SBOM generation to build | 1h | SEC-08 missing |
| OR-P2-04 | Add CodeQL workflow | 1h | SEC-07 missing |
| OR-P2-05 | Create threat model document | 2h | SEC-14 missing |
| OR-P2-06 | Create docker-compose for full-stack dev | 1h | CI improvement |
| OR-P2-07 | Add Docker image publish CI (GHCR) | 2h | CI-12 partial, DC-07 partial |
| OR-P2-08 | Create release workflow (tag → build → GitHub Release) | 2h | CI-10 missing |
| OR-P2-09 | Add SLSA provenance to release | 2h | SC-10 missing |
| OR-P2-10 | Create `docs/operations/` with runbook and deploy guide | 2h | DOC-11/12 missing |
| OR-P2-11 | Add rate-limiting middleware | 1h | SEC-12 missing |

---

## Phase 3: Advanced (OTel, dashboards, benchmarks, mut testing)

**Target: 72% → Grade C+**
**Est. effort: 16h**

| ID | Task | Effort | Rationale |
|---|---|---|---|
| OR-P3-01 | Create ARCHITECTURE.md documenting 13-crate workspace | 2h | DOC-04 missing |
| OR-P3-02 | Create ADR directory with initial ADRs | 2h | DOC-06 missing |
| OR-P3-03 | Create SPEC.md with API reference | 2h | DOC-02 missing |
| OR-P3-04 | Set up docs/ directory with framework | 1h | DOC-15 missing |
| OR-P3-05 | Add sccache to CI build | 1h | DX-03 missing |
| OR-P3-06 | Create initial v0.1.0 git tag | 0.5h | RE-01 missing |
| OR-P3-07 | Add conventional commit lint to CI | 1h | CI-08 missing |
| OR-P3-08 | Implement `docs/troubleshooting/known-issues.md` | 1h | DOC-13 missing |
| OR-P3-09 | Complete stub modules (omni-mcp, omni-a2a) | 3h | ARCH partial — MCP/A2A stubbed |
| OR-P3-10 | Add continuous benchmark tracking | 2h | RE improvement |
| OR-P3-11 | Add cost tracking and budget awareness | 2h | AR-07 partial |

---

## Total Estimated Effort

| Phase | Effort | Target Grade |
|---|---|---|
| Phase 0: Hygiene | 14h | D+ (45%) |
| Phase 1: Observability + Testing | 22h | C- (55%) |
| Phase 2: Security + Ops | 16h | C (65%) |
| Phase 3: Advanced | 16h | C+ (72%) |
| **Total** | **68h** | **C+ (72%)** |

## Key Milestones

- **M0 (Current baseline)**: 30.4% D- (pre-alpha — code only)
- **M1 (Phase 0 complete)**: Governance and CI skeleton in place → 45% D+
- **M2 (Phase 1 complete)**: Testing infrastructure and observability → 55% C-
- **M3 (Phase 2 complete)**: Security and release pipeline → 65% C
- **M4 (Phase 3 complete)**: Architecture docs and advanced features → 72% C+
