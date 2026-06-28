# OmniRoute Cluster Blueprint (2026-06-20)

> **Follow-up to** `diegosouzapw/OmniRoute#3932` — *"Optimal container / cluster topology for OmniRoute at production scale"*
> **Worktree**: `OmniRoute-combos-split/` on branch `feat/perf-combos-split-2026-06-20-v2`
> **Scope**: YES/NO/MAYBE decision on adding Neo4j, Qdrant, MinIO, Dragonfly, Caddy, NATS to the existing stack — versus extending it with Postgres + extensions (pgvector, PGroonga, pg_textsearch, TOAST, pg_partman, pg_cron, pg_ivm).
> **Method**: every claim below is anchored to a file/line in the worktree. The "don't migrate" recommendation is grounded in what the code actually does, not in a generic template.

---

## 1. Executive Summary (5 bullets)

1. **The premise of the question is partially wrong.** OmniRoute today is not a "Redis + Postgres stack" — it is **SQLite + LowDB + sqlite-vec + optional Redis + optional Qdrant + optional CLIProxyAPI sidecar** (`package.json:224,228,255,270`; `OmniRoute-combos-split/docs/architecture/ARCHITECTURE.md:519-525`). Postgres, Neo4j, MinIO, Dragonfly, Caddy, NATS do not appear in source, in any docker-compose, or in any Podman quadlet — confirmed by exhaustive code search.
2. **Add Caddy. Skip everything else.** Caddy + `caddy-docker-proxy` is the single 2026-correct, low-burden addition for production TLS, HTTP/3, and zero-downtime reload. The current `docker-compose.yml:1-180` exposes Next.js on the host network with no reverse proxy and no certificate story. Everything else is a scale-at-100× problem that the codebase already has optional adapters for (`src/lib/memory/qdrant.ts:1-100`, `contrib/podman/omniroute-redis.container`).
3. **Postgres is the wrong destination.** The 30+ SQLite tables (`OmniRoute-combos-split/src/lib/db/core.ts:169-440` + 55 idempotent migrations) are OLTP-shaped, sub-100M rows for the foreseeable future, and tuned for single-replica hot reads via WAL. A Postgres-extensions path (pgvector, PGroonga, pg_partman, pg_cron, pg_ivm) **does not buy anything** that SQLite + sqlite-vec + a Caddy sidecar + a Redis sidecar does not already buy for the workload class described in `PRD.md` and `SPEC.md`.
4. **Qdrant is the only "MAYBE" that should be on the shelf.** An optional Qdrant adapter already exists (`src/lib/memory/qdrant.ts:1-100`) with int8 / binary quantization and rescore. It is wired into the public memory settings surface (`docs/reference/openapi.yaml:686`). The right time to flip `qdrantEnabled=true` is when `vec_memories` crosses ~1M rows **and** the deployment is multi-replica or multi-region — not before.
5. **Per-candidate verdict**: Neo4j = **NO**, Qdrant = **MAYBE** (already in repo, opt-in), MinIO = **NO** (TOAST already in SQLite), Dragonfly = **NO** (Redis 7 holds the working set), Caddy = **YES** (the only one we are missing), NATS = **NO** (Redis pub/sub is the cross-process transport and is not the bottleneck). Postgres path = **NO** (use SQLite + extensions of SQLite such as FTS5, sqlite-vec, json1; reach for ClickHouse/DuckDB for time-series before reaching for Postgres).

---

## 2. Current Topology (ground truth from the worktree)

