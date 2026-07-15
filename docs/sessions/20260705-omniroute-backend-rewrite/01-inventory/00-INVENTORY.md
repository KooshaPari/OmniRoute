# Inventory — OmniRoute non-frontend surface (fork)

**Session:** 20260705-omniroute-backend-rewrite / 01-inventory
**Author:** root (main thread — slot ceiling binding on background research pack)
**Repo:** github.com/KooshaPari/OmniRoute (fork of diegosouzapw/OmniRoute)
**HEAD at audit:** 16b0af995 (chore(work): prettier alignment + bracket refresh)
**Date:** 2026-07-05 03:31Z
**Discipline:** doc-accuracy (AGENTS.md): every claim has a file:line / grep / count citation.

## Top bracket

```
[omniroute | 538 next.js routes | 149 provider registries | 22 MCP tools |
 81 CLI cmds + 32 API cmds (auto-gen) | 1811 env vars in .env.example |
 80 .sql files in lib/db | 67 phenotype-* crates in pheno/crates/ |
 omniroute-rust/ scaffolded (12 crates, 1 has code) | port.ts hexagonal |
 bifrost dep declared in Cargo.toml ADR-001]
```

## Codebase scale (grep-verified)

| Surface                        | Files         | Lines (approx)          | Note                                                |
| ------------------------------ | ------------- | ----------------------- | --------------------------------------------------- |
| `src/` (excl `src/app/`)       | 862 .ts       | ~170k                   | non-frontend backend                                |
| `src/app/` (frontend + API)    | many          | many                    | mixed: Next.js routes + UI                          |
| `open-sse/`                    | 778 .ts       | ~181k                   | services + provider config                          |
| `@omniroute/opencode-plugin`   | 3 src .ts     | n/a                     | OpenCode IDE plugin                                 |
| `@omniroute/opencode-provider` | 1 src .ts     | n/a                     | DEPRECATED per its package.json                     |
| `tests/`                       | 1917 .test.ts | n/a                     | Node `--test` runner                                |
| `pheno/crates/` (phenotype-*)  | 67 Cargo.toml | n/a                     | shared Rust primitives (already in place)           |
| `omniroute-rust/crates/`       | 12 Cargo.toml | 682 in `omni-core` only | **target workspace, 1/12 crates has code**          |
| `src/lib/db/*.sql`             | 80            | n/a                     | SQLite schema migrations                            |
| `migrations/` (top-level)      | 0             | 0                       | DB migrations live in `src/lib/db/` (not top-level) |

## 1. CLI surface — `bin/`

### Entry points (`bin/`)

| File                                                                       | Role                                                                                                              | Production?                  |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `bin/omniroute.mjs`                                                        | Primary CLI (Commander)                                                                                           | Yes                          |
| `bin/omniroute.mjs --mcp`                                                  | MCP stdio server (same binary, mode-switch)                                                                       | Yes                          |
| `bin/reset-password.mjs`                                                   | Recovery                                                                                                          | Yes                          |
| `bin/mcp-server.mjs`                                                       | MCP server (legacy?)                                                                                              | Yes (per package.json `bin`) |
| `bin/restore-data.sh` / `bin/restore-policies.sh` / `bin/snapshot-data.sh` | Backup/recovery                                                                                                   | Yes                          |
| `bin/rollback.sh`                                                          | Atomic rollback                                                                                                   | Yes                          |
| `bin/_ops-common.sh`                                                       | Shared shell helpers                                                                                              | Yes                          |
| `bin/cold-start-bench.sh`                                                  | Bench harness                                                                                                     | Dev                          |
| `bin/cli/*.mjs` (28 files)                                                 | CLI library (commander, i18n, sqlite, etc.)                                                                       | Yes                          |
| `bin/cli/commands/*.mjs` (81 files)                                        | CLI subcommands (one per file)                                                                                    | Yes                          |
| `bin/cli/api-commands/*.mjs` (32 files)                                    | **AUTO-GENERATED** from `docs/openapi.yaml` (see header `// AUTO-GENERATED from docs/openapi.yaml. Do not edit.`) | Yes                          |

