# OmniRoute Performance Audit — Phase 3 Report

## Measured data

| Metric | Value |
|--------|-------|
| Cold-start open-sse module load | **2,317ms** (first import) |
| proxyFallback.ts import cost | **210ms** (SQLite init + undici re-import) |
| proxyDispatcher.ts import cost | **69ms** |
| Handlers/streaming code | **686ms** |
| Services (token refresh, etc.) | **172ms** |
| Provider registry (211 files, 1.7MB) | **<5ms** (per-file lazy) |
| Provider constants lazy Proxy | **0.24ms** (first access) |
| Provider models lazy Proxy | **0.17ms** (first access) |
| Static provider imports (eager) | **~201 files** (module eval, ~200–500ms I/O) |
| Executor singletons at module level | **42** |
| Module-level `setInterval` timers | **24** (many NOT `unref()`-ed) |
| Polyfill/global-patch operations | **5+** |
| DB size | 1.4GB+, usage_history 250K+ rows |
| SQLite cache_size | 16MB (conservative) |
| mmap_size in settings | 256MB (never applied as PRAGMA — **now fixed**) |
| Per-chunk transform layers | 2–5 `pipeThrough()` calls |
| Chunk transform GC pressure | Moderate (structuredClone removed, TextDecoder lifted) |
| Upstream HTTP | undici 3‑tier dispatcher (well‑pooled) |
| Sync DB writes post-streaming | #1 bottleneck: saveRequestUsage + saveCallLog block event loop |

## Ranked findings (effort × impact)

### Implemented in this PR

| # | Finding | Impact | Effort | Fix |
|---|---------|--------|--------|-----|
| 1 | **Proxy fallback loaded eagerly at startup** | **210ms** on first import | Low | Dynamic `import()` in proxyFetch.ts error handler |
| 2 | **egressCache memory leak** (never evicts) | HIGH — unbounded growth | Very Low | Lazy TTL cleanup on `getCachedEgressIp` |
| 3 | **Missing composite index: usage_history(provider, model, timestamp)** | HIGH — full scan on `getModelLatencyStats` | Very Low | `CREATE INDEX IF NOT EXISTS …` in schemaColumns.ts |
| 4 | **Missing composite index: provider_connections(provider, auth_type)** | HIGH — full scan on 6+ queries | Very Low | `CREATE INDEX IF NOT EXISTS …` in schemaColumns.ts |
| 5 | **mmap_size PRAGMA never applied** | HIGH — 256MB setting stored but unused | Very Low | PRAGMA applied after `applyStoredDatabaseOptimizationSettings` |

### Already in PR #7893 (pre-Phase 1)

| # | Finding | Impact | Effort |
|---|---------|--------|--------|
| 6 | **Startup serialization** | 500+ms serial blocking (early imports + background services) | Low → wrapped in Promise.all / Promise.allSettled |
| 7 | **Per-chunk structuredClone in createSSEStream** | GC pressure on every chunk | Low → replaced with minimal object spread |
| 8 | **Per-chunk `new TextDecoder()` in progressTracker** | Minor GC churn | Very Low → module-level const |
| 9 | **P2C quota re-evaluated per comparison (exponential blowup)** | N² work on each pool filter | Medium → Map cache threaded through pipeline |
| 10 | **Dual `.filter()` passes in selectPoolSubset** | Double iteration on active set | Very Low → single `for` loop |
| 11 | **Debug-loop re-filters 6 function calls** | No-op in production | Very Low → Map-based string comparisons |
| 12 | **Backoff decay loop uses full CRUD update** | SELECT+encrypt+invalidate per unused connection | Low → targeted `resetConnectionBackoff` |
| 13 | **Lazy PROVIDERS/PROVIDER_MODELS** | Startup saving per lazy Proxy 0.2ms | Low → Proxy on constants.ts + providerModels.ts |
| 14 | **TextEncoder lift (claude-web.ts)** | Eliminates per-chunk instances | Low → module-level encoder |
| 15 | **13 route files `getSettings()` → `getCachedSettings()`** | Avoids redundant decrypts | Low → import swap |
| 16 | **settingsCache.ts dead file deletion** | Cleanup | Very Low → removed |

### Future opportunities (not yet implemented)

| # | Finding | Impact | Effort | Priority |
|---|---------|--------|--------|----------|
| 17 | **`saveRequestUsage` dedup guard uses COALESCE on indexed columns** | FULL TABLE SCAN on every request completion | Medium | **NEXT** |
| 18 | **24 module-level `setInterval` timers (many NOT `unref()`-ed)** | Prevent process exit + 2μs/call overhead | Low | Soon |
| 19 | **`providerFallback.ts` (2nd path via proxyAutoSelector→transport→validation)** | 210ms but already lazy (route handlers only) | Low | Bonded |
| 20 | **Sync DB writes block event loop after every stream** | saveRequestUsage + saveCallLog serialize through single-writer lock | High | Candidate for worker_thread |
| 21 | **DB cache_size conservate (16MB)** | For 1.4GB DB, increases page reads | Very Low | PRAGMA change |
| 22 | **Enable Redis for auth cache + quota store** | Offloads SQLite read/write pressure | Low | Config change + doc |
| 23 | **DashboardLayout is `"use client"` with 7+ heavy children** | Entire dashboard forced to client render | High | Structural layout split |
| 24 | **mermaid (84MB unused in src/) in dependencies** | Install bloat, not server-side cost | Very Low | Move to devDeps |
| 25 | **3 duplicated deps in root + open-sse** | Redundant install | Very Low | Deduplicate |
| 26 | **`SELECT *` unbounded in `getUsageHistory` (admin API)** | Risks scan of 250K+ rows | Low | Add LIMIT |
| 27 | **Sync `readFileSync` at module eval in config loading** | Blocks event-loop-startup once | Very Low | Could defer |
| 28 | **SetInterval timers: confirm all `unref()`-ed for remaining** | ~12 without `unref()` prevent clean exit | Low | Audit + fix |

## Status summary

| Category | Status |
|----------|--------|
| PR #7893 (original 16 optimizations) | **OPEN** — all core changes verified |
| Phase 1 tangible wins (5 items) | **Implemented** — uncommitted |
| Phase 2 EventLoopHealth | **Completed** — hot path is clean, timers need `unref()` |
| Phase 2 RequestTrace | **Not completed** (agent lost on session boundary) |
| Phase 2 TransitiveDeps | **Not completed** (agent lost on session boundary) |
| Phase 3 Report | **This document** |

## Recommended next actions

1. **Commit Phase 1 wins** (egressCache, mmap_size, indexes, proxyFallback lazy) → push to PR #7893
2. **Complete #17** — fix `COALESCE` defeating index in `saveRequestUsage` dedup guard
3. **Complete #18** — add `unref()` to all 24 module-level `setInterval` timers
4. **Complete #21** — bump `cache_size` PRAGMA to 64-128MB
5. **Document Redis configuration** for auth cache + quota store offload
