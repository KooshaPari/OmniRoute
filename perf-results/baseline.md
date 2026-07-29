# Latency Baseline — OmniRoute

**Target:** `http://127.0.0.1:3000/`  
**Generated:** 2026-07-29T11:28:44.923Z  
**Tool:** `scripts/perf/baseline-probe.mjs`  
**Routes:** 70  
**Warm phase:** 5 iterations × 70 routes = 350 sequential probes  
**Concurrency:** 10 rounds × 70 parallel probes = 700 parallel probes

## Cold-cache (1 sequential probe per route)

| Status | Method | Path | Duration (ms) |
|---|---|---|---|
| ERR | GET | `/api/v1/models` | 5.20 |
| ERR | GET | `/api/v1/keys` | 1.15 |
| ERR | POST | `/api/v1/chat/completions` | 0.44 |
| ERR | POST | `/api/v1/embeddings` | 0.31 |
| ERR | POST | `/api/v1/images/generations` | 0.30 |
| ERR | GET | `/api/v1/audio/speech` | 0.25 |
| ERR | POST | `/api/v1/moderations` | 0.22 |
| ERR | GET | `/api/v1/files` | 0.28 |
| ERR | GET | `/api/health` | 0.30 |
| ERR | GET | `/api/health/ping` | 0.44 |
| ERR | GET | `/api/health/deep` | 0.26 |
| ERR | GET | `/api/identity` | 0.20 |
| ERR | GET | `/api/system/version` | 0.21 |
| ERR | GET | `/api/system/env` | 0.19 |
| ERR | GET | `/api/system/info` | 0.80 |
| ERR | GET | `/api/system/status` | 0.21 |
| ERR | GET | `/api/keys` | 0.14 |
| ERR | POST | `/api/keys` | 0.13 |
| ERR | GET | `/api/keys/foo` | 0.12 |
| ERR | GET | `/api/quota` | 0.11 |
| ERR | GET | `/api/quota/pools` | 0.11 |
| ERR | GET | `/api/quota/plans` | 0.11 |
| ERR | GET | `/api/quota/usage` | 0.13 |
| ERR | POST | `/api/memory/upsert` | 0.12 |
| ERR | POST | `/api/memory/search` | 0.12 |
| ERR | GET | `/api/memory/list` | 0.12 |
| ERR | DELETE | `/api/memory/foo` | 0.12 |
| ERR | POST | `/api/memory/batch` | 0.19 |
| ERR | GET | `/api/agents` | 0.16 |
| ERR | POST | `/api/agents` | 0.14 |
| ERR | GET | `/api/agents/foo` | 0.13 |
| ERR | PATCH | `/api/agents/foo` | 0.16 |
| ERR | DELETE | `/api/agents/foo` | 0.13 |
| ERR | POST | `/api/agents/foo/run` | 0.13 |
| ERR | GET | `/api/skills` | 0.13 |
| ERR | GET | `/api/skills/foo` | 0.12 |
| ERR | POST | `/api/skills/foo/invoke` | 0.13 |
| ERR | DELETE | `/api/skills/foo` | 0.12 |
| ERR | GET | `/api/settings` | 0.11 |
| ERR | PATCH | `/api/settings` | 0.11 |
| ERR | GET | `/api/settings/qdrant` | 0.11 |
| ERR | GET | `/api/settings/safety` | 0.12 |
| ERR | POST | `/api/settings/test` | 0.13 |
| ERR | GET | `/api/billing/usage` | 0.12 |
| ERR | GET | `/api/billing/plans` | 0.11 |
| ERR | GET | `/api/billing/invoices` | 0.11 |
| ERR | GET | `/api/tasks` | 0.11 |
| ERR | POST | `/api/tasks` | 0.11 |
| ERR | GET | `/api/tasks/foo` | 0.11 |
| ERR | DELETE | `/api/tasks/foo` | 0.11 |
| ERR | GET | `/api/observations` | 0.13 |
| ERR | POST | `/api/observations` | 0.12 |
| ERR | GET | `/api/observations/foo` | 0.11 |
| ERR | DELETE | `/api/observations/foo` | 0.11 |
| ERR | GET | `/api/effective/settings` | 0.11 |
| ERR | GET | `/api/effective/model` | 0.57 |
| ERR | GET | `/api/version-manager` | 0.15 |
| ERR | POST | `/api/version-manager/check-update` | 0.14 |
| ERR | POST | `/api/version-manager/apply-update` | 0.12 |
| ERR | GET | `/api/secrets` | 0.11 |
| ERR | POST | `/api/secrets` | 0.11 |
| ERR | GET | `/api/secrets/foo` | 0.11 |
| ERR | GET | `/api/rate-limit/config` | 0.11 |
| ERR | POST | `/api/rate-limit/reset` | 0.11 |
| ERR | POST | `/api/cache/invalidate` | 0.11 |
| ERR | GET | `/api/build-info` | 0.10 |
| ERR | GET | `/` | 0.10 |
| ERR | GET | `/dashboard` | 0.12 |
| ERR | GET | `/login` | 0.13 |
| ERR | GET | `/.well-known/agent.json` | 0.12 |

