---
title: Perf Initiative
---

# Perf Initiative

## Targets

| Tier | p50 | p99 | Burst |
|------|-----|-----|-------|
| `demo-fast` | 40 ms | 200 ms | 100 rps |
| `smart` | 800 ms | 2500 ms | 20 rps |
| `embeddings` | 60 ms | 300 ms | 80 rps |

## Headroom

p99 must stay under 80% of the target. If exceeded for >15 min: open SEV-2 incident.

## Tracking

`omniroute perf headroom --tier smart` exits 0 if healthy, 1 if degraded.
