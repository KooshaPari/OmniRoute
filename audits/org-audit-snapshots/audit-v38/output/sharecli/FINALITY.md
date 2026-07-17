# Product finality + OS parity

sharecli ships **three product lanes** with explicit finality, and a **four-host
parity floor** (macOS · Windows · Linux · WSL). Native stacks stay optimal per
OS; nothing below the floor is “MVP complete.”

## Finality lanes

| Lane | Product | Finality | Notes |
|------|---------|----------|--------|
| A | CLI + `sharecli serve` | **GA** | Unsigned archives OK until L112 signing |
| B | Native tray / menubar | **Beta** | Per-OS native UI; WSL via bridge |
| C | Dashboard / status UI | **Beta floor** | Web cockpit everywhere; macOS native `DashboardView` is the optimality peak |

Do **not** claim GA for tray/desktop until codesign/notarize (L112) and classic
installers (L108) land.

## Parity floor (every host)

| Capability | Requirement |
|------------|-------------|
| CLI install + `serve` | Same flags; `GET /healthz` / `/readyz`; OpenAPI contract |
| Process list / stop / status | Same CLI verbs + IPC schema |
| Tray / menubar | Visible status item on GUI hosts |
| Dashboard | One click from tray **or** `http://127.0.0.1:9000/` |
| Release artifact | Downloadable archive **or** documented WSL→host bridge |
| Docs | This file + [`deploy.md`](../deploy.md) row per host |

## Maximum optimality per OS

| Host | Optimal stack | Parity path |
|------|---------------|-------------|
| **macOS** | Swift [`desktop/ShareCLITray`](../../desktop/ShareCLITray) — NSStatusItem + NSPopover + `DashboardView` | Exceeds floor (native desktop window) |
| **Windows** | WinUI [`windows/ShareCLITray`](../../windows/ShareCLITray) + CLI zip; open web cockpit from tray | Tray + dashboard |
| **Linux** | [`sharecli-tray-linux`](../../crates/sharecli-tray-linux) (StatusNotifier) + CLI tarball; tray opens web cockpit | Tray + dashboard |
| **WSL** | CLI **inside** WSL; tray/dashboard via **Windows tray → forwarded port** (preferred) or WSLg + Linux tray | Equal capabilities through bridge |

Do not unify on Electron/Tauri for MVP — that trades away per-OS optimality.

## WSL bridge (parity)

1. In WSL: `sharecli serve --bind 0.0.0.0:9000`
2. From Windows: open `http://127.0.0.1:9000/` (mirrored localhost) **or** run
   `ShareCLITray` against the WSL-published port.
3. Optional: WSLg + `sharecli-tray-linux` if a Linux desktop session is available.

Smoke: `curl -fsS http://127.0.0.1:9000/healthz` from both WSL and Windows.

## Local builds

```bash
just build-cli
just build-tray-linux      # Linux host
just build-tray-macos      # macOS: ffi + Swift (tray + desktop)
just build-tray-windows    # Windows: WinUI
just wsl-parity-check      # prints bridge checklist
```

## CI artifacts

| Job / artifact prefix | Host | Lane |
|----------------------|------|------|
| `sharecli-*-unknown-linux-gnu` | Linux CLI | A |
| `sharecli-*-apple-darwin` | macOS CLI | A |
| `sharecli-*-pc-windows-msvc` | Windows CLI | A |
| `sharecli-tray-linux-*` | Linux tray | B |
| `sharecli-desktop-macos-*` | macOS tray+desktop | B+C |
| `sharecli-tray-windows-*` | Windows tray | B |

See `.github/workflows/desktop-builds.yml` (PR smoke) and `release.yml` (tag/dispatch attach).
