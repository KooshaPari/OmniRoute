# Migration Strategy — Strangler-Fig for OmniRoute non-frontend rewrite

**Session:** 20260705-omniroute-backend-rewrite / 04-migration-strategy
**Author:** root (main thread)
**Date:** 2026-07-05 03:34Z
**Prior decision (D8, tentative):** "Strangler-fig, parallel-run 1 quarter behind feature flag"
**Scope:** 0-downtime cutover from TS fork (`src/`, `open-sse/`, `bin/`) to Rust workspace (`omniroute-rust/`) for the non-frontend surface. The TS fork serves an Electron desktop app, the OpenCode plugin, and OpenAI-compatible HTTP clients.

## Top bracket

```
[strangler-fig | 6 phases | 24-32 weeks calendar | shadow → per-tenant →
 per-model → weighted → full → decommission | feature flag = x-omniroute-route
 + tenant_id + model_id | dual-write via shadow mirror | divergence detect
 via body-hash + final-chunk | OTel metrics | kill switch via config reload |
 risk gates: p99 +5%, error +0.1%, divergence > 0.5% | 4-agent fleet]
```

## 1. Reference case studies

### Shopify Rails → Sinatra/Go pieces (2015-2018)

- **URL:** https://shopify.engineering/shopify-monolith
- **Pattern:** extract the monolith piece by piece; new services share the same DB; the old monolith proxies to the new for "owned" routes
- **Lesson:** the DB shared between old and new is the risk — schema migrations must be backwards-compatible. Add columns nullable, never drop, until the old code is fully decommissioned.
- **Applies to OmniRoute:** yes — the SQLite schema at `~/.omniroute/storage.sqlite` is shared. Use additive migrations only during migration.

### GitHub Ruby → unified service mesh (2019-2022)

- **URL:** https://github.blog/engineering/architecture-in-github/
- **Pattern:** new services register with the mesh; old code is a fallback; gradually shift traffic by route + tenant
- **Lesson:** feature flags at the edge router (Envoy) are the control point. Don't put the flag in the application code.
- **Applies to OmniRoute:** yes — the gateway (`omni-server`) is the edge router. Feature flag at the gateway, not in the application logic.

### Netflix monolith → cloud-native (2008-2012)

- **URL:** https://www.nginx.com/blog/microservices-at-netflix-architectural-best-practices/
- **Pattern:** Hystrix for circuit breaking; chaos engineering; per-service canary
- **Lesson:** chaos engineering is essential — randomly kill instances, inject latency, verify fallbacks work. **OmniRoute rewrite should adopt chaos engineering for the v1 rollout.**
- **Applies to OmniRoute:** yes — `omni-server` should have chaos-test scripts that inject provider latency/errors.

### Cloudflare Workers incremental migration (2018-2020)

- **URL:** https://blog.cloudflare.com/code-migration/
- **Pattern:** Workers sit in front of the origin; routes are migrated one-by-one; the origin (old code) serves the rest
- **Lesson:** the Workers/origin split is the cleanest model. The origin (TS fork) keeps running until the Workers (Rust) handle 100%.
- **Applies to OmniRoute:** yes — `omni-server` is the new origin; the TS fork is the old origin during migration.

### LLM gateway rewrites (less public evidence in 2026)

- Helicone: ongoing TS rewrite to Rust for the hot path
- Portkey: gateway is Go, dashboard is TS
- Maxim AI Bifrost: pure Go rewrite from an older TS prototype
- **Pattern:** all three moved the **hot path** (request proxying, streaming) to a compiled language (Go or Rust). The dashboard / admin stayed in TS/Python.
- **Applies to OmniRoute:** yes — this is the same pattern. `omni-server` is the hot path; admin UI stays in TS/Next.js (out of scope for the rewrite).

## 2. Concrete runtime topology — 6 phases

### Phase 0 — "shadow" (weeks 1-4)

**Goal:** new Rust server runs in parallel; takes a copy of every request; logs its output; does NOT respond to the client. The TS fork still serves.

