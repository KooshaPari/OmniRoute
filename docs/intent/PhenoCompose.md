# PhenoCompose -- Intent

## Intent Statement

PhenoCompose is the composition framework for the Phenotype ecosystem. It provides declarative YAML/JSON composability for stitching together the pheno* libraries (phenoData, phenoEvents, phenoXdd, phenoTracing) into reproducible agent runtimes. Its primary output is a resolved `pheno-compose.yaml` runtime graph.

## Role

`composition-framework` (per `phenotype-registry/ECOSYSTEM_MAP.md` section 6)

## Boundary

See [`../boundary/PhenoCompose.md`](../boundary/PhenoCompose.md) for the in-scope / out-of-scope
declaration.

## Curated prompts

See `_bindings.json` key `PhenoCompose` for the bound prompt-hash list
(per-source counts in `docs/registries.md` section 'Capability & Intent SSOT').

## Provenance

- Source-of-truth role: `phenotype-registry/ECOSYSTEM_MAP.md` section 6 role table
- Stub rendered: 2026-06-18 by `scripts/render-stubs.py`
- Prose filled: 2026-06-19 by `scripts/fill-intent-stubs.py`
- Refresh cadence: weekly per ADR-024
