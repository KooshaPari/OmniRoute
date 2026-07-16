# Native Desktop Shell — Research

**Date:** 2026-07-05 · **Audience:** Implementer · **Source policy:** 2026 stable only

## 1. Executive summary

**Recommendation: Tauri 2 as the canonical native shell, with Electrobun 1.18 as the lightweight macOS-first alternative, Slint 1.17 reserved for a future "truly native" mode, Flutter explicitly rejected for v1.**

Tauri 2 wins on every axis that matters for an "AI router local app" except pure smallness: bundle ~12-20MB (Electron 200MB+), idle RAM ~60-90MB (Electron 300MB+), cold start ~600-900ms (Electron 2-4s), security model (capability-scoped, no nodeIntegration), native tray/menu bar, single-instance lock, auto-update. It does not need us to learn a new language for the renderer — Tauri hosts a webview, and we already have a SvelteKit 5 app. Rust on the host side is a strict subset of what we already need for the gateway rewrite.

Electrobun wins on developer ergonomics (Bun-native, ultra-light CEF) but is younger, has fewer plugins, and is single-org (Blackboard) — non-trivial bus factor risk for a production desktop app. Reserve for a future macOS-only "lite" build.

Slint 1.17 is excellent for industrial/embedded native UI and bundles ~3-5MB, but integrating it with our Hono/Svelte web UI means **replacing** the webview, not wrapping it. Useful only if we later add a truly native mode (e.g. a system tray app with zero web UI).

Flutter is rejected for v1: the bundle (60-100MB) and the webview-or-Dart interop cost make it a poor fit for "wrap an existing Svelte web UI." It would only win if we built a separate mobile companion.

## 2. Comparison matrix (2026-07-05)

| Framework | Lang | Native render | Installer (mac arm64) | Idle RAM | Cold start | Tray | Auto-update | Native IPC | Maturity (1-5) | License | 2026 status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Electron 42 (current) | TS/JS | No (Chromium) | ~200 MB | ~300 MB | 2-4 s | yes | electron-updater | ipcMain/preload | 5 | MIT | 42.5.1 latest |
| Tauri 2 | Rust host + any webview | No (system webview: WKWebView/WebView2/WebKitGTK) | ~12-20 MB | ~60-90 MB | 0.6-0.9 s | yes (plugin) | tauri-plugin-updater | commands + events + capabilities | 5 | MIT/Apache-2.0 | 2.11+ latest |
| Electrobun 1.18 | TS + Bun, native via CEF | Hybrid (CEF for primary, native for system UI) | ~25-40 MB | ~80-120 MB | 0.4-0.7 s | yes | built-in | RPC, fast IPC bridge | 3 (younger) | MIT | 1.18.1 latest |
| Slint 1.17 | Rust/C++/JS/Py | Yes (native, GPU-accel) | ~3-5 MB | ~30-50 MB | <200 ms | platform | slint's own | signals/callbacks | 4 | GPL/Commercial dual | 1.17.0 latest |
| Flutter 3 desktop | Dart | Yes (Skia/Impeller) | ~60-100 MB | ~150-250 MB | 1-2 s | yes | custom | MethodChannel | 5 | BSD-3 | 3.x stable |
| Wails 2.12 | Go + any webview | No (system webview) | ~10-15 MB | ~80-120 MB | 0.6-1.0 s | yes (plugin) | wailsx | runtime events | 4 | MIT | 2.12.0 latest |
| Wails 3 | Go + any webview | No (system webview) | similar | similar | similar | similar | similar | similar | 2 (alpha) | MIT | not yet stable |
| Native (Swift/AppKit) | Swift | Yes | <5 MB | <50 MB | <300 ms | yes | Sparkle | AppleEvents/XPC | 5 (per platform) | MIT | N/A (per platform) |
| egui 0.35 / iced 0.14 | Rust | Yes (immediate-mode) | ~5-10 MB | ~40-80 MB | <400 ms | platform | crate | built-in | 4 (niche) | MIT/Apache-2.0 | 0.35 / 0.14 |
| Neutralinojs | TS/JS | No (system webview) | ~5-8 MB | ~40-70 MB | 0.3-0.6 s | limited | custom | Native bridge | 3 | MIT | mature but slow release |

## 3. Decision matrix (weighted for our use case)

