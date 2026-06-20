# cheap-llm-mcp — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `cheap-llm-mcp` — **A cross-cutting concern**
**Status:** Active — MCP server for cheap Haiku-class LLM routing

### Locations

| Path | Status |
|------|--------|
| `Sidekick/crates/cheap-llm-mcp/` | **Primary** — fully populated Python project |
| `FocalPoint/cheap-llm-mcp/` | Stub (empty directory) |
| `phenoAI/python/cheap-llm-mcp/` | Stub (contains only `__pycache__` from test execution) |
| `AgilePlus/cheap-llm-mcp/` | Stub (empty directory) |

---

## 1. Overview

`cheap-llm-mcp` is an MCP (Model Context Protocol) server that exposes Minimax (MiniMax-M2.7), Kimi (kimi-k2-turbo-preview), and Fireworks-hosted models as a cheap Haiku-class reasoning provider. It is designed for high-volume, low-stakes LLM tasks: summarization, extraction, simple codegen, test-case generation, and doc polishing — where spending on full-size models like Claude Haiku would be uneconomical.

The project lives within the `Sidekick` workspace at `Sidekick/crates/cheap-llm-mcp/`, but is conceptually a standalone Python MCP server that multiple consumers (agents, CLIs, other projects) depend on.

## 2. Repository Structure

```
cheap-llm-mcp/
├── src/
│   └── cheap_llm_mcp/
│       ├── __init__.py              # Package root + re-exports
│       ├── server.py                # FastMCP server (7 tools)
│       ├── router.py                # Dispatch router with fallback + cache
│       ├── config.py                # TOML config loading + defaults
│       ├── providers/
│       │   ├── __init__.py          # Provider exports
│       │   ├── base.py              # Provider protocol, Message, Completion types
│       │   └── openai_compat.py     # OpenAI-compatible HTTP client (shared by all 3 providers)
│       ├── cache.py                 # Thread-safe TTL cache
│       ├── ledger.py                # Cost tracking with JSONL + monthly cap enforcement
│       ├── logging_util.py          # JSON structured logging with request-scoped IDs
│       ├── retry.py                 # Exponential backoff with jitter
│       └── cli.py                   # CLI interface (completion + doctor command)
├── tests/
│   ├── test_config.py
│   ├── test_cache.py
│   ├── test_ledger.py
│   ├── test_logging.py
│   ├── test_retry.py
│   ├── test_router.py
│   ├── test_streaming.py
│   ├── test_openai_compat.py
│   ├── test_smoke.py
│   ├── test_server_integration.py
│   ├── conftest.py
│   └── evals/README.md
├── config/
│   └── cheap-llm.example.toml      # Example provider configuration
├── claude/
│   ├── agents/cheap-reasoner.md     # Claude Code subagent definition
│   └── skills/thegent/SKILL.md     # Thegent skill integration
├── docs/research/
│   └── SOTA.md                     # State of the art research
├── pyproject.toml
├── Makefile
└── justfile
```

## 3. Architecture — MCP Server with Provider Router

```
┌─────────────────────────────────────────────────────────────┐
│                     FastMCP Server                            │
│  ┌──────────┐ ┌──────────────┐ ┌─────────┐ ┌────────────┐  │
│  │complete  │ │stream_compl.│ │ health  │ │cost_summary│  │
│  │          │ │              │ │         │ │            │  │
│  └────┬─────┘ └──────┬───────┘ └────┬────┘ └─────┬──────┘  │
└───────┼──────────────┼──────────────┼────────────┼──────────┘
        │              │              │            │
        ▼              ▼              ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                       Router                                  │
│  ┌──────────┐    Multi-provider dispatch                     │
│  │ TTL Cache │    with fallback ordering                      │
│  └──────────┘                                                  │
├─────────────────────────────────────────────────────────────┤
│                    Providers                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  OpenAICompatProvider (shared HTTP client)            │   │
│  │                                                       │   │
│  │  ┌──────────┐  ┌──────┐  ┌──────────┐               │   │
│  │  │ Minimax  │  │ Kimi │  │Fireworks │               │   │
│  │  └──────────┘  └──────┘  └──────────┘               │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Cross-cutting                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Retry   │ │  Ledger  │ │  Cache   │ │  Logging      │  │
│  │ (exp.bk) │ │(cost cap)│ │ (TTL)    │ │ (JSON+req ID) │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 4. Key Features

| Feature | Status | Location |
|---------|--------|----------|
| Multi-provider completion (Minimax, Kimi, Fireworks) | Done | `src/cheap_llm_mcp/router.py` |
| Auto-fallback on provider failure | Done | `src/cheap_llm_mcp/router.py` |
| Streaming completion | Done | `src/cheap_llm_mcp/server.py` |
| Provider health probes | Done | `src/cheap_llm_mcp/server.py` |
| Cost tracking ledger (JSONL) | Done | `src/cheap_llm_mcp/ledger.py` |
| Monthly cost cap enforcement | Done | `src/cheap_llm_mcp/ledger.py` |
| TTL caching (at temperature=0) | Done | `src/cheap_llm_mcp/cache.py` |
| Exponential backoff retry with jitter | Done | `src/cheap_llm_mcp/retry.py` |
| JSON structured logging with request IDs | Done | `src/cheap_llm_mcp/logging_util.py` |
| CLI interface (completion + doctor) | Done | `src/cheap_llm_mcp/cli.py` |
| Claude Code subagent integration | Done | `claude/agents/cheap-reasoner.md` |
| Thegent skill integration | Done | `claude/skills/thegent/SKILL.md` |

## 5. MCP Server Tools

| Tool Name | Function | Description |
|-----------|----------|-------------|
| `cheapllm_complete_prompt` | `complete()` | Single-shot completion with usage/cost tracking |
| `cheapllm_stream_completion` | `stream_complete()` | Stream completion (aggregated — MCP doesn't support streaming to clients) |
| `cheapllm_check_health` | `health()` | Probe all configured providers |
| `cheapllm_get_cost` | `cost_summary()` | Month-to-date cost breakdown by provider |
| `cheapllm_list_providers` | `providers()` | List known providers and their default models |
| `cheapllm_list_models` | `list_live_models()` | Query a provider's live `/models` endpoint |

## 6. Provider Configuration (Default)

| Provider | Base URL | Default Model | API Key Env Var |
|----------|----------|---------------|-----------------|
| Minimax | `https://api.minimax.io/v1` | `MiniMax-M2.7-highspeed` | `MINIMAX_API_KEY` |
| Kimi | `https://api.moonshot.ai/v1` | `kimi-k2-turbo-preview` | `MOONSHOT_API_KEY` |
| Fireworks | `https://api.fireworks.ai/inference/v1` | `accounts/fireworks/models/minimax-m2p7` | `FIREWORKS_API_KEY` |

