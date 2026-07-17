# Dispatch Protocol

## Purpose

The Dispatch protocol describes how a **routing decision** is paired with a
**work request** to produce a routed engine invocation. It is the input
side of substrate's engine-port surface.

## Flow

```
┌─────────┐  RouterRequest  ┌──────────┐  RouterDispatch  ┌─────────┐
│ Driver  │ ───────────────▶│ Router   │ ─────────────────▶│ Engine  │
└─────────┘                 └──────────┘                  └─────────┘
                                  │
                                  │ RouterDispatchResponse
                                  ▼
                            ┌──────────┐
                            │ Driver   │
                            └──────────┘
```

## RouterRequest

A request to do work. Created by a `driver-{http,cli,argv,mcp}` from an
incoming user input. Always carries:

- `id` — UUIDv4 for correlation
- `prompt` — natural-language description of the task
- `cwd` — absolute working directory the task should run in
- `context_budget_tokens` (optional) — hint for the context-budget middleware

## RouterDispatch

The router's choice of where the request should land. Produced by a
`RoutingPort` impl from the input `RouterRequest`. Always carries:

- `request_id` — the RouterRequest.id
- `engine` — engine name (e.g. `agentapi-claude`, `cliproxy-gpt-4o`, `forge`)
- `model` — model identifier within that engine
- `reason` — optional human-readable rationale (Bifrost trace)
- `bifrost_span` (optional) — opaque Bifrost decision ID for trace correlation

## RouterDispatchResponse

What the engine returns after a successful `EnginePort::start()` call.
Contains:

- `conv_id` — the conversation/session identifier (UUIDv4)
- `engine` — echo of the RouterDispatch.engine
- `started_at` — RFC 3339 timestamp
- `pid` — child process PID if the engine spawns a subprocess (None for HTTP)

## Worked example

See [`../examples/dispatch-cli-to-claude.json`](../examples/dispatch-cli-to-claude.json).

```json
{
  "request_id": "110ec58a-a0f2-4ac4-8393-c866d813b8d1",
  "engine": "agentapi-claude",
  "model": "claude-sonnet-4",
  "reason": "Route to Claude for code-review task (semantic analysis needed)",
  "bifrost_span": "bifrost-7a1b2c3d"
}
```

## Versioning

This protocol is `version: 0.1.0`. Backwards-compatible changes bump
patch; breaking changes bump minor until `0.3.0`, then major.