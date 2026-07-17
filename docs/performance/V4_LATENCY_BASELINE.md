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

The local benchmark loads the built BFF and measures `/healthz` and
`/api/dashboard/health` over a real TCP listener bound to `127.0.0.1`. Each route receives
30 warmups and 250 recorded samples. Reports retain every bounded raw duration and status,
plus nearest-rank p50, p95, and p99; HTTP 5xx responses count as errors. The report records
the exact source commit and tree, runtime and pinned runner environment, complete normalized
route inventory, sample contract, and resident memory.

The benchmark process installs deny-by-default guards before importing the built BFF. It
permits `global.fetch` only to the benchmark's exact loopback port and blocks non-loopback
`Bun.connect`, Node socket creation, and Node DNS lookup/resolve calls. No providers or
credentials are used. A zero blocked-attempt count is required; the workflow also publishes
SHA-256 checksums with the raw reports.

Run twice from an installed checkout:

```sh
SOURCE_COMMIT=$(git rev-parse HEAD) SOURCE_TREE=$(git rev-parse HEAD^{tree}) bun run --cwd apps/bff benchmark:latency -- run-1.json
SOURCE_COMMIT=$(git rev-parse HEAD) SOURCE_TREE=$(git rev-parse HEAD^{tree}) bun run --cwd apps/bff benchmark:latency -- run-2.json
bun run --cwd apps/bff benchmark:compare -- ../../latency-evidence/run-1.json ../../latency-evidence/run-2.json
```

The comparison strictly revalidates schemas, raw-sample sequences and derived summaries,
then requires identical source/tree, benchmark and environment contracts, complete
bidirectional route sets, inventory hash, sample count, error count/rate, and network-policy
invariants. Each percentile may vary by at most the greater of 0.75 ms or 35% of the larger
value; RSS may vary by at most the greater of 32 MiB or 20% of the larger value. These are
repeatability tolerances for two consecutive runs, not production SLOs.

All provider/model latency, throughput, cost, cache-benefit, and production-scale claims are
unverified for v4. They remain excluded from Phenodocs until backed by a versioned runtime
producer, deterministic aggregation tests, and exact-source evidence.
