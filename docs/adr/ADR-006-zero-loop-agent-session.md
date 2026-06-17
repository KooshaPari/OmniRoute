# ADR-006: Zero-Loop Agent Session Contract

**Status:** Accepted  
**Date:** 2026-06-17  
**Context:** PhenoProc gap port sessions incurred rediscovery loops (wrong owner, late split PRs, stub deps, context summarize). Goal: optimize agent sessions toward **zero-shot / zero-loop** execution.

## Decision

### Required before implementation (absorption / boundary / fleet)

1. Read `BOUNDARY_OWNERS.md` relevant sections.
2. Assign an **ECOSYSTEM_DAG** lane; respect gate deps (registry SSOT before bulk merge).
3. Create or open `docs/sessions/YYYYMMDD-<slug>/` with at least `01_RESEARCH.md` and `03_DAG_WBS.md`.
4. Name **split-target owners** in DAG before bulk file copy.
5. Open or link **AgilePlus spec** for non-trivial work.

### Required before merge

1. Tracker doc updated (coverage, gate status, sibling PRs).
2. `06_TESTING_STRATEGY.md` commands executed or explicitly deferred as `[NB]`.
3. `07_CROSS_PROJECT_SYNC.md` lists merge order.

### Agent entry packet (minimum)

`BOUNDARY_OWNERS` + lane row + session 01/03 + open PR table + absorption manifest (if staging).

### Metrics (dogfood)

Track: boundary mis-placements, clarification rounds, post-port build surprises, split PR latency. Target: ≤1 clarification round per absorption session.

## Consequences

- “Do all incl non-blockers” means DAG `[NB]` leaves — not unbounded scope.
- Summarized conversations resume from session folder + AgilePlus spec — not chat memory alone.
- phenotype-registry hosts plan + DAG + protocol as fleet SSOT.

## References

- `docs/rationalization/SESSION_ARTIFACT_PROTOCOL.md`
- `docs/rationalization/ECOSYSTEM_DAG.md`
