---
title: Stress Test
---

# Stress Test

`demo/stress.ts` runs two phases:

## Phase 1: Burst

```sh
bun run demo/stress.ts --burst 200 --rps 100 --duration 30
```

Sends 200 requests at 100 rps for 30 seconds. Reports p50, p99, error rate.

## Phase 2: Sustained

```sh
bun run demo/stress.ts --sustained 50 --duration 600
```

50 rps for 10 minutes. Verifies p99 stays under target.

## Pass criteria

| Phase | Pass | Fail |
|-------|------|------|
| Burst | p99 < 200ms, errors < 1% | otherwise |
| Sustained | p99 < 250ms, errors < 0.5%, no memory leak | otherwise |

A non-pass aborts the CI gate.
