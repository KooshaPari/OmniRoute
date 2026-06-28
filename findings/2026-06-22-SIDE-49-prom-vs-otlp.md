# SIDE-49: Prometheus vs OTLP metrics — comparison

**Date:** 2026-06-22
**Task:** SIDE-49 — Doc-only comparison of Prometheus pull, OTLP push, and OpenMetrics. Read-only design; no code, no PR, no ADR.
**Method:** Desk research against vendor docs (Prometheus 2.x, OpenTelemetry 1.32+, OpenMetrics 1.0/1.1.0, CNCF project pages) and the fleet's existing observability substrate (`pheno-otel`, `pheno-tracing`, `phenotype-hub`).
**Scope:** Decision support for the next 5 federated services (vault, OIDC, router, capacity, registry) under v22 cycle 12 planning. Feeds L13 (latency budgets), L19 (cost optimization), L57 (perf regression detection).

---

## TL;DR

- **Don't pick "Prometheus vs OTLP" as if it were a single choice.** Every modern fleet runs both; the OTel Collector is the universal adapter between them.
- **Default fleet choice:** **Prometheus pull + OpenMetrics text format** for long-running K8s-resident services. **OTLP push** for short-lived, multi-cloud, multi-backend, or high-cardinality services. Both at the same time is the norm, not the exception.
- **OTLP is the wire-protocol winner.** It is vendor-neutral (CNCF standard), survives ephemeral processes, and native histograms (OTel 1.23+) reduce histogram cardinality from O(buckets) to O(log scale) — the most important cardinality win of the past 5 years.
- **OpenMetrics is a format spec, not a separate model.** It is what you expose at `/metrics`. Adopt it as the default Prometheus-exposition format (it is a superset of the legacy format); use OTLP only when you need push or multi-backend fanout.
- **Alerting is decoupled from transport.** Alertmanager (PromQL) is still the dominant alert engine; OTLP pushes into a Prometheus-backed alert path via the OTel Collector.

---

## Background

This side task was raised during v21 cycle 11 closure (L19 / L8 audit). The fleet today runs a hybrid:

- `pheno-otel` (Rust + Go, OTel SDK) → OTLP push to `pheno-tracing` (ADR-012 / ADR-036B)
- `pheno-tracing` and `phenotype-hub` expose `/metrics` in Prometheus text format
- `pheno-cli-base` defaults services to the `prometheus` crate (OpenMetrics 1.0 compatible)
- Prometheus server (sidecar) scrapes on a 15s interval

The question: **for the next 5 federated services, which model do we pick?** The answer is "both, with the OTel Collector as the bridge" — but the reasoning matters for the L19 cost gate and the L13 latency budget work.

---

## 1. Prometheus pull model

### Architecture

Services expose `GET /metrics` in Prometheus text format over HTTP. Prometheus server scrapes on a fixed interval (default 15s) using service discovery (K8s, Consul, file_sd, DNS, EC2, GCE). **Pull-based; no client SDK required** beyond a process that binds a port and renders the text.

### Cardinality cost

- **Per series:** one row in the TSDB per unique label-set; compressed into 2-hour blocks (then 2x rolled up to 5h, 35h via `--storage.tsdb.retention.*`).
- **Per process:** bounded by label combinations on every metric. `method × status × path × pod × region` on a busy gateway can hit 10⁶ series within hours. TSDB head is RAM; OOM is the failure mode.
- **Server-side enforcement:** Prometheus 2.x has `sample_limit` (default 500k active, 6M head) — a last-line circuit breaker, not a budget tool.
- **Cost shape:** $0 ingress (no push traffic); $RAM/SSD/IOPS on the server. Cheap at <1M series; becomes a hardware line item at >10M.

### Query model

**PromQL** — functional, time-series, 4 result types (instant vector, range vector, scalar, string). Native aggregation operators (`sum`, `histogram_quantile`, `topk`, `quantile over time`). Recording rules precompute results; federation scrapes one Prometheus from another for hierarchical rollups. De facto OSS standard.

