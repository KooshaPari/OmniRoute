# OpenCode Plugin Contract v1

Contract version: `v1` (pinned — see Evolution Rules below).

## Endpoint

`GET /v1/models` — returns the model catalog for any plugin consuming the OmniRoute model catalog.

## Wire Format

### `ModelsResponseV1` (top-level envelope)

```json
{
  "object": "list",
  "data": [ModelV1, ...],
  "has_more": false,
  "last_id": null
}
```

| Field      | Type            | Required | Notes                           |
| ---------- | --------------- | -------- | ------------------------------- |
| `object`   | `string`        | yes      | always `"list"`                 |
| `data`     | `ModelV1[]`     | yes      | ordered array of model entries  |
| `has_more` | `boolean`       | no       | `false` if absent               |
| `last_id`  | `string \| null` | no       | cursor for pagination, optional |

### `ModelV1` (single model entry)

```json
{
  "id": "gpt-4o-mini",
  "object": "model",
  "created": 1721260800,
  "owned_by": "openai",
  "display_name": "GPT-4o Mini",
  "context_length": 128000,
  "max_input_tokens": null,
  "max_output_tokens": null,
  "input_modalities": [],
  "output_modalities": [],
  "release_date": null,
  "api_format": null,
  "capabilities": { ... }
}
```

| Field             | Type                  | Required | Notes                                     |
| ----------------- | --------------------- | -------- | ----------------------------------------- |
| `id`              | `string`              | yes      | canonical model identifier                |
| `object`          | `string`              | yes      | always `"model"`                          |
| `created`         | `i64` (unix ts)       | yes      | model creation / release timestamp        |
| `owned_by`        | `string`              | yes      | provider / organization                   |
| `display_name`    | `string \| null`      | no       | human-readable label, optional            |
| `context_length`  | `i64`                 | yes      | maximum context window in tokens          |
| `max_input_tokens`| `i64 \| null`         | no       | per-request input limit, optional         |
| `max_output_tokens`| `i64 \| null`        | no       | per-request output limit, optional        |
| `input_modalities`| `string[]`            | no       | e.g. `["text", "image"]`                 |
| `output_modalities`| `string[]`           | no       | e.g. `["text"]`                          |
| `release_date`    | `string \| null`      | no       | ISO 8601 date, optional                   |
| `api_format`      | `string \| null`      | no       | e.g. `"anthropic"`, `"openai"`, optional  |
| `capabilities`    | `ModelCapabilitiesV1` | no       | defaults to all-`false` if absent         |

### `ModelCapabilitiesV1`

```json
{
  "chat": true,
  "stream": true,
  "tools": true,
  "vision": true,
  "json_mode": true,
  "tool_calling": true,
  "reasoning": true,
  "thinking": false,
  "attachment": true,
  "structured_output": true,
  "temperature": true
}
```

All fields are `boolean`, defaulting to `false` when absent. Unknown capability keys are tolerated (forward-compatible).

## Authentication

`Authorization: Bearer <token>` — Bearer token in the HTTP Authorization header.

## Evolution Rules

1. **Additive-only within v1.** New fields may be added to any struct; consumers MUST ignore unknown keys (serde `#[serde(default)]` / `#[serde(deny_unknown_fields)]` MUST NOT be used on the consumer side).
2. **Required fields never change semantics** within a contract version.
3. **Breaking changes** (field removal, type change, required→optional flip) require a new contract version (`v2`, `v3`, …) shipped via a parallel endpoint.
4. **Version pin in config.** Plugin consumers pin `contract_version = "v1"` in their configuration. OmniRoute will continue serving v1 for at least one major release after v2 ships.

## Cross-Reference

### Rust (canonical)

`omniroute-rust/crates/omni-core/src/contracts/opencode_v1.rs` — `ModelsResponseV1`, `ModelV1`, `ModelCapabilitiesV1`. Serialization via `serde` with `#[serde(default)]` on all optional fields. Test coverage for minimal roundtrip, full payload, missing required fields, and unknown field tolerance.

### TypeScript (consumer)

`@omniroute/opencode-plugin/src/index.ts` — consumer-side TypeScript that imports these types and validates responses at runtime.
