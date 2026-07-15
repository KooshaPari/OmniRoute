# Plan — Sequenced PRs, Dependencies, Risk Gates, Kill Switches

**Session:** 20260705-omniroute-backend-rewrite / 06-plan
**Author:** root (main thread)
**Date:** 2026-07-05 03:44Z
**Inputs:** 01-INVENTORY, 02-EVAL, 03-SURVEY, 04-STRATEGY, 05-REQUIREMENTS

## Top bracket

```
[v1 plan | 24 weeks | 6 phases | 4-agent fleet | 30 PRs sequenced |
 12 omni-* crates | bifrost = v1.5 | 30 providers in v1, 149 in v1.5 |
 sqlite-only | OpenCode contract locked in PR-2 | kill switch < 30s]
```

## Sequencing principles

1. **Foundation first** — `omni-core` is the bedrock; nothing can land before PR-1 (`omni-core` is already there but needs extension).
2. **Storage before provider** — `omni-storage` is needed by `omni-router` for API key + model persistence.
3. **Protocol + translator before provider** — `omni-protocol` + `omni-translator` are needed by `omni-router` to speak the wire formats.
4. **Provider before server** — `omni-router` is needed by `omni-server` to route.
5. **Server before CLI** — `omni-server` is what the CLI drives.
6. **SDK + eval last** — `omni-sdk` + scripts/ are the consumer surface.
7. **MCP + A2A after server** — both depend on the server's auth + rate-limit.
8. **Telemetry throughout** — `omni-telemetry` is a cross-cutting concern; integrated as each crate is built.
9. **Bifrost pivot deferred to v1.5** — `omni-router` is the v1 placeholder; `bifrost` is the v1.5 swap.

## PR sequence (30 PRs over 24 weeks)

### Phase 0 (weeks 1-4) — Foundation + Shadow

| PR   | Title                                                           | Crates touched  | Agent | Calendar | Risk gate                                          |
| ---- | --------------------------------------------------------------- | --------------- | ----- | -------- | -------------------------------------------------- |
| PR-1 | Extend `omni-core` (config, ids, model, provider trait polish)  | omni-core       | 1     | week 1   | clippy clean, 100% doctest on `executor`           |
| PR-2 | Lock the OpenCode plugin contract (`/v1/models` shape)          | doc-only        | 1     | week 1   | contract doc + TS plugin smoke test                |
| PR-3 | `omni-protocol` v1 (OpenAI, Claude, Gemini, Codex wire types)   | omni-protocol   | 1     | week 2   | serde round-trip test, utoipa schema               |
| PR-4 | `omni-storage` v1 (sqlx + 80 SQL migrations ported)             | omni-storage    | 1     | week 2-3 | schema diff vs TS = empty, all 80 migrations apply |
| PR-5 | `omni-translator` v1 (format detection + translation registry)  | omni-translator | 1     | week 3-4 | round-trip OpenAI↔Claude↔Gemini                    |
| PR-6 | `omni-server` v0 (axum, TLS, health endpoint, no providers yet) | omni-server     | 1     | week 4   | axum + rustls + `/health`                          |
| PR-7 | Shadow mirror infrastructure (Envoy + custom middleware)        | infra           | 1     | week 4   | shadow traffic captured, no client impact          |

### Phase 1 (weeks 5-8) — Per-tenant canary + 30 providers

| PR    | Title                                                                                                                                           | Crates touched            | Agent | Calendar | Risk gate                                          |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ----- | -------- | -------------------------------------------------- |
| PR-8  | Feature flag system (tenants.omniroute_v2, models.canary_rust)                                                                                  | omni-storage, omni-server | 2     | week 5   | SQL migration applies, gateway respects flag       |
| PR-9  | `omni-router` v1 (Provider trait, registry, 5 core adapters: openai, anthropic, gemini, groq, mistral)                                          | omni-router               | 2     | week 5-6 | end-to-end test on staging                         |
| PR-10 | `omni-server` v1 (OpenAI-compat chat + responses + embeddings)                                                                                  | omni-server               | 2     | week 6   | curl test against staging, response parity with TS |
| PR-11 | Provider adapters batch 1 (5-10: cohere, openrouter, fireworks, together, groq-web, cerebras, nvidia, sambanova, baseten, deepinfra)            | omni-router               | 2     | week 6-7 | per-provider smoke test                            |
| PR-12 | Provider adapters batch 2 (10-20: huggingface, replicate, mistral-codestral, moonshot, baichuan, baidu, byteplus, bytedance, volcengine, zhipu) | omni-router               | 2     | week 7-8 | per-provider smoke test                            |
| PR-13 | Provider adapters batch 3 (20-30: ollama, vllm, llamacpp, lmstudio, jan, kobold, openai-web, chatgpt-web, gemini-web, claude-web)               | omni-router               | 2     | week 8   | per-provider smoke test                            |
| PR-14 | Per-tenant canary rollout (1 internal tenant, 2 weeks)                                                                                          | ops                       | 2     | week 8   | divergence < 0.5%, p99 parity                      |

### Phase 2 (weeks 9-12) — Per-model canary + chaos + 50 more providers

