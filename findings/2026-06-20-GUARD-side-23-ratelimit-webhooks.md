# Guard — Rate-Limit Webhook Ingestion (side-23)

**Date:** 2026-06-20 18:50 PDT
**Task ID:** side-23
**Agent:** orch-v11-real-guard-5
**Verdict:** Webhook ingestion across **4 fleet services** is **unrate-limited**. A single misconfigured client (or a deliberate abuse) can saturate the receiver, OOM the JSON parser, or starve other tenants. Recommend a token-bucket middleware at the `axum::middleware::from_fn` boundary with per-source buckets.

## Scope

Webhook receivers (consumers of inbound HTTP POSTs from third parties: payment gateways, GitHub, Stripe, Slack, PagerDuty, custom partner integrations) currently live in:
- `phenotype-payment-core` (Stripe, payment-gateway webhooks)
- `phenotype-hub` (GitHub, GitLab, generic CI webhooks)
- `phenotype-notify` (Slack, PagerDuty, Twilio inbound)
- `phenotype-forms` (Typeform, Jotform, custom forms)

All four parse JSON, dispatch to a queue, and ack. None apply backpressure or per-source limits.

## Threat model (current)

| Scenario | Current behavior | Impact |
|---|---|---|
| Stripe sends 10x burst (legit retry storm) | accepted, OOMs the queue | full webhook stall |
| Malicious actor scripts `for i in {1..100000}; do curl ...; done` | accepted, saturates CPU | DoS |
| Multi-tenant abuse: tenant A floods, tenant B's webhooks delayed | no fairness | SLA breach on tenant B |
| Untrusted JSON: 100MB payload | accepted, parsed | OOM |

## Proposed middleware (`pheno-ratelimit` crate, new)

```rust
// pheno-ratelimit/src/webhook.rs
use std::sync::Arc;
use axum::{extract::{Request, State}, middleware::Next, response::Response, http::StatusCode};
use pheno_ratelimit::{TokenBucket, BucketKey, Decision};

pub async fn webhook_ratelimit(
    State(reg): State<Arc<BucketRegistry>>,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Key strategy: prefer X-Webhook-Source header, fall back to peer IP.
    let key = req.headers().get("x-webhook-source")
        .and_then(|v| v.to_str().ok())
        .map(|s| BucketKey::Source(s.to_string()))
        .unwrap_or_else(|| BucketKey::PeerIp(req.extensions().get::<PeerIp>().cloned()));

    match reg.check(&key, req.method().as_str(), req.uri().path()) {
        Decision::Allow => Ok(next.run(req).await),
        Decision::Deny { retry_after } => {
            // 429 + Retry-After header
            Err(StatusCode::TOO_MANY_REQUESTS) // also emit retry_after in header
        }
    }
}
```

## Per-source bucket table (default, configurable per route)

| Source | Requests/sec | Burst | Notes |
|---|---|---|---|
| `stripe.com` | 100 | 200 | matches Stripe's published retry-after semantics |
| `github.com` | 50 | 100 | matches GitHub's webhook delivery rate |
| `slack.com` | 30 | 60 | conservative; Slack rate-limit headers inform |
| `pagerduty.com` | 10 | 20 | low-traffic; alerts are bursty |
| `*` (catch-all) | 5 | 10 | per peer IP; protects against unknown sources |

Per-source overrides are loaded from `Configra` (ADR-031) at startup; runtime mutation triggers a config reload + bucket resize.

## Telemetry

Every `Allow` and `Deny` decision emits an OTLP span via `pheno-tracing` (ADR-012) and a counter:
- `pheno.ratelimit.decision{outcome="allow|deny", source, route}` (counter)
- `pheno.ratelimit.bucket.remaining{source}` (gauge)
- `pheno.ratelimit.deny_ratio{source}` (ratio, alerts at >0.05 sustained 5min)

`Deny` at P0 (source unknown + sustained 5min) pages on-call via existing `phenotype-notify` (PagerDuty).

## Why this matters

1. **DoS via webhook is the cheapest fleet attack** — no auth needed for many endpoints (webhooks are typically signed but not authenticated pre-parse).
2. Without backpressure, a single bad client can pin the executor (Tokio) and starve every other tenant — the failure mode is *silent*, not loud.
3. ADR-046 (federation mTLS) does *not* address inbound-webhook abuse; rate-limiting is the complementary control.

## Action items

1. **Author `pheno-ratelimit` crate** — token-bucket core + axum middleware; ~300 LOC + ~250 LOC tests.
2. **Add middleware to `phenotype-payment-core`** first — highest-volume webhook receiver.
3. **Mirror to `phenotype-hub`, `phenotype-notify`, `phenotype-forms`** — same `webhook_ratelimit` middleware, per-source table overridden in config.
4. **Emit OTLP metrics** wired to `pheno-tracing` (ADR-012).
5. **Document in `phenotype-hub/docs/webhook-ratelimit.md`** (operator-facing; covers per-source tuning).

## When to skip

- **Internal RPC** (mTLS-authenticated, ADR-046) — federation mTLS is the rate-limit there; not webhook-shaped.
- **Already rate-limited receivers** (e.g. the GitHub App integration that uses GitHub's own rate-limit headers) — verify with `curl -I` and skip if `X-RateLimit-Remaining` is already consumed by the upstream.

## Acceptance criteria

- `pheno-ratelimit` crate published with ≥ 80% coverage within **2 weeks**.
- All 4 webhook receivers adopt the middleware within **3 weeks**.
- Synthetic load test (1000 RPS for 60s) shows <0.1% `Deny` for legitimate Stripe sources and 100% `Deny` for unknown IPs within the catch-all bucket.

**Refs:** `ADR-012` (tracing), `ADR-031` (Configra), `ADR-046` (mTLS federation), `pheno-tracing/src/`, `phenotype-payment-core/src/webhooks/`.