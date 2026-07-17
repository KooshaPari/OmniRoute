# Absorption Record: curated-traces

**Date**: 2026-07-17
**Source**: `KooshaPari/curated-traces`
**Target**: `PhenoObservability/curated-traces/`
**Wave**: `2026-07-17-queue-refresh-2`
**Disposition**: `ABSORB`

## Transfer Summary

| Metric | Value |
| --- | --- |
| Files transferred | 5 .py + 2 .csv + 1 manifest.json + 1 README |
| Total LOC | 1488 |
| CSV rows | 1259 (full) + 34 (lite) |
| Source archived | yes |

## What was absorbed

- `trace_replay.py` (531 LOC) — replay engine
- `traces_loader.py` (316 LOC) — CSV loader
- `run_replay.py` — replay runner
- `rebuild_curated_dataset.py` — dataset builder
- `traces_full.csv` (1259 rows) — large corpus
- `traces_lite.csv` (34 rows) — smoke set
- `manifest.json` — dataset metadata
- `README.md` — provenance note

## Verification

- Branch: `PhenoObservability:overlay/logify-2026-07-17` (commit `5ec1646`)
- Source `KooshaPari/curated-traces` archived 2026-07-17