**Runtime topology:**

```
Client --> TS fork (src/server) --> provider outbound (serves client)
              |
              +--> x-omniroute-shadow: true header
                   |
                   v
              Rust omni-server (logs response, returns nothing to client)
```

- **Mechanism:** Envoy `mirror` policy, or a custom middleware in the TS fork that copies the request to the Rust server with the header set
- **Entry criteria:** TS fork + Rust omni-server both deployed; routing infrastructure in place
- **Exit criteria:** 1M+ shadow requests processed; divergence rate measured and documented
- **Kill switch:** disable the Envoy mirror policy
- **Observability:** shadow request count, shadow request latency, shadow error rate, divergence count
- **Dual-write validation:** every shadow request is logged to `omni-storage-shadow.db` for offline analysis

### Phase 1 — "per-tenant canary" (weeks 5-8)

**Goal:** tenants with `feature_flag=omniroute_v2=enabled` route to the Rust server. Other tenants route to the TS fork.

**Runtime topology:**

```
Client --> Rust omni-server (if tenant in canary list)
       \-> TS fork (otherwise)
              |
              v
         provider outbound
```

- **Mechanism:** the gateway (`omni-server` itself) checks the `tenants` table for `omniroute_v2 = enabled`. TS fork checks the same table.
- **Entry criteria:** Phase 0 complete; feature flag system in place; canary list defined (start with 1 internal tenant)
- **Exit criteria:** 3+ tenants in canary for 2+ weeks with no regressions
- **Kill switch:** `UPDATE tenants SET omniroute_v2 = 'disabled' WHERE id IN (canary_list);`
- **Observability:** per-tenant error rate, per-tenant p99 latency, per-tenant divergence rate
- **Dual-write validation:** for canary tenants, both stacks process the request; results compared in `usage_history` table

### Phase 2 — "per-model canary" (weeks 9-12)

**Goal:** specific model ids route to the Rust server. Other models route to the TS fork.

- **Mechanism:** the gateway checks `models.canary_rust = true` for the requested model
- **Entry criteria:** Phase 1 complete; canary models defined (start with `gpt-4o`, `claude-opus-4-5`)
- **Exit criteria:** 5+ models in canary for 2+ weeks with no regressions
- **Kill switch:** `UPDATE models SET canary_rust = false WHERE id IN (canary_list);`
- **Observability:** per-model error rate, per-model p99 latency, per-model divergence rate
- **Dual-write validation:** same as Phase 1

### Phase 3 — "weighted cutover" (weeks 13-18)

**Goal:** X% of traffic to the Rust server (regardless of tenant/model), with automatic rollback on regression.

- **Mechanism:** Envoy weighted routing OR custom weighted routing in the gateway. Start with 1%, ramp to 10%, 25%, 50%, 100%.
- **Entry criteria:** Phase 2 complete; chaos engineering scripts in place; canary rollback automation tested
- **Exit criteria:** 100% traffic for 1+ week with no regressions AND chaos engineering passes
- **Kill switch:** automatic rollback if divergence rate > 0.5% OR p99 latency +5% OR error rate +0.1%
- **Observability:** full OTel + dashboard; alerts on every metric
- **Dual-write validation:** N/A (full Rust serve)

### Phase 4 — "full cutover" (weeks 19-22)

**Goal:** Rust serves 100%. TS fork becomes standby, can be decommissioned in N days.

- **Mechanism:** Envoy default route to Rust; TS fork serves only on explicit `x-omniroute-route: ts` header
- **Entry criteria:** Phase 3 complete; ops docs updated; rollback tested at least 3 times
- **Exit criteria:** 2+ weeks at 100% with no regressions; on-call rotation has signed off
- **Kill switch:** `x-omniroute-route: ts` header at the gateway; ops can force-route to TS in <30s
- **Observability:** same as Phase 3

### Phase 5 — "decommission" (weeks 23-24)

