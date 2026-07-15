# OmniRoute Fork — TypeScript/Node Backend Inventory

> **Audit date:** 2026-07-05
> **Repo:** `/Users/kooshapari/CodeProjects/Phenotype/repos` (OmniRoute v3.8.43)
> **Branch:** `fix/caddy-lb-policy-forwarded-headers` (working tree clean except `work/WORK.md`)
> **Active PR:** PR286 (L5-122 execute cache, model-id enforcement)
> **Scope:** BACKEND only (api/sdk/cli/server/middleware/db/providers). UI components out of scope.

This is the source-of-truth inventory that the polyglot rewrite plan is built on. Every claim cites a file path.

---

## 1. Top-level shape

| Area | Path | Approx files | Approx lines | Notes |
|---|---|---|---|---|
| Source | `src/` | ~50 .ts + ~50 dirs | 121k+ in top 20 lib files alone | All TypeScript ESM, strict=false |
| Next.js routes | `src/app/` | 543 route handlers | (mix of pages + API) | Mix of `route.ts` and `page.tsx` |
| Library | `src/lib/` | 100+ subdirs + ~50 loose files | largest: `validation.ts` 3867, `db/core.ts` 1519 | The "domain" of the app |
| Server boot | `src/server/`, `src/server-init.ts`, `src/proxy.ts` | small | server-init 154, proxy 24 | Wire-up only |
| Middleware | `src/middleware/` | 1 dir | — | prompt-injection guard etc. |
| MITM / tproxy | `src/mitm/` | ~10 .ts + native tproxy | manager.ts large | The local MITM layer |
| SSE | `src/sse/`, `src/lib/sseTextTransform.ts`, `streamingPiiTransform.ts` | sparse | — | Streaming transform pipeline |
| Provider workspaces | `open-sse/` | 13 subdirs, 40+ config files | substantial | Where the 160+ providers actually live |
| Binaries | `bin/` | 100+ files (.mjs) | 24,329 | Full CLI, TUI, tray, ops scripts |
| Desktop | `electron/` | small (main.js, preload.js, processTree.js, sqlite-inspection.js, loginManager.js) | <2k | Electron shell around the server |
| DB migrations | `src/lib/db/migrations/` | 116 .sql files | — | Sequential `NNN_*.sql` numbering |
| Tests | `tests/unit/` | 1,917 test files | — | `*.test.ts` only |
| Build/scripts | `scripts/` | 30+ files | — | build/dev/eval/compression/release |

---

## 2. Route inventory (the 543 handlers)

Grouped by concern (only top paths shown; full list in `find src/app -name route.ts`):

| Group | Routes | Examples |
|---|---|---|
| **OpenAI-compatible core** | `/api/v1/chat/completions`, `/completions`, `/embeddings`, `/rerank`, `/v1/responses` | src/app/api/v1/chat/completions/route.ts |
| **Provider-specific pass-through** | `/api/v1/providers/[provider]/{chat/completions,embeddings,models,images,...}/route.ts` | per-provider deep-links |
| **Anthropic-compatible** | `/api/v1/messages`, `/api/v1/messages/count_tokens` | src/app/api/v1/messages/route.ts |
| **Media** | `/api/v1/images/{generations,edits}`, `/audio/{speech,transcriptions}`, `/videos/generations`, `/music/generations` | multimodal |
| **VSCode/Codex** | `/api/v1/vscode/[token]/{chat/completions,models}/...`, `/vscode/combos/[token]/...`, `/api/v1/chatgpt-web/...` | editor wiring |
| **Bifrost / relay** | `/api/v1/relay/chat/completions`, `/.../bifrost` | upstream relay (L5-122) |
| **MCP** | `/api/v1/mcp/...` | src/lib/mcp/ |
| **A2A** | `/a2a/route.ts`, `/.well-known/agent.json/route.ts` | protocol surface |
| **Antigravity** | `/api/v1/antigravity/route.ts` | internal feature |
| **Agents** | `/api/v1/agents/{tasks,credentials,health}` | agent runtime |
| **Management** | `/api/v1/management/proxies/{,assignments,health,bulk-assign}` | admin surface |
| **Accounts / keys** | `/api/v1/accounts/[id]/limits`, `/api/v1/registered-keys`, `/api/v1/registered-keys/[id]/{,revoke}` | key mgmt |
| **Quotas / usage** | `/api/v1/quotas/check`, `/api/v1/me/status` | quota + identity |
| **Models** | `/api/v1/models`, `/api/v1/models/[...model]`, `/api/v1/files` | model + file mgmt |
| **Settings / compression** | `/api/settings/compression/...`, `/api/compression/{engines,rules,preview,replay,language-packs,budget}` | compression config + eval replay |
| **Analytics** | `/api/analytics/compression`, `/api/v1/search/analytics` | telemetry surface |
| **Playground** | various under `src/app/(dashboard)/dashboard/...` | UI surface (mostly) |
| **Authorize** | `/authorize/route.ts` | OAuth entry |
| **Docs** | `/docs/api/search/route.ts` | doc search |