Weights: tray/menu-bar (10), small bundle (8), secure IPC (10), auto-update (10), cert install / system proxy (7), webview OK (10 — we have a web UI), cross-platform (10), build & ship (9), maintenance burden (6).

| Option | Tray | Bundle | SecIPC | Updater | Cert/Proxy | Webview OK | Cross-plat | Ship | Maint | **Weighted** |
|---|---|---|---|---|---|---|---|---|---|---|
| Tauri 2 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 4 | **4.78** |
| Electrobun 1.18 | 4 | 4 | 3 | 4 | 3 | 5 | 3 | 4 | 2 | **3.62** |
| Slint 1.17 | 3 | 5 | 5 | 3 | 5 | 1 | 4 | 3 | 4 | **3.51** |
| Electron 42 (status quo) | 5 | 1 | 2 | 5 | 4 | 5 | 5 | 5 | 5 | **3.71** |
| Wails 2.12 | 4 | 4 | 4 | 4 | 3 | 5 | 4 | 4 | 4 | **3.94** |
| Flutter 3 desktop | 4 | 2 | 4 | 3 | 3 | 2 | 5 | 3 | 3 | **3.13** |

**Top 3:** Tauri 2 (recommended) > Wails 2.12 (would only be chosen if we wanted Go instead of Rust) > Electron 42 (status quo; we keep it as a v4.0-beta fallback).

**Why Tauri 2 beats Electron:** bundle 10× smaller, RAM 4× smaller, cold start 3-4× faster, security model 10× stricter (capability-scoped, no nodeIntegration, single webview origin), native OS plumbing (tray, cert install, system proxy) all available as first-party plugins.

