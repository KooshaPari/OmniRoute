# 01_RESEARCH

**References**

- Parent fork session: `/OmniRoute-pr232-policyfix-20260703/docs/sessions/20260705-omniroute-rust-rewrite/06_FINAL_AUDIT_AND_DECISIONS.md`
  → Rust workspace compiles (6/6 tests), FFI tier green (5/5), companion workspace (3/3).
  → Language decision: Rust primary, Go runner-up (Bifrost). Zig/Mojo deferred.
- TS prototype: `/OmniRoute-frontend-svelte-2026-07-05/apps/{bff,web,desktop}`
  → SvelteKit + Hono + kbridge client. We are absorbing this into the v4 monorepo.
- kbridge wire format: 4-byte BE length prefix + msgpack payload.
  → ops: ping, health, combo_resolve, usage_record.

**Stack rationale**

- Svelte 5 runes — finer-grained reactivity than Svelte 4 stores; smaller bundle; SvelteKit 2 + Tailwind v4 covers the dashboard.
- Tauri 2 — half the bundle of Electron, mature plugin ecosystem, single binary.
- Hono 4 — typed RPC via `hono/client` hc<AppType>; runs inside SvelteKit via `hooks.server.ts` `handle.fetch`.
- oxlint — 10x faster than ESLint; same coverage for our rule set.
- tsgo — native TS build for project refs; ~5x faster than tsc.
- Paraglide — compile-time i18n; ~5KB per locale vs ~80KB runtime.

**Electrobun note**

Per ADR-0008: Electrobun (Bun + native macOS webview) is too immature for v4.0 GA. We
track it as `apps/desktop-mac-lite` deferred for v4.1.

**Alternatives explicitly rejected**

- Electron — rejected (bundle size, idle RAM).
- Flutter desktop — rejected (no native HTTP/streaming parity with the JS ecosystem; team lacks Dart expertise).
- Qt / Slint — rejected for primary shell (good for native widgets but not webview-driven dashboards); reserved for tray-only companions.
- Qt-likes (Tauri-like Rust alternatives) — there are none at Tauri 2's maturity.
