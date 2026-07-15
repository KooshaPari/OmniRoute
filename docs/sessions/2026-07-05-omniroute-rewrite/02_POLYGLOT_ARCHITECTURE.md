# OmniRoute Fork — Polyglot Architecture (Rust + Go + Zig + Mojo)

> **Audit date:** 2026-07-05
> **Companion to:** `01_TS_BACKEND_INVENTORY.md`
> **Premise:** incremental replacement of the TypeScript/Node backend. Frontend (Next.js dashboard) is out of scope and stays on Node 22+/24+.

This memo recommends **one opinionated path**. Alternatives are noted only at genuine tradeoffs.

---

## 1. Executive summary

A four-language polyglot stack is the right shape for a high-throughput AI router because each language has a distinct strength:

- **Rust** owns the request path: HTTP, streaming, DB, auth, providers, MITM, compression, MCP/A2A, embeddings-via-ONNX. Single binary, predictable latency, no GC pauses in the hot loop.
- **Go** owns the CLI and the SDK: 80+ `cobra` subcommands, a `go install`-able SDK, ops tooling, and the cross-platform release binary that wraps the Rust core.
- **Zig** owns hot-path parsers and the FFI bridge: SSE/JSON-lines parsing, the Linux tproxy (porting the existing `src/mitm/tproxy/native/` C), and any C-ABI shim that Rust or Go needs.
- **Mojo** is **not used** in v1. Mojo's 2026 production-readiness for inference is still uncertain. The embedding/semantic-cache workloads are served by **ONNX Runtime via Rust FFI** (`ort` crate). Re-evaluate Mojo in v2 once it ships a stable ABI and at least one Tier-1 inference backend.

The release artifact is a **single `omniroute` binary** built by `cargo xtask`, containing a Rust HTTP server, a Go CLI subcommand tree (linked via C-ABI), and a Zig `cdylib` for hot paths. The Electron shell and the Next.js dashboard are unchanged in v1 (they speak to the new binary over the same OpenAI-compatible HTTP surface).

---

## 2. Language assignment matrix

| Subsystem | Language | Rationale |
|---|---|---|
| HTTP server (chat, embeddings, models, MCP, A2A) | Rust (axum) | Lowest per-request overhead, first-class SSE, mature ecosystem |
| Streaming parsers (SSE, JSON-lines, multipart) | Zig (via Rust FFI) | Zero-copy, simd-json, 5-10× faster than serde_json for the read path |
| Provider adapters (160+) | Rust | The catalog is data; one registry crate; one translator crate |
| Auth / session / API keys | Rust | Encryption lives here; no FFI for secrets |
| DB / persistence (SQLite) | Rust (rusqlite) | Bundled SQLite, same `.sql` migration files, no driver mismatch |
| CLI | Go (cobra) | Cross-compiles to every Node target, fast startup, easy distribution |
| SDK | Go | `go install github.com/.../omniroute@latest`; clients in any language can vendor the generated OpenAPI |
| Compression (RTK, Caveman) | Rust | Stream-friendly, lives next to the SSE layer |
| MITM / tproxy (Linux) | Zig (FFI from Rust) | Ports the existing C code 1:1; same `.node` ABI available for the transition |
| MCP server | Rust (`rmcp`) | Official Rust SDK; protocol-correctness matters |
| A2A server | Rust (custom) | A2A is JSON-RPC over HTTP; axum handles it |
| Embeddings / semantic cache | Rust (`ort` crate, ONNX Runtime) | ONNX is the 2026 stable path; Mojo is deferred |
| Electron desktop | TS (unchanged) | The shell just talks HTTP; rewrite the server, not the shell |
| Dashboard (Next.js) | TS (unchanged) | Out of scope for v1 |
| OpenAPI / docs | Rust (`utoipa`) | Generates the same `openapi.yaml` the TS layer already validates |
| Observability | Rust (`tracing` + `tracing-opentelemetry` + `opentelemetry-otlp`) | Single OTel collector; TS forwards via `node-otel` |

---

## 3. Library matrix

### 3.1 Rust