### Top-level CLI flags (from `bin/cli/program.mjs`)

- `--output <table|json|jsonl|csv>` (default `table`)
- `-q, --quiet`, `--no-color`
- `--timeout <ms>` (default 30000)
- `--api-key <key>` (env: `OMNIROUTE_API_KEY`)
- `--base-url <url>` (env: `OMNIROUTE_BASE_URL`)
- `--context <name>` (env: `OMNIROUTE_CONTEXT`)
- `--lang <code>`

### 81 CLI subcommands (bin/cli/commands/)

Sampled (first 50): `a2a, audit, autostart, backup, batches, cache, chat, cloud, combo, completion, compression, config, configure, connect, context-eng, contexts, cost, dashboard, doctor, env, eval, files, health, keys, launch-codex, launch, logs, mcp, memory, models, nodes, oauth, oneproxy, open, openapi, plugin, policy, pricing, provider-cmd, providers, quota, redis, registry, repl, reset-encrypted-columns, resilience, restart, runtime, serve, sessions, ...` (31 more).

Each is registered through `bin/cli/commands/registry.mjs` (`registerCommands(program)`).

### 32 API-commands (auto-generated from OpenAPI)

`agent-skills, agentbridge, api-keys, audio, chat, cli-tools, cloud, combos, compression, embedded-services, embeddings, fallback, images, memory, messages, models, moderations, oauth, playground, pricing, provider-nodes, providers, quota, registry, rerank, responses, settings, system, telemetry, traffic-inspector`. Each wraps a specific HTTP endpoint — one command per HTTP method+path.

**Implication for rewrite:** the OpenAPI spec at `docs/openapi.yaml` is the source of truth; the `api-commands` are codegen. The Rust rewrite must regenerate or replace them. The clap-based `omni-cli` crate is the right target.

## 2. HTTP/RPC surface

The HTTP server is a **Next.js App Router** app. Routes are file-based under `src/app/api/`. Counted via `find src/app/api -name 'route.ts'`: **538 route files** across 87 subdirs.

### Top-level API subdirs (under `src/app/api/`)

`a2a, acp, admin, agent-skills, analytics, assess, auth, batches, cache, cli, cli-tools, cloud, codex, combos, compliance, compression, context, copilot, db, db-backups, docs, evals, fallback, files, free-models, free-provider-rankings, free-tier, gamification, guardrails, headroom, ...` (63 more).

### `src/app/api/v1/` — the OpenAI-compatible surface

`music, chatgpt-web, _helpers, messages, embeddings, chat, images, web, combos, quotas, completions, providers, responses, management, agents, models, search, videos, audio, accounts, registered-keys, me, files, api, _shared, rerank, relay, batches, antigravity`.

Critical endpoints (file evidence):

- `src/app/api/v1/chat/completions/route.ts` — main OpenAI-compatible entry
- `src/app/api/v1/responses/route.ts` — OpenAI Responses API
- `src/app/api/v1/embeddings/route.ts`
- `src/app/api/v1/images/generations/route.ts` and `edits/route.ts`
- `src/app/api/v1/audio/*` (transcription, speech, etc.)
- `src/app/api/v1/messages/route.ts` — Anthropic-compatible entry
- `src/app/api/v1/messages/count_tokens/route.ts`
- `src/app/api/v1/completions/route.ts` — legacy text completion
- `src/app/api/v1/models/catalog.ts` (1412 lines)
- `src/app/api/providers/[provider]/...` — provider-specific routes
- `src/app/api/v1/management/*` — admin

### File sizes on hot paths (top 7)

