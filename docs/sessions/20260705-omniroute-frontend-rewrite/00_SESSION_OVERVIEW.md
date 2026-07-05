# OmniRoute Frontend + Native Rewrite Session

**Date:** 2026-07-05 · **Lane:** Frontend + Native (parallel to the backend Rust rewrite)
**Repo:** KooshaPari/OmniRoute fork at `/Users/kooshapari/CodeProjects/Phenotype/repos/OmniRoute-pr232-policyfix-20260703`
**Target version:** v4.0 (parallel to backend rewrite v4.0)

## Goal

Decide the optimal target stack + native shell for a clean, production-grade rewrite of OmniRoute's frontend (50+ dashboard subroutes) and native desktop (Electron 42 today). The backend rewrite in Rust is owned by a parallel lane; this lane owns the **web + desktop** side and integrates with that backend.

## Why now

- The existing Next.js 15 dashboard is 404K LoC, has a 4,629-line `combos/page.tsx` page, and ships ~600KB gz initial JS.
- The Electron 42 desktop is ~200MB installer, ~300MB idle RAM, 2-4s cold start; we can do far better.
- The backend rewrite gives us a single Rust binary on `:20128` with OpenAPI 3.1 — a perfect time to rewrite the frontend in a leaner, type-safe stack.
- The user explicitly said: "you will own native too ... tauri or electrobun or qt-like etc or slint .... options that are better than electron, dotn forget flutter\other opts"

## Scope of session

1. Deep audit of the existing Next.js dashboard surface (47 subroutes, 40 API groups, 15 Electron IPC channels).
2. Research: Svelte 5 + SvelteKit 2 + Hono 4 stack baseline (verified 2026 versions).
3. Research: native desktop options 2026 (Tauri 2, Electrobun, Slint, Flutter, Wails, others) with weighted decision matrix.
4. Three-process integration architecture (Tauri shell + SvelteKit + Rust gateway) with full IPC catalog.
5. Decision-complete implementation plan with phase breakdown, test plan, acceptance criteria, rollout.

## Out of scope

- The backend Rust rewrite (parallel lane).
- Provider executor porting (parallel lane).
- Public OpenAI API surface changes (must stay backward-compatible).

## Documents in this session

| File | Purpose |
|---|---|
| 00_SESSION_OVERVIEW.md | this file |
| 06_SVELTE_HONO_RESEARCH.md | stack baseline research, verified 2026 versions |
| 07_NATIVE_DESKTOP_RESEARCH.md | native desktop comparison + Tauri 2 design |
| 08_DASHBOARD_SURFACE_AUDIT.md | full route inventory + complexity hotspots |
| 09_INTEGRATION_ARCHITECTURE.md | 3-process model + 35 Tauri commands catalog |
| 10_FRONTEND_REWRITE_PLAN.md | decision-complete implementation plan |
| 11_COCKPIT.md | status cockpit |

## Top 10 decisions (require sponsor sign-off)

| # | Decision | Recommendation |
|---|---|---|
| D1 | Stack | Svelte 5 + SvelteKit 2 + Hono 4 + bits-ui + shadcn-svelte + Paraglide + Arctic + CodeMirror 6 + Tauri 2 |
| D2 | Server runtime | Bun 1.3.10 dev + Hono; Node 22 LTS prod (adapter-node) |
| D3 | Monorepo location | `omniroute-monorepo/` sibling of existing fork |
| D4 | SvelteKit adapter | `@sveltejs/adapter-node`; run with `bun --bun` if Bun-deploy |
| D5 | Desktop shell | Tauri 2 canonical; Electron 42 opt-in fallback for v4.0-beta/v4.1 |
| D6 | i18n | Paraglide JS 2.20; port next-intl messages 1:1 |
| D7 | Editor | CodeMirror 6 in playground (saves ~3MB) |
| D8 | Migration | SvelteKit at `/v4` route, Next.js stays at `/` for v4.0-beta; flip in v4.0-GA |
| D9 | Schema | Zod 4.4 canonical; generated into Rust via progenitor |
| D10 | Test | Vitest 4.1 (node + browser) + Playwright 1.61 |

Defaults if not answered: see `10_FRONTEND_REWRITE_PLAN.md` §10.
