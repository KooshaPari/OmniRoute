# OmniRoute — 100-PR Strategic Plan (Post-v3.8.34 Fork Audit)

> **Document type**: Implementation roadmap (not a release-tracking CHANGELOG).
> **Author**: KooshaPari · Fork `KooshaPari/OmniRoute` · Upstream `diegosouzapw/OmniRoute`
> **Baseline**: `v3.8.34` (release commit `19d91d82e`, PR #4614, 2026-06-21).
> **Date**: 2026-06-24.
> **Status**: Open for upstream discussion.

This plan enumerates **one hundred (100) substantive PRs** the fork intends to upstream over the next cycle, **all large enough to be mergeable on their own merits** (no padding). Every entry below identifies the _subsystem_, the _files to touch_, the _acceptance criteria_, the _commit-class_ (Feature / Fix / Refactor / Security / Tests / Chore), and the _rough LoC envelope_ so reviewers can scope it. PRs are grouped into **10 strategic waves** (10 PRs each) so a single PR can be cut per wave without re-architecting.

---

## 0. Baseline Audit (v3.8.34)

### 0.1 Repository metrics

| Subsystem                                 |                         File count | Notes                                                                                                              |
| ----------------------------------------- | ---------------------------------: | ------------------------------------------------------------------------------------------------------------------ |
| `open-sse/executors/`                     |                                 66 | One per provider family (grok, codex, claude, kiro, vertex, …)                                                     |
| `open-sse/handlers/`                      |                                 14 | SSE/chat handlers, including the recently-split `chatCore/`                                                        |
| `open-sse/services/`                      |                                30+ | `compression/`, `combo/`, `autoCombo/`, `routing/`, `quota/`, `memory/`, …                                         |
| `open-sse/services/compression/`          |               30+ files, 9 engines | `caveman`, `ccr`, `headroom`, `llmlingua`, `mcpAccessibility`, `registry`, `rtk`, `session-dedup`, plus `harness/` |
| `open-sse/translator/{request,response}/` |                                60+ | per-provider format translators                                                                                    |
| `src/app/api/`                            |                   85+ route groups | Next.js 16.2.6 App Router                                                                                          |
| `src/app/(dashboard)/dashboard/`          |                           49 pages | Provider admin, compression, traffic inspector, combos, etc.                                                       |
| `src/lib/db/`                             |         83 modules / 97 migrations | Multi-shard SQLite via better-sqlite3                                                                              |
| `src/lib/providers/`                      |                      226 providers | Live catalog + per-provider plugins                                                                                |
| `src/mitm/tproxy/`                        |             C++ native + JS loader | `IP_TRANSPARENT` addon, capture-mode                                                                               |
| `@omniroute/opencode-plugin`              |                bundled npm package | ESM-only (`tsup`)                                                                                                  |
| Tests (v3.8.34)                           | 1599 unit / 79 integration / 3 e2e | `node:test` runner, Stryker mutation, k6 soak                                                                      |

### 0.2 Upstream activity (50 open issues + 40 open PRs)

**Top open issues** (kilo-triaged, last 14 days):

- `#4976` MiMo-auto 400 fallback → 502 in Cline (kilo-triaged)
- `#4955` Redundant "Engine Combos" tab — duplicated by Compression Settings
- `#4954` OpenCode Free: proxy + account rotation logging
- `#4945` auto routerStrategy wins over task-aware reorder
- `#4920` Release branch `release/v3.8.36` not green
- `#4887` GLM Coding provider — auto-hide failed models
- `#4878` Proxy pool UI sync bugs, missing bulk loaders, Redis log spam
- `#4802` Direct Codex streams serialize behind prior trailers after #4684
- `#4771` Heap OOM
- `#4684` Codex custom tools schema
- `#4665` Model self-id mismatch (`cgpt-web/gpt-5.5` reports `gpt-5.3-mini`)
- `#4608` Aliyun WAF block (AgentRouter)
- `#4602` Codex WebSocket `/v1/responses` "Invalid state: Controller is already closed"
- `#4593` MiMo Codex family missing
- `#4546` Agent Bridge cannot start in Docker
- `#4446` opencode-plugin `--model` flag fails for custom combos
- `#4441` release builds still ignore TypeScript errors and disable image optimization
- `#4436` Dashboard loads multi-MB global assets
- `#4268` Stacked RTK + Caveman unreliable; Ultra works
- `#4262` Confusing prompt-cache / usage reporting for OpenAI-compat
- `#4038` Multi-agent reliability (credential loss, stream timeout, concurrency collapse)
- `#4037` No-auth AI Providers failing (Chipotle Pepper 502, DuckDuckGo 400)
- `#3981` Pollinations support
- `#3932` Performance + ToolStack maturation
- `#3897` M365 Enterprise Copilot (BizChat WebSocket protocol)
- `#3888` Ollama-cloud quota not captured in `quota_snapshots`
- `#3884` All `nvidia/*` models 502 via gateway but ~3s direct
- `#3850` Refresh token still nulled on first refresh in v3.8.24
- `#3825` 504 / TPS regression after v3.8.14
- `#3594` Proposal: codebase modularization → WordPress-style plugin system
- `#3550` Auto-switch model on "model does not exist" error
- `#3517` feat(modularization): break down `chatCore.ts` and organize `src/lib/db/`
- `#3439` docs: split into Non-Tech / Tech Users
- `#3368` Robust web-session + no-auth auto routing (incremental)
- `#3321` Cline provider + missing models
- `#3118` Support z.ai Vision/Extract/Search/zread endpoints

**Recent (already-merged in v3.8.27-3.8.34) themes** that drove the plan:

- **Compression Phase 5** — engine hardening (#4198), MCP tool cardinality (#4221), `sessionDedup` round-trip helpers (#4226), RTK `enableGrouping` (#4207), LLMLingua SLM tier (#4257), CCR cross-tenant IDOR fix (#3859), engine per-engine analytics (#4018), LLMLingua-2 ONNX stable (#4014), CCR bounds, headroom GCF vendored (#4167)
- **MITM TPROXY Epic A** — `IP_TRANSPARENT` addon (#4148), command builder (#4139), setup apply/revert (#4144), `setSocketMark` anti-loop (#4160), capture-mode listener (#4169), per-SNI CA (#4173), TLS termination (#4179), decrypt pipeline (#4200, #4208), local-only route + CA installer (#4211), Traffic Inspector toggle (#4216), agent bypass-mark (#4229)
- **Quality Gates Fase 7-9** — mutation testing (Stryker), codeql blocking, security scanners (gitleaks, osv, zizmor), oasdiff, schemathesis, 350min budget headroom, `require-tighten`, mutationScore ratchet
- **ChatCore split** — god-file extracted into `chatCore/` modules (#4159, #4188, #4193, 6 leaves unit-tested in #4218, 3 leaves in #4222, semanticCache 15/15 in #4225)
- **Combo split** — god-file `combo.ts` extracted (#4162, #4175, #4186, RR state #4196, quota strategies #4204)

### 0.3 Already-known follow-ups (upstream `release/v3.8.34..main`)

The fork's `release/v3.8.34` branch (`748790a89`) has 7+ commits past the v3.8.34 tag — release-green fixes (CodeQL sanitization, complexity drift, release-PR CI reds). Those **do not** count as new PRs; they are the baseline fixups.

---

## 1. Strategic Vectors (one sentence each)

1. **Make compression predictable.** Engines should be observable, measurable, and fair-comparable across tiers.
2. **Make chatCore boring.** Decompose the remaining god-file leaves; close the semanticCache mutation matrix.
3. **Make MITM production-grade.** TPROXY epic continues: HTTP/2 decrypt, QUIC visibility, Docker capture, MCP agent bypass for Cursor IDE.
4. **Make routing explainable.** Auto-strategy, LKG-P, `:free`/`:cheap`/`:fast`/`auto/<cat>:<tier>` — every decision is auditable.
5. **Make combo scoring honest.** Exhausted-provider gating, diversity wiring, specificity detector, complexity-aware routing.
6. **Make the dashboard performant.** Multi-MB asset audit, code-split per route, memoized table renderers.
7. **Make providers plug-and-play.** OpenAI-compatible auto-detect, live catalog for the 20+ providers stuck on hardcoded lists.
8. **Make failures self-healing.** Refresh-token preservation, OOM pressure relief, 504/TPS regression probe, early-EOF retry, undici dispatcher.
9. **Make observability first-class.** OpenTelemetry traces for every LLM route, PII redaction, P50/P95/P99 per engine.
10. **Make docs modular + non-tech-friendly.** Split docs into personas; remove fabricated content; sync provider counts.

---

## 2. The 100 PRs (10 waves × 10 PRs)

> **Sizing legend**: 🟢 Small (≤500 LoC, but cohesive). 🟡 Medium (500–2k LoC). 🟠 Large (2k–5k LoC). 🔴 Epic (5k+ LoC, may be staged in 2–3 PRs if upstream asks).
> **File-class legend**: `F` Feature · `X` Fix · `R` Refactor · `S` Security · `T` Tests · `C` Chore.

### Wave 1 — Compression Phase 5+ (10 PRs)

1. **🔴 F — Compression telemetry export (Prometheus + OpenTelemetry)**
   Files: `open-sse/services/compression/engines/*/`, `open-sse/services/compression/telemetry.ts` (new), `open-sse/services/compression/harness/measure.ts`, `src/app/api/compression/telemetry/route.ts`, `src/app/(dashboard)/dashboard/compression/telemetry/page.tsx`.
   Exposes per-engine counters (`compression_runs_total{engine,mode,outcome}`, `compression_savings_ratio{engine,mode}`) and a histogram of `compression_runtime_ms{engine,mode}`. Wire OTel spans to the existing `tracer` in `open-sse/services/compression/` and add a `/api/compression/telemetry` exporter endpoint (Prom text format).
   Closes #4268 (RTK+Caveman unreliability observability), aligns with the Quality Gate mutation set.
2. **🔴 F — Compression Studio: side-by-side engine A/B with replay**
   New studio mode that loads a transcript, runs 4 engines in parallel (Lite / Aggressive / Ultra / Stacked), and shows a diff of the prompt + token counts + reasoning. Reuses the harness from #4220 / #4246. Exports to CSV/JSON.
3. **🟠 F — Caveman Phase 6: language pack registry + Indonesian (id-ID) + Vietnamese (vi-VN) + Portuguese-BR**
   Already shipped Indonesian in #3975. This PR adds the registry so any user can drop in a `.json` rule set (`rules/`, `abbreviations/`, `word-frequency-overrides/`) and it hot-reloads. New: vi-VN + pt-BR rule packs.
4. **🟠 F — RTK grouping persistence + per-language grouping profile**
   Builds on #4207 (`enableGrouping`) by persisting grouping config per-language (different R5 rule weights for TypeScript vs Python), with a dashboard editor.
5. **🟡 F — RTK raw-output redaction filter (PII-aware) + filter ReDoS guard**
   Follow-up to #4203. Adds PII detection (email, SSN, credit-card, AWS keys, GitHub PAT) before raw RTK output is returned to the client.
6. **🟡 F — LLMLingua SLM tier routing policy (`modelPath`/`slmFallbackToAggressive`)**
   Builds on #4257. Adds a router that decides per-request whether to use the local TinyBERT (default), the heavyweight model (when `slmFallbackToAggressive=true`), or a remote SLM endpoint.
7. **🟠 F — CCR (Cross-Context Reuse) scope store v2: per-tenant store + memory bounds + eviction policy**
   Builds on the #3859 IDOR fix. Adds LRU eviction, persistence hooks, and a per-tenant dashboard with cache hit/miss counters.
8. **🟠 F — Headroom GCF v2: per-provider classifier calibration**
   Builds on the #4167 vendored GCF. Adds per-provider calibration files so the tabular encoder learns provider-specific token-cost patterns.
9. **🟡 X — RTK + Caveman stacked savings: deterministic ordering + dual-engine telemetry**
   The core fix for #4268. When stacked, force deterministic ordering (RTK first if `deduplicate=true`, then Caveman) and emit per-step `compression.step` events with timing + savings.
10. **🟠 R — Engine-extensibility SDK: 1 PR doc + 1 PR scaffold for third-party engines**
    A typed plugin interface (`CompressionEngine`, `EngineContext`, `EngineResult`) and a dynamic `require()` from `engines/<name>/index.js` with isolation, so users can ship their own engines without patching the core.

### Wave 2 — ChatCore decomposition completion (10 PRs)

11. **🟠 R — `chatCore.ts` final leaves: extract `streamLifecycle.ts` + `responseTranslation.ts` + `errorMapper.ts`**
    Builds on #4159, #4188, #4193. Three new modules with full unit-test coverage; `chatCore.ts` drops below 800 LoC.
12. **🟠 R — `combo.ts` final leaves: extract `circuitBreaker.ts` + `capabilityFilter.ts` + `pricingRollup.ts`**
    Builds on #4162, #4175, #4186, #4196, #4204. Closes the god-file decomposition.
13. **🟡 R — Extract `routing/scoring.ts` from `src/lib/routing/` (4 candidate scoring factors)**
    `tierAffinity`, `specificityMatch`, `connectionDensity`, `freshnessScore` get isolated into pure functions with mutation-tested units.
14. **🟠 T — SemanticCache HIT-path coverage (15/15 mutation, 350-min nightly headroom)**
    Builds on #4225. Hits edge cases (concurrent flush, partial HIT, scope mismatch, namespace expiry, snapshot serialization).
15. **🟠 T — Memory-skills mutation suite (3 leaves enrolled)**
    New tests for the memory-skill selector, skill-vector retrieval, and preference-vs-fact dedup.
16. **🟠 T — Telemetry leaves unit tests (5 leaves + 2 enrolled in stryker)**
    OTel tracer injection, span lifecycle, redaction pass, baggage propagation, drop-on-overflow.
17. **🟡 R — Shared `src/shared/util/retry.ts` extracted from 6 ad-hoc retry blocks**
    One canonical retry helper with `Retry-After` honoring, jitter, circuit-breaker awareness, and observability hooks. Replaces 6 hand-rolled `for (let attempt = 0; attempt < n; attempt++) { try { ... } catch (e) { await sleep(...) } }` blocks.
18. **🟡 R — Shared `src/shared/util/header.ts` (`mergeHeaders`, `redactAuthHeaders`, `mergeAnthropicBeta`)**
    Used by #4972 SSRF guards and the existing toolSearch beta merge (#3999, #3974). Centralizes header manipulation.
19. **🟡 R — Shared `src/shared/util/streamBackpressure.ts`**
    Reusable `backpressuredTransform`, `passthroughWithTimeout`, `teeWithReplay` for the 4 streaming sites that each rolled their own.
20. **🟠 T — Mutation-test nightly: expand from 3 → 5 batches (parallel)**
    Closes #4150 (which split into 3) by adding the c/d/g/h batches. Aligns with #4258's timeout headroom extension.

### Wave 3 — MITM / TPROXY Epic B (10 PRs)

21. **🔴 F — MITM HTTP/2 decrypt (multiplexed streams, frame-aware capture)**
    Builds on TPROXY Epic A (#4148-#4229). Adds HTTP/2 frame parser, per-stream `:authority`-keyed capture, and the same per-SNI CA reuse as HTTP/1.1.
22. **🔴 F — MITM QUIC visibility (HEXDUMP-only, no decryption)**
    QUIC is intentionally not decrypted; we capture the Initial packet's ClientHello to log the SNI and connection metadata, then forward the rest. Wired through the same `setSocketMark` anti-loop primitive.
23. **🟠 F — TPROXY Docker capture (run-in-Docker traffic)**
    Builds on the #4156 OUTPUT-chain recipe. Adds a `docker network create` driver + `--cap-add=NET_ADMIN` documentation + per-container marker script so Docker-host traffic is captured too.
24. **🟠 F — MITM MCP agent bypass (Cursor IDE #4295, Antigravity IDE #4294)**
    When the upstream is a known IDE (Cursor / Antigravity / VS Code Copilot), automatically inject the anti-loop socket mark so the IDE doesn't loop. Requires a per-SNI matcher and a small SQLite registry.
25. **🟠 F — MITM traffic-inspector: live capture screen for TPROXY decrypt mode**
    A new dashboard page `/dashboard/mitm/live` with a streaming table (Server-Sent Events) of decoded HTTP/1.1 + HTTP/2 frames, scoped by `:authority` / SNI / path regex.
26. **🟡 F — MITM trust-store installer (Windows + macOS)**
    Builds on #4211 (Linux). Adds `mitm setup ca --install-system` on Windows (certutil) and macOS (security add-trusted-cert).
27. **🟡 X — TPROXY `setSocketMark` regression test (anti-loop correctness)**
    Adds a unit test that injects a marked socket, sends a packet, and asserts the capture loop skips it.
28. **🟠 R — MITM TPROXY state machine extracted from `tproxy/manager.ts` into `state.ts` + `apply.ts` + `revert.ts`**
    Closes the god-file decomposition in the TPROXY module. Mutation-tested.
29. **🟡 F — MITM per-connection CA rotation (per-session ephemeral CA)**
    Avoid long-lived CA fingerprint correlation; rotate the CA every 24h or per-session, with the CA cert never persisted.
30. **🟠 T — MITM fuzz test (radamsa corpus + oasdiff property tests)**
    Fuzz the HTTP/1.1 + HTTP/2 parsers with malformed frames; property-test that the parser never crashes on adversarial input.

### Wave 4 — Routing & Combo honesty (10 PRs)

31. **🟠 F — Auto-router: `:free`/`:cheap`/`:fast`/`:reliable`/`:pro` tier profile editor + dashboard preview**
    Builds on #4235. A dashboard editor for tier weights (latency, cost, reliability, quality) with a live "what would this route?" preview.
32. **🟠 F — `auto/<category>:<tier>` resolver v2 (capability-aware fail-open)**
    Builds on #4235. Adds fail-open semantics when the constraint matches no connected models (don't break routing — fall back to the full pool) plus telemetry on `auto_constraint_no_match_total`.
33. **🟠 X — Auto-strategy: exhausted-provider gating (#4540)**
    Auto combo currently scores exhausted providers identically to healthy ones. Gate them at the scoring layer (return `score: 0, reason: "quota_exhausted"`). Also fixes the LKG-P regression (#4945).
34. **🟠 F — Combo scoring: complexity-aware routing (v2, opt-in)**
    Builds on the #3779 pilot. Adds a `complexityAwareRouting: boolean` flag per combo. When on, routes simple prompts to cheaper models and complex prompts to higher-quality models based on a fast classifier.
35. **🟡 F — Routing explainability: per-hop trace in `/api/routing/trace`**
    Records every scoring decision (weight, factor, score) for a single request and returns them as a JSON tree, surfaced in the Traffic Inspector.
36. **🟠 F — `:free` suffix for auto combos (#4329)**
    Filter the candidate pool by free-tier models, with a `classifyTier()` heuristic from #4235 generalized.
37. **🟡 X — Auto strategy respects `disableCooling` per connection (#2997)**
    The connection-level `providerSpecificData.disableCooling` is honored by the auto router — a connection that opts out of cooldown is eligible even if it just failed.
38. **🟠 T — Combo routing E2E (3-hop priority failover, per-target timeout, real `strategy:auto`)**
    Builds on the #3779 E2E coverage. Adds 12 new tests covering failover, timeout, capability filter, and LKG-P regressions.
39. **🟠 R — Combo scoring isolated into pure `routing/scoring.ts`**
    Extract all scoring factors into pure functions with mutation-tested units. Replaces the existing god-file scoring block.
40. **🟡 F — Dashboard: `/dashboard/routing/why-this-target` (one-click drill-down)**
    In the Traffic Inspector, every request now has a "Why this target?" link that opens the scoring trace from #35 in a side panel.

### Wave 5 — Providers (catalog + plug-and-play) (10 PRs)

41. **🟠 F — OpenAI-compatible auto-detect (probe `/v1/models` for any new provider)**
    When a user adds a custom base URL, the key-import route probes `<baseUrl>/v1/models` and if successful, registers it as an OpenAI-format provider. Auto-classifies (free-tier, OAuth, API-key) from the response.
42. **🟠 F — Live catalog for 20+ stuck-on-hardcoded providers (Qwen, BytePlus, LLM7, ZenMux, Vercel AI Gateway, …)**
    Builds on #3996, #4202, #4249. Adds the remaining 20+ providers in the same `NAMED_OPENAI_STYLE_PROVIDERS` list with a regression test that the route actually probes `/models`.
43. **🟠 F — Pollinations provider (closes #3981)**
    A free no-auth image+text provider, integrated as a default provider, with a discoverable endpoint in the dashboard.
44. **🟠 F — Ponytail integration (closes #4057)**
    A new connector for the Ponytail AI service (request details in #4057).
45. **🟠 F — M365 Enterprise Copilot (BizChat WebSocket protocol) — closes #3897**
    A new provider that speaks the M365 BizChat WebSocket protocol (Microsoft's enterprise Copilot variant).
46. **🟠 F — z.ai Vision/Extract/Search/zread endpoints (closes #3118)**
    Wire all four z.ai endpoints as standalone tools or as a provider with multimodal capabilities.
47. **🟠 F — Pioneer AI (Fastino Labs) provider (builds on #4909)**
    Add the full Pioneer AI provider with capability detection, OAuth, and pricing.
48. **🟠 F — xAI Grok translators + thinking patcher (builds on #4910)**
    Add inbound translators for xAI's Grok-3/Grok-4 series with native thinking patcher.
49. **🟠 X — DGrid AI gateway provider (builds on #4931)**
    Finalize the DGrid AI gateway provider with capability detection and tiered routing.
50. **🟠 X — Cursor Cloud Agent REST API (builds on #4227)**
    Finalize the Cursor Cloud Agent via REST API (already started in #4227); add the credential-import flow + dashboard UI.

### Wave 6 — Resilience & self-healing (10 PRs)

51. **🟠 X — Heap-OOM crash-loop fix (closes #4771, #4041)**
    The classic OOM exit-134 bug under concurrent load. Root cause: large bodies buffered through injection guard. Fix: streaming-cap the buffer, backpressure the request, and add a process-level watchdog with a heap-high-watermark threshold.
52. **🟠 X — Multi-agent reliability (closes #4038)**
    Three-part fix: (a) Codex credential-loss race, (b) long-request stream timeout (configurable per-provider), (c) concurrency throughput collapse (per-account semaphore already started in #4970 — finish the FASE 2.2 budget share).
53. **🟡 X — Undici dispatcher 502 bursts (#4252)**
    The "Undici dispatcher fails on provider requests while direct curl works" issue. Root cause is per-host connection pool starvation + an aggressive `keepAliveTimeout`. Fix: tune the global dispatcher + per-host pool sizing.
54. **🟠 X — Refresh-token preservation (#3850)**
    The fix landed in #3766 (for the synthetic test) but not for the real `gemini-cli` / `antigravity` path. Confirm via a regression test (#3850) and ship the fix.
55. **🟠 X — 504 / TPS regression probe (#3825)**
    The classic post-v3.8.14 combo-pinning regression. Add a synthetic probe (nightly + on-startup) that exercises a 3-hop combo and asserts P50 < 5s on a healthy pool.
56. **🟠 X — Direct Codex stream serialization (#4802)**
    Codex streams still serialize behind prior trailers after #4684. Fix the streaming serializer to flush per-chunk.
57. **🟠 X — MiMo auto-fallback on 400 (#4976)**
    MiMo auto doesn't fall back on 400 rate limits, surfacing as 502 in Cline. Wire the auto strategy's failure-recovery to recognize 400-from-free as a soft-fail.
58. **🟠 X — Aliyun WAF block on AgentRouter (#4608)**
    Add a `provider:agent-router` specialization that uses the correct `Accept` / `User-Agent` to avoid the WAF block.
59. **🟠 X — Proxy pool UI sync + Redis log spam (closes #4878)**
    The proxy pool dashboard doesn't reflect the live state, and Redis connection-error logging floods the log file. Fix both, with a throttled log emitter (already landed as #4978 — finish the UI side).
60. **🟠 F — Per-connection semaphore (`disableCooling` + `quotaShareConcurrency`) — builds on #4970**
    Finalize the per-connection semaphore from #4970, add the dashboard toggle, and expose the semaphore state in the Traffic Inspector.

### Wave 7 — Observability & SLO (10 PRs)

61. **🔴 F — OpenTelemetry end-to-end traces for every LLM route**
    Span hierarchy: `client → chatCore → executor → upstream`. W3C Trace Context propagation, baggage for combo selection, and a `langfuse`-compatible exporter. Builds on #4974 (already bootstrapped).
62. **🟠 F — PII redaction pass (logger-level)**
    Builds on #4140 (FCC port). Adds regex + entropy-based redaction for emails, SSNs, credit-cards, AWS keys, GitHub PATs, JWT, and Stripe keys.
63. **🟠 F — Compression telemetry (already in #1) — wired to OpenTelemetry traces**
    Connect the compression spans to the LLM trace so a request trace shows the full compression pipeline timing.
64. **🟠 F — Prometheus /metrics exporter**
    A standard `/metrics` endpoint with the Prometheus text format. Includes request counters, latency histograms, error rates, and the compression telemetry from #1.
65. **🟠 F — Health & SLO page (`/dashboard/health/slo`)**
    Surfaces P50/P95/P99 per endpoint, per upstream, per engine. Rolling 24h window with SLO targets (e.g., `p95 < 2s` for chat, `p95 < 10s` for streaming).
66. **🟡 F — LiveWS sidecar reconnect telemetry (closes #4004 follow-ups)**
    The LiveWS reconnect events weren't reaching the dashboard. Add a dedicated `/api/livews/events` SSE channel and a dashboard widget.
67. **🟠 T — Trace-context propagation tests (W3C compliance)**
    20+ tests asserting that `traceparent` / `tracestate` are forwarded correctly across all routes, including the OpenAI/Anthropic/Responses translators.
68. **🟠 R — Observability context propagation extracted into a shared module**
    `OpenTelemetryContextPropagator` with strict typing, used by every LLM route. Replaces ad-hoc header passing.
69. **🟡 F — Per-engine compression cost attribution**
    Tracks the runtime cost (CPU ms + memory MB) of each engine and reports it in the Compression Studio A/B view (from #2).
70. **🟠 F — Alert routing for SLO breaches (PagerDuty / Slack / Webhook)**
    When a SLO breach is sustained for > 5min, send a webhook. Built on the alert framework.

### Wave 8 — Dashboard performance & polish (10 PRs)

71. **🟠 X — Multi-MB asset audit (closes #4436)**
    The dashboard loads multi-MB global assets (font / icon / chart / provider cards) on first paint. Audit and code-split: per-route dynamic imports, font subsetting (only Latin-1), tree-shaken icon imports, virtualized provider card list.
72. **🟠 R — Dashboard table renderers memoized**
    The provider cards, request logs, and combos table re-render on every dashboard state change. Wrap in `React.memo` + `useMemo` selectors with structural-sharing. Expected: -60% render time on the providers page.
73. **🟡 R — Dashboard i18n: split message files per namespace**
    Currently a single 5MB JSON per locale. Split into per-feature namespaces and lazy-load per route.
74. **🟠 F — Dashboard: dedicated Compression Settings page (closes #4955)**
    The redundant "Engine Combos" tab is duplicated by "Compression Settings". Merge them into a single Compression Settings page with two modes: "Combos" (deprecated alias) and "Engines".
75. **🟡 X — Dashboard: rename "API Keys" to "Access Tokens" (#4020)**
    The terminology was already updated in #4020; this finishes the rollout to the remaining admin pages.
76. **🟠 F — Dashboard: design system v2 — primitives catalogue + Storybook-equivalent preview**
    Already partially shipped in #4122, #4158, #4141, #4143, #4233, #4214. Add a `/_dev/components` route that renders the full primitive catalogue for visual regression.
77. **🟡 F — Dashboard: dark/light mode parity (closes #3760 follow-ups)**
    A handful of controls still lack proper light-mode treatment. Audit and fix.
78. **🟡 R — Dashboard: extract `useDashboardTheme` hook**
    Centralize theme logic; remove the 8 places that each roll their own.
79. **🟠 F — Dashboard: `/dashboard/settings/feature-flags` editor**
    Already partially shipped in #3752. Build a full editor with bulk import/export.
80. **🟠 F — Dashboard: a per-page breadcrumb + page-header primitive**
    Standardize the page header layout across all 49 dashboard pages.

### Wave 9 — Security & hardening (10 PRs)

81. **🟠 S — SSRF guard v3 (loopback via proxy, DNS rebinding, Kiro region)**
    Builds on #4972 (3 cherry-picked guards). Adds IPv6 literals, redirect-following to private hosts, and per-region validation for Kiro's `us-east-1` vs `eu-west-1`.
82. **🟠 S — Cross-tenant IDOR audit (CCR scope store, memory engine, semantic cache)**
    A focused security audit of every per-tenant store, with a regression test for each.
83. **🟠 S — OAuth callback URL validation (`/callback` per-provider)**
    Already partially fixed in #3732. Finalize for all OAuth providers.
84. **🟠 S — MCP server tool-cardinality reduction (security boundary)**
    Already started in #4221. Add a per-server allowlist + per-session token so an untrusted MCP server can't smuggle tools.
85. **🟡 S — JWT / Stripe key redaction in error responses**
    Even with logger-level redaction, some error bodies echo the auth header. Add a final redaction pass before any error body is sent.
86. **🟠 S — Prompt-injection guard v3 (cross-route, multi-turn)**
    Builds on #3857. Adds multi-turn injection detection and a jailbreak-resistance dataset.
87. **🟠 S — Quota-share fail-closed (#4866 hardening follow-up)**
    The #4866 fix prevents fail-open on limit 0/negative/non-finite. Add a property test that covers all edge cases.
88. **🟠 S — MCP/Antigravity tool-name cloak survival (closes #4091 / #4181)**
    Already partially fixed in #4153. Add the Antigravity-specific regression test.
89. **🟡 S — CodeQL hardening (template-injection, cache-poisoning, SC2086)**
    Already partially fixed in #3965. Sweep for the remaining `js/polynomial-redos`, `js/incomplete-url-substring-sanitization`, and `js/insufficient-password-hash`.
90. **🟠 S — Dependabot security consolidation (monthly batch)**
    Group the remaining Dependabot PRs into a single monthly batch with curated changelog.

### Wave 10 — Documentation, refactoring, closing-loose-ends (10 PRs)

91. **🟠 C — `chatCore.ts` final tidy: drop below 800 LoC**
    Follow-up to #11. The final 200-line stretch that doesn't fit any of the named modules; pure cleanup.
92. **🟠 C — `combo.ts` final tidy: drop below 1k LoC**
    Follow-up to #12.
93. **🟠 D — Docs split: Non-Tech vs Tech Users (closes #3439)**
    Reorganize the docs into two paths. Non-Tech gets install + first-provider + first-request + troubleshooting. Tech gets architecture + plugin SDK + extension points + quality gates.
94. **🟠 D — Docs: `PROVIDER_REFERENCE.md` regenerated with the 226+ live catalog**
    Already partially done in #3804 / #3904. Finalize with the live counts and a count-guard CI gate.
95. **🟠 D — Docs: troubleshooting matrix (per-error-code → cause → fix)**
    A community-friendly matrix that maps `provider.validation.ssrf_blocked` → "your upstream is private" → "check `safeOutboundFetch`" and similar for the top 30 errors.
96. **🟡 R — `src/lib/db/` cleanup: drop dead migrations, expose `caseMapping`/`schemaColumns` as db-internal (#4966 follow-up)**
    Builds on #4966.
97. **🟡 R — Stub `MockExecutor` for testing: a zero-cost executor for unit tests**
    Reduces the unit-test runtime by ~3x (no live provider needed).
98. **🟠 T — OpenAPI spec coverage = 100% (closes #3951 follow-ups)**
    Sweep the OpenAPI spec, fix dangling `$ref`s, ensure every public route has a documented request/response.
99. **🟠 T — Property/fuzz nightly expansion (3 → 7 batches)**
    Builds on the schemathesis nightly (#3956). Add property tests for the routing scoring, combo scoring, executor selection, and translation layers.
100.  **🟠 C — "Modularization for plugin system" ADR + scaffold (closes #3594 + #3517)**
      A documentation ADR that proposes a WordPress-style plugin system (closes #3594), with a scaffold that demonstrates 2 reference plugins. The actual plugin API lives in the platform surface; this is the doc + POC.

---

## 3. Sequencing & dependencies

```
Wave 1 (Compression)  ──►  Wave 4 (Routing)  ──►  Wave 7 (Observability)
Wave 2 (ChatCore)     ──►  Wave 4 (Routing)
Wave 3 (MITM)         ──►  Wave 6 (Resilience)
Wave 5 (Providers)    ──►  Wave 6 (Resilience)
Wave 8 (Dashboard)    ──►  Wave 10 (Docs)
Wave 9 (Security)     ──►  Wave 10 (Docs)
```

- **Wave 1 (PR #1-10)** is internally sequential (compression engine telemetry builds on engine hardcoding, which builds on engine SDK).
- **Wave 2 (PR #11-20)** is parallel-safe but the leaves must be unit-tested before merging.
- **Wave 3 (PR #21-30)** is mostly parallel; the HTTP/2 + QUIC + Docker branches share infrastructure but are independent.
- **Wave 4 (PR #31-40)** depends on Wave 2's routing/scoring.ts extraction (#13).
- **Wave 5 (PR #41-50)** is parallel; each provider is independent.
- **Wave 6 (PR #51-60)** depends on Wave 7's OTel trace context (#61) for the OOM watchdog to log spans.
- **Wave 7 (PR #61-70)** depends on Wave 1's compression telemetry (#1).
- **Wave 8 (PR #71-80)** is parallel.
- **Wave 9 (PR #81-90)** is parallel.
- **Wave 10 (PR #91-100)** depends on every other wave for the final docs sweep.

---

## 4. Estimation envelopes

| Wave              | LoC envelope (sum) | Calendar weeks (single contributor) |
| ----------------- | -----------------: | ----------------------------------: |
| 1 (Compression)   |      12,000–18,000 |                                 3–4 |
| 2 (ChatCore)      |       8,000–12,000 |                                 2–3 |
| 3 (MITM)          |      15,000–22,000 |                                 4–5 |
| 4 (Routing)       |       8,000–12,000 |                                 2–3 |
| 5 (Providers)     |      10,000–14,000 |                                 3–4 |
| 6 (Resilience)    |       8,000–12,000 |                                 2–3 |
| 7 (Observability) |      10,000–14,000 |                                   3 |
| 8 (Dashboard)     |        6,000–9,000 |                                   2 |
| 9 (Security)      |       8,000–12,000 |                                 2–3 |
| 10 (Docs/Cleanup) |        6,000–9,000 |                                   2 |
| **Total**         |      **~91k–134k** |                       **~26 weeks** |

---

## 5. How to ship a single PR cleanly

For each PR in this plan, the contributor will:

1. Branch from `v3.8.34` (or the latest `release/v3.8.XX` baseline).
2. Land on a **dedicated worktree** (Hard Rule #19).
3. Keep the LoC within the "Sizing" envelope from this plan.
4. Add a `CHANGELOG.md` entry under "Unreleased" with the upstream issue reference.
5. Run the full `test:unit` + `test:integration` + `check:quality` matrix.
6. Open the PR against the fork (`KooshaPari/OmniRoute`), then ask upstream to pull.

---

## 6. Open questions for upstream

1. **Plugin system (closes #3594 + #3517):** would upstream prefer the WordPress-style plugin API or a simpler "extension hooks" approach?
2. **Compression engine SDK (PR #10):** should the SDK live in `@omniroute/open-sse` as a peer-dep, or as a workspace package?
3. **MITM HTTP/2 decrypt (PR #21):** is the fork expected to upstream the entire TPROXY epic, or split into smaller incremental PRs?
4. **Per-connection CA rotation (PR #29):** does upstream have a stance on long-lived vs ephemeral CA fingerprints?
5. **Multi-MB asset audit (PR #71):** is upstream open to a major dashboard refactor that touches all 49 pages?

---

## 7. Status tracker

This section will be filled in as PRs land.

| PR  | Title                           | Status     | Branch | Date |
| --- | ------------------------------- | ---------- | ------ | ---- |
| 1   | Compression telemetry export    | ⏳ planned | —      | —    |
| 2   | Compression Studio A/B          | ⏳ planned | —      | —    |
| 11  | `chatCore.ts` final leaves      | ⏳ planned | —      | —    |
| 21  | MITM HTTP/2 decrypt             | ⏳ planned | —      | —    |
| 31  | Auto-router tier profile editor | ⏳ planned | —      | —    |
| 41  | OpenAI-compatible auto-detect   | ⏳ planned | —      | —    |
| 51  | Heap-OOM crash-loop             | ⏳ planned | —      | —    |
| 61  | OTel end-to-end traces          | ⏳ planned | —      | —    |
| 71  | Multi-MB asset audit            | ⏳ planned | —      | —    |
| 81  | SSRF guard v3                   | ⏳ planned | —      | —    |
| 91  | `chatCore.ts` final tidy        | ⏳ planned | —      | —    |

---

_End of plan. PR-by-PR status updates live in `plans/2026-06-24-omniroute-100-pr-status.md`._
