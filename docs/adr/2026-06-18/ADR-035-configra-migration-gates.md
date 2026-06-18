# ADR-035: Configra migration gates

**Status:** ACCEPTED
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**L8-001** (v8 track T10.2)
**Refs:**
- ADR-031 (Configra as canonical config name)
- ADR-022 (superseded for naming; Rust/TS edge split remains valid)
- `findings/2026-06-18-L8-001-configra-absorption-plan.md` (this ADR's execution plan)

---

## Context

Per ADR-031, `KooshaPari/Configra` is the canonical Rust config substrate. 8 source repos must be absorbed into it:

| Source | Target | Type |
|---|---|---|
| `pheno-config` | Configra (rename to `phenotype-config-*` module) | Rust |
| `phenotype-config` (currently canonical) | Configra (content merge) | Rust |
| `phenotype-config-rs` | Configra (content merge) | Rust |
| `Conft` | Conft (KEEP, TS edge) | TS |
| `settly-config` | Configra (content merge) | Python |
| `settly-config-rs` | Configra (content merge) | Rust |
| `settly-config-ts` | Conft (content merge) | TS |
| `phenotype-python-sdk/phenotype_config` | Configra (sub-crate extraction) | Python |

## Decision

**Configra migration is gated by 4 pre-conditions. Migration proceeds only when ALL pass:**

### Gate 1: Repo hygiene ≥ 71-pillar score 24/30 (80%)

Per ADR-024, Configra must score ≥ 80% on the 71-pillar audit *before* any code is migrated. Score 0–3 per pillar; 30 pillars apply to a single-crate substrate (excludes UI pillars 38–45 which are N/A for headless libs).

- Current Configra score: 12/30 (estimated; only hygiene + governance)
- Required: 24/30 (80% threshold per ADR-024)
- Gap work: 5+ ADRs (this ADR + ADR-036..040), spec doc, test matrix, CI gate, OTLP export, coverage report

### Gate 2: Zero secret leaks in last 30 days

`git log --all -p --since='30 days ago' | pheno-secret-scan --strict` must return 0 violations. Required to prevent GitHub secret-scanner blocks like the one on `chore/w5-adrs-sota-2026-06-15-v2`.

### Gate 3: SLSA build provenance configured

Configra must have a `docs/slsa.md` (or equiv) describing the build provenance chain, per ADR-022 (renamed). Existing `phenotype-config` SLSA doc (`docs/slsa.md`) is the template.

### Gate 4: Conft (TS edge) is unblocked

The TS edge (Conft) must be reviewed to confirm no Rust code is hidden behind TS bindings; otherwise the Rust/TS split (ADR-022) is invalidated.

## Migration sequence (8 sub-tasks, ~90 min)

| # | Task | PR |
|---|---|---|
| 10.1 | Probe pheno-config files vs Configra | (local) |
| 10.2 | Author `migrate-config.md` design doc | (local) |
| 10.3 | `pheno-config/*` → `Configra/pheno-config/` (preserves history) | Configra#1 |
| 10.4 | `phenotype-config/*` → `Configra/phenotype-config/` | Configra#2 |
| 10.5 | `phenotype-config-rs/*` → `Configra/phenotype-config-rs/` | Configra#3 |
| 10.6 | `settly-config/*` → `Configra/settly-config/` | Configra#4 |
| 10.7 | `settly-config-rs/*` → `Configra/settly-config-rs/` | Configra#5 |
| 10.8 | `phenotype-python-sdk/phenotype_config/*` → `Configra/phenotype-python-config/` | Configra#6 |
| 10.9 | `phenotype-config` README → deprecation notice | phenotype-config#2 |
| 10.10 | `pheno-config` README → deprecation notice | pheno-config#1 |
| 10.11 | `settly-config*` READMEs → deprecation notice | settly-config#1 (squash) |
| 10.12 | Update SSOT.md, AGENTS.md, STATUS.md references | monorepo (this branch) |

## Consequence

- Configra is the only Rust config crate going forward
- 7 source repos are deprecated (1 kept: Conft, TS edge)
- 28-day grace period from migration complete to repo archive
- All 8 PRs reviewed by `pheno-tracing` + `pheno-errors` co-owners

## Cross-references

- ADR-031 (canonical name)
- ADR-022 (Rust/TS edge split, naming only superseded)
- ADR-024 (71-pillar audit gates)
- `findings/2026-06-18-L8-001-configra-absorption-plan.md`
