# Frontend Stack — Svelte 5 + Hono + SvelteKit 2 Research

**Date:** 2026-07-05 · **Audience:** Implementer · **Source policy:** 2026 stable only

## 1. Executive summary

For an enterprise-grade rewrite of a 50+ route AI router dashboard, the recommended stack is:

- **Svelte 5 (runes mode)** + **SvelteKit 2** (Svelte 5.56+, SvelteKit 2.69+) with **adapter-node** as the canonical SSR adapter and an optional `@sveltejs/adapter-bun` for the Bun-deployed mode.
- **Hono 4.12+** mounted in SvelteKit's `hooks.server.ts` as the API/SSR server layer, with `hc` as the type-safe RPC client for browser->SSR->gateway calls.
- **Vite 8** (oxc-powered) + **oxlint 1.72** + **tsgo 7** (TypeScript native preview) for the toolchain. **No ESLint.**
- **Tailwind 4.3** + **bits-ui 2.18** + **shadcn-svelte 1.3** (CLI-driven) for primitives.
- **@tanstack/svelte-query 6.1** for server state; **Svelte 5 runes** for local state.
- **Zod 4.4** for schema validation (reused by both client and server).
- **@inlang/paraglide-js 2.20** for compiler-first i18n (replaces next-intl).
- **Arctic 3.7** + hand-rolled session cookies (Lucia is archived as a library; only its patterns remain). `@auth/sveltekit 1.11` is an alternative if we want zero boilerplate but less control over virtual-key scopes.
- **@xyflow/svelte 1.6** for graph UIs, **svelte-dnd-action 0.9.7** for DnD, **CodeMirror 6** (via `@codemirror/state` 6.7) for the editor. **Drop Monaco** — CodeMirror 6 is ~150KB gz vs Monaco's ~3MB; bundles 20× smaller, SSR-friendly, and Svelte 5 ports cleanly via `svelte-codemirror-editor`.
- **Vitest 4.1** (browser mode via `@vitest/browser` 4.1) + **Playwright 1.61** + **MSW 2.14** for tests.
- **Bun 1.3.10** is the dev runtime (already pinned in the existing `devDependencies`); Node 22 LTS is the production fallback for the SvelteKit + Hono combo.

The 4 highest-ROI library choices to flag for the implementer: **bits-ui (not melt-ui, not radix-svelte)** for primitives; **Arctic + hand-rolled sessions (not Lucia, not Auth.js)** for auth; **svelte-dnd-action (not dnd-kit-svelte)** for DnD; **CodeMirror 6 (not Monaco)** for the editor.

## 2. Tooling matrix with verified versions (2026-07-05)

| Layer | Package | Version (npm) | Status | Why |
|---|---|---|---|---|
| Framework | svelte | 5.56.4 | stable, no 6.x yet | runes mode, no legacy compat layers needed |
| Framework | @sveltejs/kit | 2.69.1 | stable | file-based routing, SSR/CSR/hybrid, hooks, streaming |
| Adapter | @sveltejs/adapter-node | 5.5.7 | stable | Node 22 LTS deploy |
| Adapter | @sveltejs/adapter-bun | not on npm | (workaround below) | if we ship Bun-deploy, use `bun --bun` runner on adapter-node output |
| Compiler | @sveltejs/vite-plugin-svelte | 7.1.2 | stable | Svelte 5 support |
| Bundler | vite | 8.1.3 | stable | oxc-powered by default |
| Typecheck | svelte-check | 4.7.1 | stable | Svelte-aware |
| Typecheck | @typescript/native-preview | 7.0.0-dev.20260704.1 | preview | tsgo for fast CI |
| Lint | oxlint | 1.72.0 | stable | **NO ESLint** (memory: user preference) |
| Style | tailwindcss | 4.3.2 | stable | v4 oxide engine, CSS-first config |
| Style | @tailwindcss/vite | 4.3.2 | stable | vite plugin |
| Primitives | bits-ui | 2.18.1 | stable | headless, Svelte 5 native, owned by the bits-ui org |
| CLI | shadcn-svelte | 1.3.0 | stable | copies `bits-ui`-based components into repo |
| Server | hono | 4.12.27 | stable | ultra-light, type-safe, runs on Bun/Node/Deno/Workers |
| Server RPC | @hono/client | bundled with hono | stable | `hc<T>` typed client |
| Schema | zod | 4.4.3 | stable | canonical schema language for both Hono (`@hono/zod-validator`) and SvelteKit (`sveltekit-superforms`) |
| i18n | @inlang/paraglide-js | 2.20.2 | stable | tree-shaken, SSR-safe, compiler-first |
| Auth | arctic | 3.7.0 | stable | OAuth providers, typed; Lucia patterns but no library lock-in |
| State (server) | @tanstack/svelte-query | 6.1.36 | stable | replaces React Query for Svelte |
| DnD | svelte-dnd-action | 0.9.70 | stable | dnd-kit semantics in Svelte 5 |
| Graph | @xyflow/svelte | 1.6.1 | stable | React Flow port; needed for combo/relay topology views |
| Editor | @codemirror/state | 6.7.0 | stable | modular CodeMirror 6 |
| Test (unit) | vitest | 4.1.9 | stable | |
| Test (browser) | @vitest/browser | 4.1.9 | stable | real-browser component tests |
| Test (e2e) | @playwright/test | 1.61.1 | stable | |
| Mock | msw | 2.14.6 | stable | browser + node handlers |
| Icons | @lucide/svelte | (latest) | stable | replaces lucide-react |
| Validation (alt) | valibot | 1.4.2 | stable | smaller bundle if we ever want it; default remains zod |
| Validation (alt) | arktype | 2.2.2 | stable | TS-first ergonomics; default remains zod |
| Logging | pino | 10.3.1 (already) | stable | same as backend |
| Tracing | @opentelemetry/api | 1.9.0 (already) | stable | |