### Variants per Provider

| Provider | Variants |
|----------|----------|
| Minimax | `base` → M2.7, `highspeed` → M2.7-highspeed, `codex` → M2.7 |
| Kimi | `turbo` → kimi-k2-turbo-preview |
| Fireworks | `minimax` → minimax-m2p7, `kimi` → kimi-k2-instruct |

## 7. Pricing Ledger (PPM Token)

| Model | Input ($/1M tokens) | Output ($/1M tokens) |
|-------|---------------------|----------------------|
| MiniMax-M2 / M2.5 / M2.7 | 0.30 | 1.20 |
| kimi-k2-turbo-preview | 0.60 | 2.50 |
| Fireworks kimi-k2-instruct | 1.00 | 3.00 |
| Unknown (_default) | 1.00 | 3.00 |

## 8. Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| fastmcp | >=2.0 | MCP server framework |
| httpx | >=0.27 | Async HTTP client for provider APIs |
| pydantic | >=2.9 | Data validation |
| tomli | >=2.0 (<3.11) | TOML config parsing |
| pytest, pytest-asyncio, respx | Dev | Testing |

## 9. Key Design Decisions

1. **Single HTTP client for all providers**: All three providers expose OpenAI-compatible `/chat/completions` endpoints, so a single `OpenAICompatProvider` class with configurable base URL handles all routing. No provider-specific SDK dependencies.

2. **TTL cache at temperature=0**: Deterministic outputs at temperature=0.0 are cached to avoid redundant provider calls during dev loops. Cache is disabled for any temperature > 0.

3. **Append-only JSONL ledger**: Cost tracking uses a simple JSONL file (`~/.cheap-llm/ledger.jsonl`) rather than a database — zero-infrastructure cost monitoring with monthly cap enforcement.

4. **Provider fallback ordering**: When `provider="auto"`, the router tries the default provider first, then falls through remaining providers in alphabetical order. Failed providers are logged and skipped.

5. **Exponential backoff with jitter**: 4 attempts with 0.5s base delay, 10s max delay, random jitter. Retryable HTTP statuses: 408, 425, 429, 500, 502, 503, 504. Also retries `ReadTimeout` and `ConnectError`.

## 10. Key Observations

1. **Cost-aware by design**: The ledger, monthly cap, and per-request cost tracking make this a rare LLM gateway that deliberately limits spending — ideal for org-wide adoption where cost governance matters.
2. **Agent-native architecture**: The subagent (`cheap-reasoner.md`) and skill definitions show this was designed as a first-class citizen of the Claude Code / Thegent agent ecosystem.
3. **Configurable without code**: All provider endpoints, models, variants, and cost caps are in TOML config — no code changes needed to add/modify providers.
4. **Stub proliferation**: The same package exists in 4 different locations (`Sidekick`, `FocalPoint`, `phenoAI`, `AgilePlus`), with only `Sidekick/crates/` being populated — likely a side effect of workspace-level copying during initial project bootstrapping.
5. **No authentication layer**: The server assumes trusted clients (local agent usage). No authn/authz — appropriate for local dev but not production multi-tenant deployment.

## 11. Recommendations

1. **Consolidate stubs**: Remove the empty directories in `FocalPoint/`, `phenoAI/`, and `AgilePlus/` — they serve only as stale references.
2. **Add integration test suite**: Current tests mock HTTP at the response level. Add integration tests against live sandbox endpoints with a test API key.
3. **Consider Redis-backed ledger for shared deployments**: The JSONL file works for single-machine usage but doesn't support multi-host deployments where ledger sharing is needed.
4. **Expose as package on PyPI**: The tool is useful beyond the Phenotype org — publishing to PyPI would enable broader adoption.
