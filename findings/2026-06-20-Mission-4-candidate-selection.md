# Mission 4: Configra Slice 2 — Candidate Selection

**Date:** 2026-06-20
**Status:** ACCEPTED — top candidate selected for slice 2
**Decides:** STATUS.md:20 ("Mission 4 candidate: TBD")

## Background

- **Mission 1-3** (closed): Configra migration slice 1 — `phenotype-config` absorbed into Configra per ADR-031 (closed 2026-06-19).
- **ADR-022**: config consolidation split — Rust core (Configra) + TS edge.
- **ADR-031**: Configra absorb policy — `phenotype-config` deprecation continues 2026-07-15.
- **ADR-035**: Configra migration gates — the gate table applied to slice 1.

## Methodology

`rg 'phenotype-config' Cargo.toml pyproject.toml go.mod package.json` across
`/Users/kooshapari/CodeProjects/Phenotype/repos/*/`. For each hit, score
on 4 dimensions (1-3 each, max 12):

- **Maintainability** (M): how active is the repo? Recent commits, open issues, no > 6-month stale code.
- **Deps** (D): how deeply does the repo import phenotype-config? Surface-level (=1) vs deeply woven (=3).
- **Active** (A): is the repo currently shipping? Released in last 90 days?
- **Isolation** (I): can it be migrated without breaking other consumers? 0 external dependents = 3, many = 1.

## Candidates

| # | Repo | Language | Current dep | M | D | A | I | Score | Notes |
|---|------|----------|-------------|---|---|---|---|-------|-------|
| 1 | `pheno-config` | Rust | `phenotype-config = "0.1"` | 3 | 3 | 3 | 2 | **11** | Highest activity, deepest integration, recent 0.2.0 release. |
| 2 | `pheno-config-cli` | Rust | `phenotype-config = "0.1"` | 2 | 2 | 2 | 3 | **9** | CLI wrapper, simplest migration, lower impact. |
| 3 | `pheno-config-types` | Rust | `phenotype-config = "0.1"` (type-only) | 2 | 1 | 2 | 3 | **8** | Type re-exports; thin surface. |
| 4 | `phenotype-shared-config` | TS | `phenotype-config` (TS edge) | 2 | 2 | 2 | 2 | **8** | TS edge per ADR-022 split; mid-effort. |
| 5 | `phenotype-config-loader` | Rust | `phenotype-config = "0.1"` (loader façade) | 2 | 2 | 2 | 2 | **8** | Facade; may merge into Configra wholesale. |
| 6 | `pheno-config-schema` | Rust | `phenotype-config = "0.1"` (schema) | 1 | 2 | 1 | 2 | **6** | Stale; may already be redundant after ADR-022. |

## Recommendation

### #1: `pheno-config` (Rust) — SLICE 2

**Rationale:** Highest score (11/12). The repo is actively shipping (0.2.0
released in May 2026 per registry), deeply integrates `phenotype-config`
(3rd-party dep, not just re-export), and has the largest blast radius
(consumed by 4+ downstream crates per L6 health). Migrating it forces the
Configra API to be production-quality (not just slice-1 happy-path).

**Top-1 risks:**
- API drift between `phenotype-config::Config` and `configra::Config` requires a compat shim.
- 3+ downstream crates will need to bump to `configra = "0.1"`.

**Top-1 mitigation:** gate table per ADR-035 (1 PR compat shim → N PR bump consumers).

### #2: `pheno-config-cli` (Rust) — SLICE 3 CANDIDATE

**Rationale:** Lowest-impact win after slice 2 lands. CLI surface is small
(~500 LoC), no downstream consumers, can be migrated in a single PR.

## Out of scope (deferred)

- TS/Go consumers (`phenotype-shared-config`) → v14, requires per-language Configra SDK
- `pheno-config-schema` → may already be redundant post-ADR-022; deprecate in slice 2

## Acceptance criteria for slice 2 PRs

1. `pheno-config/Cargo.toml` swaps `phenotype-config = "0.1"` for `configra = "0.1"`
2. Compat shim `pheno-config/src/compat.rs` re-exports the `phenotype_config::Config` shape
3. `pheno-config/tests/integration.rs` green against Configra
4. ADR-035 gate table: 1 compat shim PR + 3+ downstream bump PRs in single wave
5. Registry `phenotype-registry` row `pheno-config` flips `uses: phenotype-config → uses: configra`

## Files

- `findings/2026-06-20-Mission-4-candidate-selection.md` (this file)
- `findings/2026-06-20-Mission-4-slice-2-plan.md` (companion execution plan)
