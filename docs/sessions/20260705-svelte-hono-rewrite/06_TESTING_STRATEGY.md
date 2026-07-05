# Testing Strategy

## Test Pyramid

```
                       /\
                      /  \
                     / E2E \          Playwright 1.61
                    /------\          (per route, both stacks)
                   /        \
                  / Integ.   \       Vitest 4.1 + MSW 2.14
                 /------------\      (BFF <-> Next.js, SvelteKit load)
                /              \
               /   Component    \   @testing-library/svelte
              /------------------\  (shadcn-svelte primitives)
             /                    \
            /       Unit           \ Vitest 4.1 (node + @vitest/browser)
           /________________________\ 70% coverage floor
```

## Unit (Vitest 4.1)

- 70% coverage floor per package (per ADR-0003)
- `apps/web` (Svelte stores, runes, helpers)
- `apps/bff` (Hono route handlers, middleware)
- `apps/desktop/src-tauri` (Rust unit tests for IPC commands)
- `packages/api-contracts` (Zod schemas - 100% required)
- `packages/design-tokens` (Tailwind preset - 100% required)

## Component (@testing-library/svelte)

- shadcn-svelte primitives (Button, Card, Input, Select, Dialog, Toast, Tabs)
- Domain components: ProviderCard, ComboEditor, UsageTable, HealthStream, ModelPicker
- @vitest/browser 4.1 (real browser env, JSDOM no longer sufficient)

## Integration (Vitest 4.1 + MSW 2.14)

- Hono BFF reverse-proxy to Next.js `/v1/*` loopback
- SvelteKit + Hono RPC client (typed) - roundtrip types
- Form flows (sveltekit-superforms + Zod)
- Auth: cookie + CSRF + session between Hono and SvelteKit
- SSE streams (Hono SSE -> EventSource mock)

## E2E (Playwright 1.61)

- Per migrated route, run against both Next (cohabitation phase) and SvelteKit
- Visual regression via Playwright's built-in screenshot diff
- mac/win/linux matrix
- Packaged Tauri app smoke (launch, navigate, exit cleanly)

## A11y (@axe-core/playwright)

- Every route in CI
- WCAG 2.2 AA target
- Color contrast, ARIA, keyboard nav

## Performance (Lighthouse CI + bundle budgets)

- Bundle: < 300KB gz per main route, < 100KB gz per shared chunk
- TTI: < 1.5s on M2 Air
- Lighthouse: > 90 on key routes
- Idle RAM: < 120MB in Tauri

## Smoke (packaged app)

Tauri 2 packaged builds run a smoke script:
1. Launch
2. Wait for ready
3. Navigate to 5 key routes
4. Verify SSE stream connects
5. Exit cleanly

## Type Safety

- `tsc --noEmit` strict in every package
- Zero `any` in `packages/api-contracts/`
- Hono RPC + SvelteKit client compile-time check
- oxlint 1.72 in CI

## CI Matrix

| OS | Bun | Node | Tauri 2 | Browser |
|---|---|---|---|---|
| macOS-14 (arm64) | 1.3.10 | 22.x | 2.x stable | WKWebView |
| macOS-13 (x86_64) | 1.3.10 | 22.x | 2.x stable | WKWebView |
| ubuntu-24.04 | 1.3.10 | 22.x | 2.x stable | WebKitGTK |
| windows-2022 | 1.3.10 | 22.x | 2.x stable | WebView2 |

## Test Commands

```bash
# per package
bun test                  # unit (Vitest node)
bun run test:browser      # component (@vitest/browser)
bun run test:integration  # integration (Vitest + MSW)
bun run test:e2e          # E2E (Playwright)
bun run test:a11y         # a11y (axe-core)
bun run typecheck         # tsc --noEmit
bun run lint              # oxlint
bun run format:check      # prettier

# root
bun run test              # all
bun run test:coverage     # with coverage gates
```

## Acceptance Test Scenarios

1. **Cold-start**: open packaged Tauri app, login, land on dashboard in < 3s
2. **Add provider**: add an Anthropic connection via OAuth, verify in providers list
3. **Create combo**: create a combo with fallback to a second model
4. **Stream chat**: stream a chat completion with SSE, verify tokens render in real time
5. **Compression studio**: open compression studio, run GCF vs TOON A/B test
6. **RTL**: switch UI language to Arabic, verify RTL layout
7. **Auto-update**: ship a new Tauri 2 build, verify the running app picks it up

## Coverage Thresholds (per package)

| Package | Lines | Branches | Functions |
|---|---|---|---|
| packages/api-contracts | 100% | 100% | 100% |
| packages/design-tokens | 100% | 100% | 100% |
| apps/bff | 85% | 80% | 85% |
| apps/web | 70% | 65% | 70% |
| apps/desktop/src-tauri | 70% | 65% | 70% |

## Test Data

- Factories via Fishery for domain models
- MSW handlers for open-sse executors (one per route)
- Fixtures: `tests/fixtures/providers.json` etc.
- Seed: `bun run db:seed:test`
