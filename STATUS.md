# STATUS

> Monorepo status for the **Phenotype** ecosystem — last updated 2026-06-08.

This repository aggregates the Phenotype sub-projects (apps, services, shared
crates, tooling, and active worktrees) under a single root. See
[`ARCHITECTURE.md`](ARCHITECTURE.md) for the high-level layout and
[`README.md`](README.md) for the project entrypoint.

## Recent work

- `feat(e2e-base)` — scaffolded `@phenotype/e2e-base` with a Playwright config
  and 3 smoke tests for repo-level end-to-end validation.
- `docs` — added the polyrepo → monorepo consolidation migration guide and
  the Phenotype-Unity design system documentation.
- `chore(ci)` — added the repo-wide `.editorconfig` (PR #30) to keep
  formatting consistent across sub-projects.

## Sub-projects

- Apps & shells: `apps/`, `phenotype-unity/`, `phenotype-voxel/`, `phenotype-landing/`
- Shared libraries: `crates/`, `libs/`, `phenoShared/`, `phenoData/`,
  `phenoUtils/`, `phenoContracts/`, `phenoSchema/`, `phenoKits/`
- Services: `services/`, `phenoMCP/`, `phenoAgents/`, `phenoVCS/`,
  `phenoObservability/`, `phenoEvents/`, `phenotype-bus/`,
  `phenotype-registry/`, `phenotype-otel/`
- Tooling: `tooling/`, `thegent/`, `dispatch-mcp/`, `cheap-llm-mcp/`,
  `phenotype-ops-mcp/`, `phenotype-tooling/`
- Active worktrees: `*-wtrees/` directories (per-feature branches)

## Notes

- The root `STATUS.md` is a thin index only; per-project status belongs in
  each sub-project's own `STATUS.md`.
- For governance / superseded policies, see
  `phenotype-org-governance/SUPERSEDED.md` once it is reintroduced.
