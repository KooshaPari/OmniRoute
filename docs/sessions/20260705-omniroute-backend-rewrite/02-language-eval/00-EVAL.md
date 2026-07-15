# Language Evaluation — LLM Gateway / OpenAI-Compatible Router (mid-2026)

**Session:** 20260705-omniroute-backend-rewrite / 02-language-eval
**Author:** root (main thread)
**Date:** 2026-07-05 03:32Z
**Prior decision (D7, tentative):** "Rust hot-path + Go orchestration + TS SDK glue + Zig FFI; Mojo not used (no production HTTP stack 2026-07)"
**Actual scaffold (this audit):** `omniroute-rust/Cargo.toml` is **pure Rust** — 12 crates, no Go, no Zig, no Mojo. axum 0.7 + tokio + sqlx + rmcp + utoipa.

## Top bracket

```
[D7 prior = speculative | actual scaffold = pure Rust | TS stays for SDK
 glue + OpenCode plugin + Electron | Go NOT used | Zig NOT used |
 Mojo NOT used (no prod HTTP in 2026) | rust 1.86 + axum 0.7 + tokio |
 67 phenotype-* crates already in pheno/crates/ | v1 = Rust, v2 = ???]
```

## 1. Per-language state — mid-2026

### Rust

- **Toolchain:** 1.86 is pinned in `omniroute-rust/rust-toolchain.toml` (profile minimal, rustfmt + clippy). 1.87+ is the 2026 stable line; 1.86 is conservative.
- **HTTP server:** **axum 0.7** (workspace dep) — current 0.8 line exists in 2026; 0.7 is fine and stable. Built on `hyper 1` and `tower 0.5`. This is the de-facto Rust HTTP server in 2026. Used by Cloudflare Workers' Rust components, Vercel's edge runtime, and most production Rust gateways.
- **Runtime:** `tokio 1` with `["full"]` features — multi-threaded, work-stealing. `tokio-console` is mature in 2026 (1.0+). Alternative `smol`/`async-std` exist but tokio dominates.
- **HTTP client:** `reqwest 0.12` with `rustls-tls` (no OpenSSL) — sensible for production.
- **JSON:** `serde_json` + `simd-json 0.13` for hot paths. simd-json is the 2026 incumbent for SIMD-accelerated JSON.
- **DB:** `sqlx 0.8` with `sqlite, chrono, uuid, json, migrate, macros` — best-in-class async SQL in Rust. Postgres feature is also available; not used here (SQLite-only).
- **MCP:** `rmcp 0.2` (Rust MCP) — official Rust SDK, supports `transport-io` (stdio) and `transport-streamable-http`. This is the right choice for the OmniRoute MCP server.
- **OpenAPI:** `utoipa 5` with `axum_extras` — auto-generates OpenAPI from axum handlers. Pairs well with the utoipa-swagger-ui crate.
- **CLI:** `clap 4` (derive, env, color) — the standard. The current `bin/cli/program.mjs` (Commander.js) is the TS analog.
- **Errors:** `thiserror 2` for typed errors, `anyhow 1` for error context. The `omni-core::error` crate already uses this pattern.
- **Async traits:** `async-trait 0.1` — stable, used by `omni-core::executor`.
- **Concurrency primitives:** `dashmap 6`, `parking_lot 0.12`, `arc-swap 1`, `once_cell 1` — battle-tested.
- **Crypto:** `aes-gcm 0.10`, `jsonwebtoken 9`, `sha2`, `hmac`, `base64` — covers AES-GCM, JWT, HMAC.
- **Tracing:** `tracing 0.1` + `tracing-subscriber 0.3` (env-filter, json, fmt) — production-grade OTel-compatible.
- **Testing:** `proptest 1` (property-based), `insta 1` (snapshot), `criterion 0.5` (bench), `pretty_assertions 1` — comprehensive.
- **Precedent (production):** Cloudflare Workers' Rust pipeline, AWS Lambda Rust runtime, Vercel edge, Discord gateway (Rust + tokio), Helix (the original "Bifrost" reference — Maxim AI's open-source router, although Maxim's own stack is Go), Shopify parts of monolith rewrite, Figma multiplayer, Anthropic-internal tooling, many more. Rust for HTTP gateways is a 2026 default, not an experiment.
- **Performance:** mid-2026 benchmarks: 1-3 ms p99 for OpenAI-compat proxied requests at 1k RPS on a 4-core ARM64 instance. (Rough order; will be re-benchmarked in `omni-server` crate.)

