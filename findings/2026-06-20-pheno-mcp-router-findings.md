# pheno-mcp-router — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `pheno-mcp-router/` — Canonical FastMCP router substrate (Python)
**Status:** ACTIVE — ADR-013 substrate, v0.1.0

---

## 1. Overview

`pheno-mcp-router` is the **canonical FastMCP router substrate** (per ADR-013) for all `pheno-mcp-*` servers in the Phenotype ecosystem. It provides a generic FastMCP router wrapping backend HTTP endpoints with tier allowlisting, payload sanitization, response allowlisting, cost tracking, budget enforcement, quota management, and audit logging. This eliminates boilerplate for per-MCP-server wrappers like `dispatch-mcp` and `cheap-llm-mcp`.

**Language:** Python >= 3.10
**Build System:** Hatchling (`pyproject.toml`)
**License:** MIT + Apache-2.0 (dual)
**Author:** Phenotype / Koosha Pari

---

## 2. Repository Structure

```
pheno-mcp-router/
├── src/pheno_mcp_router/       # Main package (11 source files, ~2,600 lines)
│   ├── __init__.py             # McpRouter dataclass, TierRoute, re-exports
│   ├── adapters.py             # OpenAI, Anthropic, storage, and tool adapters
│   ├── audit.py                # AuditLog, AuditEntry, AuditSummary
│   ├── budget.py               # BudgetTracker, BudgetPolicy, BudgetSnapshot
│   ├── cli.py                  # Click CLI scaffold (`init` command)
│   ├── config.py               # Centralized configuration with env-var overrides
│   ├── cost.py                 # CostCalculator, TokenEstimator, CostEstimate
│   ├── cost_middleware.py      # CostAwareLlmAdapter, TierWorker, middleware pipeline
│   ├── ports.py                # Hexagonal L4 port protocols (LlmPort, StoragePort, ToolPort)
│   ├── quota.py                # QuotaTracker, QuotaPolicy, QuotaSnapshot
│   └── tiers.py                # TierRegistry, TierPricing, 10-tier pricing table
├── tests/                      # 8 test files, ~110 tests
│   ├── test_smoke.py           # McpRouter smoke tests
│   ├── test_ports.py           # Port protocol + adapter tests
│   ├── test_tiers.py           # Tier registry tests
│   ├── test_audit.py           # Audit log tests
│   ├── test_budget.py          # Budget tracker tests
│   ├── test_cost.py            # Cost calculator tests
│   ├── test_cost_middleware.py # Cost middleware integration tests
│   └── test_quota.py           # Quota tracker tests
├── docs/
│   └── PROVIDER_GUIDE.md       # LLM provider adapter guide
├── examples/
│   └── quickstart.py           # Runnable example
├── .github/                    # CI, CODEOWNERS, templates
├── pyproject.toml              # Build config, dependencies, scripts
├── README.md, AGENTS.md, SPEC.md, CHANGELOG.md, CONTRIBUTING.md
├── justfile                    # Task runner
├── deny.toml                   # cargo-deny config (advisory, per org convention)
├── audit_scorecard.json        # 71-pillar: 58/81 (grade C-)
└── pyrightconfig.json          # Strict mode type checking
```

---

## 3. Core Architecture

### 3.1 McpRouter — The Central Coordinator

The `McpRouter` dataclass (`__init__.py:38-143`) wraps a `FastMCP` instance and provides a fluent API:

```
McpRouter(name, backend_url)
  ├── add_tier(name, route)  → registers a valid dispatch tier
  ├── add_tool(tier, fn)     → registers an MCP tool for a tier
  ├── dispatch(tier, payload)→ validates → sanitizes → POSTs → allowlists response
  └── serve()                → mcp.run() — starts FastMCP server
```

**Security layers** in `dispatch()`:
1. Tier allowlisting — validates against `add_tier()`-registered tiers
2. Payload sanitization — drops keys not in `sanitize_keys` (default: `{model, messages, temperature, max_tokens}`)
3. Response allowlisting — drops keys not in `response_keys` (default: `{id, model, choices, usage}`)
4. Size limits — `max_message_bytes` (128K) and `max_response_bytes` (512K) for DoS protection

### 3.2 Hexagonal L4 Ports (`ports.py`)

Three `@runtime_checkable` Protocols:

| Protocol | Method | Purpose |
|---|---|---|
| `LlmPort` | `async chat(messages, model) -> str` | Chat completion |
| `StoragePort` | `async get/set/delete` | Async key/value store |
| `ToolPort` | `name()/description()/async invoke(args)` | MCP-style tool |

