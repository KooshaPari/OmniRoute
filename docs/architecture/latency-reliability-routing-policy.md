# Latency and Reliability Routing Policy

This note defines the intended behavior for speed-optimized and reliability-optimized auto routing. It complements the provider/model performance snapshot work and should guide future runtime, dashboard, and inspector changes.

## Goals

- Prefer the fastest healthy provider/model combination for latency-sensitive requests.
- Prefer the most stable provider/model combination for reliability-sensitive requests.
- Use observed telemetry when enough samples exist, but fail open when telemetry is missing.
- Keep routing explainable: operators should be able to see which weights and factors moved a candidate up or down.

## Telemetry Inputs

Provider/model routing should consider these signals, in this precedence order:

1. Recent usage-history aggregates for the exact `provider/model` key.
2. In-memory combo metrics for the exact `modelStr` when usage-history samples are below the floor.
3. Bootstrap model defaults for latency when neither telemetry source has enough data.
4. Circuit breaker, quota, cooldown, and credential gates as availability constraints or penalties.

Recommended aggregate fields:

| Signal | Field | Routing Use |
| --- | --- | --- |
| Time to first token | `avgTtftMs` | Stream responsiveness and coding-agent perceived latency. |
| End-to-end latency | `avgE2ELatencyMs` / `avgLatencyMs` | Whole request duration. |
| Tail latency | `p95LatencyMs`, `p99LatencyMs` | Speed ranking and SLA checks. |
| Throughput | `avgTokensPerSecond` | Long-generation performance. |
| Reliability | `successRate`, `totalRequests`, `successfulRequests` | Failure-risk ranking. |
| Stability | `latencyStdDev` | Variance penalty for reliability-first routing. |

## Sample Floors

Do not overfit to one or two requests. Runtime selection should apply a route-specific sample floor before trusting usage-history aggregates. A practical default is `10` requests for background ranking and a higher floor for high-stakes reliability policy.

When the floor is not met:

- Use in-memory combo metrics if present.
- Otherwise use bootstrap model latency defaults.
- Do not hard-block the candidate only because telemetry is absent.

## Weight Profiles

Auto routing already has mode-pack style profiles. The policy should keep these profiles normalized to a total weight of `1.0`.

### `ship-fast`

Use for interactive coding agents, short chat completions, and flows where the first useful token matters more than absolute cost.

Suggested emphasis:

- High `latencyInv`
- High `health`
- Moderate `taskFit`
- Low `costInv`
- Low `stability` unless tied with latency

### `reliability-first`

Use for batch work, automation, and expensive tool-call chains where retries are worse than a slightly slower first response.

Suggested emphasis:

- High `health`
- High `stability`
- Moderate `quota`
- Moderate `taskFit`
- Low `latencyInv`

### `balanced`

Use as the default when no explicit mode pack or request intent is provided.

Suggested emphasis:

- Preserve the existing default weight distribution.
- Include small but nonzero latency, health, cost, task-fit, context-affinity, and connection-density weights.

## Selection Rules

1. Resolve explicit per-combo weights first.
2. If no explicit weights are present and `modePack` is configured, resolve the named mode pack.
3. If neither is configured, use default weights.
4. Use the same resolved weights for provider selection and ranked fallback ordering.
5. Include the resolved weight source in inspector/debug output.

The fourth rule prevents a subtle class of bugs where the first selected provider honors a mode pack, but fallback order is scored with default weights.

## Failure Handling

Routing should distinguish hard gates from soft penalties:

- Hard gate: missing credentials, explicit quota cutoff, hidden model, incompatible request shape.
- Soft penalty: transient cooldown, terminal connection status when hard cutoff is disabled, weak telemetry, high tail latency, high variance.

When every candidate is hard-gated, return the existing structured unavailable response. When candidates only have soft penalties, keep ranking and fail over normally.

## Inspector Requirements

The scoring inspector should expose at least:

- Resolved weight source: `explicit`, `modePack:<name>`, or `default`.
- Effective weights used for scoring.
- Telemetry source per candidate: `usage-history`, `combo-metrics`, or `bootstrap`.
- Latency inputs: `avgTtftMs`, `avgE2ELatencyMs`, `p95LatencyMs`, `latencyStdDev`.
- Reliability inputs: `successRate`, `errorRate`, `totalRequests`.
- Any hard gate or soft penalty reason.

## Acceptance Checklist

A latency/reliability routing change is ready when:

- Provider selection and fallback ranking share the same resolved weights.
- Missing telemetry does not remove otherwise-valid candidates.
- The scoring inspector can explain speed/reliability choices.
- Unit tests cover explicit weights, mode-pack weights, and default weights.
- Unit tests cover historical telemetry above and below the sample floor.
