# phenotype-router

Phenotype-owned router **decision layer** per ADR-050 (Option B) / ADR-051
(Bifrost as library, not wrapper). The decision layer owns the routing
logic — request → selector → plugin chain → provider dispatch — while
Bifrost stays pinned at `v1.5.21` as the transport library (provider
plumbing, streaming, retries, rate limits).

## Status

| Component | State | Notes |
|---|---|---|
| **Rust decision-layer scaffold** (`src/`) | hello-world (v0.1.0) | DecisionLayer trait + BifrostAdapter stub + HelloWorldPort fixture. FFI bridge to Go-side pending. |
| **Go decision-flow port** (`bench/decision.go`) | buildable reference port | Ports the reference skeleton at `findings/2026-06-20-phenotype-router-decision-flow.go` into a runnable package. |
| **Bench module** (`bench/`) | 3 suites, stdlib-only | `bench_routing_e2e`, `bench_p95_latency`, `bench_throughput`. Per-route p99 budgets in `docs/perf-budget.md`. |
| **CI bench workflow** (`.github/workflows/bench.yml`) | gates tagged releases | Full 5-min p95 soak + throughput sweep on every `v*` tag. |

## Performance budgets

Per AGENTS.md §"v13 outlook" and ADR-040 (test coverage gates per tier),
`phenotype-router` ships with a **per-route p99 latency budget** enforced
on tagged releases. The full table is in [`docs/perf-budget.md`](docs/perf-budget.md);
the headline numbers are:

| Route                          | p99 budget | p95 budget |
|---|---|---|
| `phenotype-router/decision` (e2e) | **1500 ms** | 1100 ms |
| `selector/intelligentrouter`    | 50 ms       | 35 ms    |
| `plugin/contentsafety`          | 30 ms       | 20 ms    |
| `plugin/promptadapter`          | 20 ms       | 12 ms    |
| `plugin/contextfolding`         | 100 ms      | 70 ms    |
| `provider/anthropic`            | 1200 ms     | 900 ms   |
| `provider/openai`               | 1100 ms     | 800 ms   |
| `provider/google`               | 1300 ms     | 1000 ms  |
| `fallback/smartfallback`        | 100 ms      | 70 ms    |
| `tracing/otel-span`             | 50 ms       | 35 ms    |

**Budget enforcement:** the bench workflow fails the release tag if p99
exceeds 1500 ms end-to-end. Use `-strict` flag on the p95 driver for the
same gate locally:

```bash
just bench-router-strict DURATION=5m RPS=1000
```

## Bench suite — quick reference

The full guide is in [`bench/README.md`](bench/README.md). Three suites:

```bash
# Local dev (fast loop)
just bench-router                      # all 3, shortened for dev (30s soak)

# Pre-merge verification
just bench-router-strict DURATION=5m   # 5-min soak; fails on p99 > 1500ms

# Baseline (offline snapshot)
cat bench-results/baseline-2026-06-21.txt
```

The CI workflow runs the full gate on every `v*` tag (see
`.github/workflows/bench.yml`). PRs trigger the e2e bench only for fast
feedback; the p95 soak is heavy enough that it only runs on push to `main`,
tag, or manual dispatch.

## Development

```bash
just install    # fetch deps
just build      # compile Rust + Go bench module
just test       # cargo test + go test
just bench-router           # all 3 benches
just bench-router-strict    # benches + budget gate
```

The fleet-standard `justfile-verify` target is the Tier-0 hygiene check
used by `.pre-commit-config.yaml`.

## Architecture boundary (per ADR-051)

```
phenotype-router (decision layer) ──► bifrost/core (transport library)
        │
        ├──► phenotype-router-plugins (the 9 plugins + vector-store slot)
        │
        └──► pheno-tracing (OTLP exporter per ADR-036)
```

**The dependency arrow points down only.** Bifrost never calls into the
router or the plugins. Plugins never call into Bifrost directly. The
router owns both call sites.

## Related ADRs

- **ADR-050** — Router rebuild: Option B (Bifrost as transport library +
  Phenotype-owned decision layer). Accepted 2026-06-20.
- **ADR-051** — Bifrost as library, not wrapper. Accepted 2026-06-20.
- **ADR-052** — Plugin SDK spec (the contract plugins implement against).
- **ADR-040** — Test coverage gates per tier (60 % federated service is
  `phenotype-router`'s tier).
- **ADR-006** — Circuit Breaker pattern (the `smartfallback` health-aware
  fallback layer).

## Out of scope (this repo)

- Plugin implementations — live in `phenotype-router-plugins/` (sibling
  repo per ADR-051 §3). This repo ships the SDK surface and the decision
  flow; the plugins slot in via `phenotype-router/sdk`.
- Bifrost transport patches — live in `bifrost-extensions/` (sibling
  repo). This repo consumes `bifrost/core v1.5.21+` as a Go module.
- OTLP exporter — `pheno-tracing` substrate per ADR-036. The router
  emits OTLP spans; the substrate ships them.
