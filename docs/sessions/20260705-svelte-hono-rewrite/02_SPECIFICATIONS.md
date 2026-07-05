# Frontend + Native Rewrite — Implementation Plan (v4.0)

**Date:** 2026-07-05 · **Owner:** Frontend + Native lane · **Status:** Decision-complete

## 1. Summary

Replace the existing Next.js 15 dashboard + Electron 42 desktop with:

- **SvelteKit 2 + Svelte 5 (runes) + Hono 4.12** frontend (apps/web), deployed as a Tauri 2 webview bundle.
- **Tauri 2** native shell (apps/desktop) on macOS arm64/x64, Windows x64, Linux x64/arm64.
- Same **Rust gateway** binary the backend rewrite plan already chose; webview calls it over `127.0.0.1:20128`.
- Monorepo: `omniroute-monorepo/` as a sibling of the existing `OmniRoute-pr232-policyfix-20260703` repo, with pnpm workspaces + Cargo workspace at the root.
- All 47 dashboard subroutes preserved; all 40 API groups preserved; all 15 Electron IPC channels replaced with the Tauri command catalog (35 commands, see `09_INTEGRATION_ARCHITECTURE.md` §5).
- Toolchain: **oxlint 1.72 + tsgo 7 + bun 1.3.10 + vite 8 + tailwind 4.3 + bits-ui 2.18 + shadcn-svelte 1.3 + paraglide-js 2.20 + arctic 3.7**. **No ESLint.**

Out of scope: re-implementing the gateway (the backend lane owns that); rewriting any provider executor; changing the OpenAI-compatible API surface.

## 2. Workspace

```
omniroute-monorepo/                              # new sibling of existing repo
  pnpm-workspace.yaml
  package.json
  tsconfig.base.json
  rust-toolchain.toml
  Cargo.toml
  oxlint.json
  .size-limit.json
  .github/workflows/ci.yml
  .github/workflows/release.yml
  apps/
    web/                                          # SvelteKit 2 (see 06_SVELTE_HONO_RESEARCH.md)
    desktop/                                      # Tauri 2 (see 07_NATIVE_DESKTOP_RESEARCH.md)
  packages/
    shared-types/                                 # zod schemas
    sdk-js/                                       # hono `hc` client
  crates/
    gateway/                                      # links to omniroute-v4
  tools/
    scripts/                                      # sync-env, parity checks, codegen
  docs/
    sessions/<date>-frontend-rewrite/             # this folder
```

## 3. Key decisions

1. **Svelte 5 (runes) + SvelteKit 2 (adapter-node, bun runner).** No Next.js. Direct port; no svelte-jsx shim.
2. **Tauri 2 as canonical shell.** Beats Electron on every axis (bundle, RAM, cold start, security). Electron 42 stays as opt-in fallback for v4.0-beta/v4.1.
3. **Hono 4 in SvelteKit `hooks.server.ts`.** Same Hono app serves SSR pages and `+server.ts` API; the browser uses `hc<T>` for typed RPC.
4. **shadcn-svelte 1.3 (bits-ui 2.18 primitives).** Components owned in-repo, not a dep we can't patch.
5. **Paraglide JS 2.20** replaces next-intl 4.12. Tree-shaken, SSR-safe.
6. **Arctic 3.7 + hand-rolled sessions** replaces Lucia (archived) and Auth.js. 120 lines, full control over virtual-key scopes.
7. **CodeMirror 6** replaces Monaco in the playground (~150KB gz vs ~3MB). 20× smaller, Svelte-friendly, SSR-safe.
8. **`@xyflow/svelte 1.6`** for graph UIs (was @xyflow/react). **svelte-dnd-action 0.9.7** for DnD (was @dnd-kit). Both have working Svelte 5 ports.
9. **Zod 4.4** as the canonical schema language. Same schema in browser, SvelteKit, Hono, and gateway (Rust codegen via `progenitor`).
10. **Tauri webview-only by default.** Optional headless SvelteKit via `pnpm --filter web preview` for server-box deployments.
11. **No turborepo / nx.** pnpm workspaces + tsc project refs + tsgo for monorepo builds; the size doesn't justify the orchestration tool.

## 4. Phase plan

### Phase 0 — Bootstrap (week 1)

- Create monorepo scaffold: `pnpm-workspace.yaml`, `Cargo.toml`, `tsconfig.base.json`, `oxlint.json`, `.size-limit.json`, `rust-toolchain.toml`.
- Initialize `apps/web` with `pnpm create svelte@latest` (Svelte 5 + TypeScript + ESLint skipped).
- Initialize `apps/desktop` with `pnpm create tauri-app@latest` (Vue/React/Svelte — pick Svelte).
- Initialize `packages/shared-types` with the first zod schema: `Provider`.
- Initialize `crates/gateway` shell (links to omniroute-v4 once that lands).
- Wire `pnpm dev` with `concurrently` (gateway, web, desktop).
- CI: oxlint + tsgo + vitest + tauri build (macOS-arm64 only for the first green).

