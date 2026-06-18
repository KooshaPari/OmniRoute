# ADR-ECO-016: phenotype-omlx platform/engine split (G18)

## Status
Accepted (2026-06-18, Wave G18)

## Context

`phenotype-omlx` is an archived fork of [jundot/omlx](https://github.com/jundot/omlx) (27 branches, macOS menu-bar MLX inference). Registry wave14 audit flagged **FINISH vs DROP** per [ADR-ECO-007 Appendix B](./ADR-ECO-007-gateway-merge-superset.md).

Fleet already has:
- **OmniRoute** — canonical `route` peer (TypeScript)
- **bifrost** — vendor enterprise gateway (Go, pinned)
- **phenoAI** — consumer skeleton workspace
- **Upstream omlx** — engine SSOT at jundot/omlx / omlx.ai

## Decision

**Path: DROP (stay archived)** — no unarchive in G18.

| Layer | Owner | Verdict |
|-------|-------|---------|
| **Engine** | `jundot/omlx` upstream | **CANONICAL** — MLX inference runtime |
| **Platform branding** | `phenotype-omlx` fork | **ARCHIVED** — pointer only; no staffing gate passed |
| **Fleet routing** | OmniRoute + bifrost | Sufficient for gateway/inference orchestration |

### Rationale

1. No active org consumer requires the archived fork's unique commits (grep gate clean).
2. phenoAI + OmniRoute + upstream omlx cover product lanes without resurrecting 27-branch fork sprawl.
3. **FINISH** remains available if staffing gate opens: unarchive → vendor sync lane → branding layer only (no engine merge into gateway repos).

## Consequences

- `phenotype-omlx` disposition: **ARCHIVED** with `fsm: done` (DROP recorded).
- Registry `projects/phenotype-omlx.json` documents upstream pointer.
- DELETE gate: fork stays archived; never merge into OmniRoute or bifrost.
- Revisit FINISH only via new ADR amendment + staffing sign-off.

## Related

- [wave15-execution-2026-06-17.md](../operations/wave15-execution-2026-06-17.md) G18
- [ADR-ECO-007-gateway-merge-superset.md](./ADR-ECO-007-gateway-merge-superset.md) inference layer