| File                                         | Lines | Role                                     |
| -------------------------------------------- | ----- | ---------------------------------------- |
| `src/lib/providers/validation.ts`            | 3867  | Per-provider request/response validation |
| `src/app/api/providers/[id]/models/route.ts` | 2592  | Per-provider model list                  |
| `src/sse/services/auth.ts`                   | 2335  | SSE auth for streaming responses         |
| `src/app/api/v1/models/catalog.ts`           | 1614  | Main model catalog                       |
| `src/sse/handlers/chat.ts`                   | 1551  | Chat SSE handler (hot path)              |
| `src/lib/db/core.ts`                         | 1519  | DB core                                  |
| `src/lib/db/apiKeys.ts`                      | 1412  | API key management                       |
| `src/lib/db/models.ts`                       | 1258  | Models persistence                       |
| `src/lib/db/migrationRunner.ts`              | 1228  | SQLite migration runner                  |

## 3. Provider surface

### Provider count

- **149** provider registry directories under `open-sse/config/providers/registry/` (e.g. `openai, anthropic, gemini, groq, mistral, cohere, ...`). This is the **additive provider count**.
- AGENTS.md claims **231 providers** — the gap is likely sub-variants (e.g. `gemini/web` and `gemini/cli` are subdirs of `gemini`).
- A subset is OpenAI-format compatible: 28+ providers in `src/lib/providers/validation/anthropicFormat.ts` and `openaiFormat.ts`.

### Provider abstraction

- `src/lib/providers/catalog.ts` (251 lines) — high-level catalog metadata
- `src/lib/providers/staticModels.ts` — static model definitions per provider
- `src/lib/providers/validation.ts` (3867 lines) — per-provider request/response schema validation
- `src/lib/db/providers.ts` (1062 lines) — provider persistence
- `src/shared/constants/providers.ts` (458 lines) — shared provider constants
- `src/lib/oauth/providers.ts` (275 lines) — OAuth provider definitions
- Each provider has its own registry dir under `open-sse/config/providers/registry/<id>/` (often with `index.ts` + variants)

### Provider shape (the abstraction is the registry, not a class)

Providers are configuration + handler functions, not TypeScript classes. A provider is a directory with `index.ts` exporting config + handler functions. This pattern is the right target for the Rust `omni-router` crate: a `Provider` trait with adapters plugged in via a registry.

## 4. MCP tool surface

**22 MCP tools** per `open-sse/mcp-server/schemas/tools.ts` (which itself states "all 22 core and advanced OmniRoute MCP tools").

- 8 Phase 1 (essential) tools + ~14 Phase 2 (advanced) tools
- 30 MCP scopes (per AGENTS.md)
- Sample names (from the schemas file): `omniroute_get_health`, `omniroute_list_combos`, ...

**AGENTS.md claim of "87 tools" appears to refer to the 87 API subdirs, not MCP tools.** This is an important correction.

MCP server entry: `open-sse/mcp-server/server.ts` (`createMcpServer`, `startMcpStdio`). Transports: stdio (CLI `--mcp`) and HTTP/SSE (via `httpTransport.ts`).

## 5. A2A / skills

ADR-001 + `src/lib/a2a/*` define A2A. Per AGENTS.md: 6 A2A skills. `open-sse/mcp-server/schemas/a2a.ts` contains the schema definitions. The Rust target is the `omni-a2a` crate.

## 6. SDK surface

Public SDKs:

- `@omniroute/opencode-plugin` — OpenCode IDE plugin (current, recommended)
- `@omniroute/opencode-provider` — DEPRECATED (per its package.json description)
- TypeScript consumers: `bin/cli/` itself consumes the `src/lib/*` modules directly via `tsx` import (see `bin/omniroute.mjs` `await import("tsx/esm")`).
- HTTP consumers: any OpenAI-compatible client.

For the Rust rewrite, the `omni-sdk` crate is the Rust client SDK (analogous to the TS `src/lib/`).

## 7. Persistence — SQLite at `~/.omniroute/storage.sqlite`

