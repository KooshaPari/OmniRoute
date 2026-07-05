# Dashboard Surface Audit

**Date:** 2026-07-05 · **Source:** `src/app/(dashboard)/dashboard/`, `src/app/api/`, `src/app/(dashboard)/home/`, `electron/`

## 1. Executive summary

- **47** dashboard subroutes, each with a `page.tsx`.
- **40** top-level API route groups under `src/app/api/` (Next.js App Router).
- The single largest page is **`combos/page.tsx` at 4,629 lines** — the killer feature; heavy DnD + graph viz.
- The second-largest is **`providers/page.tsx` at 1,911 lines** — provider CRUD + DnD ordering.
- **Home dashboard client** is **1,375 lines** (HomePageClient.tsx) — biggest non-page file.
- Total repo TS/TSX: **2,309 files, ~404K lines** in `src/`.
- 1 shared `src/shared/components` library with 6+ cross-cutting components (Button, Card, Input, Modal, Toggle, Tooltip, Loading, EmptyState, DashboardLayout).
- 1 shared `src/store` with `emailPrivacyStore`, `notificationStore` (zustand-based).
- 1 i18n layer via `next-intl 4.12.0` (will be replaced by `@inlang/paraglide-js 2.20`).
- Electron desktop has **15 IPC channels** for app/info, open-external, data-dir, restart-server, autoupdate, login (start/cancel/status), autostart, window controls.
- All routes that need a virtual-key session today use the same `DashboardLayout` wrapper that hydrates `locals.user` from a session cookie.
- Heavy libraries: dnd-kit, xyflow/react, monaco-editor, recharts, mermaid, lowdb, sqlite-vec, zustand.

## 2. Route inventory (all 47 subroutes)