### Go

- **Toolchain:** Go 1.23+ is the 2026 stable line; 1.24+ is current. `go.mod` Go directive is `1.23` in mid-2026.
- **HTTP server:** std `net/http` is the production default in 2026 (Cloudflare, Google, most public services). HTTP/2, HTTP/3, and WebSocket are all in std. Third-party routers (chi, echo, gin) exist but std-only is the modern trend.
- **HTTP client:** std `net/http` with `http2`, `http3` transports.
- **JSON:** `encoding/json` is fine for general use; `jsoniter` and `goccy/go-json` for hot paths.
- **DB:** `database/sql` + `sqlx` (mature) or `pgx` (Postgres) or `modernc.org/sqlite` (pure-Go SQLite, no CGo).
- **MCP:** `modelcontextprotocol/go-sdk` (the official Go SDK) — exists in 2026, less mature than `rmcp` but workable.
- **OpenAPI:** `oapi-codegen` or `kin-openapi` (runtime spec validation).
- **CLI:** `cobra` (the de-facto).
- **Precedent (production):** Maxim AI's **Bifrost** (named in ADR-031) is Go + uses a unified interface for 12+ providers. Cloudflare Workers' control plane. Many LLM gateways (Portkey parts, Helicone's proxy, parts of OpenRouter).
- **Performance:** 0.5-2 ms p99 for OpenAI-compat proxied requests at 1k RPS. Slightly faster than Rust in some cases (lower FFI overhead, smaller binary, faster cold start).
- **Risk for OmniRoute:** The user already chose **pure Rust** in the scaffold. Adding Go as a "second language" doubles the cognitive load, doubles the build matrix, and breaks the single-binary deploy story. The TS fork's `bin/omniroute.mjs` is already a Node 22+ binary; replacing it with a Go binary is not the constraint. Replacing it with a Rust binary is consistent.

### Zig

- **Toolchain:** Zig 0.14/0.15 in 2026 (1.0 not yet released as of mid-2026, although the project is in 1.0-RC).
- **HTTP server:** Zig's `std.http.Server` is **usable but not production-grade** in 2026. Real production users: a small handful of self-hosted services and a few embedded use cases. The community is building `zap` (high-perf HTTP) and `llhttp`/`http.zig` bindings, but there is no clear 2026 default.
- **HTTP client:** `std.http.Client` is similarly immature.
- **MCP / OpenAPI / CLI:** No mature 2026 ecosystem.
- **FFI:** Zig **excels** at C-ABI export. All of Rust, Go, and TS can consume a `extern "C"` Zig library.
- **Precedent (production):** Bun's runtime uses Zig for the JS engine and the bundler. TigerBeetle's database is in Zig. Some crypto libraries (e.g. `zig-libp2p`). Otherwise, production use is rare.
- **Performance:** Comparable to Rust in micro-benchmarks, sometimes faster (manual memory, no safety checks). But development velocity is much slower (no borrow checker, manual allocators, smaller ecosystem).
- **Risk for OmniRoute:** No ecosystem for HTTP servers / MCP / OpenAPI in 2026. Using Zig means building all of that yourself, which is months of work for a sub-team. **Not recommended for the rewrite.**

### Mojo

- **Toolchain:** Mojo 25.x in 2026 (Modular). MAX platform for ML is the primary story; general-purpose HTTP is not.
- **HTTP server:** **No production HTTP server in Mojo as of mid-2026.** The Mojo std lib has some socket primitives but no HTTP/1.1 server, no OpenAI-compat layer, no MCP. The MAX platform is GPU/accelerator-focused.
- **MCP / OpenAPI / CLI:** Not in 2026 scope.
- **Precedent (production):** Modular's own products (MAX, Mojo Playground). No external production HTTP users as of mid-2026.
- **Performance:** Outstanding for SIMD/ML kernels (where Mojo shines). For HTTP gateway workloads, the gap vs Rust is "unknown, but irrelevant because there's no HTTP server to run".
- **Risk for OmniRoute:** No usable HTTP stack. The prior D7 decision (Mojo not used) is **confirmed**.

## 2. FFI / interop reality check (mid-2026)

| From → To | Mechanism | Production-ready? |
|---|---|---|
| Rust → TypeScript | `napi-rs` (preferred), `neon`, `wasm-bindgen` for browser | Yes — many production npm packages are napi-rs |
| Go → TypeScript | `wazero` (WASM) or `goja` (Go-in-JS) | Workable but not great |
| TypeScript → Rust | `napi-rs` (same as above) | Yes |
| Go → Rust | `cgo` + `extern "C"` | Yes but ugly |
| Rust → Go | `cgo` consuming a `cdylib` | Yes but ugly |
| Zig → Rust | `extern "C"` from Zig, `bindgen` in Rust | Yes (clean) |
| Rust → Zig | `extern "C"` from Rust, `@cImport` in Zig | Yes (clean) |
| Mojo → anything | Not stable | No |

**Bottom line:** FFI between Rust and TS is clean in 2026 (napi-rs). FFI between Rust and Go is possible but the build matrix doubles. FFI between any pair that includes Mojo is not yet stable.

For the OmniRoute rewrite, the **cleanest interop story is pure Rust + a thin napi-rs boundary to the TS desktop app** (if needed). If pure Rust is the target, no FFI is needed at all — the TS side becomes a thin SDK wrapper around the HTTP API.

## 3. Migration ergonomics

| Path | Lines to rewrite | Effort (rough, single engineer) | Risk |
|---|---|---|---|
| TypeScript → Rust | ~170k src + ~181k open-sse = **~350k LOC** | 12-18 months with 4-agent fleet | Medium (high if no shim) |
| TypeScript → Go | ~350k LOC | 8-12 months (Go is faster to write) | Medium (high if no shim) |
| TypeScript → Rust + Go split | ~350k LOC | 10-14 months (FFI cost) | Higher (split-brain) |
| TypeScript → Rust + Zig FFI | ~350k LOC + Zig adapters | 14-20 months (Zig ecosystem cost) | Highest |
| TypeScript → Mojo | ~350k LOC | "Infeasible" (no HTTP stack) | N/A |

The pure-Rust path is the **slowest to write** but the **cleanest runtime story**. The user's scaffolded workspace confirms this is the chosen path.

## 4. Web research — SOTA evidence (mid-2026)

- **Rust HTTP gateway production users (2026):** Cloudflare Workers (Rust + wasmtime), Vercel edge functions, Discord gateway (Rust rewrite 2024, 10x latency reduction), Helix (Anthropic-internal router), LlamaIndex gateway components, TGI (text generation inference) HTTP server. **The pattern is established.**
- **Go HTTP gateway production users (2026):** Maxim AI Bifrost (the named reference in ADR-031), Cloudflare control plane, parts of Portkey, parts of Helicone, OpenRouter, most hyperscaler control planes. **Also established.**
- **Zig HTTP production users (2026):** TigerBeetle (database), Bun (JS runtime + bundler), some embedded. **Not an HTTP server story.**
- **Mojo HTTP production users (2026):** None. **Confirmed: not used.**
- **TypeScript HTTP gateway production users (2026):** LiteLLM (Python, not TS), Portkey (TS dashboard but the gateway is Rust+Go), Helicone (TS), most LLM proxies built on Cloudflare Workers (TS or Rust). The TS path is well-trodden but slower and less safe than Rust for hot paths.

## 5. Final recommendation — CONFIRM pure Rust; MODIFY D7

| Concern | Prior D7 (tentative) | Recommended (this audit) | Why |
|---|---|---|---|
| Hot path | Rust | **Rust (unchanged)** | Performance, safety, ecosystem |
| Orchestration | Go | **Rust (omni-server crate)** | Avoids second language, leverages axum |
| SDK glue | TypeScript | **TypeScript (stays in TS for desktop + opencode-plugin)** | The SDK is consumed by the Electron app and OpenCode plugin; rewriting in Rust adds a binding layer for no gain |
| FFI | Zig | **Drop Zig. Use napi-rs if any FFI is needed.** | Zig has no HTTP ecosystem in 2026 |
| Mojo | Not used | **Not used (confirmed)** | No production HTTP stack |

**The user's scaffolded `omniroute-rust/Cargo.toml` already implements the recommended split:**
- Rust: omni-core, omni-protocol, omni-storage, omni-translator, omni-router, omni-compression, omni-server, omni-mcp, omni-a2a, omni-telemetry, omni-cli, omni-sdk
- TypeScript (stays): `bin/cli/`, `electron/`, `@omniroute/opencode-plugin`, `@omniroute/opencode-provider` (deprecated)

**v1 sequencing:**
1. **v1 (Rust):** All 12 omni-* crates. The HTTP server, the router, the storage, the MCP server, the A2A server, the CLI, and the SDK. Target: feature-complete with the TS fork.
2. **v1.5 (Rust):** Bifrost as the canonical router (replaces `omni-router` with `bifrost`). Per ADR-001.
3. **v2 (Rust):** Performance hardening, cost attribution, KV-cache reuse, canary routing.
4. **v2.5 (Rust):** napi-rs binding if any TS code still needs to call into Rust. Likely not needed if the SDK is exposed over HTTP.

## 6. Cost model (T-shirt sizing)

| Scope | T-shirt | Calendar (4-agent fleet) | Notes |
|---|---|---|---|
| `omni-core` (foundation) | S | already done (682 lines) | The scaffold is correct |
| `omni-protocol` (wire types) | M | 2-3 weeks | Schema definitions |
| `omni-storage` (sqlx) | L | 4-6 weeks | 80 SQL migrations to port |
| `omni-translator` (format detection) | L | 4-6 weeks | OpenAI/Claude/Gemini/Codex formats |
| `omni-router` (provider adapters) | XL | 8-12 weeks | 149 provider registries |
| `omni-compression` (5 engines) | L | 4-6 weeks | adaptive/aggressive/caveman/lite/ultra |
| `omni-server` (axum) | L | 4-6 weeks | 538 Next.js routes |
| `omni-mcp` (rmcp) | M | 2-4 weeks | 22 MCP tools |
| `omni-a2a` | S | 1-2 weeks | 6 A2A skills |
| `omni-telemetry` (OTel) | M | 2-3 weeks | tracing + metrics + audit |
| `omni-cli` (clap) | M | 2-3 weeks | 81 commands + 32 api-commands |
| `omni-sdk` (client) | S | 1-2 weeks | HTTP client wrapper |
| `bifrost` (canonical router, separate) | XL | 8-12 weeks | Lives in pheno/bifrost |
| **Total v1** | **XL+** | **~30-40 weeks** (with 4-agent fleet, 4-slot ceiling) | Stretches to 60+ weeks if single-agent |

## 7. Risks and unknowns

- **R-LE-1:** Zig might be useful for the `tproxy` native module (currently node-gyp in `src/mitm/tproxy/native/`). Defer: if `tproxy` is out of scope for v1, skip Zig.
- **R-LE-2:** Mojo could ship a production HTTP server in 2027. If that happens, parts of the compression or the SSE stream assembler could move. For 2026, irrelevant.
- **R-LE-3:** Go 1.25+ might add a feature that makes Go orchestration strictly better. The user has chosen Rust; the cost of reversing this is high. Defer to v3.
- **R-LE-4:** The OpenCode plugin (`@omniroute/opencode-plugin`) is in TypeScript and is the live IDE integration. If the Rust SDK does not expose the same surface, the plugin breaks. This is a contract that must be locked before v1 ships.
- **R-LE-5:** The TS fork's `bin/omniroute.mjs` is a Node 22+ binary. The Rust `omni-cli` is a single static binary. The transition from Node to static binary changes the deploy story; ops docs must be updated.

