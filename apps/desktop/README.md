# OmniRoute desktop (canonical entry)

This path is the **registry-canonical** desktop client location per [ADR-ECO-015](https://github.com/KooshaPari/phenotype-registry/blob/main/docs/adrs/ADR-ECO-015-hybrid-gateway-app-layer.md) (FFI + Electrobun spike).

Implementation lives at the repo root until promotion is complete:

**→ [`../../desktop-electrobun/`](../../desktop-electrobun/)**

Work there; this directory is a redirect only (no duplicated source).

**Not Electron.** The legacy `electron/` tree remains for release packaging until the Electrobun selection gate passes; CI Electron Package Smoke is path-filtered to `electron/**` only. Prefer ElectroBun (or a Tauri spike branch) for new desktop work.
