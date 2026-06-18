# pheno-sdk → phenotype-python-sdk package map

**Source:** `KooshaPari/pheno-sdk` (private archived, 2 branches, minimal tree: `.github`, `CHANGELOG.md`, `SECURITY.md`)

## Audit (Wave H7)

The private `pheno-sdk` repo held the **ATOMS-PHENO** package index metadata only — no application code on `main`. Canonical Python SDK surface lives in `phenotype-python-sdk`.

| pheno-sdk artifact | Successor | Action |
|--------------------|-----------|--------|
| Package index metadata | `phenotype-python-sdk` extras / workspace manifest | grep org for orphan `pheno-*` imports before retire |
| `.github` workflows | phenotype-python-sdk CI | already canonical |
| CHANGELOG / SECURITY | phenotype-python-sdk root docs | copy if missing |

## Policy

- Do **not** unarchive `pheno-sdk`
- Mark disposition `REDIRECT` → `phenotype-python-sdk` when no orphan references remain
- Run `rg 'pheno-sdk|atoms-pheno' KooshaPari/` before delete eligibility
