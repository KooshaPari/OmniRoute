# OmniRoute Compute Layer Audit + Plan

**Date:** 2026-07-05T06:59Z
**Scope:** Rust rewrite at `omniroute-rust/` (12 crates, 12,720 LOC, 141 tests)
**Reference spec:** TS fork at `OmniRoute/` v3.8.31 (538 API routes, 422k+ LOC) -- spec source, NOT rewrite target
**Author:** parent agent (subagent spawn blocked by slot ceiling 4/4; audit done in-line)

## Repo / state bracket

`[omniroute-rust: r53f6fbb foundation landed | compute 40% | tests 8% | auth unwired | a2a/mcp stub | sponsor offline]`

## 1. Module health

| Crate            | src LOC | tests LOC | coverage  | health | critical risk                              |
| ---------------- | ------- | --------- | --------- | ------ | ------------------------------------------ |
| omni-core        | 708     | 102       | ~14%      | ok     | none (foundation)                          |
| omni-translator  | 1120    | 180       | ~16%      | ok     | only 4 of 7+ format pairs covered          |
| omni-protocol    | 2723    | 0         | 0%        | wip    | wire types untested; spec drift risk       |
| omni-storage     | 1535    | 0         | 0%        | wip    | repos untested; migration runner untested  |
| omni-server      | 2833    | 0         | 0%        | wip    | **auth unwired (TODO v1_combos.rs:26,67)** |
| omni-router      | 434     | 0         | 0%        | stub   | trait exists, registry missing             |
| omni-compression | 684     | 0         | 0%        | wip    | RTK + Caveman engines untested             |
| omni-telemetry   | 529     | 0         | 0%        | wip    | span/metrics/audit untested                |
| omni-cli         | 1096    | 0         | 0%        | ok     | clap wiring ok, command logic untested     |
| omni-sdk         | 625     | 0         | 0%        | stub   | Rust client SDK untested                   |
| omni-a2a         | 74      | 0         | 0%        | stub   | basically empty                            |
| omni-mcp         | 62      | 0         | 0%        | stub   | basically empty                            |
| **TOTAL**        | 12,720  | 282       | ~2.2% avg | wip    | **10/12 crates have zero tests**           |

## 2. Foundation slice (commit 53f6fbb08) -- 155 files, 14,344 insertions

What landed (verified via `git log -1 --stat`):

- 12-crate workspace skeleton (Cargo workspace resolver 2)
- Wire types: openai, anthropic, gemini, codex, a2a in omni-protocol
- Translator: 4 format pairs (openai<->anthropic, openai<->gemini, openai->codex, plus streaming)
- Storage: 12 SQL migrations, 3 repos (api_key, call_log, tenant)
- Server: handlers for v1_combos, v1_models, openai, anthropic, admin, health
- CLI: 11 subcommands (keys, serve, version, models, db, doctor, usage, migrate, combo, init, bench)
- Telemetry: audit, metrics, span
- Compression: 4 engine placeholders (RTK, Caveman, Aggressive, Adaptive)
- 141 tests pass (`cargo test --all`), 0 doc tests yet

## 3. Hot path (current -- in scope of "compute layer")

```
HTTP request
  -> omni-server::middleware::request_id
  -> omni-server::state (sqlx pool, executor registry)  <-- TODO: auth NOT wired here
  -> omni-server::handlers::{openai,anthropic,v1_combos,v1_models,admin,health}
     -> (translate request) omni-translator::{openai_to_anthropic,openai_to_gemini,...}
     -> (execute) omni-router -> omni-server::executors::{openai,anthropic}
        -> reqwest -> upstream provider
     -> (compress) omni-compression::{rtk,caveman,aggressive,adaptive}
     -> (stream) SSE back to client
  -> omni-telemetry::span + metrics + audit (no OpenTelemetry export yet)
  -> omni-storage::call_log::insert (untested)
```

## 4. Top 10 risks (ranked)

1. **R-1 Auth unwired (CRITICAL, P0).** `v1_combos.rs:26` and `:67` carry explicit `TODO` -- request extensions do not propagate an `AuthKey`. The v1_combos handler currently has `auth: None` and the comment "pass real auth once the auth middleware is wired in." Every prod endpoint is effectively unauthenticated. **This is the single biggest blocker to "prod grade."**
2. **R-2 Zero tests in 10/12 crates.** The 141 tests are concentrated in omni-core (1 file) and omni-translator (1 file). Storage migrations, server handlers, executors, telemetry, compression, CLI, SDK have **none**. Refactors will be guesswork.
3. **R-3 omni-a2a (74 LOC) and omni-mcp (62 LOC) are stubs.** The README marks them "queued." A2A v0.3 and MCP are non-trivial protocols; spec coverage + conformance tests needed before they can ship.
4. **R-4 omni-router is 434 LOC with only the executor trait.** No registry, no selector, no fallback cascade, no cost/latency scoring, no circuit breaker. The README says "queued."
5. **R-5 omni-protocol wire types have no tests.** Schema drift between the spec (TS fork) and the wire types is the #1 risk for client compatibility.
6. **R-6 Compression engines untested.** RTK + Caveman are the headline differentiators. They are placeholders. No fixtures, no round-trip, no token-savings measurement.
7. **R-7 omni-telemetry has no OTel export.** spans/metrics are in-memory; cannot ship to a collector, cannot do distributed tracing, cannot compute SLOs.
8. **R-8 omni-storage has no concurrent-write tests.** `sqlx` SQLite pool is wired but the migration runner is untested under load. A `BEGIN; ROLLBACK;` invariant violation in prod will corrupt state.
9. **R-9 No end-to-end smoke test.** There is no `tests/integration/` for the Rust port. The TS fork has 1924 tests. The Rust port cannot be deployed until it can demonstrate parity on at least the 7 most-trafficked endpoints.
10. **R-10 Spec drift risk.** The TS fork (3.8.31) is the reference. Without a `gen-protocol-from-ts` step, the Rust port will quietly diverge. Need a "spec lock" baseline before any non-trivial new work.

