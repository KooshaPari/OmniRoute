# v27-T3: L25 OTel Exemplars Spec

**Pillar:** L25 — OTel exemplars (2.0 → 2.5, cycle-17 P0)
**Owner:** orch-v27
**Effort:** 1h (30 min spec + 30 min code in next turn)

## Why

OTel exemplars link metrics to traces by attaching `SpanContext` (trace_id,
span_id) to metric data points. Without exemplars, a p95 latency spike cannot
be traced back to the specific request that caused it — you get «measurement
without causality». This is pillar L25 scoring 2.0/3.

## What to build

1. **Wire `pheno-otel` trace provider to exemplar reservoir** — when emitting
   histogram/last-value instruments, attach the current `SpanContext` from
   the active tracing span. The standard OTel SDK exemplar reservoir
   (`SimpleFixedSizeExemplarReservoir`) stores 1 exemplar per metric point.

2. **CI validation** — `tools/otel-exemplar-check/check.py` verifies that
   every histogram/low-cardinality instrument in the crate has an exemplar
   reservoir configured. Fails if >10% of instruments lack exemplars.

3. **Grafana panel** — add an «Exemplar» panel template to the golden-signal
   dashboard. One click per chart.

## Key files

| File | Purpose |
|---|---|
| `tools/otel-exemplar-check/check.py` | CI gate |
| `findings/2026-06-25-v27-T3-otel-exemplar-check.md` | This spec |
| `docs/conventions/otel-exemplar-convention.md` | Adoption guide |

## Acceptance criteria

- [ ] `tools/otel-exemplar-check/check.py` runs against 3 pilot crates
- [ ] Output shows per-instrument exemplar status
- [ ] Exit code 0 only when coverage >=90%
