---
title: Feature Flags
---

# Feature Flags

Toggle without redeploy. Read at request time.

| Flag | Default | Effect |
|------|---------|--------|
| `failover-on-quota` | `true` | Switch provider when primary returns 429 |
| `exponential-backoff` | `true` | 2^n backoff between retries |
| `audit-chain` | `true` | Hash-chained audit log |
| `cost-rollup` | `true` | Aggregate per-request cost |
| `sse-shim` | `true` | OpenAI SSE streaming shim |
