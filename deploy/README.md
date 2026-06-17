# OmniRoute Scaled Deployment

## Overview

This directory contains a multi-replica OmniRoute deployment with load balancing, designed to mitigate memory pressure and improve availability.

## Rationale

### WSL2 Host Environment
This deployment stack targets **Docker Desktop on Windows + WSL2** because:
- OmniRoute's Node.js runtime is memory-intensive (~1-2GB per instance)
- Single-instance deployments on resource-constrained hosts (VMs, CI) hit heap limits
- Docker allows process isolation and memory capping per replica
- Caddy provides transparent load balancing without app changes

### Symptom Mitigation, Not Root Fix
This is a **temporary workaround** for diegosouzapw/OmniRoute#4041 (heap OOM). Long-term solutions:
1. **Source-streaming** (streaming responses instead of buffering) — reduces memory footprint per request
2. **Substrate gateway** — isolates routing logic from OmniRoute's monolithic request handling
3. **Worker processes** — off-load heavy tasks to dedicated services

Until those ship, this stack provides:
- ✅ Horizontal scaling (add more replicas as needed)
- ✅ Transparent failover (load balancer health-checks)
- ✅ Memory headroom (8GB cap per instance = 24GB total for 3 replicas)

## Architecture

```
Client requests → Caddy LB (port 20128, least-conn policy)
                    ↓
              (health-gated routing to healthy upstreams)
                    ↓
           OmniRoute replicas (3 instances, :3001-3003)
                    ↓
                 Redis (shared state, cache)
```

**Key components:**
- **Caddy** (loadbalancer): HTTP reverse proxy with health-based routing
- **OmniRoute** (omniroute-1/2/3): App replicas with NODE_OPTIONS heap cap
- **Redis**: Session/cache state shared across replicas (required for N > 1)

## Setup

### Prerequisites
- Docker Desktop installed + WSL2 backend enabled
- `docker compose` command available (v2+)
- ~12GB free disk/memory (3x OmniRoute instances + Redis + Caddy)

### Quick Start

1. **Build and start the stack:**
   ```bash
   cd deploy/
   docker compose -f docker-compose.scale.yml up -d
   ```

2. **Verify load balancer is running:**
   ```bash
   curl http://localhost:20128/v1/models
   ```

3. **Check replica status:**
   ```bash
   docker ps | grep omniroute
   docker logs omniroute-1
   ```

4. **Scale to more replicas (if needed):**
   - Edit `docker-compose.scale.yml` to add `omniroute-4`, `omniroute-5`, etc.
   - Update `loadbalancer` service `depends_on` and Caddyfile upstream list
   - Restart: `docker compose -f docker-compose.scale.yml up -d`

### Configuration

**Environment variables** (in `docker-compose.scale.yml`):
- `NODE_OPTIONS=--max-old-space-size=8192`: Heap cap (adjust per available memory)
- `REDIS_URL=redis://redis:6379`: Required for multi-instance deployments
- `PORT=3000`: Internal port (fixed per replica)
- `NODE_ENV=production`: Production mode

**Health checks:**
- **Caddy**: Probes `GET /v1/models` every 10s
- **Redis**: Probes `redis-cli ping` every 5s
- **OmniRoute**: Probes `curl http://localhost:3000/v1/models` every 10s with 30s startup grace

Unhealthy replicas are immediately drained by Caddy (zero new connections).

## Trade-offs

### Hot Reload (HMR)
- ❌ **NOT supported** in this deployment
- Docker images are static; changes require rebuild
- For development, use local `npm run dev` instead
- This stack is for **production/staging** environments

### Memory vs. Throughput
- 8GB/instance (configurable via NODE_OPTIONS) balances OOM risk vs. GC pauses
- Adjust lower if tight on memory, higher if GC becomes a bottleneck
- Monitor: `docker stats omniroute-*`

### Stickiness
- Caddy uses least-conn (connectionless), not IP affinity
- No session stickiness; clients may hit different replicas per request
- Redis ensures state is shared (no session loss)

## Monitoring

```bash
# Watch replica stats
docker stats omniroute-1 omniroute-2 omniroute-3 redis

# Check load balancer config
docker exec omniroute-lb caddy config

# View Caddy access logs (add to Caddyfile if needed)
docker logs loadbalancer

# Inspect Redis cache hits
docker exec omniroute-redis redis-cli info stats
```

## Troubleshooting

### "Health checks failing"
- Verify OmniRoute replicas are fully booted: `docker logs omniroute-1`
- Check Redis connectivity: `docker exec omniroute-redis redis-cli ping`
- Caddy LB waits 30s for replicas to start (`start_period` in healthcheck)

### "OOM killed / out of memory"
- Increase `NODE_OPTIONS` heap cap (e.g., `--max-old-space-size=10240`)
- Add more replicas to distribute load
- Check for memory leaks: `docker stats` over time

### "Load balancer not routing"
- Verify Caddy is running: `docker logs loadbalancer`
- Check upstream addresses in Caddyfile match replica ports
- Verify upstream health: `curl http://localhost:3001/v1/models` (internal)

## Cleanup

```bash
# Stop all services
docker compose -f docker-compose.scale.yml down

# Remove all data (Redis cache cleared)
docker compose -f docker-compose.scale.yml down -v

# Remove images
docker image rm omniroute-fork:latest redis:7 caddy:2
```

## Future: Source-Streaming & Substrate Gateway

Once diegosouzapw/OmniRoute lands **source-streaming**:
- Single-instance memory footprint drops significantly
- This deployment becomes optional (unless ultra-high availability is needed)

Once **substrate-gateway** is production-ready:
- OmniRoute moves to a service behind the substrate gateway
- Gateway handles routing / retry / circuit-breaking
- OmniRoute becomes a specialized execution engine
- Memory pressure further reduced

---

**Status**: Symptom mitigation for diegosouzapw/OmniRoute#4041  
**Deployment**: Docker Compose on WSL2  
**Replicas**: 3 (configurable)  
**Node Heap Cap**: 8GB/instance (configurable)
