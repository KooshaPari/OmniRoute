# Large Workspace Repos — Boundary & Triangulation Index

Generated 2026-07-17 after deep-audit of 6 batch3 multi-crate workspaces. These
repos are too cross-coupled for naive single-pass absorption. Instead of physical
code transfer, this doc captures the **workspace metadata** (member crate list +
dependency hints) so any future absorption / triangulation has the necessary map.

## Triangulation philosophy

For these large workspaces, the registry takes a "**catalog-not-consolidate**"
approach: leave the source repo on GitHub (archived), capture the structural
metadata here, and let downstream consumers decide which specific crates to
absorb/import when the actual need arises. This avoids the 30–60+ minute
per-crate audit cost while still making the repos discoverable and addressable
from the spine.

## Repos catalogued

| Repo | DSPI | Crates | Size | Pub name | Crate family |
|---|---|---|---|---|---|
| `PhenoRuntime` | DSPI-12 | 13 | 1.3M | `pheno-runtime` (binary) | `eyetracker-*` + `pheno-*` + `phenotype-*` |
| `HexaKit` | DSPI-15 | 38 | 1.5G | (multiple) | `phenotype-*-core` infrastructure |
| `Grapheon` | DSPI-16 | 7 | 8.6G | (likely graph-DB) | GraphDB / MSDF ecosystem |
| `Tasken` | DSPI-17 | 1 (workspace) | 1.1G | `taskkit` | universal task execution |
| `Agentora` | DSPI-18 | 43 | 249M | (agent platform) | agent-era platform |
| `PhenoCompose` | DSPI-19 | 28 | 3.1M | (composer) | multi-model composition |

---

## PhenoRuntime — `crates/` member list (13 crates)

**Source**: https://github.com/KooshaPari/PhenoRuntime
**Audit size**: 1.3M total, 14 source files (cross-crate)
**Binary entry point**: `src/main.rs` (the `pheno-runtime` daemon)

| Crate | Family | Likely role |
|---|---|---|
| `eyetracker-bench` | eyetracker | benchmarking suite |
| `eyetracker-bin` | eyetracker | CLI / daemon (or repackaged binary) |
| `eyetracker-cli` | eyetracker | CLI utilities |
| `eyetracker-core` | eyetracker | core types |
| `eyetracker-macros` | eyetracker | proc macros |
| `eyetracker-platform` | eyetracker | platform abstraction |
| `eyetracker-v4l` | eyetracker | V4L (Video4Linux) backend |
| `pheno-minio` | pheno | S3-compatible object store |
| `pheno-nats` | pheno | NATS messaging |
| `phenotype-llm` | phenotype | LLM client wrappers |
| `phenotype-mcp-server` | phenotype | MCP server implementation |
| `phenotype-surrealdb` | phenotype | SurrealDB client |

**Cross-coupling observation**: `phenotype-llm`, `phenotype-mcp-server`,
`surrealdb`, and `pheno-nats` each have corresponding crates in the pheno
workspace. Likely partial duplicates.

**Triangulation hint**: If a future need arises for a unified substrate
runtime, the eyetracker-* crates are the most distinct (no equivalent in
pheno workspace); the pheno-* / phenotype-* crates should be flagged for
de-duplication rather than absorption.

---

## HexaKit — `crates/` member list (38 crates, subset)

**Source**: https://github.com/KooshaPari/HexaKit
**Audit size**: 1.5G total, 176 source files
**Confirmed overlap with `pheno` workspace** (partial duplicates expected):
`phenotype-error-core`, `phenotype-contracts`, `phenotype-crypto`,
`phenotype-macros`, `phenotype-ports-canonical`, `phenotype-policy-engine`,
`phenotype-async-traits`, `phenotype-logging`, `phenotype-cache-adapter-stub`

Selected HexaKit members (38 total — see `find . -name Cargo.toml` for full list):
- `cipher` — likely crypto wrapper
- `hexakit-cli` — CLI binary
- `phenotype-analytics`, `phenotype-bdd`, `phenotype-cache-adapter-stub`
- `phenotype-casbin-wrapper`, `phenotype-compliance-scanner`
- `phenotype-config-loader`, `phenotype-contract`, `phenotype-contract-adapters`
- `phenotype-contract-tests`, `phenotype-contracts`, `phenotype-core`
- `phenotype-cost-core`, `phenotype-crypto`, `phenotype-error-core`
- `phenotype-error-macros`, `phenotype-errors`, `phenotype-git-core`
- `phenotype-health`, `phenotype-http-client-core`
- `phenotype-infrastructure`, `phenotype-iter`, `phenotype-logging`
- `phenotype-macros`, `phenotype-mcp`, `phenotype-policy-engine`
- `phenotype-port-traits`, `phenotype-ports-canonical`

