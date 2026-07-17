# Boundary — Planify

## In Scope

- **Phenotype-specific landing page** (`site/`) — Astro + Bun + Tailwind for
  `planify.space` landing
- **Phenotype-specific infrastructure** (`infra/`) — docker-compose additions
  on top of Plane upstream
- **Fork provenance** (`MERGES.md`, `UPSTREAM.md`) — consolidation/seed history
  for the makeplane/plane fork

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| `upstream/*` (verbatim Plane fork — `apps/`, `packages/`, etc.) | (stays in Planify repo — DO NOT MODIFY) | Verbatim seed from `makeplane/plane@preview`; upstream updates flow through Planify. Absorbing would break the fork-with-upstream pattern. |
| 97MB `node_modules/` / `.next/` build artifacts | (rebuilt on demand) | Build cache, not phenotype IP |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Plane upstream sync | Planify → makeplane/plane (upstream) | git subtree | green |
| Phenotype landing | Planify/site → phenotype-landing | git import (proposed: `phenotype-landing/planify/`) | amber (pending extract) |
| Phenotype infra | Planify/infra → phenotype-tooling | git import (proposed: `phenotype-tooling/infra/plane.yml`) | amber (pending extract) |
| BLOCK-A dashboard | Planify/upstream/apps/web → AgilePlus | downstream consume | green (already wired) |

## Audit Findings (2026-07-17)

- **Size**: 97M total (mostly build cache, not phenotype IP)
- **Structure**: 3 top-level dirs (`upstream/`, `site/`, `infra/`) + provenance docs
- **Decision**: ARCHIVE_ONLY (not full absorption)
- **Reason**: `upstream/` is a verbatim seed that must remain unmodified.
  Only `site/` and `infra/` carry Phenotype-specific value.
- **Recommended action**: extract just the Phenotype layers into
  `phenotype-apps/planify-customisations/` or merge into `phenotype-landing/`
  + `phenotype-tooling/`.

## Last Boundary Review

**Date:** 2026-07-17
**Reviewer:** registry spine audit (deep-workspace audit, 2026-07-17 batch3)
**Disposition-index row:** DSPI-11
**Decisions:**
- ARCHIVE_ONLY with catalog-not-consolidate pattern.
- `site/` + `infra/` layers recommended for future targeted extraction.

**Next review:** 2027-01-17 (6 months, unless upstream Plane release triggers earlier)
