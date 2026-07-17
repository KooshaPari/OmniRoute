# Audit: PhenoObservability

**Date:** 2026-04-24 | **Repos:** PhenoObservability | **Auditor:** Claude  
**LOC:** 1.05M | **Primary Languages:** Rust | **Status:** SCAFFOLD

## 10-Dimensional Scorecard

| Dimension | Status | Notes |
|-----------|--------|-------|
| **Build** | SHIPPED | Cargo workspace compiles; recent compilation fixes merged (tracingkit, tracely-sentinel) |
| **Tests** | SCAFFOLD | 1 test file only; massive LOC (1.05M) with minimal test coverage is red flag |
| **CI/CD** | SHIPPED | 4 workflows; reusable phenotype workflows integrated; builds passing |
| **Docs** | SCAFFOLD | 8 doc files; minimal API reference; README present but architecture underdocumented |
| **Arch Debt** | SCAFFOLD | Workspace contains multiple precursors (tracingkit, tracely-sentinel); consolidation incomplete |
| **FR Traceability** | MISSING | No FUNCTIONAL_REQUIREMENTS.md; SPEC.md absent |
| **Velocity** | SHIPPED | Recent fixes (compilation errors, nested workspace issues); active maintenance |
| **Governance** | SHIPPED | Reusable workflows, CI gates present; governance scaffold in place |
| **Dependencies** | BROKEN | Nested workspace root error (tracely-sentinel had orphan [workspace]); recently fixed |
| **Honest Gaps** | BROKEN | 1.05M LOC, 1 test file = 99.99% untested; critical for observability (tracing) yet unvalidated |

## Key Findings

**Use Case:** Observability stack (distributed tracing + metrics + logging).

**Red Flags:**
- 1,050,000 LOC with only 1 test file is a critical quality gap
- Recent fix for nested workspace root (ef1d88d) suggests integration issues
- Multiple precursor crates (tracingkit, tracely-sentinel) indicate incomplete consolidation

**Strength:** Active maintenance + CI integration; Rust workspace structure sound.

**Weakness:** For observability (safety-critical domain), 99.99% untested code is unacceptable.

## Consolidation Verdict

**KEEP + IMMEDIATE REMEDIATION** (critical infrastructure)

- **Rationale:** Observability is core to Phenotype ecosystem; cannot merge or archive
- **Immediate action:** Audit test coverage; add 50+ test files to cover tracing/metrics pipeline
- **Risk:** Shipping untested observability = silent failures in production; high priority to fix

## Recommendations

1. **Test coverage audit:** Measure actual coverage with `cargo tarpaulin --workspace`; aim for 80%+ on critical paths
2. **Add core tests:** Focus on tracer init, span recording, metric export pipeline (30-40 tests)
3. **Stabilize dependencies:** Verify nested workspace issue is fully resolved; add CI gate to prevent regression
4. **Documentation:** Add architecture guide + API reference; clarify tracingkit vs tracely naming
5. **Decision on precursors:** Keep tracingkit + tracely-sentinel as separate crates or consolidate? Make explicit
