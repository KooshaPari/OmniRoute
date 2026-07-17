<!-- AI-DD-META:START -->
<!-- This repository is planned, maintained, and managed by AI Agents only. -->
<!-- Slop issues are expected and intentionally present as part of an HITL-less -->
<!-- /minimized AI-DD metaproject of learning, refining, and building brute-force -->
<!-- training for both agents and the human operator. -->
![Downloads](https://img.shields.io/github/downloads/KooshaPari/phenotype-org-audits/total?style=flat-square&label=downloads&color=blue)
![GitHub release](https://img.shields.io/github/v/release/KooshaPari/phenotype-org-audits?style=flat-square&label=release)
![License](https://img.shields.io/github/license/KooshaPari/phenotype-org-audits?style=flat-square)
![AI-Slop](https://img.shields.io/badge/AI--DD-Slop%20Expected-orange?style=flat-square)
![AI-Only-Maintained](https://img.shields.io/badge/Planned%20%26%20Maintained%20by-AI%20Agents%20Only-red?style=flat-square)
![HITL-less](https://img.shields.io/badge/HITL--less%20AI--DD-metaproject-yellow?style=flat-square)

> ⚠️ **AI-Agent-Only Repository**
>
> This repo is **planned, maintained, and managed exclusively by AI Agents**.
> Slop issues, rough edges, and AI artifacts are **expected and intentionally
> present** as part of an **HITL-less / minimized AI-DD** metaproject focused
> on learning, refining, and brute-force training both the agents and the
> human operator. Bug reports and contributions are still welcome, but please
> expect AI-generated code, comments, and documentation throughout.
<!-- AI-DD-META:END -->
<!-- SPINE-MISSION:START -->
> **Spine mission:** `phenotype-org-audits` is the **audit/inventory spine** for the
> Phenotype polyrepo. Every cross-repo audit, pillar, finding, and consolidation
> lands here. See `docs/INDEX.md` for the master index of all 165 tracked repos
> and their current audit state. Spine role locked 2026-07-05 in the polyrepo
> portfolio strategy session.
<!-- SPINE-MISSION:END -->

> **Work state:** MAINTENANCE · **Progress:** `██████░░░░ 60%`
> Quarterly org-audit tooling; CI repaired + federatable via workflow_call. · updated 2026-06-02

# phenotype-org-audits

Central inventory and metrics hub for the Phenotype organization. Comprehensive audit-history tracking across **165 unique repositories** (48 local + 94 GitHub-only + 23 local-only), with quarterly refresh baseline and systemic-issue governance.

## Purpose

This repository serves as the canonical archive for:
- **Authoritative inventory** — 165-repo master registry (GitHub + local)
- **Quarterly audits** — Organization-wide scans (LOC, dependencies, complexity, governance adoption)
- **Systemic issues** — Cross-repo duplication, build failures, policy gaps, archived-code salvage opportunities
- **Governance velocity** — Adoption rate of CLAUDE.md, AGENTS.md, AgilePlus integration, test coverage
- **Longitudinal trends** — Drift in LOC, tech stack changes, architectural decisions
- **Coverage metrics** — Test coverage, spec traceability, quality gate compliance

## Structure

```
inventory/                                 # Authoritative repo catalog
├── AUTHORITATIVE_REPO_INVENTORY.md         # 165-repo master registry (GitHub + local)
├── github_remote_inventory.md              # GitHub API snapshot
└── deleted_traces.md                       # Archive salvage candidates (29 archived repos)

metrics/                                   # Quarterly performance baselines
├── COVERAGE_V3.md                          # Test coverage snapshot
├── UPLIFT_REPORT.md                        # Quality improvements over time
└── SYSTEMIC_ISSUES.md                      # Cross-org duplication, gaps, recommendations

audits/<YYYY-MM-DD>/                       # Timestamped audit snapshots
├── INDEX.md                                # Master index for the audit
├── STATUS_AT_<date>.md                     # Complete repo status
├── SYSTEMIC_ISSUES.md                      # Cross-org duplication, governance gaps
├── full_dep_matrix.md                      # Dependency alignment snapshot
├── fr_scaffolding.md                       # Functional requirement traceability
├── governance_adoption.md                  # CLAUDE.md, AGENTS.md, AgilePlus coverage
└── <repo-name>.md                          # Per-repo summary

tooling/
├── aggregator/                             # Audit collection scripts (symlink to phenotype-tooling)
├── inventory-refresh.sh                    # Re-run authoritative inventory agent
└── worklog-aggregator.sh                   # Cross-repo worklog aggregation

CHANGELOG.md                                # Release history with audit entries
```

## Repository Inventory

**TOTAL REPOS TRACKED**: 165 unique repositories

| Category | Count | Details |
|----------|-------|---------|
| Local + GitHub (cloned) | 48 | Active + archived mix |
| GitHub only (not cloned) | 94 | Can be fetched on-demand |
| Local only (no remote) | 12 | Self-contained worktrees |
| Archived on GitHub | 63 | Frozen; salvage candidates mapped |

**Status by Location**:
- ✅ Local + GitHub: 48 repos (primary development)
- 🔗 GitHub only: 94 repos (integrated, not cloned)
- 📦 Local only: 12 repos (internal tools)
- 🗃️ Archived: 63 repos (frozen, 29 have salvage candidates in `inventory/deleted_traces.md`)

See `inventory/AUTHORITATIVE_REPO_INVENTORY.md` for full registry.

## Quarterly Audit Schedule

Audits run automatically via GitHub Actions CI on:
- **Q1**: 1st January, 9am ET
- **Q2**: 1st April, 9am ET
- **Q3**: 1st July, 9am ET
- **Q4**: 1st October, 9am ET

**Cron**: `0 14 1 1,4,7,10 *`

**Refresh Policy**:
- Inventory refreshed: Before each quarterly audit + ad-hoc when new repos detected
- Metrics updated: Each audit run
- Use `tooling/inventory-refresh.sh` to re-run authoritative scan

## Retention Policy

- **Current quarter**: Full detail (all artifacts preserved)
- **Past 4 quarters**: Summary only (INDEX.md + SYSTEMIC_ISSUES.md)
- **Older than 1 year**: Archived to `.archive/` (monthly pruning)

## Metrics Reference

Where to find each metric:

| Metric | Location | Updated | Purpose |
|--------|----------|---------|---------|
| Test coverage | `metrics/COVERAGE_V3.md` | Quarterly | Track coverage baseline across 165 repos |
| Systemic issues | `metrics/SYSTEMIC_ISSUES.md` | Quarterly | Cross-org patterns, gaps, policy violations |
| Quality uplift | `metrics/UPLIFT_REPORT.md` | Quarterly | Improvement trends (LOC reduction, complexity) |
| Dependency alignment | `audits/<YYYY-MM-DD>/full_dep_matrix.md` | Each audit | Version alignment gaps, security advisories |
| Governance adoption | `audits/<YYYY-MM-DD>/governance_adoption.md` | Each audit | CLAUDE.md, AGENTS.md, AgilePlus coverage % |
| FR traceability | `audits/<YYYY-MM-DD>/fr_scaffolding.md` | Each audit | Test-first compliance, spec coverage |

## Governance Integration

- **AgilePlus**: Systemic issues feed `eco-NNN` specs; governance gaps inform policy updates
- **Worklogs**: Cross-project duplication findings → `worklogs/DUPLICATION.md`
- **Test scaffolding**: FR traceability → test-first mandate validation
- **Dependency waves**: Version alignment snapshots → quarterly version-bump waves
- **Archived repos**: Salvage candidates (`inventory/deleted_traces.md`) → extraction planning

## Refresh Inventory (Agent-Driven)

To re-run the authoritative inventory scan:

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-org-audits
./tooling/inventory-refresh.sh
```

This triggers the inventory agent to rescan GitHub + local repos and update:
- `inventory/AUTHORITATIVE_REPO_INVENTORY.md`
- `inventory/github_remote_inventory.md`

## Related

- **Worklog aggregation**: `/Users/kooshapari/CodeProjects/Phenotype/repos/worklogs/`
- **Aggregator tooling**: `/Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-tooling/`
- **Organization docs**: `/Users/kooshapari/CodeProjects/Phenotype/repos/docs/governance/`

## License

MIT — see [LICENSE](./LICENSE).