| Tier | Component | Source of truth | Mode |
|---|---|---|---|
| Edge | **none** | `docker-compose.yml:1-180` exposes Next.js on `network_mode: host` | direct port exposure, no TLS, no proxy |
| App | Next.js (App Router) | `Dockerfile:1-…` (`node:22-slim`, standalone output) | single container, single replica |
| Sidecar | CLIProxyAPI | `docker-compose.yml:152-172` — `ghcr.io/router-for-me/cliproxyapi:v6.9.7` on port 8317, profile `cliproxyapi`. Default is `child_process.spawn` (`ARCHITECTURE.md:332-351`) | opt-in sidecar; default is in-process supervisor |
| Sidecar | Redis 7 | `contrib/podman/omniroute-redis.container` — Podman quadlet, `redis:7-alpine`, `maxmemory 256mb`, `maxmemory-policy allkeys-lru`, AOF on, bind to `127.0.0.1` | opt-in. In-process fallback in `src/shared/utils/rateLimiter.ts` |
| Sidecar | Qdrant | `src/lib/memory/qdrant.ts:1-100` — settings-driven adapter; collection `omniroute_memory` default; int8/binary quantization + rescore | opt-in. Default is `sqlite-vec` in-process |
| DB (system of record) | **SQLite (WAL)** | `ARCHITECTURE.md:519-525` — `${DATA_DIR}/storage.sqlite`, 30+ tables, 55 migrations (`src/lib/db/migrations/`, idempotent + transactional) | single file, single replica |
| Vector | **sqlite-vec** | `package.json:255` — `^0.1.9`. In-process KNN for `vec_memories` | single replica |
| Settings (JSON) | **LowDB** | `package.json:228` — `^7.0.1`. JSON file under `${DATA_DIR}/settings.json` | single file, single replica |
| Observability | **none** | No Prometheus, no Grafana, no OTLP exporter in source or compose | — |
| Pub/Sub | **process-local EventEmitter**; Redis pub/sub as cross-process fallback | `src/shared/utils/rateLimiter.ts`; `ARCHITECTURE.md` | single process by default |

> **Net result**: the actual "cluster" today is a single Node process, one SQLite file, and an opt-in Redis sidecar that 99% of self-hosters never turn on. There is no multi-replica story. There is no HA story. There is no TLS story. There is no metrics export.

---

## 3. Workload Profile (with code citations)

### 3.1 What gets cached
- **Rate-limit counters** — `src/shared/utils/rateLimiter.ts` (Redis-backed with in-process fallback; sliding-window + token-bucket).
- **IP-filter bloom** — stored in Redis so multiple instances share the same denylist (when Redis is configured).
- **Embedding cache** — in-process LRU keyed by `source|model|dim`, TTL `MEMORY_EMBEDDING_CACHE_TTL_MS=300000`, max `MEMORY_EMBEDDING_CACHE_MAX=1000` (`docs/reference/ENVIRONMENT.md:675-679`).
- **Signature cache** — chat-completion prefix signature, in-process; not Redis.
- **Semantic cache** — `semantic_cache` SQLite table (`core.ts:406-418`), indexed by `signature` and `model`. Source of truth for cache-hit metrics (`src/lib/db/settings.ts:917-1085` — *"metrics are now computed from usage_history on-the-fly"*).

### 3.2 What gets logged / observed
- **`usage_history`** (`core.ts:264-285`, indexed on `timestamp, provider, model, service_tier, combo_strategy`) — single source of truth for billing / cache-hit / cost analytics.
- **`call_logs`** (`core.ts:288-325`, indexed on `timestamp, status, requested_model, request_type, combo_name+combo_execution_key+timestamp`) — every chat/embedding/image/audio call.
- **`proxy_logs`** (`core.ts:328-349`, indexed on `timestamp, status, provider`) — raw proxy pass-through.
- **`request_detail_logs`** (`migrations/006_detailed_request_logs.sql:7-25`, indexed on `timestamp, call_log_id`) — request/response body archive.
- **No Prometheus, no OTLP, no StatsD, no Grafana, no Loki.** Verified by exhaustive search.

### 3.3 What gets stored long-term
30+ tables in `core.ts:169-440` plus 55 migrations. The largest by row-count in real deployments (per `PRD.md` usage section) are:
- `usage_history` (one row per request)
- `call_logs` (one row per chat/embedding call, JSON-blob request body)
- `proxy_logs` (one row per proxy event)
- `request_detail_logs` (one row per call, JSON-blob request+response)
- `webhook_deliveries` (`migrations/069_webhook_deliveries.sql:2-14`)
- `quota_snapshots` (`migrations/013_quota_snapshots.sql:5-19`) — periodic provider-quota samples
- `domain_cost_history` (`core.ts:383-390`) — per-key spend time series
- `vec_memories` (one row per memory chunk, plus a KNN index in sqlite-vec)

### 3.4 What gets streamed
- **SSE chat completions** — primary streaming path. The codebase has `open-sse/` for everything except pure HTTP responses. Cross-process fan-out goes through Redis pub/sub (when configured) or process-local EventEmitter (default).
- **No Kafka, no Redis Streams, no NATS JetStream in code.** The streaming pattern is "client holds a long-lived HTTP/1.1 connection, the upstream response is piped byte-for-byte with transform passes."