**Goal:** TS fork code removed in a single PR per the AGENTS.md "no backwards compat shims" policy.

- **Mechanism:** per the AGENTS.md: "Remove old implementations entirely. Don't leave deprecated code behind." One PR that deletes the TS code.
- **Entry criteria:** Phase 4 complete; on-call signed off; ops docs finalized
- **Exit criteria:** `git log` shows the delete PR merged; CI green; production stable
- **Kill switch:** git revert + redeploy (revert is a 5-minute operation, not a 5-day one)

## 3. Feature flag system

**Single header:** `x-omniroute-route: ts|rust|auto` (default `auto`)

**Tenant override:** `tenants.omniroute_v2` column (`enabled|disabled|shadow`)

**Model override:** `models.canary_rust` column (`true|false`)

**Routing decision tree (in `omni-server`):**

```
if header == 'ts' -> TS fork
if header == 'rust' -> Rust
if header == 'auto' (default):
    if tenant.omniroute_v2 == 'enabled' -> Rust
    if model.canary_rust == true -> Rust
    if weighted_random < rust_traffic_pct -> Rust
    else -> TS fork
```

**Rollout mechanism:** in-house feature flag table (the `tenants` and `models` tables). No third-party service. The TS fork reads the same tables via the shared `~/.omniroute/storage.sqlite`.

## 4. Dual-write validation

When both stacks process a request, divergence detection compares:

| Field | Comparison | Note |
|---|---|---|
| Response status | `==` | Hard requirement |
| Response body hash | SHA256 `==` | For non-streaming |
| First-chunk latency | `within 10%` | For streaming |
| Final-chunk content | SHA256 `==` | For streaming |
| Chunk count | `within 5%` | For streaming |
| Total response time | `within 20%` | Soft check |
| Token count | `within 5%` | Soft check |
| Headers | `Set` equality | Required (cache-control, x-request-id) |

**Divergence log:** `usage_history` table gains a `divergence_*` column set. A separate `divergences` table records every divergence with full request/response capture for postmortem.

**Reference:** similar to Envoy's `mirrored_request` validation pattern. (https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/http/http_routing#mirroring)

## 5. Shadow traffic

**Mechanism:** Envoy `mirror` policy with `runtime_fraction: {default_value: {numerator: 100, ...}}` for the shadow phase, ramping down as we move to per-tenant canary.

**Alternative:** custom middleware in the TS fork that copies the request to the Rust server with `x-omniroute-shadow: true`.

**Both approaches:** the shadow request does NOT affect the client. The Rust server's response is discarded (or logged to `omni-storage-shadow.db`).

**Reference:** https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/router_filter#x-envoy-retries

## 6. Observability + kill switches

### OpenTelemetry resource attributes

- `service.name = "omniroute-rust"` (vs `service.name = "omniroute-ts"` for the TS fork)
- `service.version = "<rust-crate-version>"`
- `deployment.environment = "prod|staging|dev"`
- `omniroute.route = "rust|ts"`
- `omniroute.tenant_id = "<uuid>"`
- `omniroute.model_id = "<string>"`
- `omniroute.provider = "<string>"`
- `omniroute.phase = "0|1|2|3|4|5"`

### Metrics

- `omniroute.requests.total` (counter, by route, tenant, model, provider)
- `omniroute.requests.errors` (counter, by error_kind, provider)
- `omniroute.requests.duration` (histogram, by route, provider)
- `omniroute.requests.first_chunk_duration` (histogram, for streaming)
- `omniroute.requests.tokens` (histogram, by token_type — input/output/cache_hit)
- `omniroute.cost.usd` (counter, by tenant, provider, model)
- `omniroute.divergence.count` (counter, by field)
- `omniroute.divergence.rate` (gauge, by phase)
- `omniroute.circuit_breaker.state` (gauge, by provider)
- `omniroute.rate_limit.usage` (gauge, by tenant, model)

### Alerts