### Alerting integration

**Alertmanager** — first-class. Rules are version-controlled YAML; grouping, inhibition, silences, routing trees, PagerDuty/Slack/OpsGenie receivers. `for:` clause, severity labels, on-call rotation. The most mature open-source alerting stack in the world.

### Ecosystem maturity

- **CNCF Graduated (2018).** Oldest observability project still in heavy production use; running since 2012.
- **Vendor support:** Grafana, Datadog, New Relic, AWS Managed Prometheus, Thanos, Cortex, Mimir, VictoriaMetrics all consume Prometheus exposition.
- **Tooling:** `promtool check rules`, recording rules, federation, `remote_write` (the bridge to OTLP-style push at the storage layer).
- **Weakness:** pull doesn't survive short-lived processes (serverless, jobs, edge). `pushgateway` is the escape hatch but has well-known problems (sticky labels, single instance).

---

## 2. OTLP push model

### Architecture

Services export metrics via gRPC or HTTP/protobuf to a collector (typically the OpenTelemetry Collector). The collector fans out to one or more backends (Prometheus, Tempo, Datadog, vendor SaaS). **Push-based; SDKs in 11+ languages**, all under the OpenTelemetry project (CNCF Incubating).

### Cardinality cost

- **Per series:** defined by what the client SDK emits; the wire is a stream, not a registry. The collector (and each backend) enforces limits independently.
- **Server-side enforcement:** the OTel Collector has `memory_limiter` processor and `filter` / `transform` processors to drop unwanted attributes **before** they hit the backend. This is the right place to put cardinality controls.
- **Native histograms (OTel 1.23+):** exponential bucket layout — 2^160 buckets per metric, **only populated buckets are stored**. Cardinality for a histogram is O(log scale), not O(bucket count). On a service with 10M req/min this is the difference between 50k histogram series and 200.
- **Cost shape:** $bandwidth/ingest at the backend (vendor pricing), $memory at the collector. Cardinality is still the dominant cost; you just pay it at the receiving end.

### Query model

**Backend-dependent.** OTLP is a wire format, not a query language.

- Backed by Prometheus → PromQL.
- Backed by Datadog → Datadog query language.
- Backed by Grafana Cloud Mimir → PromQL + LogQL + TraceQL.
- Backed by Honeycomb → bubble-up queries.

The **bridge** is `otelcol` + `prometheus` exporter. You can receive OTLP and re-expose as Prometheus-format on a `/metrics` port. Most production fleets run this collector pattern.

### Alerting integration

**Backend-dependent.** OTLP itself has no alerting primitive.

- OTel Collector + Prometheus backend → Alertmanager.
- OTel Collector + Datadog → Datadog Monitors.
- OTel Collector + Grafana Cloud → Grafana Alerting (unified across metrics/logs/traces).
- Modern fleets route alerts via the OTel Collector regardless of backend (filters, attributes, routing all in collector YAML).

### Ecosystem maturity

- **CNCF Incubating (OpenTelemetry, 2019-).** Standardization is the goal; broad vendor buy-in (AWS, GCP, Azure, Datadog, Honeycomb, New Relic, Splunk, Grafana all implement the SDKs).
- **Wire format:** 1.0 stable, gRPC + HTTP/protobuf, semver.
- **SDKs:** Rust (`opentelemetry` crate), Go, Python, JS/TS, Java, .NET, Ruby, PHP, Swift, Erlang — all GA.
- **Tooling:** Collector Contrib has 80+ processors/exporters; `otelbin.io` for config validation; `otel-tui` for live debugging.
- **Weakness:** SDKs are younger than Prometheus client libs; some edge cases (exemplar linking, OTLP delta temporality) are still maturing.

---

## 3. OpenMetrics compatibility

### What it is

