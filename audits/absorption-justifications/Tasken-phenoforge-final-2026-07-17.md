# Tasken-phenoforge-final — Absorption Justification

**Status:** ARCHIVED 2026-07-17 (recovery snapshot, preserves verbatim)
**Source:** `KooshaPari/Tasken-phenoforge-final` (Rust + Python + Markdown)
**Target:** phenotype-registry at `docs/boundary/Tasken-phenoforge-final.md`
**Disposition:** ARCHIVE_ONLY

## Recovery-snapshot rationale

This repo is explicitly described on GitHub as:

> recovery snapshot of Tasken-phenoforge-final (2026-07-15)

The README §"Absorbed phenoForge contract" declares:

> phenoForge build-orchestrator research and product intent is preserved under
> docs/history/archived-repos/phenoForge/. Tasken remains the canonical active
> task orchestration product; phenoForge material is historical input for
> build-runner, DAG, caching, plugin, and remote execution requirements.

The snapshot captures the Tasken source tree at the moment the phenoForge
contract material was folded in. Its value is provenance, not active
development.

## Confidence

**N/A** — recovery snapshot. No code lift; no consumer is expected to
`cargo build` or `pip install` against this repo.

## Repo profile

| Field | Value |
| ----- | ----- |
| GitHub name | `Tasken-phenoforge-final` |
| Description | `recovery snapshot of Tasken-phenoforge-final (2026-07-15)` |
| Size (GitHub) | 419 KB |
| Size (disk incl. `target/`) | 144 MB |
| Default branch | `chore/governance-baseline` |
| Created | 2026-07-16T00:25:38Z |
| Last push | 2026-07-16T00:37:11Z |
| Archived at | 2026-07-17T14:57:07Z (`gh repo archive -y`) |
| isArchived | true (verified) |
| Local path | `repos/Tasken-phenoforge-final/` (git-tracked, retained) |

## Preserved phenoForge provenance

Tree at `docs/history/archived-repos/phenoForge/` — 10 documents that anchor
the absorbed contract:

- `ADR.md` — phenoForge architectural decision records
- `ARCHIVED.md` — closure marker for the phenoForge thread
- `FUNCTIONAL_REQUIREMENTS.md` — phenoForge FR set
- `ORIGIN.md` — phenoForge origin / lineage
- `PLAN.md` — phenoForge implementation plan
- `PRD.md` — phenoForge product requirements
- `README.md` — phenoForge entry point
- `SOTA_RESEARCH.md` — phenoForge state-of-the-art research
- `SPEC.md` — phenoForge formal specification
- `TEST_COVERAGE_MATRIX.md` — phenoForge test-coverage matrix

Plus companion note `docs/history/archived-repos/forge.md`.

## Cross-references

- Companion registry file: `projects/phenoForge.json` (already records
  `absorbed_into: Tasken`, `absorption_note: "Phenotype task-runner fork
  absorbed into Tasken (task orchestration); source repo deleted
  2026-06-16"`).
- Canonical active product: `KooshaPari/Tasken` (DSPI-17 row, ARCHIVE_ONLY
  pending 2026-07-17-queue-refresh-batch3; canonical ownership recorded in
  `catalog/registry.yaml` id `tasken`).
- Boundary doc: `phenotype-registry/docs/boundary/Tasken-phenoforge-final.md`
  (records provenance + absorbed relationship).
- Local source retained at `repos/Tasken-phenoforge-final/` per container
  policy (do not delete; the dirty child repository must not be bulk-cleaned
  without a repository-specific audit).

## Restore procedure

```sh
gh repo unarchive KooshaPari/Tasken-phenoforge-final
# No registry row changes required — this row already records archived_at
# 2026-07-17T14:57:07Z and fsm=archived; an unarchive would only require
# flipping isArchived back via gh + removing the row's archived_at field
# if the snapshot needs to be reactivated.
```

## Why ARCHIVE_ONLY (not ABSORB)

- The repo's GitHub description and README explicitly identify it as a
  recovery capture of Tasken, not an independent substrate.
- The phenoForge source code is gone (deleted 2026-06-16); only docs were
  preserved into the snapshot.
- Tasken (`KooshaPari/Tasken`) remains the canonical active task
  orchestration product and already absorbed the phenoForge contract.
- Flat `cp -r Tasken-phenoforge-final/* ...` would either duplicate Tasken
  canonical or copy a recovery snapshot into a substrate folder, which is
  provenance pollution rather than a clean lift.