**Note on `adapter-bun`:** not currently published on npm. The recommended workaround is to build with `adapter-node` and run with `bun --bun ./build/index.js` — Bun executes Node-target bundles natively. If we later need a true Bun-first adapter, vendoring one is ~80 lines (mirror of `adapter-node` with `Bun.serve`).

## 3. Rendering model per route category

| Route category | Mode | Rationale |
|---|---|---|
| Landing, login, marketing, docs | **SSR** with cached HTML | SEO + cold-load win |
| Dashboard home (`/home`) | **Streaming SSR** via SvelteKit `resolve().then(...)` | Above-the-fold renders fast, widgets stream in |
| Provider manager (`/providers`) | **CSR with SSR shell** | heavy DnD, virtualized list, mostly user-specific |
| API manager (`/api-manager`) | **CSR with SSR shell** | DnD + virtualized; user-specific |
| Combos (`/combos`) | **CSR with SSR shell** | heavy DnD + graph; user-specific |
| Playground (`/playground`) | **CSR** | interactive editor + streaming; user-specific |
| Analytics (`/analytics`) | **Streaming SSR** with `defer` + islands | chart data streams in after first paint |
| Logs (`/logs`) | **CSR** with SSE via `EventSource` | real-time |
| Costs (`/costs`) | **CSR with SSR shell** + islands for charts | mostly user-specific |
| MCP / A2A / Webhooks | **CSR with SSR shell** | real-time + DnD |
| Settings, profile, keys | **CSR with SSR shell** | forms; use superforms-svelte |
| Auth (login, callback, oauth) | **SSR** | security-sensitive, no client logic |
| Error / offline / 4xx / 5xx | **SSR** | static |

**Streaming SSR pattern (SvelteKit 2):**

```ts
// apps/web/src/routes/+page.server.ts
export const load = async ({ fetch }) => {
  return {
    metrics: fetch('/api/metrics').then(r => r.json()), // streamed
    usage: fetch('/api/usage').then(r => r.json()),     // streamed
  };
};
```

```svelte
<!-- apps/web/src/routes/+page.svelte -->
<script lang="ts">
  let { data } = $props();
</script>
<h1>Welcome back</h1>
{#await data.metrics}
  <Skeleton />
{:then m}
  <MetricsCard {m} />
{/await}
```

## 4. Data flow & state architecture

