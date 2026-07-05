# 03 — Rewrite Plan: Polyglot Tier-2 Surface for OmniRoute

> **Companion docs**: `01_BACKEND_AUDIT.md` (current surface), `02_STACK_RESEARCH.md` (language decision).
> **Repo**: `omniroute-upstream-work` (TS Tier-2 + TS→Bifrost relay); `omniroute-rust/` (parallel 12-crate Rust attempt, ~10k LOC, 124 tests).
> **Decision**: Tier 1 stays as `maximhq/bifrost` (Go sidecar, already in production). Tier 2 hot-path daemons move to Rust. Selective Zig for leaf utilities. Defer Mojo.

## 1. Phases (overview)

| Phase  | Name                              | Goal                                                                                                                                                                                                                                                                 | Outcome                                                                                                                   | Effort     |
| ------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **0**  | Foundation                        | Existing `omniroute-rust/` workspace compiles, tests pass, server boots, Bifrost relay works.                                                                                                                                                                        | Done (this turn — verified `cargo check --workspace` ✅, `cargo test --workspace` 124 ✅).                                | 0.5d spent |
| **1**  | Rust Tier-2 skeleton v1           | `omni-server` serves `/v1/chat/completions` via the existing TS `open-sse` executors over IPC, behind a Rust axum front door. Auth, CORS, request-id, health, admin pass.                                                                                            | Rust front door proxies to TS executor runtime. The Tier-2 Rust surface becomes the public entry; TS backend is internal. | 5d         |
| **2**  | Translation + compression in Rust | The 9-format translator + RTK/Caveman live in Rust (already in `omni-translator` + `omni-compression`; expand test coverage to golden-set parity).                                                                                                                   | Translation parity with TS via `tests/golden-set/*` regression.                                                           | 7d         |
| **3**  | Storage in Rust + migrations      | `omni-storage` runs on the production data dir; 97 migrations ported; live migration of existing TS databases.                                                                                                                                                       | Operators can switch from TS to Rust backend with one env flip and no data loss.                                          | 7d         |
| **4**  | First 25 executors in Rust        | The 25 most-used executors ported from TS to Rust (see audit §3).                                                                                                                                                                                                    | Tier-1 routing can stay on Bifrost for the rest; we can flip the 25 one at a time.                                        | 14d        |
| **5**  | MCP server in Rust (rmcp)         | All 94 tools ported to `omni-mcp` with the `rmcp` SDK; stdio + SSE + streamable-HTTP transports.                                                                                                                                                                     | `omniroute --mcp` is a Rust binary; the TS MCP server is deprecated.                                                      | 10d        |
| **6**  | A2A server in Rust                | All 6 skills + agent card + JSON-RPC 2.0 in `omni-a2a`; A2ATaskManager ported.                                                                                                                                                                                       | `POST /a2a` is served by Rust.                                                                                            | 5d         |
| **7**  | MITM proxy in Rust                | `src/mitm/` replaced by `omni-mitm` crate using `rustls` + `rcgen` + `instant-acme`. Cert manager + DNS + tproxy + inspector.                                                                                                                                        | The TS MITM is removed; all traffic goes through `omni-mitm`.                                                             | 14d        |
| **8**  | CLI in Rust (clap 4.5)            | `bin/omniroute.mjs` replaced by Rust binary using `clap` + `clap-ext` macros. All subcommands: start, stop, migrate, providers, secrets, encrypt, decrypt, audit, usage, mcp, --reset-encrypted-columns.                                                             | `omniroute` is a single static Rust binary.                                                                               | 5d         |
| **9**  | Selective Zig leaf                | One or two hot paths (tokenizer, prompt compression) extracted to Zig, called via FFI from Rust.                                                                                                                                                                     | Demonstrates the polyglot boundary; concrete win on tokenization latency.                                                 | 7d         |
| **10** | Deprecate TS backend              | Remove `open-sse/`, `src/lib/`, `src/server/`, `src/mitm/`, `bin/omniroute.mjs` (all replaced). Keep only `src/app/` (Next.js UI) and the `src/app/api/v1/relay/chat/completions/bifrost/route.ts` (since that's the TS side of the Bifrost relay — owned by Maxim). | TS backend is gone; what remains is the UI + the Bifrost relay route.                                                     | 3d         |
| **11** | CI + distribution                 | `cargo-dist` for multi-target; `cargo-chef` Docker build; release pipeline; `cargo-deny`; `cargo-audit`; clippy pedantic; rustfmt; miri for unsafe (none expected).                                                                                                  | Release pipeline ships `omniroute` binaries for macOS arm64/x86_64 + Linux arm64/x86_64 (musl + glibc) + Docker images.   | 5d         |
| **12** | Hardening                         | Load test (50k rps), chaos test, security audit (OWASP), OTel dashboards, SLOs, runbook.                                                                                                                                                                             | Production-grade.                                                                                                         | 7d         |

**Total: ~90 days** of focused work, parallelizable across 3-4 lanes.

## 2. Slices (decision-complete, ready to implement)

### Slice 0.1 — DONE THIS TURN

Fix the `cargo check` error in `omni-server` (the `ProviderId` re-export) and verify the workspace builds.

- `omniroute-rust/crates/omni-router/src/lib.rs:17` — add `ProviderId` to `pub use`
- `cargo check --workspace` ✅
- `cargo test --workspace` ✅ (124 tests pass)
- **5 trivial warnings remain in `omni-server` (unused imports/vars in scaffold) — fix in slice 1.1**

### Slice 1.1 — Scaffold cleanup + first integration test (manager: 0.5d, implementer: 1d)

- Fix the 5 warnings in `omni-server/src/handlers/openai.rs` and `omni-server/src/executors/openai.rs` (unused imports, unused variable)
- Add an integration test in `omni-server/tests/integration_health.rs` that boots the server, hits `/healthz`, asserts 200
- Add a `justfile` recipe for `cargo test --workspace` + `cargo clippy --workspace --all-targets -- -D warnings`
- **Acceptance**: `cargo test --workspace` clean, `cargo clippy --workspace --all-targets -- -D warnings` passes, no warnings

### Slice 1.2 — Bifrost relay parity in Rust (manager: 1d, implementer: 3d)

The fork's `src/app/api/v1/relay/chat/completions/bifrost/route.ts` is the TS hot path that forwards to Bifrost. Mirror it in Rust:

- `omni-server/src/handlers/relay_bifrost.rs` — POST `/v1/chat/completions/bifrost` (or `/v1/relay/chat/completions/bifrost` to match the existing path) that:
  - Authenticates the request (reuse the auth pipeline in `omni-server/src/auth.rs`)
  - Forwards the JSON body to `${BIFROST_BASE_URL}/v1/chat/completions` via `reqwest`
  - Streams the SSE response back to the client (use `axum::body::Body::from_stream` + `async_stream`)
  - On 502/504, returns the `X-Bifrost-Fallback` header pointing to the TS fallback (deprecate the TS route in slice 10)
- Config: `BIFROST_BASE_URL`, `BIFROST_TIMEOUT_MS`, `BIFROST_MAX_RETRIES` (from env via `figment`)
- Add `reqwest-eventsource` dep for upstream SSE parsing if we need to reframe chunks
- Test: a `wiremock` (or `httpmock`) integration test that records the upstream call + asserts the SSE stream comes through
- **Acceptance**: round-trip curl works against a local mock Bifrost, identical response shape to the TS route, p99 < 50ms added latency vs. direct Bifrost

### Slice 1.3 — Auth pipeline parity (manager: 1d, implementer: 2d)

Port the `src/server/authz/*` (classify → policy → assert → route guard) to Rust in `omni-server/src/middleware/`:

- `classify.rs` — route classification (PUBLIC / CLIENT_API / MANAGEMENT)
- `policies/{public,client_api,management}.rs` — three policy enforcers
- `assertAuth.rs` — token verification (re-use `jose` crate for JWT, or `jsonwebtoken`)
- `csrf.rs` — CSRF token check (matching `src/server/authz/csrf.ts`)
- `peer_stamp.rs` — peer stamp (matching `src/server/authz/peerStamp.ts`)
- `access_token_auth.rs` — access token auth (matching `src/server/authz/accessTokenAuth.ts`)
- Test: for each of the 3 policies, positive + negative cases
- **Acceptance**: an integration test that hits a management route without auth → 401, with management auth → 200, with client-api auth → 403

### Slice 2.1 — Translation parity (manager: 1d, implementer: 4d)

The 9 formats × request + response = 18 translator pairs. The Rust `omni-translator` crate has 6 of the translators (anthropic_to_openai, gemini_to_openai, openai_to_anthropic, openai_to_codex, openai_to_gemini, plus streaming). Port the missing ones:

- `openai_to_kiro`, `kiro_to_openai`
- `openai_to_antigravity`, `antigravity_to_openai`
- `openai_to_cursor`, `cursor_to_openai`
- `openai_to_claude_response` (for the Responses API path)
- `gemini_to_claude`, `claude_to_gemini`
- Reuse the `tests/golden-set/*` from the TS repo as regression inputs (write a Rust harness that reads the golden fixtures and asserts the Rust translator output matches the TS output within tolerance for `tool_calls`, `usage`, `content`).
- **Acceptance**: `cargo test -p omni-translator` shows ≥ 90% golden-set parity; the remaining 10% documented as known-delta in `05_KNOWN_ISSUES.md`

### Slice 2.2 — Compression parity (manager: 0.5d, implementer: 3d)

`omni-compression` already has RTK, Caveman, Aggressive, Adaptive, pipeline, preserver, tokenizer (684 LOC). Expand test coverage to mirror the TS test count (the TS side has `caveman.ts`, `rtk.ts`, `aggressive.ts`, `adaptive.ts`, plus the analytics write path). Add 5 + 5 = 10 new golden-set regression tests that compare Rust vs TS compression on the same input.

- **Acceptance**: compression round-trip identical for the 50 most common golden prompts

### Slice 3.1 — Storage live migration (manager: 1d, implementer: 4d)

- Audit the 97 TS migrations in `src/lib/db/migrations/`
- Port the canonical schema to `omni-storage/src/migrations/` using `sqlx::migrate!`
- Write a one-way TS → Rust data exporter (read the TS SQLite, write to the Rust SQLite via `sqlx`); idempotent; runs as `omniroute migrate --from=ts --to=rust`
- Add an integration test that runs both migrations on a fixture DB and asserts the row counts + critical hashes match
- **Acceptance**: a production-size TS DB (1 GB, 1M call_logs) migrates to Rust in < 5 min, zero data loss, all FKs preserved

### Slice 3.2 — Repos parity (manager: 0.5d, implementer: 2d)

`omni-storage/src/repo/` has api_key, call_log, tenant. Add: provider, combo, settings, usage, audit, request_log, model_alias, model_metadata, oauth_state, encryption_key, mgmt_password_hash, mcp_audit, webhook_delivery, mcp_session. Match the TS schema column-for-column.

- **Acceptance**: every TS table is represented in `omni-storage` with an `#[derive(FromRow)]` model + a typed repo with the canonical CRUD methods

### Slice 4.x — Executor ports (manager: ongoing, implementer: 14d)

Top 25 most-used providers (see audit §3) ported in waves of 5:

| Wave | Executors                                                                              | Notes                                                                          |
| ---- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 4.1  | openai, openai-compatible-routing, azure-openai, vertex, bedrock                       | The OpenAI-compatible surface; Vertex + Bedrock need their own request signing |
| 4.2  | claude-web, claude-web-with-auto-refresh, codex, antigravity, kiro                     | OAuth flows + auto-refresh; reuse `oauth2` crate                               |
| 4.3  | gemini-web, gemini-business, chatgpt-web, deepseek-web, deepseek-web-with-auto-refresh | Web-emulation + API-key paths                                                  |
| 4.4  | copilot-web, copilot-m365-web, grok-web, grok-cli, qwen-web                            | Mostly web; the CLI variants need the local auth bridge                        |
| 4.5  | kimi-web, doubao-web, windsurf, perplexity-web, glm                                    | Web-emulation; share the browser-headers pattern from `open-sse/services/`     |

Each executor: trait impl + tests + integration test against a recorded wire fixture + a `provider.toml` config entry that the registry loads at boot.

- **Acceptance**: 25 executors in Rust, each with ≥ 5 unit tests + 1 integration test, no regressions in the golden-set

### Slice 5.x — MCP server in Rust (manager: 1d, implementer: 7d)

- Add `rmcp = "0.3"` to `Cargo.toml`
- Port the 94 tools in 4 waves of ~24:
  - **5.1**: routing + cache + compression (34 base tools from `mcp-server/schemas/tools.ts`)
  - **5.2**: memory + skills + agent-skills (10 tools)
  - **5.3**: pool + gamification + plugins (22 tools)
  - **5.4**: notion + obsidian (28 tools)
- Three transports: stdio (`omniroute --mcp`), SSE (`POST/GET /api/mcp/sse`), streamable-HTTP (`POST/GET/DELETE /api/mcp/stream`)
- Test: each tool has a happy-path + 2 error-path tests
- **Acceptance**: Claude Desktop connects via stdio, lists 94 tools, calls each tool succeeds (against a fixture DB)

### Slice 6.x — A2A in Rust (manager: 0.5d, implementer: 3d)

- `omni-a2a` has stubs for AgentCard, Task, A2aRegistry. Expand:
  - JSON-RPC 2.0 handler at `POST /a2a` over axum
  - Agent card at `GET /.well-known/agent.json` (versioned from `omni-core::Config::version`)
  - 6 skills: `agentDispatch`, plus 5 more from `src/lib/a2a/taskExecution.ts`
  - REST endpoints at `/api/a2a/{status,tasks,cancel}`
  - A2ATaskManager ported from `src/lib/a2a/taskManager.ts` (5-min TTL via `tokio::time`)
- **Acceptance**: an `a2a-client` test harness can discover the agent card, submit a task, poll until completion, and assert the result

### Slice 7.x — MITM in Rust (manager: 2d, implementer: 10d)

- New crate `omni-mitm` in the workspace
- Replace `src/mitm/`:
  - `cert.rs` — dynamic cert gen via `rcgen`
  - `manager.rs` — runtime + stub (matches `src/mitm/manager.runtime.ts` + `manager.stub.ts`)
  - `dns.rs` — DNS resolution + DNS-over-HTTPS
  - `tproxy.rs` — transparent proxy (Linux `IP_TRANSPARENT` socket; macOS `pf` rule)
  - `inspector.rs` — request/response inspector
  - `system_commands.rs` — privileged command channel
  - `upstream_trust.rs` — upstream cert pinning
  - `socket_timeouts.rs` — per-connection timeouts
  - `mask_secrets.rs` — pattern-based secret masking in the inspector
- TLS via `rustls` 0.23; ACME via `instant-acme`
- Test: capture-and-replay test against a known provider, assert the cert is per-SNI, secrets are masked
- **Acceptance**: a `curl -x http://localhost:20128 https://api.openai.com/v1/chat/completions` round-trips through `omni-mitm` and the inspector logs the request without leaking the API key

### Slice 8.x — CLI in Rust (manager: 1d, implementer: 4d)

- `omni-cli/src/main.rs` becomes a clap-derive binary
- Subcommands (mirror `bin/cli/program.mjs`):
  - `start` — boots `omni-server`
  - `stop`, `restart` — pidfile + signal
  - `migrate` — runs migrations (delegates to `omni-storage`)
  - `providers {list,test,add,remove}` — calls into `omni-router`
  - `secrets {set,get,list,delete}` — encrypted-secret CRUD
  - `encrypt`, `decrypt` — single-value helpers
  - `audit` — query `mcp_audit` + `audit_log`
  - `usage` — query `call_log` aggregations
  - `config {get,set,show,validate}` — layered config
  - `mcp` — stdio MCP server (delegates to `omni-mcp`)
  - `tui` — optional bubbletea-style TUI (can defer to a Go thin wrapper using `KWatch`'s pattern; not on the critical path)
  - `reset-encrypted-columns` — recovery tool (mirror the TS version's behavior)
- Use `clap-ext` (user's crate) for the derive macros
- Tests: every subcommand has a CLI integration test
- **Acceptance**: `omniroute --version`, `omniroute start`, `omniroute providers list`, `omniroute mcp` all work; the test suite is 1:1 with the TS CLI test surface

### Slice 9.x — Selective Zig leaf (manager: 1d, implementer: 4d)

- New crate `crates/omni-tok-zig/` with a `build.rs` that invokes `zig build` to produce a `.dylib` / `.so` named `libomni_tok`
- Zig sources implement: BPE encode/decode for the 4 tokenizer families used in the fork (claude, gpt-4, gpt-4o, gemini); export `omni_tok_count`, `omni_tok_encode`, `omni_tok_decode` as C ABI
- Rust `omni-compression/src/tokenizer.rs` calls into the Zig lib via `libloading` (pattern from `pheno-forge-smoke/src/main.rs`)
- Benchmark: assert the Zig tokenizer is ≥ 1.5x faster than the pure-Rust fallback on a 100k-token corpus
- **Acceptance**: `cargo bench -p omni-compression tokenizer` shows Zig wins; the Rust fallback stays for platforms where the Zig lib is unavailable

### Slice 10 — Deprecate TS backend (manager: 1d, implementer: 2d)

- Remove `open-sse/`, `src/lib/`, `src/server/`, `src/mitm/`, `bin/omniroute.mjs` (everything except `src/app/` and the Bifrost relay route)
- Move the Bifrost relay route from TS to a thin Rust handler that delegates to Bifrost (it's already 90% there in slice 1.2)
- The Next.js UI (`src/app/`) stays as-is
- Update `package.json` to drop TS-specific deps (next.js still needed for the UI)
- **Acceptance**: `cargo build --release` produces a single static `omniroute` binary that does everything the old TS process did; `omniroute --dev` starts the Next.js UI subprocess for the dashboard

### Slice 11 — CI + distribution (manager: 1d, implementer: 4d)

- `.github/workflows/ci.yml` — `cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo fmt --check`, `cargo deny check`, `cargo audit`
- `cargo-dist` for multi-target release: `linux-x64-gnu`, `linux-arm64-gnu`, `linux-x64-musl`, `linux-arm64-musl`, `macos-x64`, `macos-arm64`
- `Dockerfile` using `cargo-chef` for cached dependency layers; distroless final image
- `homebrew-tap` formula (or scoop, or nix flake — pick one)
- **Acceptance**: `cargo dist build` produces 6 binaries + 2 tarballs + 2 installers; `docker build` produces a 50 MB distroless image

### Slice 12 — Hardening (manager: 2d, implementer: 5d)

- Load test with k6 or vegeta: 50k rps chat completions, 100k open SSE streams, p99 < 200ms
- Chaos test: kill -9 one Bifrost instance, assert automatic fallback
- Security audit: `cargo audit`, `cargo deny check advisories`, OWASP LLM Top 10
- OTel dashboards (use the user's `pheno-otel`)
- SLOs: 99.95% availability, p99 latency < 200ms, error rate < 0.1%
- Runbook in `docs/runbook.md`
- **Acceptance**: load test green, chaos test green, security audit clean, runbook peer-reviewed

## 3. Milestones (date-aligned)

| Date       | Milestone                                                                     |
| ---------- | ----------------------------------------------------------------------------- |
| 2026-07-05 | Slice 0.1 ✅ (workspace compiles, 124 tests pass). Slice 1.1 starts.          |
| 2026-07-12 | Slice 1.x complete (Rust front door with auth, Bifrost relay, health, admin). |
| 2026-07-19 | Slice 2.x complete (translation + compression parity with golden-set).        |
| 2026-07-26 | Slice 3.x complete (storage live migration + repos parity).                   |
| 2026-08-09 | Slice 4.x complete (25 executors in Rust).                                    |
| 2026-08-23 | Slice 5.x + 6.x complete (MCP + A2A in Rust).                                 |
| 2026-09-06 | Slice 7.x complete (MITM in Rust — longest slice).                            |
| 2026-09-13 | Slice 8.x + 9.x complete (CLI in Rust + selective Zig).                       |
| 2026-09-20 | Slice 10 complete (TS backend deprecated).                                    |
| 2026-09-27 | Slice 11 complete (CI + distribution).                                        |
| 2026-10-04 | Slice 12 complete (hardening). Production-grade.                              |

## 4. Ownership (parallel lanes)

The user is the sponsor; the manager agent is the root. Implementation lanes:

- **Lane A (Rust server + handlers + auth)**: 1 senior Rust agent
- **Lane B (translation + compression + storage)**: 1 Rust agent
- **Lane C (executors + MITM)**: 1 Rust agent (later; can start as 1)
- **Lane D (MCP + A2A + CLI)**: 1 Rust agent
- **Lane E (Zig leaf + benchmarks)**: 0.5 agent
- **Lane F (CI + distribution + hardening)**: 0.5 agent (later)

Concurrency budget: 4 subagents at any time. Phases 1-3 need lanes A+B+D. Phase 4 unlocks lane C. Phase 5-6 need D. Phase 7 needs C. Phase 8 needs D. Phase 9 needs E. Phase 10-12 need F.

## 5. Risks + mitigations

| Risk                                                                   | Mitigation                                                                                                                                                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `axum 0.7 → 0.8` migration of the user's `AuthKit` crate blocks lane A | Pin axum 0.7 in `omni-server` for now, upgrade after slice 1.2 (or in parallel)                                                                                              |
| 97 TS migrations contain data shape drift the audit didn't catch       | Slice 3.1 includes a row-level hash diff; any drift becomes a known-delta                                                                                                    |
| 25 executors are not enough to cut over from Bifrost                   | Slice 4.x is staged; operators flip per-provider; 25 covers ~90% of production traffic per `freeProviderRankings.ts`                                                         |
| The TS `tsx/esm` runtime in the CLI is hard to drop                    | Slice 8 includes a one-time `omniroute init` that re-runs from a compiled Rust binary; the old `omniroute.mjs` stays as a thin shim that calls the Rust binary for 1 release |
| MCP scope enforcement in TS is a deep pattern (30 scopes × 94 tools)   | Port scope table as data, not as code; mirror in `omni-mcp/src/scopes.rs`                                                                                                    |
| Bifrost sidecar upgrade (Maxim's roadmap)                              | Slice 1.2 keeps the TS fallback route available; one env flip switches between the Rust and TS relays                                                                        |
| Cargo workspace compile time grows past 90s                            | `sccache` + `mold` linker + `--target-dir` in CI                                                                                                                             |
| The `omni-rust/` workspace diverges from the TS upstream               | Add a CI job that diffs the OpenAPI spec + the golden-set; any drift becomes a PR-blocking review                                                                            |

## 6. Done criteria (per phase)

- `cargo check --workspace` clean, 0 warnings
- `cargo clippy --workspace --all-targets -- -D warnings` clean
- `cargo test --workspace` green
- `cargo fmt --check` clean
- `cargo deny check` clean
- `cargo audit` clean
- All slices have ≥ 1 integration test
- Each crate has a CHANGELOG.md entry
- `04_COCKPIT.md` reflects the new state

## 7. Assumptions and defaults

- The user is on macOS, ships to macOS + Linux (no Windows in 2026).
- `modernc.org/sqlite` is not the answer for Rust (use `sqlx`'s `libsqlite3-sys` build).
- Bifrost is the only external AI gateway; we don't plan to support other Tier-1 gateways in 2026.
- The Next.js UI (`src/app/`) stays in TS for 2026; a Rust frontend (e.g. Dioxus) is out of scope.
- The `omni-cli` TUI is a stretch goal; the CLI works without it.
- We don't vendor Maxim's Bifrost; we call it via HTTP. The TS relay route can be retired once the Rust relay is proven.
- Zig is used for exactly one or two leaf utilities; if it doesn't show a clear win in slice 9, drop it.
- The "prod grade" definition = green CI, green load test, green security audit, runbook + SLOs published, and ≥ 1 production customer running it for 30 days.
