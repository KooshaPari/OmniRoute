# v54 P1-1 — open-sse MCP Scope Audit

**Date:** 2026-06-28
**Track:** open-sse MCP scope completeness audit
**Status:** Complete

## Summary

Audited the full MCP tool surface (87 tools across 10+ families) against the
30 scope tokens defined in `OMNIROUTE_MCP_SCOPES`. Found **one critical gap**
in the plugin tool family, and one advisory documentation gap.

---

## Findings

### F1 — Plugin tools missing scope property (P1)

**Location:** `open-sse/mcp-server/tools/pluginTools.ts`

**Issue:** The 8 plugin tools (plugin marketplace listing, install, enable,
disable, runtime inspection, etc.) are registered **without a `scope` property**
in their tool definition objects. Every other tool family (memory, skill,
compression, gamification, notion, obsidian, core, cache, 1proxy, agent-skill)
includes a `scope` string matching one of the 30 `OMNIROUTE_MCP_SCOPES`
tokens.

**Evidence:**

| Tool family  | Has `scope`? | Example scope token       |
|-------------|-------------|--------------------------|
| Core (20)   | Yes         | `"admin"` / `"core"`     |
| Cache (2)   | Yes         | `"cache"`                |
| Compression (5) | Yes     | `"compression"`          |
| 1proxy (3)  | Yes         | `"one_proxy"`            |
| Memory (3)  | Yes         | `"memory"`               |
| Skill (4)   | Yes         | `"skills"`               |
| Gamification (8) | Yes    | `"gamification"`         |
| Notion (6)  | Yes         | `"notion"`               |
| Obsidian (22) | Yes       | `"obsidian"`             |
| Agent-skill (3) | Yes     | `"agent_skills"`         |
| **Plugin (8)** | **No**   | **(missing)**            |

**Impact:** Without a `scope` property, plugin tools bypass scope-based access
control entirely — any API key with any scope (or none) can invoke them. This
defeats the MCP scope enforcement gauntlet in `scopeEnforcement.ts` and could
allow unauthorized plugin management.

**Recommendation:** Add `scope: "plugins"` (or a dedicated scope token) to each
plugin tool definition. If no `"plugins"` scope exists in the 30-token set,
add it to `OMNIROUTE_MCP_SCOPES`. The scope token should be defined as a
constant to stay in sync with the central scope list.

---

### F2 — OMNIROUTE_MCP_SCOPES token list review (P2)

**Location:** `open-sse/mcp-server/schemas/tools.ts`

**Issue:** The 30 `OMNIROUTE_MCP_SCOPES` tokens cover all tool families in the
base registry and standalone modules **except** `"plugins"`. No token exists for
plugin-family tools.

**Tokens present:** admin, core, cache, compression, one_proxy, memory, skills,
agent_skills, gamification, plugins (❌ absent), notion, obsidian, etc.

**Recommendation:** Add `"plugins"` as scope token #31 to
`OMNIROUTE_MCP_SCOPES`. This aligns with the pattern used by every other tool
family. Without it, scope enforcement on plugin tools will remain impossible
even after F1 is addressed.

---

### F3 — Docs out of sync with actual tool scope count (P2)

**Location:** `docs/frameworks/MCP-SERVER.md`

**Issue:** The MCP server doc states "87 tools" and "30 scopes". These counts
will diverge after adding `"plugins"` (30→31). The tool count is stale whenever
tools are added/removed.

**Recommendation:** Add a CI check or npm script that greps for
`TOTAL_MCP_TOOL_COUNT` equals `ls ... | wc -l` (actual tools) and
`OMNIROUTE_MCP_SCOPES.length` equals the scope array literal size, failing if
they drift. Reference: `npm run check:docs-counts` pattern from the
project's doc-accuracy discipline.

---

## Priority Summary

| ID | Priority | Description |
|----|----------|-------------|
| F1 | **P1** | 8 plugin tools missing `scope` property — access-control bypass |
| F2 | **P2** | No `"plugins"` token in `OMNIROUTE_MCP_SCOPES` (30→31) |
| F3 | **P2** | Doc count drift — 87 tools / 30 scopes stale on next change |

## Recommendations

1. **Immediate (P1):** Add `"plugins"` scope token → `OMNIROUTE_MCP_SCOPES` in
   `tools.ts`, then add `scope: "plugins"` to each of the 8 plugin tool
   definitions in `pluginTools.ts`.
2. **Short-term (P2):** Update `docs/frameworks/MCP-SERVER.md` scope count to
   31 (or auto-derive from source).
3. **Ongoing (P2):** Add a `npm run check:docs-counts` style drift-detection
   script for tool and scope counts.
