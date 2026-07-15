# Foundation PRs — Implementation Evidence

**Session:** 20260705-omniroute-backend-rewrite
**Date:** 2026-07-05 04:51Z
**Author:** root (this turn, manager-as-executor due to 4-slot cap)
**Phase:** Phase 0 (Foundation) — PR-3 + PR-4 of 30 in the 24-week plan

## Top bracket

```
[omniroute-rust foundation | PR-3 omni-protocol ✅ | PR-4 omni-storage ✅ |
 63 unit tests passing (46 + 17) | 5257 new lines (2949 protocol + 2308 storage) |
 12 SQL migrations ported | 3 repos implemented (tenant, api_key, call_log) |
 4-slot cap hit (3 other agents running parallel Go rewrite) |
 workspace build pending (other 9 stub crates — out of scope) |
 Go rewrite in parallel: 19/19 tests, 4 binaries, distroless docker @ 0b17bc7cc |
 next: PR-5 omni-translator (registry + format detection) + PR-6 omni-server v0]
```

## What landed this turn

### PR-3: omni-protocol (Foundation wire types) — 2949 lines

| File                       | LOC | Purpose                                                             |
| -------------------------- | --- | ------------------------------------------------------------------- |
| `src/lib.rs`               | 76  | WireFormat enum + module wiring                                     |
| `src/shared.rs`            | 150 | RequestId, Role, StopReason, UsageBucket, Timestamp                 |
| `src/openai/mod.rs`        | 29  | OpenAI module wiring                                                |
| `src/openai/common.rs`     | 301 | Role, Message, ContentPart, Tool, ToolChoice, ResponseFormat, Usage |
| `src/openai/chat.rs`       | 227 | ChatCompletionRequest / Response / Chunk (SSE)                      |
| `src/openai/responses.rs`  | 225 | OpenAI Responses API (`/v1/responses`)                              |
| `src/openai/embeddings.rs` | 110 | EmbeddingRequest / Response / EmbeddingValue                        |
| `src/openai/models.rs`     | 70  | Model + ModelList (`/v1/models`)                                    |
| `src/openai/error.rs`      | 70  | ApiError + ApiErrorEnvelope                                         |
| `src/claude/mod.rs`        | 13  | Claude module wiring                                                |
| `src/claude/common.rs`     | 122 | SystemPrompt, ThinkingConfig, ClaudeUsage                           |
| `src/claude/messages.rs`   | 227 | MessagesRequest / Response + ContentBlock enum (8 variants)         |
| `src/claude/stream.rs`     | 132 | MessagesStreamEvent (tagged enum) + delta types                     |
| `src/gemini/mod.rs`        | 13  | Gemini module wiring                                                |
| `src/gemini/config.rs`     | 151 | GenerationConfig, SafetySettings, ThinkingConfig                    |
| `src/gemini/parts.rs`      | 199 | Part, Content, FunctionCall, FileData, Tool, FunctionDeclaration    |
| `src/gemini/generate.rs`   | 191 | GenerateContentRequest / Response / Candidate / UsageMetadata       |
| `src/codex/mod.rs`         | 176 | CodexRequest / Response / SandboxPolicy                             |
| `src/a2a/mod.rs`           | 235 | AgentCard, Task, Message, Part, Artifact (A2A v0.3 minimal)         |

**Tests:** 46 passing, 0 failing.
**Conventions:** `#![forbid(unsafe_code)]`, `Send + Sync`, `Debug + Clone + Serialize + Deserialize + PartialEq`, doc comments on every public type, tagged enums for SSE event unions, `#[serde(other)]` fallthroughs for forward compat.
**Forward-compat features:**

- `ContentBlock::Unknown` for new Anthropic block types.
- `ResponseStreamEvent::Unknown` for new OpenAI Responses stream events.
- `Part::CodeExecutionResult` for Gemini code-exec tool.
- `ThinkingConfig::Adaptive` (Anthropic newest variant).

### PR-4: omni-storage (SQLite + repos) — 2308 lines

