# DAG + Work Breakdown Structure

## Phase DAG

```
                   Phase 0               Phase 1           Phase 2             Phase 3
                Fork reconciliation   Vertical slice   Feature parity       Cutover
                ===================   ==============   ===============      =========

[upstream v3.8.44] --+
                     |
[30+ long-horizon] --+--> [fork clean] --+--> [monorepo] --+--> [all 47 routes] --+--> [flip flag]
                     |                  |                  |                     |
                     |                  +--> [Tauri 2]     +--> [Paraglide 42]    +--> [remove Next]
                     |                  +--> [Hono BFF]    +--> [hardening]       +--> [Electron deprec.]
                     |                  +--> [6 routes]    |                     |
                     |                                     |                     v
                     v                                     |                [Tauri updater]
                [cut feat/svelte-hono-rewrite]              |                [soak W15-16]
                                                           |
   * = critical path:  upstream merge -> 6 routes -> all 47 -> flip -> soak
```

## Phase 0: Fork Reconciliation (W1-W2)

| WBS | Task | Owner | d | Depends | Deliverable |
|---|---|---|---|---|---|
| P0.1 | Merge upstream v3.8.44 into L5-122 main | - | 1-2 | - | Merge commit, integration test |
| P0.2 | Reconcile L22 (cargo-mutants) | - | 1 | P0.1 | Stacked PR |
| P0.3 | Reconcile L25 (loom-tests pheno-port-adapter) | - | 1 | P0.1 | Stacked PR |
| P0.4 | Reconcile T2/T4/T5/T7/T8 v14 modules | - | 2-3 | P0.1 | 5 stacked PRs |
| P0.5 | Reconcile L5-114 (llms-txt) | - | 0.5 | P0.1 | Stacked PR |
| P0.6 | Reconcile L39 (clap-ext) | - | 0.5 | P0.1 | Stacked PR |
| P0.7 | Cut `feat/svelte-hono-rewrite` from clean main | - | 0.5 | P0.2-P0.6 | Branch at v3.8.45+ |

## Phase 1: Vertical Slice (W3-W6)

