# L6 — pheno-* Repos Health Inventory

**Date:** 2026-06-14
**Scope:** `/Users/kooshapari/CodeProjects/Phenotype/repos` (all `pheno-*` directories)
**Tooling:** `cargo 1.x` (homebrew), `pytest 9.0.3` (python 3.14.5), `go 1.26.2`

## Summary

- **18 `pheno-*` directories** found
- **7 Rust crates** (Cargo.toml)
- **8 Python packages** (pyproject.toml)
- **1 Go module** (go.mod)
- **1 TypeScript package** (package.json, vitest — out of scope for this run)
- **1 worktree container** (pheno-wtrees — git worktree links, not a buildable crate)
- **Test totals (Rust+Python+Go):** 136 passed, 4 failed, 0 ignored
- **11 of 16 buildable crates** ship a complete meta set (AGENTS.md, llms.txt, WORKLOG.md, CHANGELOG.md, LICENSE-MIT)
- **5 crates** (pheno-config, pheno-context, pheno-errors, pheno-port-adapter, pheno-tracing, pheno-go-ctxkit, pheno-pydantic-models, pheno-wtrees, pheno-zod-schemas) are missing the full meta bundle — most are recent (Jun 14) and pre-hygiene

## Per-Crate Health Table

Legend: ✅ = present, ❌ = missing, ⚠️ = present but not `LICENSE-MIT` (only `LICENSE`), n/a = not applicable for this language.

| Crate | Lang | AGENTS.md | llms.txt | WORKLOG.md | CHANGELOG.md | LICENSE-MIT | Tests Pass | Tests Fail | Notes |
|---|---|---|---|---|---|---|---|---|---|
| pheno-agents-md | Rust | ✅ | ✅ | ✅ | ✅ | ✅ | 4 | 4 | Native run; 4 lib tests fail on `extra_dont_touch` field assertion (YAML default vs. explicit-missing) |
| pheno-cargo-template | Rust | ✅ | ✅ | ✅ | ✅ | ✅ | 1 | 0 | **Scratch copy required** (parent `Cargo.toml` workspace missing `phenotype-error-core`); `tests::crate_name_matches_package` passes |
| pheno-config | Rust | ❌ | ❌ | ❌ | ❌ | ❌ | 10 | 0 | Native run; 10 lib + 2 doc tests pass; pre-hygiene (no meta files) |
| pheno-context | Rust | ❌ | ❌ | ❌ | ❌ | ❌ | 5 | 0 | **Scratch copy required** (parent workspace broken); 5 lib tests pass after `thiserror = "2.0"` substitution |
| pheno-cost-card | Python | ✅ | ✅ | ✅ | ✅ | ✅ | 2 | 0 | `PYTHONPATH` resolved package; 2 smoke tests pass |
| pheno-errors | Rust | ❌ | ❌ | ❌ | ❌ | ❌ | 6 | 0 | Native run; declares own `[workspace]` so immune to parent breakage; 6 lib tests pass |
| pheno-go-ctxkit | Go | ❌ | ❌ | ❌ | ❌ | ❌ | 6 | 0 | `go test ./...` → 6 top-level tests (TestNewRequestIDIsUnique, TestWithRequestIDRoundTrip [+4 subtests], TestWithLoggerRoundTrip [+4 subtests], TestBackgroundReturnsContextWithRequestID, TestMiddlewareInjectsRequestID [+2 subtests], TestMiddlewareEmitsRequestCompleteLog); all PASS |
| pheno-llms-txt | Python | ✅ | ✅ | ✅ | ✅ | ✅ | 6 | 0 | `PYTHONPATH=pheno-llms-txt/src` required; 6 tests pass |
| pheno-mcp-router | Python | ✅ | ✅ | ✅ | ✅ | ✅ | 14 | 0 | `PYTHONPATH=pheno-mcp-router/src` required; 14 tests pass across `test_ports.py` + `test_smoke.py` |
| pheno-port-adapter | Rust | ❌ | ❌ | ❌ | ❌ | ❌ | 18 | 0 | Native run; declares own `[workspace]`; 18 lib tests pass (incl. unix socket health check) |
| pheno-prompt-test | Python | ✅ | ✅ | ✅ | ✅ | ✅ | 14 | 0 | `PYTHONPATH=pheno-prompt-test/src` required; 14 tests pass |
| pheno-pydantic-models | Python | ❌ | ❌ | ❌ | ❌ | ❌ | 5 | 0 | `PYTHONPATH=pheno-pydantic-models` required (package lives at repo root, not `src/`); 5 schema tests pass |
| pheno-scaffold-kit | Python | ✅ | ✅ | ✅ | ✅ | ✅ | 6 | 0 | 6 smoke tests pass |
| pheno-tracing | Rust | ❌ | ❌ | ❌ | ❌ | ❌ | 9 | 0 | **Scratch copy required** (parent workspace broken); 2 lib + 6 integration + 1 doc test pass after adding `env-filter` feature to `tracing-subscriber` |
| pheno-vibecoding-guard | Python | ✅ | ✅ | ✅ | ✅ | ✅ | 16 | 0 | `PYTHONPATH=pheno-vibecoding-guard/src` required; 16 tests pass across `test_cli.py` + `test_guard.py` |
| pheno-worklog-schema | Python | ✅ | ✅ | ✅ | ✅ | ✅ | 14 | 0 | `PYTHONPATH=pheno-worklog-schema/src` required; 14 schema tests pass |
| pheno-wtrees | — | ❌ | ❌ | ❌ | ❌ | ❌ | n/a | n/a | Git worktree container (holds 3 linked worktrees: `agileplus-nats-extract-2026-06-08`, `ci-audit-2026-06-08`, `gitignore-pycache`); not a buildable crate |
| pheno-zod-schemas | TypeScript | ❌ | ❌ | ❌ | ❌ | ❌ | n/a | n/a | `@kooshapari/pheno-zod-schemas` v0.1.0; uses `vitest`; not in scope (TS not requested) |

