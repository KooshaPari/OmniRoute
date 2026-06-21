# Audit: argis-extensions

**Date:** 2026-04-24 | **Repos:** argis-extensions | **Auditor:** Claude  
**LOC:** 37K | **Primary Languages:** Go, Rust, Node | **Status:** SCAFFOLD

## 10-Dimensional Scorecard

| Dimension | Status | Notes |
|-----------|--------|-------|
| **Build** | BROKEN | Go/Rust/Node compilation attempted; Kogito schema fixes recent; build state unclear |
| **Tests** | SCAFFOLD | 32 test files; but Kogito fix commits suggest recent breakage |
| **CI/CD** | SHIPPED | 7 workflows; legacy-enforcement gate present; coverage setup incomplete |
| **Docs** | SHIPPED | 34 doc files; README + SPEC present; architecture guides |
| **Arch Debt** | BROKEN | Kogito integration (Drools-based workflow engine); non-standard Phenotype pattern |
| **FR Traceability** | MISSING | No FUNCTIONAL_REQUIREMENTS.md; SPEC.md exists but Kogito schema complexity hidden |
| **Velocity** | SHIPPED | Recent: Kogito compilation fixes (dbc9cd7, 2e5acec); active maintenance |
| **Governance** | SHIPPED | AgilePlus scaffolding; CI gates; template-commons reuse |
| **Dependencies** | BROKEN | Kogito depends on external schema/resolver ecosystem; vendor lock-in risk |
| **Honest Gaps** | BROKEN | Kogito schema/resolver incompatibilities; recent fixes suggest ongoing instability |

## Key Findings

**Use Case:** BPMN2 workflow extensions + Argis integration (Drools-based process execution).

**Recent Breakage:** Two identical commits (dbc9cd7, 8d89dcf) "Kogito compilation fixes - schemas, resolvers, graceful degradation" suggest recent build instability.

**Arch Risk:** Kogito (Red Hat Drools) is JVM-based; heavy dependency on external schema specifications; not core to Phenotype ecosystem.

**Test Gap:** 32 tests exist but build failures suggest they're not running in CI.

## Consolidation Verdict

**ARCHIVE** or **EXTRACT → phenotype-process-kit**

- **If Kogito is strategic:** Extract BPMN2 abstraction to `phenotype-process-kit`; decouple from Argis
- **If exploratory:** Move to `.archive/argis-extensions`; keep Kogito learnings in docs
- **Rationale:** Kogito is a heavyweight dependency with low adoption in Phenotype ecosystem; worth keeping only if BPMN2 is critical path
- **Current status:** Broken builds + unclear product intent = not ready for external consumption

## Recommendations

1. **Triage Kogito crisis:** Determine if schema/resolver breaks are fixable in 1-2h or require redesign
2. **Add FUNCTIONAL_REQUIREMENTS.md:** Clarify workflow extension spec + acceptance criteria
3. **Decision:** Keep (if strategic) → fix + document; or Archive (if exploratory)
4. **If keeping:** Isolate Kogito to `pkg/workflow/kogito` subdirectory; add graceful fallback