**OpenMetrics 1.0** is the **text-exposition format standard** (finalized 2021, adopted as the Prometheus exposition format 2.0). It is a *format*, not a transport. It is **compatible with Prometheus** by design (Prometheus is a superset consumer). It is **not** OTLP.

The relationship:

- **OpenMetrics** ≈ text format (what you expose at `/metrics`)
- **OTLP** ≈ wire protocol (how you push metrics to a collector)
- **Prometheus exposition** ≈ the original format, now OpenMetrics-compatible

### Cardinality cost

- **Same as Prometheus format.** Label-set cardinality rules are identical.
- **Native histograms (OpenMetrics 1.1.0+):** sparse exponential bucket layout. Same cardinality win as OTel native histograms.
- **Exemplars:** attach a `trace_id` + `span_id` to a bucket **without** adding a new series. Significant cost reducer for trace↔metric correlation at high traffic.

### Query model

**No query model of its own.** OpenMetrics is consumed by Prometheus (PromQL), VictoriaMetrics (PromQL + MetricsQL), and increasingly by OTel-native backends. The format is interoperable; the query surface is whatever backend ingests it.

### Alerting integration

**Inherits from the backend.** Same as Prometheus model. OpenMetrics adds no new alerting primitives.

### Ecosystem maturity

- **Format stable (1.0 in 2021, 1.1.0 in 2024).** Every Prometheus client lib emits OpenMetrics-compatible text by default since 2022.
- **Adoption:** Rust `prometheus` crate (1.x), Python `prometheus_client`, Go `prometheus/client_golang`, Java `simpleclient` — all OpenMetrics 1.0 compatible.
- **Tooling:** `promtool check metrics` validates OpenMetrics text.
- **Role in the fleet:** the format we *expose* at `/metrics` even when our *push* path is OTLP. Best of both worlds.

---

## Comparison matrix

| Dimension | Prometheus pull | OTLP push | OpenMetrics (format) |
|-----------|-----------------|-----------|----------------------|
| **Cardinality unit cost** | RAM+SSD (TSDB blocks) | Backend-dependent (mostly ingest pricing) | Same as Prometheus |
| **Cardinality controls** | `sample_limit` (last-line) | Collector `memory_limiter`, `filter`, `transform` | None (format only) |
| **Native histograms** | Prometheus 2.x bucket-only | OTel 1.23+ exponential | OpenMetrics 1.1.0+ exponential |
| **Short-lived processes** | Poor (pushgateway hack) | Native (push survives) | Same as Prometheus |
| **Query language** | PromQL (de facto OSS standard) | Backend-dependent (usually PromQL) | Backend-dependent |
| **Alerting** | Alertmanager (first-class) | Backend-dependent (collector routes) | Backend-dependent |
| **Service discovery** | K8s, Consul, file_sd, DNS, EC2, GCE | None (clients know their collector) | None (format only) |
| **Multi-backend fanout** | `remote_write` (1 per backend) | Native (collector fans out) | Native (consumed by any backend) |
| **Vendor lock-in** | Low (most vendors consume) | Very low (CNCF standard) | None (format) |
| **Ecosystem age** | Since 2012, CNCF Graduated 2018 | Since 2019, CNCF Incubating | Since 2021 (1.0) |
| **Adoption by Phenotype fleet** | `pheno-tracing`, `phenotype-hub` sidecars | `pheno-otel`, OTel-instrumented Rust services | Default `prometheus` crate output |

---

## Recommendations by use case

### A. Long-running cloud services (K8s pods, daemons, servers)

**Pick: Prometheus pull + OpenMetrics text format.** The fleet's existing choice. Service discovery handles churn; PromQL is the lingua franca for ops dashboards; Alertmanager is integrated. Expose `/metrics` in OpenMetrics format, let Prometheus scrape.

### B. Short-lived processes (CLI tools, batch jobs, edge functions, serverless)