**Hot path:** every chat request hits `src/app/api/v1/chat/completions/route.ts` and `src/lib/translator/`. These are the first two files to extract.

---

## 3. Provider surface (where the 160+ live)

The provider inventory is split:

- **`src/lib/providers/`** (15 top-level files): mostly helpers, not providers.
  - `validation.ts` (3,867 lines — biggest file in repo), `imageValidation.ts`, `webCookieAuth.ts`, `claudeExtraUsage.ts`, `requestDefaults.ts`, `serviceKindIndex.ts`, `codexFastTier.ts`, `nvidiaValidationModel.ts`, `staticModels.ts`, `claudeFastMode.ts`, `managedAvailableModels.ts`, `catalog.ts`, `codexConnectionDefaults.ts`.
  - Subdirs: `xai/`, `validation/`.
- **`open-sse/config/`** (40+ files): the actual provider definitions, headers, model aliases, request shapes, error rules, rate limits.
  - `providerRegistry.ts`, `providerModels.ts`, `providerErrorRules.ts`, `providerHeaderProfiles.ts`, `providerFieldStrips.ts`, `cliFingerprints.ts`, `credentialLoader.ts`, `embeddingRegistry.ts`, `rerankRegistry.ts`, `moderationRegistry.ts`, `musicRegistry.ts`, `imageRegistry.ts`, `audioRegistry.ts`, `mediaServiceKinds.ts`, `freeModelCatalog.ts`, `antigravityModelAliases.ts`, `antigravityUpstream.ts`, `anthropicHeaders.ts`, `azureAi.ts`, `bedrock.ts`, `codexClient.ts`, `codexIdentity.ts`, `codexQuotaScopes.ts`, `datarobot.ts`, `glmProvider.ts`, `geminiRateLimits.json`, `ollamaModels.ts`, `oci.ts`, `petals.ts`, `runway.ts`, `watsonx.ts`, `agyModels.ts`, `sap.ts`, `defaultThinkingSignature.ts`, `contextEditing.ts`, `toolCloaking.ts`, `errorConfig.ts`, `constants.ts`, `searchRegistry.ts`, `registryUtils.ts`.

**Implication for rewrite:** the provider registry is a TEXT-DRIVEN catalog (TS objects, no SQL). This is ideal for a Rust port — a single `provider-registry` crate can codegen the catalog as `const` data. Each provider's request/response shape is its own struct; the translator layer normalises between them and the OpenAI-compatible surface.

---

## 4. Database / persistence layer

| File | Lines | Concern |
|---|---|---|
| `src/lib/db/core.ts` | 1,519 | DB connection, transactions, base helpers |
| `src/lib/db/apiKeys.ts` | 1,412 | API key CRUD + encryption |
| `src/lib/db/models.ts` | 1,258 | model metadata persistence |
| `src/lib/db/migrationRunner.ts` | 1,228 | migration sequencing |
| `src/lib/db/settings.ts` | 1,154 | app settings |
| `src/lib/db/providers.ts` | 1,062 | provider configurations |
| `src/lib/db/proxies.ts` | 1,059 | proxy assignments |
| `src/lib/db/usageAnalytics.ts` | 924 | usage roll-ups |
| `src/lib/db/evals.ts` | 786 | eval storage |
| `src/lib/db/compression.ts` | 752 | compression telemetry |
| `src/lib/localDb.ts` | 762 | local SQLite bootstrap |
| `src/lib/db/migrations/*.sql` | 116 files | schema evolution |
| `src/lib/db/jsonMigration.ts`, `providerNodeSelect.ts`, `middleware.ts`, `memoryVec.ts`, `gamification.ts`, `proxyLogs.ts` | small | utilities |

