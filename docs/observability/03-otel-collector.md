# OpenTelemetry Collector Sidecar — PR-010

> **Status:** shipped in `koosha/feat/sprint-pr010-collector` (PR-010 of the 100-PR roadmap).
> **Image:** `otel/opentelemetry-collector-contrib:0.110.0`
> **Validator:** `scripts/validate-otel-collector.mjs` (runs in CI + `make lint`).

This page is the operator-facing guide for the OmniRoute observability
**sidecar**. It assumes you've already read
[01-quickstart.md](./01-quickstart.md) — the OTel SDK + Pino + Prometheus
metrics are wired in the OmniRoute runtime; this collector is the next hop.

---

## Architecture

```
                         ┌────────────────────────────────────────────────────┐
                         │           OmniRoute runtime (Node.js)             │
                         │  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  │
                         │  │ Pino logger │  │ OTel SDK     │  │ Prom reg │  │
                         │  └──────┬──────┘  └──────┬───────┘  └────┬─────┘  │
                         │         │                │               │        │
                         │  OTLP   ▼      OTLP/gRPC │   /metrics    ▼        │
                         │     (logs)              ▼      (HTTP scrape)     │
                         └─────────────┬─────────────────────┬──────────────┘
                                       │                     │
                                       ▼                     ▼
                         ┌────────────────────────────────────────────────────┐
                         │     otel-collector (sidecar) — PR-010 config      │
                         │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
                         │  │ OTLP receive │  │ prometheus   │  │ filelog  │  │
                         │  │ :4317 + 4318 │  │   scrape     │  │  tail    │  │
                         │  └──────┬───────┘  └──────┬───────┘  └─────┬────┘  │
                         │         └──────────────────┼────────────────┘       │
                         │                            ▼                        │
                         │   ┌────────────────────────────────────────┐        │
                         │   │  memory_limiter → attributes/redact     │        │
                         │   │   → resource → attributes/cost          │        │
                         │   │   → filter/health → tail_sampling       │        │
                         │   │   → batch                               │        │
                         │   └─────────────┬──────────────────────────┘        │
                         │                 ▼                                   │
                         │   ┌──────────────────────────────────────────┐     │
                         │   │ loadbalancing → { Jaeger, Tempo,         │     │
                         │   │   Honeycomb, Datadog }                   │     │
                         │   │ prometheusremotewrite (metrics)          │     │
                         │   │ file (JSONL debug sink)                  │     │
                         │   └──────────────────────────────────────────┘     │
                         └────────────────────────────────────────────────────┘
                                            │              │              │
                                            ▼              ▼              ▼
                                      ┌──────────┐  ┌──────────┐  ┌────────────┐
                                      │  Jaeger  │  │  Tempo   │  │ Honeycomb  │
                                      │  :4317   │  │  :4318   │  │  api.*     │
                                      └──────────┘  └──────────┘  └────────────┘
```

The collector runs **out-of-process** (sidecar / DaemonSet / Deployment) and
forwards traces, metrics, and logs to **one or more** backends. Operators can
flip the backend switch by setting a single env var — no code change.

---

## Quickstart (local)

```bash
cd deploy/otel-collector
cp .env.example .env
# edit .env to fill at least OTEL_AUTH_TOKEN; leave the rest commented for now
make up        # docker compose stack: collector + Jaeger + Prometheus + Grafana
make logs      # tail collector stdout
make down      # stop everything
```

After `make up`:

| Service        | URL                          | Notes                              |
|----------------|------------------------------|------------------------------------|
| OTLP gRPC      | `localhost:4317`             | primary ingest from OmniRoute      |
| OTLP HTTP      | `localhost:4318`             | primary ingest from OmniRoute      |
| Health check   | `http://localhost:13133/`    | returns 200 when collector healthy |
| Self metrics   | `http://localhost:8888/metrics` | Prometheus-format                |
| Jaeger UI      | `http://localhost:16686/`    | trace search                       |
| Prometheus UI  | `http://localhost:9090/`     | metric query                       |
| Grafana UI     | `http://localhost:3000/`     | anonymous admin, dashboards        |

OmniRoute runtime env vars to start sending telemetry:

```bash
export OMNIROUTE_TELEMETRY_ENABLED=true
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_EXPORTER_OTLP_HEADERS="authorization=Bearer changeme-otel-token"
```

---

## Pipeline anatomy

