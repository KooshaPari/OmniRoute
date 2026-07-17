# Absorption Record — phench

## Transfer Record

| Field | Value |
|-------|-------|
| Source repo | `KooshaPari/phench` |
| Target repo | `KooshaPari/phenotype-tooling` |
| Target paths | `crates/phench/` |
| Absorbed date | 2026-07-17 |
| Absorbed by | forge agent |
| Branch on target | `salvage/phenotype-tooling-workspace-2026-07-15` |
| Verification | `python -m unittest discover` 17/17 OK |

## Target reassignment

Originally queued (by the previous agent) with target
`phenodocs`. Reassigned at absorption time to
`phenotype-tooling` for the following reasons:

1. **phench is a *runtime* CLI** for project-state orchestration
   (git ops, env doctor, target init / materialize). It executes
   developer machine actions, not documentation builds.
2. **phenodocs is a VitePress hub** with no runtime CLI surface
   (its `pyproject.toml` is documentation tooling only, no entry
   point).
3. **phenotype-tooling is the conventional home for runtime
   developer tooling** — see `crates/phenotype-cli`,
   `crates/policystack`, and `bin/*.py` scripts. It already
   mixes Python subprojects under `crates/`.

The disposition-index row `repo-phench` is updated to reflect
the redirect.

## What was absorbed

Pure-Python Typer+Rich CLI for managing multi-target project
checkouts (the `phench target init|add-repo|lock|materialize`
family). Backs onto a `.phench/` state directory per project,
with optional home mirror at `~/phench`.

- **10 modules** (1045 LOC): `cli`, `env_doctor`, `git_ops`,
  `models`, `paths`, `runner`, `service`, `store`,
  `__init__`, `__main__`
- **6 test files:** `test_bootstrap`, `test_materialization`,
  `test_run_contracts`, `test_runtime_helpers`,
  `test_service_state`, `test_store`
- **Runtime deps:** typer≥0.12, rich≥13, orjson≥3.10
- **Entry point:** `phench = phench.cli:main`

## Workspace changes

- New directory: `crates/phench/` (no Cargo.toml — Python
  sub-project, ignored by `cargo metadata`)
- Added `.gitignore` to drop Python build artifacts
  (`__pycache__/`, `*.egg-info/`, `build/`, `dist/`, etc.)
- Removed accidentally-checked-in `crates/phench/src/phench.egg-info/`
  (artifacts of `pip install -e .`)

## Verification

```sh
$ cd crates/phench && pip install -e . --break-system-packages
Successfully installed phench-0.1.0

$ python -m unittest discover -s tests -p 'test_*.py'
.................
----------------------------------------------------------------------
Ran 17 tests in 1.689s

OK
```

All 17 tests pass.

## Provenance

Branch: `origin/salvage/phenotype-tooling-workspace-2026-07-15`
on `KooshaPari/phenotype-tooling`. Source repo
`KooshaPari/phench` archived via `gh repo archive`.
