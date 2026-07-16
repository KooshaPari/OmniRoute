# OmniRoute → SOTA LLM Model Router: PM + Technical Research Dossier

**Session:** 20260629-omniroute-sota
**Repo:** `KooshaPari/OmniRoute` (TypeScript / Next.js, v3.8.40) — confirmed TS, not Rust (`package.json: "name": "omniroute"`, no `Cargo.toml`).
**Scope:** Research + plan only. **No OmniRoute source was changed.**
**Goal:** Own OmniRoute as a *product* and make it a state-of-the-art LLM model router.

> **What OmniRoute is today (grounded in src/):** a 160+ provider unified router with OpenAI-compatible `/v1` surface, SSE streaming, OAuth + API-key + web-cookie + no-auth provider classes, circuit breakers (`src/shared/utils/circuitBreaker.ts`, 611 LOC), cooldown-aware retry (`src/sse/services/cooldownAwareRetry.ts`), declarative fallback chains (`src/domain/fallbackPolicy.ts`), tag routing (`src/domain/tagRouter.ts`), a rich set of **deterministic** routing strategies, and a **heuristic weighted-scoring "intelligent" router** (`src/lib/combos/intelligentRouting.ts`). It has an embeddings service (`src/lib/embeddings/service.ts`) and a Qdrant vector store (`src/lib/memory/`), a cost calculator (`src/lib/usage/costCalculator.ts`), and an *exact-hash* response cache mislabeled "semantic" (`src/lib/semanticCache.ts`).

---

## 0. Executive Summary

OmniRoute already has a **best-in-class provider-coverage and resilience substrate** (160+ providers, multi-auth, breakers, cooldowns, fallback chains, tag routing) that rivals or exceeds LiteLLM/OpenRouter on breadth. Its competitive gap is **not infrastructure — it is intelligence and governance**:

1. It routes with **heuristic weights**, not **learned quality prediction** (no RouteLLM/classifier/ELO). SOTA routers (Martian, Unify, RouteLLM, TrueFoundry) predict the *cheapest model that will still answer correctly*.
2. Its "semantic cache" is an **exact SHA-256 hash cache** and is **not wired into the active `/v1` chat path** — it captures zero of the 20–73% savings true embedding-similarity caching delivers.
3. It lacks **first-class spend governance** (virtual keys, hierarchical budgets, per-key/per-team caps) and **cost-attribution observability** — the two features that unblock enterprise procurement.
4. It has **no offline router-eval harness** (RouterBench-style convex-hull) to tune its weighted scorer or prove quality preservation.

The good news: OmniRoute already ships the *primitives* (embeddings service, vector store, cost calculator, weighted scorer with `explorationRate`) needed to close every gap. This is an "assemble + learn," not a "build from scratch," program.

---

## 1. Competitor Capability Matrix

Cell legend: **Y** yes · **P** partial · **N** no · **?** unknown. (Compact cells; full per-claim citations in §1.3.)

