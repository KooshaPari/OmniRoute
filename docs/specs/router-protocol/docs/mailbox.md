# Mailbox Protocol

## Purpose

The Mailbox protocol describes the **streaming event envelope** that engines
emit mid-flight and supervisors consume to drive UI/UX (progress, message
chunks, errors, subagent lifecycle).

## Transport

Mailbox events are framed and sent over:

- **SSE** (HTTP `text/event-stream`) — primary transport for HTTP engines (agentapi, cliproxy)
- **WebSocket** — secondary transport for bidirectional engines (bifrost-decision-stream)
- **Newline-delimited JSON over stdin/stdout** — fallback for CLI subprocess adapters

The frame format is identical across transports; only the framing syntax
changes (`data: <json>\n\n` for SSE, `\n`-terminated for NDJSON, ws frames
for WS).

## RouterMailbox envelope

Every event shares the same envelope shape:

```json
{
  "version": "0.1.0",
  "conv_id": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
  "seq": 42,
  "ts": "2026-06-24T18:35:01Z",
  "kind": "message_chunk",
  "payload": { ... }
}
```

- `version` — protocol version (semver)
- `conv_id` — identifies the conversation/session
- `seq` — monotonically increasing per-conversation event counter
- `ts` — RFC 3339 timestamp
- `kind` — discriminator for `payload` shape
- `payload` — kind-specific JSON

## Event kinds

| `kind` | When | Payload shape |
|---|---|---|
| `status_change` | engine transitions between Running/Stable/Error | `{ from: string, to: string, agent_type?: string }` |
| `message_chunk` | streaming token chunk from agent | `{ role: "assistant" \| "user", delta: string, message_id: string }` |
| `message_complete` | final assistant message | `{ role: "assistant", content: string, message_id: string }` |
| `tool_call` | agent invokes a tool | `{ tool: string, args: object, call_id: string }` |
| `tool_result` | tool returns | `{ call_id: string, result: any, is_error: bool }` |
| `subagent_spawn` | parent engine spawns a child agent | `{ subagent_id: string, role: string }` |
| `subagent_complete` | child agent finishes | `{ subagent_id: string, status: "ok" \| "err" }` |
| `agent_error` | unrecoverable engine error | `{ message: string, code?: string, recoverable: bool }` |
| `heartbeat` | keep-alive every 30s | `{ idle_secs: number }` |

## Ordering

`seq` MUST be monotonically increasing per `conv_id`. Consumers MUST reject
envelopes with non-monotonic seq (indicates a buffer or producer bug).

## Worked example

See [`../examples/mailbox-stream.txt`](../examples/mailbox-stream.txt).