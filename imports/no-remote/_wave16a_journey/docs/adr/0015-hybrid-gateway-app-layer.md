# ADR-0015 — Hybrid gateway app layer (Tauri 2 + UDS JSON-RPC)

- Status: **Accepted (Phase 3 in progress)**
- Date: 2026-07-05
- Supersedes: pre-existing electron-wrapper-only model; the canonical path forward is Tauri 2,
  with Electrobun kept as opt-in alternative for teams who fork.
- Deciders: root agent + sponsor
- Source-of-truth session: `sessions/2026-07-05-omniroute-frontend-rewrite/`

## Context

OmniRoute runs as a hosted control plane (HTML+JS+REST) **and** a local-first desktop client
that needs to spawn/work alongside an "omni-core" Rust daemon. The legacy shell (Electron 28)
is being retired because: 80–150MB bundle per platform, security surface from embedded Chromium,
CPU/memory footprint, and slower iteration vs a system-WebView wrapper.

We want:
1. A native shell that hosts the existing **SvelteKit** web bundle **unchanged** (no rewrite of
   routes, BFF, hooks, i18n, etc.)
2. A **Rust-sidecar** model so the shell can supervise an `omni-core` daemon without subprocess
   hacks. Daemon IPC must work without exposing HTTP to the host OS.
3. **Cross-platform** packaging: Mac (.dmg + .app), Windows (.msi), Linux (.deb + .AppImage).

## Decision

**Primary shell: Tauri 2** (`tauri-desktop/`).
**Bridge: Tauri `invoke`/`event`** (webview ↔ shell) + **Unix domain socket / named pipe with
JSON-RPC 2.0 envelopes** (shell ↔ omni-core daemon). Wire schemas validated by Zod (TS) and
`schemars` (Rust) via the shared `@omniroute/api-contracts` workspace package.

Tauri plugins enabled:
- `tauri-plugin-store` — auth tokens, window state (encrypted at rest)
- `tauri-plugin-updater` — signed auto-update (`minisign`)
- `tauri-plugin-os` — platform info, deep link
- `tauri-plugin-log` — bridge logs to frontend
- Single-instance lock (built-in)

Capability allowlist enforces commands per scope; default deny. Webview CSP is `default-src 'self'`
plus a nonce for any inline. No `nodeIntegration`, no remote module — system WebView (WKWebView /
WebView2 / WebKitGTK) only.

### IPC bridge details

- **Socket paths:**
  - macOS  — `$TMPDIR/com.phenotype.omniroute/omni-core.sock`
  - Linux  — `$XDG_RUNTIME_DIR/omni-core.sock` (fallback `/tmp/omni-core-<uid>.sock`)
  - Windows — `\\.\pipe\omni-core`
- **Wire framing:** `Content-Length: N\r\n\r\n<JSON-RPC 2.0 body of N bytes>` (LSP precedent).
- **Auth:** short-lived token written 0600 to file next to socket, included in JSON-RPC
  `headers.authorization` per request. Rotated on every daemon start. Reject unauthed.
- **Reconnect:** exponential backoff (250ms, 500ms, 1s, 2s, 4s, 8s cap 60s before degraded mode).
- **Methods (v1):** `core.health`, `core.config.get`, `core.config.patch`,
  `proxy.chat_completions` (server-stream), `core.audit.list`, `core.metrics.tail`.

### Electrobun kept as opt-in

The `desktop-electrobun/` scaffold is preserved and `apps/desktop/README.md` redirects there.
Teams that fork and want a pure-Bun/TS native shell can opt out of Rust. We do **not** maintain
a parallel Electron implementation.

### Hard rejections

| Option | Why NO |
|---|---|
| Electron | Bundle bloat, security surface, perf — user requirement: "non-Electron" |
| Slint, Qt/Quick, Flutter desktop | Throws away the SvelteKit investment; matching cost vs benefit rejects |

## Consequences

### Positive
- ~10MB install per platform vs. ~150MB Electron.
- Faster cold-start; smaller attack surface; less memory.
- Rust sidecar lets us share types via `schemars` ↔ Zod (`@omniroute/api-contracts`).
- Tauri 2 is stable; cross-platform building is first-class.

### Negative
- We bind to system WebView bugs (rare on Mac/Win; WebKitGTK behind on Linux) instead of
  controlled Chromium — we must keep a feature-test matrix per release.
- Tauri plugins evolve quickly; we pin minor and gate on `cargo update`.
- Adding new IPC commands requires capability allowlist edit + Zod schema + Rust handler in
  three places; we codegen from the Zod schema via `zod-to-rust` (or write our own small
  transpiler if needed).

### Risks

- `omni-core` UDS on macOS sandbox for Electron→Tauri transition path (mitigation: pinned
  `TMPDIR` path; document).
- Windows named-pipe ACLs across sessions (mitigation: per-process token negotiation).
- Linux cutover trails Mac/Win (mitigation: prioritize macOS first in CI).

## References

- Tauri 2 docs — https://v2.tauri.app/
- Tauri's capability model — https://v2.tauri.app/security/capabilities/
- LSP `Content-Length` framing — https://microsoft.github.io/language-server-protocol/
- Zod ↔ schemars (community references)
- Session: `/Users/kooshapari/CodeProjects/Phenotype/repos/sessions/2026-07-05-omniroute-frontend-rewrite/`