| Product | Cost route | Latency route | Quality route (RouteLLM-style) | Pareto/multi-obj | Weighted/RR LB | Fallback/retry | Semantic cache | Exact/prompt cache | Observability | Budget/ratelimit/vkeys | Providers (~) | Streaming | OpenAI-compat | Multi-tenant/RBAC | Guardrails/PII | BYOK | Prompt-cache passthrough | Hosting / License | Pricing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **OmniRoute (today)** | P (heuristic) | P (heuristic) | **N** | P (weighted scorer) | **Y** | **Y** | **N** (exact hash, unwired) | P | P (dashboards, no cost-attrib ledger) | P (API-key policy, no vkey budgets) | **160+** | **Y** | **Y** | P (key policy, no org RBAC) | **N** | **Y** (multi-auth) | P | Self-host / open | Free / self-host |
| **OpenRouter** | Y | Y (`:nitro`) | P (Auto Exacto) | N | Y | Y | N | Y | Y | Y | 70+ prov / 400+ | Y | Y | P | N | N | Y | SaaS / proprietary | ~5.5% credit fee |
| **LiteLLM** | Y | Y | ? | ? | Y | Y | **Y** (Redis/Qdrant) | Y | Y (Langfuse) | **Y** (5-level budgets) | 100+ prov | Y | Y | Y | Y | Y | Y | Self-host+SaaS / MIT | Free OSS; Ent ~$250+/mo |
| **Vercel AI Gateway** | Y | Y | N | N | P | Y | N | P | Y | Y | hundreds | Y | Y | Y | N | Y (0 markup) | Y | SaaS / proprietary | 0 token markup |
| **Portkey** | Y | Y | N | N | Y | Y | **Y** | Y | Y | Y | 45+ / 1600+ | Y | Y | **Y (RBAC)** | **Y (50+ guardrails)** | Y | Y | Self-host+SaaS / Apache2 | Free→$49→Ent |
| **Cloudflare AI GW** | P | Y (dynamic) | N | N | Y (RR) | Y (≤5 retry+backoff) | Y (edge) | P | Y | Y | 5–6 + Workers AI | Y | Y | P | **Y (Llama Guard+Presidio)** | Y | P | SaaS / proprietary | Free; 5% credit |
| **Helicone** | N | N | N | N | P | Y | Y (edge) | P | **Y (strong)** | Y | 100+ | Y | Y | P | P | Y | P | Self-host+SaaS / Apache2 | Free 10k/mo |
| **Martian** | Y | Y | **Y (Pareto, prompt-aware)** | **Y** | Y | Y | ? | ? | Y | Y | 50–60+ / 400+ | Y | Y | P | ? | P | ? | SaaS+Ent VPC | ~$0.004/req |
| **RouteLLM (lib)** | Y | N | **Y (5 strategies, MF/BERT)** | N | N | N | N | N | N | N | N/A (lib) | P | Y (server) | N | N | N/A | N | OSS / Apache2 | Free |
| **Requesty** | Y | Y | N | N | Y (chains) | Y (<50ms) | P | Y | Y | Y (per-agent caps) | 400+ models | Y | Y | P | Y (PII,injection) | Y | Y | SaaS | 5% markup |
| **Unify / FastRouter** | Y | Y | **Y (neural scoring)** | **Y** | ? | Y | **Y (2-tier)** | Y | Y (10-min benches) | Y (per-key budgets) | major | Y | Y | **Y (RBAC)** | ? | ? | Y | SaaS | Free→$50/mo |
| **Kong AI GW** | Y | Y | N | N | Y (semantic LB) | Y | **Y (Redis)** | Y | Y (OTel) | Y | OpenAI/Anthropic/Bedrock/vLLM | Y | Y | Y | Y (PII sanitize) | Y | Y | Self-host+SaaS / Apache2 core | OSS; Ent ~$30–50k/yr |
| **LangDB** | Y | Y | P | P | Y | Y | P | P | Y | Y | 250+ | ? | Y | **Y (SSO/SAML)** | **Y** | ? | P | SaaS+Ent VPC | Free→Ent |
| **Bifrost (Maxim)** | Y | Y | P (adaptive) | **Y** | Y | Y | **Y (4 vector stores)** | Y | Y (Prom/OTel) | Y (hier vkeys) | 23+ / 1000+ | Y | Y | P | **Y (5 providers)** | Y | Y | Self-host+SaaS / Apache2 | Free OSS |
| **TrueFoundry** | Y | Y | **Y (quality cascades)** | **Y** | Y | Y | P | P | Y | Y (hier quotas) | 250+ / 1600+ | Y (sub-3ms) | Y | **Y (RBAC/SSO)** | **Y** | Y | P | SaaS+on-prem/air-gap | $499/mo+ |
| **Eden AI** | Y | Y | N | N | ? | Y | ? | ? | Y | P | 500+ + non-LLM | ? | ? | P | P | ? | ? | SaaS | ~5.5% markup |

### 1.1 Where OmniRoute already wins
- **Provider breadth (160+)** is top-tier — ahead of LiteLLM (100+), OpenRouter (70+ providers), Kong, Bifrost.
- **Auth diversity** (OAuth, API-key, web-cookie, no-auth, cloud-agent, upstream-proxy classes in `src/shared/constants/providers/`) is broader than any competitor — uniquely enables routing across consumer subscriptions + free proxies, not just billed API keys.
- **Resilience primitives** (circuit breaker, cooldown-aware retry, reset-window/headroom/lkgp strategies) are more granular than most gateways' simple retry+backoff.

### 1.2 Per-product standout differentiators (condensed)
- **OpenRouter** — lowest-friction managed aggregator; inverse-square cost-weighted LB; "Auto Exacto" ranks providers by real tool-calling success.
- **LiteLLM** — OSS gold standard; genuine semantic cache + **5-level budget hierarchy** (key/user/member/team/org) — the governance bar to beat.
- **Martian / Unify / RouteLLM / TrueFoundry** — the **learned quality-routing** cohort; predict best model per prompt on a cost-quality Pareto frontier. This is OmniRoute's single biggest capability gap.
- **Kong / Bifrost** — enterprise-grade self-hosted architecture with **semantic LB** and dual-layer semantic caching.
- **Portkey / Cloudflare / LangDB** — guardrails/PII leadership (50+ guardrails, Llama Guard, Presidio).

