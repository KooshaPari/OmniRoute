# OmniRoute Backend Rewrite — Dependency & Risk Analysis (2026)

## Executive summary

The OmniRoute fork is a 476 K LoC TypeScript monorepo with 74 prod deps + 44 dev deps, 80 provider executors, 119 SQL migrations, 152 HTTP routes, 1 MCP server, 1 MITM proxy, 1 SSE streaming core, 1 CLI, and 4 SDK packages. The backend scope to rewrite is ~408 K LoC. The dominant cost is the 80 executors (39.6 K LoC) and 119 SQL migrations; the smallest cost is the 4.9 K LoC `src/domain/` and the 3 K LoC `src/server/` layers.

## 1. Dependency inventory (74 prod + 44 dev)

| Category | Dep | Version | Target-language equivalent | Migration cost |
|----------|-----|---------|----------------------------|----------------|
| HTTP server | `next` | 16.2.6 | `axum` 0.8 (Rust) or `chi` 5 (Go) | High (entire framework) |
| HTTP server | `express` | 5.2.1 | fold into axum | Low |
| HTTP middleware | `http-proxy-middleware` | 4.0 | custom axum middleware | Low |
| HTTP client | `axios` | 1.16.1 | `reqwest` (Rust) / `net/http` (Go) | Low |
| HTTP client | `undici` | 8.3 | (reqwest uses native) | Low |
| HTTP client | `https-proxy-agent` | 9.0 | `reqwest` proxy feature | Low |
| HTTP client | `fetch-socks` | 1.3 | `tokio-socks` (Rust) | Low |
| WebSocket | `ws` | 8.18 | `tokio-tungstenite` (Rust) | Low |
| SOCKS | `socks` | 2.8 | `tokio-socks` (Rust) | Low |
| DB | `sql.js` | 1.14.1 | `rusqlite` (Rust) / `mattn/go-sqlite3` (Go) | Medium (drop WASM) |
| DB | `sqlite-vec` | 0.1.9 | `sqlite-vec` C (linked into rusqlite) | Low |
| DB (optional) | `ioredis` | 5.10.1 | `redis-rs` (Rust) / `go-redis` (Go) | Low |
| DB | `lowdb` | 7.0 | drop (was for tiny JSON cache) | Low |
| Auth | `jose` | 6.2.3 | `jsonwebtoken` (Rust) / `golang-jwt` (Go) | Low |
| Auth | `bcryptjs` | 3.0.3 | `argon2` (Rust) / `bcrypt` (Go) | Low |
| Crypto/cert | `selfsigned` | 5.5 | `rcgen` (Rust) / `crypto/x509` (Go) | Medium (custom CA + install) |
| Validation | `zod` | 4.4.3 | `validator` (Rust) / `ozzo-validation` (Go) | Low |
| Validation | `parse5` | 8.0.1 | drop (HTML sanitizer used by some routes) | Low |
| Validation | `dompurify` | 3.4.11 | `ammonia` (Rust) / `bluemonday` (Go) | Low |
| Logging | `pino` | 10.3.1 | `tracing` (Rust) / `zap` (Go) | Low |
| Logging | `pino-pretty` | 13.1.3 | `tracing-subscriber` (Rust) | Low |
| CLI | `commander` | 15.0.0 | `clap` (Rust) / `cobra` (Go) | Low |
| CLI TUI | `ink` | 7.0.3 | `ratatui` (Rust) / `bubbletea` (Go) | Medium |
| CLI spinner | `ora` | 9.4.1 | `indicatif` (Rust) | Low |
| CLI update | `update-notifier` | 7.3.1 | drop or reimplement tiny | Low |
| MCP | `@modelcontextprotocol/sdk` | 1.29.0 | `rmcp` (Rust) / `mcp-go` (Go) | Low |
| Tunnel | `@ngrok/ngrok` | 1.7.0 | use ngrok CLI sidecar (HTTP API) | Low |
| Build | `tsx` | 4.22 | `cargo` (Rust) / `go` (Go) | Low |
| Telemetry | `@opentelemetry/api` | 1.9 | `opentelemetry` (Rust) / `go.opentelemetry.io` (Go) | Low |
| Misc | `bottleneck` | 2.19.5 | `governor` (Rust) / `x/time/rate` (Go) | Low |
| Misc | `xxhash-wasm` | 1.1 | `xxhash-rust` / `twox-hash` (Rust) | Low |
| Misc | `fflate` | 0.8 | `flate2` (Rust) | Low |
| Misc | `uuid` | 14.0 | `uuid` (Rust) | Low |
| Misc | `csv-stringify` | 6.7 | `csv` (Rust) | Low |
| Misc | `js-yaml` | 5.0 | `serde_yaml` (Rust) | Low |
| Misc | `jsonc-parser` | 3.3 | `jsonc-parser` (Rust) | Low |
| Misc | `safe-regex` | 2.1 | drop (use `regex` crate, no eval) | Low |
| Misc | `marked`, `marked-terminal` | 18.0, 7.3 | `pulldown-cmark` (Rust) / `goldmark` (Go) | Low |
| Frontend-only | `react`, `react-dom` | 19.2 | KEEP (frontend out of scope) | n/a |
| Frontend-only | `tailwind-merge`, `clsx` | 3.6, 2.1 | KEEP (frontend out of scope) | n/a |
| Frontend-only | `next-themes`, `next-intl` | 0.4, 4.12 | KEEP (frontend out of scope) | n/a |
| Frontend-only | `monaco-editor`, `@monaco-editor/react` | 0.55, 4.7 | KEEP (frontend out of scope) | n/a |
| Frontend-only | `@xyflow/react`, `recharts`, `lucide-react` | 12.11, 3.8, 1.21 | KEEP (frontend out of scope) | n/a |
| Frontend-only | `ink` (CLI TUI) | 7.0.3 | REPLACE (out of scope) | Medium |
| Build-only | `playwright` | 1.61.1 | KEEP for E2E tests (or drop) | Low |

