# Desktop Guide (Tauri 2)

> **Source of truth:** `apps/desktop/` workspace

OmniRoute ships a native desktop application built on **Tauri 2** (Rust shell +
system webview: WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux).
The desktop app embeds the SvelteKit frontend and serves it through the
`custom-protocol` feature; no external web server is required at runtime.

## Architecture

```text
Tauri 2 webview (WKWebView / WebView2 / WebKitGTK)
      |
      +--> SvelteKit frontend (apps/web)          embedded via custom-protocol
      +--> Hono BFF / API boundary (apps/bff)     localhost:20128
      +--> typed runtime lifecycle (src-tauri)    window, tray, readiness
```

The Rust shell owns desktop lifecycle and readiness only. Provider selection,
routing, retries, and response healing remain in the existing API and runtime
layers; they are never duplicated in Tauri.

## Workspace Layout

Confirmed from `apps/desktop/`:

| Path                        | Contents                                               |
| --------------------------- | ------------------------------------------------------ |
| `src-tauri/`                | Rust shell: `main.rs`, `lifecycle.rs`, `commands.rs`   |
| `src-tauri/tauri.conf.json` | App config: product name, version, CSP, window, bundle |
| `src-tauri/capabilities/`   | Tauri capability grants                                |
| `tests/`                    | Desktop shell tests                                    |
| `package.json`              | Workspace scripts                                      |

## Key Configuration

From `apps/desktop/src-tauri/tauri.conf.json`:

| Setting              | Value                                                     |
| -------------------- | --------------------------------------------------------- |
| `productName`        | `OmniRoute`                                               |
| `version`            | synced to the repo version (e.g. `3.8.51`)                |
| `identifier`         | `online.omniroute.desktop`                                |
| `build.frontendDist` | `../../web/build` (SvelteKit output)                      |
| `build.devUrl`       | `http://localhost:4321` (SvelteKit dev server)            |
| `app.security.csp`   | restrictive CSP (self + localhost:20128 + localhost:4321) |
| `bundle.active`      | `true`, targets `all`                                     |

## Development

```bash
# Rust shell + SvelteKit dev server (hot reload):
cd apps/desktop/src-tauri
cargo tauri dev
```

The dev run connects to the SvelteKit dev server on `localhost:4321`.

## Building

```bash
cd apps/desktop/src-tauri
cargo tauri build          # enables custom-protocol, embeds the SPA
```

Artifacts → `apps/desktop/src-tauri/target/release/bundle/`
(`.app` / `.dmg` on macOS, platform installers elsewhere).

**Important:** plain `cargo build --release` also works because
`custom-protocol` is a **default feature** (set in `Cargo.toml`). Without it,
Tauri would serve from the dead `devUrl` and render a blank window. This was a
real regression (fixed 2026-09-18, commit `354dd99dff`).

## Verification

- Window/PID ownership: `CGWindowListCopyWindowInfo` (Swift one-liner) resolves
  the `omniroute-desktop` owner and window number; `screencapture -x -o -l <id>`
  captures an isolated session-owned window.
- SPA embedding: the binary carries the `_app/version.json` marker when the
  frontend is embedded; absence means the build served from `devUrl`.
- Policy gate: `node scripts/check/check-active-desktop.mjs` scans active docs
  and workflows for inactive desktop references and verifies the required
  Tauri files exist.

## Historical Note

The desktop app was Electron (Electron 41 + electron-builder) until the
ZERO-electron decision (2026-09-17). The Electron stack was removed in commit
`bedb7d1db6`; history remains recoverable from git at that commit's parent.