Every pipeline runs `memory_limiter → resource detection → resource enrichment
→ signal-specific processors → batch → exporters`. This ordering is enforced
by `scripts/validate-otel-collector.mjs` (PR-010 hard rule):

- **`memory_limiter` first** — refuses new data above the RAM budget so the
  collector never OOMs the host.
- **`attributes/redact` before `tail_sampling`** — secrets are stripped from
  the trace before the sampler decides what to keep (otherwise we might
  sample and persist a credential by accident).
- **`batch` last** — accumulates before export to amortize outbound cost.

### Trace pipeline

| Stage            | Purpose                                                     |
|------------------|-------------------------------------------------------------|
| `otlp`           | gRPC + HTTP receivers (max 16 MiB body, keepalive enforced) |
| `memory_limiter` | 80% RAM, 25% spike                                          |
| `resourcedetection` | env / system / cloud metadata into `resource.*` attrs    |
| `resource`       | upsert `service.namespace=omniroute`, `deployment.environment` |
| `attributes/redact` | delete `cookie` / `authorization` / `x-api-key` headers  |
| `attributes/cost`  | tag spans with `omniroute.cost.input_usd` / `output_usd`  |
| `filter/health`  | drop `omniroute.health.check` spans + `/api/health` route   |
| `tail_sampling`  | 100% on errors, 100% on slow (>250ms), 10% baseline         |
| `batch`          | 10s timeout, 8192 batch size                                |
| `loadbalancing`  | round-robin to OTLP backends by `traceID`                   |
| `otlp/jaeger`    | OTLP/gRPC to `${JAEGER_ENDPOINT}`                           |
| `otlp/tempo`     | OTLP/HTTP to `${TEMPO_ENDPOINT}`                            |
| `otlp/honeycomb` | OTLP/HTTP to api.honeycomb.io with `x-honeycomb-team` header |
| `otlp/datadog`   | OTLP/HTTP to otlp.datadoghq.com with `dd-api-key` header    |
| `file`           | local JSONL sink for debugging                              |
| `logging`        | stdout (sampled to avoid log flood)                         |

### Metrics pipeline

Receives OTLP metrics **plus** scrapes `/api/metrics` from OmniRoute every
15s **plus** hostmetrics (CPU / memory / disk / network). Exports to
`prometheusremotewrite` + a copy to `otlp/tempo` (Tempo can store metrics).

### Logs pipeline

Receives OTLP logs from the OTel logger **plus** tails
`/var/log/omniroute/*.log` via `filelog` (rotation-aware, JSON parser). All
secrets stripped via `attributes/redact` before export to `file` (local JSONL).

---

## Switching backends

The collector ships with **four OTLP exporters pre-wired** (Jaeger, Tempo,
Honeycomb, Datadog). Toggle by setting env vars — no config edit required:

```bash
# Jaeger only
export JAEGER_ENDPOINT=jaeger.observability.svc:4317
unset HONEYCOMB_API_KEY HONEYCOMB_DATASET DATADOG_API_KEY TEMPO_ENDPOINT
make up
```

```bash
# Honeycomb only
export HONEYCOMB_API_KEY=hcabc_xxx
export HONEYCOMB_DATASET=omniroute-prod
unset JAEGER_ENDPOINT DATADOG_API_KEY TEMPO_ENDPOINT
make up
```

See [04-backend-setup.md](./04-backend-setup.md) for step-by-step setup of
each backend.

---

## Sampling configuration

The default sampling strategy is **10% probabilistic baseline, 100% on
errors, 100% on spans >250ms**. Operators can override per environment via
`SAMPLING_PROBABILITY` (0–100):

```bash
# Production: 1% baseline (volume control)
export SAMPLING_PROBABILITY=1

# Staging: 100% (full fidelity)
export SAMPLING_PROBABILITY=100

# Dev: 0% (no traces saved to backend — keeps the box quiet)
export SAMPLING_PROBABILITY=0
```

The override only affects the **probabilistic baseline** — errors and slow
spans are always retained at 100% so debugging isn't blind.

To debug the sampler itself, set `OTEL_DEBUG=true` and restart the
collector — tail-sampling decisions are dumped to stderr.

---

## Redaction

`attributes/redact` strips the following by default (PR-010 hard rule, enforced
by validator + test):

- `http.request.header.cookie`
- `http.request.header.authorization`
- `http.request.header.x-api-key`
- `http.request.header.x-auth-token`
- `http.request.header.set-cookie`
- `http.response.header.set-cookie`
- `enduser.id` (hashed)
- `http.url` query strings matching `api_key|token|password|secret`

