# cheap-llm-mcp Spec Harvest — 2026-06-11

**Source:** `/tmp/dispatch-batch/agent_06_cheapllm_spec.out`
**Producer:** `dispatch-worker tier=worker` → routed to backend `gemini-3-flash-preview` (per file header)
**Date:** 2026-06-11
**Status:** viable

## Summary

This is the V4 launch background agent `A6` (per the side-archive dispatch table) producing a **spec extraction / implementation plan** for consuming `cheap-llm-mcp` into `dispatch-mcp` so the latter becomes the canonical worker router for the phenotype org. The output is a well-structured 4-section plan: (1) Plan Summary with the current public surface of `cheap-llm-mcp` (`src/index.ts`, `src/server.ts`, `src/llm-provider.ts`, `src/types.ts`), the proposed re-export list, an exact PR title (`refactor: modularize codebase and expose public API surface`), summary, and validation steps, plus a unified diff of `src/index.ts`; (2) a per-file implementation checklist; (3) exact validation commands; (4) risks and blockers (circular deps, breaking changes for `npx` consumers, env-var handling).

The producer (Gemini 3 Flash preview) is the strongest free-tier backend in this batch — the diff is plausible, the checklist maps line counts to the right files, and the risk callouts (circular deps from moving `main()` to a new `cli.ts`, `package.json` `bin` field, `.env` handling in the `CheapLLMServer` constructor) are the real gotchas a human reviewer would flag. This file is the **only** harvest in this batch that is directly actionable: a follow-up dispatch can take the spec verbatim, open the PR with the suggested title, and execute the 5-step checklist against `cheap-llm-mcp/`.

Cross-walk to V4: this maps cleanly to **Side DAG C** in the V4 DAG (§9, line 379) and specifically to §9.5 "Wrap cheap-llm-mcp as a dispatch-mcp adapter" (line 393). The V3 exec log already documents (§4 line 1192) that `dispatch-mcp` has `kimi` and `minimax` tiers pre-registered in `dispatch_mcp/server.py:60-71`, so the consumption is partially done and this spec is the missing half (fireworks tier, router config preset, and the lib-API re-export layer).

## Original Output

```text
>>> dispatch-worker tier=worker model=Worker endpoint=http://localhost:20128/v1
>>> routed to backend: gemini-3-flash-preview
### 1. Plan Summary

#### Current Public Surface
* `src/index.ts`: Entry point for the MCP server.
* `src/server.ts`: Implementation of the `CheapLLMServer` class and MCP tool handlers.
* `src/llm-provider.ts`: Abstract base and concrete implementations for LLM providers (OpenAI, Anthropic).
* `src/types.ts`: Internal type definitions for configuration and API responses.

#### Re-Export List
* `src/index.ts` -> `CheapLLMServer` (from `src/server.ts`)
* `src/index.ts` -> `LLMProvider`, `OpenAIProvider`, `AnthropicProvider` (from `src/llm-provider.ts`)
* `src/index.ts` -> `ConfigSchema` (from `src/types.ts`)

#### Exact PR Title / Summary / Validation
* **Title**: `refactor: modularize codebase and expose public API surface`
* **Summary**: This PR restructures the project to support programmatic usage as a library while maintaining its functionality as a standalone MCP server. It introduces a clean export structure in `index.ts` and decouples the server logic from the CLI entry point.
* **Validation**:
    * Run `npm run build` to ensure types are generated correctly.
    * Execute `npm test` to verify tool handlers and provider logic.
    * Link the package locally and import `CheapLLMServer` in a test script.

#### Exact Diff
```diff
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,15 +1,6 @@
 #!/usr/bin/env node
-import { Server } from "@modelcontextprotocol/sdk/server/index.js";
-import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
-import {
-  CallToolRequestSchema,
-  ListToolsRequestSchema,
-} from "@modelcontextprotocol/sdk/types.js";
-import { CheapLLMServer } from "./server.js";
+export { CheapLLMServer } from "./server.js";
+export { OpenAIProvider, AnthropicProvider } from "./llm-provider.js";
+export * from "./types.js";
 
-const server = new CheapLLMServer();
-const transport = new StdioServerTransport();
-server.connect(transport).catch((error) => {
-  console.error("Server error:", error);
-  process.exit(1);
-});
+import { main } from "./cli.js";
+if (require.main === module) { main(); }
```

### 2. Implementation Checklist

- [ ] `src/index.ts` (Modify: ~15 lines)
- [ ] `src/cli.ts` (Create: ~20 lines)
- [ ] `src/server.ts` (Modify: ~10 lines)
- [ ] `src/llm-provider.ts` (Modify: ~5 lines)
- [ ] `package.json` (Modify: ~5 lines)

### 3. Validation Commands

```bash
# Clean and build the project
npm run clean && npm run build

# Run unit tests
npm test

# Verify CLI execution
node build/index.js --help

# Verify programmatic import (requires local link or manual check)
node -e 'require("./build/index.js").CheapLLMServer ? process.exit(0) : process.exit(1)'
```

### 4. Risks / Blockers

* **Circular Dependencies**: Moving `main()` logic to a new `cli.ts` might create issues if `server.ts` imports from `index.ts`. Ensure unidirectional flow.
* **Breaking Changes**: External consumers using the CLI via `npx` must ensure the `bin` field in `package.json` still points to the transpiled `index.js`.
* **Environment Variables**: Programmatic usage may bypass standard `.env` loading if not handled explicitly in the `CheapLLMServer` constructor.
```

## Cross-Reference

- V4 DAG: `FLEET_100TASK_DAG_V4.md` §9 (Side DAG C — dispatch-mcp T1.0→T1.5 + cheap-llm-mcp consumption) and specifically §9.5 "Wrap cheap-llm-mcp as a dispatch-mcp adapter" (line 393–395). Also `agent-v5-prep/dispatch_mcp_consumption.md` referenced in §1.2 row C.
- V4 side-archive: `FLEET_100TASK_DAG_V4_SIDEARCHIVE_TOKN_PINE_KMOBILE_PHENOCONTRACTS.md` §"Background Agents In-Flight" row A6 (kimi-direct tier, cheap-llm-mcp plan, "running"); L1 task #6 (cheap-llm-mcp consumption audit, lines 102–110) which expands on this plan with a per-file checklist, PR title/body, and validation commands.
- V3 log: `V3_EXECUTION_LOG_2026_06_10.md` §4 "dispatch-mcp Already Has `minimax` + `kimi` Tiers" (line 1192) — confirms that `kimi` and `minimax` are already wired in `dispatch_mcp/server.py:60-71` and identifies `fireworks` as the missing tier for full cheap-llm-mcp coverage. Also §"Background Agent Dispatch" row #8 (Cheap-LLM-MCP consumption plan) which produced `/tmp/agent-audits-v2/cheapllm.out`.
- Confidence: **HIGH** for the spec's structural correctness and risk callouts (Gemini 3 Flash produced a coherent implementation plan that aligns with the V3-era source review); **MEDIUM** for the exact diff (the line counts and the `cli.ts` extraction are plausible but unverified — a follow-up agent with cheap-llm-mcp repo access should land the PR before relying on the diff byte-for-byte).
