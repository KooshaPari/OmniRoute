# OmniRoute Fork — Rewrite Audit & Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Language Preference (decision-tree ordering for optimality):**
>
> 1. **Zig** — first pick where Rust memory model / binary size / C-ABI is suboptimal
> 2. **Mojo** — first pick where ML/AI kernel-level optimization matters
> 3. **Rust** — broad systems coverage, single-binary deploys, tokio/axum/tonic
> 4. **Go** — pragmatic services, cloud SDK wrappers, BIFROST vendored gateway
> 5. **Python** — **forced edge** for FastMCP (`pyo3` for Rust↔Python FFI)
> 6. **TypeScript** — Tier-3 (dashboard, MCP server, A2A handler, frontend) only
>
> **Volume distribution expectation** (after decision trees settle): Rust + Go will be the largest portion of the codebase. Zig and Mojo will be smaller but placed at the **highest-leverage** points (inner loops, hot paths, ML kernels). Python stays a forced-edge for FastMCP only.

**Goal:** Transform the OmniRoute fork from a TypeScript/Next.js monolith into a production-grade, enterprise-ready AI proxy/router with a Rust data plane, Go bifrost (interim), Zig hot-path shims, Mojo ML kernels, Python FastMCP bridge, and TypeScript control plane.

**Architecture:** 2-tier split — Tier-1 (data plane: high-throughput provider dispatch, streaming, retries) in Rust with Zig hot-path shims and optional Mojo kernels; Tier-2 (control plane: policy engine, dashboard, MCP, A2A, admin) in TypeScript/Next.js with Python FastMCP bridge. Bifrost Go gateway as interim Tier-1 during Rust migration. Polyglot binding per [ADR-032](../docs/adr/0032-polyglot-binding-tiers.md) (Accepted 2026-07-04): T1 HTTP sidecar (default), T2 UDS RPC, T3 native ABI FFI (`napi-rs` Node↔Rust, `cgo` Node↔Go, `pyo3` Python↔Rust).

**Tech Stack:**

- **Rust** (tokio/axum/tonic/hyper) — data plane core, FFI bridge (`napi-rs`)
- **Zig** — hot-path shims (SSE chunking, regex prefilter, custom allocators)
- **Mojo** — ML kernels (tokenization scoring, future on-device inference)
- **Go** — Bifrost vendored gateway, cloud SDK wrappers (`cgo` FFI bridge)
- **Python** — FastMCP server (`pyo3` FFI bridge to Rust core)
- **TypeScript/Next.js 16** — control plane, dashboard, MCP server, A2A handler
- **SQLite/better-sqlite3** — DB (control plane reads; data plane uses tokio-rusqlite)
- **OpenTelemetry** — observability (OTLP across all tiers)

---

## Phase 0: Current State Audit (Complete)

### 0.0 Polyglot Reality (ADR-032 — pre-existing)

**Spec-canonical substrate (per `SPEC.md` §13 + §17):** The canonical routing substrate is **`Tokn::tokenledger::routing`** — a Rust hexagonal implementation at `Tokn/crates/tokenledger/src/routing/` (pareto_router + ports + adapters). This is NOT a new build; it already exists. Per `SPEC.md` §17, the polyglot edge infrastructure is **already shipped** at `open-sse/rpc/` (polyglotEdges.ts, udsServer.ts, udsClient.ts, ffi.ts, killSwitchBridge.ts, tierResolver.ts) and `crates/omniroute-ffi/` (3 sub-crates: combo-scorer, signature-cache, sse-chunking).

What this plan does: **aligns the fork with the canonical substrate** by extracting `Tokn` to be OmniRoute-loadable (via workspace member + UDS RPC) and migrating Tier-2 hot edges from TS to Rust FFI per the per-edge mapping table. We do NOT build a separate "Rust data plane binary" — `Tokn::tokenledger::routing` is the substrate, and `BifrostBackendExecutor` (Go, Tier-1) stays as interim Tier-1 per ADR-031.

From [`docs/adr/0032-polyglot-binding-tiers.md`](../docs/adr/0032-polyglot-binding-tiers.md) (ADR-032 Polyglot Binding Tiers, Accepted 2026-07-04) and `SPEC.md` §17:

