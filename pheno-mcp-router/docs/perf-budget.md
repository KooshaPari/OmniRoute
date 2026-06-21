# pheno-mcp-router Performance Budget & SLOs

**Owner:** orch-v20-L43-L19-perf-gate
**Substrate:** `pheno-mcp-router` (ADR-013, ADR-037)
**Status:** ACTIVE (v20 cycle, L19 perf-gate track)
**Last reviewed:** 2026-06-21
**Effective:** 2026-06-21

This document is the performance contract for `pheno-mcp-router`. The numbers
below are hard budgets enforced by `.github/workflows/perf-gate.yml` and the
local `just bench` target. Any PR that regresses past a budget fails CI.

The budget is intentionally small and explicit. Adding a new stage to the
router requires adding a row here first; deleting a stage requires a bucket
change entry in the worklog (`bucket_change: from=... to=... reason=...`)
per ADR-015 v2.1.

---

## 1. Stage-latency budgets (p95, per-request)

The router is decomposed into four observable stages. Each is measured
end-to-end on the hot path; p95 is the 95th-percentile wall-clock time
excluding network egress. All numbers are per request at the public API
boundary of `pheno-mcp-router::Router`.

| # | Stage             | p95 budget | Rationale                                                |
|---|-------------------|-----------:|----------------------------------------------------------|
| 1 | `route_match`     |     10 ms  | Pure dispatch; should be O(log n) over registered tools. |
| 2 | `tool_call`       |     50 ms  | Includes downstream provider call minus network tail.    |
| 3 | `stream_chunk`    |      5 ms  | First-byte latency per chunk; streaming UX-critical.     |
| 4 | `cleanup`         |     20 ms  | Resource teardown per connection (audit log + close).   |

Aggregate per-request budget (sum, upper bound): **85 ms p95**.

The aggregate is intentionally loose: stages are pipelined for streaming
flows, so real-world end-to-end p95 is bounded by `max(route_match,
tool_call) + stream_chunk`, not the sum.

---

## 2. Throughput budgets

| # | Metric                            | Budget   | Notes                                                |
|---|-----------------------------------|---------:|------------------------------------------------------|
| 1 | msg/sec per connection            |   1,000  | Sustained; bursts up to 2,000 for ≤ 10 s.            |
| 2 | Concurrent connections per node   |     500  | Soft cap; hard cap enforced at 750 by load-shedding. |
| 3 | `msg_queue_depth`                 |  10,000  | Per-shard queue cap; overflow drops with 429.        |

These are measured under the standard load profile in `benches/perf_profile.rs`
(workload descriptor to be defined alongside the benches, see § 6).

---

## 3. SLO table

SLOs are evaluated over a rolling 28-day window. The error budget is the
slack between the SLO target and 100 %; when it is exhausted for the window,
the on-call rotation pauses non-critical deploys per ADR-042.

| ID  | SLI                                         | Target        | Window    | Error budget |
|-----|---------------------------------------------|---------------|-----------|--------------|
| S1  | `route_match` p95 latency                   |   ≤ 10 ms     | 28 d      |  5 % of reqs |
| S2  | `tool_call` p95 latency                     |   ≤ 50 ms     | 28 d      |  5 % of reqs |
| S3  | `stream_chunk` p95 first-byte latency       |    ≤  5 ms    | 28 d      |  5 % of reqs |
| S4  | `cleanup` p95 latency                       |   ≤ 20 ms     | 28 d      |  5 % of reqs |
| S5  | msg/sec per connection (sustained)          |   ≥ 1,000     | 28 d      |  5 % below    |
| S6  | Concurrent connections (steady-state)       |   ≥ 500       | 28 d      |  5 % below    |
| S7  | `msg_queue_depth` overflow (429 rate)       |   ≤ 0.1 %     | 28 d      |  5 % above    |
| S8  | Per-request error rate (5xx)                |   ≤ 0.5 %     | 28 d      | 10 % above    |
| S9  | Per-connection availability                 |   ≥ 99.9 %    | 28 d      |  0.1 % down   |
| S10 | Cold-start time (first byte after boot)     |   ≤ 500 ms    | 28 d      |  5 % above    |

Each SLO row maps 1:1 to a stage budget or a throughput budget above
(S1-S4 → §1, S5-S7 → §2, S8-S10 → operational envelope). The CI perf-gate
enforces §1 and §2 directly; S8-S10 are enforced by the observability
stack (ADR-012, ADR-036B).

---

## 4. Measurement methodology

- **Harness:** `criterion` 0.5+ via `cargo bench --bench perf_profile`.
- **Environment:** Linux x86_64, 4 vCPU, 8 GB RAM, single-tenant CI runner.
  CPU-pinning disabled (default). Turbo / boost enabled.
- **Workload:** 1 KiB JSON-RPC payloads, 50/50 read/write mix, provider
  stub at `pheno-mcp-router::adapters::StubProvider` (no external network).
- **Warm-up:** 3 s; measured window: 10 s; sample size: 100 per benchmark.
- **Statistical test:** Mann-Whitney U against the prior release's
  distribution; the CI gate fails if `p < 0.05` and the median shifts by
  ≥ 5 % in the regressed direction.
- **p95 source:** criterion's reported `p95` per benchmark (lower bound of
  the 95 % confidence interval is the gate value).

The exact workload profile lives in `benches/perf_profile.rs` once that file
is added (tracked in § 6).

---

## 5. Enforcement

| Layer        | Tool                                            | What it catches                                |
|--------------|-------------------------------------------------|------------------------------------------------|
| Local dev    | `just bench`                                    | Single-run regression vs. previous release.    |
| PR gate      | `.github/workflows/perf-gate.yml`               | p95 budget breach; throughput budget breach.   |
| Pre-release  | `just bench-compare` (criterion-compare)        | Median shift ≥ 5 %; CI re-runs if borderline.  |
| Production   | OTLP export via `pheno-tracing` (ADR-012)       | SLO breach → alert → on-call page.            |

The CI perf-gate is intentionally stricter than the SLO window (instant
fail vs. 28-day rolling). The CI gate exists so a regression never reaches
production; the SLO exists so we can measure cumulative degradation.

---

## 6. Open work (tracked, not blocking this PR)

- [ ] Add `benches/perf_profile.rs` defining the four stage benchmarks plus
      the throughput workload descriptor.
- [ ] Add `benches/parser.rs` reusing the provider-stub from § 4.
- [ ] Wire `criterion` JSON output (`--output-format bencher`) into the CI
      gate so p95 parsing is robust (currently text-grep on `time:` lines).
- [ ] Add `perf-budgets.toml` for machine-readable consumption by the gate
      (CI script reads this file rather than re-parsing the markdown).
- [ ] Add dashboard panels for S1-S10 in the `phenoObservability` Grafana
      board.

None of the above blocks this PR landing. The CI gate currently no-ops
gracefully when no benchmarks exist and emits a clear `::warning::` line.

---

## 7. Change process

1. Open a PR titled `perf(budget): <change>`.
2. Update the relevant row(s) in § 1, § 2, and § 3.
3. Update `perf-budgets.toml` (when added per § 6).
4. Append a one-line worklog entry to `WORKLOG.md` with the old/new value.
5. Tag `@perf-gate-owners` for review.
6. Merge only after CI perf-gate passes on the new numbers.

Bucket changes (e.g. "raise `route_match` p95 from 10 ms to 15 ms") require
an ADR per the v18 closure rule for any budget relaxation.