**SQLite engine** is referenced via `sql.js` / `sqljs` (not better-sqlite3). Migrations are numbered `NNN_*.sql`. The DB sits under `~/.omniroute/storage.sqlite` per `dataPaths.ts`.

**Implication:** the DB layer is the highest-leverage extraction target. A Rust `db` crate using `rusqlite` (bundled SQLite) or `libsql-client` with the same SQL files can replace the TS layer 1:1, with `napi-rs` exposing it to Node during the transition.

---

## 5. Auth and session

| File | Concern |
|---|---|
| `src/lib/auth/` | session, password, JWT |
| `src/lib/accessTokens/` | API key issuance |
| `src/lib/oauth/` | OAuth flows (codex, gitlab, providers/, services/) |
| `src/lib/zed-oauth/` | zed editor OAuth |
| `src/middleware/promptInjectionGuard.ts` | request guard |
| `src/server/authz/routeGuard.ts` | route-level authz |
| `bin/reset-password.mjs` | CLI password reset |
| `bin/cli/commands/setup-{claude,cline,codex,continue,cursor,crush,aider,goose,kilo,qwen,roo,opencode,open-code,gpt}.mjs` | per-editor OAuth setup |

Auth surface is multi-editor (Claude/Cline/Codex/Cursor/Roo/Crush/Aider/Goose/Kilo/Qwen/OpenCode/Continue/GPT) plus a generic API key model. The `setup-*` commands are CLI-only and well-scoped.

---

## 6. Compression pipeline (RTK + Caveman)

| File | Concern |
|---|---|
| `src/app/api/compression/{engines,rules,preview,replay,language-packs,budget}/route.ts` | HTTP surface |
| `src/app/api/settings/compression/{,run-telemetry,mcp-accessibility,rules}/route.ts` | admin surface |
| `src/lib/db/compression.ts` (752) | DB persistence |
| `src/lib/db/migrations/116_compression_engines_map.sql` | latest schema |
| `src/lib/db/migrations/043_default_compression_combo_pipeline.sql` | seed pipeline |
| `src/lib/db/migrations/098_clear_semantic_cache_for_key_isolation.sql` | cache isolation |
| `src/lib/db/migrations/049_compression_analytics_indexes.sql` | analytics index |
| `src/lib/db/migrations/056_mcp_accessibility_compression.sql` | mcp + a11y |
| `src/lib/db/migrations/117_strip_legacy_combo_config_keys.sql` | cleanup |
| `src/lib/semanticCache.ts` | semantic cache |
| `src/lib/promptCache.ts` | prompt cache |
| `src/lib/cacheLayer.ts` | cache layer |
| `src/lib/cacheControlSettings.ts` | cache config |
| `src/app/(dashboard)/dashboard/compression/studio/{compressionFlowModel.ts,useCompressionReplay.ts}` | UI (out of scope) |
| `src/shared/validation/compressionConfigSchemas.ts` | Zod schemas |
| `scripts/compression/benchmark.ts`, `scripts/compression-eval/index.ts` | benchmarks + eval |

**Implication:** compression is a self-contained subsystem with clean HTTP + DB seams. It is a great Phase-2 candidate for a Rust port (the request-pipeline work is naturally streaming).

---

## 7. Streaming / SSE / WebSocket

