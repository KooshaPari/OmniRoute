---
title: v4 latency baseline contract
audience: developer
owner: apps/bff
status: reviewed
lastReviewed: 2026-07-16
sourceOfTruth:
  - apps/bff/src/observability/latency.ts
  - apps/bff/scripts/benchmark-latency.ts
  - config/performance/v4-latency-inventory.json
---

# v4 latency baseline contract

This contract inventories evidence; it does not claim production performance.

The v4 BFF accepts validated Web Vitals at `/api/v1/telemetry/web-vitals`, but currently
logs them without an aggregation store. Dashboard observability and model-performance
responses therefore return `status: unavailable` and empty or null measurements. Previous
hard-coded and random values were placeholders, not telemetry.

The local benchmark measures `/healthz` and `/api/dashboard/health` through Hono's
in-process localhost request interface. It reports nearest-rank p50, p95, and p99; HTTP 5xx
responses count as errors. The report records exact source commit, runtime environment,
commit and tree hashes, warmup and sample counts, error rate, and resident memory. It uses no providers, credentials,
or external network.

Run twice from an installed checkout:

```sh
SOURCE_COMMIT=$(git rev-parse HEAD) SOURCE_TREE=$(git rev-parse HEAD^{tree}) bun run --cwd apps/bff benchmark:latency -- ../../artifacts/run-1.json
SOURCE_COMMIT=$(git rev-parse HEAD) SOURCE_TREE=$(git rev-parse HEAD^{tree}) bun run --cwd apps/bff benchmark:latency -- ../../artifacts/run-2.json
bun run --cwd apps/bff benchmark:compare -- ../../artifacts/run-1.json ../../artifacts/run-2.json
```

The comparison requires identical source SHA, route set, sample count, and error rate. Each
percentile may vary by at most the greater of 5 ms or 100% of the first run. This broad
tolerance detects broken or incomparable runs; it is not a performance regression budget.

All provider/model latency, throughput, cost, cache-benefit, and production-scale claims are
unverified for v4. They remain excluded from Phenodocs until backed by a versioned runtime
producer, deterministic aggregation tests, and exact-source evidence.
