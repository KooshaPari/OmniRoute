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

## Development Notes

- This is a temporary worktree for transport worker probe operations.
- See main repo for full documentation.