Add more headers via the `REDACT_HEADERS` env var (comma-separated, applied
at collector startup via re-deployment — not a hot reload):

```bash
export REDACT_HEADERS=x-tenant-secret,x-custom-auth,x-billing-token
```

The validator (`make lint`) checks that the three required headers are
listed in `attributes/redact`. Adding more is allowed; removing any of the
three hard-coded ones fails CI.

---

## Resource attributes

Every span / metric / log is enriched with:

- `service.namespace = omniroute`
- `deployment.environment = ${DEPLOYMENT_ENV}` (env, default `production`)
- `service.version = <from OmniRoute runtime>`
- `omniroute.collector.id = ${HOSTNAME}` (k8s pod name, container ID, etc.)

You can add more resource attributes via the `OTEL_RESOURCE_ATTRIBUTES` env
var (comma-separated `key=value` pairs), but the validator enforces that
every `${env:NAME}` reference in `collector.yaml` is documented in
`.env.example`.

---

## Health, liveness, debug endpoints

The collector exposes:

| Endpoint          | Purpose                                                |
|-------------------|--------------------------------------------------------|
| `:13133/`         | health_check extension — 200 OK when healthy           |
| `:13133/status`   | per-exporter health (last 5 failures listed)           |
| `:8888/metrics`   | Prometheus-format self-metrics (`level: detailed`)     |
| `:1777/debug/pprof/` | Go pprof profiles (CPU, heap, goroutine)            |
| `:55679/`         | zpages (live trace of recent errors, queue depths)     |

Wire `:13133/` into Kubernetes livenessProbe / readinessProbe:

```yaml
livenessProbe:
  httpGet: { path: /, port: 13133 }
  periodSeconds: 15
readinessProbe:
  httpGet: { path: /, port: 13133 }
  periodSeconds: 10
```

---

## Troubleshooting

### Collector won't start

**Symptom:** container exits with `collector.yaml: yaml: ...` or
`unknown processor: attributes/redact`.

1. Run `make lint` — the validator catches most schema errors.
2. Pull the image: `docker pull otel/opentelemetry-collector-contrib:0.110.0`
   and run `docker run --rm -it --entrypoint otelcol-contrib
   otel/opentelemetry-collector-contrib:0.110.0 validate --config=...`.
3. Check that `attributes/redact` actually exists in the contrib distribution
   (it was added in v0.97.0; we're on v0.110.0).

### No traces in Jaeger / Tempo / Honeycomb

1. Verify the collector is receiving anything: `curl
   http://localhost:8888/metrics | grep otelcol_receiver_accepted_spans`.
2. Check the exporter endpoint is reachable from the collector container
   (the docker-compose defaults assume the backend is on the
   `omniroute-net` bridge network).
3. Tail the collector logs: `make logs`. Look for `exporting` / `retry` lines.
4. If using Honeycomb / Datadog, confirm the API key is set (`make logs | grep
   401`).

### memory_limiter constantly refusing data

The collector is under-provisioned for the current load. Either:

- Raise the limits in `collector.yaml` (`limit_percentage: 80` → `90`,
  `spike_limit_percentage: 25` → `40`).
- Increase the container's memory limit (k8s: `resources.limits.memory`).
- Lower `SAMPLING_PROBABILITY` so fewer traces flow through.

### Redact validator failing in CI

`make lint` fails with `attributes/redact must delete "http.request.header.x-api-key"`.

You (or a teammate) deleted one of the three hard-coded redaction rules.
Restore them — see `deploy/otel-collector/collector.yaml` lines 161-180.

---

## Production deployment

For Kubernetes, see `deploy/k8s/omniroute-collector-config.yaml` — a
ConfigMap + Deployment + Service + ServiceMonitor bundle that runs the
collector as a 2-replica Deployment with the standard 256 MiB request /
1 GiB limit.

For systemd / bare-metal, see `deploy/systemd/omniroute-otel-collector.service`
— a unit that runs the collector as UID 10001 with a fixed env file.

Both ship in this repo and are kept in sync with `collector.yaml`.

---

## See also

- [01-quickstart.md](./01-quickstart.md) — the OTel SDK side (client side)
- [04-backend-setup.md](./04-backend-setup.md) — backend-by-backend setup
- `deploy/otel-collector/collector.yaml` — the source of truth
- `scripts/validate-otel-collector.mjs` — what `make lint` runs