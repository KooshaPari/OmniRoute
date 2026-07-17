---
id: ADR-018
title: Agent Session Zero-Loop SSOT for MCP Fleet Work
status: accepted
date: 2026-06-17
author: KooshaPari
tags: [agents, mcp, governance, dogfood]
---

# ADR-018: Agent Session Zero-Loop SSOT

## Status

Accepted (2026-06-17)

## Context

Cursor agent sessions are the primary execution surface for Phenotype fleet work.
Sessions in transcript `40d15363` required multiple user corrections (rmcp fork,
mirror-to-empty, tier confusion). **Goal:** zero correction loops per session.

## Decision

### Mandatory pre-flight (before any MCP polyrepo edit)

1. Read **ADR-017** (boundaries)
2. Read **PhenoMCPServers/catalog/registry.yaml** (wiring)
3. Read target repo **PHENO.md** + **FORK-NOTES.md**
4. **phenodag claim** if parallel lane work (`phenodag pick --agent <name>`)

### Skills (PhenoMCPServers)

| Skill | Purpose |
|-------|---------|
| `mcp-boundary-guard` | Framework vs spec vs runtime vs implementations |
| `github-fork-policy` | `gh repo fork` only; never mirror-to-empty |
| `language-tier-picker` | Tier 0–3 placement |
| `catalog-wiring` | registry.yaml + mcp.json consistency |
| `phenodag-claim` | Avoid duplicate parallel lanes |
| `substrate-vs-servers` | Runtime vs MCP tool ownership |

### KPIs

| Metric | Target |
|--------|--------|
| User correction loops per session | 0 |
| SSOT files cited before first edit | 100% |
| Fork parent matches catalog | 100% |

### Session log schema (optional telemetry)

```yaml
session_id: string
transcript_ref: string
ssot_read: [string]
loop_events:
  - turn: int
    correction: string
    root_cause: string
    preventive_adr: ADR-017 | ADR-018
outcome: zero_loop | n_loops
```

Pilot schema SSOT: [`specs/mcp/session-metrics/schema.yaml`](../specs/mcp/session-metrics/schema.yaml) (example: [`example.yaml`](../specs/mcp/session-metrics/example.yaml)).

## Appendix A — Loop catalog (session 40d15363)

| Loop | Root cause | Preventive SSOT |
|------|------------|-----------------|
| rmcp as PhenoFastMCP-rust | Wrong framework analogue | ADR-017 + mcp-boundary-guard |
| mirror-to-empty breaks fork | Wrong bootstrap procedure | github-fork-policy skill |
| Go as tier-0 core | Missing tier rule | LANGUAGE-TIERS + language-tier-picker |
| McpKit as framework | Pre-rationalization doc | DOMAIN_ROLES + ADR-017 |
| cheap-llm separate repo | Duplicate capability | ADR-019 substrate argv |

## Related

- ADR-017: MCP polyrepo boundaries
- ADR-003: Spec-driven development via AgilePlus
- PhenoMCPServers skills/ and agents/fleet-lead/
