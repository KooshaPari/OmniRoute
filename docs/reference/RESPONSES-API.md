---
title: "Responses API Feature Coverage"
version: 1.0.0
lastUpdated: 2026-07-01
audience: engineers integrating OpenAI Responses / Claude Code / Codex CLI clients with OmniRoute
---

# Responses API Feature Coverage

This document maps the OpenAI Responses API surface (`/v1/responses`, the
protocol used by Claude Code and the Codex CLI) against OmniRoute's
current implementation. It is a **coverage matrix**, not a marketing
comparison — every cell links to the source file that implements (or
neglects to implement) the feature.

The transformer that converts upstream Chat-Completions SSE into the
Responses API SSE protocol lives in
[`open-sse/transformer/responsesTransformer.ts`](../../open-sse/transformer/responsesTransformer.ts).
Request-side translation (Responses API → Chat Completions) lives in
[`open-sse/translator/helpers/responsesApiHelper.ts`](../../open-sse/translator/helpers/responsesApiHelper.ts).

## Legend

| Symbol | Meaning |
| ------ | ------- |
| ✅     | Supported in current `main`, covered by tests |
| 🟡     | Partially supported — request accepted, response degraded, or surface incomplete |
| ❌     | Not implemented (no code path; client will see a 4xx, empty `output[]`, or unexpected stream shape) |
| 🚧     | Implementation in progress in the linked PR |

## Coverage matrix

### Request shape (client → OmniRoute)

| Feature | Status | Notes / source |
| ------- | :----: | -------------- |
| `model` (string) | ✅ | `open-sse/translator/helpers/responsesApiHelper.ts::convertResponsesApiFormat` — resolves to upstream model id. |
| `input` (string) | ✅ | Promoted to a single user message. |
| `input` (array of `message` / `function_call_output` items) | ✅ | Translated to Chat-Completions `messages[]`. |
| `instructions` (system prompt) | ✅ | Prepended as a `developer`/`system` message. |
| `stream: true` | ✅ | Triggers SSE; `createResponsesApiTransformStream` is the wire format. |
| `stream: false` | ✅ | Non-streaming Responses body. |
| `temperature`, `top_p`, `max_output_tokens` | ✅ | Mapped to Chat-Completions counterparts. |
| `tools[]` (Chat-style function tools) | ✅ | `function_call` items emitted in `output[]` (see below). |
| `tools[]` (hosted tools: `web_search`, `file_search`, `code_interpreter`, `image_generation`) | ❌ | Hosted tools are stripped by the translator; client must invoke the corresponding provider directly. |
| `tool_choice` | 🟡 | Passed through as a string; the structured `tool_choice: {type: "function", name: ...}` form is not auto-translated and falls back to "auto". |
| `parallel_tool_calls` | 🟡 | Accepted but ignored when combo routing picks a target that does not honor it. |
| `response_format: { type: "text" }` | ✅ | No-op. |
| `response_format: { type: "json_object" }` | 🟡 | Translated to `response_format: { type: "json_object" }` for OpenAI-shaped providers only. Anthropic, Gemini, and most local providers silently ignore. |
| `response_format: { type: "json_schema", json_schema: ... }` (structured outputs) | 🚧 | Implemented in this PR: translator accepts `json_schema` and forwards it; the response `output` is annotated with `format: "json_schema"` so the client can validate. |
| `metadata` | 🟡 | Stored on the request for logging, but not echoed back in `response.metadata`. |
| `previous_response_id` (server-side state) | ❌ | OmniRoute is stateless across requests; clients must send the full transcript in `input[]`. |
| `store: true` | ❌ | We never store Responses. `store: false` is the only effective mode. |
| `truncation: "auto" | "disabled"` | 🟡 | Accepted; "auto" is forwarded as a system-level hint and may be downgraded by the upstream target. |
| `user` (end-user identifier) | ✅ | Forwarded as a request tag. |
| `prompt_cache_key` | 🚧 | Implemented in this PR: stored on the request and surfaced in `response.prompt_cache_key` so a client can verify cache hits. |
| `prompt_cache_control: { type: "ephemeral" }` (per-block cache markers) | 🚧 | Implemented in this PR: input items with `cache_control` are passed through to the upstream target and reflected in `usage.cache_creation_input_tokens` / `usage.cache_read_input_tokens` when the upstream reports them. |
| `reasoning: { effort: "low" \| "medium" \| "high" }` | 🟡 | Forwarded as a system hint; the model decides. No per-item `reasoning` items emitted. |

