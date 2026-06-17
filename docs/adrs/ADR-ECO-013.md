# ADR-ECO-013: phenotype-registry as integration meta-repo

## Status
Accepted

## Context
Polyrepo fleet needs composition validation without monorepo code (GitHub Well-Architected integration layer).

## Decision
`phenotype-registry` holds `registry/components.lock`, integration CI pins, and cross-repo smoke — **not** domain implementation code.

## Consequences
`components.lock` updated after each wave merge. `check-ecosystem.ts` extended to validate lock consistency.