## 2. Single points of failure (top 10)

| File | LoC | Concern | Mitigation |
|------|-----|---------|-----------|
| `open-sse/handlers/chatCore.ts` | 4,308 | Kitchen-sink chat orchestration | Split into chat_router, chat_picker, chat_transformer, chat_writer, each < 350 lines |
| `src/lib/providers/validation.ts` | 3,908 | Validation of all 160+ providers | Split per provider group; use a trait + data-driven registry |
| `open-sse/services/combo.ts` | 3,386 | Multi-provider combo logic | Split into combo_resolver, combo_executor, combo_metrics |
| `open-sse/executors/chatgpt-web.ts` | 3,205 | Browser-automation ChatGPT | Wrap as a `WebExecutor` trait; isolate browser sidecar |
| `open-sse/handlers/imageGeneration.ts` | 2,855 | Image gen pipeline | Split per provider; one trait per output format |
| `open-sse/utils/stream.ts` | 2,726 | SSE stream utils | Split into sse_reader, sse_writer, sse_merger, sse_filter |
| `src/shared/validation/schemas.ts` | 2,521 | Zod schemas for all 152 routes | Auto-generate from OpenAPI |
| `src/sse/services/auth.ts` | 2,406 | SSE auth | Split into auth_jwt, auth_vkey, auth_internal |
| `open-sse/services/tokenRefresh.ts` | 2,180 | OAuth token refresh | One actor per provider, ~50 LoC each |
| `open-sse/executors/grok-web.ts` | 1,862 | Browser-automation Grok | Same wrap-as-WebExecutor pattern |

## 3. Stable contracts (must preserve)

- `docs/openapi.yaml` (6,693 lines) — public API shape, byte-compatible
- `src/lib/db/migrations/*.sql` (119 files) — port as-is, run in order
- CLI command surface (`omniroute start`, `omniroute-reset-password`, etc.)
- Env vars: `OMNIROUTE_PORT`, `OMNIROUTE_DATA_DIR`, `OMNIROUTE_*`
- Config files: `~/.omniroute/`, `~/.config/omniroute/`, `dataDir.ts`
- Bin name: `omniroute` (must keep)
- Package name: `omniroute` on npm
- WebSocket sub-protocols for Cursor + Codex
- MITM proxy protocol (HTTP CONNECT, custom CA bundle)
- SQLite file format (so existing installs migrate cleanly)

## 4. Mutable contracts (can change in rewrite)

- Internal module boundaries
- Build system (Next.js backend -> standalone Rust binary)
- Telemetry/events (keep OTel, change implementation)
- DB driver (sql.js -> rusqlite, same .db files)
- Internal admin/auth internals (keep the v1 virtual key surface)
- TypeScript SDK packages (rewrite as native SDKs, keep `@omniroute/opencode-*` if desired)
- Frontend -> backend transport (HTTP, same OpenAPI, no change)

## 5. Migration risk (data, env, config)