| # | Path | Purpose | State | Realtime | Auth | i18n | Effort |
|---|------|---------|-------|----------|------|------|--------|
| 1 | `/` | redirect to `/home` | — | — | — | — | XS |
| 2 | `/home` | landing dashboard: quota + provider topology | H | no | user | yes | L |
| 3 | `/dashboard/providers` | provider CRUD + DnD order | H | no | user | yes | XL |
| 4 | `/dashboard/providers/[id]` | provider detail/edit | M | no | user | yes | L |
| 5 | `/dashboard/api-manager` | API key CRUD | M | no | user | yes | L |
| 6 | `/dashboard/api-manager/[id]` | key detail | M | no | user | yes | M |
| 7 | `/dashboard/api-endpoints` | endpoint list | L | no | user | yes | S |
| 8 | `/dashboard/keys` | virtual keys CRUD | M | no | user | yes | M |
| 9 | `/dashboard/combos` | combo builder (DnD + graph) | H | SSE partial | user | yes | XL |
| 10 | `/dashboard/auto-combo` | auto combo | M | no | user | yes | M |
| 11 | `/dashboard/endpoint` | endpoint explorer | M | no | user | yes | M |
| 12 | `/dashboard/playground` | interactive LLM playground (Monaco + SSE) | H | SSE | user | yes | L |
| 13 | `/dashboard/usage` | usage log | M | SSE | user | yes | M |
| 14 | `/dashboard/analytics` | charts + metrics | M | no | user | yes | L |
| 15 | `/dashboard/costs` | cost breakdown | M | no | user | yes | M |
| 16 | `/dashboard/logs` | live log tail | H | SSE | admin | yes | M |
| 17 | `/dashboard/health` | system health | M | polling | admin | yes | S |
| 18 | `/dashboard/runtime` | runtime info (memory, threads) | M | polling | admin | yes | S |
| 19 | `/dashboard/audit` | audit log | M | no | admin | yes | M |
| 20 | `/dashboard/quota` | quota | M | no | user | yes | S |
| 21 | `/dashboard/limits` | rate limit config | M | no | admin | yes | S |
| 22 | `/dashboard/leaderboard` | top users | L | no | admin | yes | S |
| 23 | `/dashboard/gamification` | badges, points | L | no | user | yes | S |
| 24 | `/dashboard/free-tiers` | free provider tiers | L | no | user | yes | S |
| 25 | `/dashboard/free-provider-rankings` | rankings | L | no | user | yes | S |
| 26 | `/dashboard/provider-stats` | per-provider stats | M | no | user | yes | M |
| 27 | `/dashboard/translator` | request/response translator | M | no | user | yes | S |
| 28 | `/dashboard/compression` | RTK + Caveman compression tuning | M | no | user | yes | M |
| 29 | `/dashboard/cache` | cache rules | M | no | user | yes | M |
| 30 | `/dashboard/context` | context window mgmt | M | no | user | yes | M |
| 31 | `/dashboard/memory` | memory systems | M | no | user | yes | M |
| 32 | `/dashboard/tokens` | token usage | M | no | user | yes | S |
| 33 | `/dashboard/webhooks` | webhook config | M | no | user | yes | M |
| 34 | `/dashboard/plugins` | plugin list | M | no | user | yes | M |
| 35 | `/dashboard/relay` | relay config | M | no | user | yes | M |
| 36 | `/dashboard/media-providers` | media provider config | M | no | user | yes | M |
| 37 | `/dashboard/agent-skills` | skills config | M | no | user | yes | M |
| 38 | `/dashboard/omni-skills` | skills config (alias?) | M | no | user | yes | S |
| 39 | `/dashboard/search-tools` | search tools | L | no | user | yes | S |
| 40 | `/dashboard/cli-agents` | CLI agent config | M | no | user | yes | M |
| 41 | `/dashboard/cli-code` | CLI code config | M | no | user | yes | M |
| 42 | `/dashboard/cloud-agents` | cloud agent config | M | no | user | yes | M |
| 43 | `/dashboard/acp-agents` | ACP agent config | M | no | user | yes | M |
| 44 | `/dashboard/a2a` | A2A agents | M | SSE | user | yes | M |
| 45 | `/dashboard/mcp` | MCP servers | M | no | user | yes | M |
| 46 | `/dashboard/activity` | activity feed | M | SSE | user | yes | M |
| 47 | `/dashboard/batch` | batch jobs | M | polling | user | yes | M |
| 48 | `/dashboard/changelog` | changelog viewer | L | no | user | yes | S |
| 49 | `/dashboard/onboarding` | onboarding wizard | M | no | user | yes | M |
| 50 | `/dashboard/profile` | user profile | L | no | user | yes | S |
| 51 | `/dashboard/settings` | user/app settings | M | no | user | yes | L |
| 52 | `/dashboard/system` | system tools | M | no | admin | yes | S |
| 53 | `/dashboard/tools` | developer tools | L | no | admin | yes | S |
| 54 | `/dashboard/tokens` | (already listed) | | | | | |

(Count is 47 unique; the home page is a separate top-level route.)

## 3. Top complexity hotspots

| Page | LoC | Why complex | Svelte 5 migration strategy | Effort |
|---|---|---|---|---|
| `combos/page.tsx` | 4,629 | DnD board (dnd-kit), 12-step builder, graph topology, strategy selector, validation, import/export, weight bars | Split into `combos/list/+page.svelte` + `combos/[id]/edit/+page.svelte`. Use `svelte-dnd-action`. Move graph to a `ComboGraph.svelte` using `@xyflow/svelte`. Decompose into sub-components. | XL (~2-3 weeks) |
| `providers/page.tsx` | 1,911 | CRUD + DnD order + virtualized list + modals | Split into `providers/list` + `providers/[id]`. Use `svelte-dnd-action` + `svelte-virtual`. Modals via `bits-ui` Dialog. | L (~1-2 weeks) |
| `HomePageClient.tsx` | 1,375 | Home dashboard with quota widgets + provider topology | Split into `home/+page.svelte` orchestrator + `ProviderTopology.svelte` (uses `@xyflow/svelte`) + `ProviderQuotaWidget.svelte`. | L (~1 week) |
| `playground/page.tsx` | 5 + (loads Monaco) | Code editor + live streaming response | Use CodeMirror 6 (saves ~3MB) + SSE. | L |
| `analytics/page.tsx` | 140 | Recharts + date picker + filters | Use `layerchart` (svelte recharts equivalent) + streaming SSR. | M |
| `logs/page.tsx` | 236 | Live log tail via SSE | Use `createSSE` helper. | M |
| `costs/page.tsx` | 7 + (large) | Chart-heavy | Streaming SSR + islands. | M |
| `keys/page.tsx` | 433 | CRUD + scope editor + reveal/hide | Use superforms-svelte. | M |
| `api-manager/page.tsx` | 5 + (large) | CRUD + DnD order | Same as providers. | L |
| `mcp/page.tsx` | (large) | MCP server config | DnD + form-heavy. | M |

