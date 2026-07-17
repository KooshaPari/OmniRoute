# 5-Role Spine — PhenoMCPServers as IMPLEMENTATIONS

Generated 2026-07-17. PhenoMCPServers has self-declared its role as the
implementations registry (catalog + schemas + servers + skills + plugins +
agents). It belongs in the 5-role spine as `IMPLEMENTATIONS`.

## PhenoMCPServers structure

```
PhenoMCPServers/
├── catalog/registry.yaml     # SSOT: servers, skills, plugins, agents
├── schemas/                  # JSON Schema for catalog entries
├── servers/                  # Deployable MCP server packages
├── skills/                   # Agent skill definitions (SKILL.md + metadata)
├── plugins/                  # Cursor/IDE plugin manifests
├── agents/                   # Agent persona/config bundles
├── docs/                     # Wiring guides for clients
└── scripts/validate_catalog.py
```

## Why a spine member, not absorbed

- Has its own validation pipeline (`scripts/validate_catalog.py`)
- Has its own PyPI publishing pipeline (`phenofastmcp` dependency tree)
- Has its own catalog metadata format (yaml + JSON schema)
- Standalone repo by design — explicitly declares itself "implementations
  registry" in its README

## Proposed spine (5-role)

| Role | Spine member | Status |
|---|---|---|
| INDEX | `phenotype-registry` | live (this repo) |
| ADRs/contracts | `PhenoSpecs` | absorbed into `docs/specs/pheno-specs/` (spine integrity flagged) |
| CONVENTIONS | `PhenoHandbook` | absorbed into `phenodocs/docs/handbook/` (spine integrity flagged) |
| ENFORCEMENT | `phenotype-org-governance` | live |
| **IMPLEMENTATIONS** | **`PhenoMCPServers`** | **proposed here** |

## Status

- Source repo (`KooshaPari/PhenoMCPServers`): kept live
- Registry row: `fsm=archived disposition=DECLARE_SPINE` (this row formally
  records the spine role; do NOT mark `fsm=absorbed` because it isn't
  absorbed)
- Pointer: `disposition-index.json` row DSPI-13

Maintained by the registry spine. Next update: when SPINE-DEFINITION.md
is edited to include the 5th role.