### 1.3 Competitor citations
OpenRouter: routing https://openrouter.ai/docs/guides/routing/provider-selection · fallbacks https://openrouter.ai/docs/guides/routing/model-fallbacks · pricing https://openrouter.ai/pricing · BYOK https://openrouter.ai/docs/guides/overview/auth/byok · quickstart https://openrouter.ai/docs/quickstart
LiteLLM: docs https://docs.litellm.ai/ · caching https://docs.litellm.ai/docs/caching/all_caches · prompt-cache https://docs.litellm.ai/docs/completion/prompt_caching · repo https://github.com/BerriAI/litellm · budgets https://docs.litellm.ai/docs/proxy/users · vkeys https://docs.litellm.ai/docs/proxy/virtual_keys · multi-tenant https://docs.litellm.ai/docs/proxy/multi_tenant_architecture · reliability https://docs.litellm.ai/docs/proxy/reliability
Vercel: https://vercel.com/docs/ai-gateway · pricing https://vercel.com/docs/ai-gateway/pricing · BYOK https://vercel.com/docs/ai-gateway/authentication-and-byok/byok · auto-cache https://vercel.com/docs/ai-gateway/models-and-providers/automatic-caching · cost route https://vercel.com/kb/guide/cost-aware-model-routing-with-ai-gateway
Portkey: repo https://github.com/Portkey-AI/gateway · pricing https://portkey.ai/pricing · cost mgmt https://portkey.ai/docs/product/observability/cost-management · OSS https://portkey.ai/docs/product/open-source · PII https://portkey.ai/docs/product/guardrails/pii-redaction · security https://portkey.ai/features/security-compliance
Cloudflare: https://developers.cloudflare.com/ai-gateway/ · features https://developers.cloudflare.com/ai-gateway/features/ · pricing https://developers.cloudflare.com/ai-gateway/reference/pricing/ · BYOK https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/ · guardrails https://developers.cloudflare.com/ai-gateway/features/guardrails/ · auto-retry https://developers.cloudflare.com/changelog/post/2026-04-02-auto-retry-upstream-failures/
Helicone: caching https://docs.helicone.ai/features/advanced-usage/caching · error handling https://docs.helicone.ai/gateway/concepts/error-handling · security https://docs.helicone.ai/features/advanced-usage/llm-security · self-host https://docs.helicone.ai/getting-started/self-host/manual · pricing https://www.helicone.ai/pricing · repo https://github.com/Helicone/helicone
Martian: https://route.withmartian.com/ · profile https://www.everydev.ai/tools/martian · RouterBench https://withmartian.com/post/introducing-routerbench · vs OpenRouter https://www.respan.ai/market-map/compare/martian-vs-openrouter
RouteLLM: blog https://www.lmsys.org/blog/2024-07-01-routellm/ · repo https://github.com/lm-sys/RouteLLM
Requesty: https://www.requesty.ai/ · pricing https://www.requesty.ai/pricing · models https://www.requesty.ai/models · 80% blog https://www.requesty.ai/blog/ai-agent-cost-optimization-how-to-cut-llm-spend-by-80-percent-with-routing
Unify: https://www.unifyroute.com/ · pricing https://unify.ai/pricing · FastRouter https://sourceforge.net/software/product/FastRouter/
Kong: https://developer.konghq.com/ai-gateway/ · 3.14 https://konghq.com/blog/product-releases/kong-ai-gateway-3-14 · 3.8 https://konghq.com/blog/product-releases/kong-ai-gateway-3-8 · repo https://github.com/Kong/kong · pricing https://konghq.com/pricing
LangDB: https://docs.langdb.ai/introduction-to-ai-gateway · guardrails https://docs.langdb.ai/features/guardrails/ · pricing https://langdb.ai/pricing/ · repo https://github.com/langdb/ai-gateway
Bifrost: https://www.getmaxim.ai/bifrost · repo https://github.com/maximhq/bifrost · overview https://docs.getbifrost.ai/overview · semantic cache https://docs.getbifrost.ai/features/semantic-caching · guardrails https://docs.getbifrost.ai/enterprise/guardrails
TrueFoundry: https://www.truefoundry.com/ai-gateway · routing https://www.truefoundry.com/blog/intelligent-llm-routing-cost-quality-aware-model-selection · cost tracking https://www.truefoundry.com/blog/llm-cost-tracking-solution · pricing https://www.truefoundry.com/pricing · moderation https://www.truefoundry.com/docs/ai-gateway/tfy-content-moderation
Eden AI: https://www.edenai.co/ · routers https://www.edenai.co/post/best-llm-routers · pricing https://www.edenai.co/pricing
Cross-gateway benchmark (latency): https://dev.to/debmckinney/we-benchmarked-5-llm-gateways-at-5000-rps-heres-what-broke-28f3 · semantic-cache survey https://dev.to/debmckinney/top-llm-gateways-that-support-semantic-caching-in-2026-3dho

