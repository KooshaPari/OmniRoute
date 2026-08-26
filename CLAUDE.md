# CLAUDE.md

## Project Overview

OmniRoute is a free, open-source AI gateway that routes requests across 237+ AI providers (90+ free tiers). It provides a single OpenAI-compatible endpoint (`/v1`) for all coding agents and AI tools, with automatic fallback, token compression, and cost optimization.

## Tech Stack

- **Language:** TypeScript 6.0 (100% TS, zero `any` in core)
- **Runtime:** Node.js 22.x or 24.x LTS
- **Framework:** Next.js 16 + React 19 + Tailwind CSS 4
- **Database:** better-sqlite3 (SQLite) + LowDB (JSON legacy)
- **Testing:** Vitest (21,000+ test cases)
- **License:** MIT

## Key Architecture

- Smart router with 17 routing strategies (priority, weighted, cost-optimized, fusion, etc.)
- 10-engine token compression pipeline (RTK, Caveman, LLMLingua-2, etc.)
- Circuit breakers, connection cooldowns, model lockout for resilience
- MCP server (95 tools), A2A agent protocol
- OAuth 2.0 (PKCE), JWT, API Keys, scoped authorization

## Build & Run

```bash
npm install && npm run dev    # Development (port 20128)
npm install -g omniroute      # Global install
docker run -d -p 20128:20128 diegosouzapw/omniroute:latest
```

## Entry Points

- Dashboard: `http://localhost:20128`
- API: `http://localhost:20128/v1`
- MCP: `http://localhost:20128/api/mcp/stream`
- A2A: `http://localhost:20128/.well-known/agent.json`

## Development Notes

- 237 providers with auto-fallback (Subscription → API → Cheap → Free)
- RTK + Caveman compression saves 15–95% tokens
- This is a worktree of the OmniRoute repo; see main repo for full docs.