**Cold total:** 17.77 ms

## Warm-cache percentiles (sequential, N=5)

| Route | p50 | p90 | p95 | p99 | max |
|---|---|---|---|---|---|
| `GET /api/settings` | 0.1 | 0.53 | 0.53 | 0.53 | 0.53 |
| `GET /api/health/deep` | 0.11 | 0.52 | 0.52 | 0.52 | 0.52 |
| `GET /api/skills/foo` | 0.1 | 0.49 | 0.49 | 0.49 | 0.49 |
| `DELETE /api/tasks/foo` | 0.13 | 0.29 | 0.29 | 0.29 | 0.29 |
| `GET /api/v1/models` | 0.13 | 0.22 | 0.22 | 0.22 | 0.22 |
| `GET /api/quota` | 0.11 | 0.21 | 0.21 | 0.21 | 0.21 |
| `GET /api/skills` | 0.1 | 0.2 | 0.2 | 0.2 | 0.2 |
| `GET /api/v1/keys` | 0.1 | 0.19 | 0.19 | 0.19 | 0.19 |
| `POST /api/agents` | 0.12 | 0.19 | 0.19 | 0.19 | 0.19 |
| `GET /` | 0.1 | 0.19 | 0.19 | 0.19 | 0.19 |
| `GET /api/observations` | 0.11 | 0.18 | 0.18 | 0.18 | 0.18 |
| `POST /api/skills/foo/invoke` | 0.12 | 0.17 | 0.17 | 0.17 | 0.17 |
| `GET /api/billing/usage` | 0.1 | 0.17 | 0.17 | 0.17 | 0.17 |
| `GET /api/billing/invoices` | 0.1 | 0.17 | 0.17 | 0.17 | 0.17 |
| `POST /api/version-manager/check-update` | 0.1 | 0.17 | 0.17 | 0.17 | 0.17 |
| `GET /dashboard` | 0.1 | 0.17 | 0.17 | 0.17 | 0.17 |
| `GET /api/v1/files` | 0.1 | 0.16 | 0.16 | 0.16 | 0.16 |
| `GET /api/keys/foo` | 0.11 | 0.16 | 0.16 | 0.16 | 0.16 |
| `GET /api/agents` | 0.1 | 0.16 | 0.16 | 0.16 | 0.16 |
| `GET /api/quota/plans` | 0.12 | 0.15 | 0.15 | 0.15 | 0.15 |
| `GET /api/tasks/foo` | 0.11 | 0.15 | 0.15 | 0.15 | 0.15 |
| `POST /api/version-manager/apply-update` | 0.1 | 0.15 | 0.15 | 0.15 | 0.15 |
| `POST /api/v1/chat/completions` | 0.11 | 0.14 | 0.14 | 0.14 | 0.14 |
| `POST /api/v1/embeddings` | 0.1 | 0.14 | 0.14 | 0.14 | 0.14 |
| `POST /api/v1/images/generations` | 0.11 | 0.14 | 0.14 | 0.14 | 0.14 |