### Phase 1 — Foundations (weeks 2-3)

- Hono mounted in `hooks.server.ts`; one example route (`/api/v1/providers`).
- shadcn-svelte CLI init; install Button, Card, Input, Modal, Toggle, Tooltip, Dialog, Tabs, Select, Combobox, Toast, DropdownMenu.
- Tailwind 4 with tokens.css (CSS vars for color, space, radius).
- Paraglide JS 2.20 init; port en.json + 9 other locales.
- Arctic + session table (libsql/better-sqlite3) + login page.
- Tauri capabilities + first 10 commands (app_info, device_id, cert_get, gateway_spawn/stop/status, tray_set_status, notification_show, window_close).
- Hello-world SvelteKit page in the Tauri webview.
- **Validation gate:** `pnpm dev` opens Tauri window, SvelteKit page loads, gateway spawns, login works end-to-end.

### Phase 2 — First page (week 4)

- Port `apps/web/src/routes/providers/+page.svelte` from the existing `combos/page.tsx`'s *list* portion. Use svelte-dnd-action + svelte-virtual + bits-ui.
- Wire to gateway via Hono + `hc` client.
- **Validation gate:** smoke test that the page renders with seeded data, DnD reorders persist, optimisitc updates reconcile.

### Phase 3 — Hard pages (weeks 5-8)

- Port `combos/+page.svelte` (the 4,629-line monster) into `apps/web/src/routes/combos/+page.svelte` + `combos/[id]/edit/+page.svelte`. Split into 12 sub-components. Use `@xyflow/svelte` for the topology.
- Port `playground/+page.svelte` with CodeMirror 6 + SSE.
- Port `home/+page.svelte` with streaming SSR + islands.
- Port `logs/+page.svelte`, `analytics/+page.svelte`, `costs/+page.svelte`, `usage/+page.svelte`.
- **Validation gate:** Playwright E2E for each ported page; visual diff vs the Next.js version on seeded fixtures.

### Phase 4 — All remaining routes (weeks 9-12)

- Parallelize 3 lanes: M-pages (most routes), small S pages, settings/onboarding/profile.
- Port every remaining route per the inventory in `08_DASHBOARD_SURFACE_AUDIT.md`.
- **Validation gate:** Playwright covers all 47 routes; axe-core a11y score ≥95.

### Phase 5 — Desktop maturity (weeks 13-14)

- All 35 Tauri commands implemented and capability-allowed.
- Auto-update via tauri-plugin-updater; signed release on GitHub.
- macOS notarization pipeline.
- Windows code-signing pipeline.
- Linux .deb/.rpm/AppImage targets.
- **Validation gate:** Tauri build produces signed artifacts on all 5 target triples; auto-update round-trip works on a test channel.

### Phase 6 — Hardening + rollout (weeks 15-20)

- A11y pass; perf pass (LCP < 1.5s, JS shell < 120KB gz).
- Migration harness: Next.js → SvelteKit redirect for any route not yet ported; toggleable in Settings.
- v4.0-alpha dogfood.
- v4.0-beta (Tauri default).
- v4.0-GA (Electron deprecated).

## 5. Public API / type changes

This rewrite is *internal* — the public OpenAI surface does not change. The user-facing changes are:

