# Session 20260705-argismonitor-monorepo-bootstrap

**Date**: 2026-07-05
**Author**: argismonitor frontend lane
**Status**: In progress (bootstrap complete, parity tests + storage wiring pending)

## Goal

Stand up the argismonitor (formerly OmniRoute) v4 monorepo at
`/Users/kooshapari/CodeProjects/Phenotype/repos/omniroute-monorepo` and replace the
legacy Next.js + Electron stack with SvelteKit 2 + Svelte 5 runes + Hono 4 + Tauri 2.

## Stack

| Layer | Choice | ADR |
|---|---|---|
| Monorepo | pnpm 10 + Cargo workspace | 0001 |
| Web | SvelteKit 2 + Svelte 5 runes | 0002 |
| API | Hono 4 mounted via `hooks.server.ts` | 0003 |
| Native | Tauri 2 (macOS-first) | 0004 |
| Canonical types | Zod 4.4 in `packages/shared-types` | 0005 |
| BFF ↔ gateway | kbridge Unix-socket + MessagePack-RPC | 0006 |
| Toolchain | oxlint 1.72 + tsgo 7 + bun 1.3.10 | 0007 |
| i18n | Paraglide JS 2.20 | 0009 |

## Backend dependency

`/OmniRoute-pr232-policyfix-20260703/backend-rust` (7 crates, kbridge wired,
`/var/run/omniroute/gateway.sock`). Frontend talks to it via the omniroute-gateway
Rust crate or via the Hono `/api/kbridge` WS bridge.

## Progress

- [x] Root monorepo scaffold (package.json, Cargo.toml, pnpm-workspace.yaml, tsconfig.base.json, oxlint.json, AGENTS.md)
- [x] `packages/shared-types` — 16 Zod schemas + 3 test files
- [x] `packages/sdk-js` — Hono typed RPC + kbridge browser + SSE + errors
- [x] `apps/web` — SvelteKit + Hono app + 8 route pages + 5 Hono /api/* handlers + 4 middleware
- [x] `apps/desktop` — Tauri 2 shell + 4 commands + tray + menu + 5 plugin registrations
- [x] `crates/gateway` — KbridgeClient + GatewayProcess + RingBuffer + shutdown + 3 tests
- [x] `tools/scripts` — CLI dispatcher + 6 sub-scripts + bin/argis
- [x] `.github/workflows` — ci.yml, release.yml, nightly.yml, dependabot.yml, codeql.yml
- [x] `docs/ADRS` — 10 ADRs (0001–0010)
- [x] DX — Makefile, Dockerfile, docker-compose.yml, .nvmrc, .tool-versions, .vscode, renovate.json, lefthook.yml

## Next slices (1-PR each)

1. Storage wiring — connect Hono routes to omniroute-storage crate (SQLite call_logs).
2. Codegen — `tools/scripts/src/codegen-app-type.ts` walks the real Hono app and emits `AppType` for sdk-js (drop the placeholder).
3. Parity CI gate — `tools/scripts/src/parity-check.ts` reads Rust JSON schemas from `cargo run --bin export-schema` and diffs against Zod.
4. Live integration — `pnpm dev:gateway && pnpm dev:web`, then click through dashboard, providers, combos.
5. Tauri build — `pnpm --filter desktop tauri build` on macOS arm64 + x86_64.

## Risks

- Paragon-kbridge wire format drift — mitigated by parity CI gate.
- Svelte 5 vs SvelteKit 2 plugin compatibility — pin versions in `package.json`.
- Tauri 2 webview on Linux requires WebKitGTK — out of scope for v4.0 macOS GA.
