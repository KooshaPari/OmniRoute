# Backend Setup — Jaeger / Tempo / Honeycomb / Datadog

> **Audience:** operators wiring OmniRoute's OTel Collector (PR-010) to a
> real trace / metrics backend. Pick one (or stack several) — the collector
> can fan out to all four simultaneously.

The collector is **backend-agnostic**. You enable a backend by setting the
relevant env var in `deploy/otel-collector/.env` and restarting the stack.

---

## 1. Jaeger (local / OSS)

Best for: development, on-prem, no vendor lock-in. Self-hostable, no API key.

### Local (docker-compose)

Already included — `make up` starts Jaeger alongside the collector. UI at
<http://localhost:16686>. No env vars to set; the collector defaults to
`jaeger:4317` on the shared docker network.

### Production (single binary)

```bash
# On a Linux host with Docker
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4317:4317 \
  -p 4318:4318 \
  -p 14250:14250 \
  -p 14268:14268 \
  jaegertracing/all-in-one:1.55.0
```

Point the collector at it:

```bash
export JAEGER_ENDPOINT=jaeger.internal:4317
```

### Production (Kubernetes)

Use the [Jaeger Operator](https://www.jaegertracing.io/docs/1.55/operator/):

```bash
kubectl create namespace observability
kubectl create -f https://github.com/jaegertracing/jaeger-operator/releases/download/v1.55.0/jaeger-operator.yaml -n observability
kubectl apply -f - <<EOF
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: omniroute
  namespace: observability
spec:
  strategy: production
  storage:
    type: elasticsearch
    options:
      es:
        server-urls: http://elasticsearch:9200
EOF
```

Then:

```bash
export JAEGER_ENDPOINT=omniroute-collector.observability.svc:4317
```

UI: port-forward `kubectl port-forward svc/omniroute-query 16686:16686 -n
observability` → <http://localhost:16686>.

---

## 2. Grafana Tempo (Grafana Cloud or self-hosted)

Best for: traces + metrics + logs unified in Grafana; cost-effective OSS.

### Grafana Cloud (managed)

1. Sign up at <https://grafana.com/products/cloud/> (free tier: 50 GB traces,
   14-day retention).
2. Open **Grafana → Drilldown → Tempo → Overview** to get your endpoint.
3. Generate an API token in **Grafana → Administration → API keys**.
4. Set:

```bash
export TEMPO_ENDPOINT=https://tempo-us-central1.grafana.net:443
export OTEL_EXPORTER_OTLP_HEADERS="authorization=Basic <base64(instance_id:api_key)>"
```

### Self-hosted (docker-compose)

```yaml
services:
  tempo:
    image: grafana/tempo:2.5.0
    command: ["-config.file=/etc/tempo.yaml"]
    volumes:
      - ./tempo.yaml:/etc/tempo.yaml:ro
      - tempo-data:/var/tempo
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
```

Minimal `tempo.yaml`:

```yaml
server:
  http_listen_port: 3200
distributor:
  receivers:
    otlp:
      protocols:
        grpc: { endpoint: 0.0.0.0:4317 }
        http: { endpoint: 0.0.0.0:4318 }
storage:
  trace:
    backend: local
    local:
      path: /var/tempo/traces
```

Then:

```bash
export TEMPO_ENDPOINT=http://tempo:4318
```

Wire Grafana → Tempo datasources → query traces by `service.namespace =
omniroute`.

---

## 3. Honeycomb (managed SaaS)

Best for: high-cardinality search, debugging-specific tracing features
(groups, board views, BubbleUp).

### Setup

1. Sign up at <https://www.honeycomb.io/> (free tier: 20 M events/month).
2. **Account → Team settings → API keys → Create key**. Copy the
   `hcabc_xxx...` token.
3. Pick a dataset name (e.g. `omniroute-prod`, `omniroute-staging`).
4. Set:

```bash
export HONEYCOMB_API_KEY=hcabc_xxx
export HONEYCOMB_DATASET=omniroute-prod
```

### Verify

After the collector restarts:

1. Send a test span from OmniRoute.
2. Open Honeycomb → `omniroute-prod` dataset → **Query**.
3. Run `WHERE service.namespace = "omniroute"`. You should see spans within
   ~30s of sending.

### Sampling note

Honeycomb charges per **retained** event. The collector's tail sampler
defaults to 10% baseline — at 1000 spans/sec OmniRoute will retain ~100/sec,
plus 100% of errors / slow spans. Tune via `SAMPLING_PROBABILITY`.

---

## 4. Datadog (managed SaaS)