| Concern | Library | Version | Why | Alternatives |
|---|---|---|---|---|
| HTTP server | `axum` | 0.8 | Tower ecosystem, first-class SSE, Tokio-native | `actix-web` (faster but diverges), `hyper` only (too low-level) |
| Async runtime | `tokio` | 1.x | The default; required by axum | `smol` (smaller but smaller ecosystem) |
| SQLite | `rusqlite` | 0.32 with `bundled` feature | Same SQL files; no driver mismatch | `sqlx` (async-only, overkill for hot path), `libsql-client` (server mode only) |
| Migrations | `rusqlite_migration` | 1.x | Reads the existing 116 SQL files; no rewrite | `sqlx::migrate!` (tied to sqlx) |
| Serde | `serde` + `serde_json` | 1.x | Standard | `sonic-rs`, `simd-json` (faster, but only worth it for the read path — use in Zig) |
| Allocator | `mimalloc` (global) | 0.1 | Best general-purpose allocator for 2026 | `jemalloc` (slower on modern Linux), `rpmalloc` |
| HTTP client (provider egress) | `reqwest` (rustls) | 0.12 | rustls avoids the OpenSSL dep | `hyper` only (no connection pooling) |
| TLS | `rustls` | 0.23 | Pure Rust, no system OpenSSL | `native-tls` (Linux dep hell) |
| CLI (xtask) | `clap` | 4.x | De-facto standard | `argh` (smaller) |
| Config | `figment` | 0.10 | Reads the existing `.env` + YAML | `config` crate (older API) |
| Logging / tracing | `tracing` + `tracing-subscriber` + `tracing-opentelemetry` | latest | Structured, spans, OTel export | `slog` (older) |
| Metrics | `metrics` + `metrics-exporter-prometheus` | latest | Prometheus pull | `prometheus` crate directly (more boilerplate) |
| SSE | `axum::response::sse` | built-in | Native to axum | `eventsource-stream` (lower-level) |
| WebSocket | `axum::extract::ws` | built-in | Native | `tungstenite` (lower-level) |
| MCP | `rmcp` | 0.x | Official Rust SDK | Hand-rolled (don't) |
| JSON-RPC | `jsonrpsee` | 0.24 | A2A / ACP server | `tower-jsonrpsee` (newer) |
| FFI (Rust → C ABI) | `cbindgen` | 0.27 | Generate `*.h` for Go/Zig | `uniffi` (different model) |
| ONNX | `ort` | 2.x | ONNX Runtime bindings; v1 inference path | `tract` (pure Rust, smaller models only) |
| Crypto | `ring` | 0.17 | Fast, audited, used by `rustls` | `aws-lc-rs` (newer) |
| Compression (zstd) | `zstd` | 0.13 | Standard | — |
| DB encryption | `rusqlite` + `sqlcipher` feature | — | Optional; matches the existing `dataPaths.ts` encrypted mode | — |
| Errors | `thiserror` (lib) + `anyhow` (bin) | 1.x / 1.x | Idiomatic | — |
| Time | `time` + `time-macros` | 0.3 | Stable, no std re-export surprise | `chrono` (in maintenance) |
| UUID | `uuid` | 1.x | Standard | `ulid` (sortable, optional) |
| Async traits | `async-trait` | 0.1 | Still needed for some tower middleware | Native async fn in trait (Rust 1.75+, but trait objects need this) |

### 3.2 Go

| Concern | Library | Notes |
|---|---|---|
| HTTP framework | stdlib `net/http` + `chi` (router) | Stdlib is enough; chi for clean middleware chaining |
| SQLite | `modernc.org/sqlite` (pure Go) | No cgo; cross-compiles trivially; same SQL as the Rust side |
| Migrations | `golang-migrate/migrate` | Reads the same SQL files |
| Logging | `log/slog` (stdlib, Go 1.21+) | Structured, fast | `zap` (Uber) |
| CLI | `spf13/cobra` | Standard | `urfave/cli` |
| Config | `knadh/koanf` | Reads `.env` + YAML + TOML | `spf13/viper` (older API) |
| Protobuf | `vtprotobuf` (codegen) + `protobuf` (runtime) | Fast, drop-in | `buf` (different build model) |
| Process supervision | stdlib `os/exec` + the existing `bin/cli/runtime/processSupervisor.mjs` pattern | Port the supervisor concept to Go |
| IPC (Go → Rust) | C-ABI via `cgo` calling the Rust `cdylib` | One `pkg/omniroute/bridge` package wraps the C calls |
| Testing | stdlib `testing` + `testify` | Standard | — |
| Release | `go install` + `goreleaser` | Standard | — |

### 3.3 Zig

| Concern | Library | Notes |
|---|---|---|
| Build | `zig build` (0.13+) | Native to Zig |
| FFI to Rust | `extern "C"` + `cbindgen`-generated `*.h` | Rust exposes `cdylib`; Zig imports |
| JSON | `std.json` (parsing) | Good enough for the SSE framing layer |
| HTTP server (debug only) | `zap` (research-stage) | Don't use in production; Zig is **only** the FFI/shim layer in v1 |
| tproxy | port the existing `src/mitm/tproxy/native/` C to Zig 1:1 | The only piece of code we actually port to Zig in v1 |

### 3.4 Mojo

**Deferred.** Reasoning:

- As of 2026, Mojo's production-grade inference story is still in flux; the stable ABI for cross-language FFI has not landed.
- The current `semanticCache.ts` and `promptCache.ts` workloads are well-served by ONNX models running in `ort` from Rust.
- If/when Mojo ships a stable C-ABI and an ONNX-compatible backend, the swap is a single crate: replace `ort` with a Mojo-backed FFI crate behind the same `EmbeddingProvider` trait.

When Mojo becomes viable, the same `EmbeddingProvider` trait absorbs it without touching the rest of the codebase. **This is the value of the trait boundary.**

---

## 4. FFI / IPC strategy

### 4.1 Rust ↔ Go (C-ABI)

Rust exposes a `cdylib` (`libomniroute_bridge`). `cbindgen` generates the header.

```c
// generated bridge.h
typedef struct OrRequest {
    const uint8_t* body;
    size_t body_len;
    const char* path;
    const char* method;
    const char* auth_header;   // nullable
} OrRequest;

typedef struct OrResponse {
    int status;
    uint8_t* body;
    size_t body_len;
    void (*free)(uint8_t*);     // caller frees via Rust
} OrResponse;

OrResponse or_handle(const OrRequest* req);
```

Go calls via `cgo`:

```go
// #cgo LDFLAGS: -lomniroute_bridge
// #include "bridge.h"
import "C"
import "unsafe"

func Handle(body []byte, path, method, auth string) (status int, out []byte) {
    req := C.OrRequest{
        body:     &body[0], body_len: C.size_t(len(body)),
        path:     C.CString(path), method: C.CString(method),
        auth_header: nil,
    }
    defer C.free(unsafe.Pointer(req.path))
    defer C.free(unsafe.Pointer(req.method))
    resp := C.or_handle(&req)
    defer C.or_response_free(resp)
    out = C.GoBytes(unsafe.Pointer(resp.body), C.int(resp.body_len))
    return int(resp.status), out
}
```

This is the only FFI surface in v1. The Rust `cdylib` is the single source of truth for the request path.

### 4.2 Rust ↔ Zig

Zig imports the **same** `cdylib`. `cbindgen` emits `bridge.h`; Zig does:

```zig
const c = @cImport(@cInclude("bridge.h"));
export fn zig_sse_parse_frame(input: [*]const u8, len: usize) ?[*]const u8 { ... }
```

The Rust side calls the Zig shim through `extern "C" { fn zig_sse_parse_frame(...) ...; }` and links via `build.rs`.

### 4.3 Rust ↔ Mojo (deferred)

When Mojo lands, the integration is the same C-ABI pattern. No code in the rest of the system has to change because the boundary is the `EmbeddingProvider` trait.

### 4.4 Inter-process: HTTP and unix sockets

- **HTTP** for the Go CLI's RPC to the Rust sidecar during the transition. JSON over HTTP/1.1 with `Content-Length`. Stdlib everywhere.
- **Unix domain sockets** for the hot path inside the single binary (Rust owns the listener; Go calls into Rust via in-process C-ABI, not over a socket).

---

## 5. Data format for IPC

**Pick: `capnproto`.**

- Schemas are stable, versionable, and forward-compatible.
- Zero-copy read is exactly what the streaming parser wants.
- `capnp` Rust crate is mature; `go-capnp` is mature.
- Alternative `flatbuffers` was considered; the Rust story is weaker.
- `protobuf` is fine but copies on parse; we're a streaming app.
- `MessagePack` has no schema.
- JSON is the wire format for the public OpenAI-compatible surface; do not duplicate it internally.

Public HTTP surface stays JSON (OpenAI-compatible contract). Internal IPC is capnproto.

---

## 6. Build / release unification

```
omniroute/
  rust/                  # Cargo workspace
    Cargo.toml           # [workspace] members = ["crates/*"]
    crates/
      omniroute-core/    # traits, errors, types
      omniroute-db/      # rusqlite, migrations
      omniroute-providers/  # 160+ provider catalog
      omniroute-router/  # axum server, streaming
      omniroute-auth/    # auth, sessions, api keys
      omniroute-compression/
      omniroute-mcp/     # rmcp server
      omniroute-a2a/     # A2A server
      omniroute-mitm/    # FFI to Zig tproxy
      omniroute-embed/   # ONNX embedding provider
      omniroute-bridge/  # cdylib C-ABI for Go
      omniroute-xtask/   # release tool
    zig/                 # Zig FFI shims
      build.zig
      src/
        sse_parse.zig
        tproxy.zig
  go/                    # Go module
    go.mod
    cmd/omniroute/       # cobra root
    internal/
      bridge/            # cgo calls into Rust
      commands/          # 80+ subcommands
      runtime/           # process supervisor
  openapi.yaml           # generated by utoipa
  Cargo.lock
  go.sum
  xtask.toml             # release profile
  justfile               # top-level recipes
```

`just release` runs:
1. `cargo build --release -p omniroute-bridge` (Rust cdylib)
2. `cargo build --release -p omniroute-xtask` (the bundler binary)
3. `zig build` (Zig cdylib)
4. `go build -o dist/omniroute ./go/cmd/omniroute` (Go binary that links Rust+Zi)
5. `goreleaser` for cross-platform Go SDK builds
6. `cargo run -p omniroute-xtask -- bundle` produces `dist/omniroute-{linux,macos,windows}`

Single artifact. One `PATH` entry. Same UX as the current `omniroute` CLI.

---

## 7. Observability

- **Rust:** `tracing` → `tracing-opentelemetry` → OTLP. Spans wrap every request; every provider call; every DB op.
- **Go:** `slog` → OTel bridge. The `bridge` package instruments each FFI call.
- **Zig:** no observability code; it is a thin shim.
- **Single OTel collector** at `localhost:4317`. The current TS layer keeps using `node-otel` and forwards to the same collector so dashboards work during the transition.

---

## 8. Memory & allocator strategy

- **Rust:** `mimalloc` global. Override the allocator in `omniroute-core/src/lib.rs`. Set `MIMALLOC_PURGE_DELAY=0` for low-latency.
- **Go:** default. `GOGC=200` for the CLI (it is not a long-running daemon).
- **Zig:** `std.heap.GeneralPurposeAllocator` only in debug; release uses the system allocator (or `mimalloc` linked in).
- **Mojo:** N/A in v1.

---

## 9. Security

- **All secrets live in the Rust process.** Go and Zig never see raw API keys; they pass opaque handles.
- **MITM CA bundle** stays in Rust, behind the `omniroute-mitm` crate.
- **Electron preload** keeps its contextBridge; only public DTOs cross the boundary.
- **FFI boundary validation:** every C-ABI call re-validates pointer + length (defense in depth; the Go side is trusted, but the contract is explicit).

---

## 10. Performance targets

Realistic targets based on published benchmarks from LiteLLM (Python, comparable) and from `axum` + `tokio` (Rust, generally 2-3× LiteLLM at the same hardware):

| Workload | Target | Reference |
|---|---|---|
| `POST /v1/chat/completions` (non-streaming, 1k tokens in/out) | p50 < 50ms overhead | LiteLLM p50 ~80-120ms |
| `POST /v1/chat/completions` (streaming) | TTFB < 100ms; sustained > 5k tok/s per connection | axum SSE throughput |
| Provider failover (3-provider combo) | < 200ms added latency | Combo engine in `src/lib/combos/` |
| CLI startup | < 50ms cold | Go + Rust FFI |
| DB ops (insert call_log) | p99 < 5ms | `rusqlite` batched WAL |
| Memory at 10k concurrent streams | < 4 GB RSS | mimalloc + axum steady state |

Add an HTTP-level benchmark to Phase 1 (`tests/perf/` with `k6` or `drill`); currently the repo has no HTTP-level benchmark.

---

## 11. Migration strategy (5 phases, one go/no-go gate each)

| Phase | Scope | Gate |
|---|---|---|
| **0 — Toolchain** | rust/ and go/ directories; `just build` produces a placeholder `dist/omniroute` | `just build` works on macOS, Linux x86_64, Linux aarch64 |
| **1 — Data plane** | `omniroute-db` (rusqlite + 116 migrations), `omniroute-bridge` (cdylib), Go CLI calls into Rust for `data dir`, `db status`, `db backup`. CLI parity for `bin/omniroute.mjs` data commands. | All 47 data-related CLI commands pass byte-for-byte where possible, semantically equivalent otherwise; the existing 1917 TS tests still pass |
| **2 — Request plane (port the hot path)** | `omniroute-router` (axum), `omniroute-providers` (codegen from `open-sse/config/`), `omniroute-auth`, `omniroute-compression`. The Rust binary runs `/v1/chat/completions` and friends; the Next.js dashboard still serves the UI and proxies to Rust. | A golden-set replay test runs 10k real chat requests through the Rust server; outputs match the TS server byte-for-byte for non-streaming, semantic-equivalent for streaming; p50 < 50ms overhead |
| **3 — Streaming + MITM + Zig** | `omniroute-mitm` (Zig tproxy port), SSE parser in Zig, MCP/A2A in Rust, embeddings via `ort`. | Linux MITM tproxy works on `IP_TRANSPARENT`; SSE parser passes the fuzz suite; `rmcp` server is protocol-conformant |
| **4 — Retire the Next.js server** | Drop the Next.js server; ship a single Rust binary. Keep the Electron shell. | Full end-to-end smoke passes on a clean install; the 1917 TS tests are ported to `cargo test` and pass; release artifact is a single binary per platform |

The full IPC audit (subagent C) and the migration sequencing are in `03_BOUNDARY_IPC_FFI.md`.

---

## 12. Risks and unknowns

1. **TS test parity is the long pole.** The 1917 TS tests are the contract. Porting them all is a multi-month effort. Mitigation: keep them in TS for the duration; the Rust port adds new `cargo test` suites in parallel, not as a replacement.
2. **Provider catalog drift.** The 160+ providers change weekly. Mitigation: codegen the catalog from `open-sse/config/` at build time; never hand-edit the Rust provider structs.
3. **Electron and dashboard are out of scope.** The user's directive is "backend/api/sdk/cli." If the dashboard depends on a TS-only API (e.g. server actions), it stays on the Next.js server. The dashboard talks to the new binary over HTTP, not via internal TS calls.
4. **Mojo deferral could be wrong.** If the user disagrees, the v1 plan needs a spike. The trait boundary makes the swap mechanical.
5. **C-ABI overhead is non-zero.** For the CLI → Rust calls, each call is ~1µs. Acceptable for command paths; for the request path, Rust owns the listener, so no FFI on the hot path.
6. **`next-isolated` build complexity.** The `OMNIROUTE_BUILD_PROFILE=minimal` flow is custom; the new binary must continue to ship the secure build. Mitigation: bake the profile flags into `xtask`.
7. **Node 22+/24+ parity.** The current `engines` field constrains the Node version. The Rust binary must build on the same glibc/musl baselines (target `x86_64-unknown-linux-gnu`, `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-pc-windows-msvc`).
8. **Tailscale/cloudflared/ngrok tunnels** are TypeScript today. The port lives in `omniroute-router` (a tunnel manager crate). Risk: tunnel protocols are stateful; port carefully and re-use the `tailscaleTunnel.ts` / `cloudflaredTunnel.ts` / `ngrokTunnel.ts` semantics.
