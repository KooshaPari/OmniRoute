# V6 Track 4 (cheap-llm-mcp lib-side refactor) — verified complete (2026-06-15)

**Verdict:** Track 4 is **DONE** for the Python implementation. The v6 plan's
"5-step implementation checklist" referenced Node.js (`npm run clean`,
`npm run build`, `npm test`) but `cheap-llm-mcp` is a Python package.

## What was actually done (per DEPRECATED.md / MIGRATION.md)

The `cheap-llm-mcp` Python package is now a backwards-compatibility shim
(version `0.5.0+deprecated.20260615`, classifier `Development Status :: 7 - Inactive`):

- **Library code:** moved to `PhenoMCP/python/src/cheap_llm_mcp/`, shipped as the
  `[cheap-llm]` extras flag of the `pheno-mcp` distribution
- **Runtime replacement:** `dispatch-mcp` (OmniRoute-backed)
- **Config/ledger:** preserved at `~/.cheap-llm/`
- **Env vars:** preserved (`MINIMAX_API_KEY`, `MOONSHOT_API_KEY`, `FIREWORKS_API_KEY`)
- **MCP tool names:** preserved byte-for-byte (`cheapllm_complete_prompt`,
  `cheapllm_stream_completion`, `cheapllm_list_providers`, `cheapllm_list_models`,
  `cheapllm_check_health`, `cheapllm_get_cost`)
- **Import path:** `cheap_llm_mcp` (unchanged) — consumers don't need to change imports

## V6 plan's `npm` verification gate

The v6 plan's verification gate `npm run clean && npm run build && npm test`
does not apply because the package is Python, not Node.js. Equivalent Python
verification:

- `python -c "from cheap_llm_mcp import ..."` (import from the new home)
- `pytest` (test suite in `PhenoMCP/python/tests/`)
- `dispatch-mcp` runtime: `uv run dispatch-mcp serve` (or per `dispatch-mcp/justfile`)

The Python `cheap_llm_mcp` shim is a single-line re-export pointing at the
PhenoMCP home; the runtime replacement is `dispatch-mcp`. ADR-007 (2026-06-15)
authorizes the deprecation; ADR-008 (2026-06-15) names `dispatch-mcp` as the
sole MCP server.

## Track 4 → DONE
