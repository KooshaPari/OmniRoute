# Auto-Update Mechanism

> **Historical decision record (Electron era).** This ADR documents how the
> original Electron desktop app auto-updated. The desktop app is now a Tauri 2
> shell (`apps/desktop/`), whose updates are handled by the Tauri updater; the
> Electron statements below are retained as decision history only.

## Status

**Draft** — 2026-07-09 (superseded — Electron desktop retired 2026-09-17)

## Context

The Electron desktop app needed automatic updates for users who installed via
downloadable installer (not npm/pip).

## Options

### Option A: electron-updater (Recommended, at the time)

`electron-updater` worked with electron-builder. Supports:

- GitHub Releases (current release workflow)
- S3
- Generic HTTP server

**Pros:**

- Zero-config with GitHub Releases
- Differential updates (small download)
- Delta updates for .appImage / .dmg
- Works on macOS, Windows, Linux

**Cons:**

- Requires code signing for macOS auto-update

### Option B: Squirrel

Windows-only, deprecated.

### Option C: Manual check

User downloads new version manually. Not acceptable for production.

## Decision

**Adopted Option A (electron-updater with GitHub Releases).** This applied to the
Electron desktop, since removed; the Tauri 2 shell uses the Tauri updater.

## Implementation (historical)

1. Install: `npm install electron-updater` (was already in dependencies)
2. Configure: `electron-builder.yml` with `publish: github`
3. Wire: `app.on('ready')` → `autoUpdater.checkForUpdates()`
4. Notify: Show update dialog when available

## Releases (historical)

Published Electron releases used the same `v*` tags as the server release.
`electron-updater` checked the GitHub Releases API for new versions.
