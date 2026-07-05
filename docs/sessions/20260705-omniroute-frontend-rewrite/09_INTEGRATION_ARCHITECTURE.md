# Integration Architecture — Tauri + SvelteKit + Hono + Rust Gateway

**Date:** 2026-07-05 · **Audience:** Implementer

## 1. Executive summary

Three processes, one product:

- **Tauri 2 shell** (host, native, ~12-20MB) — owns the OS-level lifecycle, tray, single-instance, auto-update, cert install, system proxy, keychain.
- **SvelteKit 2 SSR** (helper child, or bundled as webview assets) — serves the dashboard UI on `:3000` in dev, on the bundled asset path in prod.
- **Rust gateway** (helper child, single binary, ~25MB) — owns the OpenAI-compatible surface, MCP, mitm, SSE, WS, executor registry. Listens on `:20128` (127.0.0.1 only by default).

The webview (Tauri-hosted SvelteKit page) is the single user-facing UI. It talks to the gateway directly over HTTP for high-rate streams (logs, analytics live) and through the SvelteKit proxy for everything that benefits from session/cookie sharing. Tauri commands handle the OS-level concerns that the webview cannot.

The desktop has a meaningful "headless gateway" mode where the user runs `omniroute-v4 server` on a server box and points the Tauri shell at the remote gateway URL — same SvelteKit app, same webview, same IPC. Useful for the "share one license across machines" use case.

## 2. Three-process model (ASCII)

```
                     ┌────────────────────────────────────┐
                     │ Tauri 2 host (Rust, native)         │
                     │ • window + webview (SvelteKit 5)    │
                     │ • tray, menu, single-instance       │
                     │ • auto-update, cert install, proxy  │
                     │ • keychain (stronghold)             │
                     └───┬──────────────────┬──────────────┘
                         │ invoke(cmd)      │ gateway://event
                         │ webview ←→ SvelteKit
                         ▼                  ▼
        ┌─────────────────────────┐  ┌──────────────────────────┐
        │ SvelteKit 2 (TS)        │  │ Rust gateway (single bin)│
        │ • SSR + Hono routes     │  │ • HTTP/2 + SSE + WS + MCP│
        │ • Session cookies       │  │ • /v1/* OpenAI surface   │
        │ • Proxy /api/* → gateway│  │ • mitm, cert, executor   │
        │ • i18n (Paraglide)      │  │ • :20128 (127.0.0.1)     │
        │ • :3000 (dev) / webview │  │                          │
        │   (prod assets)         │  │                          │
        └──────┬──────────────────┘  └────────┬─────────────────┘
               │                                │
               └──────────► direct fetch ◄──────┘
                          (low-latency SSE/WS)
                                   ▲
                                   │ 127.0.0.1:20128
                                   │
                            ┌──────┴──────┐
                            │ webview JS  │  EventSource, fetch
                            └─────────────┘
```

## 3. Process lifecycle

```
[Tauri launch]
  → check single-instance lock
  → ensure $APPDATA/OmniRoute/ exists
  → spawn Rust gateway binary (port 20128 default)
  → wait for GET /healthz (timeout 10s, retry every 200ms)
  → on healthy: load webview with bundled SvelteKit assets
  → on failure: show error dialog + write to log

[webview ready]
  → webview calls invoke('device_id') → returns fingerprint
  → webview shows /login or /home (if device cert exists)
  → webview fetches /api/* via SvelteKit (same-origin)
  → webview subscribes to EventSource('/v1/stream/usage') for high-rate streams
  → webview listens for 'gateway://event' for tray updates, errors

[user quits]
  → webview flushes pending mutations
  → Tauri sends gateway.shutdown (5s grace)
  → if still alive: SIGTERM → SIGKILL
  → webview closed
  → Tauri exits

[gateway crash]
  → Tauri detects via /healthz poll (every 5s) or via 'gateway://died' event
  → show OS notification "OmniRoute gateway stopped unexpectedly"
  → try restart (max 3 within 60s, then give up + show error)

[SvelteKit not bundled in Tauri — dev mode only]
  → Tauri loads http://localhost:5173 (Vite dev server)
  → separate `pnpm dev` started by beforeDevCommand
```

State machine (`apps/desktop/src-tauri/src/state/gateway.rs`):

