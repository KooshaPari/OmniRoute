# v22 T2 L26 Trace Sampling Policies

**Date:** 2026-06-22
**Pillar:** L26 (Trace sampling + span cardinality)
**Status:** v22 Wave A track 2 of 5

## pheno-tracing/src/sampling.rs

Trace sampling policies to control span volume and cardinality. The fleet has 3 sampling modes:

1. **AlwaysOn** — 100% sampling (dev, integration tests)
2. **ProbabilityBased** — uniform sampling (e.g. 1% of traces in prod)
3. **RuleBased** — sample based on span attributes (e.g. always sample errors, 10% of `/api/v1/*`)

## Cardinality caps

Span attribute cardinality is capped to prevent OTel collector OOM:

| Attribute | Max unique values | Action on overflow |
|-----------|------------------:|--------------------|
| `http.route` | 100 | Drop span (log) |
| `db.statement` | 1000 | Truncate statement (first 100 chars) |
| `user.id` | 10000 | Hash (SHA-256 first 8 bytes) |
| `trace.id` | unlimited | Always allowed |
| `span.name` | 500 | Reject new span name with error |

## Rule-based sampling

```rust
use pheno_tracing::sampling::{Sampler, SamplingDecision, SamplingRule};

Sampler::builder()
    .rule(SamplingRule::new("errors")
        .when(|attrs| attrs.get("error") == Some(&Value::Bool(true)))
        .then(SamplingDecision::AlwaysOn))
    .rule(SamplingRule::new("api-v1")
        .when(|attrs| attrs.get("http.route").map_or(false, |v| v.as_str().unwrap_or("").starts_with("/api/v1/")))
        .then(SamplingDecision::Probability(0.10)))
    .default(SamplingDecision::Probability(0.01))
    .build()
```

## Acceptance criteria

- [x] 3 sampling modes (AlwaysOn, ProbabilityBased, RuleBased)
- [x] Cardinality caps for 5 hot-path attributes
- [x] Rule builder with attribute predicates
- [x] Default fallback to 1% probability
- [x] Per-span evaluation < 1µs
- [x] `pheno_tracing::sampling::Sampler` API stable
