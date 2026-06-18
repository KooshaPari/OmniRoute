# cheap-llm-mcp Archive — 2026-06-15

**Date:** 2026-06-15
**Lane:** L5 (Architecture)
**Wave:** v6
**Subagent:** A (subagent-A-cheap-llm-result.md)

## Executive summary

`cheap-llm-mcp` is in End-of-Life/archived state. The lib refactor (commit `f951ff4`) is the final addition before formal archive. Pushed to origin (`986d7a4..f951ff4`).

## What was done

1. **`src/cheap_llm_mcp/__init__.py`** — Added `providers` to `__all__` (18 names total)
2. **`tests/test_public_api.py`** — New 55-line regression test that locks in the public surface
3. **Build:** `uv build --wheel` → 8.2 KB wheel
4. **Lint:** `ruff check` clean
5. **Format:** `ruff format --check` clean
6. **Commit:** `f951ff4 refactor(lib): expose providers submodule in top-level public API`
7. **Pushed:** `git push origin main` → `986d7a4..f951ff4`

## Test results

- 43/43 tests pass
- Public API regression test locks in 18 names via closure-based test

## Status

- `cheap-llm-mcp` package: deprecated (version 0.5.0+deprecated.20260615)
- Library: moved to `PhenoMCP[cheap-llm]`
- Runtime replacement: `dispatch-mcp`
- ADR-007: cheap-llm-mcp deprecation (Accepted)
- ADR-008: dispatch-mcp as sole MCP server (Accepted)

## Next steps

1. Formal GitHub archive (admin action, blocked on gh auth identity)
2. `DEPRECATED.md` comprehensive — already in `cheap-llm-mcp/DEPRECATED.md`
3. `MIGRATION.md` — already in `cheap-llm-mcp/MIGRATION.md`
4. Archive in `archive/cheap-llm-mcp-2026-06-15/` — already done (parent monorepo)

## Evidence

- `cheap-llm-mcp/DEPRECATED.md` (comprehensive deprecation notice)
- `cheap-llm-mcp/MIGRATION.md` (migration guide)
- `archive/cheap-llm-mcp-2026-06-15/README.md` (archive directory)
- `findings/2026-06-15-DAG-V6-FINAL-v1.md` (section 1)
- `/tmp/subagent-A-cheap-llm-result.md`
- commit `f951ff4` in cheap-llm-mcp