- **Data:** all user data is in `~/.omniroute/storage.sqlite` and `~/.config/omniroute/storage.sqlite`. The new Rust binary must read both and run the 119 migrations. Use `rusqlite` in WAL mode.
- **Env:** the `.env` file has ~150 lines of `OMNIROUTE_*` keys; we keep all names and parse them at startup. No secret values in the repo.
- **Config:** `config/settings.yml` is the only structured config. The new binary can read it via `serde_yaml`.
- **Desktop bridge:** the existing desktop/electron/flutter apps call the gateway over HTTP. The new binary must listen on the same port (default 20128) and accept the same routes. Backward-compat by default.

## 6. LoC totals and breakdown

| Concern | LoC |
|---------|----:|
| open-sse (executors, MCP, transformer, services, handlers, utils, translator) | 201,358 |
| src/lib (db, providers, usage, memory, tunnels) | 127,173 |
| src/app/api (v1 + management routes) | 58,060 |
| src/mitm (proxy + cert + tproxy + inspector) | 7,387 |
| src/sse (streaming core) | 6,009 |
| src/domain (policy, fallback, cost, combo, tag) | 4,887 |
| src/server (auth, authz, cors, origin, ws) | 3,038 |
| src/store | 248 |
| bin (CLI entrypoints) | ~500 |
| **Backend total** | **~408,660** |

## 7. Rewrite effort estimate (Rust)

| Concern | LoC TS | LoC Rust (est) | Effort (engineer-weeks) |
|---------|-------:|---------------:|------------------------:|
| open-sse executors (80) | 39,600 | ~50,000 (slight increase) | 12-16 |
| open-sse services + handlers | 70,000 | ~75,000 | 8-10 |
| open-sse transformer + translator | 15,000 | ~18,000 | 3-4 |
| open-sse MCP server | 4,000 | ~5,000 | 1-2 |
| src/lib/db | 25,000 | ~30,000 (migrations + types + repo) | 6-8 |
| src/lib/providers + validation | 30,000 | ~32,000 | 4-6 |
| src/lib/usage, memory, tunnels | 30,000 | ~32,000 | 4-6 |
| src/app/api (152 routes) | 58,000 | ~50,000 (axum + utoipa code-gen) | 4-6 |
| src/mitm | 7,400 | ~9,000 | 3-4 |
| src/sse | 6,000 | ~5,000 | 2-3 |
| src/domain | 4,900 | ~5,000 | 1-2 |
| src/server | 3,000 | ~3,000 | 1-2 |
| bin (CLI) | 500 | ~1,500 (clap + ratatui) | 1-2 |
| Tests + fixtures + replay harness | 0 | ~20,000 | 6-8 |
| Tooling, CI, build, packaging | 0 | ~10,000 | 4-6 |
| **Total** | **~293 K (rounded)** | **~345 K** | **~58-83 weeks (1-2 engineers)** |

Reality check: with 2 senior Rust engineers + 1 QA + the existing TS/JS maintainer as domain expert, v4.0 ships in 16-24 weeks. 80 executors are the critical path; a v4.0 with 30 executors + a v4.1 with 30 + v4.2 with 20 is the realistic rollout.

## 8. Top 5 risks ranked, with mitigation

| # | Risk | Severity | Mitigation |
|---|------|---------:|-----------|
| 1 | 80 provider executors have hidden behavior; porting without test fixtures drops coverage | High | Reuse `open-sse/executors/__tests__/*.ts` fixtures; build a Rust-side replay harness; gate v4.0 on 30/80 + a parity test that runs both implementations against the same fixture and diffs the response (modulo non-deterministic fields). |
| 2 | Browser-automation executors (chatgpt-web, antigravity, muse-spark, claudeIdentity) cannot be fully ported to native Rust | High | Keep a small Bun/Node sidecar (`sidecar/browser-executor.mjs`) that the Rust binary invokes over a local Unix socket for the ~5 browser-only providers. Same IPC contract, same auth. |
| 3 | MITM CA trust must be OS-perfect; macOS keychain + Linux update-ca-certificates + Windows certutil | High | Use `security` (macOS), `update-ca-certificates` (Linux), `certutil` (Windows) as out-of-process commands; wrap with a thin `cert_install::install()` API. Test on all 3 OSes from week 1. |
| 4 | SQLite data migration: existing user DBs must work with the new binary | High | Open the existing `.db` in WAL mode; run `PRAGMA user_version`; replay the 119 migrations on demand; never delete or rewrite existing data. Add a `omniroute db migrate` CLI command that prints the version delta. |
| 5 | OpenAPI parity: a single breaking change in `/v1/chat/completions` cascades to the dashboard | High | Generate the Rust types from `docs/openapi.yaml` via `progenitor` (Rust). Add a contract test that calls every route in the OpenAPI spec against the new binary and verifies the response shape matches. |
