# WP-33: Tauri: scaffold (src-tauri/Cargo.toml + tauri.conf.json)

**Sequence:** 31
**State:** done (recovered from doing)
**Agent:** orch-w15-direct
**Date:** 2026-06-20
**Acceptance:** `tauri build` produces `.app` (macOS) and `.dmg` (Windows: `.exe` + `.msi`)

## Layout

```
src-tauri/
    Cargo.toml              # Crate manifest
    tauri.conf.json         # App config (windows, bundle, identifier)
    build.rs                # tauri-build invocation
    capabilities/
        default.json        # Default capability (dialog, fs, window perms)
    src/
        main.rs             # Binary entrypoint
        lib.rs              # run() builder
    icons/                  # (placeholder; populated by `tauri icon`)
```

## Build

```bash
cd src-tauri
cargo tauri build      # produces .app + .dmg
cargo tauri dev        # dev mode with hot reload
```

## Tauri 2.x capability model

`capabilities/default.json` declares the windows (`["main"]`) and permissions
(`core:*`, `fs:default`, `dialog:default`). Capabilities replace the legacy
`allowlist` from Tauri 1.x.