---

## 2. Technical Research (Cited)

### 2.1 Learned / preference-data routers
- **RouteLLM** — four router families (similarity-weighted ranking, BERT classifier, causal-LLM classifier, **matrix factorization**) trained on Chatbot Arena preference data. MF router hit **95% of GPT-4 quality on MT-Bench at ~85% cost cut**; generalizes to unseen model pairs. *arXiv:2406.18665 · https://arxiv.org/abs/2406.18665 · repo https://github.com/lm-sys/RouteLLM*
- **FrugalGPT** — prompt adaptation + LLM approximation + **LLM cascade** (cheap→expensive, gated by a learned DistilBERT reliability scorer). **Matched GPT-4 accuracy at up to 98% cost reduction.** *arXiv:2305.05176 · https://arxiv.org/abs/2305.05176*
- **Hybrid LLM** — DeBERTa router trained on quality-gap labels; **up to 40% fewer large-model calls** at no quality drop, with a cost-bias knob. *arXiv:2404.14618*
- **AutoMix** — few-shot self-verification + **POMDP meta-router**; **>50% cost cut** at comparable quality. *arXiv:2310.12963*
- **ZOOTER** — reward-model-distilled lightweight router to the most expert LLM. *arXiv:2311.08692*
- **Routoo/Leeroo** — per-query performance predictor under a cost budget; GPT-4-level accuracy at a fraction of cost. *arXiv:2401.13979*
- **MetaLLM** — selection as a **multi-armed bandit** maximizing online cost-quality utility. *arXiv:2407.10834*
- **GraphRouter** — heterogeneous graph (task/query/LLM nodes) + GNN edge-predictor; **≥12.3%** gain over prior routers, **≥9.5%** generalization to new LLMs. *arXiv:2410.03834*
- **Eagle** — **training-free** ELO + local pairwise ranking; **up to +23.52% AUC**, cheap online updates. *arXiv:2409.15518*