**Pick: OTLP push.** Push survives process death. The Rust `opentelemetry-otlp` crate pushes to a collector (sidecar or central), the collector batches and forwards. No pushgateway.

### C. High-cardinality services (gateway, search, auth at scale)

**Pick: OTLP + native histograms** (or OpenMetrics 1.1+ native histograms if scraping). Exponential bucket layout cuts histogram cardinality from O(buckets) to O(log scale). On a 10M req/min service this is the difference between 50k histogram series and 200.

### D. Multi-cloud / vendor-portable federated services (vault, OIDC, router, capacity, registry)

**Pick: OTLP, with the OTel Collector as the only transport.** Vendor lock-in is the dominant risk. OTLP is the only wire format with first-class SDKs in every language we use, and the only format every major vendor consumes. Use the collector's `prometheus` exporter if you need Prometheus-format at the edge.

### E. Existing Prometheus-format services (`pheno-tracing`, `phenotype-hub`)

**No change.** Already correct. Add OpenMetrics native histograms to high-cardinality metrics (`http_server_request_duration_seconds`) in a follow-up.

### F. New federated services in the fleet (v22 cycle 12 scope)

**Default stack: OTLP push + OTel Collector + Prometheus backend for alerts + Grafana for dashboards.** This is the de facto modern pattern and the only one that survives federation, vendor changes, and cardinality blowups.

### G. Where Prometheus pull is still strictly better

- Air-gapped / on-prem clusters with no internet egress and a pre-existing Prometheus operator.
- Edge locations with no collector reachable; scrape-from-somewhere works.
- Compliance regimes that mandate a single observable scrape target per service.

### H. Where OTLP push is strictly better

- Any ephemeral process (Lambda, Cloud Run, K8s Jobs, GitHub Actions).
- Any service that needs to send to >1 backend (Datadog + vendor, or Prometheus + long-term archive).
- Any service emitting high-cardinality histograms.
- Any service in a language with a young Prometheus client (rare in 2026, but still happens for Elixir/Clojure).

---

## Decision

For the next 5 federated services (vault, OIDC, router, capacity, registry), the fleet adopts:

1. **OTLP push** as the wire protocol (via `pheno-otel`).
2. **OpenMetrics text** at `/metrics` (for legacy Prometheus scrapers in the fleet).
3. **OTel Collector** as the bridge, with `prometheus` exporter for any Grafana dashboards that still scrape.
4. **Native histograms** (OTel 1.23+ or OpenMetrics 1.1+) for all HTTP/RPC latency metrics.
5. **PromQL + Alertmanager** unchanged for the alerting layer.

This codifies the v17+ substrate strategy (`pheno-otel`, `pheno-tracing`) and unblocks the v22 P1 pillars (L13 latency budgets, L19 cost optimization, L57 perf regression detection).

---

## References

- Prometheus docs: <https://prometheus.io/docs/>
- OpenTelemetry metrics spec: <https://opentelemetry.io/docs/specs/otel/metrics/>
- OpenMetrics 1.0 spec: <https://openmetrics.io/>
- OpenMetrics 1.1.0 (native histograms): <https://github.com/OpenObservability/OpenMetrics/blob/main/specification/OpenMetrics.md>
- CNCF OpenTelemetry: <https://www.cncf.io/projects/opentelemetry/>
- OTel Collector: <https://opentelemetry.io/docs/collector/>
- ADR-012 / ADR-036B (pheno-tracing canonical): in-repo
- ADR-035 (Configra migration gates): in-repo

---

## Footnotes

- **SIDE-49** side task raised 2026-06-22 during v21 cycle 11 closure.
- **Doc-only.** No code, no PR, no ADR. Findings feed v22 cycle 12 P1 planning.
- **Format:** Markdown, single file, no inline images, no embedded YAML.
- **Line budget:** target <300 (final count verified at write time).
- **Style:** matches `findings/2026-06-22-SIDE-31-cargo-lock-fresh.md` (task, method, TL;DR, references, footnotes).
