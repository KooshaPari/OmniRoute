# Worklog consumer probe (T11.2 + T11.3)

**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**Refs:**
- ADR-032 (worklog format split)
- `findings/2026-06-18-T11-worklog-merge-decision.md` (BOTH STAY decision)

---

## T11.2: Worklog file count

| Format | File pattern | Count | Repos (top 5 by count) |
|---|---|---|---|
| Markdown | `WORKLOG.md` (pheno-worklog-schema) | **40** | Parpoura, pheno-otel, Tokn, crates/pheno-tracing, agentapi-plusplus |
| JSONL | `worklog-L*-*.json` (AgilePlus) | **75** | nanovms (~50), FocalPoint, pheno-cargo-template, AgilePlus, ... |

**Total: 115 worklog files across 35+ repos.** The JSONL format is more prevalent (75 vs 40) but both formats coexist.

## T11.3: Worklog consumer count

A "consumer" is any code or config file that *reads* a worklog (not just contains one).

| Probe | Result | Interpretation |
|---|---|---|
| `grep -rln "worklog-L.*\.json" --include="*.py,*.md,*.json,*.toml,*.yml" .` (excluding worklog files themselves) | **0 files** | No source code or config in this monorepo reads AgilePlus worklogs |
| `grep -rln "pheno.worklog.schema\|pheno_worklog_schema" .` (Python lib consumers) | 0 files | No source code imports `pheno-worklog-schema` lib directly |

**Interpretation: Worklogs are LEAVES, not internal nodes.** They are generated/authored and stored, but nothing in the monorepo reads them programmatically. The "consumer" relationship is external (humans reading, or CI tools reading in a separate process).

## Implication for ADR-032 BOTH STAY decision

The decision "BOTH STAY" is now **strongly supported** by T11.3 evidence:
- Markdown worklogs serve humans reading the repo (skim, git-diff, viewer-friendly)
- JSONL worklogs serve external CI tools, dashboards, audit queries

Since neither format is consumed by in-repo code, the merge cost would be:
- Define a unified format (lossy either direction)
- Write a converter
- Migrate all 115 files
- Deprecate one

**Cost** of merge: ~3-5 hours of work, ~6 PRs, risk of losing human/AI readability.
**Benefit** of merge: marginal (since neither format is consumed in-repo).

**Verdict:** the cost-benefit ratio strongly favors keeping BOTH formats. The BOTH STAY decision is confirmed.

## Cross-references

- `findings/2026-06-18-T11-worklog-merge-decision.md` (decision)
- ADR-032 (worklog format split)
- ADR-015 v2.0 (10-column markdown schema)
- ADR-025 v2.1 (11-column markdown schema with `device:` field)
