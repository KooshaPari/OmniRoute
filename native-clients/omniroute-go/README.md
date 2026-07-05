# omniroute-go

> **Status: Phase 1 (proxy + OpenAI-compat + 1 working provider + 2 ported adapters)**
> See [AUDIT_AND_PLAN.md](./AUDIT_AND_PLAN.md) for the full scope and phased roadmap.

A Go rewrite of the OmniRoute backend (proxy + OpenAI-compatible API + provider
abstraction + CLI). Single static binary, no Node, no Electron. Drop-in
replacement for the non-frontend surface of `OmniRoute@3.8.x`.

## Why

The Node.js/TypeScript fork is 367K LOC across `src/`, `open-sse/`, `bin/`,
`@omniroute/*`, with 522 API route handlers, 146+ provider configs in
`open-sse/config/providers/registry/`, 6 compression engines (~19K LOC),
and a TLS MITM proxy for the desktop binary. We are re-implementing the
backend/api/sdk/cli in Go so that:

- **p99 added latency** drops from ~50ms (Node) to <10ms
- **idle RSS** drops from ~400MB to <100MB
- **cold start** drops from ~5s to <500ms
- **single static binary** replaces the 350MB Node/Electron install
- **streaming first** with proper backpressure and cancellation

## What is in this slice (Phase 0 + Phase 1)

- Single binary `omniroute` with subcommands: `start`, `version`, `doctor`, `models`, `providers`, `help`.
- HTTP server (`internal/proxy`) with the OpenAI-compatible surface:
  - `POST /v1/chat/completions` (streaming + non-streaming)
  - `GET  /v1/models`, `GET /v1/models/{id}`
  - `GET  /healthz`, `GET /readyz`
  - `GET  /api/providers`, `GET /api/usage` (stub), `GET /api/version`
- Provider abstraction (`internal/provider/registry`) — every adapter
  implements one interface (`ID`, `Models`, `ChatCompletion`,
  `ChatCompletionStream`, `Ping`).
- Two real adapters:
  - `internal/provider/openai` — OpenAI-compatible (also covers Together,
    Groq, Fireworks, OpenRouter, vLLM, Ollama, etc.).
  - `internal/provider/anthropic` — Anthropic Messages API, with full
    OpenAI-shape streaming translation.
- Deterministic mock provider (`internal/provider/mock`) for tests + local smoke.
- Structured JSON logging with per-request correlation IDs (`log/slog`).
- Config from env + tiny TOML reader (`internal/config`).
- Shadow mode (`OMNIROUTE_SHADOW_MODE=1` or `--shadow`) so the binary
  can run alongside the TS service and log only — never serve — for
  safe validation.
- Bearer auth on `/v1/*` when `OMNIROUTE_API_KEY` (or `--api-key`) is set.
- 19 contract tests (`go test ./...`).
- Cross-compile to `linux/{amd64,arm64}`, `darwin/{amd64,arm64}`.
- Distroless `Dockerfile` (no shell, no package manager).
- 6.5MB (darwin/arm64) and 6.9MB (linux/amd64) static binaries.

## What is NOT in this slice (deferred to later phases)

- 145 of the 146 providers (only OpenAI-compatible + Anthropic are
  ported; the rest are Phase 2+).
- Combos, fallback chains, weighted routing, cost-aware selection.
- RTK + Caveman compression engines.
- Auth, credential storage, OAuth flows.
- CLI parity (most subcommands are stubs).
- SDK (target-language package, drop-in for the TS `omniroute`).
- MCP server, A2A protocol.
- MITM TLS proxy (desktop only).
- SQLite / Postgres, usage/quota/audit/spend tables.
- OpenTelemetry traces/metrics.

See [AUDIT_AND_PLAN.md](./AUDIT_AND_PLAN.md) for the full phased plan.

## Build

```bash
# build for the host
make build

# cross-compile to all 4 platforms
make cross

# container image
make image

# tests
make test

# end-to-end smoke with the in-process mock
make smoke
```

## Run

```bash
# 1) Standalone with a real OpenAI key
./omniroute start --openai-key sk-... --listen :8080

# 2) Standalone with a real Anthropic key
./omniroute start --anthropic-key sk-ant-... --listen :8080

# 3) Local smoke (no API keys, in-process mock)
./omniroute start --mock --listen :8080

# 4) Shadow mode (receive but never serve, log only)
OMNIROUTE_SHADOW_MODE=1 ./omniroute start --mock --listen :8080

# 5) Bearer auth
./omniroute start --mock --api-key my-secret --listen :8080

# 6) Doctor (no server, just checks)
./omniroute doctor

# 7) Version
./omniroute version
```

## Hit it

```bash
# Models
curl -sS http://localhost:8080/v1/models | jq

# Non-streaming chat
curl -sS -X POST http://localhost:8080/v1/chat/completions \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer my-secret' \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"hello"}]
  }' | jq

# Streaming chat
curl -N -X POST http://localhost:8080/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"hello"}],
    "stream": true
  }'
```

## Layout

```
omniroute-go/
  cmd/omniroute/                CLI entry point (start, version, doctor, ...)
  internal/
    observability/              JSON logger, correlation IDs
    config/                     env + tiny TOML config
    proxy/                      HTTP server + OpenAI-compat handlers + tests
    provider/
      registry/                 Provider interface, request/response shapes, errors
      openai/                   OpenAI-compatible adapter
      anthropic/                Anthropic Messages adapter with streaming
      mock/                     Deterministic in-process provider for tests/smoke
  Dockerfile                    distroless
  Makefile                      build, test, cover, vet, smoke, cross, image
  go.mod
```

## License

MIT (inherited from upstream).
