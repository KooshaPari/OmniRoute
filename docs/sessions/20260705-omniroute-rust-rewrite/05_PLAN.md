# OmniRoute Backend Rewrite — Implementation Plan (v4.0)

## 1. Summary

Rewrite OmniRoute's backend (HTTP API, CLI, SDK, MCP, mitm, SSE, executors, domain, store) in **Rust**, in a separate workspace `omniroute-v4/` (sibling of the existing Next.js repo). Keep the existing Next.js dashboard frontend unchanged; it calls the new Rust binary over HTTP on the same port (default 20128) using the existing OpenAPI 3.1 contract. The new binary is a single static executable per OS/arch, distributed via the same npm package's bin entry (a thin Node shim that spawns the Rust binary and forwards stdio) so `npm i -g omniroute` keeps working.

The first release (`v4.0`) ships the gateway, CLI, mitm, SSE, MCP, and 30 of the 80 provider executors with feature flags for the rest. Subsequent releases (`v4.1`, `v4.2`) add executors + reliability + cost/observability until parity is reached. Total effort: 16-24 weeks for v4.0 with 2 senior Rust engineers + 1 QA.

## 2. Workspace layout

```
omniroute-v4/                              # new Rust workspace
  Cargo.toml                               # workspace root
  rust-toolchain.toml                      # pin rust 1.85
  deny.toml                                # cargo-deny config
  crates/
    omniroute-core/                        # types, errors, traits, request/response models
    omniroute-config/                      # env + config + secrets loading
    omniroute-db/                          # rusqlite + sqlx + 119 migrations + repo layer
    omniroute-auth/                        # JWT, virtual key, RBAC, audit
    omniroute-policy/                      # policy engine, fallback, cost, combo, tag (port of src/domain)
    omniroute-translator/                  # OpenAI <-> provider shape translation (port of open-sse/translator)
    omniroute-executors/                   # the 80 executors (port of open-sse/executors)
      src/
        base.rs                            # Executor trait + Capabilities
        registry.rs                        # ProviderRegistry
        providers/                         # 80 concrete impls
        web/                               # WebExecutor trait + browser sidecar IPC
    omniroute-router/                      # /v1/* request routing (axum router)
    omniroute-mcp/                         # rmcp server
    omniroute-mitm/                        # proxy + cert + tproxy + inspector (port of src/mitm)
    omniroute-sse/                         # streaming core (port of src/sse)
    omniroute-tunnel/                      # tailscale + cloudflared + ngrok
    omniroute-cli/                         # clap CLI entrypoint (port of bin/)
    omniroute-server/                      # main binary: axum + mitm + CLI in one process
  apps/
    browser-sidecar/                       # Bun-based sidecar for browser-only providers
      package.json
      src/index.ts
  tests/
    contract/                              # OpenAPI parity tests
    replay/                                # replay harness: fixture -> old impl -> new impl -> diff
    perf/                                  # k6 / wrk load tests
  scripts/
    replay.sh
    bench.sh
    smoke.sh
  tools/
    bin/                                   # node shim that spawns the rust binary
      omniroute.mjs
      omniroute-reset-password.mjs
      mcp-server.mjs

# The existing fork stays in place; we just swap the bin/* entrypoints to the new
# workspace's tools/bin/*.mjs shim, which spawns ../target/release/omniroute-server.
```

## 3. Key decisions