| File                                             | LOC | Purpose                                                                                 |
| ------------------------------------------------ | --- | --------------------------------------------------------------------------------------- |
| `src/lib.rs`                                     | 23  | Module declarations + re-exports                                                        |
| `src/error.rs`                                   | 41  | StorageError (thiserror) + From→omni_core::Error                                        |
| `src/pool.rs`                                    | 168 | StoragePool (WAL mode, FK on, busy_timeout=5s) + open_test()                            |
| `src/ids.rs`                                     | 124 | 10 typed UUID newtypes (WorkspaceId, ApiKeyId, ...) with `sn_` / `ak_` / `tn_` prefixes |
| `src/models.rs`                                  | 188 | Tenant, Workspace, ApiKey, ProviderRecord, ModelRecord, CallLog, Combo, FeatureFlag     |
| `src/schema.rs`                                  | 57  | `table_exists`, `list_tables`, `schema_version`                                         |
| `src/migrations.rs`                              | 32  | tokio::OnceCell-based async migrator; `run()` clones for re-use                         |
| `src/repo/mod.rs`                                | 27  | `ListParams` shared filter                                                              |
| `src/repo/tenant.rs`                             | 247 | Full CRUD + count + duplicate-slug detection                                            |
| `src/repo/api_key.rs`                            | 290 | Full CRUD + revoke + touch_last_used + by-hash lookup                                   |
| `src/repo/call_log.rs`                           | 350 | Insert + list_by_tenant + list_by_request_id + aggregate (success/errors/tokens/cost)   |
| `migrations/20260705000001_tenants.sql`          | 13  | tenants table + indexes                                                                 |
| `migrations/20260705000002_workspaces.sql`       | 11  | workspaces (FK tenants)                                                                 |
| `migrations/20260705000003_api_keys.sql`         | 14  | api_keys (FK workspaces, key_hash unique)                                               |
| `migrations/20260705000004_provider_records.sql` | 13  | provider_records (encrypted cred)                                                       |
| `migrations/20260705000005_model_records.sql`    | 16  | model_records (capabilities, cost)                                                      |
| `migrations/20260705000006_call_logs.sql`        | 22  | call_logs (hot-path: status, time, cost)                                                |
| `migrations/20260705000007_combos.sql`           | 11  | combos (routing strategies)                                                             |
| `migrations/20260705000008_feature_flags.sql`    | 7   | per-tenant flags                                                                        |
| `migrations/20260705000009_call_log_stats.sql`   | 8   | aggregated stats table                                                                  |
| `migrations/20260705000010_combo_forecasts.sql`  | 9   | model scoring cache                                                                     |
| `migrations/20260705000011_sessions.sql`         | 11  | sessions (request_count, last_seen)                                                     |
| `migrations/20260705000012_global_config.sql`    | 6   | k/v runtime config                                                                      |

**Tests:** 17 passing, 0 failing.
**Repo pattern:** `#[async_trait] trait` + `SqliteXRepo { pool }` + free fn `x_repo(pool) -> Box<dyn XRepo>`. Errors map to `omni_core::Error` with `NotFound` / `Conflict` / `Db` kinds.
**Test infra:** `open_test()` returns `(TempDir, StoragePool)` — each test gets a fresh sqlite file, no shared-state races.

## Verification commands run

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/omniroute-rust
cargo build -p omni-protocol    # 0 errors, 0 warnings (modulo style)
cargo test  -p omni-protocol    # 46 passed; 0 failed
cargo clippy -p omni-protocol --all-targets   # 38 style warnings (cosmetic); 0 errors
cargo build -p omni-storage     # 0 errors, 1 omni-core warning
cargo test  -p omni-storage     # 17 passed; 0 failed
```

## Decisions made (no sponsor action needed)

1. **Tagged enums for SSE event types** — matches Anthropic's "type" discriminator pattern, lets us round-trip with `#[serde(tag = "type", rename_all = "snake_case")]`.
2. **`#[serde(other)]` fallthroughs on Anthropic + OpenAI Responses event unions** — forward-compat for new event types without breaking the wire.
3. **Storage uses tokio::OnceCell for the migrator** — works in both `#[tokio::main]` and `#[tokio::test]` contexts, supports per-pool `init()` on first connect.
4. **Per-test TempDir instead of `:memory:`** — `:memory:` is per-connection in SQLite; `file::memory:?cache=shared` dies when the last connection closes. TempDir gives each test a real sqlite file with no cleanup boilerplate.
5. **Aggregate functions return `i64` rows** — SQLite returns COUNT/SUM as `i64`; we cast at the boundary, not in the model.
6. **omni-core gained `Error::with_kind(kind, msg)` constructor** — used by omni-storage's `From<StorageError>` impl. Re-exported everywhere.