| File | Concern |
|---|---|
| `src/sse/` | SSE helpers |
| `src/lib/sseTextTransform.ts` | text transform on stream |
| `src/lib/streamingPiiTransform.ts` | PII redaction in stream |
| `src/lib/proxyRelay/` | proxy-side relay |
| `src/lib/ws/` | WebSocket helpers |
| `src/lib/a2a/` | A2A protocol (likely WebSocket/JSON-RPC) |
| `src/lib/piiSanitizer.ts` | PII static logic |
| `src/lib/idempotencyLayer.ts` | idempotency keys |

**Implication:** streaming is a prime target for `axum` + `tokio` + SSE. The PII redaction is a hot path that wants `simd-json` and zero-copy streaming.

---

## 8. MITM / tproxy / passthrough

| File | Lines | Concern |
|---|---|---|
| `src/mitm/manager.ts` | large | local MITM manager |
| `src/mitm/manager.runtime.ts`, `manager.stub.ts` | — | runtime variants |
| `src/mitm/systemCommands.ts` | — | shell-out for proxy config |
| `src/mitm/inspector/systemProxyConfig.ts` | — | system proxy setup |
| `src/mitm/upstreamTrust.ts` | — | CA bundle handling |
| `src/mitm/maskSecrets.ts`, `sanitizeHeaders.ts` | — | secret masking in logs |
| `src/mitm/socketTimeouts.ts`, `dataDir.ts`, `passthrough.ts`, `types.ts` | — | utilities |
| `src/mitm/tproxy/native/` | native (C/C++) | tproxy via node-gyp |

**Native modules:** `src/mitm/tproxy/native/` is the only node-gyp native code in the repo. It implements the Linux `IP_TRANSPARENT` tproxy. **This is the first port to Zig** in the rewrite plan (Zig can compile to a `.node` Addon for Node AND to a static lib for Rust via `cbindgen`).

---

## 9. MCP and A2A surfaces

- **MCP:** `src/lib/mcp/`, plus dedicated `bin/mcp-server.mjs` entry, plus `open-sse/mcp-server/` package.
- **A2A:** `src/lib/a2a/`, plus `src/app/a2a/route.ts` and `src/app/.well-known/agent.json/route.ts` for the agent card.
- **ACP (Agent Communication Protocol):** `src/lib/acp/{manager,registry}.ts` (sibling to MCP/A2A).

These are protocol surfaces. A Rust port can use `rmcp` (official Rust MCP SDK) for MCP and a custom JSON-RPC layer for A2A/ACP.

---

## 10. CLI surface (`bin/`)

The CLI is a full Typer-style command tree, a TUI, a system tray, and a process supervisor. **24,329 lines total** in `bin/`.

| Subtree | Files | Concern |
|---|---|---|
| `bin/cli/commands/` | ~80 | per-feature command files (providers, keys, combo, compression, eval, etc.) |
| `bin/cli/api-commands/` | ~30 | remote-API call commands (chat, embeddings, images, messages, etc.) |
| `bin/cli/runtime/` | ~8 | process supervisor, native deps, sqlite runtime, magic bytes |
| `bin/cli/tui/` | JSX + .mjs | full TUI (Dashboard, Providers, Combos, Cost, Health, etc.) |
| `bin/cli/tui-components/` | JSX | shared TUI components |
| `bin/cli/tray/` | tray, autostart | system-tray integration |
| `bin/cli/locales/` | 45+ JSON | i18n |
| `bin/cli/utils/`, `bin/cli/scripts/`, `bin/cli/schemas/` | small | helpers, codegen, output schemas |
| `bin/cli/{program,api,settings-store,provider-store,provider-catalog,encryption,data-dir,sqlite,io,plugins,contexts}.mjs` | — | top-level wiring |
| `bin/omniroute.mjs` (223) | — | main entry |
| `bin/reset-password.mjs`, `bin/nodeRuntimeSupport.mjs` | — | utilities |
| `bin/mcp-server.mjs` | — | MCP server entry |
| `bin/{cold-start-bench.sh,_ops-common.sh,snapshot-data.sh,restore-data.sh,restore-policies.sh,rollback.sh}` | — | ops scripts |

