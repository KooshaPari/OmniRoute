# SPEC — pheno-worklog-schema

**Version:** 0.1.0
**Status:** Stable.

## What

Parse, emit, and migrate WORKLOG.md files per the ADR-015 schema. v2.0 has 6 columns; v2.1 has 11 columns (adds `device`, `scope`, `risk`, `deps`, `links`).

## When to use

- Reading fleet WORKLOG.md files into tooling.
- Validating that a WORKLOG.md is well-formed.
- Migrating v2.0 → v2.1.
- Emitting JSONL for downstream tooling.

## When NOT to use

- For generic Markdown table parsing (use a Markdown lib).
- For AgilePlus JSONL worklogs (different format).

## 5-line quickstart

```python
from pheno_worklog_schema import parse, to_markdown, to_jsonl
rows = parse(open("WORKLOG.md").read())
open("out.md", "w").write(to_markdown(rows))
open("out.jsonl", "w").write(to_jsonl(rows))
```

## Public API

| Symbol | Purpose |
| --- | --- |
| `Row` | Dataclass with 11 fields. |
| `parse(text) -> list[Row]` | Parse v2.0 or v2.1 WORKLOG.md. |
| `to_markdown(rows) -> str` | Emit canonical v2.1 Markdown. |
| `to_jsonl(rows) -> str` | Emit JSONL for tooling. |
| `migrate_v20_to_v21(row_v20) -> Row` | v2.0 → v2.1 with `device="unknown"`. |

## CLI

```
python -m pheno_worklog_schema validate WORKLOG.md
python -m pheno_worklog_schema migrate WORKLOG.md [--out PATH]
```
