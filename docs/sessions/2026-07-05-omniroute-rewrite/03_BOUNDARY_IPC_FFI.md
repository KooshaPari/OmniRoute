# OmniRoute Fork — Boundary, IPC, and FFI Audit

> **Audit date:** 2026-07-05
> **Companion to:** `01_TS_BACKEND_INVENTORY.md`, `02_POLYGLOT_ARCHITECTURE.md`
> **Purpose:** map the seams that the polyglot rewrite will cut along, score each seam for cleanliness, and produce a sequenced migration plan with concrete go/no-go gates.

---

## 1. Process inventory

| Process | Entry | Parent | Lifetime | Restart? |
|---|---|---|---|---|
| `omniroute` server | `src/server-init.ts` (Next.js) | `scripts/dev/run-next.mjs` (dev) or `bin/omniroute.mjs` (serve) | long-lived | supervised by `bin/cli/runtime/processSupervisor.mjs` |
| `omniroute` CLI | `bin/omniroute.mjs` (223 lines) | user | short-lived | n/a |
| `omniroute` TUI | `bin/cli/tui/*` JSX | user | short-lived | n/a |
| `omniroute` tray | `bin/cli/tray/{traySystray,trayWindows}.mjs` | user session | long-lived | autostart via `bin/cli/tray/autostart.mjs` |
| `omniroute` MCP server | `bin/mcp-server.mjs` | IDE/editor | per-session | n/a |
| `open-sse` providers (in-process) | `open-sse/index.ts` | same as server | long-lived | with server |
| `open-sse/mcp-server` package | `open-sse/mcp-server/` | external | per-session | n/a |
| MITM tproxy (native) | `src/mitm/tproxy/native/` (C/C++, node-gyp) | server | long-lived | with server |
| Tailscale tunnel | `src/lib/tailscaleTunnel.ts` (1201) | server | long-lived | with server |
| Cloudflared tunnel | `src/lib/cloudflaredTunnel.ts` (933) | server | long-lived | with server |
| Ngrok tunnel | `src/lib/ngrokTunnel.ts` | server | long-lived | with server |
| Service supervisor | `bin/cli/runtime/processSupervisor.mjs` | CLI | short-lived | n/a |
| `versionManager` binary | `src/lib/versionManager/{processManager,binaryManager}.ts` | supervisor | long-lived | supervised |
| Electron main | `electron/main.js` | user session | long-lived | OS |
| Electron renderer | Electron main | n/a | per-window | with main |
| ServiceSupervisor | `src/lib/services/ServiceSupervisor.ts` | server | long-lived | with server |
| Cliproxy installer | `src/lib/services/installers/cliproxy.ts` | server | long-lived | supervised |
| Backup / restore scripts | `bin/{snapshot-data,restore-data,restore-policies,rollback}.sh` | CLI | short-lived | n/a |

**child_process usage in src/:** `server/authz/routeGuard.ts`, `versionManager/{processManager,binaryManager}.ts`, `services/installers/{cliproxy,utils}.ts`, `shared/services/loginShellPath.ts`, `mitm/inspector/systemProxyConfig.ts`, `mitm/systemCommands.ts`, `mitm/manager.ts`, `services/ServiceSupervisor.ts`, `tailscaleTunnel.ts`, `acp/{registry,manager}.ts`, `headroom/{process,detect}.ts` — 14 files.

---

## 2. IPC mechanisms in use

| Mechanism | Used by | Notes |
|---|---|---|
| stdio (pipes) | `ServiceSupervisor`, `versionManager`, `cliproxy` | standard child_process pattern |
| Unix domain sockets | not in source; implied by some Electron IPC | minor |
| TCP (loopback) | `omniroute` server (default 20128) | the public surface |
| HTTP (loopback) | dashboard → server, CLI → server | OpenAI-compatible |
| WebSocket | MCP server, A2A server, editor integrations | `src/lib/ws/` |
| SSE | `/v1/chat/completions` (streaming) | `src/sse/` |
| in-process mpsc | within Next.js server | not relevant to rewrite |
| mpsc over Unix socket | Electron main ↔ renderer | out of scope |
| C-ABI (native modules) | `src/mitm/tproxy/native/` (node-gyp `.node`) | the only FFI today |

