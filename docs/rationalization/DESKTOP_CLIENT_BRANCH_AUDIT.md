# Desktop client branch audit — 2026-06-18

Companion to [DESKTOP_CLIENT_SPIKE_MATRIX.md](./DESKTOP_CLIENT_SPIKE_MATRIX.md) and [ADR-ECO-015](../adrs/ADR-ECO-015-hybrid-gateway-app-layer.md).

## Summary

| Repo | Total branches | Non-`main` | Merged to `main` | Desktop signal |
|------|----------------|------------|------------------|----------------|
| vibeproxy | 12 | 11 | 0 | Swift macOS menu-bar (`apps/macos/`), Rust Linux tray (`apps/linux/`) |
| OmniRoute | 33 | 32 | 0 | `desktop-electrobun/` on `main`; CLI tray; deploy branches |

**Spike choice:** FFI + Electrobun in `OmniRoute/apps/desktop/` (promote `desktop-electrobun/`). Harvest vibeproxy menu-bar/OAuth UX as reference only.

## vibeproxy branches

| Branch | Last commit | Merged? | Purpose |
|--------|-------------|---------|---------|
| `main` | 2026-06-18 | default | Canonical Swift + Rust desktop clients |
| `chore/ci-concurrency` | 2026-05-28 | no | CI concurrency |
| `chore/pin-actions` | 2026-06-06 | no | Pin GitHub Actions |
| `chore/pin-github-actions-20260501` | 2026-04-30 | no | Actions pin batch |
| `chore/shell-quality` | 2026-06-08 | no | Shell lint |
| `chore/vibeproxy-merge-origin-main` | 2026-06-08 | no | Upstream merge |
| `chore/workflow-stale-2026-06-08` | 2026-06-08 | no | Stale workflow cleanup |
| `chore/worklog-seed-vibeproxy` | 2026-06-06 | no | Worklog seed |
| `cursor/workflow-yaml-and-permissions-1172` | 2026-05-29 | no | Workflow permissions |
| `docs/vibeproxy-sladge-badge` | 2026-04-29 | no | Sladge badge docs |
| `docs/vibeproxy-sladge-current` | 2026-06-05 | no | Sladge snapshot |
| `merge-upstream-2026-05-28` | 2026-05-28 | no | Upstream merge |

## OmniRoute branches (desktop-relevant highlighted)

| Branch | Last commit | Merged? | Purpose |
|--------|-------------|---------|---------|
| `main` | 2026-06-17 | default | TS router + `desktop-electrobun/` + CLI tray |
| `feat/deploy-stack` | 2026-06-17 | no | **Deploy/packaging stack** |
| `feat/scaled-deploy` | 2026-06-17 | no | **Scaled deployment** |
| `feat/scaled-deploy-clean` | 2026-06-17 | no | **Scaled deploy (clean)** |
| `integration/consolidate` | 2026-06-14 | no | **Integration lane** |
| `feat/a2a-agent-dispatch` | 2026-06-15 | no | A2A dispatch |
| `feat/a2a-agent-dispatch-clean` | 2026-06-16 | no | A2A dispatch clean |
| *(remaining 26 branches)* | 2026-05–06 | no | Hygiene, audit, docs, tests |

No Tauri tree found on any scanned branch.

## Next

1. Merge `feat/deploy-stack` / `integration/consolidate` hygiene into desktop spike lane before new experiments.
2. Record Electrobun choice in registry disposition (vibeproxy → ABSORB).
3. Spike selection gates: tray UX, local OpenAI-compatible endpoint, reproducible macOS build.
