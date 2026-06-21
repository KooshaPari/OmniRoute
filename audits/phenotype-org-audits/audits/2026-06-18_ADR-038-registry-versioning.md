# ADR-038: Registry versioning — minor-bump per server/skill, major on schema change, patch on typo

`KooshaPari/PhenoMCPServers/catalog/registry.yaml` (per ADR-035) carries a `registry_version` field. Bump policy: **minor** (e.g. 1.4.0 → 1.5.0) per server or skill add/change; **major** (e.g. 1.4.0 → 2.0.0) on schema change; **patch** (e.g. 1.4.0 → 1.4.1) on typo fix or doc-only.

**Status:** Accepted
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**Track:** v8 T14 (governance backlog)
**L8-018** (T14.9)

## Context

`KooshaPari/PhenoMCPServers` (the canonical MCP registry per ADR-035) has a `catalog/registry.yaml` index. As of 2026-06-17 the catalog is at `registry_version: 1.4.0`. The catalog grew organically in 2026 Q1–Q2: servers, skills, clients, and tools were added without a consistent version-bump policy. Consumers that pin to a specific catalog version have no signal for "is this catalog still valid for my code?"

The pre-existing `phenotype-registry` (per AGENTS.md **Decision D** — read-only spine) has no version field at all; it is treated as a static mirror.

## Decision

**`catalog/registry.yaml` carries a `registry_version` field, bumped per the following policy:**

| Bump | When | Examples |
|---|---|---|
| **patch** (1.4.0 → 1.4.1) | Typo fix; doc-only change; comment fix; re-numbering of pillar references | Fix a typo in a server description; correct a doc-link in a `tags:` list |
| **minor** (1.4.0 → 1.5.0) | Server or skill add/change; new field on a per-artifact entry; new artifact kind | Add a new `tools/pheno-cost-card/`; change `pheno-mcp-router`'s `version: 0.4.2 → 0.5.0`; introduce a new `kind: adapter` |
| **major** (1.4.0 → 2.0.0) | Schema change at the registry level; breaking change to a per-artifact entry shape; removal of a field | Change `version` from semver to calver; remove a field like `owner`; rename `kind: tool` → `kind: utility` |

### Bump mechanics

1. The PR that adds a server, skill, client, or tool MUST bump `registry_version` per the table above. A PR that adds an artifact without a version bump is rejected by the CI lint in `PhenoMCPServers/.github/workflows/registry-version.yml`.
2. Multiple artifacts in a single PR bump **once** (the highest applicable bump; e.g. a PR that adds 1 server + fixes 1 typo bumps 1.4.0 → 1.5.0, not 1.4.0 → 1.5.1).
3. The version bump is a single line edit at the top of `catalog/registry.yaml`:

```yaml
# catalog/registry.yaml
registry_version: 1.5.0   # bumped from 1.4.0; see PR #<n>
catalog_updated: 2026-06-18
```

### CI lint

A small GitHub Action (`.github/workflows/registry-version.yml`) on `PhenoMCPServers`:

- Parses the PR diff.
- Detects: (a) any change under `servers/`, `skills/`, `clients/`, `tools/`, or `catalog/registry.yaml`'s artifact entries; (b) the `registry_version` line.
- Fails the PR if (a) is true and (b) is unchanged.

### Semver is for the artifacts; this is for the catalog

This policy bumps the **catalog version**, not the **artifact version**. Each artifact's `version:` field is independent and follows its own semver policy (the artifact's `pyproject.toml` is the source of truth). A catalog bump does not imply an artifact-version bump; an artifact-version bump does not imply a catalog bump.

## Consequences

*Positive:*
- Consumers can pin to a catalog version and detect when their pin is stale.
- The bump policy is a 3-rule table; easy to learn, easy to enforce, easy to audit.
- The CI lint catches the common mistake (artifact add without catalog bump) automatically.

*Negative / Risks:*
- A consumer that ignores the catalog version (e.g. always reads HEAD) gets no benefit; the policy is opt-in by pinning. Mitigation: the `pheno-mcp-router` substrate (ADR-013) reads the catalog version and logs a warning when the consumer's pin is more than 1 minor behind HEAD.
- Major bumps are rare but disruptive; a 1.4 → 2.0 jump will require consumer code changes. Mitigation: the major-bump policy is reserved for genuine schema breaks; cosmetic renames are minor + deprecation.
- The CI lint is repo-specific (lives in `PhenoMCPServers`); a future registry repo would need its own copy. Mitigation: the lint script is a 30-line shell script; copy is cheap.

## Refs

- ADR-035 (PhenoMCPServers canonical home — defines the catalog location)
- ADR-013 (pheno-mcp-router substrate — the consumer that reads the catalog version)
- `KooshaPari/PhenoMCPServers/catalog/registry.yaml` (the file this ADR governs)
- v8 plan § 3.6 Track T14 (ADR backlog)
