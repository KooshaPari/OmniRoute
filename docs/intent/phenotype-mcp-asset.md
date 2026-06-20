# phenotype-mcp-asset -- Intent

## Intent Statement

phenotype-mcp-asset is the asset-bundle producer for the Phenotype ecosystem. It packages the static, brand, and demo assets consumed by every frontend repo (phenoAI, phenoData, phenotype-landing). Output: `@phenotype/assets` package on npm and a S3-hosted CDN.

## Role

`asset-bundle` (per `phenotype-registry/ECOSYSTEM_MAP.md` section 6)

## Boundary

See [`../boundary/phenotype-mcp-asset.md`](../boundary/phenotype-mcp-asset.md) for the in-scope / out-of-scope
declaration.

## Curated prompts

See `_bindings.json` key `phenotype-mcp-asset` for the bound prompt-hash list
(per-source counts in `docs/registries.md` section 'Capability & Intent SSOT').

## Provenance

- Source-of-truth role: `phenotype-registry/ECOSYSTEM_MAP.md` section 6 role table
- Stub rendered: 2026-06-18 by `scripts/render-stubs.py`
- Prose filled: 2026-06-19 by `scripts/fill-intent-stubs.py`
- Refresh cadence: weekly per ADR-024

## Folded Destination

`phenotype-mcp-asset` was a temporary standalone extraction from McpKit. Its surviving Rust asset/manifest/validation responsibility is folded into `KooshaPari/PhenoFastMCP-rust/crates/fastmcp-asset`. The standalone repo is deletion-ready after the target crate and this registry update are pushed because code, docs, and provenance are preserved in the folded crate.

