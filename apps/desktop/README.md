# OmniRoute desktop (active Tauri 2 shell)

This is the canonical desktop application location. The shell is a thin
Tauri 2 wrapper around the SvelteKit frontend and Hono API boundary:

```text
Tauri 2 webview
      |
      +--> SvelteKit app (`apps/web`)
      +--> Hono/API contract (`apps/bff`)
      +--> typed runtime lifecycle commands (`src-tauri`)
```

The Rust shell owns desktop lifecycle and readiness only. Provider selection,
routing, retries, response healing, and Bifrost/FFI behavior remain in the
existing API and runtime layers; they must not be duplicated in Tauri.

## Development

Install the workspace dependencies, then run the Svelte development server
and Tauri shell from this directory:

```sh
bun install
bun run tauri:dev
```

The Tauri configuration proxies development traffic to the SvelteKit server
and serves the built frontend in production. Runtime commands are exposed
through the typed contract documented in `src-tauri/src/commands.rs`:

- `runtime_start`
- `runtime_stop`
- `runtime_readiness`
- `runtime_data_dir`
- `dashboard_origin`

Run the Rust lifecycle tests with:

```sh
cargo test --manifest-path src-tauri/Cargo.toml
```

## Inactive desktop implementations

Electron and Electrobun are preserved as historical evidence and rollback
references. They are not active setup, development, or release targets for
the current desktop architecture:

- [`../../electron/`](../../electron/) is the preserved Electron client.
- [`../../desktop-electrobun/`](../../desktop-electrobun/) is the preserved
  Electrobun spike.
- [`../../docs/legacy/omniroute-desktop-snapshot-2026-07-17/`](../../docs/legacy/omniroute-desktop-snapshot-2026-07-17/)
  contains the historical architecture and decision records.

Do not delete or rewrite those paths when changing the active Tauri shell.
