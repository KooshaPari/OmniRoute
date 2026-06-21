# phenotype-router — bench module

Three Go benchmark suites for the phenotype-router decision layer (ADR-050
/ ADR-051). All targets are **stdlib only** — no external Go deps. Each
suite produces a single-line summary suitable for log aggregation and a
machine-readable stdout pipe for the CI workflow.

## Suites

| Suite | Driver | Purpose | Time on MacBook M-series |
|---|---|---|---|
| `bench_routing_e2e` | `go test -bench=BenchmarkRoutingE2E -benchtime=1000x` | Single-thread request → decision → plugin dispatch. Fixed 1k iterations (AGENTS.md §"v13 outlook"). | ~1 s |
| `bench_p95_latency`  | `go run ./cmd/p95_latency -rps=1000 -duration=30m`     | Sustained 1k RPS for 30 min (1.8 M requests), p50/p95/p99 reported. CI shortened to 5 min by default. | 30 min (5 min CI) |
| `bench_throughput`   | `go run ./cmd/throughput -min=100 -max=10000 -steps=10` | Sweep 100 → 10k RPS, find the ceiling. `fast` profile (5 ms upstream) isolates router from upstream. | ~3 min |

## Quick start

```bash
# Run all three suites locally (matches `just bench-router`)
make bench-all

# Or one at a time:
make bench-e2e           # 1k-iteration routing loop
make bench-p95           # 30s smoke soak (use -duration=30m for the SOTA window)
make bench-throughput    # 100→10k RPS sweep
```

## Usage flags

### p95_latency

| Flag | Default | Notes |
|---|---|---|
| `-rps` | 1000 | Target requests per second |
| `-duration` | 30m | Soak window (CI uses 5m for budget) |
| `-workers` | 64 | Concurrent in-flight requests; raise to meet RPS when upstream latency is high |
| `-warmup` | 10s | Discarded warm-up window |
| `-report` | 30s | Periodic summary interval (also goes to stderr) |
| `-strict` | off | Exit non-zero if p99 > 1.5 s budget |

### throughput

| Flag | Default | Notes |
|---|---|---|
| `-min` | 100 | Starting RPS |
| `-max` | 10000 | Ending RPS |
| `-steps` | 10 | Sweep steps |
| `-log` | true | Geometric spacing across the range |
| `-per-step` | 30s | Duration of each step |
| `-workers` | 256 | Worker pool size |
| `-warmup` | 3s | Per-step warm-up (discarded) |
| `-cooldown` | 2s | Pause between steps |
| `-reverse` | false | High-to-low for hysteresis |
| `-profile` | fast | `fast` (5 ms upstream, router ceiling) or `real` (800 ms upstream, upstream ceiling) |
| `-full` | false | Print full per-step LatencyTracker report |

## What is being measured

The bench module ports the reference decision-flow skeleton at
`findings/2026-06-20-phenotype-router-decision-flow.go` into a buildable
package (`decision.go`). The port keeps the same surface area the
production router will expose, minus the Bifrost transport (per ADR-051,
Bifrost stays out of the decision layer; the bench isolates the router
for measurement).

Per AGENTS.md §"v13 outlook" / task brief:

> Performance benchmarks: per ADR-040 — router e2e (request → decision →
> plugin dispatch) + p95 latency under sustained load (1k RPS, 30 min soak),
> benchmark harness co-located with the spike artifacts.

## CI integration

`.github/workflows/bench.yml` runs all three suites on every tagged release
(`v*`). The p95 soak is shortened to 5 min in CI (1k RPS × 300 s = 300 k
samples, well above the statistical floor for p99 estimates). Results are
uploaded as workflow artifacts (`bench-results.tar.gz`).

The CI run is the source of truth for the **steady-state p99 budget**; the
local baseline in `bench-results/` is the offline snapshot for PR review.

## Baseline (2026-06-21)

See `bench-results/baseline-2026-06-21.txt` for the snapshot captured on
the dev MacBook (Apple M-series, Go 1.26.4). The CI runs at release tag
time — compare against the artifact under each GitHub Release.

## ADR-040 coverage gate

`phenotype-router` is classified as a **federated service** under ADR-023
Rule 3. Per ADR-040, the coverage gate is **60 %** (not 80 % lib / 70 %
framework). The 80 % lib / 70 % framework / 60 % federated ladder is
enforced in the bench workflow's coverage step (post-v15 — currently
informational; the lcov gate will land with the T8 pheno-otel histogram
rollout per `plans/2026-06-21-v15-71-pillar-cycle-5-p0.md`).
