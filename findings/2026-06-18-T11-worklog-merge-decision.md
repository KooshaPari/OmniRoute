# Worklog format split — `pheno-worklog-schema` vs `AgilePlus` worklogs (Decision B)

**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**Decision version:** v1.0 (BOTH STAY, no merge this sweep)
**Refs:**
- ADR-032 (worklog format split)
- AGENTS.md § "Decision B"
- `findings/2026-06-17-L5-107-worklog-merge-decision.md`

---

## Investigation findings (L5-107)

### `pheno-worklog-schema` (Python lib)

| Property | Value |
|---|---|
| Location | `pheno-worklog-schema/` (local monorepo) |
| Language | Python |
| Format | Markdown table: `Date \| Task ID \| Layer \| Action \| Files \| Notes` |
| Schema version | v2.0 (per ADR-015) → v2.1 (per ADR-025, adds `device:` column) |
| Consumers | Local monorepo governance (`findings/`, `docs/adr/`, `plans/`) |
| Tests | Per v0.1.0: parse + validate worklog markdown; ensure columns are present |
| Use case | **Human-readable worklog**, AI-agent context loading |

### `AgilePlus` worklogs

| Property | Value |
|---|---|
| Location | `AgilePlus/worklog-L*-*-*.json` (machine-readable JSONL) |
| Language | n/a (JSON output) |
| Format | JSONL with fields: `date`, `task_id`, `layer`, `action`, `files`, `notes`, `branch`, `commit_sha` |
| Schema version | Custom (no shared schema with pheno-worklog-schema) |
| Consumers | CI audit trail, programmatic query, automated reporting |
| Tests | n/a (just data) |
| Use case | **Machine-readable worklog**, CI tooling, batch queries |

## Decision: BOTH STAY, complementary, not duplicating

The two formats serve different audiences:

| Audience | Format | Why |
|---|---|---|
| Humans reading the repo | Markdown (`pheno-worklog-schema`) | Easy to skim, git-diff friendly, runs in any viewer |
| CI tools, dashboards, automated audit | JSONL (AgilePlus) | Streamable, schema-validated, queryable |

They are **complementary, not duplicating**. Merging them into one format would lose the readability of markdown OR the queryability of JSONL.

## Counter-arguments considered

1. **"One source of truth is better"** — agreed in principle, but the cost of converting markdown ↔ JSONL is non-zero and lossy. A single schema would either be markdown-like (loses JSONL benefits) or JSONL-like (loses markdown benefits). The hybrid (markdown is source, JSONL is generated) is the right answer.

2. **"We could have a generator that emits both from a single source"** — yes, but this is a separate design session (T20 in v8 plan). For now, the two formats coexist with documented differences.

3. **"Markdown is harder to parse than JSONL"** — true, but `pheno-worklog-schema` is a Python lib that handles the parsing. Consumers don't write parsers.

## Future work (T20, separate design session)

If the user wants a unified format:

1. Define a single canonical schema (JSONL superset of markdown fields)
2. Author a generator: markdown → JSONL OR JSONL → markdown
3. Migrate `pheno-worklog-schema` to consume the unified format
4. Migrate `AgilePlus` to emit the unified format
5. Deprecate one of the two (or keep both as views of the same data)

This is **not done in v8**. Both stay in their current state.

## Cross-references

- AGENTS.md § "Decision B"
- ADR-032 (worklog format split)
- ADR-015 v2.0 (10-column markdown schema)
- ADR-025 v2.1 (11-column markdown schema with `device:` field)