## Test Totals by Language

| Language | Crates Tested | Pass | Fail | Notes |
|---|---|---|---|---|
| Rust | 7 | 53 | 4 | 4 fails all in `pheno-agents-md` |
| Python | 8 | 77 | 0 | All green; 5 required `PYTHONPATH` workaround |
| Go | 1 | 6 | 0 | All green |
| **Total** | **16** | **136** | **4** | — |

## Meta-File Coverage

| Crate has full meta bundle (AGENTS.md, llms.txt, WORKLOG.md, CHANGELOG.md, LICENSE-MIT) | Crates |
|---|---|
| Yes | pheno-agents-md, pheno-cargo-template, pheno-cost-card, pheno-llms-txt, pheno-mcp-router, pheno-prompt-test, pheno-scaffold-kit, pheno-vibecoding-guard, pheno-worklog-schema (9) |
| No | pheno-config, pheno-context, pheno-errors, pheno-go-ctxkit, pheno-pydantic-models, pheno-port-adapter, pheno-tracing, pheno-wtrees, pheno-zod-schemas (9) |

Pattern: crates with full meta are the **v0.1.0/published** ones (older, hygiene-applied). Crates missing meta are the **Jun 14** additions (added during the fleet expansion, pre-hygiene).

## Infrastructure Issues Found

1. **Parent workspace is broken**: `/Users/kooshapari/CodeProjects/Phenotype/repos/Cargo.toml` lists `crates/phenotype-error-core` as a workspace dependency, but that crate directory does not exist. This blocks `cargo test --manifest-path <d>/Cargo.toml` for any crate that uses `{ workspace = true }` inheritance (pheno-context, pheno-tracing, pheno-cargo-template).
   - **Workaround applied:** copied each affected crate to `/tmp/pheno-scratch/`, added a leading `[workspace]` table, and substituted explicit versions for `{ workspace = true }` deps. Original repo files were not modified.
   - **Fix needed:** either restore `crates/phenotype-error-core/Cargo.toml` or remove it from the workspace `members` list.

2. **pheno-tracing under-specified**: `tracing-subscriber` is missing the `env-filter` feature in the original `Cargo.toml` even though `EnvFilter` is used in `src/lib.rs`. Compilation fails without the feature flag. (Tested via scratch copy with feature added.)

3. **Python PYTHONPATH requirement**: 5 of 8 Python packages (`pheno-llms-txt`, `pheno-mcp-router`, `pheno-prompt-test`, `pheno-pydantic-models`, `pheno-vibecoding-guard`, `pheno-worklog-schema`) do not install themselves as importable packages — tests `from <pkg> import …` fail without `PYTHONPATH=<repo>` or `pip install -e .`. This suggests the `pyproject.toml` is missing `[tool.setuptools]` packages config or `[project.scripts]` setup.

4. **pheno-agents-md test bugs**: 4 of 8 lib tests fail with `missing field 'extra_dont_touch'`. Tests expect this field to be present in YAML configs but the deserializer is treating it as required. Likely a recent schema change that wasn't reflected in the test fixtures.

## Methodology

1. `ls -d pheno-*/` to enumerate 18 directories
2. Per crate: `ls Cargo.toml pyproject.toml go.mod` for manifest detection; `ls AGENTS.md llms.txt WORKLOG.md CHANGELOG.md LICENSE-MIT LICENSE` for meta-file presence
3. Test runs:
   - **Rust:** `timeout 120 cargo test --manifest-path <d>/Cargo.toml --no-fail-fast`; for 3 crates blocked by parent workspace, copied to `/tmp/pheno-scratch/<d>/` and patched the copy's `Cargo.toml` (added `[workspace]`, substituted explicit dep versions, added `env-filter` feature to `pheno-tracing`)
   - **Python:** `timeout 30 PYTHONPATH=<d>[/src] pytest <d>/tests/ --no-header -q --tb=no` (5 crates needed explicit `PYTHONPATH`)
   - **Go:** `cd pheno-go-ctxkit && timeout 60 go test ./...` (verbose to count subtests)
4. Pass/fail counts extracted from `test result:` lines (Rust), `X passed in Y` lines (pytest), and `--- PASS/FAIL` lines (Go verbose)
5. No files in the `pheno-*` repos were modified. Only `/tmp/pheno-scratch/` was created and cleaned up. No commits made.

## Out-of-Scope / Not Tested

- **pheno-wtrees**: git worktree container, not a buildable crate
- **pheno-zod-schemas**: TypeScript + vitest; user requested only Rust/Python/Go test runners