| PR    | Title                                                                                                                                                                                                                            | Crates touched       | Agent | Calendar   | Risk gate                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----- | ---------- | ------------------------------------------ |
| PR-15 | Chaos engineering scripts (latency injection, error injection, kill provider)                                                                                                                                                    | scripts, omni-router | 3     | week 9     | chaos run does NOT cause divergence > 0.5% |
| PR-16 | Provider adapters batch 4 (30-50: o1, gpt-4.5, claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5, gemini-2.0, gemini-2.5, llama-3.3, llama-4, qwen-2.5, qwen-3, deepseek-v3, deepseek-r1, kimi-k2, glm-4.5, glm-4.6, glm-4.7) | omni-router          | 3     | week 9-10  | per-provider smoke test                    |
| PR-17 | Provider adapters batch 5 (50-80: mistral-large, mistral-small, codestral, mixtral, phi-4, command-r, sonar, sonar-pro, gpt-4o variants, gpt-4-turbo, o3, o3-mini)                                                               | omni-router          | 3     | week 10-11 | per-provider smoke test                    |
| PR-18 | `omni-server` v2 (Anthropic-compat /v1/messages + per-provider routes)                                                                                                                                                           | omni-server          | 3     | week 11    | curl test, response parity                 |
| PR-19 | `omni-mcp` v1 (rmcp + 8 Phase 1 tools)                                                                                                                                                                                           | omni-mcp             | 3     | week 11-12 | end-to-end test via Claude Desktop         |
| PR-20 | `omni-a2a` v1 (6 skills, v0.3 protocol, WebSocket)                                                                                                                                                                               | omni-a2a             | 3     | week 12    | A2A client test                            |
| PR-21 | `omni-compression` v1 (5 engines)                                                                                                                                                                                                | omni-compression     | 3     | week 12    | per-engine round-trip test                 |
| PR-22 | Per-model canary rollout (5 models, 2 weeks)                                                                                                                                                                                     | ops                  | 3     | week 12    | divergence < 0.5%, p99 parity              |

### Phase 3 (weeks 13-18) — Weighted cutover + final 70 providers

| PR    | Title                                                                                                         | Crates touched | Agent | Calendar   | Risk gate                               |
| ----- | ------------------------------------------------------------------------------------------------------------- | -------------- | ----- | ---------- | --------------------------------------- |
| PR-23 | Provider adapters batch 6 (80-149: remaining providers from `open-sse/config/providers/registry/`)            | omni-router    | 4     | week 13-16 | per-provider smoke test (parallelized)  |
| PR-24 | `omni-mcp` v2 (22 tools, all 30 scopes)                                                                       | omni-mcp       | 4     | week 13-14 | end-to-end test via Claude Desktop      |
| PR-25 | `omni-server` v3 (Anthropic, Gemini-compat, audio, images, video, music, files, batches, rerank, moderations) | omni-server    | 4     | week 14-16 | curl test, response parity per route    |
| PR-26 | `omni-telemetry` v1 (OTel + metrics + audit)                                                                  | omni-telemetry | 4     | week 15-16 | OTel export verified, alerts tested     |
| PR-27 | `omni-cli` v1 (clap + 81 subcommands + 32 api-commands regenerated)                                           | omni-cli       | 4     | week 16-18 | CLI parity test (all 113 commands work) |
| PR-28 | `omni-sdk` v1 (HTTP client + types + streaming)                                                               | omni-sdk       | 4     | week 17-18 | SDK consumer test (Electron + OpenCode) |
| PR-29 | Weighted cutover (1% → 10% → 25% → 50% → 100%, 1 week each)                                                   | ops            | 4     | week 13-18 | divergence < 0.5% at each step          |

### Phase 4 (weeks 19-22) — Full cutover + ops

| PR     | Title                                             | Crates touched | Agent | Calendar   | Risk gate                           |
| ------ | ------------------------------------------------- | -------------- | ----- | ---------- | ----------------------------------- |
| PR-30a | Ops docs (runbook, dashboards, on-call rotation)  | docs           | 2     | week 19    | on-call training complete           |
| PR-30b | Final 100% cutover (TS becomes standby)           | ops            | 2     | week 20-22 | 2 weeks at 100% with no regressions |
| PR-30c | `x-omniroute-route: ts` emergency override tested | ops            | 2     | week 22    | override works in <30s              |

### Phase 5 (weeks 23-24) — Decommission

| PR    | Title                                                              | Agent | Calendar   | Risk gate                                       |
| ----- | ------------------------------------------------------------------ | ----- | ---------- | ----------------------------------------------- |
| PR-31 | Delete TS fork (one PR, per AGENTS.md "no backwards compat shims") | 1     | week 23-24 | CI green, production stable, on-call signed off |

## Calendar summary

