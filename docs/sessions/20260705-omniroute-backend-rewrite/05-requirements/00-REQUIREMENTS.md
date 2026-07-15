# Requirements — OmniRoute Rust Rewrite (non-frontend)

**Session:** 20260705-omniroute-backend-rewrite / 05-requirements
**Author:** root (main thread)
**Date:** 2026-07-05 03:34Z
**Inputs:** 01-INVENTORY, 02-EVAL, 03-SURVEY, 04-STRATEGY

## 1. Functional Requirements (FRs)

### FR-CORE — Core (omni-core, omni-protocol, omni-translator, omni-storage)

| ID         | Requirement                                                                                                          | Source                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| FR-CORE-01 | `ErrorKind` enum maps to HTTP status + retry decision                                                                | `omni-core/src/error.rs` (exists)    |
| FR-CORE-02 | `Executor` trait with `Complete` and `Streaming` variants                                                            | `omni-core/src/executor.rs` (exists) |
| FR-CORE-03 | `Provider` trait with `ProviderId`, `ProviderKind`, `ProviderMetadata`                                               | `omni-core/src/provider.rs` (exists) |
| FR-CORE-04 | Config loader reads from `~/.omniroute/config.toml` + env vars + CLI flags (precedence: CLI > env > file > defaults) | new in `omni-core`                   |
| FR-CORE-05 | Wire types for OpenAI, Claude, Gemini, Codex formats                                                                 | new in `omni-protocol`               |
| FR-CORE-06 | Format detection from request headers + body shape                                                                   | new in `omni-translator`             |
| FR-CORE-07 | Translation registry: `(input_format, output_format) → translator_fn`                                                | new in `omni-translator`             |
| FR-CORE-08 | SQLite via sqlx 0.8 with the 80 .sql migrations ported                                                               | new in `omni-storage`                |
| FR-CORE-09 | Storage path: `~/.omniroute/storage.sqlite`, override via `DATA_DIR`                                                 | existing TS contract                 |

### FR-PROVIDER — Provider adapters (omni-router)

| ID         | Requirement                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| FR-PROV-01 | 30+ provider adapters in v1 (curated subset); 149 in v1.5                                                |
| FR-PROV-02 | Each adapter is a `Provider` trait impl in its own file under `crates/omni-router/src/providers/<id>.rs` |
| FR-PROV-03 | Provider registry: `omni_router::registry::register(provider)`; loaded at startup                        |
| FR-PROV-04 | Per-provider request validation (OpenAI-format, Anthropic-format, Gemini-format)                         |
| FR-PROV-05 | Per-provider response streaming (SSE) with chunk-level error handling                                    |
| FR-PROV-06 | Per-provider circuit breaker (states: CLOSED, OPEN, HALF_OPEN)                                           |
| FR-PROV-07 | Per-provider rate limit (token bucket + sliding window)                                                  |
| FR-PROV-08 | Per-provider retry with exponential backoff + jitter, idempotency-key support                            |

### FR-ROUTING — Routing strategies (omni-router, then bifrost)

| ID          | Requirement                                                                                                                                                                                                                 | Source value                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| FR-ROUTE-01 | Implement all 17 ROUTING_STRATEGY_VALUES                                                                                                                                                                                    | `src/shared/constants/routingStrategies.ts` |
| FR-ROUTE-02 | Implement all 8 AUTO_ROUTING_STRATEGY_VALUES                                                                                                                                                                                | `src/shared/constants/routingStrategies.ts` |
| FR-ROUTE-03 | Combo resolver: a combo is a list of providers + a strategy                                                                                                                                                                 | `src/domain/comboResolver.ts`               |
| FR-ROUTE-04 | Auto-combo scoring: 9 factors (cost, latency, fitness, etc.)                                                                                                                                                                | `src/domain/comboResolver.ts`               |
| FR-ROUTE-05 | 15 routing strategies (e.g. priority, weighted, round-robin, context-relay, fill-first, p2c, random, least-used, cost-optimized, reset-aware, reset-window, headroom, strict-random, auto, lkgp, context-optimized, fusion) | `src/shared/constants/routingStrategies.ts` |
| FR-ROUTE-06 | Fitness tier: best-reasoning, cheapest, moderate, balanced                                                                                                                                                                  | `src/domain/router/port.ts`                 |

