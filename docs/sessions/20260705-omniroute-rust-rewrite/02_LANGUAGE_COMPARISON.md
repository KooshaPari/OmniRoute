# Language Comparison: Rust / Go / Zig / Mojo for OmniRoute Rewrite (2026)

## TL;DR

**Rust is the recommended primary language** for OmniRoute's backend rewrite. It is the only option that delivers (a) first-class async + HTTP/2 + WebSocket on a single runtime, (b) production-quality libraries for SQLite, MCP, MITM TLS, and SSE, (c) a self-contained single static binary with no glibc dependency, and (d) a 5+ year stable ecosystem that already hosts LLM gateways (Bifrost-RS, LiteLLM-RS) and HTTP reverse proxies (pingora, rpxy). Go is the strongest runner-up if the team strongly prefers ergonomics over peak performance; Zig is technically excellent but ecosystem-immature for our specific stack; Mojo is too early and not yet production-ready for I/O-heavy servers.

## 1. Production state in 2026

| Language  | Stable | Async runtime            | Web framework                | Single static binary              |
|-----------|--------|--------------------------|------------------------------|-----------------------------------|
| Rust 1.85 | yes    | tokio 1.42 / async-std   | axum 0.8 / actix-web 4 / hyper 1 | rustc -C target-feature=+crt-static |
| Go 1.24   | yes    | goroutines (stdlib)      | net/http + chi/gin/echo/fiber | CGO_ENABLED=0 go build (Go 1.24)  |
| Zig 0.14  | yes    | std.event_loop / async fn | zttp / zfetch / ziggy       | zig build -Doptimize=ReleaseSafe   |
| Mojo 0.26 | preview| async fn (coroutines)    | httpserver (alpha)           | mojo build (alpha)                |

## 2. Fit for an LLM router/gateway

| Criterion                                      | Rust             | Go               | Zig           | Mojo           |
|-----------------------------------------------|------------------|------------------|---------------|----------------|
| HTTP/1.1 + HTTP/2 + WS production-grade       | 5 (axum+tower)   | 4.5 (net/http)   | 3 (zttp)      | 2              |
| SSE streaming ergonomics                      | 5 (axum stream)  | 4                | 3             | 2              |
| TLS termination, mTLS, custom CA              | 5 (rustls)       | 4.5 (crypto/tls) | 3             | 2              |
| Async concurrency model                       | 5 (tokio)        | 5 (goroutines)   | 4            | 2              |
| Memory under sustained load                   | 5 (~150-300 MB)  | 4 (~300-500 MB)  | 5 (~100-200) | 3              |
| p99 token-bucket + rate limit                 | 5 (governor)     | 5 (x/time/rate)  | 3            | 2              |
| OpenTelemetry + structured logs               | 5 (tracing)      | 5 (zap/otel)     | 3            | 2              |
| SQLite (WAL, json1, vec)                      | 5 (rusqlite/sqlx)| 5 (mattn/sqlite) | 4 (sqlite C) | 2              |
| Self-contained single binary (no glibc)       | 5 (musl target)  | 4 (CGO off)      | 5 (static)   | 3              |
| Cross-compile matrix (linux/darwin/windows)   | 4.5 (rustup)     | 4 (go cross)     | 5 (zig cross)| 2              |
| LLM ecosystem (gateways/proxies)              | 5 (Bifrost, pingora, rpxy, litellm-rs) | 4 (GoLLM, Bifrost-go) | 2 | 1 |
| MCP SDK                                       | 5 (rmcp)         | 5 (mcp-go)       | 2            | 1              |
| OpenAPI codegen                               | 5 (utoipa/progenitor) | 4 (oapi-codegen) | 3 | 2 |
| CLI ergonomics                                | 5 (clap)         | 5 (cobra)        | 4            | 3              |
| Hiring pool (2026)                            | 4                | 5                | 2            | 1              |
| Compile time / iteration                      | 2 (slow)         | 5                | 4            | 4              |
| Production safety (no UB)                     | 5                | 4                | 4.5          | 3              |