| WBS | Task | Owner | d | Depends | Deliverable |
|---|---|---|---|---|---|
| P1.1 | Bun workspaces scaffold (apps/desktop,apps/web,apps/bff,packages/*) | - | 1 | P0.7 | package.json tree |
| P1.2 | Tauri 2 shell + SvelteKit dev server integration | - | 3 | P1.1 | Hello-world webview in Tauri window |
| P1.3 | Hono BFF (loopback to Next.js :20128) | - | 2 | P1.1 | Hono app with reverse proxy |
| P1.4 | Tailwind preset (port `src/app/globals.css`) | - | 1 | P1.1 | `@phenotype/tailwind-preset` |
| P1.5 | Feature flag `?web=svelte` per-route | - | 1 | P1.2,P1.3 | SvelteKit hooks + Next middleware |
| P1.6 | shadcn-svelte primitives (Button, Card, Input, Select) | - | 1 | P1.4 | ui/ primitives |
| P1.7 | Migrate `/login` (Svelte 5 runes) | - | 1 | P1.5,P1.6 | Live route, Svelte form |
| P1.8 | Migrate `/callback` (OAuth return) | - | 1 | P1.7 | Live route |
| P1.9 | Migrate `/dashboard` (home) | - | 2 | P1.7,P1.8 | Live route, SvelteKit load |
| P1.10 | Migrate `/dashboard/providers` (DataTable) | - | 2 | P1.6,P1.9 | Live route, TanStack table |
| P1.11 | Migrate `/dashboard/settings/general` (sveltekit-superforms) | - | 2 | P1.6 | Live route, Zod form |
| P1.12 | Migrate `/dashboard/health` (Hono SSE + EventSource) | - | 1 | P1.3 | Live SSE stream |
| P1.13 | Migrate `/dashboard/usage` (DataTable) | - | 2 | P1.10 | Live route |
| P1.14 | CI matrix (mac/win/linux) | - | 2 | P1.2-P1.13 | GitHub Actions matrix green |
| P1.15 | Visual regression baseline (pixelmatch) | - | 1 | P1.7-P1.13 | Snapshots committed |

## Phase 2: Feature Parity (W7-W14)

| WBS | Task | Owner | d | Depends | Deliverable |
|---|---|---|---|---|---|
| P2.1 | W7 Foundations: theme, layout shell, command palette | - | 5 | P1.* | Layout primitives |
| P2.2 | W8 Settings: providers CRUD, models, accounts, security | - | 5 | P2.1 | 6+ routes |
| P2.3 | W9 Cost & analytics: usage, cost, billing, logs | - | 5 | P2.2 | 4 routes + charts |
| P2.4 | W10 Tooling: MCP server config, A2A, skills | - | 5 | P2.1 | 3 routes |
| P2.5 | W11 Routers & combos: combos editor (4,629 LoC port), fallback, model router | - | 5 | P2.2 | Combos UI in Svelte 5 runes |
| P2.6 | W12 Memory / cache / batch / webhooks / audit | - | 5 | P2.1 | 5 routes |
| P2.7 | W13 i18n: Paraglide migration 42 locales (RTL ar/he) | - | 5 | P2.* | 42 message trees, RTL preserved |
| P2.8 | W14 Hardening: a11y (axe-core), perf budgets, OTel, security review | - | 5 | P2.* | All a11y green, perf budget met |

## Phase 3: Cutover (W15-W16)

| WBS | Task | Owner | d | Depends | Deliverable |
|---|---|---|---|---|---|
| P3.1 | Flip `OMNI_WEB_STACK=svelte` to default | - | 0.5 | P2.* | Env flip in CI |
| P3.2 | Soak window (1-2w) | - | 7-10 | P3.1 | No regressions |
| P3.3 | Remove Next from desktop builds | - | 1 | P3.2 | Smaller bundle |
| P3.4 | Tauri updater wired (GitHub Releases) | - | 1 | P1.2 | Auto-update end-to-end |
| P3.5 | Electron desktop deprecated (frozen, security-only) | - | 0.5 | P3.3 | Release notes |
| P3.6 | `desktop-electrobun/` archived as fallback ref | - | 0.5 | - | Archive branch |

## Critical Path

```
upstream v3.8.44 merge (P0.1)
  -> long-horizon reconcile (P0.2-P0.6)
  -> feat/svelte-hono-rewrite cut (P0.7)
  -> Tauri 2 shell (P1.2)
  -> 6 routes (P1.7-P1.13)
  -> CI matrix green (P1.14)
  -> W11 combos editor port (P2.5)
  -> W14 hardening (P2.8)
  -> flip flag (P3.1)
  -> soak (P3.2)
  -> Tauri updater (P3.4)
```

~16 weeks serial. With 2-3 parallel lanes (web, desktop, BFF), compress to 8-10w.

## Cross-Project Dependencies

| Project | Dependency | Status |
|---|---|---|
| Backend Rust rewrite (`backend-rust/`) | Must have `/v1/*` OpenAPI 3.1 stable for Hono RPC types | Phase 1 dependency |
| Upstream `diegosouzapw/OmniRoute` | Need 3.8.44 changes; gap 2,585 ahead / 15 behind | Phase 0 dependency |
| ADR-015 (Electrobun spike) | Preserved as fallback ref, not active path | Fulfilled |
| Existing `design.md` + `src/app/globals.css` | Source of truth for design tokens | Reference for P1.4 |
| `next-intl` 42 message files | Source of truth for Paraglide migration | W13 reference |

## Blockers & Resolutions

| Blocker | Resolution | Phase |
|---|---|---|
| Upstream breaking changes in 3.8.40-3.8.44 | One-pass integration test after each minor bump | P0 |
| Branches touching same files (pheno-otel, pheno-port-adapter) | Stacked PRs with explicit rebase order | P0 |
| Tauri 2 macOS Developer ID cert | Procurement spike W3; sign-without for beta, hard-required for GA | P1 |
| Combos editor is 4,629 LoC | Port in W11, not all upfront | P2 |
| OpenAI-compatible /v1/* must not regress | Reverse-proxy via Hono BFF, full integration test on every PR | P1-P3 |