### FR-HTTP — HTTP server (omni-server)

| ID         | Requirement                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-HTTP-01 | axum-based HTTP server with TLS termination (rustls)                                                                                                                                        |
| FR-HTTP-02 | All 538 Next.js routes ported (or replaced with the equivalent OpenAI-compatible surface)                                                                                                   |
| FR-HTTP-03 | OpenAI-compatible: `/v1/chat/completions`, `/v1/responses`, `/v1/embeddings`, `/v1/audio/*`, `/v1/images/*`, `/v1/models`, `/v1/files`, `/v1/batches`, `/v1/moderations`, `/v1/completions` |
| FR-HTTP-04 | Anthropic-compatible: `/v1/messages`, `/v1/messages/count_tokens`                                                                                                                           |
| FR-HTTP-05 | Provider-specific routes: `/v1/providers/<provider>/chat/completions`, etc.                                                                                                                 |
| FR-HTTP-06 | Admin: `/api/v1/management/*` (CLI-equivalent over HTTP)                                                                                                                                    |
| FR-HTTP-07 | SSE streaming for chat, responses, audio (OpenAI-compatible)                                                                                                                                |
| FR-HTTP-08 | WebSocket for A2A and opencode-plugin                                                                                                                                                       |
| FR-HTTP-09 | Request ID + trace context propagation                                                                                                                                                      |
| FR-HTTP-10 | CORS per origin policy                                                                                                                                                                      |
| FR-HTTP-11 | Per-route auth (API key, OAuth, JWT)                                                                                                                                                        |
| FR-HTTP-12 | Per-route rate limit                                                                                                                                                                        |
| FR-HTTP-13 | utoipa-generated OpenAPI spec at `/api/v1/openapi.json`                                                                                                                                     |

### FR-MCP — MCP server (omni-mcp)

| ID        | Requirement                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------- |
| FR-MCP-01 | 22 MCP tools ported (per the actual count in `open-sse/mcp-server/schemas/tools.ts`)           |
| FR-MCP-02 | stdio transport (CLI `--mcp` flag)                                                             |
| FR-MCP-03 | Streamable HTTP transport (HTTP + SSE)                                                         |
| FR-MCP-04 | 30 MCP scopes enforced via `allowScopes` / `denyTools`                                         |
| FR-MCP-05 | Tool cardinality reduction utility (already in TS at `open-sse/mcp-server/toolCardinality.ts`) |
| FR-MCP-06 | Audit log per tool call                                                                        |
| FR-MCP-07 | Heartbeat file at `~/.omniroute/mcp.heartbeat`                                                 |

### FR-A2A — A2A protocol (omni-a2a)

| ID        | Requirement                          |
| --------- | ------------------------------------ |
| FR-A2A-01 | 6 A2A skills ported                  |
| FR-A2A-02 | A2A v0.3 protocol (per AGENTS.md)    |
| FR-A2A-03 | WebSocket transport                  |
| FR-A2A-04 | Skill discovery via `/v1/a2a/skills` |

### FR-COMPRESSION — Compression engines (omni-compression)

