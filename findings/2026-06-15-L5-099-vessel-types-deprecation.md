# Finding — phenoVessel + phenoTypes deprecation complete (L5-099)

**Date:** 2026-06-15
**Task:** L5-099
**ADRs:** ADR-019, ADR-020
**Worklog:** `worklogs/L5-099-vessel-types-deprecation-2026-06-15.json`

## Headline

Both `phenoVessel` (Python distribution wrapper) and `phenoTypes`
(TypeScript SDK stub) are now **fully deprecated**. The canonical
surfaces are:

- `phenoVessel` (Rust crate) — for Rust callers (replaces
  the Python wrapper of the same name)
- `pheno-python-sdk` — for Python callers (replaces the Python
  wrapper of `phenoVessel`)
- `phenotype-ts-utils` — for TypeScript callers (the original
  phenoTypes was an empty stub; the real TS surface lives in
  `phenotype-ts-utils`)

## Why

- 3 Python packages with overlapping names (`settly`, `phenoVessel`,
  `pheno-python-sdk`) made the import surface non-obvious; closing
  `settly` (L5-097) and the Python `phenoVessel` wrapper (this
  finding) leaves 1 Python entry point.
- 1 empty TS stub (`phenoTypes`) with no code in it was misleading
  the GitHub search results; replacing it with a redirect note
  in the README + a 301 in the package.json `homepage` field
  points TypeScript users at `phenotype-ts-utils`.

## Verification

- PyPI: `phenoVessel` (the Python wrapper) → archived with note
  pointing at `pheno-python-sdk`
- npm: `phenoTypes` package.json `homepage` → `https://github.com/KooshaPari/phenotype-ts-utils`
- ADR-019 (vessel) and ADR-020 (types) both INDEX-added
- 0 references to `phenoVessel` (Python) or `phenoTypes` (TS)
  in any active repo's `Cargo.toml` / `pyproject.toml` /
  `package.json`

## Follow-ups

- None — closure is final.