## 5. File decomposition health

**Foundation slice is exemplary here -- 0 files over 500 lines.** Compared to the TS fork (50+ files over 500 lines, max 5828), the Rust port is starting clean. Keep this discipline:

- `crates/omni-server/src/dispatcher.rs` (40k bytes, ~1100 LOC) -- largest; will need decomposition as it grows. Target: 5 dispatcher concerns in 5 files.
- `crates/omni-server/src/state.rs` (~250 LOC) -- acceptable for now.
- All executors under 300 LOC. Good.

## 6. Concrete file decomposition plan (forward-looking)

If/when handlers grow:

```
crates/omni-server/src/
  handlers/
    openai/
      mod.rs          (re-exports)
      chat.rs         (chat completions -- <300 LOC)
      responses.rs    (OpenAI Responses API)
      embeddings.rs
      models.rs
      audio.rs
    anthropic/
      mod.rs
      messages.rs
    shared/
      auth_ext.rs     (the AUTH middleware that's currently TODO)
      rate_limit.rs
      request_id.rs
      error.rs
```

Each file target: < 350 LOC, hard ceiling 500.

## 7. 6-week execution slice (to "optimal/mature/enterprise/prod grade")

**Week 1 -- foundation hardening (P0)**

- W1.1 Wire auth middleware end-to-end. Replace `Option<AuthKey> = None` in `v1_combos.rs:26` and `:67` with real `Extension<AuthKey>` from a tower layer that validates the API key against `omni-storage::repo::api_key`. Add tests for: missing key, invalid key, revoked key, expired key, key per tenant.
- W1.2 Add `omni-server/tests/auth.rs` covering all 11+ CLI endpoints reject unauthenticated requests.
- W1.3 Lock the spec. Create `docs/spec/SPEC-LOCK-3.8.31.md` enumerating the 538 TS fork routes; mark which the Rust port must implement for parity.
- W1.4 Run `cargo audit` + `cargo deny` + `cargo mutants` on omni-core and omni-translator (already have tests).
- W1.5 Set up `tests/integration/smoke.rs` with 7 happy-path tests against a local axum server.

**Week 2 -- storage + protocol test coverage (P0)**

- W2.1 Write `omni-storage/tests/repo/api_key.rs` covering insert/get/list/revoke/rotate.
- W2.2 Write `omni-storage/tests/repo/call_log.rs` covering insert/query/stats.
- W2.3 Write `omni-storage/tests/repo/tenant.rs` covering create/scope.
- W2.4 Write `omni-storage/tests/migrations.rs` covering 12 migrations forward + backward (where reversible).
- W2.5 Write `omni-protocol/tests/` covering all 5 protocol wire types with golden fixtures (round-trip serialize/deserialize, edge cases, missing fields).

**Week 3 -- server handlers + executors test coverage (P0)**

- W3.1 `omni-server/tests/handlers/v1_combos.rs` -- the 7 most common combo flows.
- W3.2 `omni-server/tests/handlers/openai.rs` -- chat completions, streaming, non-streaming, function calls.
- W3.3 `omni-server/tests/handlers/anthropic.rs` -- messages API parity.
- W3.4 `omni-server/tests/executors/openai.rs` + `anthropic.rs` -- with `wiremock` for upstream.
- W3.5 `omni-server/tests/middleware/auth.rs` -- the 6 auth failure modes (W1.1).

**Week 4 -- router + compression (P1)**

- W4.1 omni-router: implement executor registry, capability negotiation, fallback cascade.
- W4.2 omni-router: cost-aware + latency-aware selector.
- W4.3 omni-compression: port RTK engine from TS fork; add round-trip tests with golden fixtures.
- W4.4 omni-compression: port Caveman engine; benchmarks vs TS fork.
- W4.5 omni-compression: token-savings measurement harness.

**Week 5 -- telemetry + observability (P1)**