```
            ┌─────────┐  spawn ok    ┌──────────┐  /healthz ok   ┌──────────┐
   IDLE ──► │ STARTING├─────────────►│ STARTED ├───────────────►│ HEALTHY  │
            └────┬────┘              └────┬─────┘                └────┬─────┘
                 │ spawn err              │ /healthz timeout         │
                 ▼                        ▼                         │
              FAILED                  DEGRADED                     │
                 ▲                        │                         │
                 │  restart ok           │ /healthz ok             │
                 │                       └──────► HEALTHY ◄─────────┘
            ┌────┴────┐                            /healthz fail
            │RESTART  │ ◄────────── HEALTHY ───────┐
            └────┬────┘                            ▼
                 │ too many restarts           DEGRADED
                 ▼
              QUIT
```

## 4. Authentication handshake (desktop mode)

```
[first launch, no device cert]
  1. webview: invoke('device_id') → "dev_abc123" (machine-id derived)
  2. webview: shows /pair with QR code (contains "dev_abc123")
  3. user opens omniroute.online/pair on phone
  4. user logs in normally → phone shows "Pair this device?"
  5. user confirms → gateway writes device cert to ~/.omniroute/devices/dev_abc123.cert
  6. webview polls /api/v1/devices/dev_abc123/cert every 5s
  7. on poll hit: webview writes cert to keychain via invoke('device_cert_set', cert)
  8. webview navigates to /home

[subsequent launches]
  1. webview: invoke('device_id') → "dev_abc123"
  2. webview: invoke('device_cert_get') → cert
  3. webview: fetch /api/v1/auth/whoami with Authorization: Bearer <cert>
  4. gateway validates cert → returns user
  5. webview: shows /home
```

The webview never sees the user's password. The device cert is short-lived (30 days) and rotated via the `device_cert_refresh` command when within 7 days of expiry.

## 5. IPC command catalog (Tauri 2)

| Command | Input (zod) | Output (zod) | Capability | Notes |
|---|---|---|---|---|
| `app_info` | — | `{name, version, build, arch, channel}` | `app:allow-info` | static |
| `app_open_path` | `{path: string}` | — | `os:allow-open` | shell open |
| `app_open_external` | `{url: string}` | — | `shell:allow-open` | validated URL |
| `device_id` | — | `{id: string}` | `device:allow-id` | from machine-id |
| `device_cert_get` | — | `{cert: string, expiresAt: number} \| null` | `device:allow-cert-get` | from stronghold |
| `device_cert_set` | `{cert: string, expiresAt: number}` | — | `device:allow-cert-set` | to stronghold |
| `device_cert_clear` | — | — | `device:allow-cert-clear` | |
| `gateway_spawn` | `{port?: number, configPath?: string}` | `{pid, port, healthy}` | `gateway:allow-spawn` | idempotent |
| `gateway_stop` | — | — | `gateway:allow-stop` | graceful 5s |
| `gateway_restart` | — | — | `gateway:allow-restart` | stop + spawn |
| `gateway_status` | — | `{state, pid?, port?, uptimeMs, healthy, version}` | `gateway:allow-status` | from ringbuffer |
| `gateway_logs_tail` | `{since?: number, maxBytes?: number}` | `{lines: Array<{ts, level, msg}>}` | `gateway:allow-logs-tail` | ringbuffer |
| `gateway_logs_subscribe` | — | `unlisten: () => void` | `gateway:allow-logs-subscribe` | emits `gateway://log` |
| `cert_install` | — | `{ok, fingerprint}` | `cert:allow-install` | OS shell-out |
| `cert_uninstall` | — | `{ok}` | `cert:allow-uninstall` | |
| `cert_status` | — | `{installed, fingerprint, trusted}` | `cert:allow-status` | |
| `proxy_enable` | `{host: 'http' \| 'https' \| 'socks', port: number}` | `{ok}` | `proxy:allow-enable` | OS-specific shell-out |
| `proxy_disable` | — | `{ok}` | `proxy:allow-disable` | |
| `proxy_status` | — | `{enabled, host?, port?}` | `proxy:allow-status` | |
| `tray_set_status` | `{state: 'idle' \| 'running' \| 'degraded' \| 'error', tooltip?: string}` | — | `core:tray:default` | icon swap |
| `tray_set_menu` | `{items: Array<{id, label, kind?}>` | — | `core:menu:default` | |
| `notification_show` | `{title, body, icon?, tag?}` | `{id}` | `notification:default` | |
| `updater_check` | — | `{available, version?, notes?}` | `updater:default` | |
| `updater_apply` | — | — | `updater:default` | download + install |
| `fs_read_text` | `{path: string, maxBytes?: number}` | `{content: string}` | `fs:allow-read-text-file` | scoped |
| `fs_write_text` | `{path: string, content: string}` | — | `fs:allow-write-text-file` | scoped |
| `fs_exists` | `{path: string}` | `{exists: boolean}` | `fs:allow-exists` | scoped |
| `window_minimize` | — | — | `core:window:allow-minimize` | |
| `window_maximize` | — | — | `core:window:allow-maximize` | |
| `window_unmaximize` | — | — | `core:window:allow-unmaximize` | |
| `window_close` | — | — | `core:window:allow-close` | |
| `window_set_title` | `{title: string}` | — | `core:window:allow-set-title` | |
| `clipboard_write_text` | `{text: string}` | — | `core:clipboard-manager:default` | |
| `dialog_open` | `{filters?, multiple?, directory?}` | `{paths: string[]}` | `dialog:default` | |
| `dialog_save` | `{defaultPath?, filters?}` | `{path?: string}` | `dialog:default` | |
| `os_open_path` | `{path: string}` | — | `os:default` | OS shell |

