# Wave 14 — Gateway SSOT foundation — 2026-06-17

**Predecessor:** [wave13-execution-2026-06-17.md](./wave13-execution-2026-06-17.md)  
**DAG:** [GATEWAY_MERGE_DAG.md](../rationalization/GATEWAY_MERGE_DAG.md)  
**ADR:** [ADR-ECO-007-gateway-merge-superset](../adrs/ADR-ECO-007-gateway-merge-superset.md), [ADR-ECO-014-phenoshared-decompose](../adrs/ADR-ECO-014-phenoshared-decompose.md)

## Remote audit baseline (gh, 2026-06-17)

| Repo | Branches | Registry verdict (corrected) |
|------|----------|------------------------------|
| agentapi-plusplus | 34 | **AFFIRM** `cli_proxy` — merge superset |
| cliproxyapi-plusplus | 11 | **AFFIRM** peer/submodule |
| bifrost | 339 | **VENDOR-KEEP** — sync lane only |
| OmniRoute | 26 | **CANONICAL** `route` — protect |
| phenotype-omlx | 27 (archived) | **DECISION** FINISH vs DROP |
| PhenoCompose | 15 | **AFFIRM** `platform` — blocks pheno archive |
| PhenoRuntime | 14 (archived) | **HARVEST → DELETE** |
| vibeproxy | 6 | **SKIP** reconciliation |
| agileplus-spec-harmonizer | 1 | Register tooling; spec SSOT for merges |
| phenotype-e2e-base | 2 | Absorb → phenotype-journeys |

## Registry contradictions fixed

| Topic | Stale | Fixed in |
|-------|-------|----------|
| OmniRoute archive | RATIONALIZATION_PLAN Step 1 | Banner + removal from archive list |
| agentapi++ archive | ECOSYSTEM_MAP §6, PLAN | AFFIRM + disposition row |
| Settly canonical | ECOSYSTEM_MAP Cluster H | phenotype-config (`settly` crate) |
| BytePort active | ECOSYSTEM_MAP §1 monorepo | ARCHIVED → phenotype-tooling |
| phenoXddLib owner | BOUNDARY_OWNERS | ARCHIVED; xDD → phenoXdd + journeys |
| Missing gateway roles | DOMAIN_ROLES | `route`, `cli_proxy`, `inference` |
| phenoShared as SSOT | ECOSYSTEM_MAP, chokepoints | **DECOMPOSE** — interim staging only; fleet repoint to role owners |

## phenoShared decomposition (ADR-ECO-014)

`phenoShared` is **not** a domain-oriented lib/SDK/framework. P3 git pins are tolerated as **staging**; terminal owners:

| Staging crate | Role owner |
|---------------|------------|
| config-loader, settly | phenotype-config |
| stashly, http-client-core | phenotype-resilience |
| health traits | PhenoObservability |
| errors | phenotype-types |
| event-bus | Eventra |
| contracts | decompose per domain |

## PR tracker

| PR | Repo | Status |
|----|------|--------|
| docs/wave14-gateway-ssot | phenotype-registry | open |

## Wave 14+ tactical queue (10+ parallel-sized tasks)

These are the highest-confidence next tasks across registry, HexaKit, and gateway clusters after Wave 13 merge. Most are 1-2 PR sized, with bounded acceptance checks.

| # | Task | Owner | Deliverable |
|---|------|-------|------------|
| 1 | Merge Pyron branch mapping for `Apisync` submodule and unbreak `phenotype-core` workspace checks | Pyron + phenotype-registry | `feat/fix-apisync-submodule-mapping` + disposition note PR |
| 2 | Re-run `cargo check -p phenotype-core` in HexaKit after Apisync unblock and record result in ledger | HexaKit | check pass; update registry blocker status |
| 3 | Finalize `phenotype-core` next pins for `phenotype-validation` and `phenotype-string` | HexaKit + phenotype-registry | disposition rows closed when core target strategy confirmed |
| 4 | Resolve `gw-cliproxy` and `gw-bifrost` dispositions to `done` with PR refs | phenotype-registry | disposition updates + disposition-index audit |
| 5 | Pin `phenotype-gateway` submodule SHAs under `third_party/*` and `packages/*` bootstrap | phenotype-gateway | Git pin commits with lockfile/build verification |
| 6 | Implement gateway spike build/smoke matrix in `phenotype-gateway/spikes/<lang>` for promoted components | phenotype-gateway | docs + CI result proof for each spike |
| 7 | Move `OmniRoute` features to spikes/revamp plane and update `GATEWAY_FEATURE_PARITY.md` ownership rows | OmniRoute + phenotype-gateway | spike plan + updated feature matrix ownership |
| 8 | Classify and route `argis-extensions` packages into `packages/argis` with vendor pin continuity | phenotype-gateway | route table + `third_party` integration |
| 9 | Complete `PhenoLang` branch triage in `phenoUtils` and remove `*/feat/docs-site` staging branches | PhenoLang + phenoUtils | done — phenoUtils#66 index + registry gw-phenolang closed; full remote sweep 2026-06-19 (main-only) |
| 10 | Update `phenoSDK` package migration: `pheno-sdk` redirect state and package map references | phenotype-registry + phenotype-python-sdk | map consistency audit + disposition progress |
| 11 | Decide `helios-cli-backup` retention: user confirmation, then hard delete or archive action | phenotype-registry | explicit decision log + branch/registry action |
| 12 | Resolve `crates/phenotype-port-traits` disposition transition and target strategy | HexaKit | scope lock and final PR |
| 13 | Clean up `py-pheno-mcp` redirection to `PhenoMCP` and close edge-row status | phenotype-registry + py repos | disposition row closed |
| 14 | Start `libs/nexus` decompose branch with handoff packet and acceptance test plan | registry + target repo | decompose ticket + branch started |
| 15 | Refresh `GATEWAY_FEATURE_PARITY.md` to require `packages/*` ownership for remaining feature rows (100% mapped target state) | phenotype-registry | completed feature matrix and disposition updates |
| 16 | Expand `HEXAKIT_EVICTION_INVENTORY.md` with remaining H-lane/No-merge debt and ship progress markers | phenotype-registry | inventory entries updated |

## Next waves (unblocked after merge)

| Wave | Lane |
|------|------|
| 15 | agentapi++ branch merge + SPEC.md |
| 16 | cliproxy boundary + prune |
| 16b | bifrost vendor policy |
| 17 | omlx decision |
| 17b | PhenoCompose + pheno repoint |
| 18 | archived `projects/*.json` |
| 18b | pheno fleet scan + archive gate |
| 19 | e2e-base → journeys |
