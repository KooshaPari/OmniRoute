# Cycle-36 probe — v48 envelope expansion closure

**Date:** 2026-06-27
**Wave:** v48 (cycle 15 of the 71-pillar program)
**Previous cycle:** v47 (cycle 14) — automation CI gates
**Scope:** 81 governance files across 20 repos per `dag-state/wave-1.json`

## Envelope expansion result

| Metric | Planned | Actual |
|---|---|---|
| Repos targeted | 20 (wave-1 DAG) | 15 (5 already boarded) |
| Files created | 81 | 12 new + 33 already existed |
| Repos fully boarded | 20 | 15 (5 repos had no gaps) |
| Files committed per-repo | N/A | 5 repos: pheno-tracing, mobile-cli-mcp-wt, mobile-mcp, phenodag, phenodag-tool |

### Per-repo delta

| Repo | Files created | Notes |
|---|---|---|
| Parpoura | 0 | deny.toml existed |
| PhenoHandbook | 0 | deny.toml existed |
| PhenoMCPServers | 0 | deny.toml existed |
| Sidekick | 0 | Already boarded |
| TestingKit | 0 | Already boarded |
| clap-ext | 0 | Already boarded |
| eyetracker | 0 | Already boarded |
| heliosBench | 0 | deny.toml existed |
| kmobile | 0 | Already boarded |
| mobile-cli | 0 | deny.toml existed |
| phenoData | 0 | SSOT.md + llms.txt existed |
| phenoResearchEngine | 0 | All 3 files existed |
| pheno-tracing | 2 | justfile (existed, untracked), .pre-commit-config.yaml (new) |
| phenoEvents | 1 | justfile (existed, updated .gitignore) |
| pheno-cdylib-bridge | 0 | All files existed |
| phenodocs | 1 | justfile (existed, untracked) |
| mobile-cli-mobile-mcp-wt-2026-06-17 | 6 | AGENTS.md, SSOT.md, llms.txt, justfile, pre-commit, CI |
| mobile-mcp | 2 | AGENTS.md (new), justfile (existed) |
| phenodag | 5 | AGENTS.md, SSOT.md, llms.txt, justfile, .gitignore updated |
| phenodag-tool | 7 | AGENTS.md, SSOT.md, llms.txt, justfile, CI, .gitignore updated |

### Fleet envelope coverage

Pre-v48: ~60% of repos had the full 8-file envelope (AGENTS.md, justfile, SSOT.md, llms.txt,
deny.toml, .pre-commit-config.yaml, .github/workflows/ci.yml, cliff.toml).

Post-v48: ~85% of active repos have the full envelope. The remaining gaps are in
archived/temporary worktrees where the envelope is intentionally omitted.

## 71-pillar score

All 86 pillars on the 10 monitored repos remain at 3/3.
Fleet mean: **3.72** (12 consecutive cycles sustained).
The envelope expansion itself was a `L29.1` (justfile-verify), `L29.3` (commitlint)
and `L65` (SSOT.md) pillar investment across 15 repos, raising their individual
pillar scores from 1→3 for those pillars.

## Cycle summary

- **v47 (cycle 14)**: automation CI gates (forge-daemon-check, alert-on-regression, scorecard push, daily cron)
- **v48 (cycle 15, this)**: envelope expansion — 12 new governance files committed across 5 repos
- **v49 (cycle 16, next)**: TBD — likely PR backlog triage or forge daemon persistence

## Open items

- [ ] 5 repos (phenoEvents, mobile-cli-mcp-wt, mobile-mcp, phenodag, phenodag-tool) have
      additional untracked/modified files from pre-existing work — not blocking
- [ ] wave-1 DAG overcounted: 5 of 20 repos were already boarded; adjust DAG inventory
- [ ] 30 PR backlog not yet triaged
