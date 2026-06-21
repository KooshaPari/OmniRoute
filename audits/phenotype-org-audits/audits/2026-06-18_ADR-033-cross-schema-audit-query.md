# ADR-033: Cross-schema audit query (worklog join between pheno-worklog-schema and AgilePlus)

For querying across the two worklog formats (markdown-table from `pheno-worklog-schema` v2.0/v2.1 and JSONL from `AgilePlus`), the discriminator is the `req_id` prefix (`L5-###` vs `L#-#`); use a JQ-style ad-hoc query rather than a translator service.

**Status:** Accepted
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**Track:** v8 T11 (worklog decision) + T14.4 (governance backlog)
**L8-002** (T11.x + T14.4)

## Context

The fleet maintains two complementary worklog formats (per AGENTS.md **Decision B** + ADR-032):

| Format | Repo | Schema | `req_id` shape | Audience |
|---|---|---|---|---|
| Markdown table | `pheno-worklog-schema` | v2.0 (10 cols) / v2.1 (11 cols, adds `device:`) | `L5-###` (substrate req_id) | human (changelog-style) |
| JSONL | `AgilePlus` | `worklog-L*-*-*.json` | `L#-#` (team-sprint req_id) | machine (audit trail) |

Both formats are deliberately preserved (ADR-032: "pheno-worklog-schema is a primitive lib, NOT a re-implementation of AgilePlus worklog"). However, fleet-wide queries — e.g. "show me every audit-dock that touched Configra across both formats" — need a single query surface. Three options were considered:

1. **Translator service** (`worklog-join-server`) — runs as a federated service, translates both formats into a unified response. Pro: ergonomic. Con: 2nd moving part; replication; slow.
2. **Unified schema** (migrate both to a single format) — Pro: one source of truth. Con: invalidates ADR-032's deliberate split; lossy.
3. **Ad-hoc JQ query** — Pro: zero infra; each format keeps its own identity. Con: every analyst writes their own query.

## Decision

**Use ad-hoc JQ queries with `req_id` prefix as the discriminator.** No translator service; no unified schema.

The discriminator is mechanical:
- `L5-###` (e.g. `L5-102`, `L5-104.5`) → `pheno-worklog-schema` v2.0/v2.1 row (markdown table)
- `L#-#` (e.g. `L7-003`, `L8-014`) → `AgilePlus` `worklog-L*-*-*.json` entry

These prefixes are stable (the `L5-` prefix was introduced when the substrate worklog system was layered on top of the existing AgilePlus-sprint req_ids; see `pheno-worklog-schema/SPEC-v2.1.md` for the v2.1 bump that codified the prefix).

### Query tool: `tools/worklog-cross-query.py`

A 100-line Python script that:
1. Accepts a `req_id` glob on the CLI.
2. Walks both `pheno-worklog-schema/WORKLOG.md` (parses markdown table) and `worklogs/worklog-L*-*-*.json` files (parses JSONL).
3. Returns rows where `req_id` matches the glob.
4. Outputs a unified CSV with a `source_format` column.

```bash
# Example: every L5-### entry (pheno-worklog-schema only)
python tools/worklog-cross-query.py 'L5-*'

# Example: every L8-### entry (AgilePlus only)
python tools/worklog-cross-query.py 'L8-*'

# Example: every L7-### OR L8-### entry
python tools/worklog-cross-query.py 'L[78]-*'

# Example: every entry touching Configra (full-text scan across both)
python tools/worklog-cross-query.py --contains 'Configra'
```

The tool is **authored in v9** (deferred from v8 per the F3 deferred item in v8 Appendix F). Until it ships, the JQ-style ad-hoc query is the documented pattern:

```bash
# JQ-style ad-hoc: pick out every L5-### req_id from a JSONL dump of pheno-worklog-schema
jq -r 'select(.req_id | startswith("L5-"))' < pheno-worklog-schema.dump.jsonl

# Inverse: AgilePlus L#-# req_ids
jq -r 'select(.req_id | test("^L[0-9]+-[0-9]+$")) | select(.req_id | startswith("L5-") | not)' < agileplus.dump.jsonl
```

## Consequences

*Positive:*
- Zero new infra. Both formats stay canonical; ADR-032's deliberate split is preserved.
- The `req_id` prefix is already a load-bearing convention; this ADR makes the convention load-bearing in a second context (audit queries).
- v9's `tools/worklog-cross-query.py` is a 100-line shim, not a service.

*Negative / Risks:*
- Each analyst must know which `req_id` prefix belongs to which format; mitigation: the tool's `--help` prints a prefix table.
- The `req_id` prefixes are a convention, not a schema constraint; a typo (e.g. `L5-104.5.1`) breaks the discriminator. Mitigation: a CI lint in `pheno-worklog-schema` validates that every `req_id` matches `^L[0-9]+-[0-9]+(\.[0-9]+)?$`.

## Refs

- ADR-032 (pheno-worklog-schema is a primitive lib, not a re-implementation of AgilePlus)
- ADR-015 / ADR-025 (worklog v2.0 → v2.1 schema bump)
- AGENTS.md § "Decision B — pheno-worklog-schema is a primitive lib"
- `pheno-worklog-schema/SPEC-v2.1.md`
- v8 plan § 3.3 Track T11 + Appendix F (F3: tooling deferred to v9)