- **Server state** — `@tanstack/svelte-query` per resource. Custom `createQuery` factories (`createProviderListQuery`, `createComboListQuery`, etc.) in `apps/web/src/lib/queries/`. Keys: `['provider', 'list', filters]`, `['combo', id]`, `['analytics', range]`.
- **Local state** — Svelte 5 runes: `$state`, `$derived`, `$effect`. NO `writable()` for component state. Cross-page state: small `Map` of `$state` objects in a `*.svelte.ts` module.
- **Form state** — `sveltekit-superforms` (latest 2.x) with zod schema; the same zod schema validates on the server in Hono. Avoid double validation.
- **Real-time SSE** — `apps/web/src/lib/streams/sse.svelte.ts` exposes a typed `createSSE<T>(url, schema)` that opens an `EventSource`, parses with the zod schema, exposes `$state` of the latest message, handles reconnect with exponential backoff (200ms → 1s → 5s, cap), and multiplexes by topic.
- **Optimistic mutations** — `queryClient.cancelQueries` + `setQueryData` (old value), then mutate, then `invalidateQueries` on settle. For DnD reorders, use a local `$state` mirror and reconcile on settle.
- **Schema validation** — **Zod 4.4.3** as the canonical schema language. Define once in `packages/shared-types/zod/`, import from both client and server. Reasons: same `z.infer` gives both client and server types; `@hono/zod-validator` is the smallest server-validator adapter; sveltekit-superforms integrates with zod natively; React Flow/xyflow accepts zod-shaped data.
- **i18n** — **Paraglide JS 2.20** with `compile`-then-`runtime` model. Tree-shaken messages: only the locales a route uses end up in the bundle. SSR-safe: messages resolve on the server, hydrate on the client, no flicker. Replaces next-intl cleanly.

## 5. Auth & session

**Recommendation: Arctic 3.7 + hand-rolled session cookies.** Lucia v3.2.2 is the last published release; the project was archived as a library in 2024 and now only ships "patterns" (i.e. a docs site). Re-implementing the session-table pattern is ~120 lines and gives us full control over virtual-key scopes.

```ts
// apps/web/src/lib/server/auth/session.ts
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from '@oslojs/encoding';

export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

export async function createSession(token: string, userId: string) {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session = { id: sessionId, userId, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) };
  await db.insert(sessions).values(session);
  return session;
}

export async function validateSessionToken(token: string) {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const row = await db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!row) return { session: null, user: null };
  if (Date.now() >= row.expiresAt.getTime()) { await db.delete(sessions).where(eq(sessions.id, sessionId)); return { session: null, user: null }; }
  if (Date.now() >= row.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15) {
    row.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await db.update(sessions).set({ expiresAt: row.expiresAt }).where(eq(sessions.id, sessionId));
  }
  const user = await db.select().from(users).where(eq(users.id, row.userId)).get();
  return { session: row, user };
}
```

```ts
// apps/web/src/hooks.server.ts
import { validateSessionToken, setSessionTokenCookie, deleteSessionTokenCookie } from '$lib/server/auth/session';
import { sequence } from '@sveltejs/kit/hooks';
import { createHonoApp } from '$lib/server/hono/app';

const honoHandler: Handle = async ({ event, resolve }) => {
  const app = createHonoApp(event);
  return app.fetch(event.request, { event });
};

const authHandle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get('session');
  if (!token) { event.locals.user = null; event.locals.session = null; return resolve(event); }
  const { session, user } = await validateSessionToken(token);
  event.locals.user = user; event.locals.session = session;
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%session.user.name%', user?.name ?? '')
  });
};

const cookieHandle: Handle = async ({ event, resolve }) => {
  if (event.locals.session) {
    setSessionTokenCookie(event, event.locals.session.id, event.locals.session.expiresAt);
  }
  return resolve(event);
};

export const handle = sequence(cookieHandle, authHandle, honoHandler);
```

**Role gate:**

```ts
// apps/web/src/lib/server/auth/role.ts
export function requireRole(event: RequestEvent, role: 'admin' | 'user' | 'readonly') {
  if (!event.locals.user) throw redirect(302, '/login');
  if (role === 'admin' && !event.locals.user.isAdmin) throw error(403, 'admin required');
  return event.locals.user;
}
```

**Desktop handoff** (Tauri context — see `09_INTEGRATION_ARCHITECTURE.md`):

1. Webview calls `await invoke('device_id')` to get a device fingerprint.
2. Webview shows a "Pair device" page; user logs in via the standard form; on success, webview exchanges a one-time `pair_code` for a long-lived `device_certificate` stored in the OS keychain via the Tauri `stronghold` plugin.
3. From then on, webview sends `Authorization: Bearer <device_certificate>` to the gateway directly; the webview never sees the user's password.

## 6. Project layout (~350-line file cap)

