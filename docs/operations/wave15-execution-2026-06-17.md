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
| phenotype-omlx | Yes | 27 | jundot/omlx | **DROP** — stay archived (ADR-ECO-016) |
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
| 15 | SSOT | phenotype-registry | **merged** (#142) |
| G15 | agentapi++ | agentapi-plusplus + substrate | **done** — #535 merged; 1 remote (`main`) |
| G16 | cliproxy | cliproxyapi-plusplus + go-sdk | **done** — #1026, vibeproxy#14, go-sdk#17 merged |
| G17 | bifrost | bifrost | **done** — #7 merged; tag `phenotype/vendor-2026-06`; 1 remote (`main`) |
| G18 | omlx | phenotype-registry ADR-ECO-016 | **done** — DROP; stay archived; engine jundot/omlx |
| G19 | stubs | phenotype-infra + registry | **done** — phenotype-infra#79 merged; hub ABSORB + monitoring stub RETIRE |
| H14 | phenoShared | phenotype-config + phenotype-types + HexaKit | **in_progress** — [phenotype-config#2](https://github.com/KooshaPari/phenotype-config/pull/2), [phenotype-types#1](https://github.com/KooshaPari/phenotype-types/pull/1), [HexaKit#267](https://github.com/KooshaPari/HexaKit/pull/267) |

## PR tracker

| PR | Repo | Status |
|----|------|--------|
| docs/wave15-gateway-fork-ssot | phenotype-registry | merged (#142) |
| G15 branch hygiene | agentapi-plusplus | merged (#535); remote `main` only |
| G16 boundary | cliproxyapi-plusplus | merged (#1026); remote `main` only |
| G16 vibeproxy redirect | vibeproxy | merged (#14) |
| G16 go-sdk pin | phenotype-go-sdk | merged (#17) |
| Gateway UPSTREAM SSOT | phenotype-gateway | merged (#4) — OmniRoute canonical peer |
| H14 config-loader | phenotype-config | open ([#2](https://github.com/KooshaPari/phenotype-config/pull/2)) |
| H14 phenotype-errors | phenotype-types | open ([#1](https://github.com/KooshaPari/phenotype-types/pull/1)) |
| H14 HexaKit pin repoint | HexaKit | open ([#267](https://github.com/KooshaPari/HexaKit/pull/267)) |
| G17 bifrost vendor pin | bifrost | merged (#7); tag `phenotype/vendor-2026-06`; 1 remote |
| G18 omlx ADR | phenotype-registry | open (this PR) — [ADR-ECO-016](../adrs/ADR-ECO-016-omlx-inference-split.md) DROP |
| G19 stub absorption | phenotype-infra | merged ([#79](https://github.com/KooshaPari/phenotype-infra/pull/79)) |

## DELETE gate (fork cluster)

| Repo | Verdict | Blocker |
|------|---------|---------|
| agentapi | KEEP_ARCHIVED | Tombstone only |
| agentapi-plusplus | UNIFY then AFFIRM | Spec + superset merge (G15) |
| cliproxyapi-plusplus | UNIFY before pin | go-sdk vendor SHA (G16) |
| bifrost | KEEP vendor fork | No merge into OmniRoute |
| phenotype-omlx | **DROP** — stay archived | ADR-ECO-016; engine jundot/omlx; FINISH = staffing gate |
| OmniRoute | NEVER archive | Canonical `route` |

## Next

1. ~~**G18**~~ — done (ADR-ECO-016 DROP; phenotype-omlx stay archived; engine jundot/omlx)
2. ~~**G19**~~ — done (phenotype-hub → phenotype-infra; vibeproxy-monitoring-unified retired)
3. **H14** — merge [phenotype-config#2](https://github.com/KooshaPari/phenotype-config/pull/2) + [phenotype-types#1](https://github.com/KooshaPari/phenotype-types/pull/1) + [HexaKit#267](https://github.com/KooshaPari/HexaKit/pull/267); unblock cargo check
4. **Desktop** — Electrobun spike in `OmniRoute/apps/desktop/`; harvest vibeproxy menu-bar UX
5. **W18b** — Agentora stub crates unblocked after H14 terminal-owner merges
6. **agentapi-spec** — root `SPEC.md` on agentapi-plusplus
