# pheno-port-adapter — Service Level Objectives (SLOs)

**Owner:** orch-v21-L15-slo-definition
**Substrate:** `pheno-port-adapter` (ADR-038 — Hexagonal L4 Port/Adapter policy reference impl)
**Substrate tier:** `pheno-*-lib` (per ADR-023 Rule 3.1; 80 % coverage gate per ADR-040)
**Status:** ACTIVE (v21 cycle-11, L15 perf-budget track)
**Last reviewed:** 2026-06-22
**Effective:** 2026-06-22
**Audit window:** rolling 28 days (calendar month, evaluated every Monday 09:00 PDT per ADR-041 cadence)

This document is the reliability contract for the `pheno-port-adapter`
substrate — the **reference implementation** of the hexagonal Port/Adapter
pattern (ADR-038) that 21+ downstream pheno-* crates depend on. The SLIs
below are computed from OTLP spans emitted by every concrete adapter
(`TcpAdapter`, `UnixAdapter`, `InProcAdapter`, `RedisAdapter`) and reported
through `pheno-tracing` (ADR-012, ADR-036B) + `pheno-otel` (ADR-037). The
compliance check lives in `scripts/slo-check.sh` (monorepo root).

Because every transport adapter in the fleet depends on this crate, the
SLOs here are slightly tighter than the fleet substrate floor.

---

## 1. Availability target

| ID  | SLI                                          | Target    | Window | Error budget |
|-----|----------------------------------------------|-----------|--------|--------------|
| A1  | `Port::connect` returns `Ok(_)` rate         | ≥ 99.95 % | 30 d   | 0.05 % (≈ 22 min / 30 d) |
| A2  | `Port::disconnect` returns `Ok(_)` rate      | ≥ 99.9 %  | 30 d   | 0.1 % (≈ 43 min / 30 d) |
| A3  | `Port::health` returns `Ok(_)` rate          | ≥ 99.95 % | 30 d   | 0.05 % (≈ 22 min / 30 d) |
| A4  | `HexCachePort::get/set/del` success rate     | ≥ 99.9 %  | 30 d   | 0.1 % (≈ 43 min / 30 d) |

**Rationale.** `connect()` is the substrate's hot path — every long-lived
service call enters through it. A 99.95 % target gives 22 minutes of
downtime budget per 30-day window, which is the fleet-wide reference
substrate floor (ADR-023 Rule 3.1 quality bar). `disconnect()` is
fire-and-forget; its target matches the fleet floor. `HexCachePort` is the
fleet-shared cache adapter (`RedisAdapter`); its budget is the same as the
transport layer because a cache miss is recoverable but a transport
connect failure is not.

**Measurement.** Each trait method emits a span with
`otel.portadapter.<method>.result = OK|ERROR` and the typed
`AdapterError` variant on the `error.type` attribute. The check script
queries the OTLP collector for the past 28 days and computes the success
ratio per trait method.

---

## 2. Latency targets (per-call)

All latency targets are measured **inside the trait method body**, exclusive
of network round-trip time and serialization overhead.

| ID  | SLI                                          | p50     | p95     | p99     | Window | Error budget |
|-----|----------------------------------------------|---------|---------|---------|--------|--------------|
| L1  | `Port::connect` wall-clock (`TcpAdapter`)    | ≤ 5 ms  | ≤ 20 ms | ≤ 50 ms | 30 d   | 5 % above p95 |
| L2  | `Port::connect` wall-clock (`UnixAdapter`)   | ≤ 1 ms  | ≤  3 ms | ≤  8 ms | 30 d   | 5 % above p95 |
| L3  | `Port::connect` wall-clock (`RedisAdapter`)  | ≤ 3 ms  | ≤ 10 ms | ≤ 30 ms | 30 d   | 5 % above p95 |
| L4  | `Port::disconnect` wall-clock                | ≤ 1 ms  | ≤  3 ms | ≤ 10 ms | 30 d   | 5 % above p95 |
| L5  | `Port::health` wall-clock                    | ≤ 0.5 ms | ≤ 2 ms | ≤ 5 ms | 30 d   | 5 % above p95 |
| L6  | `HexCachePort::get` wall-clock (`Redis`)     | ≤ 1 ms  | ≤  5 ms | ≤ 15 ms | 30 d   | 5 % above p95 |
| L7  | `HexCachePort::set` wall-clock (`Redis`)     | ≤ 2 ms  | ≤  8 ms | ≤ 20 ms | 30 d   | 5 % above p95 |

**Rationale.** TCP `connect()` includes a 3-way handshake; the p95 budget
of 20 ms assumes a healthy network with no packet loss. Unix-domain
sockets are local IPC and an order of magnitude faster. `RedisAdapter`
goes through `redis-rs::connection_manager` and is dominated by the
auto-reconnect path; its budget sits between TCP and Unix. `health()` is
a `PING`-equivalent and must be cheap because it runs every 5 s on every
adapter in the fleet.

**Measurement.** Latencies come from the
`otel.portadapter.<method>.duration_ms` span attribute, captured at the
start and end of each trait method body.

---

## 3. Error rate target

| ID  | SLI                                          | Target   | Window | Error budget |
|-----|----------------------------------------------|----------|--------|--------------|
| E1  | `AdapterError::ConnectFailed` rate           | ≤ 0.1 %  | 30 d   | 10 % above |
| E2  | `AdapterError::HealthCheckFailed` rate       | ≤ 0.05 % | 30 d   | 10 % above |
| E3  | `AdapterError::Timeout` rate                 | ≤ 0.5 %  | 30 d   | 10 % above |
| E4  | `AdapterError::DisconnectFailed` rate        | ≤ 0.1 %  | 30 d   | 10 % above |
| E5  | Aggregate error rate (all variants)          | ≤ 0.5 %  | 30 d   | 10 % above |

