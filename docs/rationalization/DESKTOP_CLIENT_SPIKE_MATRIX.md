# Desktop client spike matrix

> Companion to [ADR-ECO-015](../adrs/ADR-ECO-015-hybrid-gateway-app-layer.md).  
> Converge vibeproxy + OmniRoute desktop attempts into one path.

## Candidates

| Stack | Packaging | OAuth/proxy integration | Cross-platform | FFI to Go planes | Experimental fit |
|-------|-----------|-------------------------|----------------|------------------|------------------|
| **Native Swift** | macOS menu-bar native | Strong (vibeproxy heritage) | macOS-first | via cgo/FFI | Medium |
| **FFI-only** | Minimal shell | cliproxy++ as subprocess | High | Direct | Low UX |
| **FFI + Electrobun** | Bun-native desktop | TS ecosystem | macOS/Linux | Bun FFI | High |
| **FFI + Tauri** | Webview + Rust core | Rust bridge to cliproxy | macOS/Win/Linux | Tauri plugin | High |

## Audit inputs

| Repo | Branches | Harvest target |
|------|----------|----------------|
| vibeproxy | 6 | OAuth client UX, menu-bar patterns |
| OmniRoute | 26 | Router UI, deploy stack, CLI surface |

## Selection gate

Pick one stack when prototype demonstrates:

1. Menu-bar or tray UX for CLI proxy control
2. OpenAI-compatible local endpoint to phenotype-gateway planes
3. Reproducible build on macOS (P0); Linux optional (P1)

## Output

- Spike dir: `OmniRoute/apps/desktop/` **or** `phenotype-gateway/spikes/desktop/` (record choice in registry PR)
- Registry disposition: vibeproxy → **ABSORB** into chosen spike (already docs in cliproxy++ #1024)
