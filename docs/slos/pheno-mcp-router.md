# pheno-mcp-router — Service Level Objectives (SLOs)

**Owner:** orch-v21-L15-slo-definition
**Substrate:** `pheno-mcp-router` (ADR-013 / ADR-037 — MCP routing substrate; Tier 2 promotion PROPOSED per `PROMOTION.md`)
**Substrate tier:** `pheno-*-lib` → `phenotype-*-sdk` (Tier 1 → Tier 2 promotion per ADR-048)
**Status:** ACTIVE (v21 cycle-11, L15 perf-budget track)
**Last reviewed:** 2026-06-22
**Effective:** 2026-06-22
**Audit window:** rolling 28 days (calendar month, evaluated every Monday 09:00 PDT per ADR-041 cadence)

This document is the reliability contract for the `pheno-mcp-router`
substrate. The SLIs below complement the per-stage latency budgets in
`docs/perf-budget.md` (§ 1-§ 3 of that doc define stage budgets; this
document defines fleet-wide reliability + the burn-rate alert policy).
SLIs are computed from OTLP spans emitted through `pheno-tracing`
(ADR-012, ADR-036B) + `pheno-otel` (ADR-037). The compliance check lives
in `scripts/slo-check.sh` (monorepo root).

`pheno-mcp-router` is the **highest-traffic** of the three substrate
services in this batch — 7 in-tree consumers plus the absorbed
`dispatch-mcp` W2-1 code (per `PROMOTION.md`). The SLOs here are
calibrated for **federated service** behavior (ADR-023 Rule 3, federated
tier), which is stricter than the `pheno-*-lib` tier used for
`pheno-otel` and `pheno-port-adapter`.

---

## 1. Availability target

| ID  | SLI                                          | Target    | Window | Error budget |
|-----|----------------------------------------------|-----------|--------|--------------|
| A1  | `Router::route` (request → decision) success | ≥ 99.9 %  | 30 d   | 0.1 % (≈ 43 min / 30 d) |
| A2  | `LlmPort::resolve` success rate              | ≥ 99.9 %  | 30 d   | 0.1 % (≈ 43 min / 30 d) |
| A3  | Cost / budget middleware allow-rate          | ≥ 99.0 %  | 30 d   | 1.0 % (≈ 7 h 12 min / 30 d) |
| A4  | Audit middleware emit-success rate           | ≥ 99.95 % | 30 d   | 0.05 % (≈ 22 min / 30 d) |
| A5  | Tool-call success rate (provider ack ≥ 200)  | ≥ 99.5 %  | 30 d   | 0.5 % (≈ 3 h 36 min / 30 d) |

**Rationale.** `Router::route` is the public API surface — every consumer
hits it on every request. The 99.9 % floor matches the fleet-wide
substrate contract. `LlmPort::resolve` is the trait side of the substrate;
its budget is the same because resolution failure is fatal to the request.
`Audit middleware` is set tighter (99.95 %) because audit gaps are a
compliance problem (SOC2 evidence automation, ADR-042), not just a
reliability problem. `Tool-call` is allowed a wider budget because it
depends on external provider availability (Llama, OpenAI-compat, etc.) —
the budget reflects the substrate's commitment, not the provider's.

**Measurement.** Each trait method emits a span with
`otel.router.<method>.result = OK|ERROR` and the typed error on the
`error.type` attribute (consistent with `pheno-otel` § 1 and
`pheno-port-adapter` § 1). The check script queries the OTLP collector
for the past 28 days and computes the success ratio per trait method.

---

## 2. Latency targets (per-request, end-to-end)

All latency targets are measured **at the public API boundary** of
`pheno-mcp-router::Router`, inclusive of all four pipeline stages
(`route_match`, `tool_call`, `stream_chunk`, `cleanup`). Stage-level
budgets are defined in `docs/perf-budget.md` § 1; this document defines
the **aggregate** end-to-end envelope.

| ID  | SLI                                          | p50     | p95     | p99     | Window | Error budget |
|-----|----------------------------------------------|---------|---------|---------|--------|--------------|
| L1  | `Router::route` end-to-end (sync flow)       | ≤ 25 ms | ≤ 85 ms | ≤ 200 ms | 30 d  | 5 % above p95 |
| L2  | `Router::route` end-to-end (streaming, TTB*) | ≤ 80 ms | ≤ 250 ms | ≤ 500 ms | 30 d | 5 % above p95 |
| L3  | `LlmPort::resolve` wall-clock                | ≤  5 ms | ≤  20 ms | ≤  50 ms | 30 d  | 5 % above p95 |
| L4  | Cost / budget middleware overhead            | ≤  1 ms | ≤   3 ms | ≤  10 ms | 30 d  | 5 % above p95 |
| L5  | Audit middleware overhead                    | ≤  2 ms | ≤   5 ms | ≤  15 ms | 30 d  | 5 % above p95 |
| L6  | Cold-start (first byte after boot)           | n/a     | ≤ 500 ms | ≤ 1 s  | 30 d  | 5 % above p95 |