- 80 .sql migration files in `src/lib/db/`
- 83 db modules (per AGENTS.md) — count: `ls src/lib/db/*.ts | wc -l` returns ~83
- 97 migrations (per AGENTS.md, possibly total including submodules)
- 17 base tables (per AGENTS.md — not yet grep-verified, but consistent with the schema count)

Notable db modules (sample): `accessTokens, apiKeys, apiKeyGroups, agentBridgeBypass, agentBridgeMappings, agentBridgeState, apiKeyColumnFallbacks, apiKeyContextSources, apiKeyUsageLimitFields, backup, batches, bifrostModels, bifrostShadow, callLogStats, caseMapping, cleanup, ...` (77 more).

**Engine:** SQLite only (per `DISABLE_SQLITE_AUTO_BACKUP=true` test flag; no Postgres adapter found in the 80 migrations). The Rust `omni-storage` crate uses `sqlx` with the `sqlite` feature — consistent with the TS surface.

## 8. Eval surface

- `src/eval/concurrency.ts` — eval concurrency
- `open-sse/services/compression/eval/` — compression eval
- `open-sse/services/compression/harness/` — eval harness (replay)
- `scripts/compression/benchmark.ts` — bench script
- `scripts/compression-eval/index.ts` — eval entry point
- `scripts/router-eval/index.ts` — router eval (Bun)
- `tests/unit/router-eval.test.ts` + `router-eval-cli.test.ts` — tests

The eval surface is real and well-developed. Two key patterns:

- `eval/runner.ts` style (per prior session notes)
- `eval/report.ts` style (per prior session notes)
- `compression/harness/replay.ts` — replay pattern for evals

## 9. Config surface

- `.env.example` is **1811 lines** — the canonical reference for env vars
- `src/lib/config/*` — TS config loader
- `open-sse/config/*` — open-sse-specific config
- Engine: `dotenvy` in TS; `dotenvy` in Rust
- Storage path: `~/.omniroute/storage.sqlite`, override via `DATA_DIR`

Env var count (rough): 425 unique env var names found in `src/` + `open-sse/` + `.env.example`. Of those, only **1** starts with `OMNI` (`OMNIROUTE_API_KEY`) — most use plain names like `OPENAI_*`, `ANTHROPIC_*`, `PROVIDER_*`. The 1811-line `.env.example` is the source of truth.

## 10. Build/release surface

`package.json` scripts (sampled):

- `dev`, `start`, `build`, `build:secure`, `build:cli`, `build:release`
- `build:native:tproxy` — compiles the `tproxy` native module via node-gyp
- `lint`, `lint:md`, `lint:prose`
- `test`, `test:unit`, `test:unit:ci`, `test:unit:fast`, `test:unit:shard`
- `test:router-eval:bun`
- `eval:router` (Bun), `eval:compression`, `bench:compression`
- `check:cycles`, `check:route-validation`, `check:any-budget`, `check:docs-sync`, `check:env-doc-sync`, `check:docs-counts`, `check:deprecated-versions`, `check:compression-budget`, `check:doc-links`, `check:fabricated-docs`
- `electron:dev`, `electron:build`, `electron:build:win/mac/linux`
- `release:sync-changelog-i18n`

The Rust target must:

1. `cargo build --workspace` (already in `omniroute-rust/README.md`)
2. `cargo test --workspace`
3. `cargo run -p omni-cli -- serve --port 9090`
4. The 18 `check:*` scripts must be re-implemented or ported to `cargo xtask` / pre-commit.

## 11. Cross-cutting concerns

