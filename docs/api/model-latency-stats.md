# Model Latency Stats API

`GET /api/usage/model-latency-stats` returns rolling performance snapshots from
`usage_history` for operator dashboards and routing diagnostics. It uses management
authentication through `requireManagementAuth()`.

## Query parameters

| Name                | Default | Bounds              | Description                                                 |
| ------------------- | ------: | ------------------- | ----------------------------------------------------------- |
| `windowHours`       |    `24` | `> 0`, `<= 720`     | Rolling lookback window.                                    |
| `minSamples`        |     `1` | integer `1..10000`  | Minimum usable latency samples per entry.                   |
| `maxRows`           | `10000` | integer `1..100000` | Maximum recent usage rows scanned.                          |
| `provider`          |   unset | `1..100` characters | Exact provider filter.                                      |
| `model`             |   unset | `1..200` characters | Exact model filter.                                         |
| `connectionId`      |   unset | `1..200` characters | Exact connection filter.                                    |
| `keyByConnectionId` |  `true` | `true` or `false`   | Return per-connection keys or aggregate across connections. |

Invalid parameters return the standard structured `400` error body.

## Response

Each entry includes `provider`, `model`, `key`, `totalRequests`, `successfulRequests`,
`successRate`, `avgLatencyMs`, `p50LatencyMs`, `p95LatencyMs`, `p99LatencyMs`,
`latencyStdDev`, and `windowHours`. Connection-qualified results also include
`connectionId`. When usable telemetry exists, entries include `avgTtftMs` and
`avgTokensPerSecond`.

`totalRequests` and `successfulRequests` are the evidence counts behind reliability and
latency observations. Missing TTFT or TPS fields mean that the scanned rows did not contain
enough valid telemetry; zero is not substituted.

```bash
curl "http://localhost:20128/api/usage/model-latency-stats?windowHours=6&minSamples=10"
```

Use `keyByConnectionId=false` for provider/model aggregates. The auto-routing implementation
continues to read both aggregate and connection-qualified history directly through
`getModelLatencyStats()`; this endpoint is observational and does not change routing state.

## CLI

```bash
omniroute usage model-latency-stats --window-hours 6 --min-samples 10
```

Use `--provider`, `--model`, or `--connection-id` to filter. Use `--aggregate` to combine
connections. Global CLI output options, including JSON output, apply normally.
