<div align="center">

<img src="./docs/screenshots/MainOmniRoute.png" alt="OmniRoute Dashboard" width="820"/>

# OmniRoute

A self-hosted AI gateway that routes requests across 350+ LLM providers through a single OpenAI-compatible endpoint. Smart fallback, cost optimization, token compression, and a built-in dashboard.

**One endpoint. Every provider. Automatic failover.**

</div>

---

## Quick Start

```bash
# Install globally
npm i -g omniroute

# Start the server (runs on http://localhost:20128)
omniroute

# Point any OpenAI-compatible tool at it
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello!"}]}'
```

The `auto` model works out of the box with no API keys configured. Pre-wired free providers handle initial requests; add your own keys for broader coverage.

Copy-paste quickstart scripts: [`examples/quickstart/`](examples/quickstart/) (Python, Node.js, PHP, cURL).

---

## Install Methods

| Method          | Command                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| **npm**         | `npm i -g omniroute`                                                                                                |
| **pnpm**        | `pnpm add -g omniroute@latest`                                                                                      |
| **Bun**         | `bun install -g omniroute`                                                                                          |
| **Docker**      | `docker run -d --name omniroute -p 127.0.0.1:20128:20128 -v omniroute-data:/app/data diegosouzapw/omniroute:latest` |
| **Arch (AUR)**  | `yay -S omniroute-bin`                                                                                              |
| **From source** | `cp .env.example .env && npm install && npm run dev`                                                                |

**Docker sizing:** The default `OMNIROUTE_MEMORY_MB=1024` is sufficient for the dashboard and light chat. Coding agents need more:

| Workload                     | Heap (`OMNIROUTE_MEMORY_MB`) | Container (`--memory`) |
| ---------------------------- | ---------------------------- | ---------------------- |
| Dashboard / light chat       | `1024`                       | 2g                     |
| One coding agent             | `8192`                       | 10g                    |
| Two concurrent long contexts | `10240`-`12288`              | 12-16g                 |

**Native skip:** `OMNIROUTE_SKIP_POSTINSTALL=1 npm install -g omniroute` skips native SQLite compilation (CI, headless).

Full details: [Docker Guide](docs/guides/DOCKER_GUIDE.md), [Podman Guide](contrib/podman/README.md).

---

## How It Works

OmniRoute sits between your AI tools and providers, handling routing, failover, and cost optimization transparently.

**Request flow:**

1. Your tool sends a request to `http://localhost:20128/v1` (OpenAI-compatible API)
2. OmniRoute selects the best provider based on your routing configuration
3. If the provider fails or is rate-limited, automatic fallback kicks in across 4 tiers: Subscription > API Key > Cheap > Free
4. Optional token compression (RTK, Caveman, LLMLingua-2) reduces costs 15-95%

**Core features:**

- **Auto-combo routing** -- `auto/coding`, `auto/fast`, `auto/cheap`, `auto/offline` modes with 16-factor scoring
- **12-engine token compression** -- RTK, Caveman, LLMLingua-2, GCF, OmniGlyph and more
- **3-layer resilience** -- circuit breakers, key cooldown, model lockout with exponential backoff
- **MCP Server** -- 110 tools, 32 scopes for agent integration
- **A2A Protocol** -- v0.3 JSON-RPC 2.0 + SSE for multi-agent orchestration
- **Local-first** -- SQLite with WAL journaling, AES-256-GCM encrypted keys, no telemetry

---

## Supported Tools

One config (`http://localhost:20128/v1`) works with every OpenAI-compatible IDE and CLI:

| Category       | Tools                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------- |
| **IDE Agents** | Claude Code, Cursor, Cline, Kilo Code, Zoo Code, Continue, Copilot, Antigravity, Windsurf          |
| **CLI Agents** | Codex CLI, Aider, ForgeCode, jcode, OpenCode, Factory Droid, Hermes Agent, Goose, Open Interpreter |
| **Other**      | DeepSeek TUI, Warp AI, Agent Deck, OpenClaw, Grok Build, Pi, Smelt, CodeWhale                      |

Plus any tool that speaks the OpenAI API format.

**Launch tools through OmniRoute directly:**

```bash
omniroute run claude   --model openai/gpt-5.4
omniroute run codex    --model glm/glm-5.2
omniroute run aider    --model glm/glm-5.2 -- --message "reply OK"
omniroute configure codex          # interactive provider+model picker
```

Full per-tool setup: [`docs/reference/CLI-TOOLS.md`](docs/reference/CLI-TOOLS.md)

---

## Provider Support

**350+ registered providers** including OpenAI, Anthropic, Google, xAI, DeepSeek, Mistral, Qwen, Meta, Groq, NVIDIA, Cohere, Perplexity, HuggingFace, Together, Fireworks, Cloudflare, and 330+ more.

