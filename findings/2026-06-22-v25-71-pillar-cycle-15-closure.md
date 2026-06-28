# v25 Cycle-15 Closure Log

**Date:** 2026-06-22 18:18 PDT
**Branch:** `chore/v25-71-pillar-cycle-15-p1-2026-06-22`
**Status:** Cycle 15 (v25) P1 reduction — 6/7 tracks shipped, 1 BLOCKED with disposition

## Tracks Executed

| Track | Pillar | Commit | Status |
|-------|--------|--------|--------|
| T1 | L51 SOC2 evidence automation | `da2bacdd2a` | ✅ DONE — SOC2 collector + runbook + CI gate |
| T2 | L46-L55 security P1 deepening | `b96fbfa91c` | ✅ DONE — ADR-093 SIEM integration, stage 72 governance |
| T3 | L31 perf regression detection | `ae2c1d75d8` | ⚠️ BLOCKED — pheno-context crate structure mismatch (separate finding) |
| T4 | L26 coverage gate | `a2189c06ca` | ✅ DONE — cargo-llvm-cov 80% threshold CI gate |
| T5 | L28 doc-test runner | `a8fb4cd88e` | ✅ DONE — doc-test CI + pheno-port-adapter example |
| T6 | L60 ADR quality linter | `722a0e67bb` | ✅ DONE — ADR lint + convention doc |
| T7 | L42 per-crate proptest CI | `ea86658aed` | ✅ DONE — proptest.yml matrix + 2 new proptests |

**6 of 7 tracks shipped.** T3 deferred to v26/v27 with disposition (see BLOCKED finding).

## PRs Touched

- **`KooshaPari/phenotype-apps#147`** (OPEN) — T4+T5+T6+T7 stacked on `chore/v25-71-pillar-cycle-15-p1-2026-06-22`
- T1, T2 pushed to separate branches/PRs from prior session

## Governance Artifacts Shipped

| Path | Type | Purpose |
|------|------|---------|
| `findings/2026-06-22-forge-db-lock-cascade.md` | Finding | forge.db SQLite lock investigation |
| `findings/2026-06-22-v25-T3-BLOCKED.md` | Finding | T3 halt-on-failure disposition |
| `findings/2026-06-22-71-pillar-cycle-15-probe.md` | Finding | Cycle-15 pre-execution probe |
| `findings/2026-06-22-v14-pr-review.md` | Finding | v14 cycle-4 fleet-wide PR review (30 PRs) |
| `findings/2026-06-22-dependabot-triage.md` | Finding | 10 dependabot alerts / 3 manifest fixes |
| `docs/adr/2026-06-22/ADR-094-no-process-termination.md` | ADR | Never kill agent/forge/codex/claude/cursor-agent/ghostty |
| `docs/adr/2026-06-22/ADR-093-siem-integration.md` | ADR | SIEM integration (L46-L55 deepening) |
| `docs/conventions/adr-writing.md` | Convention | T6 lint convention |
| `tools/adr-lint/adr_lint.py` | Tool | T6 linter (78 lines) |
| `.github/workflows/proptest.yml` | Workflow | T7 proptest matrix (5 crates) |
| `pheno-port-adapter/tests/proptest_smoke.rs` | Test | T7 proptest 1/2 |
| `pheno-otel/tests/proptest_smoke.rs` | Test | T7 proptest 2/2 |
| `.github/workflows/doc-test.yml` | Workflow | T5 doc-test CI |
| `.github/workflows/coverage-gate.yml` | Workflow | T4 coverage gate |
| `pheno-port-adapter/src/lib.rs` | Doc-test | T5 example |
| AGENTS.md | Doc | v25 wave plan reference + cycle progression table |

## Score Card (per `findings/2026-06-22-71-pillar-cycle-15-probe.md`)

| Pillar | v24 | v25 | Δ | Notes |
|--------|-----|-----|---|-------|
| L26 (coverage gate) | 1 | 3 | +2 | cargo-llvm-cov 80% enforced |
| L28 (doc-tests) | 1 | 3 | +2 | CI matrix runner + example |
| L42 (proptests) | 1 | 2 | +1 | 2 new proptests; CI matrix live |
| L60 (ADR quality) | 2 | 3 | +1 | Linter + convention doc |
| L46-L55 (security P1) | 2 | 3 | +1 | SIEM integration per ADR-093 |
| L51 (SOC2 evidence) | 2 | 3 | +1 | Automated collector + runbook |
| L31 (perf regression) | 1 | 1 | 0 | BLOCKED (T3) — deferred to v26 |
| **Mean** | **2.71** | **2.86** | **+0.15** | |

## Issues / PRs / Processes

- **Issue #146 filed** on `KooshaPari/phenotype-apps` — forge: DB lock cascade when dispatching 2+ subagents in parallel
- **PR #147 OPEN** — T4/T5/T6/T7 stacked
- **PR #142 OPEN** — T1 SOC2 evidence
- **PR #144 OPEN** — T7 (T2 SIEM ADR)
- **0 merge-blocked** by DB lock (issue #146 surfaces the underlying problem)

## Next Batch (v26 candidates)

1. **L31 perf regression detection** — pick up T3 with proper pheno-context canonical location decision (ADR-095)
2. **L29 SBOM diff** — CycloneDX per-release diff
3. **L39 CLI flag discipline** — clap-ext adoption in remaining bare-clap repos
4. **L45 perf regression alert** — bench history tracking
5. **Issue #146 fix** — coordinate with forge maintainer for `PRAGMA busy_timeout = 30000` in shared DB
6. **HITL review of PR #147** — once CI green, merge to land T4/T5/T6/T7 in main

## Lesson Learned

**DB lock cascade** (issue #146): parallel subagent dispatch can cause SQLite lock contention in the shared forge DB. Resolution per ADR-094: do NOT kill processes; instead debug, file issue, fix at the right layer. Orchestrator-side workaround: sequential dispatch with 5-10s spacing.