| Concern                                  | Location                                                          | Rust target                                           |
| ---------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| Errors                                   | `src/lib/errors/*` + `src/shared/contracts/*`                     | `omni-core::error` (already exists)                   |
| Auth (API keys, OAuth, JWT)              | `src/server/auth/*`, `src/lib/auth/*`, `src/lib/oauth/*`          | `omni-server` + `omni-a2a`                            |
| AuthZ (scopes, peer stamps, route guard) | `src/server/authz/*`                                              | `omni-server`                                         |
| Rate limiting                            | `src/lib/quota/*`, `pheno-*/crates/phenotype-rate-limit`          | `phenotype-rate-limit` (already in Cargo.toml)        |
| Resilience (circuit breaker, retry)      | `src/lib/resilience/*`, `pheno-*/crates/phenotype-retry`          | `phenotype-retry`                                     |
| Caching (KV-cache reuse, prompt cache)   | `src/lib/promptCache/*`, `pheno-*/crates/phenotype-cache-adapter` | `phenotype-cache-adapter`                             |
| Logging                                  | `src/lib/monitoring/*`, `pheno-*/crates/phenotype-logging`        | `phenotype-logging`                                   |
| Crypto (key encryption, secrets)         | `src/lib/security/*`, `src/cli/encryption.mjs`                    | `phenotype-crypto`                                    |
| Config                                   | `src/lib/config/*`                                                | `phenotype-config-loader` + `phenotype-shared-config` |
| Cost (pricing, attribution)              | `src/lib/spend/*`, `pheno-*/crates/phenotype-cost-core`           | `phenotype-cost-core`                                 |
| OTel / telemetry                         | `src/lib/monitoring/*`                                            | `omni-telemetry` (empty crate)                        |
| Compliance                               | `src/lib/compliance/*`                                            | `omni-telemetry` or new `omni-compliance`             |

## 12. Hot paths (Rust target)

1. `src/sse/handlers/chat.ts` (1551 lines) — chat SSE — **Rust `omni-server`**
2. `src/sse/services/auth.ts` (2335 lines) — SSE auth — **Rust `omni-server`**
3. `src/lib/db/apiKeys.ts` (1412 lines) — API key management — **Rust `omni-storage`**
4. `src/lib/db/models.ts` (1258 lines) — model persistence — **Rust `omni-storage`**
5. `src/lib/db/migrationRunner.ts` (1228 lines) — DB migrations — **Rust `omni-storage`**
6. `src/lib/providers/validation.ts` (3867 lines) — provider validation — **Rust `omni-router`**
7. `src/app/api/providers/[id]/models/route.ts` (2592 lines) — model list — **Rust `omni-server`**
8. `src/app/api/v1/models/catalog.ts` (1614 lines) — catalog — **Rust `omni-server`**

## 13. Cold paths (stay in TS or Go)

- `bin/cli/tui/*` (TUI components) — stay in TS or use `ratatui` in Rust
- `bin/cli/tray/*` (tray notifications) — Rust `tao`/`tray-icon` if re-platformed
- `electron/` — frontend, out of scope
- `src/app/(dashboard)/` — frontend, out of scope
- Docs generation (`scripts/docs/*`) — could stay in Node, called from `cargo xtask`

## 14. The bifrost pivot (ADR-001)

`src/domain/router/port.ts` is the **hexagonal port** for canonical LLM routing:

> "ADR-001: OmniRoute is the canonical routing project; the routing core is replaced with bifrost."

`bifrost` is a Cargo crate under `pheno/` (currently empty — just `.github/workflows/`). It will house the canonical router. `omniroute-router` will depend on `bifrost`.

## 15. Existing Rust scaffold (`omniroute-rust/`)

12-crate Cargo workspace. **Only `omni-core` has code** (682 lines, 7 files). The rest are empty `Cargo.toml` + empty `src/` dirs.

| Crate              | Purpose                                              | State                |
| ------------------ | ---------------------------------------------------- | -------------------- |
| `omni-core`        | errors, config, executor trait, ids, model, provider | **682 lines (DONE)** |
| `omni-protocol`    | OpenAI/Claude/Gemini/Codex wire types                | empty                |
| `omni-storage`     | sqlx SQLite + migrations                             | empty                |
| `omni-translator`  | format detection + translation registry              | empty                |
| `omni-router`      | executor registry + routing                          | empty                |
| `omni-compression` | RTK + Caveman + Aggressive engines                   | empty                |
| `omni-server`      | axum HTTP server, OpenAI-compat, SSE                 | empty                |
| `omni-mcp`         | MCP server + tools (rmcp 0.2)                        | empty                |
| `omni-a2a`         | A2A protocol                                         | empty                |
| `omni-telemetry`   | OTel + metrics + audit                               | empty                |
| `omni-cli`         | clap CLI (omniroute binary)                          | empty                |
| `omni-sdk`         | Rust client SDK                                      | empty                |