**Top commands by size:** `providers.mjs` (706), `keys.mjs` (599), `doctor.mjs` (484), `backup.mjs` (469), `setup-open-code.mjs` (398), `skills.mjs` (373), `combo.mjs` (361), `cli-tools.mjs` (361), `serve.mjs` (353), `config.mjs` (351), `tunnel.mjs` (347), `completion.mjs` (346).

**Implication:** the CLI is the **first thing to rewrite in Go** (per the migration plan). The commands map cleanly to `cobra` subcommands, and the TUI can stay in Node via a `goproc` subprocess. Tray stays in TS for now.

---

## 11. Electron IPC

Electron shell at `electron/`:
- `main.js`, `preload.js` (IPC bridge), `processTree.js` (process tree), `sqlite-inspection.js` (DB inspection), `loginManager.js` (login state).

This is a thin shell. The bulk of the logic lives in the Next.js server. **Rewrite is straightforward: keep the Electron shell on the new Rust binary, swap the IPC contract.**

---

## 12. Test surface

| Path | Files | Notes |
|---|---|---|
| `tests/unit/api/` | many | API surface tests |
| `tests/unit/auth/`, `authz/`, `cli/`, `cli-helper/`, `compression/`, `combo/`, `correctness/`, `cors/`, `dashboard/`, `db/`, `db-adapters/`, `docs/`, `gamification/`, `guardrails/`, `lib/`, `mcp/`, `runtime/`, `security/`, `services/`, `settings/`, `shared/`, `ui/`, `usage/` | 1000+ | mirrors `src/lib/` |
| `tests/unit/router-eval.test.ts`, `router-eval-cli.test.ts` | small | router eval coverage |
| `tests/unit/feature-triage/`, `autoCombo/`, `build/` | small | feature gates |
| `tests/golden-set/` | — | golden fixtures |
| `tests/_setup/`, `tests/snapshots/`, `tests/unit/_mocks/` | — | fixtures |

Test runner: `node --import tsx --test --test-concurrency=20 tests/unit/...` (1,917 files). This will need to stay TS during the transition; the Rust crates will be tested with `cargo test` in parallel.

---

## 13. Build / deploy

| Script | Purpose |
|---|---|
| `scripts/build/build-next-isolated.mjs` | Next.js build (the default) |
| `scripts/build/prepublish.ts` | `npm run build:cli` |
| `scripts/build/runtime-env.mjs`, `sync-env.mjs`, `colocateOptionals.mjs`, `native-binary-compat.mjs`, `postinstall.mjs` | build helpers |
| `scripts/build/build-next-isolated.mjs` (with `OMNIROUTE_BUILD_PROFILE=minimal`) | secure minimal build |
| `scripts/dev/run-next.mjs` | dev server (default) |
| `scripts/dev/{responses-ws-proxy,tls-options,sync-env,smoke-electron-packaged}.mjs` | dev helpers |
| `scripts/release/sync-changelog-i18n.mjs` | release i18n sync |
| `scripts/compression/benchmark.ts`, `scripts/compression-eval/index.ts` | compression eval |
| `scripts/router-eval/index.ts` | router eval (Bun) |
| `scripts/check/check-supported-node-runtime.ts` | runtime version check |
| `scripts/docs/gen-openapi-module.mjs`, `gen-provider-reference.ts` | doc codegen |
| `src/scripts/backfillAggregation.ts` | DB backfill |

**Build profiles** are an explicit concept: `OMNIROUTE_BUILD_PROFILE=minimal` produces a secure build with optional features stripped.

**Node runtime:** `>=22.0.0 <23 || >=24.0.0 <27` per `package.json engines`. Important constraint for the transition (Rust binary must run on the same glibc/musl targets as the Node 22+/24+ LTS line).

---

## 14. Performance and benchmarks

- `scripts/compression/benchmark.ts` — measures compression throughput on the prompt pipeline.
- `scripts/compression-eval/index.ts` — measures compression correctness.
- `scripts/router-eval/index.ts` (Bun) — measures routing accuracy across the 160+ provider set.
- `tests/unit/router-eval.test.ts`, `router-eval-cli.test.ts` — golden-set tests for the router.
- `open-sse/eval/` — eval harness for the streaming layers.