*TTB = time to first byte of the streamed response.

**Rationale.** The aggregate end-to-end budget (L1: 85 ms p95) is the
**sum** of the four stage budgets in `docs/perf-budget.md` § 1
(10 + 50 + 5 + 20 = 85 ms). Real-world streaming flows pipeline the
stages, so the practical p95 is `max(route_match, tool_call) +
stream_chunk` ≈ 55 ms; the 85 ms budget is the conservative upper bound.
`LlmPort::resolve` is a pure-dispatch trait method and must be cheap; its
budget is 1/4 of the request-level p95. Middleware overheads (L4, L5)
are set tight to leave headroom for the actual provider call.

**Measurement.** Latencies come from the
`otel.router.<stage>.duration_ms` span attribute, captured at the start
and end of each stage. End-to-end is the difference between the
`request.start` and `request.end` parent span timestamps.

---

## 3. Error rate target

| ID  | SLI                                          | Target   | Window | Error budget |
|-----|----------------------------------------------|----------|--------|--------------|
| E1  | 5xx-equivalent (`RouterError::Internal`)     | ≤ 0.1 %  | 30 d   | 10 % above |
| E2  | 4xx-equivalent (`RouterError::Client`)       | ≤ 0.5 %  | 30 d   | 10 % above |
| E3  | Provider timeout rate                        | ≤ 0.5 %  | 30 d   | 10 % above |
| E4  | Rate-limit (429) rate                        | ≤ 1.0 %  | 30 d   | 10 % above |
| E5  | Budget-exhaustion (402) rate                 | ≤ 0.05 % | 30 d   | 10 % above |
| E6  | Aggregate error rate (all variants)          | ≤ 1.0 %  | 30 d   | 10 % above |

**Rationale.** 0.1 % is the fleet substrate floor for hard 5xx-class
errors. 4xx-class errors (caller misuse) have a wider budget because
they signal consumer drift, not substrate degradation. 429 (rate-limit)
is **expected** during load spikes — the budget reflects the load-shed
policy in `docs/perf-budget.md` § 2 (T3 `msg_queue_depth` cap of 10,000).
Budget-exhaustion (402) is allowed the tightest budget because it
signals a financial risk that should trigger a customer-facing alert
before it cascades.

**Measurement.** `RouterError` variants are mapped to the OTel
`error.type` attribute. The script counts variant occurrences per total
request over the 28-day window.

---

## 4. Throughput target

| ID  | SLI                                          | Target           | Window | Notes |
|-----|----------------------------------------------|------------------|--------|-------|
| T1  | Sustained req/s / process                    | ≥ 1,000          | 30 d   | Matches `perf-budget.md` § 2 S5 |
| T2  | Burst req/s / process (≤ 10 s)               | ≥ 2,000          | 30 d   | Matches `perf-budget.md` § 2 S5 burst |
| T3  | Concurrent connections / node                | ≤ 500            | 30 d   | Soft cap; hard cap 750 |
| T4  | Sustained msg/s / connection                 | ≥ 1,000          | 30 d   | Matches `perf-budget.md` § 2 S5 |
| T5  | `msg_queue_depth` p99                        | ≤ 8,000          | 30 d   | 80 % of 10,000 cap |

**Rationale.** These throughput numbers are pulled directly from
`docs/perf-budget.md` § 2 (the v20 L19 perf-gate cycle). The SLO version
of the table here adds the **p99 queue depth** row (T5), which is the
leading indicator for the load-shed policy in § 2 row 3 of that doc.

**Measurement.** Throughput is derived from the
`otel.router.requests_total` counter, the
`otel.router.active_connections` gauge, and the
`otel.router.msg_queue_depth` gauge (sampled every 1 s).

---

## 5. Burn-rate alerts

Burn-rate alerts follow the Google SRE Workbook multi-window methodology.
The error budget for any 30-day SLO above is **0.1** (A1, A2, all E-rows
except E6) or **0.05** (A4, E5); the burn rate is the ratio of observed
bad-event rate to the budget.