| ID         | Requirement                                           | Source                                                  |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------- |
| FR-COMP-01 | 5 engines: adaptive, aggressive, caveman, lite, ultra | `open-sse/services/compression/`                        |
| FR-COMP-02 | Plan resolution (which engine for which content)      | `open-sse/services/compression/deriveDefaultPlan.ts`    |
| FR-COMP-03 | Engine breakdown stats                                | `open-sse/services/compression/engineBreakdown.ts`      |
| FR-COMP-04 | Progressive aging                                     | `open-sse/services/compression/progressiveAging.ts`     |
| FR-COMP-05 | Tool result compression                               | `open-sse/services/compression/toolResultCompressor.ts` |
| FR-COMP-06 | Cache-aware compression                               | `open-sse/services/compression/cachingAware.ts`         |
| FR-COMP-07 | CAVEMAN rules engine                                  | `open-sse/services/compression/cavemanRules.ts`         |
| FR-COMP-08 | Heuristic engine                                      | `open-sse/services/compression/ultraHeuristic.ts`       |
| FR-COMP-09 | Validation                                            | `open-sse/services/compression/validation.ts`           |
| FR-COMP-10 | Engine catalog                                        | `open-sse/services/compression/engineCatalog.ts`        |

### FR-CLI — CLI (omni-cli)

