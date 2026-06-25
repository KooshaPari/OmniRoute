# OTel Collector Sidecar — Operator Guide (PR-010)

This document covers deploying, verifying, and debugging the OpenTelemetry
(OTel) collector sidecar that backs OmniRoute's observability stack. It is
written for operators running OmniRoute in production on Docker Compose,
systemd, or Kubernetes.

The collector is the **single OTLP ingestion point** for every OmniRoute
runtime signal:

- **Traces** — proxy request spans, downstream HTTP spans, DB spans.
- **Metrics** — runtime + process metrics scraped from OmniRoute's
  Prometheus endpoint (`/api/metrics`).
- **Logs** — JSON-line application logs from `/var/log/omniroute/*.log` and
  the collector's own self-telemetry logs.

It batches, samples, enriches with deployment/host metadata, and forwards to
Prometheus (metrics), Jaeger (traces), and a local file sink (debug/audit).

---

## 1. What ships in this PR

| File | Purpose |
|------|---------|
| `deploy/otel-collector/collector.yaml` | OTel Collector configuration |
| `deploy/otel-collector/Dockerfile` | Multi-stage image build (non-root) |
| `deploy/otel-collector/entrypoint.sh` | Optional local-render entrypoint |
| `deploy/docker-compose.observability.yml` | Compose stack: collector + Prometheus + Jaeger + Grafana |
| `deploy/systemd/omniroute-otel-collector.service` | systemd unit for bare-metal |
| `deploy/systemd/omniroute-otel-collector.env.example` | systemd environment template |
| `deploy/k8s/omniroute-collector-config.yaml` | Kubernetes ConfigMap + Deployment + Service + ServiceMonitor |
| `deploy/grafana/provisioning/datasources/prometheus.yaml` | Grafana datasource provisioning (Prometheus + Jaeger) |
| `deploy/grafana/provisioning/dashboards/omniroute.yaml` | Grafana dashboard provider config |
| `src/lib/observability/collectorHealth.ts` | App-side health probe against `/health` extension |

The collector listens on three ports:

| Port | Protocol | Purpose |
|------|----------|---------|
| 4317 | gRPC | OTLP receiver (traces + metrics + logs) |
| 4318 | HTTP | OTLP receiver (HTTP alternative) |
| 13133 | HTTP | `health_check` extension (for liveness probes) |
| 8888 | HTTP | Collector self-telemetry (Prometheus format) |
| 1777 | HTTP | pprof (debug; should NOT be exposed publicly) |
| 55679 | HTTP | zpages (debug; should NOT be exposed publicly) |

---

## 2. Docker Compose deployment (recommended for dev / staging)

```bash
# Bring up the observability stack alongside OmniRoute
docker compose -f deploy/docker-compose.observability.yml up -d

# Verify the collector is healthy
curl -sf http://localhost:13133/ && echo OK
```

The compose file defines four services on a shared `omniroute-obs` network:

- `otel-collector` (ports 4317, 4318, 13133, 8888)
- `prometheus` (port 9090) — scrapes the collector's self-telemetry and the
  app's `/api/metrics`.
- `jaeger` (UI on 16686, OTLP gRPC on 4317 internal) — receives traces
  forwarded by the collector.
- `grafana` (port 3000) — auto-provisioned with Prometheus + Jaeger
  datasources and the `omniroute` dashboard folder.

Stop and remove with `down -v` to also delete the Prometheus volume.

---

## 3. systemd deployment (recommended for bare-metal / single-host prod)

```bash
# 1. Create a non-root user (one-time)
sudo useradd --system --shell /usr/sbin/nologin --home /var/lib/omniroute omniroute

# 2. Install binary
sudo install -m 0755 /opt/otelcol-contrib /usr/local/bin/otelcol-contrib

# 3. Install config + unit
sudo install -d -m 0750 -o omniroute -g omniroute /etc/omniroute
sudo install -m 0640 -o omniroute -g omniroute deploy/otel-collector/collector.yaml /etc/omniroute/
sudo install -m 0644 deploy/systemd/omniroute-otel-collector.env.example /etc/omniroute/otel.env
sudo install -m 0644 deploy/systemd/omniroute-otel-collector.service /etc/systemd/system/

# 4. Reload + enable
sudo systemctl daemon-reload
sudo systemctl enable --now omniroute-otel-collector

# 5. Verify
sudo systemctl status omniroute-otel-collector
curl -sf http://localhost:13133/ && echo OK
```

Override the env template by editing `/etc/omniroute/otel.env`. The unit
runs as user `omniroute`, restarts on failure, and sets `LimitNOFILE=65536`
so the collector can keep thousands of in-flight gRPC streams open.

---

## 4. Kubernetes deployment

```bash
kubectl apply -f deploy/k8s/omniroute-collector-config.yaml
```

The manifest is one file with four Kubernetes objects:

