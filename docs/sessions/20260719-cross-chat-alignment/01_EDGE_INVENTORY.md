# Edge Inventory — Dispatch Binding Tiers (ADR-032)

## 16 Edge Modules × Tier × FFI × Test × Wiring

| #   | Edge Name                               | Default Tier | FFI Crate       | TS Test | Prod Wired | Notes                                          |
| --- | --------------------------------------- | ------------ | --------------- | ------- | ---------- | ---------------------------------------------- |
| 1   | scoring.combo.scoreSimd                 | T3           | combo-scorer    | ✅      | ❌         | Rust tested (5 exports, 3 tests)               |
| 2   | sse.chunk.sseStream                     | T3           | sse-chunking    | ✅      | ❌         | Rust tested (0 exports, 0 tests — source only) |
| 3   | cache.semantic.lookup                   | T3           | signature-cache | ✅      | ❌         | Rust tested (0 exports, 3 inline tests)        |
| 4   | guardrails.pii.anonymize                | T3           | guardrails-pii  | ✅      | ❌         | FFI not yet created                            |
| 5   | rateLimit.tokenBucket.consume           | T3           | token-bucket    | ✅      | ❌         | FFI not yet created                            |
| 6   | compression.lite.compressToolResults    | T2           | —               | ✅      | ❌         | UDS RPC only                                   |
| 7   | compression.lite.dedupSystemPrompt      | T2           | —               | ✅      | ❌         | UDS RPC only                                   |
| 8   | compression.lite.removeRedundantContent | T2           | —               | ✅      | ❌         | UDS RPC only                                   |
| 9   | compression.lite.collapseWhitespace     | T2           | —               | ✅      | ❌         | UDS RPC only                                   |
| 10  | compression.lite.cacheLookup            | T2           | —               | ✅      | ❌         | UDS RPC only                                   |
| 11  | usage.sync                              | T2           | —               | ✅      | ❌         | UDS RPC only                                   |
| 12  | pricing.sync                            | T1           | —               | ✅      | ❌         | HTTP only                                      |
| 13  | webhook.dispatch                        | T2           | —               | ✅      | ❌         | UDS RPC only                                   |
| 14  | metrics.render                          | T1           | —               | ✅      | ❌         | HTTP only                                      |
| 15  | scheduler.tick                          | T2           | —               | ✅      | ❌         | UDS RPC only                                   |
| 16  | config.reload                           | T1           | —               | ✅      | ❌         | HTTP only                                      |

## Summary

- **T3 edges**: 5 (scoring, sse, cache, guardrails, token-bucket) — need FFI crates
- **T2 edges**: 6 (compression ×5, usage, webhook, scheduler) — need UDS RPC server
- **T1 edges**: 3 (pricing, metrics, config) — HTTP only
- **Prod wired**: 0/16 — ALL need wiring after tier-resolver fix

## Hot-Path Priority (P1 after tier-resolver fix)

1. `sse.chunk.sseStream` → chatCore.ts SSE loop
2. `scoring.combo.scoreSimd` → combo.ts scorePool()
3. `rateLimit.tokenBucket.consume` → rateLimitManager.ts withRateLimit()
4. `guardrails.pii.anonymize` → piiMasker.ts preCall()
5. `bifrost.bridge` → bifrost.ts execute() UDS fast-path
