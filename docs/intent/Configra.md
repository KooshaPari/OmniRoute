---
id: configra
repo: KooshaPari/Configra
name: Configra
status: active
tier: pheno-lib
architecture: layered
language: rust
role: config
adr_refs:
  - ADR-031
  - ADR-022
  - ADR-023
  - ADR-040
---

# Intent — Configra

## Purpose

Canonical configuration substrate for the Phenotype fleet. Replaces the
historically-scattered config crates (`phenotype-config`, `pheno-config`,
`settly`, `Conft`, `settly-*`) with a single workspace of four
sub-crates, each with a distinct concern and a tier-2 library quality
bar (ADR-023, ADR-040).

## Why this exists

Before Configra, config code was scattered across 5+ repos with no
shared quality bar, no shared schema, and no canonical migrations. The
absorb waves (ADR-022 + ADR-031 + L5-104.7 + L5-110 + L5-500) drained
all unique content into Configra and deprecated the sources.

## What it is

| Sub-crate | Concern | Tier-2 artifact set |
| --- | --- | --- |
| `pheno-config` | Typed runtime `Config` + `ConfigBuilder` | README · CHANGELOG · AGENTS · llms.txt |
| `settly` | Settings lifecycle (validation, migration) | README · CHANGELOG · AGENTS |
| `config-schema` | JSON-schema field-shape validator | README · CHANGELOG · AGENTS |
| `phenotype-config-loader` | Generic JSON/TOML file loaders | README · CHANGELOG · AGENTS |

## What it is NOT

- Not a feature-flag runtime (lives in `phenotype-feature-flags`).
- Not an auth/secrets store (lives in `Authvault`).
- Not a JSON-schema DSL (use a real schema library for Draft 4/7/2020-12).
- Not a single crate — it is a 4-crate workspace by design (smallest
  viable dependency surface per consumer).

## Cross-references

- [Boundary](../boundary/Configra.md) — in-scope / out-of-scope table.
- monorepo ADR-031 — Configra absorb.
- monorepo ADR-022 — config consolidation (two-crate canonical split).
- monorepo ADR-023 — agent-effort governance.
- monorepo ADR-040 — test-coverage gates per tier.
- [ADR-ECO-017](../adrs/ADR-ECO-017-substrate-schema-conventions.md) —
  registry substrate catalog schema (this repo).