1. **ConfigMap `omniroute-collector-config`** — `collector.yaml` content.
2. **Deployment `omniroute-collector`** — single replica (HA is via
   upstream collectors, not this Deployment), `runAsNonRoot: true`,
   `securityContext.runAsUser: 10001`, readiness probe on `:13133/`,
   liveness probe on `:13133/`.
3. **Service `omniroute-collector`** — ClusterIP exposing OTLP gRPC (4317),
   OTLP HTTP (4318), and health (13133).
4. **ServiceMonitor `omniroute-collector`** — Prometheus Operator scrape
   config for the collector's self-telemetry on `:8888`.

Verify:

```bash
kubectl -n omniroute get pods -l app.kubernetes.io/name=omniroute-collector
kubectl -n omniroute port-forward svc/omniroute-collector 13133:13133
curl -sf http://localhost:13133/ && echo OK
```

---

## 5. Verifying the collector is receiving spans

Once the collector is running, you should see traffic within ~15 seconds.

```bash
# (a) Self-telemetry: how many spans has the collector received?
curl -s http://localhost:8888/metrics | grep otelcol_receiver_accepted_spans

# (b) Sample a trace: tail the file exporter
tail -f /var/log/omniroute/traces.jsonl | jq '.'

# (c) From the OmniRoute app side: hit the proxy and watch the span
curl -sI http://localhost:3000/api/health
tail -n 1 /var/log/omniroute/traces.jsonl | jq '.resourceSpans[].scopeSpans[].spans[].name'
```

In Jaeger UI (`http://localhost:16686`), pick the `omniroute` service and
you should see traces within seconds.

---

## 6. Health endpoint

The `health_check` extension listens on `:13133/`. The application-side
helper `checkCollectorHealth(endpoint, timeoutMs?)` returns
`{ healthy: boolean, status: string }` and is wired into startup logging.
The built-in fallback endpoints are:

```ts
[
  "http://localhost:13133",         // bare-metal / host-networked
  "http://otel-collector:13133",    // docker compose service name
]
```

`OTEL_COLLECTOR_HEALTH_ENDPOINT` overrides this list when set.

---

## 7. Debugging missing metrics

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| No traces in Jaeger | OTLP exporter misconfigured | Check `OTEL_EXPORTER_OTLP_ENDPOINT` resolves from the app pod; verify firewall on 4317 |
| `prometheus` shows no OmniRoute rows | Prometheus not scraping the collector | Confirm `prometheusremotewrite` exporter in collector.yaml and Prometheus target list (`/api/v1/targets`) |
| `hostmetrics` empty | `host` PID namespace mismatch (k8s) | Mount `/proc` and `/sys` read-only, or drop `hostmetrics` receiver |
| Spans missing `tenant_id` | Request didn't carry `x-tenant-id` header | Confirm the proxy sets it before handing off; check `attributes/cost` processor config |
| Health check returns 503 | `memory_limiter` tripped | Increase `LimitNOFILE` / `LimitMEMLOCK` in the unit, or raise `memory_limiter.limit_mib` |
| Tail-sampling drops everything | Probabilistic policy too aggressive | Raise `probabilistic` percentage from `1` to `10` for dev |
| Logs from collector noisy | `loglevel: debug` left on | Set `service.telemetry.logs.level: info` in collector.yaml |
| Grafana dashboards empty | Provisioning path not mounted | Ensure `deploy/grafana/provisioning` is mounted at `/etc/grafana/provisioning` |

For deeper debugging:

```bash
# zpages (live processor state)
curl http://localhost:55679/debug/tracez

# pprof CPU profile (30s)
curl -o /tmp/cpu.pprof http://localhost:1777/debug/pprof/profile?seconds=30
go tool pprof /tmp/cpu.pprof
```

---

## 8. Security notes

- **pprof (`:1777`) and zpages (`:55679`) are debug endpoints.** In Compose
  they bind to `127.0.0.1`. In k8s the Service only exposes 4317/4318/13133,
  so debug ports are pod-local and reachable only via `kubectl port-forward`.
- **Don't put TLS termination in front of OTLP gRPC** unless you also set
  `tls:` on the receiver. Plaintext gRPC is fine on a private network.
- The collector runs as a non-root user (`UID 10001` in the image,
  `omniroute` user in the systemd unit).

---

## 9. Related PRs

This PR (PR-010) is the **deploy half** of the observability stack. It
consumes the SDK half shipped in PR-001..PR-005 and PR-006..PR-009:

- PR-001 — `src/lib/observability/{spanTypes,resource,otel,otlpExporter}.ts`
- PR-002 — `metrics.ts`
- PR-003 — `logger.ts`
- PR-004 — `auto.ts` (default-OFF bootstrap)
- PR-005b — `proxySpan.ts` (Next.js middleware span)
- PR-006 — bootstrap wiring in `src/instrumentation-node.ts` + `src/proxy.ts`
- PR-007 — `.env.example.observability`
- PR-008 — Grafana dashboards JSON
- PR-009 — runbook + alerting rules

If you are upgrading from an older release, ensure the SDK files exist
before deploying this collector config, otherwise the app will export to a
collector that nobody's sending to.