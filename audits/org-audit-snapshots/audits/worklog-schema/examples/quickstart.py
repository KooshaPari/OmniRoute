"""Quickstart example for pheno-worklog-schema."""

from pheno_worklog_schema import parse, to_markdown, to_jsonl

text = """\
# WORKLOG — example

Schema: ADR-015 v2.1 (11 columns).

| Date | Task ID | Layer | Action | Files | Notes | device | scope | risk | deps | links |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-20 | L1-demo | L1-lib | feat: initial | src/*.py | hello | macbook | repo | low | none | ADR-015 |
"""

rows = parse(text)
print("parsed rows:", len(rows))
print("---v2.1 markdown---")
print(to_markdown(rows))
print("---JSONL---")
print(to_jsonl(rows))
