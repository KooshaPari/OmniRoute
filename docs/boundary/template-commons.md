# Absorbed boundary — template-commons

This document describes the absorbed boundary of `KooshaPari/template-commons`
after its absorption into `phenokits-commons/templates/` on 2026-07-17.

## Identity

| Field | Value |
|-------|-------|
| Original repo | `KooshaPari/template-commons` |
| Original URL | https://github.com/KooshaPari/template-commons |
| Original description | "template-commons - shared template workflows and ADR sessions (deleted remote recovery)" |
| Original default branch | `main` |
| Canonical home | `KooshaPari/phenokits-commons/templates/` (selective subtree) |
| Subset also absorbed | `KooshaPari/phenokits-commons/docs/template-kitty-specs/` |
| Absorption date | 2026-07-17 |
| Final state | GitHub archived (terminal) |

## What this boundary now covers

The absorbed content divides into two layers:

### Layer A — language-specific templates (`phenokits-commons/templates/<name>/`)

A template directory provides a complete, ready-to-clone skeleton for one
language/framework combination. Each template is responsible for:

- bootstrapping a new project from scratch (`pip install -e .` / `go mod tidy`)
- shipping example code that demonstrates the idiom
- a working `pyproject.toml` / `go.mod` / `package.json`
- a `README.md` documenting intent and usage

Templates that were carried over from template-commons:

| Path | Language | Idiom |
|------|----------|-------|
| `phenotype-config` | Python | pydantic config loader |
| `phenotype-id` | Python | deterministic ID generator |
| `phenotype-logging` | Python | structlog bootstrap |
| `phenotype-py-kit` | Python | kit superset (api+config+logging+testing) |
| `phenotype-testing` | Python | pytest harness + property-based testing fixtures |
| `phenotype-toolkit` | (multi) | tool index |
| `plugin-typescript` | TypeScript | Vite plugin idiom |
| `phenotype-go-kit` | Go | kit super-template |
| `phenotype-go-auth` | Go | OAuth + token primitives |
| `phenotype-go-cli` | Go | cobra scaffold |
| `phenotype-go-config` | Go | viper-based config loader |
| `phenotype-go-middleware` | Go | http middleware patterns |

### Layer B — kitty-spec for commons conventions (`phenokits-commons/docs/template-kitty-specs/001-commons/`)

Spec documents capturing cross-template invariants (naming, versioning,
release flow) that **every** template in the kit must follow.

## Rationale for selective absorption

template-commons shipped 30+ template directories plus governance/boilerplate
(PRD.md, COMPARISON.md, FUNCTIONAL_REQUIREMENTS.md, ADR-018, worklog.md,
CI workflows, contracts). The choose-what-matters policy here:

1. **Add the missing, never override the existing.** phenokits-commons already
   had a `templates/` store. We only added templates that did NOT already exist
   locally (no `phenotype-config` etc. existed in phenokits-commons before).
2. **Skip governance drift.** phenokits-commons has its own governance layer
   (`governance/`, `SSOT.md`, `STATUS.md`, `Phenotype-Actions-ADR.md`).
   Copying in the template-commons governance artifacts would create noise.
3. **Keep kitty-spec intent, drop boilerplate.** One kitty-spec (the
   commons-level cross-domain spec) had standalone value. The rest of
   `docs/`, `scripts/`, `tests/`, `contracts/`, `.github/` had no
   phenokits-commons surface to attach to and risked drift.

## What is NOT covered by this boundary

- Overlapping templates that already existed in `phenokits-commons/templates/`
  (`clean-rust`, `hexagonal-*`, `microservice-scaffold`, `phenotype-api`) —
  the older, more-developed versions win; the source versions are **not** imported.
- Governance / boilerplate from template-commons — left in source repo (now
  archived on GitHub).
- Nested `templates/hexagonal-{go,rust}` inside template-commons — these
  were duplicates of root-level `hexagonal-{go,rust}` and were shadowed.

## Consumers

Code that wants to use an absorbed template clones or downloads the
specific directory under `phenokits-commons/templates/`. The PRD-style
"versioned commons" contract that template-commons documented (semver
publishing, task check release flow) applies to **each template** independently
— there is no global template-commons version. Releases happen per-template
under phenokits-commons semver discipline.

## Provenance

See `docs/absorption/template-commons/README.md` for the transfer record.