| Phase                           | Weeks  | Parallel agents | Notes                                               |
| ------------------------------- | ------ | --------------- | --------------------------------------------------- |
| 0 (foundation + shadow)         | 4      | 4 (1 active)    | Foundation work; the shadow mirror is the key infra |
| 1 (per-tenant + 30 providers)   | 4      | 4 (1-2 active)  | 30 providers, per-tenant canary                     |
| 2 (per-model + chaos + 50 more) | 4      | 4 (2-3 active)  | 80 providers, chaos, MCP + A2A v1, compression v1   |
| 3 (weighted + final 70)         | 6      | 4 (3-4 active)  | All 149, telemetry, CLI, SDK, weighted cutover      |
| 4 (full cutover + ops)          | 4      | 2               | Ops docs, 100% cutover, emergency override          |
| 5 (decommission)                | 2      | 1               | TS delete                                           |
| **Total**                       | **24** | avg ~3          | 4-slot ceiling respected                            |

## Risk gates (cross-phase)

| Gate            | Threshold          | Action on breach                         |
| --------------- | ------------------ | ---------------------------------------- |
| p99 latency     | +5% vs TS          | Disable canary for affected tenant/model |
| Error rate      | +0.1% vs TS        | Disable canary                           |
| Divergence rate | > 0.5%             | Disable canary; analyze divergences      |
| Memory usage    | > 500MB at 10k RPS | Halt; investigate leak                   |
| Cold start      | > 200ms            | Profile; remove lazy initialization      |
| Test coverage   | < 70%              | Block PR; require tests                  |
| Clippy warnings | any                | Block PR                                 |
| `unsafe` code   | any                | Block PR (forbid(unsafe_code) is set)    |

## Kill switch matrix

| Level             | Mechanism                                                            | Time to effect | Notes                   |
| ----------------- | -------------------------------------------------------------------- | -------------- | ----------------------- |
| Global (rust off) | `UPDATE global_config SET rust_traffic_pct = 0;` + `kill -HUP <pid>` | <30s           | All traffic back to TS  |
| Per-tenant        | `UPDATE tenants SET omniroute_v2 = 'disabled' WHERE id = ?;`         | <30s           | That tenant back to TS  |
| Per-model         | `UPDATE models SET canary_rust = false WHERE id = ?;`                | <30s           | That model back to TS   |
| Per-request       | `x-omniroute-route: ts` header                                       | immediate      | Single request          |
| Per-phase         | Roll back to previous phase's PR                                     | <5 min         | `git revert` + redeploy |
| Global (TS off)   | N/A in v1 (TS is still running)                                      | N/A            | v2 will allow this      |

## Dependencies (Cargo)

All dependencies are already locked in `omniroute-rust/Cargo.toml`. Per PR, the following new deps are anticipated:

- PR-3 (omni-protocol): `utoipa` (already there)
- PR-4 (omni-storage): `sqlx` (already there), `chrono`, `uuid` (already there)
- PR-5 (omni-translator): `serde_json` (already there)
- PR-9 (omni-router): `async-trait` (already there), `reqwest` (already there)
- PR-15 (chaos): `arbitrary` (new), `proptest` (already there)
- PR-19 (omni-mcp): `rmcp` (already there)
- PR-20 (omni-a2a): `tokio-tungstenite` (new)
- PR-21 (omni-compression): `regex` (already there), `unicode-segmentation` (new)
- PR-26 (omni-telemetry): `tracing-opentelemetry` (new), `opentelemetry` (new), `opentelemetry-otlp` (new)
- PR-27 (omni-cli): `clap` (already there), `ratatui` (new), `tao` (new), `tray-icon` (new)
- PR-28 (omni-sdk): `reqwest` (already there), `tokio-stream` (new)

## Documentation deliverables

- **API reference (utoipa-generated):** `docs.serve.rs/omniroute/api/v1/openapi.json` (replaces `docs/openapi.yaml`)
- **CLI reference (clap-generated):** `docs.serve.rs/omniroute/cli/` (replaces `docs/cli/`)
- **Migration guide:** `docs/MIGRATION-FROM-TS.md` (consumed by the user community)
- **Architecture decision records:** `docs/adr/` (MADR format, per the existing `docs/adr/`)
- **Runbook:** `docs/RUNBOOK.md` (per-service on-call)
- **Bench reports:** `docs/bench/` (criterion HTML output)

## Open questions for sponsor sign-off

1. **Calendar start:** 2026-07-15 (immediate) vs 2026-08-01 (after the absorptions). Default: 2026-08-01 to let the absorptions settle.
2. **Bifrost pivot:** v1.5 (recommended) vs v1 (push for early). Default: v1.5.
3. **Provider count in v1:** 30 (recommended) vs all 149. Default: 30.
4. **Postgres in v1:** no (recommended) vs yes. Default: no.
5. **Chaos engineering in scope:** yes (recommended) vs no. Default: yes.
6. **i18n in v1:** no (recommended) vs yes. Default: no (v1.5).
7. **tproxy native module:** defer to v2 (recommended) vs v1. Default: defer.
8. **OpenCode plugin as first-class consumer:** yes (recommended) — lock the contract in PR-2.
9. **TUI + tray in CLI:** yes (recommended) — port to ratatui + tao in PR-27.
10. **Sponsorship cadence:** weekly standup (recommended) vs ad-hoc. Default: weekly.
