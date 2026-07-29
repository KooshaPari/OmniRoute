# Phenodocs Journeys

This document describes the user-facing journeys that are core to the OmniRoute
fork identity. Each journey is a sequence of API calls, UI interactions, and
state transitions that a developer or end-user completes when working with the
service.

## Journey 1: Bring up the service

1. `pnpm install`
2. `pnpm run dev` (Next.js dev server)
3. `pnpm run open-sse` (worker process)
4. `cargo check --workspace` (validate Rust crates)
5. `GET /api/health/ping` → 200 OK
6. `GET /api/identity` → fork-identity JSON

**What you see:** Dashboard at `http://localhost:3000`, Open SSE running,
fork-identity banner confirming the active fork.

## Journey 2: Authenticate an API key

1. `POST /api/keys` with provider + scope → returns plaintext key
2. `GET /api/keys/:id` → returns metadata (never returns plaintext again)
3. Server caches auth in `KeyvQuotaStore` / `KeyvRateLimitStore` (keyv-backed)
4. Every subsequent request → quota consume, rate-limit check

**Backing modules:**
- `src/lib/auth/managementPassword.ts` (Argon2id + bcryptjs legacy)
- `src/lib/db/apiKeyCache.ts` (keyv-backed auth cache)
- `src/shared/utils/rateLimiter.ts` (keyv-backed sliding window)

## Journey 3: Make a model request

1. `POST /api/v1/chat/completions` with auth header
2. Circuit breaker (`opossum`) checks per-provider state
3. Quota consume (`KeyvQuotaStore.consume`) → updates keyv bucket
4. Rate-limit check (`rateLimiter.ts`) → 429 if exceeded
5. Provider request → response streamed back
6. Quota persists; rate-limit window resets

**Backing modules:**
- `src/shared/utils/circuitBreaker.ts` (hand-rolled + opossum primary dispatch)
- `src/lib/quota/keyvQuotaStore.ts` (keyv + SQLite-backed)
- `src/lib/memory/vectorStore.ts` (sqlite-vec for embeddings)

## Journey 4: Memory + retrieval

1. `POST /api/memory/upsert` → `qdrant.ts` (sqlite-vec facade)
2. `POST /api/memory/search` → `retrievalStrategy.ts` (hybrid FTS + vector merge)
3. Token budget enforced
4. Results returned with confidence scores

**Backing modules:**
- `src/lib/memory/qdrant.ts` (sqlite-vec facade, 165 LOC)
- `src/lib/memory/retrievalStrategy.ts` (124 LOC, hybrid merge)
- `src/lib/memory/store.ts` (orchestration)

## Journey 5: Batch processing

1. `POST /api/batch` with array of requests
2. `batchProcessor.ts` orchestrates the batch
3. `retryPolicy.ts` handles backoff + retry
4. TokenBucket (`tokenBucket.ts`) enforces TPM/TPD limits
5. Partial failures → structured response with retry hints

**Backing modules:**
- `open-sse/services/batchProcessor.ts` (orchestrator)
- `open-sse/services/batchProcessor/retryPolicy.ts` (backoff helpers)
- `open-sse/services/tokenBucket.ts` (TPM/TPD enforcement)

## Journey 6: Local in-app login (device-code preferred)

1. Service invokes `tryDeviceCodeForProvider(providerId)`
2. If device-code supported → HTTP-based flow completes
3. If device-code unavailable → Playwright fallback kicks in
4. Session persisted in Open SSE

**Backing modules:**
- `open-sse/lib/deviceCodeProviders.ts` (HTTP device-code flow)
- `open-sse/services/inAppLoginService.ts` (device-code → Playwright cascade)

## Cross-cutting concerns

| Concern | Module |
|---|---|
| Fork identity SSOT | `.fork-identity.json` + `src/lib/identity/forkIdentity.ts` |
| Release provenance | `docs/RELEASE_READINESS.md` + `scripts/sha-info.sh` |
| npm audit ratchet | `.npm-audit-baseline.json` + `audit:prod` / `audit:full` scripts |
| Toolchain | `.oxlintrc.json` (typed lint) + `.oxfmtrc.json` (formatter) |

## How to verify a journey locally

```bash
pnpm run dev             # terminal 1 — Next.js
pnpm run open-sse        # terminal 2 — open-sse workers
cargo check --workspace  # terminal 3 — Rust validation
vitest run               # terminal 4 — unit + E2E tests
```
