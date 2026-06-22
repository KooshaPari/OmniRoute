# pheno-otel — Service Level Objectives (SLOs)

**Owner:** orch-v21-L15-slo-definition
**Substrate:** `pheno-otel` (ADR-037 — OTLP wire-format export substrate)
**Substrate tier:** `pheno-*-lib` (per ADR-023 Rule 3.1; 80 % coverage gate per ADR-040)
**Status:** ACTIVE (v21 cycle-11, L15 perf-budget track)
**Last reviewed:** 2026-06-22
**Effective:** 2026-06-22
**Audit window:** rolling 28 days (calendar month, evaluated every Monday 09:00 PDT per ADR-041 cadence)

This document is the reliability contract for the `pheno-otel` substrate. The
SLIs below are computed from OTLP spans emitted by every concrete adapter
(`StdoutExporter`, `HttpExporter`) and reported through `pheno-tracing`
(ADR-012, ADR-036B). The compliance check lives in
`scripts/slo-check.sh` (monorepo root) and is wired into the weekly
71-pillar refresh (ADR-041).

The substrate is a thin fleet-port wrapper (see `SPEC.md`), not a full
OpenTelemetry SDK. The SLOs are calibrated for **library-level** reliability,
not for SDK-grade availability targets.

---

## 1. Availability target

| ID  | SLI                                          | Target   | Window | Error budget |
|-----|----------------------------------------------|----------|--------|--------------|
| A1  | `OtlpPort::export` returns `Ok(_)` rate      | ≥ 99.9 % | 30 d   | 0.1 % (≈ 43 min / 30 d) |
| A2  | `OtlpPort::health` returns `Ok(_)` rate      | ≥ 99.95 % | 30 d  | 0.05 % (≈ 22 min / 30 d) |
| A3  | `OtlpPort::flush` returns `Ok(_)` rate       | ≥ 99.9 % | 30 d   | 0.1 % (≈ 43 min / 30 d) |

**Rationale.** 99.9 % monthly is the fleet-wide substrate floor (see ADR-023
Rule 3.1 quality bar element 5, codified in ADR-040). `health()` is the
liveness probe used by every consumer, so its target is set 50 % tighter
than the export path. The error budget is the slack between target and
100 % — when exhausted for the rolling 30-day window, the on-call rotation
pauses non-critical deploys per ADR-042.

**Measurement.** `OtlpPort::export` outcomes are derived from the
`otel.otelport.export` span attribute (`otel.status_code = OK|ERROR`). The
check script pulls the past 28 days of spans from the OTLP/HTTP collector
endpoint configured via `OTEL_EXPORTER_OTLP_ENDPOINT` (default
`http://localhost:4318`).

---

## 2. Latency targets (per-call)

All latency targets are measured **inside the trait method body**, exclusive
of the caller's serialization work. The substrate is sync (`fn export(&[u8])`);
async backends buffer internally.

| ID  | SLI                                          | p50     | p95     | p99     | Window | Error budget |
|-----|----------------------------------------------|---------|---------|---------|--------|--------------|
| L1  | `OtlpPort::export` wall-clock (traces)        | ≤ 2 ms  | ≤ 10 ms | ≤ 25 ms | 30 d   | 5 % above p95 |
| L2  | `OtlpPort::export` wall-clock (metrics)       | ≤ 1 ms  | ≤  5 ms | ≤ 15 ms | 30 d   | 5 % above p95 |
| L3  | `OtlpPort::export` wall-clock (logs)          | ≤ 3 ms  | ≤ 12 ms | ≤ 30 ms | 30 d   | 5 % above p95 |
| L4  | `OtlpPort::flush` wall-clock (full queue)     | ≤ 50 ms | ≤ 200 ms | ≤ 500 ms | 30 d | 5 % above p95 |
| L5  | `OtlpPort::health` wall-clock                 | ≤ 0.5 ms | ≤ 2 ms | ≤ 5 ms | 30 d   | 5 % above p95 |

**Rationale.** `HttpExporter::export` is dominated by a single POST + body
serialization; the p95 budget of 10 ms is the upper bound observed on
`pr-bench` (4 vCPU, 8 GB RAM, no network egress). Logs are larger than
metrics, hence the wider envelope. `flush` amortizes a full batch, so its
budget is 20× the per-call export budget.

**Measurement.** Latencies come from the `otel.otelport.export.duration_ms`
span attribute, captured at the start and end of each trait method body.
The script computes percentiles with `numpy.percentile` over the past 28
days of `histogram_quantile`-style raw buckets.

---

## 3. Error rate target

| ID  | SLI                                          | Target  | Window | Error budget |
|-----|----------------------------------------------|---------|--------|--------------|
| E1  | `OtlpPort::export` 5xx-equivalent rate       | ≤ 0.1 % | 30 d   | 10 % above |
| E2  | `OtlpPort::export` 4xx-equivalent rate       | ≤ 0.5 % | 30 d   | 10 % above |
| E3  | `OtlpError::SerializeFailed` rate            | ≤ 0.01 % | 30 d  | 10 % above |
| E4  | `OtlpError::InvalidAttribute` rate           | ≤ 0.05 % | 30 d  | 10 % above |

**Rationale.** 0.1 % is the fleet substrate floor for hard errors (transport,
serialization). 4xx-class errors are configuration-level (caller misuse) and
have a wider budget because they signal consumer drift, not substrate
degradation. `SerializeFailed` should be vanishingly rare; its budget is the
tightest of the row.