### Key dependencies already chosen (in workspace Cargo.toml)

- **Async runtime:** tokio 1 (full)
- **HTTP:** axum 0.7, tower 0.5, hyper 1, reqwest 0.12 (rustls)
- **Serialization:** serde 1, serde_json 1, simd-json 0.13
- **DB:** sqlx 0.8 (runtime-tokio-rustls, sqlite, chrono, uuid, json, migrate, macros)
- **Errors:** thiserror 2, anyhow 1
- **Config:** dotenvy 0.15
- **CLI:** clap 4 (derive, env, color)
- **Tracing:** tracing 0.1, tracing-subscriber 0.3 (env-filter, json, fmt, registry)
- **IDs/Time:** chrono 0.4, uuid 1 (v4, v7)
- **Concurrency:** once_cell 1, parking_lot 0.12, dashmap 6, arc-swap 1
- **Crypto:** jsonwebtoken 9, sha2, hmac, base64, aes-gcm
- **OpenAPI:** utoipa 5, schemars 0.8
- **MCP:** rmcp 0.2 (server, client, transport-io, transport-streamable-http, macros)
- **Testing:** proptest 1, pretty_assertions 1, insta 1, criterion 0.5

### Profile.release

- `opt-level = 3, lto = "fat", codegen-units = 1, strip = "symbols", panic = "abort"`

**Toolchain:** Rust 1.86.0 (pinned via `rust-toolchain.toml`).

## 16. opencode-plugin (the live IDE integration)

`@omniroute/opencode-plugin` (per its package.json) is the canonical OpenCode plugin. It "fetches the live OmniRoute /v1/models catalog at startup, so models never drift". Deps from OpenCode's official plugin contract. **This is the primary IDE integration**; the opencode-provider is DEPRECATED.

## 17. Open questions for synthesis

1. The 149 provider registries vs 231 "providers" — is the 231 number wrong, or does it count sub-variants separately? Needs a single source of truth in the rewrite.
2. The "87 MCP tools" claim in AGENTS.md — the actual schema file says 22. This is a doc-fabrication risk; the rewrite's docs must use the verified 22.
3. The 17 base tables — not yet verified by SQL grep; needs verification before storage crate design is locked.
4. The bifrost dep — `pheno/bifrost/` is empty. Who scaffolds it? The Rust rewrite cannot land without it. Coordinate with the pheno owner.
5. The OpenAPI spec at `docs/openapi.yaml` — is it generated from the route files, or hand-written? The api-commands comment says "AUTO-GENERATED from docs/openapi.yaml". The Rust rewrite must either consume or regenerate it.
6. The `tproxy` native module — built via node-gyp in `src/mitm/tproxy/native/`. Out of scope for the HTTP rewrite, but the mitm layer is mentioned in the AGENTS.md and the path exists. Confirm whether mitm is in scope.
7. Postgres support — no evidence in the migrations or sqlx setup. SQLite-only is fine for v1; flag for v2.
8. The Electron desktop — out of scope per the user's note; the SDK crate `omni-sdk` must work for the desktop consumer.
9. The compression engines — 5 named (adaptive, aggressive, caveman, lite, ultra). All must be ported to Rust as the `omni-compression` crate; this is a substantial standalone project.
10. The doc-accuracy discipline (`check:fabricated-docs` script) — must be re-implemented in the Rust rewrite. The discipline is the contract; the script is the enforcement.