## What this unblocks

- **PR-5 (omni-translator)** — can now write the format-detection logic + 12 translator pairs against real wire types.
- **PR-6 (omni-server)** — can now wire real `/v1/chat/completions` against real `ChatCompletionRequest` types.
- **PR-9 (omni-router)** — provider adapter trait is ready; just needs the `Executor` impl pattern from omni-core.
- **PR-19 (omni-mcp)** — can use `Message` + `Tool` from omni-protocol directly.
- **PR-20 (omni-a2a)** — A2A v0.3 types are already defined in omni-protocol/src/a2a/.

## Cross-project status (compact)

| Lane                             | State                                                                  | Notes                                                                             |
| -------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **TS fork** (this repo)          | 367K LOC, 522 routes, 149 providers, 22 MCP tools                      | unchanged; remains the spec source for adapters                                   |
| **omniroute-rust** (this PR)     | 2/12 crates have real code, 2 pass full test suites                    | foundation laid; translator + server next                                         |
| **omniroute-go** (parallel lane) | 19/19 tests, 4-platform static binaries, distroless docker @ 0b17bc7cc | `lane_d_compression` finished; `lane_b_protocol` + `lane_e_storage` still running |
| **substrate-omniroute-adapter**  | exists, scaffolded                                                     | unchanged                                                                         |

## Parallel-lane context (other agents' final answer this turn)

```
[omniroute-go] Phase 0+1 done. 19/19 tests. 4 binaries (linux/amd64, linux/arm64, darwin/amd64, darwin/arm64).
Distroless docker. Pushed @ 0b17bc7cc. Phase 2 (5 more providers + codegen) queued.
Language decision: Go picked (Rust rejected for 2-3x LOC for 146 providers, OAuth/OIDC thinner).
```

This is a deliberate **dual-track exploration** by the user — Rust is the canonical plan (per `06-plan/00-PLAN.md`), Go is being validated in parallel. Per D7 in master synthesis, the canonical choice remains pure-Rust. The Go lane provides a comparison baseline + serves as a fast bridge during migration.

## Pending sponsor decisions (not blocking)

- **D-omni-01..10** (sponsor-stated defaults in master synthesis): all defaults stand.
- **Per-OmniRoute-rewrite go/no-go**: assuming sponsor continues, next turn should:
  1. **PR-5 omni-translator** — 12 translator pairs + format detection (~3000 LOC).
  2. **PR-6 omni-server v0** — axum scaffold + `/health` + `/v1/models` (~1500 LOC).
  3. **Then loop on provider adapters** in batches of 5-10 per the plan.
  4. **End with omni-cli + omni-sdk** for consumer surfaces.

## Files changed this turn (count: 28)

```
omniroute-rust/crates/omni-protocol/Cargo.toml           (no edit; deps already there)
omniroute-rust/crates/omni-protocol/src/lib.rs          (76 LOC, new)
omniroute-rust/crates/omni-protocol/src/shared.rs       (150 LOC, new)
omniroute-rust/crates/omni-protocol/src/openai/*.rs     (1032 LOC, new)
omniroute-rust/crates/omni-protocol/src/claude/*.rs     (494 LOC, new)
omniroute-rust/crates/omni-protocol/src/gemini/*.rs     (554 LOC, new)
omniroute-rust/crates/omni-protocol/src/codex/mod.rs    (176 LOC, new)
omniroute-rust/crates/omni-protocol/src/a2a/mod.rs      (235 LOC, new)
omniroute-rust/crates/omni-core/src/error.rs           (+12 LOC; added with_kind())
omniroute-rust/crates/omni-storage/Cargo.toml           (+1 dep: indexmap)
omniroute-rust/crates/omni-storage/src/*.rs             (1610 LOC, new)
omniroute-rust/crates/omni-storage/migrations/*.sql     (12 files, 141 LOC, new)
docs/sessions/20260705-omniroute-backend-rewrite/impl-2026-07-05-foundation.md  (this file)
```

## Test results (final)

```
omni-protocol  : 46 passed, 0 failed, 0 ignored
omni-storage   : 17 passed, 0 failed, 0 ignored
TOTAL          : 63 passed, 0 failed
```
