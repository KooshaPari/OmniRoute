# Tauri Active Desktop Specification

## Intent

Tauri 2 is the only active desktop target. The existing SvelteKit frontend and
Hono/API boundary remain shared; provider selection, routing, retries, and
response healing stay in the existing service layer and are not reimplemented
in Rust. Electron and Electrobun source and history remain preserved as
inactive evidence.

## Acceptance gates

| ID    | Gate                                                                | Evidence                                                          | Status               |
| ----- | ------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------- |
| AD-01 | Tauri shell manifest, capability, commands, and lifecycle exist     | `apps/desktop/src-tauri/`                                         | passed locally       |
| AD-02 | Rust lifecycle unit test passes                                     | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`    | passed locally       |
| AD-03 | Active setup/release policy rejects Electron/Electrobun drift       | `npm run check:active-desktop`                                    | passed locally       |
| AD-04 | Desktop smoke fixture executes                                      | `npm --prefix apps/desktop run smoke`                             | passed locally       |
| AD-05 | Svelte/browser and Tauri workflows have shared parity fixtures      | `apps/desktop/tests/parity-matrix.ts`, `apps/web/src/lib/parity/` | pending              |
| AD-06 | Hosted required checks and branch protection are green              | GitHub PR check run IDs                                           | pending              |
| AD-07 | Packaged macOS artifact launches, reaches readiness, and shuts down | release artifact + launch transcript                              | pending human/hosted |

## Non-goals

- Do not delete or rewrite Electron/Electrobun history.
- Do not add provider or routing logic to the Tauri shell.
- Do not declare release readiness from local checks alone.
