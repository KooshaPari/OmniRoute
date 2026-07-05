# OmniRoute Frontend Rewrite: Svelte/Hono + Tauri 2

**Session ID:** 20260705-svelte-hono-rewrite · **Date:** 2026-07-05
**Lane:** Frontend + Native shell (parallel to backend Rust rewrite)
**Target repo:** `OmniRoute-L5-122` (fork; worktree at `OmniRoute-pr232-policyfix-20260703`)
**Pre-work:** merge upstream v3.8.44 + reconcile 30+ long-horizon branches

## Goal

Replace the Next.js 16 / React 19 dashboard and the Electron 42 desktop with a
**Svelte 5 + SvelteKit 2** web app, a **Hono 4** BFF, and a **Tauri 2.x** native
shell. Cohabit behind a per-route feature flag (14 weeks, 3 phases, reversible).
Ship a PWA-optimized mobile browser experience. No native iOS/Android in this rewrite.

## Locked Decisions

| # | Decision | Value |
|---|---|---|
| D1 | Native shell | Tauri 2.x primary; `desktop-electrobun/` kept as fallback reference |
| D2 | Migration | Cohabit behind per-route flag `?web=svelte` |
| D3 | Mobile | Desktop + PWA-optimized only; no native iOS/Android |
| D4 | Repo target | L5-122 fork, pre-merged with upstream v3.8.44 + reconciled branches |

## Stack (locked, versions verified 2026-07-05)

| Layer | Pick | Version |
|---|---|---|
| UI | Svelte 5 (runes) + SvelteKit 2 | 5.56 / 2.69 |
| BFF | Hono 4 + zod-validator + node-server | 4.12 |
| Native | Tauri 2 + plugins (updater, stronghold, deep-link, fs, log, store, autostart, window, dialog, http, os, process, shell, notification) | 2.11 / 2.3-2.10 |
| UI primitives | shadcn-svelte + bits-ui + lucide-svelte | 1.3 / 2.18 |
| Forms | sveltekit-superforms + Zod 4 | - / 4.4 |
| Client cache | @tanstack/svelte-query | 6.1 |
| Real-time | Hono SSE + EventSource; Hono WS | - |
| i18n | Paraglide JS (replaces next-intl; 42 locales; RTL ar/he) | 2.20 |
| Editor | Monaco (kept from current) | - |
| Flow editor | @xyflow/svelte | 1.6 |
| Lint/format | oxlint + prettier (Bun-native, no ESLint) | 1.72 / - |
| Runtime | Bun 1.3.10 workspaces | 1.3.10 |
| Test | Vitest 4 + @vitest/browser + Playwright + axe-core + MSW | 4.1 / 4.1 / 1.61 / - / 2.14 |
| TypeScript | tsgo (Bun) | 7.0 |

## Repo Layout (target)

```
OmniRoute-L5-122/
  apps/
    desktop/                # Tauri 2 shell
    web/                    # SvelteKit
    bff/                    # Hono BFF
  packages/
    api-contracts/          # Zod schemas + TS types
    design-tokens/          # Tailwind preset (port of src/app/globals.css)
    electron-shared/        # IPC types (re-use from current electron/)
  electron/                 # KEEP, freeze after cutover
  desktop-electrobun/       # KEEP as fallback reference
  docs/sessions/20260705-svelte-hono-rewrite/
```

## Phases

- **Phase 0 (W1-W2):** Fork reconciliation. Merge upstream v3.8.44, reconcile 30+
  long-horizon branches via stacked PRs, cut `feat/svelte-hono-rewrite` cleanly.
- **Phase 1 (W3-W6):** Vertical slice. Scaffold apps + packages, Tauri 2 shell
  with SvelteKit dev server, Hono BFF, 6 routes behind `?web=svelte` flag
  (`/login`, `/callback`, `/dashboard`, `/dashboard/providers`,
  `/dashboard/settings/general`, `/dashboard/health` (SSE), `/dashboard/usage`).
  Design-token preset. CI matrix (mac/win/linux).
- **Phase 2 (W7-W14):** Feature parity in 8 sub-phases (Foundations, Settings,
  Cost/Analytics, Tooling, Routers/Combos, Memory/Cache/Batch/Webhooks/Audit,
  i18n Paraglide, Hardening a11y/perf/observability).
- **Phase 3 (W15-W16):** Cutover. Flip `OMNI_WEB_STACK=svelte` default, 1-2w
  soak, remove Next from desktop builds, Tauri updater wired, Electron deprecated.

## Key Risks (top 5)

1. **Upstream merge debt** (2,585/15 gap): integration tests after each minor
2. **Multi-agent branch reconciliation**: stacked PRs for 30+ branches
3. **Cohabitation doubles QA**: per-route flag, not global; CI runs both
4. **Tauri 2 code signing/notarization**: spike W3, document pipeline
5. **Paraglide 42-locale migration**: tool-assisted per-locale W13

## Out of Scope

- Native iOS/Android (Tauri Mobile deferred to v4.2+)
- Rewriting the Next.js `/v1/*` router in Hono (ADR-016 follow-up)
- Public marketing sites
- CLI tools under `bin/`
- Cloud sync orchestration
- Replacing SQLite/DB layer
- CodeMirror 6 migration (Monaco kept)

## Documents in this session

| File | Purpose |
|---|---|
| 00_SESSION_OVERVIEW.md | this file |
| 01_RESEARCH_svelte_hono.md | Svelte 5 + SvelteKit 2 + Hono 4 stack baseline |
| 01_RESEARCH_native_shells.md | Tauri 2 vs Electrobun vs Electron head-to-head |
| 01_RESEARCH_dashboard_audit.md | 47 routes + 40 API groups + 15 IPC inventory |
| 02_SPECIFICATIONS.md | Architecture + repo layout + API contracts |
| 03_DAG_WBS.md | Phase 0-3 DAG + WBS + critical path |
| 04_IMPLEMENTATION_STRATEGY.md | Tauri/Electrobun gap analysis + rollout |
| 05_KNOWN_ISSUES.md | Per-component risks + workarounds |
| 06_TESTING_STRATEGY.md | Pyramid + CI matrix + acceptance flows |