```
omniroute-monorepo/                       # new monorepo (sibling of the Rust crate)
  pnpm-workspace.yaml
  package.json
  tsconfig.base.json                      # strict, project refs
  oxlint.json
  .size-limit.json
  apps/
    web/                                  # SvelteKit 2 + Hono + Svelte 5
      package.json
      svelte.config.js
      vite.config.ts
      src/
        app.html
        app.css                           # tailwind v4 + tokens
        app.d.ts                          # locals: user, session
        hooks.server.ts                   # sequence(cookie, auth, hono)
        lib/
          server/
            hono/
              app.ts                      # createHonoApp
              routes/                     # mirrors /api/* shape
                providers.ts
                combos.ts
                analytics.ts
                keys.ts
                ...
            auth/
              session.ts
              arctic.ts                   # OAuth provider factories
              role.ts
            db/
              client.ts                   # libsql/better-sqlite3
              schema.ts                   # drizzle schema (users, sessions, ...)
              migrations/
            tracing.ts                    # OTel SDK init
            env.ts                        # zod-validated env
          components/
            ui/                           # shadcn-svelte output (button, dialog, ...)
            provider/                     # domain: provider list, card, editor
            combo/                        # domain: combo DnD board, step card
            api-key/                      # domain: virtual key card, scope editor
            analytics/                    # domain: chart wrappers
            layout/                       # shell, sidebar, topbar, command palette
            auth/                         # login form, oauth buttons
            system/                       # error, empty, loading, toast
          queries/                        # @tanstack/svelte-query factories
            providers.ts
            combos.ts
            analytics.ts
            ...
          streams/
            sse.svelte.ts
            sse-types.ts                  # zod schemas for each SSE topic
          stores/                         # cross-page runes state
            ui.svelte.ts                  # sidebar open, theme, ...
            notification.svelte.ts
          i18n/                           # paraglide output
          styles/
            tokens.css                    # CSS vars: --color-*, --space-*
            tailwind.css                  # @import "tailwindcss";
          utils/
            format.ts
            mask.ts
            invariant.ts
          schemas/                        # shared zod (re-exports from packages/shared)
        routes/
          +layout.svelte                  # shell
          +layout.ts                      # ssr + prerender = false
          +layout.server.ts               # locals.user hydrated
          +page.svelte                    # redirect to /home
          home/
            +page.svelte
            +page.ts
          providers/
            +page.svelte                  # provider manager
            +page.ts                      # CSR-only (export const ssr = false)
            [id]/
              +page.svelte                # provider detail
              +page.ts
          ...                              # 50+ more, mirror the audit
    desktop/                              # Tauri 2 shell (see 09_INTEGRATION_ARCHITECTURE.md)
      package.json
      src-tauri/
        Cargo.toml
        tauri.conf.json
        capabilities/
          default.toml
        icons/
      src/                                # TS host (vite, no UI logic; webview is the UI)
        main.ts
        dev.ts
  packages/
    shared-types/                         # zod schemas shared by web + desktop + gateway contract
      package.json
      src/
        providers.ts
        combos.ts
        keys.ts
        analytics.ts
        ...
    ui-tokens/                            # design tokens package (optional, drop if web-only)
  tools/
    scripts/
      sync-env.mjs                        # .env -> zod-validated env
      gen-openapi-client.mjs              # from gateway's openapi.yaml -> typed hono client
      check-routes-parity.mjs             # asserts old Next.js route -> new SvelteKit route
```

## 7. Performance budgets (enforced in CI)

| Metric | Budget | Checked by |
|---|---|---|
| LCP on dashboard home (4G) | < 1.5s | Lighthouse CI in GitHub Actions |
| TTI on dashboard home | < 2.0s | Lighthouse CI |
| Initial JS shell (gzipped) | < 120 KB | `size-limit` on `/_app/immutable/entry/*.js` |
| Per-route chunk (gzipped) | < 50 KB | `size-limit` on lazy chunks |
| SSE reconnect | < 200 ms | unit test on `createSSE` backoff |
| Server p99 SSR | < 80 ms | k6 against staging |
| Lint clean | 0 oxlint errors | CI step `pnpm lint` |
| Type clean | 0 tsgo errors | CI step `pnpm typecheck` |
| File size | < 350 lines target, < 500 hard | `scripts/check/check-file-size.mjs` (knip + custom) |

## 8. Migration from Next.js 15 to SvelteKit 2

**Phase 1 (v4.0-alpha):** Add `apps/web` (SvelteKit) at port `:3000`. Add reverse-proxy from old Next.js `/v4/*` to SvelteKit. Old Next.js continues serving everything else. Build the gateway-shared zod schemas in `packages/shared-types/` first; port 1 page end-to-end as a template (`/providers` — has DnD, list, modals, charts).

**Phase 2 (v4.0-beta):** Flip DNS: SvelteKit at port 3000, Next.js legacy served at `:3000/_next/*` for browser-history back-compat. Add per-page redirect rules in `apps/web/src/routes/(redirects)/+page.server.ts` for any route not yet ported.

**Phase 3 (v4.0-GA):** Next.js deleted. Single SvelteKit app.

