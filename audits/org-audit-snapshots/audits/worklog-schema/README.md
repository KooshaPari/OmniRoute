# Migrated from KooshaPari/pheno-worklog-schema on 2026-06-20 prior to repo deletion

> Original source: https://github.com/KooshaPari/pheno-worklog-schema (main @ 02e2ba32b95369bc7b65e7f5bfe407f624bc9c36)
> Absorbed into `phenotype-org-audits/audits/worklog-schema/` per ADR-042.

# pheno-worklog-schema

Parse, emit, and migrate WORKLOG.md files in the ADR-015 schema (v2.0 → v2.1).

- **Substrate type:** `pheno-*-lib` (Python)
- **Bucket:** ACTIVE
- **Spec:** [SPEC.md](./SPEC.md)
- **Coverage gate (Rule 3.1):** 80%

## Install

```bash
pip install pheno-worklog-schema
```

## Quickstart (5 lines)

```python
from pheno_worklog_schema import parse, to_markdown
rows = parse(open("WORKLOG.md").read())
print(to_markdown(rows))
```

## CLI

```bash
python -m pheno_worklog_schema migrate WORKLOG.md --out WORKLOG-v2.1.md
python -m pheno_worklog_schema validate WORKLOG.md
```

## License

Dual-licensed: [LICENSE-MIT](./LICENSE-MIT) OR [LICENSE-APACHE](./LICENSE-APACHE).