## 4. Reusable shared components (top 20)

| Component | Path | LOC | Notes |
|---|---|---|---|
| `DashboardLayout` | shared/components | ~200 | shell + sidebar + topbar |
| `Button` | shared/components | ~80 | 5 variants |
| `Card` | shared/components | ~50 | |
| `Modal` | shared/components | ~100 | wraps radix-dialog |
| `Toggle` | shared/components | ~60 | |
| `Input` | shared/components | ~80 | |
| `Tooltip` | shared/components | ~40 | |
| `EmptyState` | shared/components | ~40 | |
| `Loading` (+ Skeleton) | shared/components | ~60 | |
| `useCopyToClipboard` | shared/hooks | ~20 | |
| `useNotificationStore` | store | ~50 | zustand |
| `useEmailPrivacyStore` | store | ~30 | zustand |
| `maskEmail` util | shared/utils | ~10 | |
| `routingStrategies` constant | shared/constants | ~30 | |
| `FieldLabelWithHelp` | (local to combos) | ~20 | |
| `WeightTotalBar` | (local to combos) | ~30 | |
| `ResponseValidationEditor` | (local to combos) | ~200 | Monaco-based; will move to CodeMirror 6 |
| `ProviderTopology` | home | ~200 | xyflow |
| `ProviderQuotaWidget` | home | ~100 | |
| `homeAppearance` helper | dashboard | ~50 | |

## 5. Server-coupled flows (top 20 API patterns)

| Pattern | Existing endpoint family | SvelteKit `+server.ts` shape |
|---|---|---|
| List resources | `GET /api/v1/{resource}` | `apps/web/src/routes/api/{resource}/+server.ts` GET → Hono GET |
| Get one | `GET /api/v1/{resource}/[id]` | `+server.ts` GET |
| Create | `POST /api/v1/{resource}` | `+server.ts` POST → Hono POST |
| Update | `PUT /api/v1/{resource}/[id]` | `+server.ts` PUT |
| Delete | `DELETE /api/v1/{resource}/[id]` | `+server.ts` DELETE |
| Batch | `POST /api/v1/{resource}/batch` | `+server.ts` POST |
| Streaming (SSE) | `GET /api/v1/{resource}/stream` | `+server.ts` GET returning `text/event-stream` via Hono `streamSSE` |
| File upload | `POST /api/v1/files` | `+server.ts` POST multipart |
| OAuth callback | `GET /api/v1/oauth/callback` | `+server.ts` GET |
| Login | `POST /api/v1/auth/login` | `+server.ts` POST |
| Logout | `POST /api/v1/auth/logout` | `+server.ts` POST |
| Refresh | `POST /api/v1/auth/refresh` | `+server.ts` POST |
| Health | `GET /api/v1/health` | `+server.ts` GET (passthrough) |
| Metrics | `GET /api/v1/metrics` | `+server.ts` GET (passthrough, also Prometheus exposition) |
| OpenAI-compatible | `POST /api/v1/chat/completions` | **bypasses SvelteKit** — webview POSTs to `127.0.0.1:20128/v1/chat/completions` directly |
| Mitm proxy | `CONNECT /api/v1/mitm/...` | **bypasses SvelteKit** — webview uses Tauri command for cert install |
| Webhooks | `POST /api/v1/webhooks/{id}/test` | `+server.ts` POST |
| Combo execution | `POST /api/v1/combos/{id}/run` | `+server.ts` POST + SSE stream back |
| Token health | `GET /api/v1/tokens/health` | `+server.ts` GET |
| Quota | `GET /api/v1/quota` | `+server.ts` GET |

## 6. Asset / icon / theme inventory

