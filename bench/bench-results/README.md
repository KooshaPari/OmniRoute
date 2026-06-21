# Performance baseline — 2026-06-21

**Branch**: feat/perf-benchmarks-2026-06-21
**Host**: Apple M1 Pro, darwin/arm64
**Go**: 1.22
**Build**: stdlib-only (no external deps)

See [baseline-2026-06-21.md](baseline-2026-06-21.md) for the full
human-readable summary. Raw outputs:

- [e2e-fast.txt](e2e-fast.txt) — `BenchmarkRoutingE2E` (1k iter)
- [e2e-default.txt](e2e-default.txt) — `BenchmarkRoutingE2E_Default` (5 iter)
- [e2e-pickweighted.txt](e2e-pickweighted.txt) — `BenchmarkPickWeighted` (100k iter)
- [p95-soak.txt](p95-soak.txt) — 30-s p95 soak (1k RPS target)
- [throughput.txt](throughput.txt) — 100→10k RPS sweep

## Headline numbers

| Suite | p50 | p95 | p99 | Budget | Verdict |
|---|---|---|---|---|---|
| routing e2e (FastConfig)   | 5.6 ms | — | — | — | — |
| routing e2e (Default)      | 800 ms | — | — | — | — |
| **p95 soak (1k RPS, 30 s)** | **800 ms** | **840 ms** | **880 ms** | 1500 ms | **✓ 41% under** |
| throughput ceiling (10k target) | 5.0 ms | 6.0 ms | 7.0 ms | — | peak 6,990 RPS |