### Response shape (OmniRoute → client)

| Field | Status | Notes |
| ----- | :----: | ----- |
| `id` (`resp_…`) | ✅ | Stable across the stream. |
| `object: "response"` | ✅ | |
| `created_at` (unix epoch) | ✅ | |
| `status: "in_progress" | "completed" | "failed"` | ✅ | Failed state is emitted when upstream errors mid-stream. |
| `output[]` — `message` items | ✅ | Streaming deltas, dense final ordering. |
| `output[]` — `function_call` items | ✅ | Stable since PR #721 dense output. |
| `output[]` — Claude-style `tool_use` blocks (`type: "tool_use"`) | 🚧 | **Implemented in this PR.** When `tools[]` includes a Claude-format schema (presence of `input_schema` and absence of Chat-style `parameters`), the transformer emits a parallel `tool_use` block alongside the `function_call` so Claude Code clients that expect Anthropic-style tool blocks can render them. |
| `output[]` — `reasoning` items | ✅ | Emitted from `reasoning_content` deltas and `<think>…</think>` segments. |
| `output[]` — `web_search_call`, `file_search_call`, `image_generation_call` | ❌ | Hosted tool outputs are not synthesized. |
| `output[]` — `code_interpreter_call` | ❌ | |
| `output[]` — `refusal` items | ❌ | |
| `usage` — `input_tokens`, `output_tokens`, `total_tokens` | ✅ | |
| `usage` — `reasoning_tokens` | ✅ | Surfaced in `output_tokens_details.reasoning_tokens` when reported upstream. |
| `usage` — `cache_creation_input_tokens`, `cache_read_input_tokens` | 🚧 | **Implemented in this PR.** Pass-through of Anthropic `usage.cache_creation_input_tokens` / `usage.cache_read_input_tokens` into the Responses API `usage` envelope. |
| `usage` — `cached_tokens` (OpenAI shape) | ✅ | |
| `metadata` | ❌ | Not echoed back; the request-side `metadata` is dropped. |
| `prompt_cache_key` | 🚧 | **Implemented in this PR.** Echoes back the request's `prompt_cache_key`. |
| `parallel_tool_calls` (response) | ❌ | Always omitted; the field is meaningless when combo routing is in play. |
| `temperature`, `top_p`, `user`, `model` (response) | ✅ | |
| `incomplete_details` (for `max_output_tokens` truncation) | ❌ | |

### Streaming events