---

## 3. State that crosses process boundaries

| State | Owner | Crosses via | Risk |
|---|---|---|---|
| DB connection (SQLite) | server | every process opens its own handle to `~/.omniroute/storage.sqlite` | WAL contention; mitigated by `DISABLE_SQLITE_AUTO_BACKUP=true` in test env |
| Secrets (API keys, OAuth tokens) | server (encrypted at rest) | CLI reads via HTTP API | low; the CLI never touches raw keys |
| Request context (auth, trace) | server | HTTP headers (`X-Request-Id`, `Authorization`) | low |
| Streaming buffers | server → client | SSE / WebSocket | high; this is the hot path |
| Semantic cache | server in-process | n/a | low (in v1; will become shared when we add a sidecar) |
| LRU caches (`cacheLayer`, `promptCache`, `semanticCache`) | server in-process | n/a | low |
| Model registry | server in-process; rebuilt at boot | n/a | low |
| Tunnel state (tailscale/cloudflared/ngrok) | server | stdio to the tunnel binary | medium; stateful protocols |
| Tproxy CA bundle | server | disk | low |

---

## 4. Native FFI surface

**Only one C/C++ surface exists today:** `src/mitm/tproxy/native/`.

It is the Linux `IP_TRANSPARENT` tproxy, built via node-gyp. It exports a small C-ABI: create a tproxy socket, bind, recv, send, close. The exact exported symbols should be inventoried during Phase 0 by reading `binding.gyp` + the `.c`/`.cc` sources. **This is the first thing we port to Zig in v1** because:

- The C code is small (likely 200-500 lines).
- The C-ABI is already C-ABI; Zig can import the existing `.h` unchanged.
- We can ship a `.node` Addon from the Zig build for the transition, then drop the Addon and link statically into Rust.

**No other native modules.** No WASM, no `dlsym`, no `extern "C"` outside the tproxy.

---

## 5. Streaming boundaries

| Boundary | File | Buffer | Backpressure | Cancellation |
|---|---|---|---|---|
| Provider egress → router | `src/lib/proxyRelay/`, `src/lib/providers/` | per-chunk JSON | request abort on client disconnect | `AbortController` propagated |
| Router → client (SSE) | `src/sse/`, `src/lib/sseTextTransform.ts` | line-buffered | flushed on each `data:` | `req.signal` |
| Router → client (WS) | `src/lib/ws/`, `src/lib/a2a/` | frame-buffered | ping/pong heartbeat | `ws.close()` |
| Router → DB (call_log) | `src/lib/usage/callLogs.ts` (974) | batched | `Promise.all` with `p-limit` | none today (fire-and-forget) |
| PII redaction on stream | `src/lib/streamingPiiTransform.ts` | chunked | backpressures the upstream | inherited |
| Provider → MITM recorder | `src/mitm/` | full request/response buffered to disk | none | inherited |

**Implication:** the streaming path has implicit backpressure and no explicit cancellation. The Rust port should make cancellation explicit (Tokio `select!` on `req.signal`) and document the buffering policy in `omniroute-router`.

---

## 6. Lifecycle and signal handling

- **Graceful shutdown** lives in `src/lib/gracefulShutdown.ts` (read during Phase 0 to capture the exact policy).
- **Supervisor** lives in `bin/cli/runtime/processSupervisor.mjs` (and `src/lib/services/ServiceSupervisor.ts` for child services). The pattern: parent forks child, watches stdio, restarts on exit, forwards SIGTERM.
- **Process model:** server is the long-lived daemon; CLI is short-lived; TUI is short-lived; tray is long-lived per session.
- **Backups:** `bin/snapshot-data.sh` / `restore-data.sh` / `restore-policies.sh` / `rollback.sh` cover DB and policy backup. The CLI `backup.mjs` (469) is the user-facing surface.
- **Crash recovery:** `DISABLE_SQLITE_AUTO_BACKUP=true` is set in test env; in prod, the DB is periodically snapshotted.

