# Boundary — phench (absorbed)

**Status:** Absorbed 2026-07-17 into `phenotype-tooling` as
`crates/phench/`. (Originally queued with target `phenodocs`;
reassigned — see absorption record for rationale.)

## Identity

- **Source:** `KooshaPari/phench` (Python CLI, 1 branch, v0.1.0)
- **Canonical home:** `KooshaPari/phenotype-tooling`
  (`crates/phench/`)
- **Python package:** `phench` (entry point: `phench = phench.cli:main`)
- **Layout:** src-layout (`src/phench/*.py`, `tests/test_*.py`)
- **Toolchain:** Python 3.11+, setuptools, pip-installable

## Role

Standalone control-plane CLI/TUI for managing **Phenotype project-state
runtime orchestration**. Materializes a multi-target checkout layout
into `$HOME/CodeProjects/Phenotype/projects/<target>/`, with home
mirror at `~/phench` and per-target state at `.phench/`. Useful
when a developer needs to swap multiple checkout configurations
in/out of a working tree.

This is a **runtime developer tool** that operates on developer
machines. It is *not* a documentation tool, *not* an SDK, and
*not* an AI agent — it sits in the tooling layer alongside
`phenotype-cli`, `policystack`, and the `bin/*.py` glue scripts.

## Command surface (v0.1.0)

```
phench target init <name>
phench target add-repo <name> --repo <path> --ref <ref>
phench target lock <name>
phench target materialize <name>
```

Plus internal helpers for state-store, env-doctor (sanity-check
toolchain), git-ops (clone/fetch/checkout into the materialized
target), and runner (invoke commands under a materialized target).

## Out of scope

- Documentation building — `phenodocs` handles that
- Cross-language SDKs — `phenotype-{python,go,rust}-sdk` handle those
- AI agent runtime — `phenoAI`, `Antinomy` handle that

## Consumers

- Developers who run multi-target Phenotype checkouts (the
  `phench target materialize` family)

## References

- Absorption record: `docs/absorption/phench/README.md`
- Audit: `audits/absorption-justifications/phench-2026-07-17.md`
- Disposition: `registry/disposition-index.json` row `repo-phench`
- (Reassigned target — was `phenodocs`, now `phenotype-tooling`)
- Absorbed branch: `phenotype-tooling@salvage/phenotype-tooling-workspace-2026-07-15`
