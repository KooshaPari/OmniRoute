# Phenotype Stack Smoke Test

A non-UI end-to-end smoke harness that boots the full Phenotype stack
(Rust data plane + BytePort Go backend + NVMS Go daemon + optional
upstream LLM) and runs a real LLM-shaped round-trip through it.

Complements the existing **Playwright UI** tests in `tests/e2e/*.spec.ts`
which exercise the OmniRoute dashboard against a single TS-only backend.
This harness exercises the **production hot path**: UDS proxy → Rust
data plane → upstream provider.

## Topology

```
curl
  ↓ HTTP :18080
BytePort Gin backend (UDSProxy middleware)
  ↓ unix socket ($OMNIROUTE_DATA_PLANE_SOCKET)
omniroute-runtime (Rust, hyper)
  ↓ HTTPS
Ollama (local)   or   OpenAI / OpenAI-compatible upstream
```

NVMS daemon runs in parallel on its own UDS — exercised by the
`/healthz` step but not strictly required for the LLM round-trip.

## Build prerequisites

```bash
# Rust data plane (release)
cd OmniRoute && cargo build --release -p omniroute-runtime

# BytePort backend
cd BytePort/backend && go build -o ./bin/byteport .

# NVMS daemon
cd nanovms && go build -o ./bin/nvms ./cmd/nvms
```

Place the resulting binaries where the harness expects them, or override
with env vars (see below).

## Usage

```bash
# Default (uses local Ollama)
tests/e2e/phenotype-stack-smoke.sh

# OpenAI-backed
OPENAI_API_KEY=sk-... tests/e2e/phenotype-stack-smoke.sh

# Smoke test only the data plane plumbing, no real LLM call
tests/e2e/phenotype-stack-smoke.sh --skip-llm-call

# Keep processes alive after the test for debugging
tests/e2e/phenotype-stack-smoke.sh --keep-stacks
```

### Env overrides

| Var | Default | Purpose |
|---|---|---|
| `OMNIROUTE_RUST_BIN` | `./target/release/routed` | Rust data plane binary |
| `BYTEPORT_GO_BIN` | `./BytePort/backend/bin/byteport` | BytePort Gin binary |
| `NVMS_GO_BIN` | `./nanovms/bin/nvms` | NVMS daemon binary |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama base URL |
| `OPENAI_API_KEY` | (unset) | If set, switch to OpenAI upstream |
| `OPENAI_BASE_URL` | (unset) | OpenAI-compatible base URL |
| `SMOKE_MODEL` | `llama3.2:3b` / `gpt-4o-mini` | Model for the LLM call |
| `SMOKE_TIMEOUT` | `30` | Per-step timeout (seconds) |
| `RUST_LOG` | `omniroute_runtime=info` | Rust log filter |

## What it verifies

1. All three binaries are present and executable
2. NVMS daemon binds UDS listener
3. Rust data plane binds UDS listener
4. BytePort Gin backend serves `/healthz`
5. Routed responds to `/healthz` over UDS
6. NVMS daemon responds to `/healthz` over UDS
7. Full LLM round-trip via BytePort → routed → upstream
8. Prometheus `/metrics` endpoint emits omniroute_* metrics

## CI integration

The companion workflow `.github/workflows/rust-ci.yml` runs this harness
on every PR against `main` after the Rust + Go build jobs pass.
See `.github/workflows/rust-ci.yml::smoke` job.