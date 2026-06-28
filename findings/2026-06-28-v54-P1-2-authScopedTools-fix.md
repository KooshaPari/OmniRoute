# v54 P1-2 — authScopedTools Fix

**Date:** 2026-06-28
**Status:** Fixed
**Worktree:** `omniroute-wtrees/5218-mcp-auth`

## Error Description

The `authScopedTools` function did not exist in the codebase. It was a **missing utility** — needed to bridge the MCP HTTP auth context (`httpAuthContext.ts`) with the tool scope enforcement system (`scopeEnforcement.ts` / `schemas/tools.ts`).

The existing infrastructure had:
- `httpAuthContext.ts` — captures HTTP auth headers into `AsyncLocalStorage`
- `scopeEnforcement.ts` — `evaluateToolScopes()` checks a single tool against caller scopes
- `schemas/tools.ts` — `MCP_TOOL_MAP` maps tool names to their `scopes` requirements

But there was no function to **query the authorized tool subset** for a given set of scopes.

## Root Cause

Missing `authScopedTools` utility function. The MCP server needed a way to filter the tool manifest by caller scopes — for client-side tool discovery, manifest filtering, and dashboard visibility — without iterating every tool through `evaluateToolScopes()` individually.

## Fix Applied

Implemented `authScopedTools()` in `open-sse/mcp-server/scopeEnforcement.ts` (lines 152–182).

```typescript
export function authScopedTools(
  callerScopes: readonly string[],
  enforceScopes = true,
  toolRegistry?: Record<string, { name: string; scopes?: readonly string[] }>
): ScopedToolEntry[]
```

**Interface:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `callerScopes` | — | Scopes granted to the caller (from authInfo, env, etc.) |
| `enforceScopes` | `true` | When false, all tools return `allowed: true` |
| `toolRegistry` | `MCP_TOOL_MAP` | Override tool map for dynamic tool families |

**Returns** — `ScopedToolEntry[]` sorted by allowed status (allowed first), each with:
- `name` — tool identifier
- `requiredScopes` — what scopes the tool needs
- `allowed` — whether caller qualifies
- `missing` — scopes the caller lacks

Reuses existing `scopeMatches()` and `normalizeScopeList()` from the same module.

## Verification

- `deno check open-sse/mcp-server/scopeEnforcement.ts` — **passed** (no type/syntax errors)
- All existing exports (`evaluateToolScopes`, `resolveCallerScopeContext`, etc.) preserved
- Backward-compatible — no existing callers affected
- `MCP_TOOL_MAP` default covers the 33 core registered tools; optional `toolRegistry` param enables use with dynamic tool families (memory, skills, gamification, etc.)