Best for: full-stack APM (traces + metrics + logs + RUM in one pane).

### Setup

1. Sign up at <https://www.datadoghq.com/> (free 14-day trial; then paid).
2. **Organization Settings → API Keys → New Key**. Copy the
   `dd_api_xxx...` token.
3. Set:

```bash
export DATADOG_API_KEY=dd_api_xxx
export DATADOG_SITE=datadoghq.com   # or datadoghq.eu, us3.datadoghq.com, etc.
```

The collector routes to `https://otlp.${DATADOG_SITE}` automatically
(HTTP OTLP, gzip-compressed).

### Verify

1. Open Datadog → **APM → Traces**. Select `service:omniroute`.
2. Open **Metrics → Explorer**, query `omniroute_request_duration_seconds`.

### Notes

- Datadog's OTLP ingest is **beta** — set `OTEL_EXPORTER_OTLP_HEADERS=dd-api-key=<key>`
  on OmniRoute's runtime env too if you want to bypass the collector.
- For EU customers, use `DATADOG_SITE=datadoghq.eu` — the exporter adjusts
  the endpoint to `https://otlp.datadoghq.eu`.

---

## 5. Prometheus remote-write (metrics-only)

The collector writes metrics to any Prometheus remote-write endpoint
(including Grafana Cloud Metrics, Mimir, Cortex, Thanos).

```bash
export PROMETHEUS_REMOTE_WRITE_URL=https://prometheus-prod-01-eu-west-0.grafana.net/api/v1/write
export OTEL_EXPORTER_OTLP_HEADERS="authorization=Basic <base64(user:api_key)>"
```

Verify with:

```bash
curl -X POST https://prometheus.example.com/api/v1/write \
  -H "authorization: Basic ..." \
  --data-binary "test_metric 1.0"
```

---

## 6. Stack multiple backends

The collector ships with **all four OTLP exporters pre-wired** plus
`prometheusremotewrite`. Set the env vars for the ones you want and leave
the others unset — the empty exporters no-op silently.

```bash
# Send traces to BOTH Jaeger AND Honeycomb, metrics to Grafana Cloud
export JAEGER_ENDPOINT=jaeger.internal:4317
export HONEYCOMB_API_KEY=hcabc_xxx
export HONEYCOMB_DATASET=omniroute-prod
export PROMETHEUS_REMOTE_WRITE_URL=https://prometheus.grafana.net/api/v1/write
make up
```

The `loadbalancing` processor routes traces round-robin across OTLP backends
for redundancy (Jaeger first, then Tempo, then Honeycomb, then Datadog).

---

## 7. Verifying end-to-end

After deploying a backend:

```bash
# 1. Send a synthetic request through OmniRoute
curl -X POST http://localhost:20128/v1/chat/completions \
  -H "authorization: Bearer test" \
  -H "content-type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}'

# 2. Confirm collector received the span
curl -s http://localhost:8888/metrics | grep otelcol_receiver_accepted_spans

# 3. Confirm exporter succeeded (look for "exported" counter)
curl -s http://localhost:8888/metrics | grep otelcol_exporter_sent_spans

# 4. Check the backend UI (Jaeger UI, Honeycomb query, Datadog APM, etc.)
```

---

## Cost-control checklist

| Backend     | Free tier                  | What costs money                | How to control                       |
|-------------|----------------------------|----------------------------------|--------------------------------------|
| Jaeger      | Self-host = free           | Storage, egress                  | Bound retention in Jaeger config     |
| Tempo       | 50 GB / 14d (Grafana)      | Storage, query volume            | Lower `SAMPLING_PROBABILITY`         |
| Honeycomb   | 20 M events / month        | Per-retained-event               | Tune baseline; exclude probes        |
| Datadog     | 14-day trial               | Per-host + per-span              | Use `probabilistic_baseline` ≤ 5%    |
| Prom R/W    | 10k series (Grafana)       | Active series                    | Drop unused labels in Prom config    |

Default `SAMPLING_PROBABILITY=10` keeps most backends comfortably within
free tier for a single-tenant OmniRoute install. Scale the value down
linearly with throughput:

- < 100 spans/sec → 100% (keep everything)
- 100–1000 spans/sec → 10% baseline (default)
- 1k–10k spans/sec → 1% baseline + errors / slow always retained
- > 10k spans/sec → consider self-hosting Jaeger or Tempo

---

## See also

- [03-otel-collector.md](./03-otel-collector.md) — collector architecture
- [01-quickstart.md](./01-quickstart.md) — OmniRoute runtime OTel SDK setup