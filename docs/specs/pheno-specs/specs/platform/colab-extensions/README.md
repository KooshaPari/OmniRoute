# Colab Extensions (migrated)

Migrated from archived `KooshaPari/phenotype-colab-extensions` (2026-06-16).

## Runtime home
- [HeliosLab](https://github.com/KooshaPari/HeliosLab) — `webflow-plugin/`, `agileplus-specs/`

## FR reconciliation notes
HeliosLab implementation diverges from original FR paths:
- Config uses `.webflowrc.json`, `webflow.json`, `.colab.json` (not `.webflow/config.json`)
- Command handlers delegate to `wf` terminal CLI (stub pattern in `webflow-plugin/src/index.ts`)
- Audit files `.webflow/published-components.json` / `.webflow/asset-map.json` not yet present

## Source repo
Deleted after migration. Tombstone: PhenoSpecs `specs/platform/colab-extensions/`.
