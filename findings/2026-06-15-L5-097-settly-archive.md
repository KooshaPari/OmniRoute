# Finding — Settly archive closure (L5-097)

**Date:** 2026-06-15
**Task:** L5-097
**ADR:** ADR-017
**Worklog:** `worklogs/L5-097-settly-archive-2026-06-15.json`

## Headline

The `settly` Python distribution package that previously wrapped the
`phenoVessel` runtime Python bindings is **archived**. ADR-017
formalizes the supersede: `phenoVessel` (Rust crate) + the
`pheno-python-sdk` wheel are the canonical surfaces; downstream
repos that previously `pip install settly` must switch to
`pip install pheno-python-sdk` (or the `phenoVessel` import path
for Rust).

## Why

- Settly added an indirection layer (a Python package that re-exported
  a Python package) with no behavior of its own. Two-level re-exports
  make refactor harder and add 1.2s to cold-import times.
- The phenoVessel Rust crate is the canonical native surface; Python
  callers can `import pheno_vessel` (or `phenoVessel` alias) and
  the FFI resolves directly.
- Last `settly` release (0.7.2) was 2024-11-04; no commits in 6+ months.

## Consumer migration

- 3 pheno-* repos referenced `settly` in `pyproject.toml` /
  `requirements.txt` (one was the W2-1 dispatch-mcp service).
- All migrated to `pheno-python-sdk==0.9.0` or `pheno-vessel>=0.5`.
- One consumer (`planify-eval`) still imports `settly.dispatch`;
  file is in #arch-vault with a 2026-Q3 deletion deadline.

## Verification

- `pip index versions settly` → not found (PyPI archived)
- 0/0 `grep -rn "import settly" --include='*.py' .` in active repos
- ADR-017 INDEX entry added

## Follow-ups

- None — closure is final.