1. **Rust as the primary language.** Rationale and comparison are in `02_LANGUAGE_COMPARISON.md`. Short version: only Rust gives us single-binary + mature MCP/SQLite/axum/rustls + matching ecosystem (Bifrost-RS, pingora, rpxy).
2. **Single binary, not a fleet.** Everything (gateway, mitm, CLI, MCP, SSE) ships in one process by default. A `omniroute server --mitm-only` mode exposes only the proxy; `omniroute mcp` exposes only the MCP server. This avoids orchestration complexity and matches the current Node behavior.
3. **OpenAPI as the contract.** The dashboard keeps calling the new binary over HTTP; we do not change the public surface. Internal Rust types are derived from `docs/openapi.yaml` via `progenitor` (Rust OpenAPI client/server codegen).
4. **Provider executor pattern.** A single Rust `Executor` trait + a data-driven `ProviderRegistry`. 80 concrete impls in `crates/omniroute-executors/src/providers/`. Browser-only providers (chatgpt-web, claudeIdentity, antigravity) are wrapped in a `WebExecutor` trait that talks to a Bun sidecar over a local Unix socket.
5. **SQLite unchanged.** `rusqlite` (WAL + json1 + sqlite-vec) reads existing `.db` files; we run the 119 SQL migrations in order on first launch.
6. **MITM preserved as-is.** `rcgen` for the self-signed CA, `rustls` for the proxy, OS shell-outs for cert install (`security`, `update-ca-certificates`, `certutil`). WebSocket pass-through via `tokio-tungstenite`. Linux tproxy via nftables/iptables wrapper.
7. **MCP via `rmcp`.** The official Rust SDK covers the 2025-06-18 spec. Tools/Resources/Prompts map 1:1 to the current TS impl.
8. **SSE via `axum::body::Body::Stream`.** Token bucket via `governor`. Abort signal merge via a small actor model. SSE merging via a custom `SseMerger` struct.
9. **Observability: `tracing` + `tracing-subscriber` + `tracing-opentelemetry` + `metrics` + `metrics-exporter-prometheus`.** Same OTel semantic conventions as the existing TS backend; log shape is the same (pino-equivalent).
10. **CLI: `clap` 4 + `ratatui` + `indicatif`.** Replaces commander/ink/ora. Single binary; the `bin/*.mjs` shims are still present (the npm package's bin entries), they just exec the rust binary and forward stdio.
11. **Distribution: musl static binary + npm shim.** Build `x86_64-unknown-linux-musl`, `aarch64-unknown-linux-musl`, `x86_64-apple-darwin`, `aarch64-apple-darwin`, `x86_64-pc-windows-msvc`. Bundle in the npm tarball under `bin/runtime/<triple>/omniroute-server`. The `.mjs` shim picks the right triple at install time.
12. **Migration: bridge mode.** During v4.0, the dashboard can call either the old Next.js API routes or the new Rust binary. A `OMNIROUTE_BACKEND=rust|njs` env var in the dashboard selects which to talk to. Default to `njs` until v4.0 GA, then default to `rust`.

## 4. Crate boundaries and file size mandate

The new code is held to the same AGENTS.md mandate: every file <=500 lines, target <=350. The 50+ files currently over 500 in the TS repo are split across multiple crates and modules in Rust. For example:
- `open-sse/handlers/chatCore.ts` (4,308 LoC) -> `crates/omniroute-router/src/chat/{router,picker,transformer,writer}.rs` (4 files, ~250 LoC each)
- `src/lib/providers/validation.ts` (3,908 LoC) -> `crates/omniroute-translator/src/validation/{shape,tool,image,reasoning,audio,moderation}.rs` (6 files, ~200 LoC each)
- `open-sse/executors/chatgpt-web.ts` (3,205 LoC) -> `crates/omniroute-executors/src/providers/chatgpt.rs` (~400 LoC) + `apps/browser-sidecar/src/chatgpt.ts` (~2,500 LoC). The Rust side is the trait impl + IPC; the heavy lifting stays in the sidecar.
- `open-sse/utils/stream.ts` (2,726 LoC) -> `crates/omniroute-sse/src/{reader,writer,merger,filter,abort}.rs` (5 files, ~250 LoC each)
- `src/lib/db/core.ts` (1,520 LoC) -> `crates/omniroute-db/src/{pool,migrations,repo,types}.rs` (4 files, ~300 LoC each)

## 5. Adapter pattern (the central type)

```rust
// crates/omniroute-executors/src/base.rs
pub trait Executor: Send + Sync {
    fn id(&self) -> &ProviderId;
    fn capabilities(&self) -> Capabilities;
    async fn execute(&self, ctx: &RequestCtx, req: ChatRequest) -> Result<ResponseStream>;
    async fn refresh_auth(&self) -> Result<()> { Ok(()) }
}

#[derive(Clone, Debug, Default)]
pub struct Capabilities {
    pub chat: bool,
    pub embed: bool,
    pub image: bool,
    pub audio_in: bool,
    pub audio_out: bool,
    pub tool_use: bool,
    pub reasoning: bool,
    pub vision: bool,
    pub streaming: bool,
    pub websocket: bool,
}

pub trait WebExecutor: Executor {
    fn sidecar_kind(&self) -> &'static str; // "chatgpt" | "claude" | "antigravity" | ...
    async fn invoke_sidecar(&self, op: &str, payload: Value) -> Result<Value>;
}
```

The 80 concrete impls sit in `crates/omniroute-executors/src/providers/{name}.rs`. A `ProviderRegistry` is built at startup from a `providers.toml` file that lists each provider's id, executor class, default model, and capabilities. The router looks up the provider by id and dispatches.

## 6. Key public APIs / interfaces

- `omniroute` (CLI): `start | stop | status | config | doctor | db migrate | provider list | provider test | mitm on | mitm off | mcp | tproxy install | tproxy remove | tail | version | help`
- HTTP API (port 20128): unchanged, see `docs/openapi.yaml`
- MCP server: `omniroute mcp --transport stdio|sse|streamable-http --port 20128`; tools/resources/prompts match current `open-sse/mcp-server/schemas/tools.ts`
- MITM proxy: `omniroute mitm --port 8888 --capture http-proxy|tls-intercept|system-proxy`
- TPROXY (Linux): `omniroute tproxy install | remove | status`
- SDK: `omniroute-sdk-rust` (the `omniroute-core` crate re-exported), `omniroute-sdk-node` (NAPI-RS binding), `omniroute-sdk-python` (PyO3 binding), `omniroute-sdk-go` (CGO binding).

## 7. Data flow

A request hits the gateway on port 20128:

1. `axum` router matches the route (`/v1/chat/completions`, `/v1/responses`, etc.).
2. `omniroute-auth` validates the bearer token, attaches a `Principal` to the request.
3. `omniroute-policy` resolves the model alias to a `ProviderId` and a fallback chain.
4. `omniroute-translator` converts the OpenAI request shape to the target provider's shape.
5. `omniroute-executors` invokes the provider's `Executor::execute`, which returns a `ResponseStream`.
6. `omniroute-sse` (or JSON) writes the response, optionally with a `SseMerger` for fan-in.
7. `omniroute-auth` records the audit log (key id, model, tokens, cost, latency, status).
8. `omniroute-db` writes the call log row (asynchronously, batched).

For mitm, the request comes from a local agent (Cursor, Cline, Codex, Antigravity) via HTTPS. `omniroute-mitm` terminates the TLS using a per-launch self-signed CA (cached on disk), parses the request, and routes it through the same `omniroute-policy` + `omniroute-translator` + `omniroute-executors` pipeline. The agent sees an OpenAI-compatible response.

## 8. Edge cases and failure modes

- Provider auth failure (token expired) -> `omniroute-executors` triggers `refresh_auth()`, retries once, then surfaces 401 to caller.
- Provider 429 (rate limit) -> `omniroute-policy` falls back to the next provider in the chain; backoff via `governor` per-key.
- Provider 5xx -> `omniroute-policy` falls back; circuit-breaker opens for 60s after 5 consecutive 5xx.
- SSE connection drop -> the executor's `ResponseStream` is `Drop`-cancelled; the upstream request is aborted via `reqwest` abort signal.
- MITM cert install failure -> `omniroute mitm` returns the OS-specific error verbatim; the user can run `omniroute mitm install` to retry.
- SQLite WAL contention -> `omniroute-db` uses a connection pool of 4; long writes are batched.
- Browser-sidecar IPC failure -> `WebExecutor::invoke_sidecar` retries once, then surfaces 502.
- Large request body (>= 10 MB) -> streamed via `axum::body::Body::Stream`; never loaded into memory.
- Concurrent config update -> `omniroute-config` uses a `RwLock`; readers see a consistent snapshot.

## 9. Testing + acceptance criteria

- **Unit tests:** every crate has `#[cfg(test)]` blocks; target >= 80% line coverage.
- **Contract tests:** `tests/contract/` runs the full OpenAPI spec against the new binary; every response is checked for shape (not exact bytes, since some fields are timestamps/uuids).
- **Replay tests:** `tests/replay/` runs a recorded fixture from the existing TS impl (e.g. a 1,000-call sample) through the new Rust impl; diffs are checked, ignoring non-deterministic fields. The first replay test ships in v4.0; subsequent releases add more.
- **MITM tests:** `tests/mitm/` spins up a local HTTPS server with a self-signed cert, points curl at the proxy, verifies the request and response are recorded. Tests run on macOS, Linux, and Windows.
- **Load tests:** `tests/perf/` uses k6 against the new binary; p50 < 10 ms, p99 < 50 ms, 1000 req/s/core on a 2024 MacBook Pro.
- **Provider parity tests:** for each of the 30 executors shipped in v4.0, a recorded fixture runs through both the old TS impl and the new Rust impl; the response shape is compared. Acceptance: 30/30 green in v4.0.
- **OpenAPI parity:** the dashboard is run against the new binary; every page renders, every action works. Acceptance: zero dashboard regressions in the E2E smoke test.

## 10. Rollout

1. **v4.0-alpha (week 4):** internal dogfood; gateway, CLI, mitm, SSE, MCP, 30 executors. Build green on all 3 OSes. Dashboard works end-to-end via `OMNIROUTE_BACKEND=rust`.
2. **v4.0-beta (week 12):** community dogfood via opt-in; 30 executors stable; replay tests pass.
3. **v4.0 GA (week 16-20):** default backend; npm package ships the new shim + binary. Old TS backend kept as a fallback for 1 minor release (v4.1) for users who hit regressions.
4. **v4.1 (week 24-28):** add 30 more executors; perf optimizations; cost/observability dashboard; tproxy v2.
5. **v4.2 (week 32-40):** final 20 executors; full parity; deprecate the old TS backend.

## 11. Migrations / compat

- The new binary reads existing `~/.omniroute/storage.sqlite` files in WAL mode and runs the 119 migrations on first launch.
- The new binary listens on the same port (20128) by default and accepts the same env vars.
- The new binary can be installed alongside the old (`omniroute-v3` alias) for the v4.0 to v4.1 transition; after v4.1, the alias is removed.
- The npm package version is bumped to `4.0.0`; the new binary is in the `bin/runtime/<triple>/` directory; the `bin/omniroute.mjs` shim is the only one in `bin/`.
- A `omniroute v3` mode in v4.x invokes the old TS gateway via `node bin/omniroute.mjs` for one minor release, then is removed.

## 12. Open decisions (require user input)

- **D1: Rust vs Go as primary language.** Recommendation: **Rust** (see `02_LANGUAGE_COMPARISON.md`). Confirm.
- **D2: Workspace location.** Recommendation: `omniroute-v4/` as a sibling of the existing fork. Confirm.
- **D3: Provider count for v4.0.** Recommendation: **30 of 80** with feature flags for the rest. Confirm.
- **D4: Browser sidecar.** Recommendation: **Bun/Node sidecar** for the ~5 browser-only providers. Confirm.
- **D5: SDK distribution.** Recommendation: **Rust crate + NAPI-RS Node binding + PyO3 Python binding + CGO Go binding**; all in the same workspace. Confirm.
- **D6: Desktop integration.** Recommendation: keep the current `desktop-electrobun/`, `electron/`, `flutter/` apps; they call the new binary over HTTP. Confirm.

## 13. Defaults if D1-D6 are not answered

- D1 -> Rust (recommended)
- D2 -> `omniroute-v4/` sibling
- D3 -> 30/80 in v4.0, 30 in v4.1, 20 in v4.2
- D4 -> Bun sidecar for browser-only providers
- D5 -> Rust + Node + Python + Go SDKs in the same workspace
- D6 -> Keep existing desktop apps, point at the new binary

## 14. Top 3 risks (with mitigation)

1. **80 executors have hidden behavior.** Mitigation: replay harness + parity tests before each release.
2. **MITM CA install is OS-perfect.** Mitigation: test on all 3 OSes from week 1; `cert_install` API is small and well-isolated.
3. **OpenAPI parity.** Mitigation: contract test in CI; dashboard runs against the new binary in the E2E smoke test.