### 2.2 Embedding/similarity routing
Embed the query, kNN against labeled exemplars whose best-model is known, route by similarity-weighted vote. Cheapest learned approach — embedding model + vector index only; basis of `semantic-router` (https://github.com/aurelio-labs/semantic-router) and RouteLLM's SW-ranking. **OmniRoute already owns the primitives** (`src/lib/embeddings/service.ts` + Qdrant `src/lib/memory/`).

### 2.3 Cascade / speculative decoding
Speculative decoding: small draft proposes k tokens, large target verifies in one pass — **2–3× latency cut, lossless**. *arXiv:2211.17192 · arXiv:2302.01318 (DeepMind speculative sampling)*. Relevant only for self-hosted/own-inference tiers.

### 2.4 Multi-objective Pareto routing
**Cascade routing** unifies routing + cascading via iterative re-selection — **~14% better cost-quality tradeoff** than either alone. *arXiv:2410.10347*. RouterBench formalizes the cost-quality **convex hull (AIQ — area under the frontier)** as the evaluation surface.

### 2.5 Router benchmarks
- **RouterBench** — 405k+ inference records; convex-hull AIQ metric for fair router comparison. *arXiv:2403.12031 · repo https://github.com/withmartian/routerbench*
- **RouterEval** — model-level scaling of routers. *arXiv:2503.10657*

### 2.6 Semantic caching
- **GPTCache** — embed query, vector-similarity lookup vs cached prompts, return stored response on hit above threshold; **2–10× faster** on hits + proportional cost elimination. *arXiv:2308.02490 · https://aclanthology.org/2023.nlposs-1.24/*
- **GPT Semantic Cache** — tuned embedding-similarity thresholds. *arXiv:2411.05276*
- Production semantic caching reports **20–73% token cost reduction** (https://www.truefoundry.com/blog/semantic-caching).

### 2.7 Concrete adoptable techniques → OmniRoute implementation map
- **Embedding-similarity router** → reuse `embeddings/service.ts` + Qdrant; add an exemplar index keyed on prior `usage_history` success. *(cheapest first build)*
- **Two-tier cascade + reliability scorer** → weak model → cheap verifier (logprob/self-eval) → escalate; tunable cost-bias. Slots into `cooldownAwareRetry` + `fallbackPolicy`.
- **MF / Bradley-Terry win-probability classifier** → offline-trained logistic head served in `intelligentRouting.ts` as a new `taskFit`/`qualityFit` weight source.
- **Bandit online adaptation** → OmniRoute already has `explorationRate` in `IntelligentRoutingConfig` — wire it to Thompson sampling keyed on query cluster.
- **Pareto `costQualityKnob ∈ [0,1]`** → single user-facing slider along a precomputed convex hull; maps to existing `auto` strategies (cost/eco/latency/sla).
- **True semantic cache layer** → embedding lookup (cosine ~0.9–0.95) *before* model call, in front of `/v1/chat`; replace/augment exact-hash `semanticCache.ts`.
- **RouterBench-style offline eval harness** → replay labeled queries through candidate weight configs; pick non-dominated config; CI gate.
- **Training-free ELO + pairwise** → maintain per-model ELO from production win/loss; cheapest to keep fresh.

*Technical citations (19):* RouteLLM 2406.18665 · FrugalGPT 2305.05176 · Hybrid LLM 2404.14618 · AutoMix 2310.12963 · ZOOTER 2311.08692 · Leeroo 2401.13979 · MetaLLM 2407.10834 · GraphRouter 2410.03834 · Eagle 2409.15518 · semantic-router (github) · Spec decoding 2211.17192 · Speculative sampling 2302.01318 · Cascade routing 2410.10347 · RouterBench 2403.12031 · RouterEval 2503.10657 · GPTCache 2308.02490 + ACL · GPT Semantic Cache 2411.05276 · TrueFoundry semantic-cache blog.

---

## 3. User / Market Needs (Cited)

The provider ecosystem is fragmented, expensive, unreliable, and hard to govern. Buyers adopt a router to put a single resilient, cost-transparent, policy-enforcing control plane in front of every model. Ranked demand drivers:

1. **Cost savings** — largest driver. RouteLLM: **>85% cut at 95% GPT-4 quality** (lmsys). Routing only 14–26% of traffic to expensive models yields 75–85% savings (https://www.burnwise.io/blog/llm-model-routing-guide). Semantic caching: **20–73% token reduction** (TrueFoundry). Not Diamond cut its own inference cost **51% (~$750K/yr) with one line** (https://www.notdiamond.ai/blog/using-not-diamond-to-reduce-not-diamonds-inference-costs-by-51-with-one-line-of-code).
2. **Reliability / failover** — the clearest "why now." OpenAI logged **9 outages in one 2024 quarter** (https://www.assembled.com/blog/your-llm-provider-will-go-down-but-you-dont-have-to); June 2026 Claude outage (https://deployflow.co/blog/claude-anthropic-outage-protect-claude-infrastructure/). Buyers want code-free failover (LiteLLM, OpenRouter, Cloudflare ≤5 retries).
3. **Latency** — gateway overhead is a procurement criterion; Rust/Go gateways hold sub-1ms P99 at 10k QPS vs Python (https://dev.to/debmckinney/we-benchmarked-5-llm-gateways-at-5000-rps-heres-what-broke-28f3). Prompt caching cuts TTFT 75–85%.
4. **Single unified / OpenAI-compatible API** — integrate once, swap models via config (OpenRouter 400+ one endpoint; LiteLLM 100+ normalized). **OmniRoute already delivers this.**
5. **Observability / cost attribution** — token-level visibility per team/user/feature; Portkey ties every dollar to workspace/model/user/agent (https://portkey.ai/blog/llm-cost-attribution-for-genai-apps/); Helicone surfaced a 73% cache hit saving $1,247/mo (https://docs.helicone.ai/guides/cookbooks/cost-tracking).
6. **Quality routing** — naive cost-routing silently degrades accuracy. Martian RouterBench: **20% quality up, cost ~80× down**, users preferred router responses **79.2%** of the time (https://withmartian.com/post/introducing-routerbench). Not Diamond warns routing without an eval gate is "a quality gamble."
7. **BYOK / privacy / compliance** — EDPB Opinion 28/2024 + €5.88B cumulative fines drive data-control gating (https://www.truefoundry.com/blog/llm-deployment-in-regulated-industries-hipaa-soc2-and-gdpr-playbook-for-2026). Portkey: SOC2 Type 2/ISO/GDPR/HIPAA + air-gapped (https://portkey.ai/features/security-compliance).
8. **Spend governance** — LiteLLM enforces budgets at **5 levels** (key/user/member/team/org) (https://docs.litellm.ai/docs/proxy/users) with virtual keys (https://docs.litellm.ai/docs/proxy/virtual_keys). This is the enterprise procurement unblocker.
9. **Multi-tenant / team management** — Org→Team→User→Key with scoped RBAC (https://docs.litellm.ai/docs/proxy/multi_tenant_architecture).
10. **Guardrails / PII** — auto-redaction of PII before the model (https://portkey.ai/docs/product/guardrails/pii-redaction); Cloudflare Llama Guard + Presidio.

**Personas:** *Indie* → lowest-friction multi-model + hard spend caps. *Startup* → unified billing + model flexibility, speed over tuning. *Enterprise platform* → data sovereignty (VPC/on-prem), policy routing, SOC2/audit trails, cost attribution. *Agent builder* → per-key runaway-cost prevention + end-to-end tracing + cost-at-scale (https://workos.com/blog/model-routing-vs-tool-routing-ai-agents).

*Market citations (35):* lmsys RouteLLM · burnwise · agentbrisk prompt-cache · oreateai · TrueFoundry semantic-cache · Helicone monitor-costs · Not Diamond · dev.to 5-gateway benchmark · Martian RouterBench · TrueFoundry failover · Portkey routing-techniques · Assembled outages · LiteLLM reliability/budgets/vkeys/multi-tenant/team-budgets/rate-tiers · OpenRouter fallbacks/quickstart/BYOK · Cloudflare features · DeployFlow Claude outage · Portkey cost-attrib/PII/security · Helicone cost-cookbook · TrueFoundry regulated-industries · Kong AI Gateway · HN OpenRouter thread (48338956) · TrueFoundry litellm-vs-openrouter · ToolHalla comparison · AWS multi-LLM routing · WorkOS model-vs-tool routing.

---

## 4. Gap Analysis vs SOTA (Grounded in OmniRoute src/)

| # | Gap | Evidence in OmniRoute code | SOTA reference | Leverage |
|---|-----|----------------------------|----------------|----------|
| **G1** | **No learned quality routing.** `intelligentRouting.ts` uses fixed heuristic weights (`quota, health, costInv, latencyInv, taskFit, stability, tier...`). `taskFit` is not a *learned* quality predictor; `AUTO_ROUTING_STRATEGY_VALUES = [rules, cost, eco, latency, fast, sla, lkgp]` — all heuristic. No classifier/MF/ELO/win-rate anywhere (`grep routellm\|classifier\|elo\|winRate` → no routing hits). | RouteLLM (95%@85%cut), Martian, Unify, TrueFoundry | **Highest** |
| **G2** | **No true semantic cache; exact-hash cache is unwired.** `src/lib/semanticCache.ts` keys on `SHA-256(model+messages+temp+top_p)` — exact match only, despite the "Semantic Cache" header. It is **not imported into the `/v1` SSE chat path** (grep found no importer outside the file + tests). Misses 20–73% cost savings. | GPTCache, LiteLLM/Portkey/Kong/Bifrost semantic cache | **Highest** (primitives already exist: embeddings svc + Qdrant) |
| **G3** | **No spend governance / virtual keys / hierarchical budgets.** API-key policy exists (`enforceApiKeyPolicy`) but no per-key/per-team budget caps, spend ledgers, or org→team→user hierarchy. Cost calc exists (`costCalculator.ts`) but isn't enforced as a budget gate. | LiteLLM 5-level budgets, Portkey, TrueFoundry hier quotas | **High** (enterprise unblocker) |
| **G4** | **Weak cost-attribution observability.** Dashboards exist (`analytics/auto-routing`, `provider-metrics`, `provider-stats`) but no per-team/user/feature **cost-attribution ledger** or OTel trace export. | Portkey, Helicone, OTel-native Kong/Bifrost | **High** |
| **G5** | **No offline router-eval harness.** No RouterBench-style replay/convex-hull tooling to tune `IntelligentRoutingWeights` or prove quality preservation; weights are hand-set, `explorationRate` unused for learning. | RouterBench (AIQ metric), RouterEval | **High** (de-risks G1) |
| **G6** | **No guardrails / PII layer.** `grep` for PII/moderation/guardrails in routing path → none. No content moderation, PII redaction, or prompt-injection defense before dispatch. | Portkey 50+ guardrails, Cloudflare Llama Guard+Presidio | **Medium** (compliance gate) |
| **G7** | **No cascade routing.** `fallbackPolicy.ts` is failure-driven (provider down → next), not quality-driven (cheap answer rejected → escalate). No verifier/scorer between tiers. | FrugalGPT, AutoMix, cascade routing 2410.10347 | **Medium** |

**Top-5 SOTA gaps (ranked):** G1 learned quality routing · G2 true semantic cache (unwired) · G3 spend governance/virtual keys · G4 cost-attribution observability · G5 offline router-eval harness.

---

## 5. Prioritized SOTA Feature Roadmap

**Conventions:** agent-effort per global timescale rules (tool-calls / parallel subagents / wall-clock). Every feature: **85–100% coverage** across unit → e2e → perf → chaos. Acceptance criteria are testable.

### 5.1 DAG (dependencies)

```
P0 ──────────────────────────────────────────────
F1  Wire+upgrade Semantic Cache (embedding-similarity)   [G2]  no deps
F2  Cost-Attribution Ledger + OTel export                [G4]  no deps
F3  Spend Governance: virtual keys + hierarchical budgets [G3] depends F2 (ledger)

P1 ──────────────────────────────────────────────
F4  Router-Eval Harness (RouterBench-style convex hull)  [G5]  no deps (uses usage_history)
F5  Learned Quality Router v1 (embedding-kNN + ELO)       [G1] depends F1(embeddings infra), F4(eval gate)
F6  Guardrails/PII pre-dispatch layer                    [G6]  no deps

P2 ──────────────────────────────────────────────
F7  Learned Quality Router v2 (MF/classifier + bandit)    [G1] depends F5, F4
F8  Quality-driven Cascade Routing (verifier+escalate)    [G7] depends F5, F6
F9  Pareto costQualityKnob UX + auto-tuned weights        [G1/G5] depends F4, F7
```

### 5.2 Work packages

**F1 — Semantic Cache (embedding-similarity), P0** · *Effort: ~3–5 parallel subagents, 8–15 tool calls, ~8 min*
Replace/augment exact-hash `semanticCache.ts` with embedding lookup (reuse `embeddings/service.ts` + Qdrant `memory/vectorStore.ts`); wire into `/v1/chat` SSE path *before* dispatch; cosine threshold config (default 0.92), per-key bypass header (already `X-OmniRoute-No-Cache`), temperature-0 default + opt-in for >0.
- **AC:** cache hit on semantically-equivalent (not byte-identical) prompt returns stored response in <50ms; hit-rate + $-saved surfaced in dashboard; bypass header honored; no cache for streaming tool-calls unless deterministic.
- **Coverage:** unit (hash+embedding key, threshold boundaries, eviction) · e2e (`/v1/chat` hit/miss/bypass) · perf (lookup p99 <15ms at 1k cached) · chaos (Qdrant down → graceful pass-through, no request failure).

**F2 — Cost-Attribution Ledger + OTel, P0** · *Effort: ~2–3 subagents, 6–10 tool calls, ~5 min*
Persist per-request `(key, team, user, model, provider, in/out tokens, cost, latency, cache_hit, route_strategy)` via `costCalculator.ts`; OTel span export; per-dimension rollups.
- **AC:** every `/v1` request writes a ledger row; dashboard shows cost by key/team/model/day; OTel traces exported to a configurable collector; cache hits recorded as $0 with `cache_hit=true`.
- **Coverage:** unit (cost calc per pricing tier, attribution keys) · e2e (request → ledger row → rollup) · perf (ledger write off hot path, <1ms added) · chaos (DB write failure → buffered, no request loss).

**F3 — Spend Governance (virtual keys + hierarchical budgets), P0** · *Effort: ~3–5 subagents, 10–15 tool calls, ~12 min*
Org→Team→User→Key hierarchy; per-level budget caps + TPM/RPM; enforce as pre-dispatch gate reading F2 ledger; 402/429 on breach with actionable error.
- **AC:** key over budget → request rejected with clear error + retry-after; team cap aggregates member spend; budgets reset on window; LiteLLM-parity 5 levels.
- **Coverage:** unit (budget math, window reset, hierarchy aggregation) · e2e (spend until cap → block → reset → allow) · perf (gate adds <2ms) · chaos (ledger lag → fail-closed configurable).

**F4 — Router-Eval Harness, P1** · *Effort: ~2–3 subagents, 8–12 tool calls, ~10 min*
Replay labeled query set (seed from `usage_history`) through candidate `IntelligentRoutingWeights`; compute cost-quality convex hull + AIQ; CI gate selecting non-dominated config.
- **AC:** harness outputs convex-hull plot + AIQ per config; CI fails if a weight change regresses AIQ >X%; reproducible on fixed seed set.
- **Coverage:** unit (AIQ/convex-hull math, dominance) · e2e (replay → ranked configs) · perf (replay 10k queries < N min) · chaos (missing labels → skip, no crash).

**F5 — Learned Quality Router v1 (embedding-kNN + ELO), P1** · *Effort: ~4–6 subagents, 15–25 tool calls, ~18 min*
Embedding-kNN over labeled exemplars (cheapest from §2.7) + per-model ELO updated from production win/loss; feed as a *learned* `qualityFit` weight source into `intelligentRouting.ts`; gate ship behind F4 AIQ.
- **AC:** for a held-out set, v1 achieves ≥X% cost reduction at ≤Y% quality loss vs always-frontier, proven by F4; ELO updates online from feedback signal; explainable route decision logged.
- **Coverage:** unit (kNN vote, ELO update, weight blend) · e2e (route decision + telemetry) · perf (added route latency <10ms) · chaos (vector store down → fall back to heuristic weights).

**F6 — Guardrails / PII pre-dispatch, P1** · *Effort: ~3 subagents, 8–12 tool calls, ~8 min*
PII detection/redaction + content moderation + prompt-injection heuristic before dispatch; pluggable (Presidio-style + optional Llama Guard provider); per-key policy.
- **AC:** PII redacted before leaving OmniRoute; policy violation → blocked with reason; opt-in per key/team; logged to F2 ledger.
- **Coverage:** unit (PII regex/NER, redaction, policy eval) · e2e (PII prompt → redacted upstream) · perf (<5ms) · chaos (guardrail provider down → fail-closed configurable).

**F7 — Learned Quality Router v2 (MF/classifier + bandit), P2** · *Effort: ~5 subagents, 20–30 tool calls, ~20 min*
Offline matrix-factorization / logistic win-probability head (RouteLLM-style) + Thompson-sampling bandit wired to existing `explorationRate`; replaces v1's ELO-only signal.
- **AC:** v2 dominates v1 on F4 convex hull (higher AIQ); bandit demonstrably adapts to a synthetic distribution shift; zero quality regression on held-out gate.
- **Coverage:** unit (MF inference, bandit posterior update) · e2e (shift → adaptation) · perf · chaos (model artifact missing → v1 fallback).

**F8 — Quality-driven Cascade Routing, P2** · *Effort: ~4 subagents, 15–20 tool calls, ~15 min*
Weak→verifier→escalate (FrugalGPT/AutoMix); cheap verifier (logprob/self-eval); tunable cost-bias; integrates F5/F6.
- **AC:** cascade matches frontier accuracy at ≥Z% cost reduction on eval set; escalation rate tunable; verifier latency bounded.
- **Coverage:** unit (verifier scorer, escalation threshold) · e2e (easy→cheap, hard→escalate) · perf (cascade tail latency bound) · chaos (verifier failure → conservative escalate).

**F9 — Pareto `costQualityKnob` UX + auto-tuned weights, P2** · *Effort: ~3 subagents, 10–15 tool calls, ~10 min*
Single user-facing slider [0,1] mapping to a point on the F4 convex hull; auto-derive `IntelligentRoutingWeights` from operating point; expose per-key default.
- **AC:** knob moves the realized cost/quality along the measured frontier within tolerance; per-key/per-request override; documented.
- **Coverage:** unit (knob→weights mapping, frontier interpolation) · e2e (knob change → route shift) · perf · chaos (no frontier data → safe default).

### 5.3 Critical path & sequencing
`F1/F2 (P0, parallel) → F3 (P0) → F4 (P1, parallel with F6) → F5 (P1) → F7 → {F8, F9} (P2)`. F1 (semantic cache) and F2 (ledger) are the fastest, highest-ROI wins and unblock everything else: F2→F3 (governance), F1→F5 (embedding infra), F4→F5/F7/F9 (eval gate). Ship P0 as a "v4.0 cost+governance" release; P1 as "intelligent routing"; P2 as "SOTA quality router."

---

## 6. Citation Count & Provenance
- **Competitor citations:** ~80 URLs (§1.3).
- **Technical citations:** 19 (§2.7).
- **Market citations:** 35 (§3).
- **Total distinct citations: ~130+.**
- **Code-grounded gap evidence:** `intelligentRouting.ts`, `semanticCache.ts`, `routingStrategies.ts`, `fallbackPolicy.ts`, `tagRouter.ts`, `costCalculator.ts`, `embeddings/service.ts`, `memory/` (Qdrant), `circuitBreaker.ts`, `cooldownAwareRetry.ts`, `resolveRoutingModel.ts`.

*Caveats:* a few market sources are vendor/aggregator blogs (burnwise, agentbrisk, ToolHalla) — load-bearing quantified claims rest on primary sources (lmsys, Not Diamond, Martian, LiteLLM/Portkey/Cloudflare docs, Assembled). Several competitor `?` cells reflect *absent documentation*, not confirmed "no" (Martian semantic-cache/BYOK, Eden AI streaming/compat, Unify guardrails). Helicone SaaS is in maintenance mode post-Mintlify acquisition (Mar 2026).