- p99 latency +5% for 5 minutes (PagerDuty on-call)
- Error rate +0.1% for 5 minutes
- Divergence rate > 0.5% for 10 minutes
- Circuit breaker open for any provider for >1 minute
- Rate limit exhausted for any tenant

### Kill switch mechanism

- **Config reload:** `kill -HUP <pid>` triggers the gateway to re-read the routing config from the DB
- **Per-tenant kill:** `UPDATE tenants SET omniroute_v2 = 'disabled' WHERE id = ?;`
- **Per-model kill:** `UPDATE models SET canary_rust = false WHERE id = ?;`
- **Global kill:** `UPDATE global_config SET rust_traffic_pct = 0;`
- **Rollback time target:** <30 seconds from alert to traffic shifted back to TS

## 7. Risk gates per phase

| Phase | Risk gate | Threshold | Action on breach |
|---|---|---|---|
| 0 (shadow) | Divergence rate | > 5% | Pause shadow; analyze divergences |
| 1 (per-tenant) | Per-tenant p99 +5% for 5 min | Yes | Disable that tenant's canary |
| 1 | Per-tenant error rate +0.5% | Yes | Disable that tenant's canary |
| 2 (per-model) | Same as Phase 1, per model | Yes | Disable that model's canary |
| 3 (weighted) | Aggregate p99 +5% | Yes | Drop traffic % by 50% |
| 3 | Aggregate error rate +0.1% | Yes | Drop traffic % by 50% |
| 3 | Aggregate divergence > 0.5% | Yes | Drop traffic % to 0% |
| 4 (full) | Same as Phase 3, but rollback to Phase 3 | Yes | Roll back |
| 5 (decommission) | N/A | N/A | git revert |

## 8. Calendar (4-concurrency-slot fleet)

| Phase | Weeks | Cumulative | Parallel agents (max 4) | Notes |
|---|---|---|---|---|
| 0 (shadow) | 4 | 4 | 4 | Build shadow infrastructure; port 30 provider adapters; port omni-server to serve shadow-only |
| 1 (per-tenant) | 4 | 8 | 4 | Add feature flag system; port 50 more provider adapters; test with internal tenants |
| 2 (per-model) | 4 | 12 | 4 | Port 50 more; add chaos engineering scripts |
| 3 (weighted) | 6 | 18 | 4 | All 149 provider adapters ported; perf hardening; chaos testing |
| 4 (full) | 4 | 22 | 2 | Ops docs; on-call training; monitoring dashboards |
| 5 (decommission) | 2 | 24 | 1 | TS fork delete PR; final cleanup |
| **Total v1** | **24 weeks** | 24 | avg 3.5 | Q3 2026 → Q1 2027 ship |

**Calendar target:** if we start 2026-07-15, v1 ships 2027-01-01. Realistic for a 4-slot fleet, with the existing scaffold providing ~12 weeks of lead time on `omni-core`, `omni-protocol`, `omni-storage` design.

**Risk to calendar:** the provider adapter port is the bottleneck. 149 providers × 1-3 days each = 150-450 days single-engineer. With 4-agent fleet, parallelize to ~6-12 weeks.

## 9. Open questions for sponsor

1. **Is the canary tenant list acceptable?** Start with `internal-test-tenant` only; expand to friendly external tenants in Phase 1.5. Confirm or modify.
2. **Is the chaos engineering script suite in scope?** Adds ~2 weeks to Phase 2-3. Recommend yes.
3. **Is the v1.5 bifrost pivot in the calendar?** If yes, the v1 phase 5 decomposition is bimodal (rust-then-bifrost). Recommend defer to v1.5.
4. **Is the i18n (42 locales) deferred to v1.5?** Recommend yes; not on the critical path.
5. **Is the tproxy native module in scope?** Per Phase 0-5 above, deferred to v2. Confirm.
6. **Should the OpenCode plugin be a "first-class consumer" of the rewrite?** It already lives in TypeScript. The plugin must consume the same `/v1/models` API that the Rust server exposes. Confirm or specify the contract.