**Rationale.** 0.1 % is the fleet substrate floor for hard connection
errors (matches `pheno-otel` § 3 E1). `Timeout` is allowed a wider budget
because timeouts are expected during congestion; the goal is bounded
timeout, not zero timeout. The aggregate rate catches adapter-specific
drift that the per-variant rows might miss.

**Measurement.** `AdapterError` variants are mapped to the OTel
`error.type` attribute per the OTel semantic conventions
(`error.type = "AdapterError::ConnectFailed"` etc.). The script counts
variant occurrences per total trait-method call over the 28-day window.

---

## 4. Throughput target

| ID  | SLI                                          | Target           | Window | Notes |
|-----|----------------------------------------------|------------------|--------|-------|
| T1  | Sustained `connect` calls / second / process | ≥ 5,000          | 30 d   | Single-process, `TcpAdapter` |
| T2  | Burst `connect` calls / second / process     | ≥ 20,000         | 30 d   | Burst window: ≤ 10 s sustained |
| T3  | Concurrent active `Connection` handles       | ≤ 50,000         | 30 d   | Soft cap; load-shed at 65,000 |
| T4  | `HexCachePort::get` / second / process       | ≥ 50,000         | 30 d   | `RedisAdapter`, no network tail |
| T5  | `HexCachePort::set` / second / process       | ≥ 20,000         | 30 d   | `RedisAdapter`, no network tail |

**Rationale.** 5k `connect`/s sustained matches the `pr-bench` profile for
`TcpAdapter`; 20× burst for ≤ 10 s matches the chaos-test
`tests/chaos_connect_to_unroutable.rs` upper bound. The 65k hard cap gives
the substrate 30 % headroom before the `Degraded → Failed` state fires
(see `docs/architecture.md` state diagram). Cache throughput is
dominated by `redis-rs` batch-pipeline behavior; the `get` / `set`
asymmetry reflects the `SETEX` overhead vs. plain `GET`.

**Measurement.** Throughput is derived from the
`otel.portadapter.<method>.count` counter and the
`otel.portadapter.active_connections` gauge (sampled every 10 s).

---

## 5. Burn-rate alerts

Burn-rate alerts follow the Google SRE Workbook multi-window methodology.
The error budget for any 30-day SLO above is **0.05** (A1, A3) or **0.1**
(A2, A4, all error-rate rows); the burn rate is the ratio of observed
bad-event rate to the budget.

| Alert ID | Window                | Burn-rate threshold | Action |
|----------|-----------------------|---------------------|--------|
| BR-1     | 1 h fast burn         | ≥ 14.4× (consumes 100 % budget in 2 d) | Page on-call (P2) |
| BR-2     | 6 h fast burn         | ≥  6.0× (consumes 100 % budget in 5 d) | Page on-call (P3) |
| BR-3     | 24 h slow burn        | ≥  3.0× (consumes 100 % budget in 10 d) | Slack `#port-adapter-alerts` |
| BR-4     | 3 d slow burn         | ≥  1.0× (consumes 100 % budget in 30 d) | Ticket; weekly review |
| BR-5     | Latency p95 spike     | ≥  2.0× p95 budget for 15 min | Page on-call (P3) |
| BR-6     | Chaos-test fail-rate  | ≥ 5 % `tests/chaos_*` failures for 1 d  | Slack `#chaos-alerts` |

**Why these numbers.** BR-1 (14.4× over 1 h) is the standard SRE Workbook
fast-burn threshold — at that rate, the entire 30-day budget is exhausted
in 2 days, so paging is mandatory. The tighter `connect()` budget (A1,
A3) means the BR-1 threshold is correspondingly higher in absolute terms;
the multiplier is held constant to align with `pheno-otel` and
`pheno-mcp-router` SLOs (uniform fleet behavior).

**Alert routing.** Defined in `phenoObservability/alerts/pheno-port-adapter.yml`
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
./scripts/slo-check.sh pheno-port-adapter

# Custom window + endpoint
./scripts/slo-check.sh pheno-port-adapter --window-days 28 --endpoint http://otel-collector:4318
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

- **ADR-038** — Hexagonal L4 Port/Adapter policy (this substrate is the
  reference implementation).
- **ADR-014** — earlier hexagonal port-adapter L4 decision.
- **ADR-012** / **ADR-036B** — `pheno-tracing` canonical (sibling
  observability substrate).
- **ADR-037** — `pheno-otel` canonical (this substrate emits OTLP spans
  via `pheno-otel`).
- **ADR-023** — Agent-effort governance (substrate quality bar, Rule 3.1).
- **ADR-040** — Test coverage gates per tier (80 % lib).
- **ADR-041** — 71-pillar refresh cadence (weekly Monday 09:00 PDT cron).
- **ADR-042** — Security audit cadence (companion to SLO cadence).
- **ADR-046** — Federation mTLS + OIDC (alert routing).
- `pheno-port-adapter/SPEC.md` — substrate spec.
- `pheno-port-adapter/docs/architecture.md` — C4 + state diagrams + KD-1..KD-9.
- `pheno-port-adapter/CHANGELOG.md` — release history.
- `pheno-port-adapter/tests/chaos_*` — L11 anti-fragility tests (BR-6).
- `scripts/slo-check.sh` — compliance check implementation.
- `findings/2026-06-22-V21-T5-slo-definition.md` — fleet-wide SLO rollup.