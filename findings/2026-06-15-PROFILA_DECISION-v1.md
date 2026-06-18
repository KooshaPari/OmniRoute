# Profila Decision — 2026-06-15

**Date:** 2026-06-15
**Lane:** L5 (Architecture)
**Wave:** v6
**Subagent:** C (subagent-C-profila-result.md) — model timeout; orchestrator audit substituted

## Executive summary

Profila is a 1,287-LoC Python+Bash toolkit. **Consolidate into new `pheno-profiling` Python crate.** Net change: -187 production LoC, +300 test LoC, +Rust pprof-rs bridge.

## Profila structure

| Component | Count | LoC |
|---|---:|---:|
| Python scripts (complexity_analyzer, continuous_profiler, generate_charts, system_metrics) | 4 | 475 |
| Bash scripts (profiler.sh, all_metrics.sh, disk/network/full_system_audit, build_for_profiling, profiler_setup) | 7 | 812 |
| Rust source | 0 | 0 |
| Library code | 0 | 0 |
| Tests | 0 | 0 |
| **Total** | **11** | **1,287** |

## Overlaps with existing canonical libraries

| Profila component | Canonical replacement | Action |
|---|---|---|
| Hand-rolled complexity scanner | `thegent/governance/scanner.py` (uses `radon`) | Replace with `radon` |
| Performance library | `ObservabilityKit/python/performance_kit` | Library + CLI pattern (complement, not duplicate) |
| Cost analysis | `pheno-cost-card` (cost domain) | Different domain |
| OTel integration | `pheno-otel` (OTel domain) | Different domain |

## Proposed crate: `pheno-profiling`

- **Language:** Python 3.12+
- **Build:** `uv_build`
- **Scope:**
  - complexity analyzer (radon-backed)
  - continuous profiler
  - system metrics collection
  - audit scripts (disk/network/full system)
  - Click CLI
  - chart generation
  - pprof-rs bridge for Rust workloads (polyglot)

## PR sequencing (12 PRs, ~1,400 LoC including 300 tests)

1. **PR-1** — scaffold `pheno-profiling/` with `uv_build`
2. **PR-2** — complexity analyzer (radon-backed)
3. **PR-3** — continuous profiler
4. **PR-4** — system metrics collection
5. **PR-5** — audit scripts (disk/network/full system)
6. **PR-6** — Click CLI
7. **PR-7** — pprof-rs Rust bridge
8. **PR-8** — tests (80% coverage target)
9. **PR-9** — CI workflow
10. **PR-10** — polyglot parity test
11. **PR-11** — Profila `ARCHIVED.md` + README redirect
12. **PR-12** — Archive Profila on GitHub (admin action)

## Net LoC

- Production: 1,287 → 1,100 (-187 LoC, -15%)
- Tests: 0 → 300 (+300 LoC, new)
- Rust bridge: 0 → ~150 (+150 LoC, new)
- **Net: +263 LoC** but with Rust polyglot coverage and proper test ratio

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Profila archive breaks CI that depends on `bin/profiler.sh` | Medium | High | Audit consumers first; port scripts to `pheno-profiling` CLI before archive |

## Evidence

- `worklogs/L5-099-PROFILA-v6-2026-06-15.json`
- `findings/2026-06-15-DAG-V6-FINAL-v1.md` (section 3)
- `/tmp/subagent-C-profila-result.md`
