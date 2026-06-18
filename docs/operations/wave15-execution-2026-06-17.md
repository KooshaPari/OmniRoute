# Wave 15 — Gateway fork cluster SSOT correction — 2026-06-17

**Predecessor:** [wave14-gateway-ssot-2026-06-17.md](./wave14-gateway-ssot-2026-06-17.md)  
**ADR:** [ADR-ECO-007-gateway-merge-superset](../adrs/ADR-ECO-007-gateway-merge-superset.md)  
**DAG:** [GATEWAY_MERGE_DAG.md](../rationalization/GATEWAY_MERGE_DAG.md)  
**Session evidence:** [11_GATEWAY_FORK_AUDIT.md](../sessions/20260617-ecosystem-gap-port-retro/11_GATEWAY_FORK_AUDIT.md)

## Charter

Correct stale registry guidance that recommended archiving **OmniRoute**, **agentapi-plusplus**, **cliproxyapi-plusplus**, and **phenotype-omlx** as "upstream-only, no local changes." Remote audit (2026-06-17) shows active multi-branch forks with org consumers — especially `substrate` `engine-agentapi` → `agentapi-plusplus`.

Establish three-layer doctrine (governance / platform / engine) and unblocks lanes G15–G19.

## Remote audit baseline (gh, 2026-06-17)

| Repo | Archived | Branches | Fork parent | Registry verdict |
|------|----------|----------|-------------|------------------|
| agentapi | Yes | 2 | — (tombstone) | **KEEP_ARCHIVED** — docs-only unique commits |
| **agentapi-plusplus** | No | 35 | coder/agentapi | **UNIFY** — superset merge (G15) |
| cliproxyapi-plusplus | No | 16 | router-for-me/CLIProxyAPI | **UNIFY** — superset merge (G16) |
| bifrost | No | 339 | maximhq/bifrost | **VENDOR-KEEP** — pin + prune (G17) |
| OmniRoute | No | 26 | diegosouzapw/OmniRoute | **CANONICAL** `route` — never archive |
| substrate | No | 24 | — | **AFFIRM** — `engine-agentapi` hub |
| phenotype-omlx | Yes | 27 | jundot/omlx | **SPLIT** platform/engine (G18 ADR) |
| phenotype-hub | Yes | 17 | — | **ABSORB** → phenotype-infra (G19) |
| vibeproxy-monitoring-unified | Yes | — | — | **RETIRE** stub (G19) |
| agileplus-spec-harmonizer | No | 1 | — | **AFFIRM** tooling |
| Paginary | Yes | 11 | — | **TRIAGE** (G19) |

## Registry files updated (this PR)

| File | Action |
|------|--------|
| `RATIONALIZATION_PLAN.md` | Strike OmniRoute/agentapi++/cliproxy++ from archive lists; supersession banner |
| `ECOSYSTEM_MAP.md` | Cluster M (gateway/agent); fix §6 archive table; Paginary + harmonizer |
| `BOUNDARY_OWNERS.md` | Gateway / agent-control / vendor rows |
| `DOMAIN_ROLES.md` | `route`, `cli_proxy`, `inference`, `agent-control` |
| `registry/disposition-index.json` | External-repo disposition rows |
| `registry/domain-roles.json` | MCP/connect canonicals (ADR-017) |
| `projects/agentapi-plusplus.json` | NEW |
| `projects/cliproxyapi-plusplus.json` | NEW |
| `projects/substrate.json` | NEW |
| `projects/OmniRoute.json` | NEW |
| `docs/sessions/.../11_GATEWAY_FORK_AUDIT.md` | NEW — branch matrix + consumer scan |

## Contradictions resolved

| Stale claim | Location | Correct ruling |
|-------------|----------|----------------|
| Archive OmniRoute in Step 1 | `RATIONALIZATION_PLAN.md` | Removed — OmniRoute canonical per Cluster A |
| Archive agentapi++/cliproxy++/omlx "no local mods" | PLAN, ECOSYSTEM_MAP §6 | Superset merge or vendor pin |
| cliproxy superseded by phenoAI/bifrost | PLAN absorption list | cliproxy = CLI proxy gateway; unrelated |
| phenotype-hub → registry only | ECOSYSTEM_MAP P8 | **phenotype-infra** absorbs docs; registry redirect |
| `domain-roles.json` lists PhenoMCP | `registry/domain-roles.json` | Sync to ADR-017 PhenoFastMCP* + substrate |

## Wave ledger (G15–G19)

| Wave | ID | Owner repo | Status |
|------|-----|------------|--------|
| 15 | SSOT | phenotype-registry | **this PR** |
| G15 | agentapi++ | agentapi-plusplus + substrate | pending |
| G16 | cliproxy | cliproxyapi-plusplus + go-sdk | pending |
| G17 | bifrost | bifrost | pending |
| G18 | omlx | phenotype-registry ADR-ECO-008 | pending |
| G19 | stubs | phenotype-infra + registry | pending |
| 14 | HexaKit | phenoShared + HexaKit | parallel lane |

## PR tracker

| PR | Repo | Status |
|----|------|--------|
| docs/wave15-gateway-fork-ssot | phenotype-registry | open |

## DELETE gate (fork cluster)

| Repo | Verdict | Blocker |
|------|---------|---------|
| agentapi | KEEP_ARCHIVED | Tombstone only |
| agentapi-plusplus | UNIFY then AFFIRM | Spec + superset merge (G15) |
| cliproxyapi-plusplus | UNIFY before pin | go-sdk vendor SHA (G16) |
| bifrost | KEEP vendor fork | No merge into OmniRoute |
| phenotype-omlx | SPLIT; optional unarchive | ADR-ECO-008 + staffing gate |
| OmniRoute | NEVER archive | Canonical `route` |

## Next

1. **G15** — `integrate/agentapi-superset` branch merge + unified spec
2. **G16** — cliproxy superset + `third_party` pin
3. **G17** — `phenotype/vendor-2026-06` + branch prune
4. **G18** — ADR-ECO-008 omlx platform/engine split
5. **G19** — phenotype-hub + vibeproxy-monitoring-unified absorption