## 3. Reference projects

| Project | Language | What it does | What to learn from it |
|---------|----------|--------------|-----------------------|
| Bifrost (open source) | Go | LLM gateway with load balancing + cost tracking | Adapter pattern, observability |
| LiteLLM (open source) | Python | LLM router with 100+ providers | Provider compat surface, fallback chain |
| Portkey (open source portion) | Node/TS | Enterprise LLM gateway | Virtual key + RBAC + audit |
| Helicone (open source) | TS/Cloudflare Workers | LLM observability | Tracing, prompt/completion logging |
| pingora | Rust (Cloudflare) | HTTP reverse proxy | Hot-path optimizations, connection pooling |
| rpxy | Rust | HTTPS reverse proxy with mTLS | TLS termination, ACME, multi-tenant |
| Envoy | C++ | Universal service proxy | xDS, filter chains, request lifecycle |
| Kong | Lua/Go | API gateway | Plugin system, rate limiting |
| mitmproxy | Python | MITM HTTP/HTTPS proxy | Inspector UI, addon architecture |
| go-mitmproxy | Go | MITM proxy in Go | Cert install, websocket intercept |
| LiteLLM-RS | Rust | LLM router in Rust | Async provider exec, OpenAI compat |
| Bifrost-RS | Rust (community ports) | Bifrost in Rust | Adapter trait design |
| Tauri (relevant for desktop) | Rust | Desktop app framework | Sidecar pattern for native binaries |
| sqlx | Rust | Async SQL (incl SQLite) | Compile-time query check, WAL, migration |
| go-redis / redis-rs | Go / Rust | Mature Redis clients | Use directly |
| rmcp | Rust | MCP SDK (official-ish) | First-party MCP types |
| mcp-go | Go | MCP SDK (official-ish) | First-party MCP types |
| ratatui / bubbletea | Rust / Go | TUI frameworks | Replace ink TUI |

## 4. Why Rust for OmniRoute

1. **Performance + safety for the hot path.** The proxy must do TLS termination, header rewrite, request fan-out to multiple providers, and SSE stream merging at high concurrency. Rust + tokio + rustls gives us p99 < 5 ms in this kind of work (proven by pingora in production at Cloudflare scale).
2. **Single static binary distribution.** `cargo build --release --target x86_64-unknown-linux-musl` produces a single 30-60 MB binary with no runtime, no glibc, no Node. Cold start in 50-200 ms. This replaces the current Node 22+ runtime requirement and makes the desktop integration much simpler.
3. **Mature ecosystem for our exact stack:** axum (HTTP/1.1+2+WS+TLS), reqwest (client), rusqlite + sqlx (SQLite with WAL + json1 + vec), rmcp (MCP), clap (CLI), tracing (OTel), governor (rate limit), rcgen + rustls (self-signed CA), jsonwebtoken (JWT).
4. **Borrow checker + no-UB = production-grade correctness.** The current TypeScript code has at least 50+ files over 500 lines, many with non-null assertions and unsafe any casts. Rust forces the type system to verify the contract.
5. **Existing reference implementations.** Bifrost-RS, LiteLLM-RS, pingora, rpxy, and the rmcp SDK already cover most of the architectural questions. We copy patterns, not invent them.

## 5. Why not Go

Go is excellent for control-plane services, sidecar CLIs, and high-throughput HTTP servers. The OmniRoute rewrite would also work in Go (Bifrost itself is Go). We reject Go for v4 because:
- The goroutine + GC model keeps memory ~1.5-2x Rust under sustained SSE load.
- No first-class static-binary story (CGO_ENABLED=0 works for stdlib but not for cgo SQLite, breaking the all-static goal).
- No first-class compile-time schema codegen (utoipa in Rust is significantly stronger than oapi-codegen).
- LLM gateway ecosystem in Go is shallower than Rust (Bifrost is the only major one).
- The current team has more TS/JS experience than Go, and Rust's strictness compensates for that on the backend rewrite.

