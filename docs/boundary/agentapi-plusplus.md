# agentapi-plusplus — Boundary

> Stub boundary file generated on 2026-06-18 by `scripts/render-stubs.py`
> for canonical repos with no curated prompts yet.

## In Scope

- Single-binary HTTP API gateway (`go build -o agentapi main.go`, listens on `:3284`) wrapping an in-memory PTY
- 11 supported agent CLIs: Claude Code, Cursor, Aider, Goose, Codex, Gemini, GitHub Copilot, Sourcegraph Amp, Auggie, Opencode, Amazon Q
- REST endpoints: `POST /message`, `GET /messages`, `GET /status`, `GET /events` (SSE), `GET /health`, `GET /version`, `GET /info`, `/chat` (Next.js UI)
- Agent-specific message formatters under `lib/msgfmt/<name>.go`; new agent types add a formatter + `Supported Agents` table row
- OpenAPI schema at `/openapi.json` for downstream SDK generation
- 74+ commits of Phenotype hardening (Cobra CLI, Viper config, Huma HTTP, SSE event stream, Anthropic-aligned message types) staged for upstream

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| MCP server / runtime for fleet dispatch | `PhenoMCPServers` (ADR-017 three-layer MCP model) | agentapi++ is the cli_proxy plane; MCP servers consume it via HTTP |
| Native agent SDKs (Claude Agent SDK, Codex SDK, etc.) | upstream vendors (Anthropic, OpenAI, etc.) | agentapi++ wraps the CLIs, not the native SDKs |
| Browser-based chat UI framework | `OmniRoute` / `phenotype-hub` | agentapi++ ships a static `/chat` HTML; richer UI lives elsewhere |
| Cost / budget / quota / audit logic for LLM calls | `pheno-mcp-router` (L5-104 absorption) | Dispatch-side cost governance lives in pheno-mcp-router, not at the agent-driver edge |
| LLM proxy / CLI subscription routing | `cliproxyapi-plusplus` / `phenotype-gateway` (planned) | agentapi++ can be wired to cliproxy++ via `--llm-provider`, but does not own that path |

## Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Agent CLI execution | this-repo→11 agent CLIs | PTY + Cobra subcommand | green |
| MCP server integration | thegent (MCP) → this-repo | `mcp.servers.agentapi` config | green |
| LLM provider routing | this-repo→cliproxy++ | HTTP `--llm-provider` flag | amber — `phenotype-gateway` is the planned canonical home per ADR-ECO-014 |
| Cost / budget / quota tracking | this-repo→pheno-mcp-router | HTTP / MCP | green — already absorbed per L5-104 |
| 11-agent event stream (SSE) | this-repo→fleet dispatch | SSE consumer | green |

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Source-of-Truth

- ECOSYSTEM_MAP.md § 6 (role classification)
- docs/intent/agentapi-plusplus.md (intent statement)
- docs/registries.md (Capability & Intent SSOT layer)
