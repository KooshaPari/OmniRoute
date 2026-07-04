# Model Latency Stats API

`GET /api/usage/model-latency-stats` returns rolling provider/model performance snapshots from `usage_history`. It is intended for operators, dashboards, and routing diagnostics that need to inspect the latency and reliability signals used by auto-routing.

## Authentication

This is a management endpoint. It requires the same dashboard management authentication as other `/api/usage/*` management routes when login is enabled.

## Query Parameters

| Name | Type | Default | Bounds | Description |
| --- | --- | ---: | --- | --- |
| `windowHours` | number | `24` | `> 0`, `<= 720` | Rolling lookback window used when aggregating usage rows. |
| `minSamples` | integer | `1` | `>= 1`, `<= 10000` | Minimum total requests required for a provider/model entry to be returned. |
| `maxRows` | integer | `10000` | `>= 1`, `<= 100000` | Maximum recent usage rows scanned before aggregation. |
| `provider` | string | unset | `1..100` chars | Optional exact provider filter, for example `openai`. |
| `model` | string | unset | `1..200` chars | Optional exact model filter, for example `gpt-4o`. |

Invalid query parameters return `400` with the standard structured error body.

## Response

```json
{
  "windowHours": 24,
  "minSamples": 2,
  "maxRows": 10000,
  "count": 1,
  "entries": [
    {
      "provider": "openai",
      "model": "gpt-4o",
      "key": "openai/gpt-4o",
      "totalRequests": 12,
      "successfulRequests": 11,
      "successRate": 0.9166666667,
      "avgLatencyMs": 240,
      "avgTtftMs": 120,
      "avgE2ELatencyMs": 240,
      "avgTokensPerSecond": 38.5,
      "p50LatencyMs": 220,
      "p95LatencyMs": 390,
      "p99LatencyMs": 410,
      "latencyStdDev": 35
    }
  ]
}
```

### Entry Fields

| Field | Type | Description |
| --- | --- | --- |
| `provider` | string | Provider id from the usage row. |
| `model` | string | Model id from the usage row. |
| `key` | string | Stable `provider/model` aggregate key. |
| `totalRequests` | integer | Number of usage rows in the window for this provider/model. |
| `successfulRequests` | integer | Number of successful rows in the window. |
| `successRate` | number | Successful requests divided by total requests, in the `0..1` range. |
| `avgLatencyMs` | integer | Average successful request latency in milliseconds. |
| `avgTtftMs` | integer | Average time to first token in milliseconds when TTFT telemetry is available. |
| `avgE2ELatencyMs` | integer | Average end-to-end request latency in milliseconds when available. |
| `avgTokensPerSecond` | number | Average output throughput when output token and latency telemetry are available. |
| `p50LatencyMs` | integer | Median successful latency in milliseconds. |
| `p95LatencyMs` | integer | P95 successful latency in milliseconds. |
| `p99LatencyMs` | integer | P99 successful latency in milliseconds. |
| `latencyStdDev` | integer | Standard deviation of successful latency in milliseconds. |

## Routing Interpretation

Routing should treat this endpoint as an observational snapshot, not as a hard availability oracle. Suggested use:

- Use `p95LatencyMs` and `avgTtftMs` for speed-sensitive ranking.
- Use `successRate`, `successfulRequests`, and `latencyStdDev` for reliability and stability ranking.
- Ignore entries below a route-specific sample floor instead of overfitting to a single request.
- Prefer fail-open behavior when the endpoint has no matching entries; bootstrap/model defaults should still be used.

## Examples

```bash
curl "http://localhost:20128/api/usage/model-latency-stats?windowHours=6&minSamples=10"
```

```bash
curl "http://localhost:20128/api/usage/model-latency-stats?provider=openai&model=gpt-4o"
```
