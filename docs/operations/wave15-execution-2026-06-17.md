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
| Paginary | Yes | 11 | — | **RETIRE** out-of-fleet (G19 triage 2026-06-19) |

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
| H14 | phenoShared | phenotype-config + phenotype-types + HexaKit | **done** — [phenotype-config#2](https://github.com/KooshaPari/phenotype-config/pull/2), [phenotype-types#1](https://github.com/KooshaPari/phenotype-types/pull/1), [HexaKit#267](https://github.com/KooshaPari/HexaKit/pull/267) merged 2026-06-18 |
| W18b | pheno fleet | all chokepoint consumers | **done** — fleet tail verified-clean 2026-06-19; `KooshaPari/pheno` archived |
| SR-1 | surface-reduction-1 | phenotype-registry | **done** — [#170](https://github.com/KooshaPari/phenotype-registry/pull/170); Planify, portage, phenotype-ops-mcp, McpKit |
| SR-2 | surface-reduction-2 | phenotype-registry | **done** — [#172](https://github.com/KooshaPari/phenotype-registry/pull/172) ledger + [#194](https://github.com/KooshaPari/phenotype-registry/pull/194) monorepo-state DROP |

## PR tracker

| PR | Repo | Status |
|----|------|--------|
| docs/wave15-gateway-fork-ssot | phenotype-registry | merged (#142) |
| G15 branch hygiene | agentapi-plusplus | merged (#535); remote `main` only |
| G16 boundary | cliproxyapi-plusplus | merged (#1026); remote `main` only |
| G16 vibeproxy redirect | vibeproxy | merged (#14) |
| G16 go-sdk pin | phenotype-go-sdk | merged (#17) |
| Gateway UPSTREAM SSOT | phenotype-gateway | merged (#4) — OmniRoute canonical peer |
| H14 config-loader | phenotype-config | merged ([#2](https://github.com/KooshaPari/phenotype-config/pull/2)) |
| H14 phenotype-errors | phenotype-types | merged ([#1](https://github.com/KooshaPari/phenotype-types/pull/1)) |
| H14 HexaKit pin repoint | HexaKit | merged ([#267](https://github.com/KooshaPari/HexaKit/pull/267)) |
| W18b AgilePlus repoint | AgilePlus | merged ([#763](https://github.com/KooshaPari/AgilePlus/pull/763)) |
| W18b PhenoPlugins repoint | PhenoPlugins | merged ([#104](https://github.com/KooshaPari/PhenoPlugins/pull/104)) |
| W18b Tracera fleet gate | Tracera | merged ([#632](https://github.com/KooshaPari/Tracera/pull/632)) |
| W18b Agentora stub repoint | Agentora | merged ([#90](https://github.com/KooshaPari/Agentora/pull/90)) — phenotype-errors/error-macros → phenotype-types; phenotype-config-loader → phenotype-config |
| G17 bifrost vendor pin | bifrost | merged (#7); tag `phenotype/vendor-2026-06`; 1 remote |
| G18 omlx ADR | phenotype-registry | merged — [ADR-ECO-016](../adrs/ADR-ECO-016-omlx-inference-split.md) DROP |
| G19 stub absorption | phenotype-infra | merged ([#79](https://github.com/KooshaPari/phenotype-infra/pull/79)) |
| W18b TestingKit health repoint | TestingKit | merged ([#8](https://github.com/KooshaPari/TestingKit/pull/8)) — phenotype-health → PhenoObservability |
| Surface reduction batch 2 | phenotype-registry | merged [#197](https://github.com/KooshaPari/phenotype-registry/pull/197) |
| Desktop Electrobun spike | OmniRoute | merged ([#74](https://github.com/KooshaPari/OmniRoute/pull/74)) — ADR-ECO-015 |
| agentapi root SPEC | agentapi-plusplus | merged ([#536](https://github.com/KooshaPari/agentapi-plusplus/pull/536)) — G15 follow-up |
| pheno archive gate | KooshaPari/pheno | **archived** 2026-06-19 — W18b org manifest scan pass |

## G15–G17 closeout (2026-06-18)

Gateway fork lanes **G15–G17 complete** (other agent). Registry disposition-index rows `gw-agentapi-pp`, `gw-cliproxy`, `gw-bifrost` reflect merged PRs. This ledger lane only cross-links downstream PRs — no re-execution of merge hygiene.

## DELETE gate (fork cluster)

| Repo | Verdict | Blocker |
|------|---------|---------|
| agentapi | KEEP_ARCHIVED | Tombstone only |
| agentapi-plusplus | **AFFIRM** | G15 done (#535); root SPEC [#536](https://github.com/KooshaPari/agentapi-plusplus/pull/536) merged |
| cliproxyapi-plusplus | **AFFIRM** | G16 done (#1026); go-sdk pin merged |
| bifrost | KEEP vendor fork | No merge into OmniRoute |
| phenotype-omlx | **DROP** — stay archived | ADR-ECO-016; engine jundot/omlx; FINISH = staffing gate |
| OmniRoute | NEVER archive | Canonical `route` |

## Next

1. ~~**G18**~~ — done (ADR-ECO-016 DROP; phenotype-omlx stay archived; engine jundot/omlx)
2. ~~**G19**~~ — done (phenotype-hub → phenotype-infra; vibeproxy-monitoring-unified retired)
3. ~~**H14**~~ — done (phenotype-config#2 + phenotype-types#1 + HexaKit#267 merged; terminal-owner git pins on HexaKit main)
4. ~~**SR-2**~~ — done ([#172](https://github.com/KooshaPari/phenotype-registry/pull/172) ledger + [#194](https://github.com/KooshaPari/phenotype-registry/pull/194) monorepo-state DROP)
5. ~~**Desktop**~~ — done ([OmniRoute#74](https://github.com/KooshaPari/OmniRoute/pull/74) merged)
6. ~~**W18b**~~ — done (fleet tail verified-clean; `KooshaPari/pheno` archived 2026-06-19)
7. ~~**agentapi-spec**~~ — done ([agentapi-plusplus#536](https://github.com/KooshaPari/agentapi-plusplus/pull/536) merged)
8. ~~**Metron X-02**~~ — done (repo 404 tombstone; `metrickit` canonical in PhenoObservability #157; HexaKit #244/#251)
9. ~~**BytePort ST-01**~~ — done (UNCLOSABLE [#201](https://github.com/KooshaPari/BytePort/pull/201); archive-gate ST-01)
10. ~~**HexaKit CI**~~ — done ([#274](https://github.com/KooshaPari/HexaKit/pull/274) + [#275](https://github.com/KooshaPari/HexaKit/pull/275))
11. ~~**Paginary G19**~~ — done ([gw-paginary-branch-index.md](../disposition/gw-paginary-branch-index.md); RETIRE out-of-fleet)
12. ~~**phenoShared P4 gate**~~ — done (wave 5b drain HexaKit#278; `KooshaPari/phenoShared` archived)
13. ~~**AgilePlus Lane J**~~ — done (`agileplus-domain` + `agileplus-events` on AgilePlus; Agentora staging removed)
14. ~~**Registry L7**~~ — done ([#244](https://github.com/KooshaPari/phenotype-registry/pull/244) intent/boundary + [#245](https://github.com/KooshaPari/phenotype-registry/pull/245) pheno-tracing)
15. ~~**Phase 4 closeout**~~ — done (backlog #100; `docs:build` [#255](https://github.com/KooshaPari/phenotype-registry/pull/255))

## Phase 5 — agent runtime (2026-06-19)

See [p5-agent-runtime-absorption-2026-06-19.md](./p5-agent-runtime-absorption-2026-06-19.md).

1. ~~**P5-1**~~ — done ([Agentora#91](https://github.com/KooshaPari/Agentora/pull/91); PhenoAgent archived 2026-06-19)
2. ~~**P5-2**~~ — done (PhenoAgent archive gate)
3. ~~**P5-3**~~ — done (PhenoProc archive gate)
4. **P5-4** — phenoRouterMonitor → phenoAI (deferred; repo archived)
5. **P5-5** — thegent / Agentora boundary audit (AFFIRM split; boundary confirmation + registry handoff pending)
6. **P5-6** — FocalPoint → HexaKit (deferred; 867MB vendor)