## 6. SSE / WebSocket strategy

| Path | Where it lives | Used by | Latency target |
|---|---|---|---|
| `/v1/stream/usage` (SSE) | gateway | webview direct | <50ms |
| `/v1/stream/logs` (SSE) | gateway | webview direct | <50ms |
| `/v1/stream/analytics` (SSE) | gateway | webview direct (high-rate) or SvelteKit proxy | <100ms |
| `/v1/ws` (WS) | gateway | playground (binary-friendly), MCP | <50ms |
| `/v1/stream/playground` (SSE) | gateway | webview direct (low-latency) | <50ms |
| `/api/stream/*` (SSR proxy) | SvelteKit | any page that needs same-origin SSE | <150ms |

Tauri `stream` plugin surfaces gateway stderr/stdout to webview as an SSE-equivalent under `gateway://log`.

## 7. Build & package

### 7.1 Monorepo layout

```
omniroute-monorepo/                     # new sibling repo
  pnpm-workspace.yaml                   # pnpm 9.x
  package.json
  tsconfig.base.json                    # strict
  rust-toolchain.toml                   # 1.85
  Cargo.toml                            # workspace root
  oxlint.json
  .size-limit.json
  .github/workflows/
    ci.yml
    release.yml
  apps/
    web/                                # SvelteKit 2 (see 06_SVELTE_HONO_RESEARCH.md)
    desktop/                            # Tauri 2 shell
    desktop-lite/                       # (optional) Electrobun shell, macOS-only
  packages/
    shared-types/                       # zod schemas
    ui-tokens/                          # design tokens (optional)
    sdk-js/                             # Hono hc client
  crates/
    gateway/                            # Rust single binary (links to omniroute-v4)
  tools/
    scripts/
      sync-env.mjs
      gen-openapi-client.mjs
      check-routes-parity.mjs
      check-file-size.mjs
    ci/
      sign-mac.sh
      sign-win.sh
      sign-linux.sh
```

### 7.2 Per-OS build matrix

| OS | arch | Targets | Sign | Publish |
|---|---|---|---|---|
| macOS | arm64 | .app, .dmg | Developer ID + notarization | GitHub Release + Sparkle feed |
| macOS | x64 | .app, .dmg | Developer ID + notarization | GitHub Release + Sparkle feed |
| Windows | x64 | .msi, .exe (NSIS) | EV cert | GitHub Release + Windows Update (opt) |
| Linux | x64 | .deb, .rpm, AppImage | GPG | GitHub Release + apt repo (P1) |
| Linux | arm64 | .deb, .rpm, AppImage | GPG | GitHub Release |

### 7.3 CI pipeline (`.github/workflows/release.yml`)

