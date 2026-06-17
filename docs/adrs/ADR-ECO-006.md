# ADR-ECO-006: Retire plan v1 monorepo absorption

## Status
Accepted

## Context
May `RATIONALIZATION_PLAN.md` absorbs pheno, Metron, Traceon, etc. into HexaKit monorepo. Jun 16 charter dissolves HexaKit workspace into domain SDKs.

## Decision
**Retire** plan v1 absorb-into-HexaKit execution. **Authoritative:** boundary-shaping charter + DISPOSITION.md relocate-out.

## Rationale
HexaKit end-state is scaffolding-only. Monorepo absorb conflicts with DOMAIN_ROLES and STACK_POLICY.

## Consequences
`RATIONALIZATION_EXECUTION.md` repoint targets use canonical domain repos, not HexaKit crate paths. Archive shortlist deferred until v2 waves complete.
