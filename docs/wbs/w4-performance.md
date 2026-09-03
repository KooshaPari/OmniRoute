# W4 — Performance Optimizations

**Wave:** W4 (Performance & Optimization)
**Priority:** P1–P2
**Generated:** 2026-09-02

## W4.1 — Undici Keep-Alive Pooling (P0)

**Why:** Every new HTTP/1.1 connection to a provider costs 1–3 RTTs (20–100ms). With 50+ concurrent requests, this adds up.

**What:** Re-use a persistent `undici.Pool` across all provider calls instead of creating a new agent per request.

**Files:** `src/http/client.ts` (new), `src/providers/anthropic.ts`, `src/providers/openai.ts`, `src/providers/gemini.ts`

**Acceptance:**
- [ ] Pool created once at startup with `keepAliveTimeout: 30_000`
- [ ] `dispatch` called per-request (never `close()` between calls)
- [ ] Graceful drain on SIGTERM
- [ ] Benchmark: median TTFB drops ≥20ms on the anthropic path

**Verify:** `node bench/http-pool.mjs --provider anthropic --requests 200`

---

## W4.2 — LRU Cache for Auth Token Exchange (P1)

**Why:** Token exchange (client_credentials → access token) is a 150–400ms round-trip that happens on every cold-start. Tokens are valid for 60–3600s.

**What:** A 128-entry LRU that holds tokens until 5s before expiry.

**Files:** `src/auth/token-cache.ts`, `src/auth/token-cache.test.ts`

**Acceptance:**
- [ ] Cache hit returns token without a network call
- [ ] Cache miss does exchange and populates cache
- [ ] Token within 5s of expiry is never served
- [ ] Benchmark: 0ms median for cache hit vs 200ms for miss

**Verify:** `node bench/token-cache.mjs --hits 10000`

---

## W4.3 — Streaming JSON Parsing (P1)

**Why:** `JSON.parse` on each SSE data chunk is slow (15–25µs per parse). For a 10-token streaming response with 50 chunks, that's 1ms of parse overhead.

**What:** Stream-parse SSE chunks in a single pass using `@streaming/json` (or manual incremental parse).

**Files:** `src/utils/sse-parse.ts`, `src/utils/sse-parse.bench.ts`

**Acceptance:**
- [ ] Same output as `JSON.parse` for all valid chunks
- [ ] Same error surface for all invalid chunks
- [ ] Benchmark: 30%+ reduction in parse overhead on streaming path

**Verify:** `node bench/sse-parse.mjs`

---

## W4.4 — Dependency Audit & Removal (P2)

**Why:** Large `node_modules` footprint slows CI, increases install time, and expands the SBOM.

**Files:** `package.json`, `pnpm-lock.yaml`

**Acceptance:**
- [ ] No unused dev dependencies (run `pnpm depcheck`)
- [ ] No transitive duplicates (run `pnpm dedupe`)
- [ ] SBOM size reduced ≥15%

**Verify:** `pnpm depcheck && pnpm dedupe && node scripts/sbom-size.mjs`

---

## W4.5 — Cold Start Reduction (P2)

**Why:** Lambda/Vercel cold starts >2s hurt p99 latency on serverless deployments.

**What:**
1. Lazy-import heavy modules (zod, yaml) only when needed
2. Move all env-var parsing to a lazy initializer
3. Pre-warm the auth cache on startup (not on first request)

**Files:** `src/index.ts`, `src/auth/init.ts`, `src/config/env.ts`

**Acceptance:**
- [ ] Cold start <800ms on a 512MB Lambda (tested via `serverless invoke`)
- [ ] Warm start unchanged (no regression)

**Verify:** `serverless invoke --function chat --stage test`
