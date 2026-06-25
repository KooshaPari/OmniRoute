# Observability Quickstart

This guide covers the OmniRoute observability stack: spans, metrics, logs,
and the W3C `traceparent` propagation layer added in PR-006.

The stack is **default-off** (`OTEL_SDK_DISABLED=true`) so it costs zero
in the steady-state hot path until you explicitly opt in via env vars.
All call sites work whether telemetry is on or off — when off, the
helpers no-op and the response shape is unchanged.

---

## 1. Enable telemetry

```bash
# Minimum required to start shipping spans + metrics + logs
export OTEL_SDK_DISABLED=false
export OTEL_SERVICE_NAME=omniroute
export SERVICE_VERSION=3.8.34
export DEPLOYMENT_ENVIRONMENT=production

# Ship to an OTLP/HTTP collector (Jaeger / Tempo / Honeycomb / …)
export OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-collector.example.com
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
```

See `.env.example.observability` for the full list of env vars
(28 currently supported).

---

## 2. Spans — tracing requests

The `withSpan` helper pushes a span onto the active context so child
operations (DB calls, upstream provider calls) automatically join the
trace via `currentSpan()`:

```ts
import { withSpan, currentSpan, setAttribute } from "@/lib/observability";

await withSpan("process.user.signup", async (span) => {
  setAttribute(span, "user.tier", "free");
  setAttribute(span, "user.referral.source", "twitter");
  // Nested ops are auto-correlated:
  await withSpan("db.users.insert", async () => {
    /* … */
  });
  await withSpan("email.welcome.send", async () => {
    /* … */
  });
});
```

When a span is active, `currentTraceId()` and `currentSpanId()` return
the W3C `00-<trace-id>-<span-id>-01` identifiers. These are used by
the bifrost relay (PR-006) to propagate `traceparent` headers to
downstream services.

---

## 3. Metrics — Prometheus text format

The default registry exposes a `/metrics` endpoint in Prometheus text
format. Pre-registered metrics include:

| Metric                              | Type      | Labels                       |
| ----------------------------------- | --------- | ---------------------------- |
| `http_requests_total`               | counter   | route, method, status        |
| `http_request_duration_seconds`     | histogram | route, method, status        |
| `provider_attempts_total`           | counter   | provider, model, outcome     |
| `provider_call_duration_seconds`    | histogram | provider, model              |
| `cache_hits_total` / `cache_misses_total` | counter | layer                  |
| `quota_remaining` / `quota_limit`   | gauge     | tenant                       |
| `process_uptime_seconds`            | gauge     | —                            |
| `process_memory_rss_bytes`          | gauge     | —                            |
| `process_memory_heap_bytes`         | gauge     | —                            |
| `process_event_loop_lag_seconds`    | gauge     | —                            |

Domain-specific recorders:

```ts
import {
  httpMetricsMiddleware,
  recordProviderAttempt,
  recordProviderDuration,
  recordCacheHit,
  recordCacheMiss,
  recordQuotaRemaining,
} from "@/lib/observability";

// In your route handler:
httpMetricsMiddleware({
  route: "/v1/chat/completions",
  method: "POST",
  status: 200,
  durationSeconds: 0.42,
});

// In your provider client:
recordProviderAttempt({
  provider: "openai",
  model: "gpt-4o",
  outcome: "success",
  durationSeconds: 1.23,
});

// In your cache wrapper:
recordCacheHit("prompt");
recordCacheMiss("response");
```

Cardinality is capped at **64 distinct values per label** (`MAX_LABEL_VALUES`).
Anything past the cap is dropped (and surfaced as `dropped_series_total`
in the `/metrics` output).

---

## 4. Logs — Pino-compatible structured output

```ts
import { createLogger, getLogger } from "@/lib/observability";

const log = createLogger({ name: "auth.service", bindings: { region: "us-east-1" } });
log.info("user.login", { userId: "u-1", method: "magic-link" });
log.warn("token.near-expiry", { userId: "u-1", daysLeft: 3 });
log.error("provider.upstream.error", { provider: "openai", status: 502 });
```

Output modes:

- `LOG_MODE=json` (default) — one JSON object per line, pino-compatible.
- `LOG_MODE=pretty` — colorized, human-readable; local-dev only.

When a span is active, log records auto-carry `traceId` and `spanId` so
operators can grep one trace across logs and metrics. Child loggers merge
bindings additively:

```ts
const authLog = log.child({ component: "auth" });
const oauthLog = authLog.child({ provider: "google" });
oauthLog.info("token.exchange"); // emits { component: "auth", provider: "google", … }
```

---

## 5. Auto-instrumentation helpers

```ts
import {
  instrumentFetch,
  instrumentDb,
  instrumentCache,
  instrumentProvider,
} from "@/lib/observability";

// HTTP fetch — produces a CLIENT span + http_*_total counter
const response = await instrumentFetch(
  { kind: "upstream.openai", attributes: { route: "/v1/chat", "http.method": "POST" } },
  async () => fetch("https://api.openai.com/v1/chat/completions", { /* … */ })
);

// DB call — produces an INTERNAL span with db.operation attribute
const rows = await instrumentDb({ op: "select", table: "users" }, async () => db.select());

// Cache lookup — records hit/miss + emits cache_*_total
const value = await instrumentCache({ layer: "prompt" }, async () => cache.get(key));

// Upstream provider — records provider_attempts_total + provider_call_duration_seconds
const data = await instrumentProvider(
  { provider: "openai", model: "gpt-4o", tier: "free" },
  async () => callProvider(),
);
```

All helpers tolerate telemetry being disabled — they still call your
function exactly once and return its result, with zero overhead.

---

## 6. W3C `traceparent` propagation (PR-006)

The `withTraceparent` wrapper injects a `traceparent` header into any
outbound fetch derived from the currently active span:

```ts
import { withTraceparent } from "@/lib/observability/withTraceparent";

const response = await withTraceparent({
  build: () => ({ url: "https://upstream/", init: { method: "POST", headers: { … }, body: … } }),
  fetch: (url, init) => fetch(url, init),
});
```

This is wired into the bifrost relay route by default — every
`/api/v1/relay/chat/completions/bifrost` call carries a `traceparent`
header that the Go sidecar (or any W3C-aware downstream) can join.

Manual extraction (read an inbound traceparent):

```ts
import { extractTraceParent, parseTraceParent } from "@/lib/observability/traceparent";

const tp = extractTraceParent(request); // → TraceParent | null
if (tp) {
  // Start a child span that joins the upstream trace.
}
```

---

## 7. The bootstrap — `initTelemetry()`

Call once at process startup. Safe to call multiple times — the second
call refreshes the resource from env without re-allocating the
AsyncLocalStorage:

```ts
import { initTelemetry, setProcessMetrics, shutdownTelemetry } from "@/lib/observability";

initTelemetry();          // reads OTEL_* env vars
setProcessMetrics();      // first populate of process_* gauges

// On shutdown:
await shutdownTelemetry();
```

In OmniRoute this happens in `src/instrumentation-node.ts` → the
`registerNodejs()` entry point. Failures are wrapped in try/catch so a
misconfigured exporter never blocks server startup.