- New: `omniroute-v4` binary replaces `omniroute` (Node) for the v4 line; `npm i -g omniroute` continues to work via the existing shim.
- New: Tauri desktop replaces Electron 42 for the v4 line; the existing `electron/` package stays as opt-in fallback.
- New: SvelteKit webapp replaces Next.js dashboard; the URL path is preserved (only the framework changes).
- New: Paraglide JS replaces next-intl; message keys are the same (we'll port the `messages/*.json` files 1:1).
- New: `device_certificate` for desktop login; see `09_INTEGRATION_ARCHITECTURE.md` §4.

## 6. File-level changes (signal-only)

- **Created:**
  - `omniroute-monorepo/{pnpm-workspace.yaml,package.json,tsconfig.base.json,oxlint.json,.size-limit.json,rust-toolchain.toml,Cargo.toml}`
  - `omniroute-monorepo/apps/web/{package.json,svelte.config.js,vite.config.ts,src/**}`
  - `omniroute-monorepo/apps/desktop/{package.json,src/**,src-tauri/{Cargo.toml,tauri.conf.json,capabilities/default.toml,src/**}}`
  - `omniroute-monorepo/packages/{shared-types,sdk-js}/src/**`
  - `omniroute-monorepo/crates/gateway/{Cargo.toml,src/**}`

- **Modified (legacy repo):**
  - `package.json` — add a `dev:v4` script that calls into the monorepo
  - `electron/` — kept verbatim; no new changes; deprecated in v4.1
  - `desktop-electrobun/` — kept as the lite-build seed; no new changes

- **Deleted (at v4.0-GA):**
  - `src/app/(dashboard)/**` (47 routes)
  - `src/components/**` (replaced by shadcn-svelte output)
  - `src/app/api/**` (replaced by SvelteKit `+server.ts` and Hono routes)

## 7. Test plan

| Layer | Framework | Coverage target | Notes |
|---|---|---|---|
| Unit (logic) | Vitest 4.1 node | ≥80% | `pnpm test` |
| Unit (component) | Vitest 4.1 browser (real browser via Playwright) | ≥70% | `@vitest/browser` |
| E2E (happy path) | Playwright 1.61 | all 47 routes | seeded fixtures + visual diff |
| E2E (auth) | Playwright 1.61 | login, logout, refresh, role gate | |
| E2E (SSE) | Playwright 1.61 | logs tail, usage live, playground | |
| E2E (DnD) | Playwright 1.61 | combos reorder, providers reorder | |
| API contract | openapi-validator | every route shape | from `crates/gateway/openapi.yaml` |
| A11y | @axe-core/playwright | ≥95 | per-page + per-flow |
| Perf | Lighthouse CI | LCP < 1.5s, TTI < 2.0s | per-route, gated in CI |
| Bundle | size-limit | shell < 120KB, per-route < 50KB | gated in CI |
| Lint | oxlint 1.72 | 0 errors, 0 warnings | gated in CI |
| Type | tsgo 7 | 0 errors | gated in CI |
| Mutation | Stryker (existing) | key modules ≥70% mutation score | gated in CI |
| Fuzz | fast-check (existing) | parsers + validators | gated in CI |
| Security | cargo-audit + npm audit + osv-scanner | 0 high/critical | gated in CI |
| Smoke (desktop) | tauri-driver | launch + spawn + tray + quit | per OS in CI |
| Smoke (gateway) | curl + jq | /healthz, /v1/models, /v1/chat/completions | per release |

## 8. Acceptance criteria

- All 47 dashboard subroutes present and functional in `apps/web`.
- All 40 API route groups present in SvelteKit `+server.ts` (or in Hono on the gateway).
- All 35 Tauri commands present and capability-allowed.
- Tauri build produces signed .app/.dmg/.msi/.exe/.deb/.rpm/AppImage on all 5 target triples.
- Auto-update round-trip works on the test channel.
- LCP < 1.5s on home + dashboard home.
- Bundle < 120KB gz for the shell; per-route < 50KB gz.
- 0 oxlint errors, 0 tsgo errors, ≥80% unit coverage, ≥70% component coverage.
- a11y axe-core ≥95.
- Full Playwright e2e green on a clean machine (CI matrix).
- Cold start: macOS arm64 < 800ms, Windows < 1.2s, Linux < 1.0s.
- Idle RAM: < 100MB on macOS M2.
- Bundle: macOS < 15MB, Windows < 25MB, Linux < 30MB.

## 9. Rollout

| Milestone | Week | Status |
|---|---|---|
| v4.0-alpha (dogfood) | 4 | internal |
| v4.0-beta (community opt-in) | 12 | opt-in default |
| v4.0-GA (default) | 16-20 | default; Electron fallback |
| v4.1 (Electron deleted) | 24-28 | |
| v4.2 (Next.js deleted) | 32-40 | |

## 10. Assumptions and defaults

- **D1: Stack** — Svelte 5 + SvelteKit 2 + Hono 4 + bits-ui + shadcn-svelte + Paraglide + Arctic + CodeMirror 6 + Tauri 2. *Confirm.*
- **D2: Server runtime** — Bun 1.3.10 for dev and Hono (production fallback Node 22 via adapter-node). *Confirm.*
- **D3: Monorepo location** — `omniroute-monorepo/` sibling of existing repo. *Confirm.*
- **D4: Adapter for SvelteKit** — `@sveltejs/adapter-node` (canonical); run with `bun --bun` if Bun-deploy is desired. *Confirm.*
- **D5: Desktop shell** — Tauri 2 as canonical; Electron 42 as opt-in fallback for v4.0-beta/v4.1. *Confirm.*
- **D6: i18n** — Paraglide JS 2.20; port next-intl messages 1:1. *Confirm.*
- **D7: Editor** — CodeMirror 6 (saves ~3MB). *Confirm.*
- **D8: Migration harness** — SvelteKit serves `/v4/*`; Next.js legacy stays at `/` for v4.0-beta. *Confirm.*
- **D9: Schema language** — Zod 4.4 everywhere; generated into Rust via progenitor. *Confirm.*
- **D10: Test framework** — Vitest 4.1 (node + browser) + Playwright 1.61. *Confirm.*

If D1-D10 are not answered, the recommended defaults in §3 and §10 are used.