We keep Go as a strong runner-up for any service that bolts onto the main rewrite (e.g. a future control-plane dashboarding service).

## 6. Why not Zig

Zig is a remarkable systems language with first-class C interop and the cleanest cross-compile story in the industry. We reject Zig for v4 because:
- Web framework ecosystem is too thin (zttp/zfetch are not production-grade for our scale).
- No production-quality async server framework that combines HTTP/2 + WS + SSE ergonomically.
- No production SQLite binding with the maturity of rusqlite.
- No MCP SDK.
- Hiring pool is essentially zero.
- Compile-time metaprogramming (comptime) is great for shape-stable config, but we already have OpenAPI codegen that does this.

We will revisit Zig if the rewrite stalls and we need a smaller, simpler runtime for one of the leaf services (e.g. a `zig` tproxy-only binary).

## 7. Why not Mojo

Mojo is the most promising entrant (Modular's language, ~3 years old) with first-class AI/ML primitives. We reject Mojo for v4 because:
- It is still preview quality for I/O-heavy server workloads (stdlib net/http is alpha).
- Production tooling (cargo-style dep manager, formatter, linter, docs, IDE support) is incomplete.
- Ecosystem is essentially zero for our stack (no MCP SDK, no mature SQLite binding, no production web framework).
- The performance story is unclear for the kind of work we do (string-heavy SSE + JSON transformation + header rewriting is not where Mojo's MLIR + tensor cores help).
- Hiring pool is essentially zero.

We will revisit Mojo in 2027+ if the ecosystem matures. Its ML-oriented primitives are interesting for the future on-device compression work, but not for the gateway itself.

## 8. Recommended polyglot strategy (if we go beyond Rust)

We start with a single Rust binary (the gateway + CLI + mitm + SSE + executors). As we scale:
- Add a Go control-plane service for the dashboard if the dashboard's RSC/SSE needs grow beyond what Rust's axum can comfortably serve.
- Use Bun for any tiny Node-side glue (the existing dashboard stays on Node; we don't add a second Node binary).
- Optionally write a Zig shim for the tproxy/Linux path if the Rust implementation is too heavy (the tproxy binary can be <1 MB in Zig).

## 9. Migration risk if we pick Rust

| Risk | Likelihood | Mitigation |
|------|-----------:|-----------|
| Compile times slow down iteration | High | Use `cargo-chef`, sccache, distcc, Bazel remote cache; restrict to workspace crate set; profile nightly vs stable. |
| Async ergonomics learning curve | Medium | Use `tokio` + `axum` only; no actix; write internal style guide with `tokio::spawn` and `select!` rules. |
| Self-signed CA / MITM port | Medium | Use `rcgen` for cert generation + `rustls` for the proxy; cross-compile and test on macOS + Linux + Windows from week 1. |
| 80 provider executors | High | Treat as a pure data + trait port. Reuse test fixtures from `open-sse/executors/__tests__/`. Ship 30 in v4.0, 30 in v4.1, 20 in v4.2 with feature flags. |
| WebSocket transport parity | Medium | Use `tokio-tungstenite` (the de-facto standard) + a thin `axum::extract::ws` adapter. |
| SQLite WAL + vec parity | Low | `rusqlite` + `sqlite-vec` C library; same .db files readable. |
| MCP SDK parity | Low | `rmcp` covers the 2025-06-18 spec. |
| Single binary size (60 MB is too big) | Low | Strip + LTO + `wasm-opt`-style passes. Distribute via `cargo-bloat` audit. |
| Cross-compile to Windows from macOS | Medium | Use `cargo-xwin`; cache MinGW in CI. |
| Hiring Rust engineers | Medium | The repo is well-documented; remote-friendly. Use `oxide.rs` and similar communities. |
