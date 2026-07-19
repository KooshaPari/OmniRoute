# OmniRoute Remaining Backlog

> Generated 2026-07-18. `gh` CLI was unavailable at creation time.
> To import these into GitHub later, run `gh issue create` for each item or use a bulk-import tool.

---

## 1. Full Qdrant → sqlite-vec migration

**Priority:** P1
**Labels:** `tech-debt`, `enhancement`

The Qdrant HTTP client in `qdrant.ts` was pruned to 285 LOC but still references the removed sidecar. Rewrite to delegate fully to `sqlite-vec`.

---

## 2. Opossum full migration (step-2)

**Priority:** P2
**Labels:** `tech-debt`

The shadow adapter shipped (PR-P). Enable `CIRCUIT_BREAKER_OPOSSUM_SHADOW=1` in staging, collect 14 days of telemetry, then replace the 611-LOC hand-rolled `CircuitBreaker` class with opossum.

---

## 3. E2E test suite coverage

**Priority:** P2
**Labels:** `testing`

Currently only 21 unit tests. Add Playwright or Vitest E2E scenarios for OAuth flow, API key validation, rate limiting, and quota management.

---

## 4. tsc incremental build optimization

**Priority:** P3
**Labels:** `dx`, `perf`

`tsc` takes 2-3 min on full codebase. Add `--incremental` flag and fix composite projects for 5-10x faster CI feedback.

---

## 5. rateLimitManager.ts further decomposition

**Priority:** P3
**Labels:** `tech-debt`, `refactor`

TokenBucket and watchdog were extracted but the orchestrator is still 1000+ LOC. Consider splitting into per-provider modules.

---

## 6. Playwright → device-code OAuth (full migration)

**Priority:** P3
**Labels:** `enhancement`, `security`

Device-code fallback shipped (PR-R) but the Playwright browser pool code is still the primary path. For providers supporting device-code, remove the Playwright dependency entirely.

---

## 7. Bifrost executor consolidation

**Priority:** P3
**Labels:** `tech-debt`, `refactor`

Fold BifrostBackendExecutor into DefaultExecutor. Bifrost was fork-only L5-110 work that's no longer default.

---

## 8. Test runner consolidation (vitest everywhere)

**Priority:** P3
**Labels:** `dx`, `testing`

Convert remaining `node:test` files to vitest for consistent DX.
