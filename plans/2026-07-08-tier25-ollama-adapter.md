# Tier 2.5 — Ollama Provider Adapter

**Target**: `omniroute-provider/src/ollama.rs`  
**Depends**: omniroute-core Provider trait + types (shipped Phase 2)  
**Contract**: Implements `Provider` trait with streaming, non-streaming, model listing, and ping.

## Why Ollama

Ollama is the most popular local-first LLM runtime. Adding it closes a key gap:
- Existing adapters: OpenAI (remote), Anthropic (remote), Gemini (remote)
- Missing: local-first (Ollama, vLLM, LM Studio)
- Ollama is the largest install base and uses the OpenAI-compatible wire format → minimal code

## File: `crates/omniroute-provider/src/ollama.rs`

## Wire format
Ollama `/v1/chat/completions` is OpenAI-compatible with minor differences:
- No `model` field in streaming chunks (falls back to request model)
- Auth: none by default (can pass `Authorization: Bearer <key>` if configured)
- Base URL: `http://localhost:11434` by default, overridable via env or ProviderInitContext

## Implementation checklist

- [ ] `OllamaProvider` struct: same shape as `OpenAIProvider`
- [ ] `new()`: reads base URL from `ProviderInitContext.base_url`, defaults to `http://localhost:11434`
- [ ] `chat_completion()`: POST `/v1/chat/completions`, returns `ChatResponse`
- [ ] `chat_completion_stream()`: POST with streaming SSE, mpsc::Sender pattern (same as OpenAI)
- [ ] `models()`: GET `/v1/models` → `Vec<Model>`
- [ ] `ping()`: GET `http://<base>/` (root, not /v1/models)
- [ ] `ProviderInitContext` is already available from omniroute-core

## Test strategy

1. `ollama_provider_requires_base_url` — Unit test (no network)
2. `ollama_provider_defaults_to_localhost` — Unit test
3. `ollama_provider_uses_custom_base_url` — Unit test
4. Response parsing tests — mock JSON fixtures
5. Integration test (optional): `cargo test --features integration-tests` with a running Ollama instance

## Estimated effort

- **Implementation**: ~120 lines (most logic reuses OpenAI patterns)
- **Tests**: ~80 lines
- **Total**: ~200 lines, 1 session
