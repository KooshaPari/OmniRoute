# Trace Protocol

## Purpose

The Trace protocol is the wire format for **observability primitives** —
the task lifecycle events that substrate engines and the wave runner emit.
It is designed to be OTLP-compatible so trace consumers (PhenoObservability,
Jaeger, Grafana Tempo) can ingest substrate traces without a translator.

## Wire format

Traces are encoded as **OTLP/JSON `resourceLogs`** with a custom
`substrate.router` log record type. The substrate-trace crate's
`PhenoOtelTrace` adapter produces these directly. The substrate-trace
crate's `RecordingTrace` produces the same shape (in-memory only).

The envelope shape:

```json
{
  "resourceLogs": [{
    "resource": {
      "attributes": [
        { "key": "service.name", "value": { "stringValue": "substrate" } }
      ]
    },
    "scopeLogs": [{
      "scope": { "name": "substrate.router", "version": "0.1.0" },
      "logRecords": [{
        "timeUnixNano": "1719258901000000000",
        "observedTimeUnixNano": "1719258901000000000",
        "severityText": "INFO",
        "body": { "stringValue": "task_registered" },
        "attributes": [
          { "key": "task_id", "value": { "stringValue": "110ec58a-..." } },
          { "key": "engine", "value": { "stringValue": "agentapi-claude" } },
          { "key": "model", "value": { "stringValue": "claude-sonnet-4" } }
        ]
      }]
    }]
  }]
}
```

## Log record types

The `body.stringValue` discriminates the event type:

| Body string | When | Required attributes |
|---|---|---|
| `task_registered` | `EnginePort::start()` accepted | `task_id`, `engine`, `model` |
| `task_started` | inner engine begins execution | `task_id`, `conv_id` |
| `task_completed` | `EnginePort::extract_result()` returns success | `task_id`, `conv_id`, `duration_ms` |
| `task_failed` | `EnginePort::*` returns error | `task_id`, `error_kind`, `error_message` |
| `message_posted` | `EnginePort::post_message()` called | `conv_id`, `role` |
| `message_received` | mailbox event arrived | `conv_id`, `kind`, `seq` |
| `subagent_spawned` | parent spawned child | `parent_conv_id`, `child_conv_id`, `role` |
| `lane_fanout_started` | wave fanout begins | `lane_id`, `count` |
| `lane_fanout_completed` | wave fanout finishes | `lane_id`, `succeeded`, `failed` |
| `lane_tree_started` | wave tree begins | `lane_id`, `root_conv_id` |
| `lane_tree_completed` | wave tree finishes | `lane_id`, `status` |
| `budget_exceeded` | context-budget middleware rejected | `conv_id`, `used_tokens`, `limit_tokens` |
| `budget_truncated` | context-budget middleware truncated | `conv_id`, `original_tokens`, `kept_tokens` |
| `trace_ship_failure` | OTLP exporter POST failed (swallowed) | `endpoint`, `error_message` |

## Severity levels

- `INFO` — task lifecycle (registered, started, completed)
- `WARN` — recoverable issues (budget truncated, subagent retry)
- `ERROR` — failures (task_failed, trace_ship_failure)

## Worked example

See [`../examples/trace-fanout.json`](../examples/trace-fanout.json).