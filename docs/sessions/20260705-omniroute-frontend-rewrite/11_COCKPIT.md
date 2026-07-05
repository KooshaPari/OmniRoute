# Frontend + Native Rewrite — Cockpit

**Date:** 2026-07-05 · **Lane:** frontend + native · **Status:** decision-complete, awaiting sponsor go

## 1. Top bracket

[omniroute-v4 frontend ok, Tauri 2 research ok, Svelte 5/Hono stack ok, dashboard audit ok, integration arch ok, impl plan ok, ...]

## 2. Progress

```
#####.....  50%   decision-complete
#####.....  50%   research + audit
#####.....  50%   impl plan
.....       0%   phase 0 bootstrap
.....       0%   phase 1 foundations
.....       0%   phase 2 first page
.....       0%   phase 3 hard pages
.....       0%   phase 4 all routes
.....       0%   phase 5 desktop
.....       0%   phase 6 hardening
```

## 3. Lanes

```
FRONTEND-STACK   [ok]  Svelte 5.56 + SvelteKit 2.69 + Hono 4.12 + bits-ui 2.18 + shadcn-svelte 1.3
NATIVE-SHELL     [ok]  Tauri 2 (api 2.11, 30+ plugins), beats Electron on every axis
DASHBOARD-AUDIT  [ok]  47 routes inventoried, combos (4,629 LoC) is the worst
INTEGRATION      [ok]  3-process model, 35 Tauri commands, OpenAPI contract preserved
IMPL-PLAN        [ok]  16-20w (1 eng) / 7-9w (3 parallel lanes), 4-7 milestone rollout
```

## 4. Agents

| agent | task | state | summary |
|---|---|---|---|
| research_svelte_hono_stack | research | done | Svelte 5.56 + SvelteKit 2.69 + Hono 4.12 + bits-ui 2.18 + Paraglide 2.20 + Arctic 3.7 + CodeMirror 6 (drop Monaco) |
| research_native_desktop | research | done | Tauri 2 wins (bundle 12-20MB, RAM 60-90MB, cold start 0.6-0.9s); Electrobun 1.18 alt; Slint stretch; Flutter rejected |
| audit_dashboard_surface | audit | done | 47 routes, 40 API groups, 15 Electron IPC; combos 4,629 LoC = biggest page |
| design_integration_architecture | design | done | 3-process, 35 Tauri commands, OpenAPI preserved, SvelteKit-on-Bun |
| (impl) | bootstrap | pending | sponsor go needed |

## 5. Next steps / questions for sponsor

1. **Go on D1 (stack):** Svelte 5 + SvelteKit 2 + Hono + bits-ui + shadcn-svelte + Paraglide + Arctic + CodeMirror 6 + Tauri 2. Default = yes.
2. **Go on D2 (server runtime):** Bun 1.3.10 dev + Hono; Node 22 LTS for prod (adapter-node + bun runner). Default = yes.
3. **Go on D3 (monorepo location):** `omniroute-monorepo/` sibling of existing fork. Default = yes.
4. **Go on D4 (adapter):** `@sveltejs/adapter-node` canonical; `bun --bun` runner if Bun-deploy is desired. Default = yes.
5. **Go on D5 (desktop):** Tauri 2 canonical; Electron 42 opt-in fallback for v4.0-beta/v4.1. Default = yes.
6. **Go on D6 (i18n):** Paraglide JS 2.20; port next-intl messages 1:1. Default = yes.
7. **Go on D7 (editor):** CodeMirror 6 in playground (saves ~3MB). Default = yes.
8. **Go on D8 (migration):** SvelteKit at `/v4` route, Next.js stays at `/` for v4.0-beta; flip in v4.0-GA. Default = yes.
9. **Go on D9 (schema):** Zod 4.4 canonical; generated into Rust via progenitor. Default = yes.
10. **Go on D10 (test):** Vitest 4.1 (node + browser) + Playwright 1.61. Default = yes.

If all D1-D10 default to yes, parent will start Phase 0 (monorepo bootstrap) on next turn.