| Event | Status | Notes |
| ----- | :----: | ----- |
| `response.created` | ✅ | |
| `response.in_progress` | ✅ | |
| `response.output_item.added` | ✅ | |
| `response.output_item.done` | ✅ | Dense-sorted at `response.completed`. |
| `response.content_part.added` / `.done` | ✅ | |
| `response.output_text.delta` / `.done` | ✅ | |
| `response.reasoning_summary_part.added` / `.done` | ✅ | |
| `response.reasoning_summary_text.delta` / `.done` | ✅ | |
| `response.function_call_arguments.delta` / `.done` | ✅ | Empty-string/array placeholders stripped (#1674, #1852). |
| `response.tool_use_block.delta` / `.done` (Anthropic-style parallel event) | 🚧 | **Implemented in this PR.** Mirrors the new `tool_use` item in the output array. |
| `response.refusal.delta` / `.done` | ❌ | |
| `response.audio.delta` | ❌ | Audio output not supported through the Responses API path. |
| `response.error` | ✅ | Emitted on upstream failure. |
| `response.completed` | ✅ | Dense `output[]`. |
| `response.failed` | 🟡 | Emitted only when the upstream 4xx/5xx after `response.created`; the SDK does not always read it. |
| `response.incomplete` | ❌ | Truncation is treated as a normal completion. |
| `: keepalive` comment frames | ✅ | 3s heartbeat; self-clears on stream cancel (#2544). |
| `data: [DONE]` | ✅ | Terminal sentinel. |

### Tool / function-call shape parity

The Responses API and the Anthropic Messages API disagree on the on-the-wire
shape of a tool invocation. OmniRoute's transformer historically only emitted
the OpenAI-style `function_call` item:

```jsonc
{
  "type": "function_call",
  "id": "fc_…",
  "call_id": "call_…",
  "name": "lookup",
  "arguments": "{\"q\":\"test\"}"
}
```

Claude Code (and other Anthropic-shaped clients) expect an item with
`type: "tool_use"`:

```jsonc
{
  "type": "tool_use",
  "id": "toolu_…",
  "name": "lookup",
  "input": { "q": "test" }
}
```

The transformer in this PR emits **both** shapes for the same call, in
order, with a stable `id` (so the client can correlate):

```jsonc
[
  { "type": "function_call", "id": "fc_call_abc", "call_id": "call_abc", "name": "lookup", "arguments": "{\"q\":\"test\"}" },
  { "type": "tool_use",      "id": "fc_call_abc", "name": "lookup", "input": { "q": "test" } }
]
```

The new `tool_use` block is only emitted when the request's `tools[]`
entry contains an `input_schema` (Anthropic-style) or when the request
explicitly opts in via a `x-omniroute-emit-tool-use: true` header. Chat
Completions callers that only consume `function_call` items see no
change.

### Structured outputs

`response_format: { type: "json_schema", json_schema: { name, schema, strict } }`
is now:

1. Translated to the equivalent OpenAI Chat Completions
   `response_format` when the resolved target provider honors it.
2. Stored on the request envelope so combo routing can prefer a target
   known to support it.
3. Echoed back in the response object as
   `response.output_format: { type: "json_schema", name, schema, strict }`
   so the client can validate the emitted `message` content against the
   declared schema without a second round-trip.

### Prompt caching

Anthropic prompt-caching fields are accepted on input and surfaced on the
usage object so a client can observe hit/miss ratios:

```jsonc
{
  "usage": {
    "input_tokens": 1234,
    "output_tokens": 200,
    "cache_creation_input_tokens": 900,
    "cache_read_input_tokens": 1234
  }
}
```

Upstream targets that do not report cache token counts will simply omit
the `cache_*` fields. The transformer never invents cache numbers.

## Test coverage

The transformer is covered by:

- `tests/unit/responses-transformer-dense-output.test.ts` — dense `output[]`
  ordering, function-call vs message index, non-numeric output_index
  normalization (3 tests, port of upstream PR #721).
- `tests/unit/responses-transformer-options.test.ts` and
  `tests/unit/responses-transformer-streaming.test.ts` —
  40+ new tests covering: tool_use block emission, structured_outputs
  round-trip, prompt_cache_control passthrough, reasoning items, function
  call argument streaming, error path, keepalive behaviour, dense output
  invariants, edge cases.

## Future work

- Hosted tools (`web_search`, `file_search`, `code_interpreter`,
  `image_generation`).
- Server-side state via `previous_response_id` (would require a session
  table; security review needed for prompt-injection from stored state).
- `response.refusal` items (currently inlined into a refusal-content
  message).
- Audio streaming (`response.audio.delta`).
- `response.incomplete` for `max_output_tokens` truncation.
