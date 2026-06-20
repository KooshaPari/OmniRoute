# services — Phenotype services registry

## Project Overview

`services` is the canonical CycloneDX SBOM (Software Bill of Materials) registry for the
Phenotype org. It tracks the third-party service definitions used by the fleet.

## Stack

- **Format:** CycloneDX 1.5 JSON SBOM
- **Tracked services:** 2 (graphql-gateway, templates-registry)
- **Updates:** Automated via `dependabot.yml`

## Key Commands

```bash
# Validate SBOMs are well-formed JSON
python -c "import json; json.load(open('graphql-gateway/focus-graphql-gateway.cdx.json'))"
python -c "import json; json.load(open('templates-registry/templates-registry.cdx.json'))"

# R3 spec location
ls -la R3_Interoperability_Spec.yaml 2>/dev/null || echo "R3 spec not yet present"
```

## File Map

| Path | Purpose |
|------|---------|
| `.github/dependabot.yml` | Dependabot config for ecosystem package updates |
| `graphql-gateway/focus-graphql-gateway.cdx.json` | CycloneDX SBOM for the focus graphql gateway |
| `templates-registry/templates-registry.cdx.json` | CycloneDX SBOM for templates-registry |

## Quality Gate

```bash
# All SBOMs must be valid JSON
for f in $(find . -name "*.cdx.json"); do python -c "import json; json.load(open('$f'))" || exit 1; done
```

## DAG Status

- [x] **Stage 0** — State unification (LICENSE pending)
- [x] **Stage 1** — Tooling standardization
- [ ] **Stage 2** — Hexagonal refactor (N/A — registry only)
- [x] **Stage 3** — QA hardening

## Notes

This repo is a pure registry — no code. CI validates JSON shape and runs
TruffleHog on each SBOM update.
