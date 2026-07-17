# Agent Platform — Gateway Stack Alignment

## Meta

- **ID**: 018-agent-platform
- **Title**: Agent Platform — Gateway Stack Boundary & Integration
- **Created**: 2026-06-18
- **State**: specified
- **Scope**: agentapi-plusplus, cliproxyapi-plusplus, bifrost, phenotype-gateway, Agentora (PhenoProc)

## Context

Wave H closed the gateway disposition batch (2026-06-18): agent terminal API, CLI proxy, inference gateway, and phenotype-gateway submodule pins are merged. Agent runtime (Agentora / PhenoProc gap port) lands process-plane crates separately. This spec ties the **agent platform** layers together so orchestrators, AgilePlus, and registry FSM rows share one integration story.

## Problem Statement

- Gateway planes had overlapping remotes and unclear ownership (agentapi vs cliproxy vs bifrost vs OmniRoute)
- Deprecated forks (vibeproxy, agentapi upstream) lacked canonical redirect targets
- Agentora PhenoProc absorption (~98%) needed explicit boundary vs gateway planes
- Zero-shot sessions require per-repo `BOUNDARY.md` / `DISPOSITION.md` in the Agent Context Bundle

## Goals

- Document canonical owners for each gateway plane per ADR-ECO-007
- Link phenotype-gateway submodule pins to plane-specific boundary docs
- Record vibeproxy → cliproxy++ and helioscope → helios-cli retirement paths
- Confirm Agentora owns agent + proc runtime; gateway repos do not absorb agileplus core
- Provide verify targets for Phase 6 closeout scorecard

## Non-Goals

- Merging gateway repos into a monolith (submodule model remains)
- OmniRoute long-term canonical status (interim router only)
- PhenoLang extraction (Wave H row still `in_progress`)

## Platform map

```
┌─────────────────────────────────────────────────────────────────┐
│ phenotype-gateway (orchestration, submodule pins, spikes/)      │
├──────────────┬──────────────────┬───────────────────────────────┤
│ agentapi++   │ cliproxyapi++    │ bifrost (+ argis plugins)     │
│ PTY / agents │ CLI LLM proxy    │ inference / MCP compose       │
├──────────────┴──────────────────┴───────────────────────────────┤
│ OmniRoute (interim LLM router) — revamp spike, not canonical    │
├─────────────────────────────────────────────────────────────────┤
│ Agentora — agent runtime, pheno-proc plane, phenotype-daemon      │
└─────────────────────────────────────────────────────────────────┘
```

## Repositories

| Repo | Plane | Boundary doc | Registry row |
|------|-------|--------------|--------------|
| agentapi-plusplus | Agent terminal API | `docs/BOUNDARY.md` | `gw-agentapi-pp` |
| cliproxyapi-plusplus | CLI subscription proxy | `docs/BOUNDARY.md` | `gw-cliproxy` |
| bifrost | Enterprise inference gateway | `docs/DISPOSITION.md` | `gw-bifrost` |
| phenotype-gateway | Fleet orchestration | UPSTREAM.md submodule pins | `gw-phenotype-gateway` |
| Agentora | Agent + proc runtime | workspace `Cargo.toml` | PhenoProc gap port |
| vibeproxy | Deprecated client | — (archive → cliproxy++) | `gw-vibeproxy` |
| helioscope | Deprecated CLI fork | — (archive → helios-cli) | ECOSYSTEM_MAP retire |

## Agentora / PhenoProc

| Deliverable | Status | PR |
|-------------|--------|-----|
| Workspace members (7 crates) | done | Agentora#78 |
| PhenoProc gap port (~98% absorption) | done | Agentora#79 |
| substrate SDK-ify pheno-proc-core | done | Agentora#80 |
| `cargo check --workspace` | green | verified 2026-06-18 |

Excluded duplicates: `agents/phenoagent/{phenotype-daemon,phenotype-skills}` — canonical under `crates/pheno-agent/`.

## Verification

```bash
# Gateway planes
(cd agentapi-plusplus && go build ./...)
(cd cliproxyapi-plusplus && go build ./...)
(cd bifrost && go build ./...)

# Agent runtime
(cd Agentora && cargo check --workspace)

# Registry
jq empty registry/disposition-index.json
./scripts/pin-components.sh --check   # phenotype-registry
```

## Related

- [016-agent-framework-expansion](../016-agent-framework-expansion/SPEC.md)
- [GATEWAY_FEATURE_PARITY](https://github.com/KooshaPari/phenotype-registry/blob/main/docs/rationalization/GATEWAY_FEATURE_PARITY.md)
- [018-mcp-server-alignment](../018-mcp-server-alignment/SPEC.md)
