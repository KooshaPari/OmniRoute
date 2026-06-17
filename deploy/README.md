# OmniRoute Scaled Deployment

Docker Compose deployment for horizontally-scaled OmniRoute (3 replicas) behind Caddy load balancer with Redis shared state.

## Purpose

Symptom mitigation for diegosouzapw/OmniRoute#4041 (heap OOM). Distributes load across 3 instances, each capped at 8GB heap (NODE_OPTIONS). Long-term fix requires source-streaming or substrate gateway.

## Quick Start

```bash
cd deploy/
docker compose -f docker-compose.scale.yml up -d
curl http://localhost:20128/v1/models
```

## Architecture

- **Caddy LB** on :20128 (least-conn policy, health-gated routing)
- **3 OmniRoute replicas** (:3001-3003) with NODE_OPTIONS=--max-old-space-size=8192
- **Redis** for shared state (required for N > 1)
- Healthcheck: GET /v1/models (10s interval, 30s startup grace)

## Configuration

Edit docker-compose.scale.yml to:
- Adjust heap cap (NODE_OPTIONS)
- Add/remove replicas
- Change scale factor

## Trade-offs

- ✗ No HMR (hot reload) — docker images are static
- ✓ Horizontal scaling
- ✓ Transparent failover
- ✓ ~24GB total memory (3 × 8GB)

## Cleanup

```bash
docker compose -f docker-compose.scale.yml down -v
```

See full docs in #4041 discussion. This is a temporary fix pending source-streaming or substrate gateway.
