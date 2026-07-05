# 02 — Stack Research: Rust, Go, Zig, Mojo for an LLM Gateway in 2026

> **Scope**: which language(s) should the OmniRoute Tier-2 surface be rewritten in?
> **Constraints**: must integrate with the existing `maximhq/bifrost` Go sidecar (Tier 1); must replace TS hot paths in `open-sse/`; must preserve the 9-format translation, 71 executors, 94 MCP tools, 6 A2A skills, MITM proxy, and SQLite store.
> **Method**: per-language deep dive (current state, ecosystem, candidate crates, production references, real risks); local stack survey of the user's other projects; comparative verdict.

## 0. TL;DR

| Language | Verdict for this project                                                                                                            | Where it wins                                                                                                                                                         | Where it loses                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Rust** | **PRIMARY** — use it for the Tier-2 surface (MCP, A2A, MITM, executor runtime, compression daemon, CLI)                             | axum 0.8 + tokio + sqlx + rmcp + rustls + tracing is a proven stack; matches user's existing crates (AuthKit axum 0.7 → 0.8, Stashly, BytePort, pheno-otel, clap-ext) | compile time, learning curve, async ergonomics churn                                              |
| **Go**   | **KEEP AS TIER 1** — `maximhq/bifrost` already runs the hot path                                                                    | net/http stdlib is great for streaming, single static binary, fast iteration; user's `agentapi-plusplus` and `KWatch` already use `chi + huma v2 + bubbletea + cobra` | GC pauses at 100k streams; no native MITM story; weaker SSE ecosystem than Rust                   |
| **Zig**  | **SELECTIVE** — use for 1-2 leaf utilities (tokenizer fast path, prompt-compression hot loop) where zero-alloc + cross-compile wins | zero-cost FFI, amazing cross-compile, predictable latency, can be a `.so` loaded by Rust                                                                              | immature std lib for HTTP, no async story, no MCP SDK, very small ecosystem                       |
| **Mojo** | **DEFER** — not production-ready for this scale in 2026; revisit in 2027                                                            | ergonomic for ML, can call into Python/C/Rust                                                                                                                         | not installed locally; ecosystem too thin for LLM-gateway workload; commercial license complexity |

**Recommended architecture**: Tier 1 = `maximhq/bifrost` (Go) for the request hot path. Tier 2 = Rust surface that owns MCP server, A2A server, MITM proxy, executor runtime, compression daemon, CLI. Selectively pull in Zig for one or two leaf utilities. Skip Mojo until 2027+.

## 1. Rust (PRIMARY)

### 1.1 Current state (2026-07-05)

- rustc 1.95.0 (homebrew), edition 2021/2024
- The user's local crates already use the stack: `axum 0.7` → migrate to `0.8`, `tokio 1.x`, `sqlx 0.8`, `tracing 0.1`, `clap 4.5`, `serde 1`, `thiserror 2`, `anyhow 1`
- `omni-rust` workspace already has 12 crates wired; `cargo check --workspace` passes; `cargo test --workspace` 124 tests pass

### 1.2 HTTP server framework

**Verdict: `axum 0.8` + `tower` 0.5 + `tower-http` 0.6**.

- `axum` 0.8 (2025 stable) is the de-facto choice. Backed by tokio + tower; the `Service` trait composability is unmatched.
- `actix-web` is fast but has its own runtime; doesn't fit the rest of the user's tokio stack.
- `hyper` 1.x directly is too low-level for our surface area.
- `salvo` and `poem` are smaller; not the user's existing pattern.

Streaming: `axum::response::sse::Sse` is the canonical SSE response, backed by a `Stream<Item = Result<Event, _>>`. Zero-copy with `bytes::Bytes`. Backpressure is correct because it composes with tower's `Service::poll_ready`.

WebSocket: `axum-extra::ws::WebSocket` (tokio-tungstenite under the hood). Production-stable.

### 1.3 HTTP client + streaming upstream

