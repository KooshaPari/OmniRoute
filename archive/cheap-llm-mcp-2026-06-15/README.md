# cheap-llm-mcp Archive (2026-06-15)

**Status:** READ-ONLY ARCHIVE. No new development.

## Why archived
Per ADR-007 (docs/adr/2026-06-15/ADR-007-cheap-llm-mcp-deprecation.md) and ADR-008 (docs/adr/2026-06-15/ADR-008-dispatch-mcp-sole-mcp-server.md), the Phenotype fleet consolidates MCP servers into `dispatch-mcp`. The `cheap-llm-mcp` repository's functionality has been folded into `dispatch-mcp` over the W1 wave (plan ID `W1-2`).

## What was here
- OpenAI-compat provider pattern (LiteLLM-style: openai, anthropic, fireworks, groq, together, minimax, kimi, deepseek, minimax)
- Tier allowlisting and rate limiting
- Cheap-tier routing logic (route expensive requests to cheap models)
- Initial test harness for cheap-tier providers

## What replaced it
All functionality is now in:
- `dispatch-mcp/src/dispatch_mcp/server.py` (the 10+ tier allowlist)
- `dispatch-mcp/src/dispatch_mcp/provider.py` (the OpenAI-compat provider pattern - to be added in W1.3)
- `dispatch-mcp/src/dispatch_mcp/router.py` (the cheap-tier routing - to be added in W1.3)

## Pointers
- `dispatch-mcp` source: ./dispatch-mcp/
- `cheap-llm-mcp` source (live): /Users/kooshapari/CodeProjects/Phenotype/repos/cheap-llm-mcp
- V5 plan: ./plans/2026-06-15-CONSOLIDATED-DAG-V5.md
- ADR-007: ./docs/adr/2026-06-15/ADR-007-cheap-llm-mcp-deprecation.md
- ADR-008: ./docs/adr/2026-06-15/ADR-008-dispatch-mcp-sole-mcp-server.md

## Removal
The `cheap-llm-mcp` GitHub repo will be archived (read-only) on 2026-09-15.
This `archive/cheap-llm-mcp-2026-06-15/` directory will be deleted on 2026-12-31.
