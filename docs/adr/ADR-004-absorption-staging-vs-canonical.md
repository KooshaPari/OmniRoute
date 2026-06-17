# ADR-004: Absorption Staging vs Canonical Owner

**Status:** Accepted  
**Date:** 2026-06-17  
**Context:** PhenoProc gap port (Agentora #79) copied ~98% of files into absorber staging trees. Some units (agileplus-*, phenotype-router-monitor, governance templates) belong to **different canonical owners**.

## Decision

1. **Absorption** into an absorber repo (e.g. Agentora) creates **staging source** for retirement audit — not automatic canonical ownership.
2. **Canonical owner** is defined only in `BOUNDARY_OWNERS.md` / `ECOSYSTEM_MAP.md`.
3. **Split-target ports** must land in sibling repos (tooling, phenokits, AgilePlus) before DELETE gate closes.
4. Each staging tree MUST ship an `ABSORPTION_MANIFEST.md` (or equivalent) stating workspace policy and redirect targets.

## Consequences

- Agentora `crates/phenotype-*` are file copies for audit; HexaKit (or rust-sdk) remains canonical for shared infra.
- Agentora `agileplus-*` must repatriate to AgilePlus (ADR-005).
- PhenoProc DELETE requires consumer manifest scan — not 100% file parity in one repo.

## References

- `docs/rationalization/ZERO_LOOP_ECOSYSTEM_PLAN.md` §6
- `docs/rationalization/SESSION_ARTIFACT_PROTOCOL.md`