**URL parity table (representative):**

| Next.js route | SvelteKit route | Notes |
|---|---|---|
| `/(dashboard)/home` | `/home` | streaming SSR |
| `/(dashboard)/providers` | `/providers` | CSR, DnD |
| `/(dashboard)/providers/[id]` | `/providers/[id]` | |
| `/(dashboard)/combos` | `/combos` | heavy DnD + graph |
| `/(dashboard)/combos/[id]/edit` | `/combos/[id]/edit` | |
| `/(dashboard)/playground` | `/playground` | CodeMirror 6 + SSE |
| `/(dashboard)/analytics` | `/analytics` | streaming SSR + islands |
| `/(dashboard)/keys` | `/keys` | virtual keys |
| `/(dashboard)/api-manager` | `/api-manager` | |
| `/(dashboard)/api-manager/[id]` | `/api-manager/[id]` | |
| `/(dashboard)/logs` | `/logs` | SSE |
| `/(dashboard)/costs` | `/costs` | |
| `/(dashboard)/mcp` | `/mcp` | |
| `/(dashboard)/a2a` | `/a2a` | |
| `/(dashboard)/audit` | `/audit` | |
| `/(dashboard)/settings` | `/settings` | |
| `/(dashboard)/profile` | `/profile` | |
| `/login` | `/login` | |
| `/callback/[provider]` | `/callback/[provider]` | |
| `/api/v1/*` (the OpenAI surface) | stays on the gateway | no SvelteKit layer |

**Component migration:** all `*.tsx` -> `*.svelte` (5) with runes. NO `svelte-jsx` shim — direct port. Heavy components split into `*.svelte` (template) + `*.svelte.ts` (logic) when crossing 200 lines.

## 9. Risks & open decisions

1. **`@sveltejs/adapter-bun` not on npm.** Workaround: build with adapter-node, run with `bun --bun`. Confirm with sponsor — OK to ship that way? (default yes)
2. **bits-ui vs shadcn-svelte scope.** bits-ui is the primitive; shadcn-svelte is the CLI that copies bits-ui-based components into the repo. Use shadcn-svelte CLI to install; own the resulting files (we will customize heavily). Default: shadcn-svelte.
3. **xyflow/svelte maturity.** `@xyflow/svelte 1.6` is younger than the React port. If we hit a missing feature, fall back to rendering a static SVG graph in Svelte 5 (we have the data, the visual is the only question). Default: try xyflow/svelte first.
4. **CodeMirror 6 vs Monaco in playground.** Monaco is heavier but more familiar to users editing TS/JSON. If user feedback says Monaco is required, keep Monaco via `@svelte-put/monaco` (a Svelte-MVVM adapter) at the cost of ~3MB initial. Default: CodeMirror 6.
5. **Lucia deprecation.** Re-implementing the session table adds ~2 days. Worth it for control. Alternative: use `@auth/sveltekit` and lose virtual-key scope granularity. Default: Arctic + hand-rolled.
6. **Realtime via SSE vs WS.** Gateway exposes both. Webview uses SSE for everything except binary/long-poll cases. Default: SSE-first, WS-fallback.
7. **Bundle analyzer.** Use `rollup-plugin-visualizer` for the SvelteKit build; surface in CI as an artifact. Default: yes.

## 10. References (verified 2026-07-05)

- Svelte 5 docs: https://svelte.dev/docs/svelte/overview
- SvelteKit 2 docs: https://svelte.dev/docs/kit/introduction
- Hono docs: https://hono.dev/docs/
- Tauri 2 docs: https://v2.tauri.app/start/
- Bits UI: https://www.bits-ui.com/docs
- shadcn-svelte: https://www.shadcn-svelte.com/docs
- Paraglide JS: https://inlang.com/m/gerre34r/library-inlang-paraglideJs
- Arctic: https://arctic.js.org (verified 3.7.0)
- Lucia status (archived): https://lucia-auth.com (last release 3.2.2, 2024-03)
- @xyflow/svelte: https://svelteflow.dev
- svelte-dnd-action: https://github.com/isaacHagoel/svelte-dnd-action
- Zod 4: https://zod.dev
- oxlint: https://oxc.rs/docs/guide/usage.html
- Tailwind 4: https://tailwindcss.com/docs
- SvelteKit-superforms: https://superforms.rocks
- @tanstack/svelte-query: https://tanstack.com/query/latest/docs/framework/svelte/overview
- Vitest browser: https://vitest.dev/guide/browser/
- MSW: https://mswjs.io/docs
