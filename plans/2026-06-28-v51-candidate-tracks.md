# v51 — Candidate tracks

**Date:** 2026-06-28
**Branch:** `chore/v48-dag-wave-6-2026-06-27`
**Status:** DRAFT — pending user directive

## Candidates

| # | Track | Priority | Detail |
|---|-------|----------|--------|
| T1 | Merge `pheno-context#1` (oidc module PR) | P0 | PR #1 on KooshaPari/pheno-context — needs merge |
| T2 | ADR-095 T9 — full `Reloadable<T>` integration tests | P1 | Spin up file watcher, SIGHUP sequence, concurrent readers |
| T3 | Registry update (pheno-runtime-config + pheno-context) | P2 | Add registry rows for both repos, update disposition-index.json |
| T4 | Meta-bundle push to 15 pheno-* repos | P2 | Ship AGENTS.md + llms.txt + WORKLOG.md + CHANGELOG.md + LICENSE-MIT to each |
| T5 | §8 Router architecture (ADR-050/051/052) | P1 | First implementation step — bootstrap `phenotype-router` repo |
| T6 | 71-pillar L29 SBOM diff | P2 | Integration test for cargo audit + SBOM diff |
| T7 | 71-pillar L39 CLI flag discipline | P2 | Deny.toml `--deny warnings` for all CLI crates |
| T8 | 71-pillar L45 perf regression alert | P2 | Criterion benchmark threshold in CI |

## Refs
- v50 plan: `plans/2026-06-28-v50-adr095-t0-execution.md`
- cycle-37 probe: `findings/2026-06-28-71-pillar-cycle-37-probe.md`
- ADR-095: `docs/adr/2026-06-23/ADR-095-pheno-context-canonical.md`
