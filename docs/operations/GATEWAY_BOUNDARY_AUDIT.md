# Gateway Boundary Audit — DELETE gate matrix

> Full DELETE gate for repos in the Gateway & Multi-Repo Merge Rationalization program.  
> Charter: [boundary-shaping.md](../rationalization/boundary-shaping.md) + 5-check gate in [RATIONALIZATION_EXECUTION.md](../../RATIONALIZATION_EXECUTION.md).

## Summary matrix

| Repo | Disposition | Gate | Next step |
|------|-------------|------|-----------|
| agentapi | ABSORB | ✅ archived | Harvest → pointer only |
| agentapi-plusplus | **AFFIRM** cli_proxy | ❌ 34 branches | Wave 15 merge |
| cliproxyapi-plusplus | AFFIRM peer | ❌ 11 branches | Wave 16 |
| bifrost | DYNAMIC-KEEP vendor | ✅ policy | Sync lane only |
| vibeproxy / vibeproxy-monitoring-unified | RETIRE | ✅ | Redirect / stub retire |
| OmniRoute | **AFFIRM** route | ❌ protect | No archive |
| phenotype-omlx | ARCHIVED / FINISH? | 🔶 decision | Wave 17 |
| PhenoCompose | **AFFIRM** platform | ❌ pheno dep | Wave 17b + 18b |
| PhenoRuntime | DELETE | 🔶 harvest | Wave 6 harvest |
| BytePort, Settly, PlatformKit, portage, phenoXddLib | ARCHIVED | ✅ | Wave 18 stubs |
| phenotype-hub, Paginary, acp, thegent-workspace | ARCHIVED/scaffold | ✅ | Wave 18 / G19 — Paginary RETIRE out-of-fleet 2026-06-19 |
| pheno | ARCHIVED last | ❌ fleet refs | Wave 18b — repoint to **role owners**, not phenoShared |
| phenoShared | **DECOMPOSE** | ❌ staging monorepo | ADR-ECO-014 — relocate crates then delete |
| phenotype-e2e-base | ABSORB | 🔶 | Wave 19 → journeys |
| agileplus-spec-harmonizer | AFFIRM tooling | ✅ | Register in map |

## Layer ownership

| Layer | Canonical owners | Never merge |
|-------|------------------|-------------|
| Route / API gateway | OmniRoute, Tokn, agentapi-plusplus | bifrost → OmniRoute |
| Inference runtime | phenotype-omlx (decision), phenoAI consumer | mlx-lm engine into agentapi++ |
| Engine / isolation | nanovms (tooling), PhenoCompose | Into gateway repos |

## Out of scope

- vibeproxy-* reconciliation (user deferral)
- Tracera lane
- FocalPoint vendor, GDK/hwLedger/KaskMan

## pheno fleet blockers (second-order)

Chokepoints green for named consumers; org manifest scan still finds `KooshaPari/pheno` in:

- PhenoCompose (critical — engine repo)
- Agentora, AgilePlus, PhenoPlugins, phenotype-gfx
- Civis, phenotype-teamcomm, phenotype-go-sdk, TestingKit

See `registry/chokepoints.json` → `pheno_fleet_blockers`. Repoint strategy: per-crate **DOMAIN_ROLES** owners (`phenotype-config`, `phenotype-resilience`, `PhenoObservability`, `phenotype-types`, `Eventra`); `phenoShared` is interim staging only ([ADR-ECO-014](../adrs/ADR-ECO-014-phenoshared-decompose.md)).