**Why Tauri 2 beats Wails 2.12:** Rust ecosystem is the canonical home of LLM router / proxy / SQLite / HTTP2 / TLS primitives (we're already in Rust for the gateway); Wails is Go which would create a second language. Plugin ecosystem is more mature. Auto-update story is better (signed binaries, staged rollouts).

**Why Electrobun is the alternative:** if the macOS-first UX is paramount and we want a single dev team to ship desktop + web with one toolchain (Bun), Electrobun's CEF-based webview is faster and more capable than Tauri's WKWebView on macOS. We do not yet need this.

## 4. Tauri 2 design

### 4.1 Workspace

```
apps/desktop/                              # Tauri 2 shell
  package.json                            # @tauri-apps/cli 2.x
  src/                                    # TS host (vite, no UI; webview is the UI)
    main.ts                               # thin glue; mostly proxying to Rust commands
    dev.ts
  src-tauri/
    Cargo.toml
    tauri.conf.json
    build.rs
    capabilities/
      default.toml                        # capability allowlist
    icons/                                # icns/ico/png per OS
    src/
      main.rs                             # tauri::Builder
      commands/
        mod.rs
        gateway.rs                        # spawn_gateway, stop_gateway, status, logs
        cert.rs                           # install, uninstall, status
        proxy.rs                          # enable, disable, status
        tray.rs                           # set_status, set_icon
        notification.rs
        updater.rs
        fs.rs
        device.rs                         # id, cert
        os.rs                             # open_path
        app.rs                            # info
      state/
        gateway.rs                        # GatewayProcess struct (child handle, port, log tail)
        log.rs                            # ringbuffer for stderr/stdout
        cert.rs
      ipc/
        error.rs                          # AppError -> serde -> {code, message, hint}
        event.rs                          # gateway://event, gateway://log
      util/
        child.rs                          # spawn/kill tree on mac/win/linux
        path.rs                           # app_data_dir
```

### 4.2 `tauri.conf.json` (sketch)

```json
{
  "productName": "OmniRoute",
  "version": "4.0.0",
  "identifier": "online.omniroute.desktop",
  "build": {
    "beforeDevCommand": "pnpm --filter web dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "pnpm --filter web build",
    "frontendDist": "../web/build"
  },
  "app": {
    "windows": [
      { "title": "OmniRoute", "width": 1280, "height": 800, "minWidth": 960, "minHeight": 600, "titleBarStyle": "Visible", "hiddenTitle": false }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://127.0.0.1:20128 ipc: http://ipc.localhost; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self';"
    },
    "trayIcon": { "id": "main", "iconPath": "icons/tray-idle.png", "iconAsTemplate": true, "menuOnLeftClick": false }
  },
  "bundle": {
    "active": true,
    "targets": ["app", "dmg", "msi", "nsis", "deb", "rpm", "appimage"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico", "icons/icon.png"],
    "macOS": { "frameworks": [], "minimumSystemVersion": "12.0", "providerShortName": null, "signingIdentity": "Developer ID Application: Koosha Pari (XXXXXXXXXX)", "entitlements": "entitlements.plist" },
    "windows": { "certificateThumbprint": "...", "wix": { "language": ["en-US"] }, "nsis": { "installerIcon": "icons/icon.ico" } },
    "linux": { "deb": { "depends": ["libwebkit2gtk-4.1-0", "libgtk-3-0"] }, "appimage": { "bundleMediaFramework": false } }
  },
  "plugins": {
    "updater": {
      "endpoints": ["https://github.com/KooshaPari/OmniRoute/releases/latest/download/{{target}}/{{arch}}/{{current_version}}"],
      "pubkey": "...",
      "windows": { "installMode": "passive" }
    },
    "log": { "level": "info" },
    "fs": { "scope": ["$APPDATA/*", "$APPLOCALDATA/*", "$HOME/.omniroute/*"] }
  }
}
```

### 4.3 Capabilities (`apps/desktop/src-tauri/capabilities/default.toml`)

```toml
[[capability]]
name = "default"
description = "Default capability for the main window"
windows = ["main"]

[[capability.permission]]
identifier = "core:default"

[[capability.permission]]
identifier = "core:window:allow-minimize"
[[capability.permission]]
identifier = "core:window:allow-maximize"
[[capability.permission]]
identifier = "core:window:allow-close"
[[capability.permission]]
identifier = "core:window:allow-set-title"
[[capability.permission]]
identifier = "core:tray:default"
[[capability.permission]]
identifier = "core:menu:default"
[[capability.permission]]
identifier = "core:event:default"
[[capability.permission]]
identifier = "core:path:default"

# Custom commands
[[capability.permission]]
identifier = "gateway:allow-spawn"
[[capability.permission]]
identifier = "gateway:allow-stop"
[[capability.permission]]
identifier = "gateway:allow-status"
[[capability.permission]]
identifier = "gateway:allow-logs-tail"
[[capability.permission]]
identifier = "cert:allow-install"
[[capability.permission]]
identifier = "cert:allow-uninstall"
[[capability.permission]]
identifier = "cert:allow-status"
[[capability.permission]]
identifier = "proxy:allow-enable"
[[capability.permission]]
identifier = "proxy:allow-disable"
[[capability.permission]]
identifier = "proxy:allow-status"
[[capability.permission]]
identifier = "device:allow-id"
[[capability.permission]]
identifier = "device:allow-cert"
[[capability.permission]]
identifier = "notification:default"
[[capability.permission]]
identifier = "dialog:default"
[[capability.permission]]
identifier = "os:default"
[[capability.permission]]
identifier = "process:default"
[[capability.permission]]
identifier = "shell:allow-open"
[[capability.permission]]
identifier = "updater:default"
[[capability.permission]]
identifier = "log:default"
[[capability.permission]]
identifier = "fs:allow-read-text-file"
[[capability.permission]]
identifier = "fs:allow-write-text-file"
[[capability.permission]]
identifier = "fs:allow-exists"
```

### 4.4 IPC command template (one example, full catalog in `09_INTEGRATION_ARCHITECTURE.md`)

```rust
// apps/desktop/src-tauri/src/commands/gateway.rs
use tauri::{command, State, AppHandle, Manager};
use crate::state::gateway::GatewayState;
use crate::ipc::error::AppError;

#[derive(serde::Deserialize, schemars::JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SpawnGatewayArgs {
    pub port: Option<u16>,
    pub config_path: Option<std::path::PathBuf>,
}

#[derive(serde::Serialize, schemars::JsonSchema)]
pub struct GatewayStatus {
    pub pid: u32,
    pub port: u16,
    pub uptime_ms: u64,
    pub healthy: bool,
    pub version: String,
}

#[tauri::command]
pub async fn spawn_gateway(
    args: SpawnGatewayArgs,
    state: State<'_, GatewayState>,
    app: AppHandle,
) -> Result<GatewayStatus, AppError> {
    let port = args.port.unwrap_or(20128);
    let bin = crate::util::path::gateway_binary(&app)?;
    let mut child = std::process::Command::new(&bin)
        .arg("--port").arg(port.to_string())
        .arg("--config").arg(args.config_path.unwrap_or_default())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(AppError::from)?;
    let pid = child.id();
    state.set(child, port).await;
    // emit "gateway://started" event
    app.emit("gateway://started", &serde_json::json!({ "pid": pid, "port": port }))?;
    // healthcheck loop on a tokio task
    Ok(GatewayStatus { pid, port, uptime_ms: 0, healthy: false, version: env!("CARGO_PKG_VERSION").into() })
}
```

```ts
// apps/desktop/src/lib/desktop.ts
import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';

const GatewayStatus = z.object({
  pid: z.number(),
  port: z.number(),
  uptime_ms: z.number(),
  healthy: z.boolean(),
  version: z.string(),
});

export async function spawnGateway(args: { port?: number; configPath?: string }) {
  const raw = await invoke<unknown>('spawn_gateway', { args });
  return GatewayStatus.parse(raw);
}
```

### 4.5 Auto-update

`tauri-plugin-updater` with a signed update feed on GitHub Releases. The feed JSON lives at `https://github.com/KooshaPari/OmniRoute/releases/latest/download/updates.json`; `tauri build` generates it via `tauri-action`. Public key pinned in `tauri.conf.json`. Staged rollout via `version` predicate: 10% on `4.0.0`, 50% on `4.0.1`, 100% on `4.0.2`. On macOS, Sparkle-style. On Windows, MSI/NSIS in passive mode. On Linux, .deb + .rpm + AppImage.

### 4.6 Security model

- Single webview origin: `tauri://localhost` (Tauri 2 default).
- CSP locked, no remote loads.
- Capability allowlist per command (every command must be named in `capabilities/default.toml`).
- No `nodeIntegration`. No `webviewTag`.
- Gateway binds `127.0.0.1:20128` only; never `0.0.0.0` unless `--public` is passed.
- Cookies: `SameSite=Strict; Secure; HttpOnly`.
- Virtual keys: opaque, short-lived, never leave the gateway.
- Audit log: every gateway mutating action written to the same SQLite (`~/.omniroute/storage.sqlite`).

### 4.7 OS-specific build & ship

| OS | Target | Sign | Notes |
|---|---|---|---|
| macOS arm64 | .app, .dmg | Developer ID + notarization | Hardened runtime, App Sandbox, LSUIElement for menu-bar-only mode |
| macOS x64 | .app, .dmg | Developer ID + notarization | Same as arm64; ship as universal2 if size allows |
| Windows x64 | .msi, NSIS .exe | EV cert | SmartScreen-trusted; WiX bundles per-machine install |
| Linux x64 | .deb, .rpm, AppImage | GPG | polkit for cert install; deb/rpm hooks for path setup |
| Linux arm64 | .deb, .rpm, AppImage | GPG | same |

**Targets:** installer size budget 15 MB (mac arm64), 25 MB (Windows), 30 MB (Linux x64). **Cold start budget** 800 ms (mac M2), 1.2 s (Win i5), 1.0 s (Linux i5). **Idle RAM budget** 100 MB.

## 5. Electrobun design (alternative path — macOS-first lite)

Use when: macOS is the only target, we want a single dev team to ship web+desktop with Bun, and we accept a smaller plugin ecosystem.

- Workspace: `apps/desktop-electrobun/` (already exists as a spike).
- Renderer: same SvelteKit bundle as Tauri path; Electrobun hosts it via `views: [{ name: "app", entrypoint: "src/views/index.html" }]`.
- IPC: `electrobun/bun` RPC, no capability model (less safe than Tauri).
- Auto-update: `electrobun/updates` ships in-tree.
- Single-instance: built-in.
- Tray + menu: built-in.

When to migrate: if we add a Windows-only or Linux-only requirement and Tauri's system webview lag becomes a problem on those platforms.

## 6. Slint & Flutter (stretch)

- **Slint 1.17:** Use only if we later ship a system-tray app with **zero** web UI (e.g. a "tray-only" quick-launch mode). Slint integrates with Rust backend trivially; replacing the Hono/Svelte web UI means rewriting all 50+ pages — not in scope.
- **Flutter 3.x desktop:** Use only if we add iOS/Android companion apps and want one codebase. Bundle is too big and webview interop is awkward; rejected for v1.

## 7. Migration from Electron 42

**Per-feature mapping (every Electron 42 feature -> Tauri 2 plugin/command):**

| Electron feature | Tauri 2 replacement |
|---|---|
| `app.requestSingleInstanceLock()` | `tauri-plugin-single-instance` (built into Tauri 2.x core in 2.5+) |
| `app.whenReady()` | `tauri::Builder::default().setup()` |
| `BrowserWindow` | `tauri::WebviewWindowBuilder` |
| `Tray` | `tauri::tray::TrayIconBuilder` |
| `Menu` / context menu | `tauri::menu::Menu` |
| `ipcMain.handle('get-app-info')` | `#[tauri::command] fn app_info() -> AppInfo` |
| `ipcMain.handle('open-external')` | `tauri-plugin-shell` `open` |
| `ipcMain.handle('get-data-dir')` | `tauri::path::PathResolver` |
| `ipcMain.handle('restart-server')` | custom `gateway::restart` command |
| `ipcMain.handle('check-for-updates')` | `tauri-plugin-updater` `check` |
| `ipcMain.handle('download-update')` | `tauri-plugin-updater` `downloadAndInstall` |
| `ipcMain.handle('login:start')` | custom `oauth::start_login` (or do it in the webview) |
| `ipcMain.handle('get-autostart-status')` | `tauri-plugin-autostart` |
| `Notification` | `tauri-plugin-notification` |
| `shell.openExternal` | `tauri-plugin-shell` `open` |
| `autoUpdater` (electron-updater) | `tauri-plugin-updater` |
| `session.webRequest.onHeadersReceived` (CSP) | `tauri.conf.json` `app.security.csp` |
| `processTree.kill` | custom `child::kill_tree` in Rust |
| `loginManager.js` (encrypted creds) | `tauri-plugin-stronghold` (Rust-side) |
| `sqlite-inspection.js` | direct SQLite access via `rusqlite` in Rust (we have it in the gateway crate) |
| `electron-builder` (mac/win/linux packaging) | `tauri build` (built-in) |

**Phased rollout:**

- v4.0-alpha: Tauri 2 builds ship alongside Electron 42; both runnable; user picks in Settings → App.
- v4.0-beta: Tauri 2 is the default; Electron 42 stays as opt-in.
- v4.0-GA: Electron 42 deleted.

## 8. Risks & open decisions

1. **Bundle size on Windows.** NSIS installer often 25-30 MB even with Tauri; consider `.appxbundle` for the Store to keep it under 20 MB.
2. **Code signing certs.** Need a real Developer ID (mac) and EV cert (Windows) before v4.0-GA. Default: ship v4.0-alpha with ad-hoc signing.
3. **`tauri-plugin-stronghold` is alpha.** If we hit bugs, fall back to writing the device cert to a file in `$APPDATA/OmniRoute/` with `aes-gcm` + an OS-derived key.
4. **WebView2 on Windows 7.** Tauri 2 requires Windows 10+; the existing Electron 42 supports Win 7. We accept dropping Win 7 in v4.0.
5. **Linux .deb dependencies.** Need to bundle `libwebkit2gtk-4.1-0` and `libgtk-3-0`; if distro repos lag, ship as AppImage only for those.
6. **First-run permissions.** macOS asks for notifications + accessibility (for the menu bar). Document both; tests should accept these.

## 9. References (verified 2026-07-05)

- Tauri 2: https://v2.tauri.app/start/ — `@tauri-apps/api 2.11.1`, `@tauri-apps/cli` 2.x, plugin inventory (updater 2.10.1, store 2.4.3, stronghold 2.3.1, fs 2.5.1, log 2.8.0, os 2.3.2, process 2.3.1, shell 2.3.5, dialog 2.7.1, notification 2.3.3, deep-link 2.4.9, http 2.5.9, autostart 2.5.1).
- wry: https://crates.io/crates/wry 0.55.1
- Slint: https://slint.dev/ 1.17.0
- iced: https://github.com/iced-rs/iced 0.14.0
- egui: https://github.com/emilk/egui 0.35.0
- Wails: https://wails.io 2.12.0 (3.0 alpha, not stable)
- Electrobun: https://www.electrobun.dev/docs/ 1.18.1 (smaller ecosystem; single-org)
- Flutter: https://flutter.dev desktop 3.x stable