```
1. checkout
2. setup pnpm + bun + node 22 + rust 1.85 + tauri-prereqs (linux only)
3. cache pnpm + cargo
4. pnpm install --frozen-lockfile
5. pnpm lint          # oxlint
6. pnpm typecheck     # tsgo + svelte-check
7. pnpm test          # vitest unit + browser
8. pnpm build:web     # sveltekit build
9. cargo build --release -p gateway
10. matrix[os]:
    - macOS: codesign + notarize + tauri build (universal2)
    - Windows: codesign + tauri build (msi, nsis)
    - Linux: tauri build (deb, rpm, appimage)
11. upload artifacts to GitHub Release
12. write updates.json for tauri-plugin-updater
```

### 7.4 Dev mode (`pnpm dev`)

```
concurrently
  - pnpm --filter gateway run dev       (cargo run -p gateway, port 20128)
  - pnpm --filter web dev               (vite dev, port 5173)
  - pnpm --filter desktop tauri:dev     (cargo tauri dev, hosts 5173 in webview)
```

## 8. Security model

- Tauri webview origin: `tauri://localhost` (default in Tauri 2).
- CSP locked in both `tauri.conf.json` and SvelteKit headers.
- SvelteKit adds: `Content-Security-Policy: default-src 'self'; connect-src 'self' http://127.0.0.1:20128; script-src 'self' 'sha256-...'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;`
- Gateway binds `127.0.0.1:20128` only. Public bind requires explicit `--public` flag, off by default.
- No `nodeIntegration`. No `webviewTag`. No `enableRemoteModule`.
- Cookies: `SameSite=Strict; Secure; HttpOnly; Path=/`. CSRF token on all mutating routes.
- Virtual keys: opaque, short-lived (24h), scoped (provider, model, rate-limit, cost-cap).
- Device cert: 30-day, stored in OS keychain via `tauri-plugin-stronghold`, refreshable.
- Audit log: every mutating action written to the same SQLite (`~/.omniroute/storage.sqlite`), 365-day retention.
- All Tauri commands go through a `Result<T, AppError>` where `AppError` is a serde struct with `{code, message, hint}` — no panic escapes to webview.

## 9. Observability

- OpenTelemetry traces from the gateway, from SvelteKit SSR, from Tauri commands (via `tracing` + `tracing-subscriber` + `opentelemetry-otlp`).
- One trace context per request, propagated via W3C `traceparent` header from SvelteKit → gateway.
- Logs: structured JSON, one line per event, written to `~/.omniroute/logs/<date>.jsonl`. The "Logs" page in the dashboard tails this file via SSE.
- Metrics: Prometheus exposition on `127.0.0.1:20128/metrics` for the gateway; SvelteKit publishes its own; Tauri publishes via `metrics` plugin. Local-only; remote scrape requires `--public`.

## 10. Rollout

| Version | Status | Tauri | Web (SvelteKit) | Gateway (Rust) | Electron | Next.js |
|---|---|---|---|---|---|---|
| v4.0-alpha | week 4 | optional | `/v4` route | default | default | default |
| v4.0-beta | week 12 | default | default | default | opt-in fallback | opt-in fallback |
| v4.0-GA | week 16-20 | default | default | default | opt-in fallback | opt-in fallback |
| v4.1 | week 24-28 | default | default | default | opt-in fallback | opt-in fallback |
| v4.2 | week 32-40 | default | default | default | deprecated | deleted |

## 11. Risks & open decisions

1. **Electron fallback window.** How long do we keep Electron after GA? Default: 1 minor release (v4.1).
2. **Webview-only headless mode.** Should the SvelteKit app run without Tauri (e.g. on a server box)? Default: yes, `pnpm --filter web preview` serves the SvelteKit app on `:3000` standalone.
3. **Multiple devices per user.** Pair flow allows N devices. Default: 5 max.
4. **Stronghold vs file-based cert.** Stronghold is alpha; fall back to AES-GCM file in `$APPDATA/OmniRoute/cert.bin` if needed.
5. **Cross-platform cert install on Linux.** polkit prompt or pkexec? Default: pkexec with a `.policy` file in `/usr/share/polkit-1/actions/`.
6. **Tray menu refresh.** When does the menu regenerate? Default: on `gateway://state-changed` event.
7. **OS notifications permission on macOS.** Required for first-run; document in onboarding.