The Rust supervisor should be a port of `processSupervisor.mjs` (Rust, in `omniroute-xtask`'s `runtime` module). The CLI is the supervisor's parent.

---

## 7. Boundary cleanliness scoring

Each candidate replacement boundary, scored 1-5 on cleanliness, test coverage, and regression risk:

| Boundary | Cleanliness | Test coverage | Regression risk | Verdict |
|---|---|---|---|---|
| `bin/omniroute.mjs` CLI | 5 | medium (most commands have a test) | low | **GREEN — replace first (Phase 0/1)** |
| `bin/cli/runtime/processSupervisor.mjs` | 4 | low (process supervision is hard to test) | medium | YELLOW — port carefully |
| `bin/cli/tui/*` JSX | 3 | low | low (UI, not data path) | YELLOW — keep in TS or port to Go TUI (bubbletea); defer to v2 |
| `bin/cli/tray/*` | 3 | low | low | YELLOW — keep in TS; tray is OS-specific glue |
| `src/mitm/tproxy/native/` | 4 | medium (the tproxy has its own C test) | medium | **GREEN — port to Zig in Phase 3** |
| `src/lib/db/*` (SQLite layer) | 5 | high (1917 tests touch it) | medium | **GREEN — replace in Phase 1** |
| `src/lib/dataPaths.ts` | 5 | medium | low | **GREEN — port to Rust in Phase 0/1 (first deliverable)** |
| `src/app/api/v1/chat/completions/route.ts` | 3 | medium | high | YELLOW — replace in Phase 2 with extensive golden-set tests |
| `src/lib/translator/` (provider translation) | 3 | medium | high | YELLOW — replace in Phase 2 |
| `src/lib/providers/validation.ts` (3867) | 2 | medium | high | YELLOW — port incrementally (the file is too big for a single PR) |
| `src/lib/auth/`, `accessTokens/`, `oauth/` | 4 | medium | high | YELLOW — replace in Phase 2 once the auth surface is fully tested |
| `src/lib/compression/*` (RTK + Caveman) | 4 | medium | medium | YELLOW — replace in Phase 2 |
| `src/lib/mcp/`, `src/lib/a2a/`, `src/lib/acp/` | 4 | low | medium | YELLOW — replace in Phase 3 with `rmcp` |
| `src/sse/`, `src/lib/sseTextTransform.ts`, `src/lib/streamingPiiTransform.ts` | 3 | low | high | YELLOW — replace in Phase 3 with the Zig SSE parser |
| `src/lib/tailscaleTunnel.ts`, `cloudflaredTunnel.ts`, `ngrokTunnel.ts` | 3 | low | medium | YELLOW — replace in Phase 4 (tunnel protocols are stateful) |
| `src/lib/services/ServiceSupervisor.ts` | 3 | low | medium | YELLOW — port the supervisor concept, keep the per-service code in Go |
| `src/lib/services/installers/cliproxy.ts` | 3 | low | medium | YELLOW — replace in Phase 1 (port to Go installer) |
| `src/lib/versionManager/{processManager,binaryManager}.ts` | 3 | low | medium | YELLOW — replace in Phase 1 (port to Go) |
| `src/lib/piiSanitizer.ts`, `src/lib/guardrails/`, `src/lib/compliance/` | 4 | medium | high | YELLOW — replace in Phase 2 (safety-critical; test parity required) |
| `electron/main.js`, `preload.js`, `processTree.js`, `sqlite-inspection.js`, `loginManager.js` | 5 | low | low | **GREEN — retarget at the new binary (no rewrite needed)** |
| `src/app/(dashboard)/dashboard/*` (Next.js pages) | n/a | n/a | n/a | OUT OF SCOPE |
| `src/lib/usage/{callLogs,providerLimits,usageHistory,usageAnalytics,usageDb,routeExplain,routeExplain}.ts` | 4 | medium | medium | YELLOW — replace in Phase 1/2 |

---

## 8. Sequenced migration plan

### Phase 0 — Toolchain (1 week)

**Goal:** `just build` produces a placeholder `dist/omniroute` binary that prints `omniroute 0.0.0`.

**In scope:**
- `rust/` Cargo workspace skeleton
- `go/` module skeleton
- `zig/` build skeleton
- `justfile` with `build`, `test`, `lint`, `release` recipes
- `omniroute-xtask` Rust binary that bundles Rust+Go+Zig
- `omniroute-bridge` cdylib with one stub function (`or_version() -> const char*`)
- `omniroute-core` crate with the trait surface only (no impl)
- CI workflow (`.github/workflows/ci.yml`) that runs `cargo test`, `go test`, `zig build test`, and the existing TS test suite

**Go/no-go gate:**
- `just build` works on macOS aarch64, Linux x86_64, Linux aarch64, Windows x86_64.
- The TS test suite (1917 files) still passes (no regressions in the existing app).
- `dist/omniroute --version` prints the version string.

### Phase 1 — Data plane (4-6 weeks)

**Goal:** `dist/omniroute db status`, `dist/omniroute db backup`, `dist/omniroute data-dir` all work and are byte-for-byte equivalent to the current CLI.

**In scope:**
- `omniroute-db` crate: `rusqlite` + the 116 SQL migration files, run in the same order.
- `omniroute-bridge`: `OrRequest`/`OrResponse` C-ABI surface.
- Go `internal/bridge` package: cgo wrapper.
- Go `internal/commands/{db,data-dir,backup,doctor,config,env}.go` ports of the corresponding `.mjs` commands.
- `omniroute-data-paths` Rust crate: port of `src/lib/dataPaths.ts` (122 lines).
- `omniroute-encryption` Rust crate: port of `bin/cli/encryption.mjs`.
- `omniroute-xtask bundle` produces a binary that contains all of the above.

**Files replaced (TS → Rust/Go):**
- `bin/omniroute.mjs` (223) → `go/cmd/omniroute/main.go`
- `bin/cli/data-dir.mjs` → `go/internal/commands/data_dir.go`
- `bin/cli/sqlite.mjs` → `go/internal/commands/sqlite.go`
- `bin/cli/encryption.mjs` → `rust/crates/omniroute-encryption/`
- `bin/cli/commands/backup.mjs` (469) → `go/internal/commands/backup.go` (calls into `omniroute-db` for snapshot)
- `bin/cli/commands/doctor.mjs` (484) → `go/internal/commands/doctor.go`
- `bin/cli/commands/config.mjs` (351) → `go/internal/commands/config.go`
- `bin/cli/commands/env.mjs` → `go/internal/commands/env.go`
- `bin/cli/commands/keys.mjs` (599) → `go/internal/commands/keys.go` (DB layer only; the HTTP key management stays in Phase 2)
- `bin/cli/commands/providers.mjs` (706) → `go/internal/commands/providers.go` (DB layer only)
- `bin/cli/commands/runtime.mjs` → `go/internal/commands/runtime.go`
- `bin/cli/runtime/{processSupervisor,sqliteRuntime,supervisorPolicy,nativeDeps}.mjs` → `go/internal/runtime/` ports
- `bin/cli/utils/{pid,clipboard,storageKeyProvision,environment,cliToken}.mjs` → `go/internal/utils/` ports
- `src/lib/dataPaths.ts` (122) → `rust/crates/omniroute-data-paths/`
- `src/lib/db/core.ts` (1519) → `rust/crates/omniroute-db/src/core.rs`
- `src/lib/db/apiKeys.ts` (1412) → `rust/crates/omniroute-db/src/api_keys.rs` (Rust port; Go calls via bridge)
- `src/lib/db/{models,settings,providers,proxies,usageAnalytics,evals,compression,middleware,providerNodeSelect,jsonMigration,proxyLogs,memoryVec,gamification}.ts` → `rust/crates/omniroute-db/src/...`
- `src/lib/localDb.ts` (762) → `rust/crates/omniroute-db/src/local_db.rs`
- `src/lib/db/migrationRunner.ts` (1228) → `rust/crates/omniroute-db/src/migration_runner.rs`
- `src/lib/services/installers/{cliproxy,utils}.ts` → `go/internal/installers/`
- `src/lib/versionManager/{processManager,binaryManager}.ts` → `go/internal/version/`
- `src/lib/services/ServiceSupervisor.ts` → `go/internal/services/`

**Go/no-go gate:**
- All 47 data-related CLI commands produce byte-for-byte equivalent output to the current TS CLI.
- The 1917 TS tests still pass.
- `dist/omniroute db status --json` matches `node bin/omniroute.mjs db status --json` byte-for-byte.
- A round-trip DB migration test runs the 116 SQL files in order and produces an identical DB to a TS-driven fresh install.
- A backup-and-restore test (`dist/omniroute backup ...` then `dist/omniroute restore ...`) reproduces the current `bin/snapshot-data.sh` + `bin/restore-data.sh` behavior.

### Phase 2 — Request plane (8-12 weeks)

**Goal:** `dist/omniroute serve` runs the OpenAI-compatible HTTP surface (chat, embeddings, completions, models, rerank) and is the production server. The Next.js app proxies to it (or is retired in Phase 4).

**In scope:**
- `omniroute-providers` crate: codegen'd from `open-sse/config/*.ts` (a `build.rs` reads the catalog at build time).
- `omniroute-router` crate: `axum` server, `/v1/chat/completions`, `/v1/embeddings`, `/v1/models`, `/v1/completions`, `/v1/rerank`, `/v1/responses`, `/v1/messages`, `/v1/messages/count_tokens`, plus the `relay/chat/completions` and `relay/chat/completions/bifrost` routes.
- `omniroute-translator` crate: port of `src/lib/translator/` (the OpenAI ↔ provider shape layer).
- `omniroute-auth` crate: port of `src/lib/auth/`, `src/lib/accessTokens/`, `src/middleware/promptInjectionGuard.ts`, `src/server/authz/routeGuard.ts`. Secrets stay in this crate.
- `omniroute-compression` crate: port of `src/lib/compression.ts` (752) and the `/api/compression/*` and `/api/settings/compression/*` routes.
- `omniroute-usage` crate: port of `src/lib/usage/{callLogs,providerLimits,usageHistory,usageAnalytics,usageDb,routeExplain}.ts`.
- `omniroute-cache` crate: port of `src/lib/{cacheLayer,semanticCache,promptCache,cacheControlSettings}.ts`.
- `omniroute-guardrails` crate: port of `src/lib/guardrails/`, `src/lib/compliance/`, `src/lib/piiSanitizer.ts`, `src/lib/streamingPiiTransform.ts`.
- `omniroute-tunnels` crate: port of `src/lib/{tailscaleTunnel,cloudflaredTunnel,ngrokTunnel}.ts` (the tunnel sub-process lifecycle).
- `omniroute-observability` crate: tracing + OTel.
- `omniroute-router-eval` crate: port of `scripts/router-eval/index.ts` (the Bun router eval).
- A golden-set replay harness in `tests/golden/` that replays 10k real requests and compares outputs.
- An HTTP-level benchmark in `tests/perf/` (k6 or drill).

**Files replaced (TS → Rust):** the full hot-path list from `01_TS_BACKEND_INVENTORY.md §16`, plus:
- `src/app/api/v1/chat/completions/route.ts`
- `src/app/api/v1/{completions,embeddings,rerank,models,responses,messages,messages/count_tokens}/route.ts`
- `src/app/api/v1/relay/chat/completions/{,bifrost}/route.ts`
- `src/app/api/v1/providers/[provider]/{chat/completions,embeddings,models,images/generations,limits}/route.ts`
- `src/app/api/v1/{audio/speech,audio/transcriptions,images/generations,images/edits,videos/generations,music/generations}/route.ts`
- `src/app/api/v1/accounts/[id]/limits/route.ts`, `/api/v1/registered-keys/{,[id],[id]/revoke}/route.ts`
- `src/app/api/v1/me/status/route.ts`, `/api/v1/quotas/check/route.ts`
- `src/app/api/compression/{engines,rules,preview,replay,language-packs,budget}/route.ts`
- `src/app/api/settings/compression/{,run-telemetry,mcp-accessibility,rules}/route.ts`
- `src/app/api/analytics/compression/route.ts`
- `src/lib/translator/`, `src/lib/providers/validation.ts`, `src/lib/providers/{requestDefaults,imageValidation,staticModels,managedAvailableModels,catalog,serviceKindIndex,claudeFastMode,claudeExtraUsage,codexFastTier,codexConnectionDefaults,nvidiaValidationModel,webCookieAuth}.ts`
- `src/lib/{cacheLayer,semanticCache,promptCache,cacheControlSettings,idempotencyLayer,piiSanitizer,streamingPiiTransform,sseTextTransform,gracefulShutdown}.ts`
- `src/lib/auth/`, `src/lib/accessTokens/`, `src/middleware/`, `src/server/authz/`
- `src/lib/usage/*`, `src/lib/compression.ts`, `src/lib/resilience/`
- `src/lib/guardrails/`, `src/lib/compliance/`, `src/lib/security/`
- `src/sse/`

**Go/no-go gate:**
- Golden-set replay: 10k real chat requests through the Rust server produce identical tokens to the TS server (modulo non-determinism in provider responses; the test asserts semantic equivalence, not byte equivalence).
- p50 overhead < 50ms; p99 < 200ms.
- HTTP-level benchmark (`tests/perf/`) shows the Rust server sustains > 5k tok/s/connection on streaming.
- The 1917 TS tests still pass (no regressions in the dashboard / TUI / tray).
- The OpenAPI spec generated by `utoipa` matches `docs/openapi.yaml` (modulo Rust's stricter typing).

### Phase 3 — Streaming, MITM, MCP/A2A, embeddings (6-8 weeks)

**Goal:** SSE parser in Zig, MITM tproxy in Zig, MCP/A2A/ACP in Rust via `rmcp` and `jsonrpsee`, semantic cache via `ort` (ONNX).

**In scope:**
- `omniroute-mitm` crate: Rust wrapper around the Zig tproxy.
- `zig/src/tproxy.zig`: 1:1 port of `src/mitm/tproxy/native/*.c`.
- `zig/src/sse_parse.zig`: SSE framing parser; called from Rust via FFI.
- `omniroute-mcp` crate: `rmcp` server; port of `src/lib/mcp/`.
- `omniroute-a2a` crate: `jsonrpsee` server; port of `src/lib/a2a/`.
- `omniroute-acp` crate: port of `src/lib/acp/`.
- `omniroute-embed` crate: `ort`-backed `EmbeddingProvider` impl.
- `omniroute-cache` migration: semantic cache moves from `src/lib/semanticCache.ts` to `omniroute-embed` + `omniroute-cache`.

**Files replaced (TS → Rust/Zig):**
- `src/mitm/manager.ts` (and `manager.runtime.ts`, `manager.stub.ts`)
- `src/mitm/{systemCommands,passthrough,upstreamTrust,maskSecrets,sanitizeHeaders,socketTimeouts,dataDir,types}.ts`
- `src/mitm/inspector/systemProxyConfig.ts`
- `src/mitm/tproxy/native/*` → `zig/src/tproxy.zig`
- `src/sse/`, `src/lib/sseTextTransform.ts`, `src/lib/streamingPiiTransform.ts` → Rust + `zig/src/sse_parse.zig`
- `src/lib/mcp/`, `bin/mcp-server.mjs` → `omniroute-mcp`
- `src/lib/a2a/`, `src/app/a2a/route.ts`, `src/app/.well-known/agent.json/route.ts` → `omniroute-a2a`
- `src/lib/acp/`, `src/lib/zed-oauth/` → `omniroute-acp`
- `src/lib/semanticCache.ts` (now ONNX-backed) → `omniroute-embed`

**Go/no-go gate:**
- The Zig tproxy passes the existing C test suite (run in CI as a separate job).
- The SSE parser passes a fuzz suite (`cargo fuzz`) with 0 crashes over 1M iterations.
- The `rmcp` server is protocol-conformant (test against the official MCP test fixtures).
- The A2A server passes a JSON-RPC conformance check.
- ONNX embedding model produces embeddings within 1e-6 of the TS implementation (against a fixed-input test set).

### Phase 4 — Retire the Next.js server (4-6 weeks)

**Goal:** drop the Next.js server; ship a single Rust binary; keep the Electron shell and the dashboard as static assets served by the same binary.

**In scope:**
- `omniroute-router` adds a static-file handler for the Next.js export (`next export` output).
- The `next-isolated` build is replaced by a `cargo run -p omniroute-xtask -- bundle-frontend` step that produces a single binary with the frontend embedded.
- `bin/omniroute.mjs` and `scripts/dev/run-next.mjs` are removed; the CLI is the only entry point.
- The 1917 TS tests are ported to `cargo test` and `go test` (or remain as a separate `tests/ts/` suite if porting is uneconomic).

**Files removed:**
- `src/server-init.ts`, `src/proxy.ts`, `src/server/`
- `src/app/api/**/route.ts` (all 543 — replaced by `omniroute-router`)
- `scripts/dev/run-next.mjs`
- `bin/omniroute.mjs` (replaced by `go/cmd/omniroute/main.go`)

**Go/no-go gate:**
- `dist/omniroute serve` boots in < 1s cold, < 200ms warm.
- The full end-to-end smoke (`tests/e2e/smoke.sh`) passes on a clean install.
- The 1917 TS tests are ported and passing, OR a sponsor sign-off records that TS tests are deprecated and Rust tests are the new contract.
- A 24-hour soak test on the new binary shows no memory growth above 1% and no crash.
- Release artifact is a single binary per platform, < 80 MB stripped.

---

## 9. Recommendations summary

**Top 3 boundaries to replace first (highest leverage, lowest risk):**
1. `bin/omniroute.mjs` CLI → Go (Phase 0/1).
2. `src/lib/dataPaths.ts` + `src/lib/db/*` → Rust (Phase 1).
3. `src/mitm/tproxy/native/` C → Zig (Phase 3; small, isolated, real perf win).

**Top 3 boundaries to leave alone until late (highest risk, lowest leverage):**
1. `src/lib/providers/validation.ts` (3867 lines) — too big to port in one PR; port incrementally per provider family.
2. `bin/cli/tui/*` JSX — UI; out of scope for the user's directive; defer to v2.
3. `src/lib/{tailscaleTunnel,cloudflaredTunnel,ngrokTunnel}.ts` — stateful tunnel protocols; port only after Phase 2 is stable.

**Top 3 risks to flag in the plan:**
1. **TS test parity is the long pole.** 1917 tests are the contract; the Rust port must keep them green throughout the migration.
2. **Provider catalog drift.** Codegen from `open-sse/config/`; never hand-edit Rust provider structs.
3. **Cancellation/backpressure in streaming.** The TS code has implicit cancellation; the Rust port should make it explicit (Tokio `select!` on `req.signal`) and document buffering in `omniroute-router`.
