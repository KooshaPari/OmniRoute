# Release Readiness — OmniRoute v3.8.49-koosha.0

## Build Provenance

- **Source**: `git@github.com:kooshapari/omniroute.git`
- **Fork**: `kooshapari/omniroute` from upstream `omniroute/omniroute` at v3.8.43
- **Identity**: see `.fork-identity.json` (canonical SSOT)
- **API**: `GET /api/identity` → JSON

## Modernization Stack (21+ PRs)

| Layer      | Replacement                                    | Status               |
| ---------- | ---------------------------------------------- | -------------------- |
| Linter     | oxlint                                         | 3s on 3,148 files    |
| Formatter  | oxfmt                                          | drop-in for Prettier |
| LRU cache  | `lru-cache@11`                                 | 9/9 tests            |
| Hashing    | `@node-rs/argon2` (OWASP Argon2id)             | 6/6 tests            |
| Color      | `picocolors`                                   | 200KB → 16KB         |
| Breaker    | `opossum@10` (shadow adapter)                  | telemetry            |
| Crypto     | `crypto.timingSafeEqual`                       | 2 CVE fixes          |
| Quota      | `KeyvQuotaStore` (keyv+SQLite)                 | 6/6 tests            |
| Rate limit | `KeyvRateLimitStore` (keyv)                    | ioredis-free         |
| Vector     | `sqlite-vec` facade                            | 521→165 LOC          |
| Logger     | `oxlint`/`oxfmt`                               | 0 chalk imports      |
| Sidecars   | Redis removed, Qdrant removed, MITM in-process | -29 docker lines     |

## Decompositions

| Module                                            | From                          | LOC | Tests |
| ------------------------------------------------- | ----------------------------- | --- | ----- |
| `open-sse/services/tokenBucket.ts`                | `rateLimitManager.ts:491`     | 95  | 10    |
| `src/lib/db/apiKeyCache.ts`                       | `apiKeys.ts` (1412→1279)      | 145 | 24    |
| `src/lib/memory/retrievalStrategy.ts`             | `retrieval.ts` (1072→998)     | 124 | 26    |
| `open-sse/services/batchProcessor/retryPolicy.ts` | `batchProcessor.ts` (914→851) | 60  | —     |

## Dead Code Removed

- `open-sse/services/workflowFSM.ts` (340 LOC, zero consumers)

## CI Test Matrix

- 90 vitest tests across 11 suites
- `tsc -p tsconfig.typecheck-core.json` clean (2 pre-existing in `regional.ts`)
- `cargo check --workspace` clean (3 warnings)
- `oxlint` 3.0s on 3,148 files

## Backlog (Open GH Issues)

Requires dedicated sessions:

- #341 zero-loss Oxc typed-lint matrix
- #392 v4 compatibility-shell auth/transport gaps
- #394 restore immutable provenance contract
- #395 restore strict TS7 baseline (12,985 errors)
- #397 restore hosted v4 latency baseline evidence
- #400 repair current-main CLI matrix + unblock DAST
- #405 establish fork identity SSOT — **DONE in this commit**
- #407 opossum step-2 full migration — **DONE**
- #408 qdrant.ts → sqlite-vec facade — **DONE**
- #409 TokenBucket extraction — **DONE**
- #410 tsc incremental builds — **DONE**
- #445 CI test-matrix recovery for PR #434
- #446 CI: eliminate deterministic startup failures
- #436 CI/security: remove residual fail-open paths
- #447 dependency security: npm audit / OSV baseline — **DONE** (`audit:prod`, `audit:full` scripts)
- #440 release readiness provenance — **DONE in this file**
- #444 branch archaeology