**Measurement.** `OtlpError` variants are mapped to span attributes via
`error.type = "OtlpError::Variant"` per the OTel semantic conventions. The
script counts error-variant occurrences per total export call over the
28-day window.

---

## 4. Throughput target

| ID  | SLI                                          | Target           | Window | Notes |
|-----|----------------------------------------------|------------------|--------|-------|
| T1  | Sustained exports / second / process         | ≥ 1,000          | 30 d   | Single-process, no back-pressure |
| T2  | Burst exports / second / process (≤ 10 s)    | ≥ 5,000          | 30 d   | Burst window: ≤ 10 s sustained |
| T3  | Concurrent active `ExportHandle`s            | ≤ 10,000         | 30 d   | Soft cap; load-shed at 12,500 |
| T4  | Bytes exported / second / process            | ≥ 8 MiB          | 30 d   | 1 KiB avg payload × 8,000 req/s |

**Rationale.** 1k req/s sustained is the `pr-bench` baseline; 5× burst for
≤ 10 s matches the v17 async-runtime decision (ADR-088 — single tokio
runtime, bounded queue). The hard cap is set at 12,500 to give the
batcher 25 % headroom; above that, the substrate enters the
`Degraded → Failed` state per `pheno-port-adapter/docs/architecture.md`
state diagram.

**Measurement.** Throughput is derived from the
`otel.otelport.exported_bytes_total` counter and the
`otel.otelport.exports_total` counter, both incremented at the end of
each successful `export` call.

---

## 5. Burn-rate alerts

Burn-rate alerts follow the Google SRE Workbook multi-window methodology
(2-window / 14-day + 1-hour fast burn, 6-hour + 1-day slow burn). The
error budget for any 30-day SLO above is **0.1** (1 - 0.999); the burn
rate is the ratio of observed bad-event rate to the budget.

| Alert ID | Window                | Burn-rate threshold | Action |
|----------|-----------------------|---------------------|--------|
| BR-1     | 1 h fast burn         | ≥ 14.4× (consumes 100 % budget in 2 d) | Page on-call (P2) |
| BR-2     | 6 h fast burn         | ≥  6.0× (consumes 100 % budget in 5 d) | Page on-call (P3) |
| BR-3     | 24 h slow burn        | ≥  3.0× (consumes 100 % budget in 10 d) | Slack `#otel-alerts` |
| BR-4     | 3 d slow burn         | ≥  1.0× (consumes 100 % budget in 30 d) | Ticket; weekly review |
| BR-5     | Latency p95 spike     | ≥  2.0× p95 budget for 15 min | Page on-call (P3) |
| BR-6     | Error-rate spike      | ≥ 10× error-rate target for 5 min | Page on-call (P2) |

**Why these numbers.** BR-1 (14.4× over 1 h) is the standard SRE Workbook
fast-burn threshold — at that rate, the entire 30-day budget is exhausted in
2 days, so paging is mandatory. BR-3 (3× over 24 h) is the slow-burn
threshold; it gives the on-call rotation time to investigate before the
budget runs out.

**Alert routing.** Defined in `phenoObservability/alerts/pheno-otel.yml`
(per ADR-046 federation mTLS + OIDC). The P2 page fires the on-call
primary; P3 fires the secondary; the Slack channel aggregates everything
for postmortem.

---

## 6. Compliance check

The `scripts/slo-check.sh` script in the monorepo root queries the OTLP
collector for the past 7 days (default; override via `--window-days`) and
prints a per-SLO compliance table. Exit code is `0` if all SLOs are within
budget, `1` otherwise.

```bash
# Default: 7-day window, OTLP endpoint from $OTEL_EXPORTER_OTLP_ENDPOINT
./scripts/slo-check.sh pheno-otel

# Custom window + endpoint
./scripts/slo-check.sh pheno-otel --window-days 28 --endpoint http://otel-collector:4318
```

The script implements the SLI definitions above verbatim and writes the
output to `findings/<date>-slo-compliance-<service>.txt`.

---

## 7. Change process

1. Open a PR titled `perf(slo): <change>`.
2. Update the relevant row(s) in § 1-§ 5.
3. Append a one-line worklog entry to `WORKLOG.md` with the old/new value
   (schema v2.1, ADR-015 + ADR-025 + ADR-030, including `device:` field).
4. Tag `@slo-owners` for review.
5. Merge only after CI perf-gate passes and the `slo-check.sh` dry-run is
   green.
6. Any budget **relaxation** requires an ADR per the v18 closure rule.

---

## 8. References

- **ADR-037** — `pheno-mcp-router` substrate canonical (analogous
  substrate-assignment ADR; `pheno-otel` is the OTLP substrate under the
  same family).
- **ADR-012** / **ADR-036B** — `pheno-tracing` substrate canonical
  (sibling; produces what `pheno-otel` exports).
- **ADR-023** — Agent-effort governance (substrate quality bar, Rule 3.1).
- **ADR-040** — Test coverage gates per tier (80 % lib).
- **ADR-041** — 71-pillar refresh cadence (weekly Monday 09:00 PDT cron).
- **ADR-042** — Security audit cadence (companion to SLO cadence).
- **ADR-046** — Federation mTLS + OIDC (alert routing).
- `pheno-otel/SPEC.md` — substrate spec.
- `pheno-otel/CHANGELOG.md` — release history.
- `scripts/slo-check.sh` — compliance check implementation.
- `findings/2026-06-22-V21-T5-slo-definition.md` — fleet-wide SLO
  rollup for all 3 substrate services.