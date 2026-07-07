# ADR-0004: Tauri 2 macOS-first; Electrobun reserved

**Status**: Accepted (2026-07-04)

## Context

v4 needs a native shell for desktop users. Electron is too heavy; Tauri 2 has matured and bundles to ~5MB.

## Decision

- Tauri 2 (with `macos-private-api`, `tray-icon`) for v4.0.
- macOS is the canonical target; Windows + Linux follow.
- Tauri plugins from root `[workspace.dependencies]`: shell, dialog, fs, notification, updater, clipboard-manager, os, window-state, deep-link, single-instance, stronghold, log, stream.

## Consequences

- Smaller bundle and lower idle RAM than Electron.
- Plugins cover ~90% of native surface; the gateway crate covers the remaining 10% (process supervision, kbridge bridge).
