# ADR-ECO-015: Hybrid gateway — app layer, Go planes, desktop convergence

## Status
Accepted (2026-06-18)

## Context

Wave H established **phenotype-gateway** as the long-term domain owner with Go submodule planes ([ADR-ECO-014 phenotype-gateway charter](./ADR-ECO-014-phenotype-gateway-charter.md)). User charter (2026-06-18) refines:

- **OmniRoute** serves as the **app/shell layer** (TypeScript), not a discard-only interim
- **vibeproxy** desktop client attempts must **converge** with OmniRoute into one final desktop path
- **Rust / Zig / Mojo spikes** pursue max-opt components; promote winners into `packages/` per parity gate
- **Go planes** stay in phenotype-gateway submodules (agentapi++, cliproxy++, bifrost, argis)

## Decision

### Three-tier model

| Tier | Owner | Role |
|------|-------|------|
| **App layer** | **OmniRoute** (+ unified desktop client) | TS router UI, app shell, desktop packaging (menu-bar / tray) |
| **Go planes** | **phenotype-gateway** `third_party/` → `packages/` | agentapi++, cliproxy++, bifrost, argis-extensions |
| **Opt spikes** | phenotype-gateway `spikes/{rust,zig,mojo}/` | Hot-path router, FFI bridges, numeric/ML adjacency |

### Desktop client convergence

1. Audit vibeproxy (6 branches) + OmniRoute (26 branches) for desktop/UI/client commits
2. Evaluate spike matrix: **native Swift**, **FFI-only**, **FFI+Electrobun**, **FFI+Tauri**
3. Single target path: `OmniRoute/apps/desktop/` or `phenotype-gateway/spikes/desktop/` (chosen in spike ADR appendix)
4. vibeproxy repo remains **redirect-only**; harvest unique client code into chosen spike

### OmniRoute status amendment

- **Not** "discard after revamp" — **app-layer owner** until desktop + router UI fully absorbed
- Router **logic** may still revamp inside `packages/router`; OmniRoute owns **product shell** and deployment UX

### Promotion

- Submodule → `packages/<plane>` when ≥80% parity per [GATEWAY_FEATURE_PARITY.md](../rationalization/GATEWAY_FEATURE_PARITY.md)
- Spike → package when benchmark beats Go baseline on scoped component

## Consequences

- Amend `ECOSYSTEM_MAP.md` Cluster A: OmniRoute = app layer; phenotype-gateway = Go plane owner
- Wave ledger: desktop client spike (H9), submodule pins (H6 follow-up)
- vibeproxy branch harvest feeds desktop spike, not a third canonical repo

## Related

- [ADR-ECO-007-gateway-merge-superset](./ADR-ECO-007-gateway-merge-superset.md)
- [ADR-ECO-014-phenotype-gateway-charter](./ADR-ECO-014-phenotype-gateway-charter.md)
- [wave-h-gateway-charter-2026-06-17.md](../operations/wave-h-gateway-charter-2026-06-17.md)