| Tier   | Mechanism                                                                     | Overhead   | Hot-path fit                                               |
| ------ | ----------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| **T1** | HTTP sidecar (`fetch()` over TCP loopback)                                    | ~1-2 ms    | Tier-1 router (`BifrostBackendExecutor`), dashboards       |
| **T2** | Unix-domain-socket (UDS) RPC — JSON-RPC / Cap'n Proto / FlatBuffers           | ~50-200 µs | Compression, translator, MCP client, guardrails            |
| **T3** | Native ABI FFI — `napi-rs` (Node↔Rust), `cgo` (Node↔Go), `pyo3` (Python↔Rust) | ~1-10 µs   | SSE chunking, combo scoring, tokenization, regex prefilter |

**Per-edge migration plan (from SPEC.md §17.4 / §17.10):**

| Edge                                         | Current                | Target tier                      | Crate                                                   |
| -------------------------------------------- | ---------------------- | -------------------------------- | ------------------------------------------------------- |
| Combo scorer (12-factor Auto-Combo, SIMD)    | TS in-process          | **T3 (FFI)**                     | `crates/omniroute-ffi/crates/combo-scorer/` (exists)    |
| SSE chunking                                 | TS `while(true)` loop  | **T3 (FFI)**                     | `crates/omniroute-ffi/crates/sse-chunking/` (exists)    |
| Semantic cache lookup                        | SQLite                 | **T3 (FFI)**                     | `crates/omniroute-ffi/crates/signature-cache/` (exists) |
| Format translation (OpenAI↔Anthropic↔Gemini) | TS in-process          | **T3 (FFI)**                     | new `crates/translator-ffi/`                            |
| Rate-limit token-bucket (DEBT-001)           | TS in-process          | **T3 (FFI)**                     | new `crates/quota-ffi/`                                 |
| Reasoning replay                             | SQLite                 | **T3 (FFI)**                     | new `crates/reasoning-replay-ffi/`                      |
| Prompt compression (lite/caveman/rtk)        | TS in-process          | **T2 (UDS RPC)**                 | `Tokn::tokenledger::compression` + UDS server           |
| Guardrails (pii/injection/vision)            | TS in-process          | **T2 (UDS RPC)**                 | `Tokn::tokenledger::guardrails` + UDS server            |
| MCP server tool dispatch (co-located)        | JSON-RPC over HTTP/SSE | **T2 (UDS RPC when co-located)** | new `crates/mcp-uds-server/`                            |

### 0.1 Codebase Inventory