Corresponding ABCs (`LlmAdapter`, `StorageAdapter`, `ToolAdapter`) for nominal subtyping.

### 3.3 Adapters (`adapters.py`)

| Adapter | Implements | Notes |
|---|---|---|
| `OpenAIAdapter` | `LlmAdapter` | Async OpenAI chat completions |
| `AnthropicAdapter` | `LlmAdapter` | Splits system messages, uses `x-api-key` |
| `InMemoryStorageAdapter` | `StorageAdapter` | Dict-backed KV for tests |
| `JsonFileStorageAdapter` | `StorageAdapter` | Crash-safe JSON file KV |
| `EchoToolAdapter` | `ToolAdapter` | Echo args (smoke tests) |
| `PromptTestToolAdapter` | `ToolAdapter` | Wraps pheno-prompt-test |

### 3.4 Cost Tracking (`cost.py` + `tiers.py`)

- **TokenEstimator** — chars/4 heuristic with OpenAI/Anthropic usage parsing
- **CostCalculator** — Pure function using tier registry pricing
- **10-tier pricing** (hardcoded): worker ($0.20/$0.60), main ($1.25/$5.00), codeman, freetier, kimi, kimi_thinking, minimax, opus ($15/$75), haiku, gemini
- **CostAwareLlmAdapter** — Full middleware pipeline: estimate → quota gate → budget gate → call → estimate → record

### 3.5 Budget & Quota Enforcement

- **BudgetTracker** — Thread-safe, two-phase `check()`/`record()`, global + per-tier limits
- **QuotaTracker** — Sliding-window deque per tier + global, injectable clock

### 3.6 Audit Trail (`audit.py`)

- **AuditLog** — Thread-safe, append-only, optional JSONL sink, FIFO eviction
- **AuditEntry** — Frozen dataclass with request_id, tier, model, cost, decision

---

## 4. Dependencies

| Dependency | Type | Role |
|---|---|---|
| `click` | runtime | CLI framework |
| `httpx` | runtime | Async HTTP client |
| `fastmcp` | runtime | FastMCP server framework |
| `pheno-prompt-test` | optional | Prompt regression harness |
| `pytest` | dev | Test runner |
| `pyright>=1.1.390` | dev | Strict type checking |

---

## 5. Configuration

All config centralized in `config.py`:

| Constant | Default | Env Override |
|---|---|---|
| `DEFAULT_SANITIZE_KEYS` | `{model, messages, temperature, max_tokens}` | **Not overridable** (security) |
| `DEFAULT_RESPONSE_KEYS` | `{id, model, choices, usage}` | **Not overridable** (security) |
| `MAX_MESSAGE_BYTES` | 128,000 | `PHENO_MAX_MESSAGE_BYTES` |
| `MAX_RESPONSE_BYTES` | 512,000 | `PHENO_MAX_RESPONSE_BYTES` |
| `DEFAULT_TIMEOUT_SECONDS` | 60.0 | `PHENO_TIMEOUT_SECONDS` |

---

## 6. Test Coverage

| Test File | Tests | Focus |
|---|---|---|
| `test_smoke.py` | 3 | Core router operations |
| `test_tiers.py` | 17 | Pricing, registry CRUD |
| `test_cost.py` | 16 | Token estimation, cost calculation |
| `test_budget.py` | 18 | Budget policy, tracker, thread safety |
| `test_quota.py` | 18 | Quota policy, sliding window |
| `test_audit.py` | 16 | Audit log, filter, summarize |
| `test_cost_middleware.py` | 15 | Full pipeline integration |
| `test_ports.py` | 7 | Protocol duck-typing, HTTP adapters |

**Total:** ~110 tests
**Quality gate:** 85% coverage minimum

---

## 7. Key Observations

1. **Ported from `dispatch-mcp`** W2-1 per L5-104.1
2. **Security-first design**: sanitize/response keys are hardcoded, not overridable
3. **Two-phase budget/quota**: prevents charging for failed dispatches
4. **Thread-safe**: all trackers use `threading.Lock()`
5. **No pytest-asyncio**: uses `asyncio.run()` directly
6. **Python project, but has `deny.toml`**: per ADR-023 Rule 3.1 convention
7. **Audit score: 58/71 (C-)** — strong Architecture/Security/Complexity/Type Safety

---

## 8. Recommendations

1. **Integrate pheno-otel** for structured observability
2. **Add performance benchmarks** — currently at 0 in audit
3. **Document tier pricing update process** — hardcoded values will drift
4. **Consider remote pricing** for dynamic updates
5. **Add end-to-end integration tests** with real FastMCP lifecycle
