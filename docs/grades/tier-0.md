# Tier-0 Pass-Rate Gauge

> Tier-0 gates: **build**, **test-unit**, **fmt**, **clippy**/**lint**, **typecheck**.

These are the non-negotiable gates that must be green on every PR.

## Gate Definitions

| Gate | Rust Cmd | Node Cmd | Python Cmd | Weight |
|------|----------|----------|------------|--------|
| build | `cargo build --workspace` | `npm run build` | N/A (pip install covers) | 2 |
| test-unit | `cargo test --workspace` | `npm test` | `pytest -v` | 3 |
| fmt | `cargo fmt -- --check` | `npx prettier --check` | `ruff format --check` | 2 |
| clippy/lint | `cargo clippy -D warnings` | `npx eslint .` | `ruff check src` | 2 |
| typecheck | N/A | `npx tsc --noEmit` | `mypy src` | 2 |

## Per-Repro Tier-0 Status

| Repo | build | test-unit | fmt | clippy/lint | typecheck | Overall |
|------|-------|-----------|-----|-------------|-----------|---------|
| phenotype-infra | fail | fail | fail | fail | N/A | FAIL |
| PhenoCompose | fail | fail | fail | fail | N/A | FAIL |
| BytePort | fail | fail | fail | fail | N/A | FAIL |
| nanovms | fail | fail | fail | fail | fail | FAIL |

## Gate Summary

- **Repos passing Tier-0:** 0 / 4
- **All Tier-0 gates must be PASS for merge.**
- **Action:** Run `cargo build && cargo test && cargo fmt --check && cargo clippy` on failing Rust repos. For nanovms (Node): fix `vitepress build`, add test script, fix eslint/prettier/tsc.

## Gauge

```
Tier-0 Pass Rate:  0% █████░░░░░░░░░░░░░░░
                   ─────────────────────────
                   0 of 4 repos passing
```

## Historical

| Date | Passing | Total | Rate |
|------|---------|-------|------|
| 2026-06-24 | 0 | 4 | 0% |