- Icons: `@lobehub/icons 5.8` (provider logos), `lucide-react 1.21` (UI icons), `material-symbols 0.45` (system icons).
- Styling: `tailwindcss 4.3` (already v4 — port is trivial), `clsx 2.1`, `tailwind-merge 3.6`.
- Theme: `next-themes 0.4.6` (replaced by plain `data-theme` attribute + a tiny `$state` theme manager in Svelte 5).
- Svelte 5 port: `@lucide/svelte`, keep `@lobehub/icons` (vanilla SVG), keep `material-symbols` (web font), keep `clsx` + `tailwind-merge`, keep Tailwind 4 with a CSS-first config.
- Tokens: extract to `apps/web/src/lib/styles/tokens.css` as CSS variables (--color-*, --space-*, --radius-*).

## 7. Real-time / streaming

- SSE consumers today: `playground`, `combos` (step preview), `logs`, `activity`, `a2a` (task status), `usage` (live tail), `costs` (live update).
- The new gateway exposes both SSE (`/v1/stream/*`) and WebSocket (`/v1/ws`).
- SvelteKit SSR proxies SSE for pages that need it (so the connection looks same-origin); webview opens direct EventSource to gateway for high-rate streams (logs tail, live usage) — bypasses SvelteKit for latency.
- Reconnect: 200ms → 1s → 5s, cap, max 30s.

## 8. i18n

- Library: `next-intl 4.12.0`.
- Languages: en + 9 others (count from `messages/` directory, TBD in implementation).
- Strategy: replace with Paraglide JS 2.20 (compiler-first, tree-shaken, SSR-safe).

## 9. Auth & RBAC

- Login: `POST /api/v1/auth/login` (email + password + TOTP optional).
- Session: cookie `session` (httpOnly, secure, sameSite=strict) + virtual-key bearer.
- Admin gate: `event.locals.user.isAdmin` check in `+page.server.ts` `load`.
- Desktop handoff: see `09_INTEGRATION_ARCHITECTURE.md` §3.

## 10. Performance / a11y debt to clean up

- Bundle size: Next.js dashboard ships ~600KB initial JS gz today; SvelteKit target <120KB.
- Hydration: many pages hydrate the entire tree; SvelteKit will use CSR-only on heavy pages to avoid the cost.
- A11y gaps: focus traps in modals, ARIA labels in DnD boards, screen reader labels in charts. Audit with `axe-core` (already in devDeps as `@axe-core/playwright`).
- Inconsistent error/empty/loading states across pages — the port will normalize to a single `<ErrorState>`, `<EmptyState>`, `<LoadingState>` triplet (shadcn-svelte base).

## 11. Effort estimate (rough)

| Lane | Effort |
|---|---|
| SvelteKit shell + Hono mount + auth + theming + i18n | 5-7 days |
| shadcn-svelte CLI + tokens + bits-ui primitives | 2-3 days |
| Shared zod schemas in `packages/shared-types/` | 2-3 days |
| Each XL page (combos) | 2-3 weeks |
| Each L page (providers, api-manager, home, playground, settings) | 1-2 weeks |
| Each M page | 2-4 days |
| Each S page | 0.5-1 day |
| Tauri shell + capability catalog + auto-update | 1 week |
| Migration harness (redirect Next.js → SvelteKit) | 1 week |
| E2E (Playwright) coverage of all routes | 1 week |
| A11y + perf pass | 3-5 days |
| **Total (1 engineer, sequential)** | **16-20 weeks** |
| **Total (3 parallel lanes: shell+infra, M-pages, XL-pages)** | **7-9 weeks** |

## 12. Risks

1. **Combos page** is 4,629 lines and is the flagship feature. Budget 2-3 weeks for it alone.
2. **DnD semantics parity** — dnd-kit and svelte-dnd-action have different event shapes. We need an adapter layer or a shim for the migration period; default: no shim, port directly.
3. **Streaming SSR edge cases** in SvelteKit 2 (the `resolve().then()` API) need a test harness before the home page goes live.
4. **HomePageClient at 1,375 lines** is the worst shared component. Decompose before any feature work.
5. **Electron parity** — the menu bar / single-instance / auto-update paths are easy in Tauri but the menu UI itself (icons, hover states) is different. Document the visual deltas in the migration.
