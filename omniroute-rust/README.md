# OmniRoute (Rust)

Enterprise Rust rewrite of the OmniRoute LLM gateway. The TS fork at
`/Users/kooshapari/CodeProjects/Phenotype/OmniRoute-L5-122` is the **reference**;
this workspace is a **clean-break, prod-grade** replacement.

## Why Rust

- Sub-100ms TTFT for chat completions (zero-copy SSE on `axum::body::from_stream`)
- 5-20x faster tokenization via `tiktoken-rs`
- 30%+ faster TLS handshakes via `rustls` + persistent connection pool
- Compile-time-checked SQL with `sqlx`
- Single static binary distribution

## Crate layout

| Crate              | Role                                                    | Status    |
| ------------------ | ------------------------------------------------------- | --------- |
| `omni-core`        | errors, config, executor trait, ids, model, provider    | done      |
| `omni-protocol`    | OpenAI / Claude / Gemini / Codex / A2A / MCP wire types | in flight |
| `omni-translator`  | format detection + conversion registry                  | in flight |
| `omni-storage`     | sqlx SQLite + migrations                                | in flight |
| `omni-router`      | executor registry + routing + circuit breaker           | queued    |
| `omni-compression` | RTK + Caveman + Aggressive + Adaptive engines           | in flight |
| `omni-server`      | axum HTTP server, OpenAI-compat, SSE, /metrics          | queued    |
| `omni-mcp`         | MCP server + tools                                      | queued    |
| `omni-a2a`         | A2A v0.3 protocol                                       | queued    |
| `omni-telemetry`   | tracing + metrics + audit + OTel                        | in flight |
| `omni-cli`         | clap CLI (`omniroute` binary)                           | queued    |
| `omni-sdk`         | Rust client SDK                                         | queued    |

## Public API (wire-compatible with TS fork)

```
POST   /v1/chat/completions     (stream + non-stream)
POST   /v1/embeddings
GET    /v1/models
GET    /v1/models/{model}
POST   /v1/images/generations
POST   /v1/audio/speech
POST   /v1/audio/transcriptions
POST   /v1/moderations
POST   /v1/rerank
POST   /v1/responses            (OpenAI Responses API)
POST   /v1/messages             (Anthropic Messages-compatible)
POST   /v1/files
GET    /v1/files/{id}
POST   /v1/batches
POST   /v1/combos               (OmniRoute's router call)
GET    /v1/me/status
POST   /v1/web/fetch
POST   /v1/search
GET    /v1/agents/tasks/{id}
GET    /healthz
GET    /readyz
GET    /metrics
```

## Quickstart

```bash
# Build
cargo build --release --workspace

# Run the server
cargo run -p omni-server --release -- --port 9090 --data-dir ~/.omniroute

# CLI
cargo run -p omni-cli --release -- serve
cargo run -p omni-cli --release -- models
cargo run -p omni-cli --release -- keys create --name admin
cargo run -p omni-cli --release -- usage
```

## Compatibility contract

- OpenAI wire format on the public surface (no invented shapes)
- SSE event types: `data: {choices:[{delta:{content:"..."}}]}\n\n`
- Storage path: `~/.omniroute/storage.sqlite` (override via `DATA_DIR` or `OMNIROUTE_DATA_DIR`)
- Existing TS `.env` knobs are mapped to Rust env vars

## Migration from TS fork

This is a **clean break** — no backwards compat with the TS runtime. The `omniroute import` CLI tool ships a one-way importer for the existing `storage.sqlite` and `.env`.

## License

MIT