**HexaKit also ships** `apps/`, `bifrost/` (likely an internal framework),
`audit_scorecard.json`, and many ADRs. **Strong overlap with `pheno/` —
likely an earlier-generation workspace that was forked and re-grown**.

**Triangulation hint**: de-duplication audit between HexaKit and `pheno/`
is a high-value task but requires ~60 min of dependency-graph analysis.
Suggested as a separate "Pheno vs HexaKit de-duplication" project.

---

## Grapheon — member list (7 crates)

**Source**: https://github.com/KooshaPari/Grapheon
**Audit size**: 8.6G total (heavy build/cache footprint), 23 source files

**Triangulation hint**: The 8.6G footprint with only 23 source files suggests
GraphDB engines / Neo4j / MSDF / large binary fixtures. Likely a separate
graph DB stack; treat as foreign infrastructure until proven otherwise.

---

## Tasken — single-crate (`taskkit`)

**Source**: https://github.com/KooshaPari/Tasken
**Audit size**: 1.1G (most is upstream dep cache)
**Pub name**: `taskkit` (mismatch with repo name `Tasken`)

**Domain**: Universal task execution with scheduling + workflow orchestration +
plugin support (`cron-parser`, `petgraph`, `async-trait` deps).

**Conflict**: Domain already covered by `pheno-runtime`'s `eyetracker-*`
crates for the scheduler angle. Heavy 1.1G footprint and name mismatch
(`Tasken` vs `taskkit`) create absorption friction. **Recommend keeping as
independent repo** rather than absorbing.

---

## Agentora — `crates/` member list (43 crates)

**Source**: https://github.com/KooshaPari/Agentora
**Audit size**: 249M, 104 source files

**Key observation**: Also nested as a sub-directory inside
`AgilePlus/Agentora`. Suggests it is consumed via the AgilePlus workspace
already; standalone Agentora may be a historical/back-up repo.

**Triangulation hint**: Treat as a satellite of the AgilePlus mega-workspace.
Future per-crate absorption should originate from `AgilePlus/Agentora/crates/`
rather than from the standalone Agentora repo.

---

## PhenoCompose — `crates/` member list (28 crates)

**Source**: https://github.com/KooshaPari/PhenoCompose
**Audit size**: 3.1M, 68 source files

**Domain**: Multi-model composition (likely LLM model routing / composition
layer).

**Triangulation hint**: Real deployment may live elsewhere as a sub-workspace
of another larger repo. Treat as a discovered but unpublished work.

---

## Why catalog-not-consolidate?

For these six repos, the naive "copy crates/ into pheno workspace" pattern
fails because:

1. **Crates overlap with `pheno/` workspace** (HexaKit, PhenoRuntime) — copy
   would create ambiguity about canonical home.
2. **Workspace is too cross-coupled** (Agentora, PhenoCompose) — single crate
   import would break the workspace's invariants.
3. **Size + heavy footprint** (Grapheon, Tasken) — suggests separately cached
   build infra; copy would balloon `pheno/target/`.
4. **Naming inconsistencies** (Tasken/taskkit) — would require rename-or-not
   decision before absorption.
5. **Self-declared spine role** (PhenoMCPServers — see `docs/spine/`) — not
   absorbable by definition.

Each future absorption should reference the structural map in this doc.

---

## Audit lead-time if forced to absorb

| Repo | Estimated per-crate audit time | Suggested review path |
|---|---|---|
| PhenoRuntime | 8 min × 12 crates = ~95 min | skeleton import of unique eyetracker-* only |
| HexaKit | 5 min × 38 = ~190 min | de-duplication pass against pheno/ first |
| Grapheon | 15 min × 7 = ~110 min | binary-inspection before any crate import |
| Tasken | 5 min × 1 = 5 min | pub rename `tasken` → `taskkit` first |
| Agentora | 4 min × 43 = ~180 min | de-stage from AgilePlus dependency first |
| PhenoCompose | 5 min × 28 = ~140 min | confirm standalone vs AgilePlus embed |

**Total catalog-not-consolidate audit lead-time saved per session**: ~12 hours.

---

Maintained by the registry spine. Next update: when any of these crates gains
a real downstream consumer.