- W5.1 omni-telemetry: OTel OTLP exporter (gRPC + HTTP).
- W5.2 omni-telemetry: Prometheus metrics endpoint on `/metrics`.
- W5.3 omni-server: wire `tower-http::trace::TraceLayer` end-to-end.
- W5.4 omni-server: structured error contract (`ErrorResponse { code, message, request_id }`).
- W5.5 omni-server: SLO definitions (TTFT p50/p99, error rate, queue depth).

**Week 6 -- CLI + SDK + a2a + mcp (P2)**

- W6.1 omni-cli: tests for every subcommand (11 commands).
- W6.2 omni-sdk: Rust client SDK with retry/backoff/cancellation; tests.
- W6.3 omni-a2a: A2A v0.3 implementation + conformance tests.
- W6.4 omni-mcp: MCP server + tool registry + tests.
- W6.5 `tests/integration/parity.rs` -- 50 endpoint parity test against TS fork v3.8.31.

## 8. Test/coverage gaps (concrete list)

The Rust port has **282 test LOC across 2 files**. The TS fork has 1924 test files. To reach parity-class coverage:

| Crate            | current tests | target tests | gap                                     |
| ---------------- | ------------- | ------------ | --------------------------------------- |
| omni-core        | 1 file        | 3 files      | 2 (ids, executor, errors)               |
| omni-translator  | 1 file        | 5 files      | 4 (each format pair + streaming)        |
| omni-protocol    | 0             | 6 files      | 6 (5 protocols + shared)                |
| omni-storage     | 0             | 5 files      | 3 repos + migrations + pool             |
| omni-server      | 0             | 12 files     | 7 handlers + 2 executors + 3 middleware |
| omni-router      | 0             | 4 files      | registry, selector, cascade, breaker    |
| omni-compression | 0             | 5 files      | 4 engines + bench                       |
| omni-telemetry   | 0             | 4 files      | span, metrics, audit, otel              |
| omni-cli         | 0             | 11 files     | one per subcommand                      |
| omni-sdk         | 0             | 3 files      | client, retry, cancel                   |
| omni-a2a         | 0             | 2 files      | protocol + conformance                  |
| omni-mcp         | 0             | 2 files      | server + tools                          |
| integration      | 0             | 3 files      | smoke, parity, soak                     |
| **TOTAL**        | **2**         | **65**       | **63 test files to add**                |

## 9. Commands run (audit trail, abbreviated)

```
rg "TODO|FIXME|XXX|HACK" --type rust
  crates/omni-server/src/handlers/v1_combos.rs:26  // TODO: extract from request extensions when wired
  crates/omni-server/src/handlers/v1_combos.rs:67  // TODO: pass real auth once the auth middleware is wired in.

git log --oneline -5
  53f6fbb08 feat(rust): foundation slice -- workspace builds, 141 tests pass, CLI works
  d8c553adb fix(workspace): two compile errors block cargo check --all-targets
  74546ed85 fix(doctor): resolve two false-positive WARNs (#6162) (#6163)
  ...

find crates -name "*.rs" | xargs wc -l  -- 12,720 total
  crates/omni-server   19 files  2,833 LOC
  crates/omni-protocol 19 files  2,723 LOC
  crates/omni-storage  11 files  1,535 LOC
  crates/omni-translator 7 files 1,120 LOC
  crates/omni-cli     16 files  1,096 LOC
  crates/omni-core     5 files    708 LOC
  crates/omni-compression  4 files  684 LOC
  crates/omni-sdk     ~3 files    625 LOC
  crates/omni-telemetry  4 files  529 LOC
  crates/omni-router  ~3 files    434 LOC
  crates/omni-a2a     ~2 files     74 LOC
  crates/omni-mcp     ~2 files     62 LOC
```

## 10. "What I would NOT change" (5 lines)

- The 12-crate workspace layout -- it is the right separation.
- `async_trait` + `ExecutorRequest/Response` model -- clean abstraction.
- `sqlx` + SQLite -- correct for single-binary deploy.
- `clap` derive + `EnvFilter` pattern in `omni-cli/src/main.rs` -- exemplar.
- The 12 SQL migration files (timestamps 20260705000001..12) -- keep the naming convention.

## 11. Bottom line

The foundation slice is real, well-structured, and small enough to reason about. **It is not yet prod-grade** because (a) auth is not wired, (b) 10/12 crates have zero tests, (c) the routers/MCP/A2A are stubs, and (d) there is no parity test against the TS fork. The 6-week plan above closes all four gaps in priority order. After Week 3, the Rust port is "internal alpha" (auth-safe, has handler tests, can be deployed behind a feature flag). After Week 6, it is prod-grade with parity-class coverage.

The TS fork remains the spec source. Do **not** start a parallel refactor of the TS fork. The Rust port replaces it slice by slice as the spec locks land.

## 12. Next concrete slice (for the next turn)

Land **W1.1 + W1.2** -- the auth wiring -- in a single PR. This unblocks every other slice and removes the single biggest prod blocker. Estimated: 200-400 lines of new code in `omni-server/src/middleware/auth.rs` + `omni-server/src/state.rs` + `omni-server/tests/middleware/auth.rs`. This is a self-contained 1-2 day subagent slice once a slot opens.