## Concurrency (parallel K=10)

| Route | p50 | p90 | p95 | p99 | max |
|---|---|---|---|---|---|
| `GET /api/v1/models` | 5.09 | 8 | 8 | 8 | 8 |
| `GET /api/v1/keys` | 5.05 | 8 | 8 | 8 | 8 |
| `POST /api/v1/chat/completions` | 5.02 | 7.95 | 7.95 | 7.95 | 7.95 |
| `POST /api/v1/embeddings` | 5.01 | 7.93 | 7.93 | 7.93 | 7.93 |
| `POST /api/v1/images/generations` | 4.99 | 7.93 | 7.93 | 7.93 | 7.93 |
| `GET /api/v1/audio/speech` | 4.99 | 7.92 | 7.92 | 7.92 | 7.92 |
| `POST /api/v1/moderations` | 4.98 | 7.9 | 7.9 | 7.9 | 7.9 |
| `GET /api/v1/files` | 4.97 | 7.89 | 7.89 | 7.89 | 7.89 |
| `GET /api/health` | 4.97 | 7.88 | 7.88 | 7.88 | 7.88 |
| `GET /api/health/ping` | 4.94 | 7.87 | 7.87 | 7.87 | 7.87 |
| `GET /api/health/deep` | 4.93 | 7.86 | 7.86 | 7.86 | 7.86 |
| `GET /api/identity` | 4.93 | 7.86 | 7.86 | 7.86 | 7.86 |
| `GET /api/system/version` | 4.92 | 7.85 | 7.85 | 7.85 | 7.85 |
| `GET /api/system/env` | 4.91 | 7.84 | 7.84 | 7.84 | 7.84 |
| `GET /api/system/info` | 4.9 | 7.82 | 7.82 | 7.82 | 7.82 |
| `GET /api/system/status` | 4.89 | 7.8 | 7.8 | 7.8 | 7.8 |
| `GET /api/keys` | 4.89 | 7.79 | 7.79 | 7.79 | 7.79 |
| `GET /api/keys/foo` | 4.91 | 7.79 | 7.79 | 7.79 | 7.79 |
| `GET /api/quota/pools` | 4.9 | 7.79 | 7.79 | 7.79 | 7.79 |
| `POST /api/keys` | 4.91 | 7.78 | 7.78 | 7.78 | 7.78 |
| `GET /api/quota` | 4.91 | 7.77 | 7.77 | 7.77 | 7.77 |
| `GET /api/quota/plans` | 4.9 | 7.74 | 7.74 | 7.74 | 7.74 |
| `GET /api/quota/usage` | 4.89 | 7.67 | 7.67 | 7.67 | 7.67 |
| `POST /api/memory/upsert` | 4.88 | 7.63 | 7.63 | 7.63 | 7.63 |
| `POST /api/memory/search` | 4.88 | 7.61 | 7.61 | 7.61 | 7.61 |

## Aggregate

| Phase | p50 | p90 | p95 | p99 |
|---|---|---|---|---|
| Cold (n=70) | 0.12 | 0.31 | 0.57 | 5.2 |
| Warm p95 (n=70) | 0.13 | 0.2 | 0.29 | 0.53 |
| Concurrency p95 (n=70) | 7.49 | 7.9 | 7.93 | 8 |

## Caveats

- **Local baseline**: this captures dev-server performance, not production.
- **No real v4 comparator**: stage v4 locally with the same harness to get a diff.
- **Caveats per route**: routes returning 401/403 with sub-1ms latency are auth-rejected at the middleware before the handler runs.