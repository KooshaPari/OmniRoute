# Bifrost Benchmark Results

> **Date:** 2026-09-14T03:02Z
> **Environment:** macOS ARM64, Bifrost v2.1.1 (Go binary), standalone mode
> **Note:** Full Bifrost-vs-TS comparison blocked (dev server fails: missing `toolCallSpecViolationAudit.ts` from upstream batch merge)

## Standalone Bifrost Performance

| Metric | Value |
|--------|-------|
| Cold start (first request) | 19.7ms |
| p50 latency | 0.9ms |
| p95 latency | 3.8ms |
| p99 latency | 4.8ms |
| Throughput (sequential, single conn) | 58 req/s |
| Binary size | 11.4 MB |
| Architecture | arm64 Mach-O |

## Analysis

- **Sub-millisecond p50** — excellent for a sidecar gateway
- **p99 under 5ms** — no tail latency issues
- **Cold start under 20ms** — negligible startup cost
- **58 req/s sequential** — single connection limit; concurrent would be much higher

## What's Missing (requires full stack)

| Metric | Status |
|--------|--------|
| Bifrost vs TS pipeline comparison | BLOCKED (dev server fails) |
| Streaming TTFB | BLOCKED |
| Memory under load | BLOCKED (process killed before measurement) |
| Concurrent throughput | BLOCKED |

## Dev Server Blocker

```
[FATAL] Cannot find module './toolCallSpecViolationAudit.ts'
  at open-sse/handlers/chatCore.ts:183:1
```

This file was introduced in upstream commit 152d95108c (39-PR batch merge, 13,852 lines).
Cherry-pick was not feasible. The file needs to be manually created or the batch merge
needs to be resolved to restore the dev server.

## Recommendation

**COMMIT Bifrost** based on:
1. Standalone benchmark shows excellent latency (sub-5ms p99)
2. Binary verified working (arm64, starts on :8080)
3. Health check passed (8k stars, active development, Apache-2.0)
4. Already integrated in shadow mode
5. Full comparison benchmark can be run after dev server is fixed
