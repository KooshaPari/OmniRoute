# OmniRoute v4 Monorepo

> Frontend + native shell rewrite for [OmniRoute](https://github.com/KooshaPari/OmniRoute), targeting v4.0.
> Backend Rust rewrite runs in parallel in `../OmniRoute-pr232-policyfix-20260703/backend-rust/`.

## Stack

- **Web:** SvelteKit 2 (Svelte 5 runes) + Hono 4 + Tailwind 4 + bits-ui 2.18 + shadcn-svelte 1.3
- **Native:** Tauri 2 (macOS / Windows / Linux) — Electrobun reserved for a future macOS-lite build
- **i18n:** Paraglide JS 2.20 (compiler-first, tree-shaken, SSR-safe)
- **Auth:** Arctic 3.7 + hand-rolled session cookies (replaces archived Lucia)
- **Editor:** CodeMirror 6 (replaces Monaco; ~150KB vs ~3MB)
- **DnD:** svelte-dnd-action 0.9.7 (replaces dnd-kit)
- **Graph:** @xyflow/svelte 1.6 (replaces @xyflow/react)
- **State:** Svelte 5 runes (local) + @tanstack/svelte-query 6.1 (server)
- **Schema:** Zod 4.4 (canonical, shared by client + server + Hono + Rust via progenitor)
- **Test:** Vitest 4.1 + Playwright 1.61 + MSW 2.14
- **Toolchain:** oxlint 1.72 + tsgo 7 + bun 1.3.10 + vite 8

**No ESLint.** **No turborepo/nx.** pnpm workspaces + tsc project refs + tsgo for builds.

## Layout

```
omniroute-monorepo/
  apps/
    web/         # SvelteKit 2 dashboard (apps/web)
    desktop/     # Tauri 2 native shell (apps/desktop)
  packages/
    shared-types/   # Zod schemas (Provider, Combo, ApiKey, ...)
    sdk-js/         # Hono `hc` typed RPC client
  crates/
    gateway/     # Tauri-side gateway process manager (links to backend-rust)
  tools/
    scripts/     # sync-env, parity checks, codegen
  docs/
    sessions/    # session-based work docs
```

## Quick start

```bash
# 1. Install
pnpm install

# 2. Copy env
cp .env.example .env

# 3. Run all three processes (gateway + web + desktop)
pnpm dev

# OR run individually
pnpm dev:gateway   # cargo run from backend-rust (or build path)
pnpm dev:web       # sveltekit dev server
pnpm dev:desktop   # tauri dev (loads webview)
```

## Validation gates

| Gate | Command | Pass criteria |
|---|---|---|
| Lint | `pnpm lint` | 0 errors |
| Type | `pnpm typecheck` | 0 errors |
| Test | `pnpm test` | ≥80% unit coverage, ≥70% component |
| Bundle | `pnpm size` | shell < 120KB, per-route < 50KB |
| Build (web) | `pnpm build:web` | adapter-node produces server/ + client/ |
| Build (desktop) | `pnpm build:desktop` | tauri build produces .app/.dmg on macOS |

## Status

See `docs/sessions/20260705-svelte-hono-rewrite/` (in the parent fork) for the full plan.
