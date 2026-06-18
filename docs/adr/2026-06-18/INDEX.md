# ADR Index — 2026-06-18 (v8 governance sweep)

This index lists the ADRs accepted on 2026-06-18 for the v8 execution sweep
(`plans/2026-06-18-v8-dag-stable.md`). All files live in this directory.

| #     | Title                                                                                | Status   | File                                                  |
| :---- | :----------------------------------------------------------------------------------- | :------- | :---------------------------------------------------- |
| 035   | Configra migration gates (4 pre-conditions for ADR-031 execution)                    | Accepted | `ADR-035-configra-migration-gates.md`                 |
| 036   | `pheno-tracing` is the canonical OTLP/tracing substrate (superset of ADR-012)        | Accepted | `ADR-036-pheno-tracing-substrate-canonical.md`        |
| 037   | `pheno-mcp-router` is the canonical MCP substrate (superset of ADR-013)              | Accepted | `ADR-037-pheno-mcp-router-substrate-canonical.md`     |
| 038   | Hexagonal L4 Port/Adapter is the canonical substrate interface (codifies ADR-014)    | Accepted | `ADR-038-hexagonal-port-adapter-l4-policy.md`         |
| 039   | Pheno-flake refresh template for substrate repos                                     | Accepted | `ADR-039-pheno-flake-refresh-template.md`             |
| 040   | Test coverage gates per substrate tier (80/70/60%)                                    | Accepted | `ADR-040-test-coverage-gates-per-tier.md`             |

## Scope

- **ADR-035** establishes 4 pre-conditions (hygiene ≥ 80%, zero secret leaks, SLSA configured, Conft unblocked) that must be met before any `pheno-config*` / `settly-config*` / `phenotype-python-sdk/phenotype_config` migration into `Configra` (per ADR-031) can proceed. 8 source repos are mapped; 8 PRs are sequenced.

- **ADR-036** supersedes ADR-012: `pheno-tracing` is now mandatory for ALL Rust substrate (was optional). 17/22 pheno-* Rust crates need migration. 4 federated services need OTLP wiring. 71-pillar L56/L57 scores improve from ~12/30 to ~22/30.

- **ADR-037** supersedes ADR-013: `pheno-mcp-router` scope is formalized (Provider discovery, cost tracking, budget, quota, audit, cost middleware). L5-104 migration (ADR-029) closes the historical dispatch-mcp gap. 6 consumer repos standardize on the substrate.

- **ADR-038** codifies ADR-014's hexagonal L4 Port/Adapter pattern as the canonical substrate interface. 19/22 pheno-* Rust crates need refactor. 71-pillar L4 score improves from ~16/30 to ~26/30.

- **ADR-039** adopts the pheno-flake template for all new substrate. 22 existing pheno-* repos are refactored (22 PRs, 4 subagents in parallel). 71-pillar L29/L30 scores improve from ~14/30 to ~28/30.

- **ADR-040** codifies ADR-023 Rule 3.1's coverage gates (80% lib/SDK, 70% framework, 60% service) as CI-enforced. `pheno-coverage` CLI is a new tool. 71-pillar L23 score improves from ~12/30 to ~24/30.

## Decision-log files

Each ADR has a corresponding decision-log finding at `findings/2026-06-18-L8-00X-*.md`:

- ADR-035 → `findings/2026-06-18-L8-001-configra-absorption-plan.md`
- ADR-036 → `findings/2026-06-18-L8-002-pheno-tracing-adoption.md`
- ADR-037 → `findings/2026-06-18-L8-003-pheno-mcp-router-scope.md`
- ADR-038 → `findings/2026-06-18-L8-004-hexagonal-port-adoption.md`
- ADR-039 → `findings/2026-06-18-L8-005-pheno-flake-rollout.md`
- ADR-040 → `findings/2026-06-18-L8-006-coverage-gates.md`

## Supersedes

- **ADR-036** supersedes ADR-012 (same intent, expanded scope: required not optional)
- **ADR-037** supersedes ADR-013 (scope formalized; L5-104 migration closes historical gap)
- **ADR-038** codifies ADR-014 (Port/Adapter pattern is now required, not recommended)
- **ADR-040** codifies ADR-023 Rule 3.1 (coverage gates now CI-enforced)

## Cross-references

- `AGENTS.md` "Active ADRs" table (rows ADR-035..ADR-040 added in v8 wave)
- `plans/2026-06-18-v8-dag-stable.md` (this sweep's execution plan)
- `docs/adr/2026-06-17/INDEX.md` (predecessor ADRs 024-034)
- `findings/2026-06-18-L8-001..006-*.md` (decision logs)
- ADR-024 (71-pillar audit) — pillars referenced per ADR
- ADR-025 (worklog v2.1) — applies to all new PRs in v8
- ADR-023 (substrate quality bar) — Rule 3.1 enforced by ADRs 039 + 040