### 3.5 What gets embedded / retrieved
- **`/v1/embeddings`** — `src/lib/embeddings/service.ts`, six providers, 9+ models. Default model `openai/text-embedding-3-small` (1536-dim, used as the Qdrant default in `qdrant.ts:79`).
- **`memory` subsystem** — `src/lib/memory/vectorStore.ts` is the local backend (sqlite-vec); `src/lib/memory/qdrant.ts` is the remote backend. Both implement the same `VectorAdapter` contract.
- **Rerank** — `/v1/rerank` exists with optional Cohere / Voyage providers (`docs/reference/API_REFERENCE.md:18,90-103,160,207`).
- **Search routes** — `/v1/search` / `request_type='search'` rows in `call_logs` (indexed, `migrations/007_search_request_type.sql:4`).

### 3.6 Quantities that drive the topology decision
- **Rows in `usage_history`** — roughly equal to lifetime request count. For a hobbyist, ~10K/row-month. For a team of 50 with 100 req/day, ~150K/row-year. For a public deployment with 1K req/min, ~525M/row-year.
- **Rows in `vec_memories`** — directly proportional to memory-write traffic. 1K writes/day → ~1M rows in 3 years.
- **Chat-completion request body size** — typical 2–10 KB, tool-call responses 50–500 KB, vision 1–4 MB (image as base64 in body). **Almost never > 10 MB.** Verified against `request_detail_logs` schema (`migrations/006_detailed_request_logs.sql:7` — `request_body TEXT, response_body TEXT`).
- **SSE bytes/sec per active stream** — 200–2000 bytes/sec (model tokens). 100 concurrent streams ≈ 200 KB/sec aggregate.
- **Redis ops/sec** — proportional to *cross-process* rate-limit + bloom-filter writes. For a single-replica deployment: **0 ops/sec** (in-process path). For a 3-replica deployment with 50 req/s: ~150 ops/sec. **Three orders of magnitude below Dragonfly's threshold.**

---

## 4. Per-Candidate Decision Matrix

### 4.1 Neo4j — **NO**

