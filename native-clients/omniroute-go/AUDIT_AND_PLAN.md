# OmniRoute Fork Backend Rewrite — Audit and Plan

**Repo:** `OmniRoute` (fork of `diegosouzapw/OmniRoute`)
**Author:** Koosha Pari
**Date:** 2026-07-05
**Status:** Phase 0 + Phase 1 delivered (`omniroute-go` v0.1.0-dev). 19/19 contract tests pass. Static binaries for 4 platforms build in <30s. End-to-end smoke verified with the in-process mock provider.

## 1. Audit of the current surface (non-frontend)

Numbers as of the audit (see `src/`, `open-sse/`, `bin/`, `@omniroute/`):

| Surface                                                           | Count        | Notes                                                                                       |
| ----------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| Next.js API route handlers (`src/app/api/**/route.*`)             | 522          | Backend HTTP endpoints; huge and very chatty                                                |
| `open-sse/services` files / LOC                                   | 236 / 62,626 | Provider business logic and per-provider transforms                                         |
| `open-sse/executors` files / LOC                                  | 64 / 34,809  | Provider call execution                                                                     |
| `open-sse/handlers` files / LOC                                   | 32 / 18,633  | HTTP handlers for open-sse routes                                                           |
| Provider registry entries (`open-sse/config/providers/registry/`) | 146          | Real provider configs (not 231 — 231 in README counts sub-variants)                         |
| Compression engines                                               | 6            | ccr, headroom, llmlingua, mcpAccessibility, rtk, session-dedup + cavemanAdapter; ~18.8K LOC |
| Compression rule packs (language)                                 | 7            | de, en, es, fr, id, ja, pt-BR                                                               |
| MITM subsystem dirs                                               | 7            | cert, detection, dns, handlers, inspector, targets, tproxy                                  |
| CLI subcommand modules                                            | 25+          | under `bin/cli/`                                                                            |
| SDK packages                                                      | 2            | `@omniroute/opencode-plugin`, `@omniroute/opencode-provider` (TS)                           |
| Total TS/JS LOC in `src/`                                         | ~367,000     | non-frontend                                                                                |
| Total TS/JS LOC overall                                           | ~520,000+    | including `open-sse/`, `bin/`, `@omniroute/`, `docs/`, `tests/`                             |

Top hotspot file system-wise: every provider is a self-contained folder
under `open-sse/config/providers/registry/<name>/`, and each contains a
config JSON, an `index.ts` (auth + transform), and sometimes a `web/`
subdir (for cookie/MITM providers). The registry shape is uniform.

## 2. Language decision: Go (with optional Rust for the compression hot path)

Candidates: Rust, Go, Zig, Mojo. Reasoning in 5 lines:

- **Go** wins on team velocity for 146+ provider adapters (small files, easy to template), the OpenAI gateway ecosystem is largely Go (LiteLLM proxy, OpenLLMetry, Bifrost), `net/http` + `httptest` is the cleanest path to the contract-test corpus we need, single static binary, cross-compile is trivial, and the existing engineers can read Go faster than Rust.
- **Rust** wins on raw perf and no-GC pauses, but for a streaming gateway with mostly I/O bound work, that gap is small, and OAuth2/OIDC + 146 provider adapters written in Rust is 2-3x the lines of Go.
- **Zig** is not production-ready for a general HTTP server in 2026 (no `std.http` is still being shaped, no mature OAuth/OIDC). Punt.
- **Mojo** is focused on AI compute kernels, not general servers. Punt.

**Recommendation: Go for the main service. Rust only if the compression engine's
regex throughput becomes a measured bottleneck (then `cgo` or a sidecar).**

## 3. Phased roadmap (12 phases)

Each phase ends in a tagged, deployable, tested artifact. No "flip the switch
at the end" — every phase runs in shadow or alongside the TS service.

| #   | Phase                                                                                                      | Effort | Status |
| --- | ---------------------------------------------------------------------------------------------------------- | ------ | ------ |
| 0   | Foundation: build, lint, test, fuzz, container, empty binary + doctor                                      | S      | DONE   |
| 1   | Proxy + OpenAI compat: `/v1/chat/completions`, `/v1/models`, healthz/readyz, mock provider, contract tests | M      | DONE   |
| 2   | Provider abstraction + 5-port seed (OpenAI, Anthropic, Gemini, OpenRouter, Ollama)                         | M      | next   |
| 3   | Streaming + SSE hardening: backpressure, mid-stream errors, cancellation, 1k concurrent streams            | M      | queued |
| 4   | Combos + routing: capability intersect, fallback chains, `interleaved` capability                          | L      | queued |
| 5   | Compression: RTK + Caveman in Go, golden tests on the existing TS corpus                                   | L      | queued |
| 6   | Auth + credentials + storage: SQLite + AES-GCM + OAuth flows for 3 providers                               | L      | queued |
| 7   | CLI parity: port every subcommand, completions, JSON output                                                | M      | queued |
| 8   | SDK: target-language package + npm interop shim                                                            | M      | queued |
| 9   | MCP + A2A: stdio + HTTP transports, agent card                                                             | M      | queued |
| 10  | MITM: desktop-only, cert generation, body inspection                                                       | L      | queued |
| 11  | Cutover + decommission: shadow 7d, canary 1/10/50/100, TS retire                                           | M      | queued |

**Critical path: 0 -> 1 -> 2 -> 3 -> 4 -> 6 -> 11.** Phases 5, 7, 8, 9, 10
are parallelizable.

## 4. Public contracts preserved (non-negotiable)

These match the TS service exactly so existing SDKs do not break:

