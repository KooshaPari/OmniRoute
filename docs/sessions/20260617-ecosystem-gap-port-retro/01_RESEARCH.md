# Research — Ecosystem Gap Port Retro

## Boundary owners touched

| Source | Staging | Canonical owner |
|--------|---------|-----------------|
| PhenoProc `pheno-*` Python | Agentora `agents/phenoagent/python/` | **Agentora** |
| PhenoProc Rust crates (bulk) | Agentora `crates/` | **Agentora** (agent) + **HexaKit** (`phenotype-*` audit) |
| `agileplus-*` | Agentora `crates/agileplus-*` | **AgilePlus** (mis-placed — repatriate) |
| `phenotype-router-monitor` | Agentora + tooling `absorption/` | **phenotype-tooling** |
| `phenotype-governance` templates | phenokits `governance/phenoproc-*` | **phenokits-commons** |
| Metron | PhenoObservability `crates/metrickit` | **PhenoObservability** |

## Loops observed (dogfood)

1. **agileplus in Agentora** — boundary not checked pre wave 5
2. **Split PRs after bulk commit** — router-monitor, governance
3. **Stub Cargo.toml** — bifrost-routing, forgecode-core missing deps
4. **Context summarize** — mid-task state loss
5. **“Do all incl non-blockers”** — needed explicit NB list in DAG

## Open PRs (2026-06-17)

- registry #76, Agentora #79, PO #157, phenokits #3, tooling #155

## Deferred (no work)

GDK, hwLedger, FocalPoint, KaskMan — `LANGUAGE_STACK.md` schizo tier
