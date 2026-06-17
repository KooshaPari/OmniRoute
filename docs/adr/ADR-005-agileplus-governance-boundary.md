# ADR-005: AgilePlus Governance Boundary

**Status:** Accepted  
**Date:** 2026-06-17  
**Context:** PhenoProc wave 5 ported `agileplus-*` crates into Agentora `crates/`. ECOSYSTEM_MAP lists AgilePlus as dual tooling/product role for spec-driven polyrepo governance.

## Decision

| Owns | Does not own |
|------|----------------|
| **AgilePlus** repo: CLI, `.agileplus/` state, specify→ship lifecycle, triage, validate, sync, telemetry for specs | Agentora agent runtime, pheno-proc plane |
| **phenokits-commons**: CI/governance **templates** and per-language **configs** | Spec content registry (PhenoSpecs) |
| **phenotype-org-governance**: org-wide reusable CI policy workflows | Per-feature implementation |
| **phenotype-registry**: boundary SSOT, ecosystem DAG, ADRs | AgilePlus SQLite / CLI binaries |

AgilePlus **mandates** all non-trivial work tracked via `agileplus specify`; PRs link spec IDs.

## Repatriation

Crates staged in Agentora (`agileplus-triage`, `agileplus-telemetry`, `agileplus-sync`, `agileplus-subcmds`) move to AgilePlus workspace. Missing siblings (`agileplus-domain`, `agileplus-events`) must land before workspace registration.

## Consequences

- `agileplus validate` should consume templates from `phenokits-commons/governance/phenoproc-*`.
- New repos bootstrap governance from phenokits + HexaKit `.template.*` — not PhenoProc archives.
- Agentora keeps only integration hooks (if any), not governance substrate crates.

## References

- `CONTRIBUTING.md` — AgilePlus spec mandate
- `docs/rationalization/ZERO_LOOP_ECOSYSTEM_PLAN.md` §4 Phase 1
