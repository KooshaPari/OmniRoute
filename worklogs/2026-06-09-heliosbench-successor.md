# ADR: Migrate Active Development from heliosBench to Benchora

- **Status:** PROPOSED
- **Date:** 2026-06-09
- **Project tag:** [cross-repo]
- **Category:** GOVERNANCE / DEPENDENCIES

## Context

`KooshaPari/heliosBench` — the prior Rust benchmark/criterion harness referenced in early R&D sweeps — is archived and read-only. `KooshaPari/Benchora` is an active, maintained Rust criterion framework that supersedes it on the same axis (microbenchmark + regression suite), and is the natural home for any forward-looking benchmark work. Continuing to author new criterion work against an archived repo violates the wrap-over-hand-roll and dependency-freshness mandates in `~/.claude/CLAUDE.md`.

## Decision

Adopt `KooshaPari/Benchora` as the canonical successor to `heliosBench` for all new and migrated Rust benchmark work in the Phenotype ecosystem. Treat `heliosBench` as a read-only historical reference; do not add new benchmarks, fixtures, or CI hooks against it.

## Consequences

- New Rust benchmark crates MUST depend on `Benchora` (cargo dep) rather than re-implementing criterion wrappers locally.
- Any planned migration of in-tree benchmark fixtures from `heliosBench` to `Benchora` is unblocked and should be tracked as a follow-up work package.
- References to `heliosBench` in docs, ADRs, and worklogs are updated to point at `Benchora` once this ADR is accepted.
- Archived `heliosBench` is retained (not deleted) for archaeology and provenance.

## Alternatives Considered

- **Fork and revive `heliosBench`** — rejected: maintenance burden duplicates `Benchora`; archival signals intent.
- **Hand-roll a new criterion wrapper** — rejected: violates wrap-over-hand-roll mandate.

## Rollout

1. Update `ARCHITECTURE` and `DEPENDENCIES` worklogs with this decision.
2. Add a one-line note in the global CLAUDE benchmark pointer.
3. Open follow-up tracking item for any in-flight `heliosBench` callers.