| Measure                   | Count              | Notes                                     |
| ------------------------- | ------------------ | ----------------------------------------- |
| Total files (git-tracked) | ~5,771             | across src/, open-sse/, electron/, tests/ |
| TypeScript/TSX            | ~4,577 files (79%) | Primary language — everything             |
| SQL migrations            | 97 files           | src/lib/db/migrations/                    |
| DB domain modules         | 83 files           | src/lib/db/*.ts                           |
| Providers                 | 231 entries        | src/shared/constants/providers.ts         |
| MCP tools                 | 87                 | open-sse/mcp-server/                      |
| Routing strategies        | 17                 | combo.ts + fusion                         |
| A2A skills                | 8                  | src/lib/a2a/skills/                       |
| i18n locales              | 42                 | src/i18n/messages/                        |

### 0.2 Architecture Audit

**Current Stack (TypeScript monolith):**

```
Client → Next.js API Route (/v1/chat/completions)
  → Zod validation → Auth → Policy check
  → handleChatCore() [TypeScript]
    → translateRequest() → getExecutor() → executor.execute()
      → fetch() upstream → retry
    → SSE stream or JSON response
```

**Strengths:**

- Massive provider coverage (231) and MCP tool surface (87)
- Sophisticated combo routing with 17 strategies
- Rich ecosystem: A2A, MCP, webhooks, guardrails, evals, skills, memory
- Excellent TypeScript DX for rapid iteration
- Strong test coverage infrastructure (~48 quality gate scripts)

**Weaknesses:**

- TypeScript data plane has performance ceiling (V8 single-threaded, GC pauses)
- Next.js monolith conflates API gateway, dashboard, and agent protocols
- 83 DB modules with 97 migrations is unwieldy — schema drift risk
- No native gRPC support for inter-service communication
- Circuit breaker / resilience patterns are TypeScript-abstracted over raw HTTP
- 5,771 files = cognitive overload for new contributors
- Fork divergence from upstream (diegosouzapw/OmniRoute) not cleanly managed

### 0.3 Bifrost (Go Gateway) Assessment

**Current Bifrost integration (Phase 1 complete):**

- `open-sse/executors/bifrost.ts` — BifrostBackendExecutor (238 lines)
- `bifrostProviderMap.ts` — 23 first-class Bifrost providers + 50+ aliases
- Kill switch: `open-sse/services/bifrostKillSwitch.ts` (401 lines)
- Model cache: `src/lib/db/bifrostModels.ts` (508 lines) + migration 100
- Migration playbook: `docs/operations/bifrost-migration.md`

**Assessment:** Bifrost is a well-chosen interim Tier-1. Go is the right pragmatic choice for now. Long-term (post-Rust data plane completion), Bifrost should be either:

- (a) Replaced by a native Rust tier-1, or
- (b) Kept as Go if the Rust team decides it's not worth re-implementing

**Binding-tier integration:** Once F6 (`cgo` in-process Bifrost Go SDK, 2027 Q1) ships, Bifrost is callable as an in-process library instead of an HTTP sidecar — eliminating ~1-2 ms T1 overhead per request. This is the **pragmatic** path that keeps Bifrost-Go while reaching T3-equivalent performance.

### 0.4 Forced-Edge Audit

Per the user's directive, certain languages are **forced edges** (the ecosystem dictates the choice, not preference):

| Forced edge          | Why forced                                                                                              | Integration tier                       |
| -------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Python (FastMCP)** | FastMCP is the canonical MCP server framework used by the Anthropic ecosystem; agents/clients expect it | T3 (pyo3 Rust↔Python FFI)              |
| **TypeScript**       | MCP and A2A server tooling widely authored in TS; Anthropic SDK reference impl is TS                    | T1/T2 (HTTP, UDS)                      |
| **WAT/WASM**         | Browser-side execution, edge functions                                                                  | T1 (HTTP)                              |
| **SQL**              | Declarative queries — no substitute                                                                     | n/a (within Rust `rusqlite` or `sqlx`) |
| **Bash/Shell**       | System tooling glue                                                                                     | n/a (build/test scripts)               |

**Decision rule:** When a forced edge exists, we do NOT write a wrapper in our preferred language. We **integrate** at the binding tier (T1/T2/T3) that minimizes overhead and preserves the forced-edge tool's ecosystem.

### 0.5 Decision-Tree Walk-Through (Language Selection)

For each new component, run this decision tree in order. First match wins:

| Question                                                                   | If yes →                        | If no →              |
| -------------------------------------------------------------------------- | ------------------------------- | -------------------- |
| Q1: Is there a forced edge (FastMCP, MCP-TS, WAT)?                         | **Use forced edge** at T1/T2/T3 | Continue             |
| Q2: Is this an ML kernel / on-device inference?                            | **Mojo** (when ≥v1.0 ships)     | Continue             |
| Q3: Is binary size <100KB, C-ABI required, or compile-time codegen needed? | **Zig**                         | Continue             |
| Q4: Memory safety + perf + single-binary + tokio ecosystem?                | **Rust**                        | Continue             |
| Q5: Massive SDK ecosystem (cloud), goroutine fanout, quick scaffolding?    | **Go**                          | Continue             |
| Q6: UI / dashboard / agent protocol surface?                               | **TypeScript**                  | **Reconsider scope** |

---

## Phase 1: Control-Plane/Data-Plane Separation (Weeks 1-4)

### Objective

Extract the request/data path from the Next.js monolith into its own Rust service while keeping the dashboard, MCP, A2A, and admin in TypeScript.

### Architecture Target

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js 16 (Control Plane)              │
│  Dashboard · MCP Server · A2A Server · Auth              │
│  Policy Engine · Guardrails · Webhooks · Admin API        │
│  DB Modules (src/lib/db/) — reads only from data plane?  │
└──────────────────────┬──────────────────────────────────┘
                       │ gRPC / HTTP bridge
                       ▼
┌─────────────────────────────────────────────────────────┐
│               Rust Data Plane (new)                       │
│  Router Core · Provider Dispatch · Streaming · Retry    │
│  Translator (OpenAI↔Claude↔Gemini) · Fallback            │
│  Circuit Breaker · Rate Limiter · Semantic Cache         │
│  Fusion Strategy · Cost Tracking                         │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP
                       ▼
┌─────────────────────────────────────────────────────────┐
│               Bifrost Go Gateway (Interim Tier-1)         │
│  23+ provider dispatch · fallback · LB · virtual keys    │
└─────────────────────────────────────────────────────────┘
```

### Task 1A: Rust Router Crate Scaffold

**Files:**

- Create: `crates/omniroute-router/Cargo.toml`
- Create: `crates/omniroute-router/src/lib.rs`
- Create: `crates/omniroute-router/src/executor.rs`
- Create: `crates/omniroute-router/src/translator.rs`
- Create: `crates/omniroute-router/src/streaming.rs`
- Create: `crates/omniroute-router/src/types.rs`
- Modify: `Cargo.toml` (workspace member)

- [ ] **Step 1: Create workspace member + Cargo.toml**

  ```toml
  [package]
  name = "omniroute-router"
  version = "0.1.0"
  edition = "2021"

  [dependencies]
  tokio = { version = "1", features = ["full"] }
  axum = "0.7"
  tonic = "0.11"
  serde = { version = "1", features = ["derive"] }
  serde_json = "1"
  tracing = "0.1"
  thiserror = "1"
  anyhow = "1"
  reqwest = { version = "0.12", features = ["stream", "json"] }
  opentelemetry = "0.32"
  ```

  Run: `cargo check -p omniroute-router`

- [ ] **Step 2: Define core types**
      Create `types.rs` with RouteRequest, RouteResponse, RouteError, Message, etc.

- [ ] **Step 3: Define Executor trait**
  ```rust
  #[async_trait]
  pub trait Executor: Send + Sync {
      async fn execute(&self, request: RouteRequest) -> Result<RouteResponse, RouteError>;
      async fn execute_streaming(
          &self,
          request: RouteRequest,
          tx: tokio::sync::mpsc::Sender<StreamChunk>,
      ) -> Result<(), RouteError>;
      fn provider_id(&self) -> &str;
  }
  ```

### Task 1B: gRPC Bridge (Next.js ↔ Rust)

**Files:**

- Create: `proto/omniroute.proto`
- Create: `crates/omniroute-router/src/grpc_server.rs`
- Create: `src/lib/grpc-client.ts`

- [ ] **Step 1: Define protobuf schema**

  ```protobuf
  service OmniRoute {
      rpc RouteChat (RouteChatRequest) returns (RouteChatResponse);
      rpc RouteChatStream (RouteChatRequest) returns (stream RouteChatChunk);
      rpc HealthCheck (HealthRequest) returns (HealthResponse);
  }
  ```

- [ ] **Step 2: Implement gRPC server in Rust**
      Wire into axum server, register tonic service.

- [ ] **Step 3: Implement gRPC client in TypeScript**
      `@grpc/grpc-js` client that Next.js calls instead of `handleChatCore()`.

- [ ] **Step 4: Integration test**
      Run Next.js dev + Rust gRPC server, verify round-trip route.

### Task 1C: Bifrost Adapter in Rust

**Files:**

- Create: `crates/omniroute-router/src/bifrost_adapter.rs`
- Modify: `crates/omniroute-router/src/executor.rs`

- [ ] **Step 1: Port Bifrost executor from TypeScript to Rust**
      Translate `open-sse/executors/bifrost.ts` logic into Rust `BifrostAdapter`.

- [ ] **Step 2: Port provider map**
      Translate `bifrostProviderMap.ts` to Rust (~200 lines). Use `phf` compile-time maps.

- [ ] **Step 3: Port kill switch**
      Translate `bifrostKillSwitch.ts` to Rust. Thresholds: p99 > 5s, error rate > 2%, consecutive failures >= 10.

### Task 1D: Remaining Executors Port

**Files:**

- Create: `crates/omniroute-router/src/executors/default.rs`
- Create: `crates/omniroute-router/src/executors/gemini.rs`
- Create: `crates/omniroute-router/src/executors/anthropic.rs`

- [ ] **Step 1: Port DefaultExecutor** (handles most OpenAI-compatible providers)
- [ ] **Step 2: Port Gemini executor** (OAuth2, Gemini format)
- [ ] **Step 3: Port Anthropic executor** (message format translation)

---

## Phase 2: Rust Data Plane Core (Weeks 5-8)

### Task 2A: Combo Routing Engine

**Files:**

- Create: `crates/omniroute-router/src/combo.rs`
- Create: `crates/omniroute-router/src/strategies.rs`

- [ ] **Step 1: Implement strategy trait + all 17 strategies** (Priority, Weighted, RoundRobin, LeastUsed, CostOptimized, Auto, Fusion, ContextOptimized, Lkgp, etc.)
- [ ] **Step 2: Implement combo resolver** (read config, resolve targets, apply strategy)
- [ ] **Step 3: Implement handleComboChat** (iterate targets, fallback, circuit breaker)

### Task 2B: Translator Engine

**Files:**

- Create: `crates/omniroute-router/src/translator.rs`
- Create: `crates/omniroute-router/src/translators/openai.rs`
- Create: `crates/omniroute-router/src/translators/anthropic.rs`
- Create: `crates/omniroute-router/src/translators/gemini.rs`

- [ ] **Step 1: Implement request translation** (OpenAI→Anthropic, OpenAI→Gemini)
- [ ] **Step 2: Implement response translation** (reverse direction)
- [ ] **Step 3: Implement Responses API transformer** (TransformStream equivalent)

### Task 2C: Streaming Engine

**Files:**

- Create: `crates/omniroute-router/src/streaming.rs`
- Create: `crates/omniroute-router/src/sse.rs`

- [ ] **Step 1: SSE parser** (provider→canonical format)
- [ ] **Step 2: SSE serializer** (canonical→client format)
- [ ] **Step 3: Streaming response handler** (tokio channels + axum Stream)

### Task 2D: Resilience Patterns

**Files:**

- Create: `crates/omniroute-router/src/circuit_breaker.rs`
- Create: `crates/omniroute-router/src/rate_limiter.rs`
- Create: `crates/omniroute-router/src/retry.rs`

- [ ] **Step 1: Circuit breaker** (3-state per-provider)
- [ ] **Step 2: Rate limiter** (token bucket per-key per-provider)
- [ ] **Step 3: Retry with exponential backoff + jitter**

### Task 2E: Zig Hot-Path Shims (T3-Z binding)

**Rationale:** Per decision tree Q3, Zig is the **first pick** when:

- SSE chunking throughput is the bottleneck (~50–100µs per chunk in Rust; Zig can hit <10µs)
- Regex prefilter (PII patterns, prompt-injection patterns) needs C-ABI for `regex` C libs
- Custom allocator needed (arena for SSE buffer pools, off-heap for token streams)
- Compile-time codegen produces faster lookup tables than `phf`

**Files:**

- Create: `crates/omniroute-shims-zig/Cargo.toml`
- Create: `crates/omniroute-shims-zig/build.rs`
- Create: `crates/omniroute-shims-zig/src/lib.rs` (Rust FFI wrapper)
- Create: `crates/omniroute-shims-zig/zig/sse_chunker.zig`
- Create: `crates/omniroute-shims-zig/zig/regex_prefilter.zig`
- Create: `crates/omniroute-shims-zig/zig/arena_allocator.zig`

- [ ] **Step 1: Set up Zig build via `zigbuild` crate**

  ```toml
  [build-dependencies]
  zigbuild = "0.11"
  ```

  Cargo invokes `zig build-lib` for the static library; Rust `extern "C"` blocks call into it.

- [ ] **Step 2: Implement SSE chunker in Zig**
  - `extern "C" fn sse_chunk_next(buf: *const u8, len: usize, out: *mut Chunk) -> usize`
  - Bench against Rust equivalent (`bytes::BytesMut` + memchr): target 5× throughput

- [ ] **Step 3: Implement regex prefilter in Zig**
  - Compiled at startup with `aho-corasick` Zig port
  - Returns pattern IDs for PII / prompt-injection matches

- [ ] **Step 4: Implement arena allocator**
  - Bump allocator for SSE buffer pools (avoids jemalloc churn)
  - Wired into SSE deserializer

- [ ] **Step 5: Benchmark suite**
  - Criterion benchmarks comparing Rust vs Rust+Zig FFI
  - Auto-fallback to Rust if Zig shim is <2× faster (avoid maintenance burden)

**Decision rule:** If Zig shim does NOT achieve ≥2× speedup over Rust, deprecate the shim and rely on Rust. Zig earns its slot via measurable optimality, not preference.

---

## Phase 3: DB Layer Migration (Weeks 9-12)

### Task 3A: Rust DB Core

**Files:**

- Create: `crates/omniroute-db/Cargo.toml`
- Create: `crates/omniroute-db/src/lib.rs`
- Create: `crates/omniroute-db/src/core.rs`
- Create: `crates/omniroute-db/src/migrations.rs`
- Create: `crates/omniroute-db/src/providers.rs`
- Create: `crates/omniroute-db/src/combos.rs`
- Create: `crates/omniroute-db/src/usage.rs`
- Create: `crates/omniroute-db/src/secrets.rs`

- [ ] **Step 1: Create omniroute-db crate with rusqlite**
- [ ] **Step 2: Port migration runner** from migrationRunner.ts
- [ ] **Step 3: Port first 10 critical DB modules**

### Task 3B: Dual-Read Strategy

- [ ] **Step 1: Define table ownership per module**
- [ ] **Step 2: Add write-through layer in TypeScript for shared tables**
- [ ] **Step 3: Add read-cache in Rust for hot tables**

---

## Phase 4: Production Hardening (Weeks 13-16)

### Task 4A: OpenTelemetry & Observability

- [ ] OTLP export from Rust data plane (traces + metrics)
- [ ] Structured logging (tracing + json)
- [ ] p99 latency histograms per provider per model
- [ ] Health check endpoint (gRPC + HTTP)

### Task 4B: Configuration & Deployment

- [ ] Single config file (TOML) covering both Rust + TypeScript
- [ ] Docker compose for full stack (Rust + Next.js + Bifrost)
- [ ] CLI tool for installation/upgrade (Rust)

### Task 4C: Security Hardening

- [ ] Secrets management (env/file/keyring)
- [ ] TLS termination (Rust data plane)
- [ ] Auth token validation in Rust (shared JWT secret)
- [ ] Rate limiting per API key (enforced in Rust)

### Task 4D: Performance Optimization

- [ ] Connection pooling to upstream providers
- [ ] Response caching (semantic cache in Rust)
- [ ] Request deduplication for identical concurrent requests
- [ ] Load shedding under backpressure

---

## Phase 5: Bifrost Graduation + Polyglot Expansion (Weeks 17-24)

### Task 5A: Bifrost Graduation

**Two paths:**

- **Path A (pragmatic):** Bifrost stays as Go Tier-1; Rust feeds through it via T1 HTTP (current) or T6 `cgo` (after F6 ships, 2027 Q1)
- **Path B (preferred):** Absorb Bifrost into Rust native

- [ ] **Step 1: Benchmark both paths** — p50/p95/p99 for 100 concurrent requests × 10 providers
- [ ] **Step 2: Decision gate** — If Path B outperforms by >15% on p99, pursue absorption
- [ ] **Step 3: If Path B: systematic port of Bifrost provider dispatch**
- [ ] **Step 4: Retire Bifrost Go service**

### Task 5B: `cgo` In-Process Bifrost (F6 from ADR-032)

After F6 (`cgo` in-process Bifrost Go SDK, 2027 Q1), Bifrost becomes an in-process library. T1 HTTP overhead (~1-2 ms) is eliminated. Rust calls Go via `cgo` directly.

**Files:**

- Create: `crates/omniroute-bifrost-bridge/Cargo.toml`
- Create: `crates/omniroute-bifrost-bridge/build.rs`
- Create: `crates/omniroute-bifrost-bridge/src/lib.rs`

- [ ] **Step 1: Vendor Bifrost Go SDK as git submodule**
  ```bash
  git submodule add vendor/bifrost https://github.com/maximhq/bifrost.git
  ```
- [ ] **Step 2: Build with `cgo` enabled**
  ```toml
  [build-dependencies]
  gobuild = "0.1"
  ```
- [ ] **Step 3: Rust `extern "C"` wrappers around Bifrost dispatch**
- [ ] **Step 4: Verify zero-copy pass-through**

### Task 5C: Mojo ML Kernels (T3-M binding)

**Rationale:** Per decision tree Q2, Mojo is the **first pick** when ML kernel-level optimization matters. OmniRoute's ML-relevant hot paths:

- Tokenization scoring (for cost prediction, combo scoring)
- Future: on-device inference for routing decisions
- Future: speculative decoding for compatible providers

**Constraint:** Mojo is pre-1.0. This task is **gated** until Mojo ≥v1.0 ships. Until then, this slot is held by Rust with `tch`/`candle` ML libraries.

**Files (planned, gated on Mojo v1.0):**

- Create: `crates/omniroute-ml-kernels/Cargo.toml`
- Create: `crates/omniroute-ml-kernels/build.rs`
- Create: `crates/omniroute-ml-kernels/src/lib.rs` (FFI loader)
- Create: `crates/omniroute-ml-kernels/mojo/tokenizer_score.mojo`
- Create: `crates/omniroute-ml-kernels/mojo/combo_routing.mojo`

- [ ] **Step 1: Set up Mojo build via `mojo build --shared` → load via `libloading`**
- [ ] **Step 2: Implement tokenizer scoring kernel**
  - Input: token IDs, model ID
  - Output: cost estimate + fit score
  - Target: <100µs per call (Rust + `tiktoken-rs` baseline ~500µs)
- [ ] **Step 3: Implement combo routing kernel**
  - Input: 12-factor scoring inputs
  - Output: ranked combo targets
  - Target: <50µs per call (Rust baseline ~200µs)
- [ ] **Step 4: Fallback path** — Rust `candle` implementation runs if Mojo kernels fail to load

**Decision rule:** Mojo earns its slot only when ≥3 kernels demonstrate ≥2× speedup over Rust baselines. Otherwise, deprecate and rely on Rust.

### Task 5D: FastMCP Bridge (T3-P binding)

**Rationale:** Per the forced-edge audit (§0.4), **Python FastMCP is forced** because:

- Anthropic's MCP ecosystem widely adopts FastMCP as the reference Python impl
- Agents/clients expect FastMCP-style tool definitions (`@mcp.tool()` decorators)
- The Python ML ecosystem (NumPy, scikit-learn, transformers) is the de-facto standard for tool augmentation

**Strategy:** Run a FastMCP server **in-process** (not as separate Python process) via `pyo3`. Python code calls Rust data plane through `pyo3` FFI. Rust exports Python-callable functions for tool execution.

**Files:**

- Create: `crates/omniroute-fastmcp/Cargo.toml`
- Create: `crates/omniroute-fastmcp/src/lib.rs` (pyo3 module)
- Create: `crates/omniroute-fastmcp/python/omniroute_fastmcp/server.py`
- Create: `crates/omniroute-fastmcp/python/omniroute_fastmcp/tools/`
- Modify: `open-sse/mcp-server/` (add FastMCP bridge that mirrors TS tools)

```toml
[dependencies]
pyo3 = { version = "0.21", features = ["auto-initialize"] }
```

- [ ] **Step 1: Define `pyo3` Rust module exposing data-plane primitives**
  ```rust
  #[pyfunction]
  fn route_chat(model: &str, messages: Vec<PyMessage>) -> PyResult<PyResponse> {
      // Calls into omniroute-router crate via Rust API
  }

  #[pymodule]
  fn omniroute(_py: Python, m: &PyModule) -> PyResult<()> {
      m.add_function(wrap_pyfunction!(route_chat, m)?)?;
      m.add_function(wrap_pyfunction!(route_stream, m)?)?;
      m.add_function(wrap_pyfunction!(list_providers, m)?)?;
      Ok(())
  }
  ```
- [ ] **Step 2: Build Python wheel with `maturin`**
  ```bash
  maturin build --release
  pip install target/wheels/omniroute_fastmcp-*.whl
  ```
- [ ] **Step 3: FastMCP server definition in Python**
  ```python
  from fastmcp import FastMCP
  import omniroute_fastmcp as orcore

  mcp = FastMCP("OmniRoute")

  @mcp.tool()
  async def route_chat(model: str, messages: list[dict]) -> dict:
      """Route a chat request through OmniRoute's data plane."""
      return orcore.route_chat(model, messages)

  @mcp.tool()
  async def list_providers() -> list[dict]:
      """List all 232 supported providers."""
      return orcore.list_providers()

  if __name__ == "__main__":
      mcp.run()
  ```
- [ ] **Step 4: Mirror OmniRoute's 87 TS MCP tools as FastMCP tools**
  - One-to-one mapping: each TS tool → Python wrapper that calls Rust via `pyo3`
  - Maintain scope/audit parity with TS MCP server
- [ ] **Step 5: Run alongside TS MCP server** — both expose the same tools over different transports (TS stdio/SSE, Python stdio/SSE/Streamable HTTP)
- [ ] **Step 6: Audit log parity** — Python invocations also write to `mcp_audit` table via Rust FFI

**Why in-process vs separate Python process?** Running FastMCP in-process via `pyo3`:

- Eliminates T1 HTTP overhead (~1-2 ms per call)
- Shares Rust data plane state (no IPC serialization of combo configs, caches, etc.)
- Single deployment unit (one binary boots both Rust + embedded Python)
- Python GIL is released for `route_stream` calls (Rust async work runs independently)

**Fallback:** If `pyo3` build fails or Python interpreter not present at runtime, FastMCP tools degrade to TS MCP tools automatically. No operator action required.

---

## Phase 6: Fork Reconciliation (Ongoing)

- [ ] Maintain clean diff from upstream diegosouzapw/OmniRoute (UPSTREAM_SYNC.md)
- [ ] Extract reusable improvements for upstream PRs
- [ ] Keep fork-only code isolated (bifrost/ → Rust, vendor/bifrost/)

---

## Execution Dependencies

```
Phase 1A → Phase 1B → Phase 2A → Phase 2B → Phase 3A → Phase 4A
            Phase 1C ──► Phase 2C ──► Phase 3B ──► Phase 4B
            Phase 1D ──► Phase 2D ──► Phase 2E (Zig)   Phase 4C
                                                       Phase 4D
                                                          │
                                                     Phase 5A (Bifrost)
                                                     Phase 5B (cgo F6)
                                                     Phase 5C (Mojo, gated)
                                                     Phase 5D (FastMCP)
```

---

## Risk Register

| Risk                                          | Likelihood | Impact | Mitigation                                                      |
| --------------------------------------------- | ---------- | ------ | --------------------------------------------------------------- |
| Rust migration stalls (too much TS code)      | Medium     | High   | Phase incrementally, ship each phase independently              |
| Bifrost upstream diverges                     | Low        | Medium | Pin specific commit, maintain fork                              |
| TypeScript/Rust dual-runtime complexity       | High       | Medium | Clear gRPC contract, well-defined ownership boundaries          |
| Performance regression vs pure TS             | Low        | Medium | Benchmark gates per phase, measure p50/p95/p99                  |
| Zig shims don't outperform Rust baselines     | High       | Low    | Auto-fallback to Rust; deprecate shims                          |
| Mojo v1.0 ships late / kernels underperform   | High       | Low    | Task 5C is gated; Rust + `candle` covers gap                    |
| Python interpreter not present at deploy time | Low        | Medium | pyo3 fallback to TS MCP tools; documented in README             |
| FastMCP framework breaks (API drift)          | Medium     | Medium | Pin FastMCP version; mirror tools in TS MCP server as redundant |

---

## Success Criteria

1. **Phase 1 complete:** gRPC bridge works; Rust handles 100% of Bifrost-routed requests
2. **Phase 2 complete:** All 17 strategies working in Rust; translator covers OpenAI↔Anthropic↔Gemini; **Zig hot-path shims benchmarked** (≥2× Rust baseline OR deprecated)
3. **Phase 3 complete:** Top 10 DB modules ported to Rust; dual-read operational
4. **Phase 4 complete:** OTLP traces on all paths; p50 latency <= TypeScript baseline
5. **Phase 5A complete:** Bifrost decision made and executed
6. **Phase 5B complete:** `cgo` in-process Bifrost bridge shipped (when F6 timeline hits)
7. **Phase 5C complete:** Mojo kernels ≥2× Rust baseline on ≥3 ML kernels (when Mojo ≥v1.0 ships)
8. **Phase 5D complete:** FastMCP server runs in-process via `pyo3`; mirrors all 87 TS MCP tools
9. **Overall:** Single binary deployment (Rust + Zig shims + Go cgo + Python embedded + TypeScript dashboard assets) or minimal docker-compose