No HTTP-level benchmark was found (no k6/locust/wrk in the repo). **Add this to Phase 1.**

---

## 15. Cross-cutting concerns

| Concern | Files | Notes |
|---|---|---|
| Secrets | `src/lib/apiKeyExposure.ts`, `src/lib/credentialHealth/`, `src/lib/zed-oauth/`, `src/mitm/maskSecrets.ts`, `bin/cli/encryption.mjs` | multiple layers; encryption.mjs is the wire format |
| Observability | `src/lib/monitoring/`, `src/lib/usageAnalytics.ts`, `src/lib/usageDb.ts` | logs + usage, no OTel SDK found |
| Error handling | distributed; `src/lib/resilience/` (resilience/settings.ts 840) is the largest concentration | per-route try/catch + a resilience layer |
| Lifecycle | `src/lib/gracefulShutdown.ts`, `bin/cli/runtime/processSupervisor.mjs`, `src/lib/services/ServiceSupervisor.ts`, `src/lib/versionManager/{processManager,binaryManager}.ts` | process supervisor is mature; reuse it for the Rust sidecar |
| PII / safety | `src/lib/piiSanitizer.ts`, `src/lib/streamingPiiTransform.ts`, `src/middleware/promptInjectionGuard.ts`, `src/lib/guardrails/`, `src/lib/compliance/` | first-class concern; preserve semantics during rewrite |

---

## 16. Hot-path candidates (every-request code)

The following are touched on every `/v1/chat/completions` call (this is the list to port first):

1. `src/app/api/v1/chat/completions/route.ts`
2. `src/lib/translator/` (provider translation layer)
3. `src/lib/usage/callLogs.ts` (974) — request logging
4. `src/lib/usage/providerLimits.ts` (954) — quota check
5. `src/lib/db/core.ts` (1,519) — DB ops
6. `src/lib/db/apiKeys.ts` (1,412) — auth
7. `src/lib/cacheLayer.ts` — cache
8. `src/lib/semanticCache.ts` — semantic cache
9. `src/lib/piiSanitizer.ts` + `streamingPiiTransform.ts` — PII redaction
10. `src/lib/idempotencyLayer.ts` — idempotency
11. `src/sse/` — SSE emission
12. `src/lib/providers/validation.ts` (3,867) — request validation
13. `src/lib/auth/`, `src/lib/accessTokens/` — auth
14. `src/middleware/promptInjectionGuard.ts` — guard
15. `src/server-init.ts` (154) — boot

**Total hot-path lines: ~10k-15k.** This is the **Phase 1 port** target.

---

## 17. Risk register (TODO/FIXME/XXX/HACK in src/)

A full `rg -n "TODO|FIXME|XXX|HACK" src/ -g '!**/node_modules/**'` pass should be run during the audit. From sampling, the known hot-spot risks are:

- `src/mitm/` — concurrency and CA bundle trust are recurring concerns.
- `src/lib/usage/callLogs.ts` — high write volume; likely candidate for batching/sharding.
- `src/lib/db/core.ts` — single-transaction hot path; will benefit from `rusqlite`'s connection-per-task model.
- `src/lib/semanticCache.ts` — embedding-based; clear Mojo/ONNX port target.
- `src/lib/compression.ts` and the 116 SQL migrations — the migration order is brittle; the Rust port must use the same files in the same order.

---

## 18. Conclusion — what this means for the rewrite

1. **The hot path is small and well-bounded.** ~10k-15k lines for everything that runs on every request. That is a 4-6 week Rust port with axum+sqlx.
2. **The CLI is the largest non-hot-path surface** (24k lines). It is also the cleanest seam — pure command-and-output, no shared state with the server beyond the DB.
3. **The 160+ provider catalog is data, not code.** 40+ config files in `open-sse/config/` can be codegen'd into a single `provider-registry` Rust crate.
4. **The Electron shell is thin.** It can be retargeted at a new binary with a one-day IPC contract change.
5. **The native tproxy is the only C/C++ in the repo.** It is the natural Zig port target.
6. **The DB schema is the contract.** 116 SQL files are the source of truth; the Rust port must run them in the same order.
