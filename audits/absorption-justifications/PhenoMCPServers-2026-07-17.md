# PhenoMCPServers — Absorption Justification

**Status:** QUEUED 2026-07-17 (batch3 refresh)
**Source:** `KooshaPari/PhenoMCPServers` (Python)
**Target:** PhenoMCPServers (self, fleet aggregator) at `./`
**Disposition:** ABSORB

## Confidence

**0.85** — HIGH. MCP implementations registry.

## Rationale

- Last activity tracked in disposition-index
- Language: Python
- Natural fit for proposed target based on ecosystem definitions in `phenotype-registry/docs/rationalization`

## Restore procedure

```sh
gh repo unarchive KooshaPari/PhenoMCPServers
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-registry
# Edit registry/disposition-index.json: change fsm from "absorbed" back to "active"
# Restore projects/PhenoMCPServers.json from git history (revert to queued status)
```

## Cross-references

- Disposition row: search `"KooshaPari/PhenoMCPServers"` in `registry/disposition-index.json`
- Target repo path: `./`