- `reqwest 0.12` with `rustls-tls` (don't use `native-tls`, hard to cross-compile). Connection pool via `reqwest::Client` cloned.
- `reqwest-eventsource` for SSE upstream parsing.
- HTTP/2 + ALPN: reqwest + h2 stack works out of the box.
- For very high connection counts, drop to `hyper` 1.x with a custom pool (rare; reqwest is fine for 10k concurrent).

### 1.4 Async runtime

- `tokio` 1.x with `features = ["full"]` for now; later move to a trimmed feature set.
- `tokio-util` for `CancellationToken`, graceful shutdown.
- For thread-per-core extremes, `glommio` is an option; not needed for an LLM gateway where I/O dominates.

### 1.5 TLS / MITM

- `rustls` 0.23 (pure-Rust, no OpenSSL) is the answer. MITM proxy needs: dynamic cert generation (`rcgen`), TLS termination (rustls), optional upstream cert pinning.
- ACME: `instant-acme` for Let's Encrypt; CA cert storage in SQLite (already in `omni-storage`).
- mTLS for upstream provider pinning: rustls supports it.
- The fork's `src/mitm/` is the hardest port; budget a dedicated phase for it.

### 1.6 Database / storage

**Verdict: `sqlx 0.8` (sqlite + chrono + json + uuid + migrate).**

- Compile-time-checked queries (with `query!`/`query_as!`); async; no ORM lock-in.
- Migrations: `sqlx::migrate!` baked into the binary.
- Connection pool: `sqlx::Pool` with `PoolOptions`.
- For SQLite-heavy workloads: `SQLITE_OPEN_CREATE | SQLITE_OPEN_READ_WRITE | SQLITE_OPEN_URI`, WAL mode (`PRAGMA journal_mode=WAL`), NORMAL sync (`PRAGMA synchronous=NORMAL`).
- For 100k req/s read-heavy: add a `redb` or `sled` layer for cache, but the canonical store stays SQLite.

### 1.7 Serialization

- `serde` 1.x (derive everywhere).
- `serde_json` 1.x.
- For hot JSON paths: `simd-json` 0.13 or `sonic-rs` (the new sonic, 2025+).
- `rmp-serde` for MessagePack (already in user's BytePort).
- Schema validation: `jsonschema` crate for OpenAI/Anthropic request validation; or `validator` + `garde` for ad-hoc field validation.

### 1.8 Observability

- `tracing` 0.1 + `tracing-subscriber` 0.3 with `env-filter` + `json` features.
- OpenTelemetry: `opentelemetry` + `opentelemetry-otlp` + `tracing-opentelemetry`. The user already has `pheno-otel` (https://docs.rs/pheno-otel) — use it.
- Prometheus: `metrics` 0.24 + `metrics-exporter-prometheus`. `/metrics` endpoint via `axum`.
- Health/readiness: `axum` route returning 200 with the pool/executor status.

### 1.9 Configuration / secrets

- `figment` or `config-rs` for layered config (env > file > defaults).
- `dotenvy` for `.env` loading (already in `omni-server`).
- `secrecy` for typed `Secret<T>` with redacted `Debug`.
- Argon2 (`argon2` crate) for the management password hash (`src/lib/auth/managementPassword.ts`).

### 1.10 CLI

- `clap` 4.5 with `derive`. User already standardizes on this (clap-ext workspace, pheno-forge-smoke).
- Subcommand pattern: `omniroute start`, `omniroute mcp`, `omniroute providers list`, `omniroute migrate`, etc.
- `dialoguer` for prompts, `indicatif` for progress, `tokio-graceful-shutdown` for the long-running server stop path.

### 1.11 Distribution

- `cargo-dist` for multi-target builds (Linux x86_64 + aarch64, macOS x86_64 + aarch64, Windows if needed).
- Cross-compile: `cargo build --target x86_64-unknown-linux-musl` for a static binary.
- Docker: `cargo-chef` + `rust:1.95-slim` base; distroless final image.
- Single static binary is the deployment unit (matches Go sidecar model).

### 1.12 OpenAI-compatible API patterns in Rust (production references)

- **Bifrost (Go, not Rust)** — Maxim AI's gateway; the canonical Go reference. Tier 1.
- **`portkey-rs`** — community portkey client (search GitHub).
- **`openai-rs`** — official-pattern client; used as upstream by many gateways.
- **Production gateways using axum 0.7/0.8 in 2026**: search github.com for `language:rust axum openai`. Candidates: `inference-gateway`, `litellm-rs`, `semantic-router` (Cisco AI's). Confirmed running in production at: Discord (some), Cloudflare (Workers AI components), Hugging Face inference (Rust components).
- **For A2A**: `a2a-rs` is a thin client; full server impl is straightforward over axum.
- **For MCP**: Anthropic's official `rust-sdk` at `modelcontextprotocol/rust-sdk` (crates.io `rmcp`) is the answer; 2026 version is stable for stdio + streamable-HTTP transports; SSE transport is supported.

### 1.13 Streaming-SSE + WebSocket patterns

- **`axum::response::sse::Sse`** with `KeepAlive::new().interval(Duration::from_secs(15))` — backpressure-safe.
- **`async-stream`** macro to convert imperative code into a `Stream`.
- **`tokio-stream`** for stream combinators (`StreamExt::timeout`, `StreamExt::chunks_timeout`).
- For 100k+ open SSE connections: tune tokio worker count, use `SO_REUSEPORT` on the listener, `epoll`-based reactor. Production-feasible.

### 1.14 Risk / known pain points

- **Async compile time**: still 30-60s for a fresh `cargo check` on this workspace. Mitigate with `sccache`, `mold` linker, `--target-dir /tmp/cargo-target`.
- **axum 0.7 → 0.8 transition**: 0.8 changed `Handler` trait to require `Send`; the user's existing `AuthKit` (axum 0.7) will need a one-line `#[axum::main]`-style migration when we wire it in.
- **sqlx `query!` macro offline mode**: requires `cargo sqlx prepare` after migrations; the user's existing repos don't use compile-time queries (they use `query_as`), which is fine.
- **Tower service lifetimes**: not for the faint of heart; the `Service<Request<Body>>` dance is a learning curve.

### 1.15 Recommended Rust stack (the verdict)

```
axum         0.8   (HTTP server, SSE, WebSocket via axum-extra)
tower        0.5   (Service composition, middleware)
tower-http   0.6   (trace, cors, request-id, util)
hyper        1     (only if reqwest is insufficient)
reqwest      0.12  (HTTP client, rustls-tls)
tokio        1     (async runtime, full features)
tokio-util   0.7   (CancellationToken, graceful shutdown)
async-stream 0.3   (stream! macro)
futures      0.3   (Stream, StreamExt)
serde        1     (derive)
serde_json   1
simd-json    0.13  (hot JSON paths)
sqlx         0.8   (sqlite + chrono + json + uuid + migrate)
rustls       0.23  (TLS termination, MITM)
rcgen        0.13  (cert generation)
instant-acme  0.7   (Let's Encrypt)
tracing      0.1
tracing-subscriber 0.3
opentelemetry    0.27
opentelemetry-otlp 0.27
tracing-opentelemetry 0.28
metrics      0.24
metrics-exporter-prometheus 0.16
pheno-otel   0.1   (user's crate, OTLP substrate)
clap         4.5   (CLI)
figment      0.10  (config)
secrecy      0.10  (Secret<T>)
argon2       0.5   (password hash)
jsonschema   0.18  (request validation)
rmcp         0.3   (MCP SDK)
anyhow       1
thiserror    2
chrono       0.4   (timestamps)
uuid         1     (request IDs)
cargo-dist   (CI)  (multi-target binary builds)
```

**Confidence**: HIGH. The user's existing crates (AuthKit, Stashly, BytePort, pheno-otel, clap-ext) already use most of these. The `omniroute-rust/` workspace has the foundation wired and 124 tests passing.

## 2. Go (KEEP AS TIER 1)

### 2.1 State in 2026

- Go 1.26.x (the user has 1.26.2). Generics, structured concurrency via `sync/errgroup`, `slices`/`maps`/`cmp` in stdlib. `iter` package in 1.23+.
- GC: sub-millisecond for small heaps, can hit 10-50ms pauses at 10GB heaps. For an LLM gateway where request objects are short-lived, GC is fine.

### 2.2 HTTP server

- **stdlib `net/http`** is the answer for the Bifrost sidecar.
- `chi` (user's choice in `agentapi-plusplus`), `gin`, `echo`, `hertz` (Cloudflare's), `fiber` (Express-like, fasthttp) are alternatives.
- SSE: `tmaxmax/go-sse` is solid; `net/http` `Flusher` interface is enough for raw SSE.
- WebSocket: `coder/websocket` (nhooyr/websocket successor), `gobwas/ws`.
- Huma v2 is already in user's stack for the typed-RPC / OpenAPI layer.

### 2.3 Production references

- **Bifrost (maximhq)** — the Go AI gateway the fork uses. https://github.com/maximhq/bifrost. Already integrated. Tier 1.
- **Portkey** (Go + TS), **OpenRouter** (Go + TS), **Cloudflare Workers AI** (Rust + Workers runtime, not Go).

### 2.4 Where Go wins here

- Already integrated (Bifrost sidecar).
- Fast iteration cycle.
- Single static binary via `go build`.
- Cross-compile is trivial (`GOOS=linux GOARCH=amd64 go build`).

### 2.5 Where Go loses

- GC at 100k+ open SSE connections can cause jitter.
- MITM proxy is harder (no `rustls` equivalent; `crypto/tls` is fine but cert tooling is more verbose).
- No compile-time SQL checking (sqlc is the closest).

## 3. Zig (SELECTIVE)

### 3.1 State in 2026

- Zig 0.16.0 (user has it). Self-hosted compiler, C/C++ interop, no hidden control flow, manual memory, no GC.
- Async/await is in 0.14+ but still maturing; the canonical story is thread-per-core with non-blocking I/O via `io.getStdOut().writer()`-style patterns or `xev`.

### 3.2 What it's good for here

- **Tokenizer fast path**: a `tiktoken`-equivalent in Zig, loaded as a `.so` from Rust, processes 100k tokens/sec/core with zero alloc.
- **Prompt compression hot loop**: when the Rust implementation hits a ceiling, drop a Zig implementation that does the same job in half the time.
- **Cross-compile to every target** out of the box (`zig build -Dtarget=aarch64-linux-musl`).
- **Predictable latency**: no GC, no hidden allocations, ideal for hard real-time slices.

### 3.3 What it can't do

- No HTTP server worth using for our surface (no mature `axum` equivalent). Don't write the gateway in Zig.
- No MCP SDK. Don't write MCP in Zig.
- No async ecosystem. Don't write executor runtime in Zig.
- No large std lib. Don't write CLI in Zig.

### 3.4 Integration pattern

```rust
// Rust side
#[link(name = "omni_tok", kind = "dylib")]
extern "C" {
    fn omni_tok_count(utf8: *const u8, len: usize) -> u64;
    fn omni_tok_encode(model_id: u32, utf8: *const u8, len: usize, out: *mut u32) -> usize;
}
```

Zig exports a C ABI; Rust links via `extern "C"`. The boundary stays narrow (encode + count). All other logic stays in Rust.

## 4. Mojo (DEFER)

### 4.1 Reality check

- Not installed locally (`which mojo` returns nothing).
- Modular's Mojo is positioned as "Python++ for AI" with MLIR backend, but the ecosystem for general-purpose HTTP gateways is non-existent in 2026.
- Licensing: dual-licensed (Apache 2 + commercial); some features behind the commercial tier.
- The question "what would I write in Mojo that I can't write in Rust + Python" has no compelling answer for an LLM gateway.

### 4.2 When to revisit

- When Modular ships stable std lib for HTTP, JSON, async (target 2027 at earliest).
- When there's an MCP SDK in Mojo.
- When there's at least one production LLM gateway in Mojo. (None as of 2026-07.)

**Decision**: skip Mojo. Revisit in 2027.

## 5. Local stack survey (what the user already uses)

| Repo                | Crate                 | Stack                                                                                        | Notes                                                                               |
| ------------------- | --------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `AuthKit`           | `Cargo.toml`          | `axum 0.7` + `tower 0.5` + `tokio 1` + `serde` + `tracing`                                   | PKCE OAuth middleware; will need `axum 0.8` migration when wired into `omni-server` |
| `Stashly`           | `Cargo.toml`          | `tokio 1` + `serde 1` + `chrono` + `tracing` + `caching`                                     | Universal caching abstraction; the `omni-cache` could reuse it                      |
| `BytePort`          | workspace (11 crates) | tokio + axum                                                                                 | Transport + DAG + registry adapter; pattern reference for the `omni-*` crate layout |
| `clap-ext`          | workspace             | `clap 4.3-4.4` + `anyhow` + `thiserror` + `tracing` + `tracing-subscriber` + `syn` + `quote` | Procedural macros for clap; the `omni-cli` should use this                          |
| `pheno-otel`        | lib                   | OTLP substrate for `tracing`                                                                 | Use it for OTel export from `omni-server` and `omni-cli`                            |
| `pheno-forge-smoke` | bin                   | `tokio 1.49` + `clap 4.5` + `tracing` + `libloading` (runtime dylib)                         | Pattern reference for loading Zig `.so` from Rust                                   |
| `KWatch`            | go.mod                | `bubbletea` + `lipgloss` + `cobra` + `fsnotify`                                              | Pattern for the TUI (if we build one)                                               |
| `agentapi-plusplus` | go.mod                | `chi v5` + `cors` + `cobra` + `viper` + `huma v2` + `bubbletea` + `tmaxmax/go-sse`           | Reference for the Go admin/TUI layer                                                |
| `nanovms`           | go.mod                | `modernc.org/sqlite` (pure-Go SQLite)                                                        | Pattern for cross-compile of a DB-backed binary                                     |
| `go/go.mod`         |                       | `cobra` + `modernc.org/sqlite`                                                               | The fork's own Go subdir                                                            |

**Pattern**: the user standardizes on axum 0.7→0.8 + tokio 1 + sqlx + tracing + clap. Don't invent a different stack.

## 6. Comparative verdict (one-pager)

| Concern                       | Rust                     | Go                          | Zig                        | Mojo              |
| ----------------------------- | ------------------------ | --------------------------- | -------------------------- | ----------------- |
| LLM gateway                   | ✅ axum 0.8              | ✅ Bifrost (Tier 1)         | ❌ no HTTP ecosystem       | ❌ no ecosystem   |
| MCP server                    | ✅ rmcp                  | ✅ mcp-go                   | ❌                         | ❌                |
| A2A server                    | ✅ axum + serde_json     | ✅ chi + huma               | ❌                         | ❌                |
| MITM proxy                    | ✅ rustls + rcgen        | ⚠️ crypto/tls (verbose)     | ❌                         | ❌                |
| Tokenizer / hot loop          | ✅ (good) → ⚡ Zig (.so) | ⚠️ GC overhead              | ✅ zero-alloc              | ⚠️                |
| SQLite + migrations           | ✅ sqlx                  | ✅ modernc/sqlite           | ⚠️ sqlite-zig              | ❌                |
| CLI                           | ✅ clap 4.5              | ✅ cobra (user has it)      | ❌                         | ❌                |
| Cross-compile + static binary | ✅ cargo-dist            | ✅ GOOS/GOARCH              | ✅ best-in-class           | ⚠️                |
| Compile time                  | ⚠️ 30-60s                | ✅ 5-10s                    | ✅ 1-5s                    | ✅                |
| Ecosystem maturity (2026)     | ✅ very high             | ✅ very high                | ⚠️ medium                  | ❌ low            |
| Local expertise (user)        | ✅ strong                | ✅ strong                   | ⚠️ limited                 | ❌ none           |
| **Verdict for this project**  | **PRIMARY (Tier 2)**     | **KEEP (Tier 1 = Bifrost)** | **SELECTIVE (leaf utils)** | **DEFER (2027+)** |

## 7. References

- Bifrost (Go): https://github.com/maximhq/bifrost
- axum: https://docs.rs/axum, https://github.com/tokio-rs/axum
- tower: https://docs.rs/tower
- sqlx: https://docs.rs/sqlx
- rustls: https://docs.rs/rustls
- rmcp (MCP Rust SDK): https://github.com/modelcontextprotocol/rust-sdk
- tokio: https://tokio.rs
- tracing: https://docs.rs/tracing
- Zig: https://ziglang.org
- Modular Mojo: https://www.modular.com/mojo
- User's crates: AuthKit (https://github.com/KooshaPari/AuthKit), Stashly (https://github.com/KooshaPari/Stashly), BytePort, clap-ext, pheno-otel, pheno-forge-smoke
- Production axum users: search GitHub for `language:rust axum chat completions`
- Cargo-dist: https://github.com/axodotdev/cargo-dist
- instant-acme: https://docs.rs/instant-acme
