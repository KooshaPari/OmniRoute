# Batch 3 archive audit — 2026-06-17

Method: `gh api` recursive tree + blob SHA compare per reconcile SOP.

| Archive | Role owner | Verdict | Notes |
|---------|------------|---------|-------|
| ObservabilityKit | python-sdk | **DELETED** | 100% — merged #14–#16, registry #81 |
| ResilienceKit | python-sdk | **DELETED** | 100% — merged |
| TestingKit | python-sdk | **DELETED** | 100% post mcp-qa reconcile |
| DataKit | python-sdk `packages/data-kit` | **DELETE_ELIGIBLE** | Archive `main` is README-only stub; owner has full subtree |
| PlatformKit | go-sdk + tooling | **KEEP_ARCHIVED** | `go/devenv` 38 blobs — 0% path overlap with `packages/platformkit/go/`; docs partial in go-sdk |
| PhenoKits | python-sdk + HexaKit templates | **KEEP_ARCHIVED** | template inflow pending |
| Metron | HexaKit `Metron/` | **VERIFIED** | excluded + stub pruned ([#244](https://github.com/KooshaPari/HexaKit/pull/244), [#251](https://github.com/KooshaPari/HexaKit/pull/251)); canonical `metrickit` in PhenoObservability |
| FocalPoint | HexaKit | **BLOCKED** | 2585 blobs; vendor size — manual absorption per HexaKit exclude |
| McpKit | python-sdk | **BLOCKED** | 12 Py files only in archive path; go-sdk cross-absorber |
| AuthKit | python-sdk | **BLOCKED** | Tracera, thegent deps |

Chokepoints unchanged: Pyron (Settly→phenotype-config), PhenoObservability, thegent, DevHex.
