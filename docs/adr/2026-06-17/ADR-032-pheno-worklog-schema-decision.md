# ADR-032: pheno-worklog-schema is NOT a re-implementation of AgilePlus worklog

**Status:** ACCEPTED
**Date:** 2026-06-17
**Author:** orchestrator (claude opus 4.7)
**L5-104.8** — Phase 3 T20
**Refs:**
- SSOT.md row "Worklog schema canonical" (this ADR upgrades that row)
- AGENTS.md § "pheno-worklog-schema" (new subsection, this turn)
- findings/2026-06-17-L5-104-8-worklog-schema-decision.md

---

## Context

User flagged: "pheno worklog also seems like you are reimplementing agileplus, unless this is a subcomponent/primitive lib?"

Investigation of the two schemas (T20):

| Aspect | pheno-worklog-schema | AgilePlus worklog |
|---|---|---|
| Format | Markdown table (GitHub-renderable) | JSONL audit files |
| Columns | 6: Date, Task ID, Layer, Action, Files, Notes | Free-form per-entry (project-specific) |
| Author | KOOSHA / Claude | KOOSHA / agileplus team |
| Audience | Cross-repo governance view | AgilePlus project history |
| Validation | Strict (date regex, layer enum, status enum, ID regex) | None (raw JSON) |
| Output | JSONL, stats, search | Git diff over time |
| Versioning | v2.0 / v2.1 (with device:) | No version concept |
| Library | Python package (`pheno_worklog_schema`) | None (raw files) |
| First seen | 2026-06-17 | 2026-05-13 |

## Decision

**pheno-worklog-schema is a primitive library, NOT a re-implementation of AgilePlus worklog.**

### Substantive differences

1. **Different format**: Markdown table vs JSONL
2. **Different audience**: Cross-repo governance view (used by AGENTS.md, 71-pillar audit, fleet-wide v2.1 migration) vs AgilePlus project history (used only inside AgilePlus repo)
3. **Different validation**: Strict typed schema with versioning vs raw JSON
4. **Different evolution**: Schema migrates (v2.0 → v2.1) and ships as Python package vs AgilePlus worklog evolves via Git history
5. **Different consumers**: pheno-worklog-schema is consumed by `phenotype-org-audits`, `findings/`, governance tooling, and 12+ pheno-* repos. AgilePlus worklog is only consumed inside AgilePlus itself.

### Layer model (per ADR-023 substrate taxonomy)

| Repo | Substrate type | Concern |
|---|---|---|
| `pheno-worklog-schema` | `pheno-*-lib` (primitive) | Generic worklog schema + validation |
| `AgilePlus` | federated app | AgilePlus-specific audit log |

### When to use which

- **New repos, governance PRs, fleet-wide audit**: use `pheno-worklog-schema` (Markdown table with `device:` per v2.1)
- **AgilePlus-only project history**: use existing AgilePlus JSONL format (no change)
- **Both can coexist**: a single repo can have a Markdown `WORKLOG.md` (pheno-worklog-schema v2.1) AND its own JSONL audit log if it needs one

## Consequence

- Both repos coexist; no consolidation, no deprecation
- AGENTS.md gets a new subsection clarifying the difference
- SSOT.md row 5 "Worklog schema canonical" is updated to point to this ADR
- New repos default to pheno-worklog-schema v2.1; AgilePlus is grandfathered in its existing format

## Notes

- The user asked a smart question — the names are similar and could plausibly be duplicates. The substantive differences (format, audience, validation, evolution) prove they aren't.
- pheno-worklog-schema v2.1's `device:` column (ADR-015) is what tracks "where the work was actually done" (heavy-runner vs macbook vs subagent vs ci) — a cross-repo concern AgilePlus JSONL doesn't model.