**Free tiers:** 152 providers marked `hasFree: true` in the catalog, with 34 recurring pool keys and 52 recurring/keyless free-forever providers. See [Free Tiers Reference](docs/reference/FREE_TIERS.md) for methodology.

Full provider catalog: [Provider Reference](docs/reference/PROVIDER_REFERENCE.md)

---

## Compression

The 12-engine compression pipeline reduces token usage without quality loss on most workloads:

| Engine      | Type                | Best For                      |
| ----------- | ------------------- | ----------------------------- |
| RTK         | Semantic dedup      | Repeated context across turns |
| Caveman     | Pattern compression | Structured output, code       |
| LLMLingua-2 | Neural compression  | Natural language prompts      |
| GCF         | Format optimization | JSON, XML payloads            |
| OmniGlyph   | Token elimination   | Redundant tokens              |

Savings: 15-95% depending on workload (measured average ~89% on eligible requests). Control per-request via `X-Compression-Mode` header or dashboard settings.

Architecture details: [docs/routing/REASONING_ROUTING.md](docs/routing/REASONING_ROUTING.md)

---

## Platform Support

| Platform                    | Method                   | Notes                                                   |
| --------------------------- | ------------------------ | ------------------------------------------------------- |
| **Linux / macOS / Windows** | npm, Docker, from source | Full support                                            |
| **Desktop (Tauri 2)**       | `cargo tauri build`      | Native app with system tray, offline mode, embedded SPA |
| **Android (Termux)**        | Termux package           | CLI + dashboard on mobile                               |
| **PWA**                     | Browser install          | Any Chromium-based browser                              |

---

## Configuration

Environment variables (`.env` or `config/settings.yml`):

| Variable              | Default        | Description            |
| --------------------- | -------------- | ---------------------- |
| `PORT`                | `20128`        | Server port            |
| `OMNIROUTE_MEMORY_MB` | `1024`         | V8 heap limit in MB    |
| `OMNIROUTE_LOG_LEVEL` | `info`         | Log verbosity          |
| `DATA_DIR`            | `~/.omniroute` | Data storage directory |

Full reference: [docs/reference/ENVIRONMENT.md](docs/reference/ENVIRONMENT.md)

---

## Tech Stack

| Layer     | Technology                                                             |
| --------- | ---------------------------------------------------------------------- |
| Runtime   | Node.js 22.x / 24.x LTS                                                |
| Language  | TypeScript 6.0                                                         |
| Framework | Next.js 16 + React 19 + Tailwind CSS 4                                 |
| Database  | better-sqlite3 (SQLite, WAL) + LowDB (JSON legacy)                     |
| Memory    | SQLite FTS5 full-text + int8-quantized vector embeddings               |
| Schemas   | Zod 4 (MCP tool I/O + API contracts)                                   |
| Protocols | MCP (stdio/HTTP/SSE) + A2A v0.3 (JSON-RPC 2.0 + SSE)                   |
| Auth      | OAuth 2.0 (PKCE) + JWT + API Keys + AES-256-GCM at rest                |
| Stealth   | wreq-js (JA3/JA4 TLS fingerprint impersonation, 3-level proxy)         |
| Desktop   | Tauri 2 (Rust)                                                         |
| Testing   | Node.js test runner + Vitest (39,000+ declarations, 5,100+ test files) |
| CI/CD     | GitHub Actions                                                         |

---

## Documentation

| Topic               | Link                                                                     |
| ------------------- | ------------------------------------------------------------------------ |
| Getting started     | [USER_GUIDE.md](docs/guides/USER_GUIDE.md)                               |
| Provider setup      | [USER_GUIDE.md#provider-setup](docs/guides/USER_GUIDE.md#provider-setup) |
| CLI integrations    | [CLI-INTEGRATIONS.md](docs/guides/CLI-INTEGRATIONS.md)                   |
| Docker / deployment | [DOCKER_GUIDE.md](docs/guides/DOCKER_GUIDE.md)                           |
| Dashboard features  | [FEATURES.md](docs/guides/FEATURES.md)                                   |
| Desktop app         | [DESKTOP_GUIDE.md](docs/guides/DESKTOP_GUIDE.md)                         |
| Troubleshooting     | [TROUBLESHOOTING.md](docs/getting-started/TROUBLESHOOTING.md)            |
| API reference       | [API_REFERENCE.md](docs/reference/API_REFERENCE.md)                      |
| Environment vars    | [ENVIRONMENT.md](docs/reference/ENVIRONMENT.md)                          |
| Provider catalog    | [PROVIDER_REFERENCE.md](docs/reference/PROVIDER_REFERENCE.md)            |
| Architecture        | [CODEBASE_DOCUMENTATION.md](docs/architecture/CODEBASE_DOCUMENTATION.md) |
| Repository map      | [REPOSITORY_MAP.md](docs/architecture/REPOSITORY_MAP.md)                 |
| Quality gates       | [QUALITY_GATES.md](docs/architecture/QUALITY_GATES.md)                   |

---

## License

MIT
