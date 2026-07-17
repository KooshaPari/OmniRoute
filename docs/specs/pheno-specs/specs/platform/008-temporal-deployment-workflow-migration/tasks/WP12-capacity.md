# WP12: AX101 Capacity Planning and Resource Audit

**Feature**: 008-temporal-deployment-workflow-migration
**Phase**: 5 - Handoff
**Wave**: 2
**Dependencies**: WP10 (observation complete)
**Author**: Claude Sonnet 4.6

## Mission

Audit the AX101 server (64GB RAM, 16 cores, 2TB NVMe) for Temporal + Hatchet deployment. Confirm resource allocation, identify bottlenecks, document scaling triggers, and produce a capacity plan for 6-month growth.

## Reference

- Spec: `../spec.md` — SC-005
- Plan: `../plan.md` — WP12 section
- Depends on: `WP10-observation.md`

## Context

The AX101 will run:
- Temporal (Postgres + Elasticsearch + worker)
- Hatchet (Postgres + worker)
- NATS (pure event bus)
- Process orchestrator
- Monitoring (Prometheus + Grafana + Jaeger)

All under Docker Compose. The capacity audit ensures no single service starves another.

## What to Build

### 1. Resource Audit Script

```bash
#!/bin/bash
# scripts/capacity-audit.sh

echo "=== AX101 Resource Audit ==="
echo "Date: $(date)"
echo ""

# CPU
echo "--- CPU ---"
nproc
sysctl -n hw.ncpu
echo ""

# Memory
echo "--- Memory ---"
vm_stat
echo ""
free -h
echo ""

# Disk
echo "--- Disk ---"
df -h /
echo ""
iostat -x 5 1 || true
echo ""

# Docker
echo "--- Docker Containers ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Docker resource usage
echo "--- Docker Stats (live) ---"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
echo ""

# Disk usage by Docker
echo "--- Docker Disk Usage ---"
docker system df
echo ""

# Docker volume sizes
echo "--- Docker Volumes ---"
docker volume ls --format "{{.Name}}" | while read vol; do
  size=$(docker run --rm -v "${vol}:/vol" alpine du -sh /vol 2>/dev/null | cut -f1 || echo "N/A")
  echo "$vol: $size"
done
```

### 2. Service Resource Allocation Table

Document in `docs/infra/CAPACITY.md`:

```markdown
# AX101 Capacity Plan

## Server Specs

| Resource | Amount |
|----------|--------|
| CPU | 16 cores (AMD EPYC or equivalent) |
| RAM | 64 GB DDR4 |
| Storage | 2 TB NVMe SSD |
| Network | 1 Gbps |

## Service Resource Allocation

| Service | CPU | RAM | Disk | Notes |
|---------|-----|-----|------|-------|
| Temporal PostgreSQL | 2 cores | 8 GB | 50 GB | Workflow state |
| Temporal Elasticsearch | 4 cores | 16 GB | 100 GB | Visibility index |
| Temporal Server | 1 core | 1 GB | - | gRPC frontend |
| Temporal Worker | 4 cores | 4 GB | - | Workflow execution |
| Hatchet PostgreSQL | 1 core | 4 GB | 20 GB | Job state |
| Hatchet | 1 core | 1 GB | - | API + worker |
| NATS | 0.5 core | 256 MB | 1 GB | Event bus |
| Prometheus | 1 core | 2 GB | 50 GB | Metrics retention 30d |
| Grafana | 1 core | 512 MB | 5 GB | Dashboards |
| Jaeger | 2 cores | 4 GB | 50 GB | Traces retention 7d |
| Process Orchestrator | 1 core | 1 GB | - | process-compose |
| **Reserved** | 2 cores | 4 GB | - | Headroom |
| **Available** | 0.5 cores | ~18 GB | ~1.7 TB | Growth buffer |

## Total Usage

| Resource | Used | Total | Utilization |
|----------|------|-------|-------------|
| CPU | ~13.5 cores | 16 | 84% |
| RAM | ~45 GB | 64 GB | 70% |
| Disk | ~276 GB | 2 TB | 14% |

## Bottleneck Analysis

### Current Bottleneck: Elasticsearch
Elasticsearch at 16GB RAM is the heaviest service. It competes with Temporal worker for memory under load.

**Mitigation**: Elasticsearch memory is capped at 16GB via `ES_JAVA_OPTS=-Xms16g -Xmx16g`. Worker memory is capped at 4GB.

### Bottleneck Trigger: > 100 concurrent workflows
At 100+ concurrent workflows:
- Worker CPU (4 cores) becomes saturated
- Elasticsearch query latency increases
- Consider: add second worker node (future)

## Scaling Triggers

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Worker CPU > 80% | > 60% for 10 min | > 80% for 5 min | Scale workers |
| Elasticsearch CPU > 70% | > 50% for 15 min | > 70% for 5 min | Add replicas |
| PostgreSQL connections > 80% | > 60% for 10 min | > 80% for 5 min | Connection pooling |
| Disk usage > 70% | > 50% | > 70% | Clean old data |
| RAM usage > 85% | > 75% | > 85% | OOM risk — investigate |

## 6-Month Growth Projection

| Month | Agent Dispatches/day | CI Runs/day | Data Syncs/day | Est. CPU | Est. RAM |
|-------|---------------------|-------------|----------------|----------|----------|
| M0 (now) | 50 | 24 | 4 | 13.5 cores | 45 GB |
| M1 | 75 | 36 | 6 | 14.5 cores | 48 GB |
| M3 | 150 | 72 | 12 | 16 cores | 52 GB |
| M6 | 300 | 144 | 24 | 20 cores | 58 GB |

**M3 Note**: At M3, CPU hits 16 cores. Options:
1. Enable Temporal worker autoscaling (add second worker)
2. Reduce Elasticsearch heap to 12GB, give headroom to workers

## Cost Optimization

| Service | Current Cost | Optimization |
|---------|--------------|--------------|
| Elasticsearch 8.x | ~8GB heap | Can reduce to 4GB if < 50 workflows/day |
| Jaeger retention | 7 days | Can reduce to 3 days for non-production |
| Prometheus retention | 30 days | OK for current scale |
| Docker volumes | 276 GB used | Prune weekly: `docker system prune -f` |

## Backup Plan

If AX101 fails:
1. Restore from latest backup (see Backup Runbook)
2. Temporal history in PostgreSQL → restore point-in-time
3. Hatchet job history → restore from PostgreSQL
4. Jaeger traces → lost (7-day retention, acceptable loss)
5. Estimated RTO: 30 minutes
6. Estimated RPO: 1 hour (Prometheus metrics may gap)

## Acceptance Criteria

- [ ] Resource audit script runs without errors on AX101
- [ ] All Docker container resource limits confirmed in docker-compose
- [ ] `docs/infra/CAPACITY.md` documents all services and allocations
- [ ] Scaling triggers documented with clear thresholds
- [ ] 6-month growth projection shows AX101 can handle M3 load
- [ ] M3+ scaling plan documented (second worker node)
- [ ] Backup and restore procedure documented
- [ ] Docker system prune cron job configured
```
