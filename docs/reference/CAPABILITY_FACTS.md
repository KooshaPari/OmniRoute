---
title: Capability Facts Inventory
status: decision-input
sourceBranch: main
---

# Capability facts inventory

This inventory defines how public capability claims must be verified. It deliberately records no owner-selected positioning and no copied numeric claims.

## Rules

1. A public claim is valid only when its value is derived from an authoritative source below at the same commit.
2. Generated values must include the source commit SHA and generator command.
3. README, documentation, website, and release copy must not maintain independent numeric values.
4. A failed or ambiguous derivation blocks publication of the claim; it does not invite estimation.
5. Runtime support and implemented source are distinct. A feature is “supported” only when its contract test passes against release artifacts.

## Authoritative inventory

| Fact family | Authoritative source | Reproduction / verification | Publication gate |
|---|---|---|---|
| Product version | `package.json` and release tag | `bun -p "require('./package.json').version"`; compare with release tag | Values agree |
| Provider identifiers | `src/shared/constants/providers.ts` | Use the repository provider-reference generator: `bun scripts/docs/gen-provider-reference.ts`; review generated `docs/reference/PROVIDER_REFERENCE.md` diff | Generator succeeds and provider contract tests pass |
| Routing strategies | `src/shared/constants/routingStrategies.ts` | Import/export the canonical collection in a small checked script; do not count README text | Collection is unique and strategy tests pass |
| Public HTTP API | `docs/openapi.yaml` plus implemented route handlers | Validate OpenAPI, then run contract tests against the built artifact | Spec validation and contract suite pass |
| Environment variables | Runtime schema/config source and `docs/reference/ENVIRONMENT.md` | Generate or compare the reference against schema keys | No undocumented or stale public keys |
| CLI commands | CLI command registry / entry points and `docs/reference/CLI-TOOLS.md` | Enumerate registered commands from the built CLI; compare with reference | CLI smoke test passes |
| MCP surface | MCP server tool registry | Enumerate registered tools/scopes from the server at build time | MCP contract tests pass |
| A2A surface | A2A server skill/method registry | Enumerate registered public methods/skills from built server | A2A contract tests pass |
| Supported locales | `config/i18n.json` | Parse canonical locale keys; validate each catalog | Catalog validation passes |
| Supported installation targets | Packaging manifests and release workflow matrix | Derive from artifacts actually produced by the release workflow | Clean-install smoke passes for each advertised target |
| Desktop clients | Desktop package manifests and release artifacts | Report only clients built and attached for the release | Artifact launch smoke passes |
| License | Root license files and package metadata | Compare SPDX/package metadata with root license set | Metadata is consistent |

## Provenance record

Every generated public-facts artifact must carry:

```json
{
  "schemaVersion": 1,
  "repository": "KooshaPari/OmniRoute",
  "commit": "<40-character commit SHA>",
  "generatedAt": "<ISO-8601 UTC timestamp>",
  "generators": {
    "<fact-family>": {
      "sourcePaths": ["<path>"],
      "command": "<exact command>",
      "value": "<generated value>",
      "verification": "<test or check name>"
    }
  }
}
```

`generatedAt` is informational. Re-running at the same commit must reproduce all values.

## Adoption work

- Add a checked generator that emits a JSON facts artifact from the authoritative registries.
- Make docs generation consume that artifact.
- Add drift checks for prose surfaces that still contain numeric capability claims.
- Attach the facts artifact to releases with checksums/provenance.
- Replace this decision-input inventory with generated values only after the generator and contract gates land.