| Alert ID | Window                | Burn-rate threshold | Action |
|----------|-----------------------|---------------------|--------|
| BR-1     | 1 h fast burn         | ≥ 14.4× (consumes 100 % budget in 2 d) | Page on-call (P1) |
| BR-2     | 6 h fast burn         | ≥  6.0× (consumes 100 % budget in 5 d) | Page on-call (P2) |
| BR-3     | 24 h slow burn        | ≥  3.0× (consumes 100 % budget in 10 d) | Slack `#mcp-router-alerts` |
| BR-4     | 3 d slow burn         | ≥  1.0× (consumes 100 % budget in 30 d) | Ticket; weekly review |
| BR-5     | Latency p95 spike     | ≥  2.0× p95 budget for 15 min | Page on-call (P2) |
| BR-6     | Budget-exhaustion     | ≥ 5× budget-exhaustion rate for 1 h | Slack `#finance-alerts` |
| BR-7     | Audit gap             | ≥ 1 audit middleware failure for 1 h  | Page on-call (P1) |

**Why these numbers.** BR-1 (14.4× over 1 h) is the standard SRE Workbook
fast-burn threshold. Because `pheno-mcp-router` has the strictest
availability floor of the three substrates (and the highest consumer
count), BR-1 fires P1 instead of P2 — this substrate's failure is felt
across the entire fleet. BR-6 is a financial alert (budget exhaustion)
that escalates to the finance channel because every 402 is a customer
billing event. BR-7 is a compliance alert — any audit middleware failure
fails SOC2 evidence automation (ADR-042), so it pages immediately.

**Alert routing.** Defined in
`phenoObservability/alerts/pheno-mcp-router.yml` (per ADR-046 federation
mTLS + OIDC). The P1 page fires the on-call primary + secondary; P2
fires the primary; the Slack channels aggregate everything for
postmortem.

---

## 6. Compliance check

The `scripts/slo-check.sh` script in the monorepo root queries the OTLP
collector for the past 7 days (default; override via `--window-days`) and
prints a per-SLO compliance table. Exit code is `0` if all SLOs are
within budget, `1` otherwise.

```bash
# Default: 7-day window, OTLP endpoint from $OTEL_EXPORTER_OTLP_ENDPOINT
./scripts/slo-check.sh pheno-mcp-router

# Custom window + endpoint
./scripts/slo-check.sh pheno-mcp-router --window-days 28 --endpoint http://otel-collector:4318
```

The script implements the SLI definitions above verbatim and writes the
output to `findings/<date>-slo-compliance-<service>.txt`.

---

## 7. Change process

1. Open a PR titled `perf(slo): <change>`.
2. Update the relevant row(s) in § 1-§ 5 **and** the corresponding rows
   in `docs/perf-budget.md` § 1-§ 3 (the two documents must stay in sync;
   the SLO doc defines the fleet-wide envelope, the perf-budget doc
   defines the per-stage budget).
3. Append a one-line worklog entry to `WORKLOG.md` with the old/new value
   (schema v2.1, ADR-015 + ADR-025 + ADR-030, including `device:` field).
4. Tag `@slo-owners` for review.
5. Merge only after CI perf-gate passes and the `slo-check.sh` dry-run is
   green.
6. Any budget **relaxation** requires an ADR per the v18 closure rule.

---

## 8. References

- **ADR-013** — `pheno-mcp-router` substrate canonical (original).
- **ADR-037** — re-affirmed canonical (2026-06-18).
- **ADR-048** — substrate graduation path (Tier 1 → Tier 2 in flight).
- **ADR-012** / **ADR-036B** — `pheno-tracing` canonical (sibling
  observability substrate).
- **ADR-037** — `pheno-otel` canonical (this substrate emits OTLP spans
  via `pheno-otel`).
- **ADR-023** — Agent-effort governance (substrate quality bar, Rule 3.1).
- **ADR-040** — Test coverage gates per tier (86 % SDK, exceeds 80 % gate).
- **ADR-041** — 71-pillar refresh cadence (weekly Monday 09:00 PDT cron).
- **ADR-042** — Security audit cadence (audit-middleware = SOC2 evidence).
- **ADR-046** — Federation mTLS + OIDC (alert routing).
- **ADR-088** — async runtime decision (tokio vs smol).
- **ADR-029** — Dmouse92 → KooshaPari migration (absorbed `dispatch-mcp`).
- `pheno-mcp-router/SPEC.md` — substrate spec.
- `pheno-mcp-router/docs/perf-budget.md` — per-stage latency budgets.
- `pheno-mcp-router/PROMOTION.md` — Tier 1 → Tier 2 promotion evidence.
- `pheno-mcp-router/CHANGELOG.md` — release history.
- `scripts/slo-check.sh` — compliance check implementation.
- `findings/2026-06-22-V21-T5-slo-definition.md` — fleet-wide SLO rollup.