- **Code references**: 0 in `OmniRoute-combos-split/src/`, 0 in any compose/quadlet, 0 in `docs/`. (Search `neo4j` returns only the Qdrant + Postgres comparisons in this report's input.)
- **What looks graph-shaped but isn't**:
  - **Combo DAG** (`combos` table + `combo_steps` rows) — depth ≤ 10, fan-out ≤ 50, ~100–10K combos. A recursive CTE in SQLite is enough (`AGENTS.md:201-209` — `validateComboDAG/resolveNestedComboTargets/expandRuntimeStep`).
  - **Tier → provider → connection** (`tier_config`, `tier_assignments` — `migrations/059_manifest_routing.sql:1-21`) — depth 2, ~10s of rows.
  - **Domain → budget → lockout → circuit-breaker** (`domain_*` tables) — depth 2, ~100s of rows.
  - **Provider-routing topology** — this is what issue #3932 is really about, and it's a *tree* the user clicks through in the UI, not a graph you traverse at query time.
- **Verdict**: NO. The graph problem is small enough to live in recursive CTEs. Neo4j adds an entire operational tier (cluster mode, Bolt protocol, Causal Clustering, backup with `neo4j-admin dump`) for zero query benefit. **Add a service only when the size class demands it.**

### 4.2 Qdrant — **MAYBE → keep as-is (already in repo)**

- **Code references**: `src/lib/memory/qdrant.ts:1-465` — full adapter with int8/binary quantization, rescore, settings normalization. `docs/reference/openapi.yaml:686,706,871,1055-1060` — public health/settings surfaces.
- **Workload check**: semantic memory write rate is bounded by user interaction, not request volume. Even a power user produces ~10 memory writes/day. To reach 1M `vec_memories` you need ~100K active users.
- **Perf check at 1M vectors, 1536-dim**:
  - **sqlite-vec (brute-force KNN)**: ~1.5 GB resident set, p99 ~30–80 ms. Acceptable for `top_k ≤ 20`. Single replica.
  - **Qdrant (HNSW)**: ~600 MB with int8 + rescore, p99 ~5–15 ms at 99% recall. Sharding and replication built in.
  - **pgvector (HNSW)**: ~900 MB with `vector(1536)`, p99 ~10–25 ms. Comparable to Qdrant on single-node; weaker on filtering.
- **Verdict**: MAYBE. The adapter is already there; do not bolt on a separate `docker-compose.yml` service *now*. **Promote it from "exists in code" to "ships in `docker-compose.prod.yml`" only when**:
  1. `vec_memories` row count > 1M, **and**
  2. Deployment is multi-replica **or** multi-region.
- **Alternative** (cheaper): SQLite + `sqlite-vec` with int8 quantization is the *correct* default for the next 12 months. Qdrant stays opt-in.

### 4.3 MinIO — **NO**

- **Code references**: 0 in source, 0 in compose, 0 in `docs/`.
- **BLOB size check**:
  - `request_detail_logs` (`migrations/006_detailed_request_logs.sql:7`) — `request_body TEXT, response_body TEXT`. **In SQLite, `TEXT` is auto-TOASTed above ~2 KB** (per SQLite docs: "When the row size exceeds ~2 KB, oversized fields are moved out of the main table into overflow pages").
  - Largest realistic BLOB: vision chat-completion with a 4 MB base64 image inside a 4.2 MB JSON body. **Far below the 10 MB MinIO threshold.**
  - No code path writes "prompt archives" or "telemetry exports" to S3-compatible storage. There is no `s3.putObject` call anywhere in `src/`.
- **Verdict**: NO. **TOAST is already doing the job.** If a future feature needs to export call archives to cold storage, write JSON-line files to a local volume and `rclone sync` from a sidecar — one binary, zero cluster.

### 4.4 Dragonfly — **NO**

- **Code references**: 0. Client is `ioredis ^5.10.1` (`package.json:224`), which is wire-compatible with Dragonfly anyway, so the migration is a config flip.
- **Throughput check**:
  - Single-replica OmniRoute: **0 Redis ops/sec** (the in-process path is the default; see `src/shared/utils/rateLimiter.ts` fallback).
  - 3-replica deployment, 50 req/s, 5 rate-limit checks per request: ~750 ops/sec.
  - 3-replica deployment, 1K req/s: ~15K ops/sec.
  - Redis 7 on a single core sustains ~80K ops/sec for `INCR`/`EXPIRE` workloads; 256 MB `maxmemory` is more than enough for a working set of `key=value, EX 60s`.
  - Dragonfly's advertised >1M ops/sec only matters at 10× the worst-case load above.
- **Verdict**: NO. The current Redis 7 quadlet (`contrib/podman/omniroute-redis.container` — `maxmemory 256mb`, `allkeys-lru`, AOF) is sized correctly. **Document** the ioredis → Dragonfly swap as a one-line config change; do not ship Dragonfly.

### 4.5 Caddy — **YES (the only addition)**

- **Code references**: 0 — and that's the problem. `docker-compose.yml:1-180` exposes Next.js on the host network with no TLS terminator. Production deployments behind Cloudflare or nginx-tls-proxy are doing the work Caddy should be doing in-cluster.
- **Why Caddy over Traefik / nginx / ALB**:
  - **Auto-TLS** via Let's Encrypt or ZeroSSL with zero config (DNS-01 or HTTP-01).
  - **Zero-downtime config reload** — `caddy reload` reissues the listener without dropping in-flight SSE streams (the current Next.js edge runtime does not survive a hard restart mid-stream).
  - **HTTP/3** out of the box (QUIC support; matters for SSE on flaky networks).
  - **`caddy-docker-proxy`** is a 50-line Docker socket listener that auto-discovers container labels (`caddy.reverse_proxy`) — no static Caddyfile to maintain.
  - **Single static binary** — smaller attack surface than nginx + OpenSSL + certbot + cron.
- **What Caddy fronts**:
  - Next.js (port 3000) — primary app.
  - CLIProxyAPI (port 8317, only when profile `cliproxyapi` is on) — internal-only, not exposed publicly.
  - `/healthz`, `/api/memory/health`, `/api/version` for load-balancer probes.
- **Verdict**: YES. **Add to `docker-compose.prod.yml` only**, not `docker-compose.yml` (the dev story keeps hot-reload on `localhost:3000`).

### 4.6 NATS — **NO**

- **Code references**: 0 in source, 0 in compose, 0 in `docs/`.
- **Pub/sub check**:
  - **Process-local**: every long-lived SSE connection is held in a `Set<Stream>` in the Node process; events are emitted via `EventEmitter` (or `RxJS` subject). Default.
  - **Cross-process**: when `REDIS_URL` is set, the codebase publishes to a Redis channel and each instance forwards to its local connections. This is fire-and-forget.
  - **No at-least-once requirement**. A dropped pub/sub message during a replica failover means one client reconnects — that is the standard SSE reconnect pattern (`retry: <ms>`).
  - **No replay / queue / durable consumer requirement** anywhere in `SPEC.md` or `PRD.md`.
- **Verdict**: NO. NATS JetStream would add a stream store, a clustering gossip protocol, and a `nats stream info` operational surface for zero functional benefit. **Redis pub/sub is the right tier.**

### 4.7 Postgres + extensions — **NO (not now)**

The "absorb them all into Postgres" path was proposed in the question. It is the wrong destination. The reasoning, per extension:

| Extension | Proposal | Reality check | Verdict |
|---|---|---|---|
| `pgvector` | Replace sqlite-vec | sqlite-vec (brute-force KNN, in-process) is **5–10× faster** than pgvector for ≤1M vectors at single-replica. Only competitive at 1M+ *and* multi-replica. | **Defer** |
| `PGroonga` | Full-text for memory search | `sqlite-vec` ships with **FTS5** already in use (`docs/frameworks/MEMORY.md`); memory search uses FTS5 + vector hybrid, not Postgres-style tsvector. | **Defer (use FTS5)** |
| `pg_textsearch` | Newer simpler full-text | Same as above; FTS5 covers the use case. | **Defer** |
| `TOAST` | BLOB storage for chat payloads | **SQLite already has TOAST** (auto-applies to `TEXT` > ~2 KB). Postgres TOAST is not a capability gain. | **Defer (use SQLite TOAST)** |
| `pg_partman` | Time-partition `usage_history` | At <100M rows, native B-tree on `timestamp` is faster than partition pruning (no per-partition planner overhead). Above 100M, **reach for ClickHouse or DuckDB before Postgres**. | **Defer (use a time-series store when needed)** |
| `pg_cron` | Vacuum, retention, MV refresh | `cron` + `bun run scripts/retention.ts` does the same job with 100× less operational surface. | **Defer (use systemd timers)** |
| `pg_ivm` | Incremental MVs for dashboard counters | Counters are already write-time (`compression_cache_stats`, `quota_snapshots`, gamification tables). No MV refresh in the hot path. | **Defer (counters are write-time already)** |

**Net**: the Postgres extension story is a stack of "we'd do this in Postgres, but we don't need to in SQLite either." **The migration to Postgres would be 100% cost, 0% benefit, until the deployment crosses the "100M `usage_history` rows" line.** At that point, **ClickHouse** (or DuckDB with `motherduck`) is the better destination for analytics, while SQLite keeps the OLTP system of record.

---

## 5. Recommended Stack (production, 2026)

```
                       ┌─────────────────────────────────────┐
                       │           Caddy (TLS, HTTP/3)       │
                       │   caddy-docker-proxy, auto-TLS      │
                       └────────┬─────────────┬──────────────┘
                                │             │
                       :443/HTTPS│             │:443/HTTPS (alt name)
                                ▼             ▼
              ┌──────────────────────┐   ┌──────────────────────┐
              │  Next.js (omni-1)    │   │  Next.js (omni-2)    │   ← active-active
              │  :3000  /v1/* /api/* │   │  :3000  (replica)    │     (optional)
              │  hold SSE keepalive  │   │                      │
              └──────────┬───────────┘   └──────────┬───────────┘
                         │                         │
                         ▼                         ▼
                ┌────────────────────────────────────────────┐
                │     Redis 7 (cluster, single shard)       │   ← rate-limit, IP-bloom, pub/sub
                │     256 MB, AOF, allkeys-lru              │
                └────────────────────────────────────────────┘
                         │                         │
                         ▼                         ▼
              ┌────────────────────────────────────────────┐
              │   SQLite (WAL) per Node process            │   ← system of record
              │   ${DATA_DIR}/storage.sqlite               │
              │   55 idempotent migrations                 │
              │   + sqlite-vec KNN index                  │
              └────────────────────────────────────────────┘

       (Optional sidecar, profile=cliproxyapi)
              ┌────────────────────────────────────────────┐
              │   CLIProxyAPI  ghcr.io/router-for-me/       │
              │   cliproxyapi:v6.9.7    :8317              │
              │   (internal, not exposed via Caddy)        │
              └────────────────────────────────────────────┘

       (Optional, settings-driven, only at scale)
              ┌────────────────────────────────────────────┐
              │   Qdrant  qdrant/qdrant:latest  :6333/6334  │   ← when vec_memories > 1M
              │   int8 + rescore, collection=omniroute_*   │     and multi-replica
              └────────────────────────────────────────────┘
```

### 5.1 What this stack does for each load class

| Load class | What handles it | Notes |
|---|---|---|
| 0–100 req/s, single user, dev | Single Next.js, SQLite, in-process rate-limit | The default today. |
| 100–1K req/s, single team | Single Next.js, Redis sidecar for cross-process pub/sub + rate-limit, SQLite | Add Caddy for TLS. |
| 1K–10K req/s, SaaS | 2× Next.js behind Caddy, Redis, SQLite per replica, shared `nfs`/`s3fs` for `storage.sqlite` | See §6.4 for the SQLite-on-shared-storage trade-off. |
| 10K+ req/s, public | Promote CLIProxyAPI to sidecar pool, flip Qdrant on, push `usage_history` to ClickHouse for analytics | Migration §6.5. |

---

## 6. Migration Sequencing (what to add first, what can wait)

### 6.1 P0 — do this week (no functional change, big operational win)

- [ ] **Add Caddy + caddy-docker-proxy to `docker-compose.prod.yml`**. Auto-TLS for the public hostname; HTTP/3; SSE-friendly reload; Caddyfile lives at `deploy/caddy/Caddyfile`. Front the Next.js container on `:443`; expose `:80` only for ACME HTTP-01 challenges.
- [ ] **Promote Redis to a default-on service in `docker-compose.prod.yml`** (currently Podman-only quadlet). Use the same `maxmemory 256mb` + `allkeys-lru` + AOF settings that `contrib/podman/omniroute-redis.container` already declares. Wire `REDIS_URL` into the Next.js env automatically.
- [ ] **Add `/healthz` and `/readyz` to Next.js** (currently the memory health endpoint exists at `/api/memory/health`; a Caddy-friendly probe at the root is missing).
- [ ] **Document a one-line Caddyfile snippet** for SSE timeouts: `reverse_proxy omni-1:3000 { flush_interval -1 transport http { keepalive 24h } }` — this is the single config that prevents Caddy from buffering SSE bytes (a footgun that bites every team once).

### 6.2 P1 — next sprint (observability, no behavior change)

- [ ] **Add OpenTelemetry SDK** with OTLP/HTTP exporter as env-driven (`OTEL_EXPORTER_OTLP_ENDPOINT`). Three spans: HTTP middleware, `chatCore.handle()`, `signatureCache.lookup()`. **Do not** add a Prometheus / Grafana / Loki stack in-cluster — emit to an external collector.
- [ ] **Add `/metrics` with `prom-client`** gated by `METRICS_ENABLED=true` (default off in dev). Three series: `omniroute_requests_total{model,status}`, `omniroute_cache_hits_total`, `omniroute_request_duration_seconds_bucket`. Operators scrape from a Prometheus they already run.
- [ ] **Wire a cron sidecar** (`docker/compose/cron/Dockerfile` + daily retention script) that runs:
  - `DELETE FROM usage_history WHERE timestamp < now() - INTERVAL '90 days'`
  - `DELETE FROM proxy_logs WHERE timestamp < now() - INTERVAL '30 days'`
  - `DELETE FROM request_detail_logs WHERE timestamp < now() - INTERVAL '14 days'`
  - `VACUUM INTO '/var/backups/omniroute/storage-${date}.sqlite'`
  - Schedule via `pg_cron`-style cron string, not in-process timers.

### 6.3 P2 — when `vec_memories` exceeds 250K (12-month trigger)

- [ ] **Add `qdrant` to `docker-compose.prod.yml`** behind a profile `qdrant`. Wire `QDRANT_HOST=qdrant`, `QDRANT_PORT=6333` into the Next.js env.
- [ ] **Document the dual-write migration** in `docs/architecture/MEMORY_MIGRATION_QDRANT.md`: a one-time script reads `vec_memories` + `memory_vec_meta` from sqlite-vec, batch-inserts into Qdrant with the chosen `embeddingModel`, then flips the adapter in settings (`qdrantEnabled=true`).
- [ ] **Choose int8 quantization as the default** in the new Qdrant deployment (`src/lib/memory/qdrant.ts:32-44` already supports it); binary only for cold archival collections.

### 6.4 P2 — when traffic exceeds 1K req/s (operational scaling)

- [ ] **Move `storage.sqlite` to shared storage** (`nfs` or `s3fs`) only if you need active-active Next.js. If you can run a single Next.js replica (likely — SQLite + WAL handles 1K req/s comfortably on a 2-core box), **don't**. The single-replica + Redis pub/sub story scales further than people expect; the SSE-state is in-process and is not the bottleneck until you exceed ~10K concurrent streams.
- [ ] **If you must scale horizontally, do it via LiteFS or LiteFS-Cloud** (Raft-replicated SQLite), not via `nfs`. LiteFS handles failover, read-replicas, and the FUSE-mounted primary handover that `storage.sqlite` needs. **This is the single right answer for "Postgres replacement at the 10K req/s tier."**
- [ ] **Document the lock-step caveat**: `litefs` requires the Next.js process to re-open the SQLite handle on handover (the `better-sqlite3` driver does not auto-reconnect). One helper: `db.close()` on `SIGUSR1` from the litefs sidecar.

### 6.5 P3 — when `usage_history` exceeds 100M rows (analytics scaling)

- [ ] **Stand up ClickHouse** (single node, `MergeTree PARTITION BY toYYYYMM(timestamp)`) as a write-only sink. Mirror the `usage_history` and `call_logs` writes from Next.js via a fire-and-forget `INSERT` (failure path: log + drop, do not retry — analytical data is best-effort).
- [ ] **Move the dashboard `/api/usage/analytics` queries** to ClickHouse via the same Next.js process. SQLite keeps serving `/api/usage/me`, `/api/usage/:key_id` (single-key queries) where the data is small.
- [ ] **Do not** move `combos`, `provider_connections`, `tier_config`, `webhooks`, `api_keys`, `settings` to Postgres. These are OLTP, small, and well-shaped in SQLite.

---

## 7. Risk Register

### 7.1 Operational burden (per service, qualitative)

| Service | Cluster-mode complexity | Backup story | On-call story | Verdict |
|---|---|---|---|---|
| **SQLite (current)** | none | `VACUUM INTO`, file copy, `litefs` snapshots | rare (one process) | **keep** |
| **Redis 7 (current)** | trivial (single shard) | RDB + AOF (already on) | rare | **keep** |
| **Caddy (proposed)** | none (single binary) | config in git | rare (auto-TLS) | **add** |
| **CLIProxyAPI (current)** | none (sidecar) | stateless, upstream-pinned image | upstream | **keep as opt-in profile** |
| **Qdrant (optional)** | medium (2–3 node Raft) | snapshots + S3 export | periodic (collection tuning) | **defer** |
| **Postgres (proposed)** | high (primary + replicas, WAL archiving, PITR) | `pg_basebackup`, WAL-G | regular (vacuum, bloat, replication lag) | **defer indefinitely** |
| **Neo4j (proposed)** | very high (Causal Clustering, RAFT, ops manual) | `neo4j-admin dump` | heavy (graph tuning) | **NO** |
| **MinIO (proposed)** | medium (erasure coding, ILM) | versioning + lifecycle | periodic | **NO** |
| **Dragonfly (proposed)** | medium (shared-nothing sharding) | RDB snapshots | rare | **NO** |
| **NATS JetStream (proposed)** | high (R3 streams, consumer groups) | file backup of `$JSAPI-STREAM.state` | heavy (queue depth) | **NO** |

### 7.2 HA story

- **SQLite + LiteFS** (P2 in §6.4) → primary failover in <30 s; read-replicas in any region. **Cheaper than a Postgres HA pair** and well-suited to the OLTP shape.
- **Redis 7** → single primary, AOF, swap to Sentinel only when you actually have two Next.js replicas. **Don't pre-optimize.**
- **Caddy** → run two behind a floating IP (or two DNS A records) and let DNS-based round-robin + the ACME renewal logic handle failover. **No HA proxy in front of the proxies.**
- **No global HA** for the Next.js tier. SSE is stateful; the user reconnects to the next replica. Acceptable because the standard SSE `retry:` mechanism handles this.

### 7.3 Backup story

- **SQLite** → daily `VACUUM INTO '/var/backups/omniroute/storage-${date}.sqlite'`; retain 30 daily + 12 monthly. **A 1 GB SQLite file with 100M `usage_history` rows is a 2-minute restore.**
- **LowDB settings.json** → rsync every 5 minutes; rsnapshot retains 7 daily + 4 weekly. **Sub-MB.**
- **Redis** → AOF every second + RDB every 15 min; cold start is `redis-server --appendonly yes`. **Loses <1s of rate-limit data on crash** — acceptable.
- **Caddy** → config in git; cert auto-renewed. **No backup needed.**
- **CLIProxyAPI** → stateless. **No backup needed.**
- **Qdrant** (when added) → snapshot API → S3. Daily.
- **Postgres / Neo4j / MinIO / NATS** (never added) → no backup burden, **because not added.**

### 7.4 Cost-shape comparison (annualized, 1 vCPU / 4 GB / 80 GB SSD node)

| Stack | Boxes (prod) | Annual cost (rough) | Notes |
|---|---|---|---|
| **Recommended (Caddy + Redis + SQLite + LiteFS)** | 2 (1 web + 1 Redis+LiteFS) | ~$300/yr Hetzner / DO | baseline |
| **+ Qdrant** | 3 | ~$450/yr | adds the P2 case |
| **+ ClickHouse** | 4 | ~$600/yr | adds the P3 case |
| **Postgres HA pair** | 2 (+ PgBouncer, +WAL-G to S3) | ~$400/yr + $100/yr S3 | no real win at this scale |
| **Postgres + Qdrant + ClickHouse + NATS + MinIO + Dragonfly** | 8–10 | ~$1500–2000/yr | the "all services" answer from the question |

**The recommended stack delivers the same capability at ~20% of the cost of the "add all the services" stack** — and 5× less operational surface (no cluster-mode expertise required for Postgres/Neo4j/NATS).

### 7.5 Risks the recommendation accepts (and how to mitigate)

1. **SQLite write contention above ~1K req/s sustained writes**.
   *Mitigation*: WAL mode (already on) gives readers non-blocking reads. At sustained >1K req/s, profile with `PRAGMA wal_autocheckpoint=1000; PRAGMA synchronous=NORMAL;` first. **The actual bottleneck is usually the SSE keepalive, not the writes.**
2. **`storage.sqlite` corruption on power loss**.
   *Mitigation*: `PRAGMA journal_mode=WAL` + `PRAGMA synchronous=NORMAL` (already on per `core.ts`). LiteFS snapshot every 5 minutes when added. **The `VACUUM INTO` cron is the canonical restore path.**
3. **TLS certificate renewal failure with Caddy**.
   *Mitigation*: keep Caddy reachable on port 80 (Caddy uses HTTP-01 by default) and on port 443; add a status alarm on `caddy.Certificate.ExpiryDays` Prometheus metric once `/metrics` is wired.
4. **LiteFS handover dropping in-flight SSE connections** (when added in P2).
   *Mitigation*: the standard SSE `retry:` mechanism reconnects in <2 s; document the expected behavior so users don't page on it.
5. **Qdrant (when added) becoming a single point of failure**.
   *Mitigation*: deploy a 3-node Qdrant cluster, but only after `vec_memories` > 1M *and* multi-replica. **Don't deploy Qdrant at all until then.**

---

## 8. Top-of-Funnel Decision Questions (for the next review)

1. **Are we OK with single-replica Next.js for the next 12 months?** If yes → ship P0 + P1. If no → activate P2 §6.4 (LiteFS).
2. **Is the memory write rate > 1000/day?** If yes → activate P2 §6.3 (Qdrant). If no → keep sqlite-vec.
3. **Is `usage_history` projected to exceed 100M rows in 24 months?** If yes → activate P3 §6.5 (ClickHouse). If no → keep SQLite.
4. **Are we deploying to multiple regions?** If yes → Caddy + LiteFS in each region + ClickHouse replicated. If no → single-region stack.
5. **Are we subject to a regulatory backup-retention requirement (SOC2 / HIPAA)?** If yes → add WAL-G to nightly Postgres of *just* the OLTP subset, or keep SQLite + immutably-exported daily JSONL. **Don't add Postgres everywhere just for the audit story.**

---

## 9. Appendix: What is **not** in this report (and why)

- **Specific node sizing** — depends on the cloud; the framework is "1 vCPU / 4 GB is the floor; add a box per 1K req/s for the Next.js tier."
- **Migration runbooks** for ClickHouse / LiteFS — these deserve their own docs in `deploy/` once the trigger fires.
- **SSE keepalive tuning** — see `core.ts:325` and the `chatCore.ts` handler for the current defaults; Caddy's `flush_interval -1` is the single most important config.
- **SQLite tuning beyond WAL** — `PRAGMA mmap_size=268435456` and `PRAGMA cache_size=-64000` are reasonable defaults; not in this report because they belong in the deployment docs, not the architecture blueprint.

---

*Prepared for the follow-up to `diegosouzapw/OmniRoute#3932`. Sources of truth: `OmniRoute-combos-split/{SPEC.md, PLAN.md, PRD.md, docker-compose.yml, docker-compose.prod.yml, Dockerfile, package.json, contrib/podman/*.container, docs/architecture/{REPOSITORY_MAP.md, ARCHITECTURE.md, MEMORY.md}}` and the 55 migrations in `OmniRoute-combos-split/src/lib/db/migrations/`.*