| ID        | Requirement                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| FR-CLI-01 | 81 subcommands ported (bin/cli/commands/*.mjs)                                                                        |
| FR-CLI-02 | 32 api-commands regenerated from the OpenAPI spec                                                                     |
| FR-CLI-03 | All global flags (`--output`, `--quiet`, `--no-color`, `--timeout`, `--api-key`, `--base-url`, `--context`, `--lang`) |
| FR-CLI-04 | TUI components (bin/cli/tui/*) — port to `ratatui`                                                                    |
| FR-CLI-05 | Tray notifications (bin/cli/tray/*) — port to `tao` + `tray-icon`                                                     |
| FR-CLI-06 | Encryption helpers (bin/cli/encryption.mjs) — port to `phenotype-crypto`                                              |
| FR-CLI-07 | SQLite helpers (bin/cli/sqlite.mjs) — port to `omni-storage`                                                          |
| FR-CLI-08 | I18n (bin/cli/i18n.mjs, bin/cli/locales/*) — port to `rust_i18n` or `fluent`                                          |

### FR-SDK — Client SDK (omni-sdk)

| ID        | Requirement                                                      |
| --------- | ---------------------------------------------------------------- |
| FR-SDK-01 | HTTP client wrapper around reqwest                               |
| FR-SDK-02 | Type-safe request/response types (re-export from omni-protocol)  |
| FR-SDK-03 | Streaming support (SSE consumer)                                 |
| FR-SDK-04 | Auth helper (API key, OAuth)                                     |
| FR-SDK-05 | Cargo feature flags for `compression`, `mcp`, `a2a`, `telemetry` |

### FR-TELEMETRY — Observability (omni-telemetry)

| ID           | Requirement                                                                                |
| ------------ | ------------------------------------------------------------------------------------------ |
| FR-TELE-01   | tracing crate with structured fields                                                       |
| FR-TELE-02   | OTel exporter (configurable: OTLP, Jaeger, console)                                        |
| FR-TELE-03   | Metrics: requests, errors, duration, tokens, cost, divergence, circuit_breaker, rate_limit |
| FR-TELE-04   | Audit log (per request, per tool call, per admin action)                                   |
| FR-TELE-05   | Health endpoint `/health` (per FR-HEALTH-01)                                               |
| FR-HEALTH-01 | `/health` returns uptime, memory, circuit breaker states, rate limit status, cache stats   |

### FR-EVAL — Eval/observe (outside omni-* crates, in `scripts/`)

| ID         | Requirement                                                                    |
| ---------- | ------------------------------------------------------------------------------ |
| FR-EVAL-01 | Router eval entry point (`bun scripts/router-eval/index.ts` → Rust equivalent) |
| FR-EVAL-02 | Compression eval entry point (`scripts/compression-eval/index.ts`)             |
| FR-EVAL-03 | Bench harness (`scripts/compression/benchmark.ts`)                             |
| FR-EVAL-04 | `usage_history` table schema (per-request log)                                 |
| FR-EVAL-05 | `call_logs` table schema (per-call log)                                        |
| FR-EVAL-06 | Replay from history (compression/harness/replay.ts pattern)                    |
| FR-EVAL-07 | Regression suite (run eval against baseline, alert on >X% drift)               |

### FR-CROSS — Cross-cutting

| ID      | Requirement                                                                       | Source                         |
| ------- | --------------------------------------------------------------------------------- | ------------------------------ |
| FR-X-01 | Auth via AuthKit (canonical Rust crate; per `pheno/crates/phenotype-port-traits`) | per session 01-AUTH-TRIAGE     |
| FR-X-02 | API key encryption at rest via `phenotype-crypto`                                 | existing TS pattern            |
| FR-X-03 | OAuth flow for 6+ providers                                                       | `src/lib/oauth/*`              |
| FR-X-04 | Per-tenant API key groups                                                         | `src/lib/db/apiKeyGroups.ts`   |
| FR-X-05 | Quota + rate limit per tenant                                                     | `src/lib/quota/*`              |
| FR-X-06 | Cost attribution per token (input/output/cache_hit)                               | `src/lib/spend/*`              |
| FR-X-07 | Resilience (circuit breaker + retry) per `phenotype-retry`                        | `src/lib/resilience/*`         |
| FR-X-08 | Caching (KV-cache reuse, prompt cache) per `phenotype-cache-adapter`              | `src/lib/promptCache/*`        |
| FR-X-09 | Compliance (per-tenant, per-region)                                               | `src/lib/compliance/*`         |
| FR-X-10 | Free proxy providers (community)                                                  | `src/lib/freeProxyProviders/*` |

## 2. Non-Functional Requirements (NFRs)

### NFR-PERF — Performance

| ID          | Target                                                 | Notes                     |
| ----------- | ------------------------------------------------------ | ------------------------- |
| NFR-PERF-01 | p99 latency < 50ms (proxy-only path, no LLM call)      | At 1k RPS on 4-core ARM64 |
| NFR-PERF-02 | p99 first-chunk latency < 100ms (streaming path)       | At 1k RPS                 |
| NFR-PERF-03 | Throughput > 10k RPS sustained on 8-core x86_64        | axum + tokio + reqwest    |
| NFR-PERF-04 | Memory < 500MB at 10k RPS                              | No leak over 24h soak     |
| NFR-PERF-05 | Cold start < 200ms (binary launch to listening socket) | Static binary, no JIT     |
| NFR-PERF-06 | Binary size < 80MB (release, stripped)                 | LTO + strip = "symbols"   |

### NFR-REL — Reliability

| ID         | Target                                                  |
| ---------- | ------------------------------------------------------- |
| NFR-REL-01 | 99.95% availability (4.4h/year downtime budget)         |
| NFR-REL-02 | 0 data loss across deploys (SQLite WAL + backup)        |
| NFR-REL-03 | Graceful shutdown on SIGTERM (drain in-flight requests) |
| NFR-REL-04 | Circuit breaker opens within 1s of provider failure     |
| NFR-REL-05 | Automatic rollback if divergence > 0.5% for 10 min      |

### NFR-SEC — Security

| ID         | Target                                                                               |
| ---------- | ------------------------------------------------------------------------------------ |
| NFR-SEC-01 | All API keys encrypted at rest (AES-GCM via `phenotype-crypto`)                      |
| NFR-SEC-02 | TLS 1.3 only (rustls)                                                                |
| NFR-SEC-03 | JWT validation via `phenotype-crypto`                                                |
| NFR-SEC-04 | OWASP Top 10 mitigation (input validation, authn/authz, etc.)                        |
| NFR-SEC-05 | No `unsafe` code in the workspace (`#![forbid(unsafe_code)]` already in `omni-core`) |
| NFR-SEC-06 | Supply chain: cargo-deny in CI, no yanked deps, license allowlist                    |

### NFR-OBS — Observability

| ID         | Target                                             |
| ---------- | -------------------------------------------------- |
| NFR-OBS-01 | OTel-compliant traces for every request            |
| NFR-OBS-02 | Structured JSON logs                               |
| NFR-OBS-03 | Metrics exported to Prometheus-compatible endpoint |
| NFR-OBS-04 | Per-tenant, per-model, per-provider dashboards     |
| NFR-OBS-05 | PagerDuty integration for SEV-1/SEV-2 alerts       |

### NFR-MAINT — Maintainability

| ID           | Target                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| NFR-MAINT-01 | All crates <= 500 lines per file; <= 350 target                                                       |
| NFR-MAINT-02 | `cargo clippy --all-targets --all-features -- -D warnings` clean                                      |
| NFR-MAINT-03 | `cargo fmt --check` clean                                                                             |
| NFR-MAINT-04 | `cargo test --workspace` >= 70% coverage                                                              |
| NFR-MAINT-05 | Proptest for all pure functions                                                                       |
| NFR-MAINT-06 | Criterion benches for hot paths                                                                       |
| NFR-MAINT-07 | Doc-accuracy discipline: every doc claim grep-verifiable (Rust equivalent of `check:fabricated-docs`) |
| NFR-MAINT-08 | Conventional Commits + cliff.toml for changelog                                                       |

### NFR-COMP — Compatibility

| ID          | Target                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------- |
| NFR-COMP-01 | Wire-compatible with all OpenAI/Anthropic/Gemini clients                                    |
| NFR-COMP-02 | Storage-compatible with the TS fork during migration (shared `~/.omniroute/storage.sqlite`) |
| NFR-COMP-03 | Env-var-compatible: all 425 env vars honored (1811 lines in `.env.example`)                 |
| NFR-COMP-04 | CLI-compatible: every TS CLI subcommand has a Rust equivalent                               |
| NFR-COMP-05 | OpenCode plugin contract stable (the `opencode-plugin` consumes the same `/v1/models` API)  |

## 3. Assumptions, Risks, Uncertainties (ARUs)

### A — Assumptions

- A1: The user will keep the scaffolded `omniroute-rust/` Cargo workspace as the v1 target.
- A2: `pheno/bifrost/` will be scaffolded by the pheno owner (separate session).
- A3: The 4-concurrency-slot sub-agent ceiling is stable; 24-week calendar assumes this.
- A4: The TS fork stays running through migration; the delete PR is at the end.
- A5: SQLite is sufficient for v1; Postgres in v2.

### R — Risks

- R1: 149 provider adapter port is the bottleneck. Mitigate: curated 30 in v1, 149 in v1.5.
- R2: Shared SQLite during migration is risky. Mitigate: additive migrations only; per AGENTS.md "no backwards compat shims" applies AFTER Phase 5.
- R3: Bifrost pivot (ADR-001) might break the `omni-router` design. Mitigate: `RouterPort` abstraction already in `src/domain/router/port.ts`; the Rust equivalent is in `omni-core`.
- R4: The OpenCode plugin (`@omniroute/opencode-plugin`) might break if the `/v1/models` shape changes. Mitigate: lock the contract before v1.
- R5: Subagent slot ceiling (4) is binding. Mitigate: slot-aware scheduling; prioritize parallel lanes.
- R6: The `tproxy` native module is out of scope. Mitigate: defer to v2; if needed in v1, port the C++ to Rust FFI.
- R7: The i18n surface (42 locales) might be needed for non-English admin users. Mitigate: defer to v1.5; admin can use English.
- R8: Postgres in v2 might require schema migration tooling. Mitigate: design v1 migrations to be Postgres-compatible (no SQLite-specific syntax in the DDL where possible).

### U — Uncertainties

- U1: Will the user accept 30 providers in v1 (vs all 149)? Default: 30 + 119 deferred.
- U2: Will the user accept SQLite-only for v1? Default: yes.
- U3: Will the user accept the bifrost pivot in v1.5 (vs v1)? Default: v1.5.
- U4: Is the OpenCode plugin a "first-class consumer"? Default: yes (must consume the same API).
- U5: Is chaos engineering in scope? Default: yes (adds ~2 weeks to Phase 2-3).
- U6: Is the i18n surface a v1 or v1.5 requirement? Default: v1.5.
- U7: Is the tproxy native module in scope? Default: no (defer to v2).
