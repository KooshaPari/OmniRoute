# Known Issues

| Sev | Component | Issue | Workaround | Owner |
|---|---|---|---|---|
| P0 | Upstream merge | v3.8.39 -> v3.8.44, gap 2,585 ahead / 15 behind; breaking changes possible | One-pass integration test after each minor bump in Phase 0 | - |
| P0 | Multi-agent branches | 30+ long-horizon branches (L22, L25, T2/T4/T5/T7/T8, L5-114, L39) touch same files (pheno-otel, pheno-port-adapter) | Stacked PRs with explicit rebase order | - |
| P1 | Electron desktop | `electron/main.js` 34k LOC; security-only maintenance during rewrite | Freeze at Phase 3, delete at v4.2 | - |
| P1 | Electrobun spike | `desktop-electrobun/electrobun.config.ts` has "Copy this directory" comments - not yet customized | Keep as fallback reference; customize only if Tauri 2 hits a wall | - |
| P1 | Svelte 5 | Breaking-change risk between minor versions | Pin minor; Renovate; visual regression in CI | - |
| P1 | @xyflow/svelte | Younger than @xyflow/react, 1-week spike needed in Phase 1 | Fallback to hand-rolled d3 if blocker | - |
| P1 | Monaco in Svelte | No first-party Svelte bindings | Thin custom wrapper (50-80 LOC); pin monaco-editor minor | - |
| P1 | Paraglide 42-locale migration | next-intl 42 locales + RTL (ar/he) -> Paraglide JS | Tool-assisted per-locale in W13 | - |
| P1 | Cohabitation QA cost | Per-route flag doubles CI time | Per-route flag, not global; CI runs both | - |
| P2 | Bun runtime | Quirks vs Node | Test in CI with the same Bun version that ships | - |
| P0 | Tauri 2 code signing | macOS notarization + Windows signing not yet configured | Spike in W3; sign-without for v4.0-beta, hard-required for v4.0-GA | - |
| P2 | Tauri 2 Linux webview | GTK WebKitGTK can differ from WKWebView | Smoke test on Ubuntu-24.04 in CI | - |
| P0 | SvelteKit + Hono auth boundary | Cookies, CSRF, session sharing between Hono BFF and SvelteKit needs explicit contract | Define in `packages/api-contracts/auth.ts` in W3 | - |
| P1 | Mobile PWA limits | No native keychain, no push notifications, no background sync in PWA mode | Document explicitly; native mobile out of scope | - |
| P0 | /v1/* compatibility | 160+ provider fleet relies on OpenAI-compatible API | Reverse-proxy via Hono BFF; full integration test on every PR | - |
| P2 | Monaco bundle size | ~3MB gz - large initial bundle | Code-split; load only on /playground | - |
| P2 | TanStack svelte-query SSE | No streaming-query primitive yet | Use EventSource + manual store; reassess when Svelte Query adds it | - |
| P1 | Bitrot risk during rewrite | Existing branches keep moving | Pin L5-122 to v3.8.45+ before starting Phase 1 | - |
| P2 | OpenAPI 3.1 drift | Backend rewrite may shift OpenAPI shape | `progenitor` codegen pinned to commit; regen on every backend release | - |
| P1 | Single-instance on macOS | Tauri 2 single-instance plugin needs proper test | Smoke test: launch twice, second is focused not new | - |