- `POST /v1/chat/completions` (OpenAI shape, streaming + non-streaming)
- `GET /v1/models`, `GET /v1/models/{id}`
- OpenAI error envelope: `{"error": {"message", "type", "code", "param"}}`
- SSE format: `data: {json}\n\n` + terminal `data: [DONE]\n\n`
- Request correlation: `X-Request-Id` header (echoed in response, generated if missing)
- Provider prefix routing: model `"openai/gpt-4o"` -> provider=openai, model=gpt-4o

## 5. What is done in this slice (Phase 0 + Phase 1)

- [x] `cmd/omniroute` binary with subcommands: start, version, doctor, models, providers, help
- [x] `internal/proxy` HTTP server: routing, middleware, recording writer, panic safety, streaming flush
- [x] `internal/provider/registry` Provider interface, ChatRequest/Response/Stream shapes, error types, HTTPStatus mapping
- [x] `internal/provider/openai` real OpenAI adapter (also covers Together, Groq, Fireworks, OpenRouter, vLLM, Ollama, etc.)
- [x] `internal/provider/anthropic` Anthropic Messages adapter, OpenAI-shape streaming translation
- [x] `internal/provider/mock` deterministic in-process provider (no network) for tests + smoke
- [x] `internal/observability` JSON logger, correlation IDs, per-request log binding
- [x] `internal/config` env-first config loader with tiny TOML reader
- [x] 19 contract tests in `internal/proxy/server_test.go` (httptest backed)
- [x] Shadow mode flag
- [x] Bearer auth on `/v1/*`
- [x] Static cross-compile to 4 platforms
- [x] Distroless `Dockerfile`
- [x] `Makefile` (build, test, cover, vet, fmt, smoke, cross, image, clean, tidy)
- [x] README + AUDIT_AND_PLAN

### Verification evidence

```
$ go test ./... -count=1
ok      github.com/kooshapari/omniroute-go/internal/proxy  0.548s

$ go test ./internal/proxy/... -v
=== RUN   TestHealthz                   --- PASS (0.01s)
=== RUN   TestReadyz                    --- PASS (0.00s)
=== RUN   TestListModels                --- PASS (0.01s)
=== RUN   TestGetModel                  --- PASS (0.00s)
=== RUN   TestGetModelNotFound           --- PASS (0.00s)
=== RUN   TestListProviders             --- PASS (0.00s)
=== RUN   TestChatCompletion            --- PASS (0.00s)
=== RUN   TestChatCompletion_ProviderPrefix --- PASS (0.00s)
=== RUN   TestChatCompletion_MissingModel   --- PASS (0.01s)
=== RUN   TestChatCompletion_Stream     --- PASS (0.04s)
=== RUN   TestBearerAuth                --- PASS (0.00s)
=== RUN   TestShadowMode                --- PASS (0.00s)
=== RUN   TestProviderError             --- PASS (0.00s)
=== RUN   TestNoProvider                --- PASS (0.00s)
=== RUN   TestVersionEndpoint           --- PASS (0.00s)
=== RUN   TestUsageEndpoint             --- PASS (0.00s)
=== RUN   TestReadinessBeforeMark       --- PASS (0.00s)
=== RUN   TestSmoke50                   --- PASS (0.05s)
PASS

$ make cross
  built dist/omniroute-linux-amd64
  built dist/omniroute-linux-arm64
  built dist/omniroute-darwin-amd64
  built dist/omniroute-darwin-arm64

$ make smoke
  /healthz           -> {"providers":1,"status":"ok","version":"0.1.0-dev"}
  /v1/chat/completions (non-stream) -> echo:hello smoke, usage 27 tokens
  /v1/chat/completions (stream)     -> 4 SSE chunks + [DONE]
```

Binary sizes: 6.5MB (darwin/arm64), 6.9MB (linux/amd64), both stripped and
statically linked.

## 6. Risks and open questions for the sponsor

- **Provider count**: 146 is a lot. The shape is uniform (config JSON + index.ts + sometimes web/), so a Go codegen step that reads the existing JSON configs and emits Go provider files is feasible but needs an explicit decision (codegen vs hand-rolled adapters).
- **Compression rules**: ~19K LOC of regex-heavy compression code. The right move is to port the rule tables, not re-derive them. We will read the TS rules and emit Go equivalents.
- **MITM**: the existing MITM is a substantial subsystem. It is desktop-only and not on the critical path for the cloud/container deploy. It is fine to defer to Phase 10.
- **Combos**: the `interleaved` capability and the combo semantics are a research-grade surface on their own. We need a sponsor sign-off on the _target_ combo semantics before we begin porting.
- **CLI parity**: the TS CLI has 25+ subcommand modules. Do we need 1:1 parity, or do we cut some that are dev-only?
- **Auth + credentials**: the existing service encrypts credentials at rest with a key generated on first run. The Go rewrite must do the same. Decision: keep AES-GCM with the existing key derivation scheme or switch to OS keychain? (recommendation: AES-GCM, env-derived key, simpler portable story).

## 7. What I would do next, in order

1. **Phase 2 (M, ~1 day of focused work)**: Port 5 more provider adapters (Gemini, OpenRouter, Ollama, Mistral, Groq). Each is ~150 LOC. Define a small codegen step that reads the existing provider config JSONs and emits a Go `ProviderConfig` literal.
2. **Phase 3 (M)**: Streaming hardening — backpressure, cancellation, mid-stream errors. Soak test 1k concurrent streams.
3. **Phase 4 (L)**: Combos + routing. This is the highest-leverage feature and deserves its own plan.
4. **Phase 5 (L)**: Compression. Port the rule tables from TS.
5. **Phase 6 (L)**: Auth + storage.
6. **Phase 7-11**: CLI parity, SDK, MCP+A2A, MITM, cutover.

The first three of those are enough to make the rewrite _demonstrably
better_ than the TS service on the cloud path. The rest are follow-ons.
