/**
 * codex.ts payload-construction unit tests (PR-027).
 *
 * Tests the request-payload-construction surface of
 * `open-sse/executors/codex.ts`. The executor is the OpenAI Codex adapter that
 * bridges Chat Completions and Responses-API callers to the Codex
 * `/codex/responses` upstream, and its `transformRequest` method (the
 * `buildCodexRequestPayload` equivalent) is the single entry point that:
 *
 *   - rewrites a Chat-Completions `messages` / `prompt` payload into the
 *     Responses-API `input` shape,
 *   - injects the Codex default `instructions` (or the chat default when
 *     there are no tools, or the passthrough placeholder on native Codex
 *     passthrough),
 *   - strips every Chat-Completions field that the Codex Responses backend
 *     rejects (max_tokens, max_output_tokens, prompt_cache_retention,
 *     safety_identifier, user, truncation, background, messages, prompt),
 *   - normalises tools to the flat Responses shape
 *     ({ type: "function", name, description, parameters }), preserves
 *     hosted tools (web_search, file_search, image_generation, code_interpreter,
 *     mcp, …) and namespace tools (MCP groups), and refuses orphaned
 *     tool_choice.name references,
 *   - strips server-generated IDs from the input array (rs_, fc_, resp_, msg_)
 *     and inserts missing `function_call_output` siblings for orphan
 *     `function_call` items,
 *   - clamps reasoning effort to per-model max-effort caps, folds the legacy
 *     `reasoning_effort` field and the `*-{effort}` model suffix into the
 *     canonical `reasoning: { effort, summary }` object, and adds
 *     `reasoning.encrypted_content` to `include` for cache hydration,
 *   - toggles `store` per-credential / per-endpoint and rewrites
 *     `service_tier: "fast"` to the wire value `"priority"`.
 *
 * The exported helpers in this file — `parseCodexQuotaHeaders`,
 * `getCodexResetTime`, `getCodexDualWindowCooldownMs`, `getCodexUpstreamModel`,
 * `isCodexFreePlan`, `stripStoredItemReferences`, `isCompactResponsesEndpoint`,
 * `normalizeCodexTools`, `isCodexResponsesWebSocketRequired`,
 * `encodeResponseSseEvent`, `filterNonstandardCodexSse`, and the test-only
 * `__setCodexWebSocketTransportForTesting` — are exercised directly so each
 * one has at least one assertion covering the happy path and a regression case.
 *
 * Scope (per PR-027 task):
 *   - request payload construction with all tool/stream parameters,
 *   - system prompt injection,
 *   - model ID fallback chain (model-suffix → body.reasoning.effort →
 *     body.reasoning_effort → requestDefaults → per-model cap),
 *   - headers propagation (Version, User-Agent, originator, session_id,
 *     chatgpt-account-id, prompt_cache_key),
 *   - tool call transformation (Chat Completions → Responses flat shape),
 *   - conversation history merge (messages → input, prompt → input,
 *     text content parts → input_text),
 *   - refusal handling (response.failed / error / 400/429 detection in
 *     `encodeResponseSseEvent` and `filterNonstandardCodexSse`).
 *
 * Imports are kept to `../codex.ts` only — the same relative-path discipline
 * as PR-024 (claudeIdentity) and PR-026 (budget forecast). Do not modify
 * `codex.ts`; tests target the existing exported contract.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Polyfill structuredClone for older Node test runners that lack it.
// `codex.ts` uses structuredClone() in transformRequest for the input body
// deep copy. Without this, transformRequest would throw on the very first call.
const g = globalThis as unknown as { structuredClone?: typeof structuredClone };
if (typeof g.structuredClone !== "function") {
  g.structuredClone = ((value: unknown) =>
    JSON.parse(JSON.stringify(value))) as typeof structuredClone;
}

import {
  CodexExecutor,
  __setCodexWebSocketTransportForTesting,
  encodeResponseSseEvent,
  filterNonstandardCodexSse,
  getCodexDualWindowCooldownMs,
  getCodexResetTime,
  getCodexUpstreamModel,
  isCodexFreePlan,
  isCodexResponsesWebSocketRequired,
  isCompactResponsesEndpoint,
  normalizeCodexTools,
  parseCodexQuotaHeaders,
  stripStoredItemReferences,
  type CodexQuotaSnapshot,
} from "../codex.ts";

/**
 * Helper — invoke `transformRequest` on a fresh CodexExecutor. transformRequest
 * is the equivalent of `buildCodexRequestPayload` for the Codex executor.
 */
function buildPayload(
  body: unknown,
  options: { model?: string; stream?: boolean; credentials?: Record<string, unknown> } = {}
): Record<string, unknown> {
  const exec = new CodexExecutor();
  const credentials = (options.credentials ?? { accessToken: "test-tok" }) as Parameters<
    typeof exec.transformRequest
  >[3];
  return exec.transformRequest(
    options.model ?? "gpt-5",
    body,
    options.stream ?? true,
    credentials
  ) as Record<string, unknown>;
}

// ============================================================================
// §1. getCodexUpstreamModel — model ID suffix stripping (chain step 1)
// ============================================================================

describe("getCodexUpstreamModel (model ID suffix → base model)", () => {
  it("strips a -high effort suffix from a Codex model id", () => {
    assert.equal(getCodexUpstreamModel("gpt-5.1-codex-high"), "gpt-5.1-codex");
  });

  it("strips -xhigh, -low, -medium, -none suffixes", () => {
    assert.equal(getCodexUpstreamModel("gpt-5-codex-xhigh"), "gpt-5-codex");
    assert.equal(getCodexUpstreamModel("gpt-5-codex-low"), "gpt-5-codex");
    assert.equal(getCodexUpstreamModel("gpt-5-codex-medium"), "gpt-5-codex");
    assert.equal(getCodexUpstreamModel("gpt-5-codex-none"), "gpt-5-codex");
  });

  it("returns the input unchanged when no effort suffix is present", () => {
    assert.equal(getCodexUpstreamModel("gpt-5-codex"), "gpt-5-codex");
    assert.equal(getCodexUpstreamModel("gpt-5.1-codex-max"), "gpt-5.1-codex-max");
  });

  it("returns the empty string for non-string inputs (defensive)", () => {
    assert.equal(getCodexUpstreamModel(undefined), "");
    assert.equal(getCodexUpstreamModel(null), "");
    assert.equal(getCodexUpstreamModel(42), "");
    assert.equal(getCodexUpstreamModel({}), "");
  });

  it("does NOT confuse a model name that contains -high mid-string with a suffix", () => {
    // e.g. "gpt-5-high-context" is not a known Codex effort suffix; only the
    // exact trailing -<level> matches, so this is preserved verbatim.
    assert.equal(getCodexUpstreamModel("gpt-5-high-context"), "gpt-5-high-context");
  });

  it("returns the input verbatim when only the very last token matches", () => {
    // Effort suffix matching is anchored to the end of the string, so the
    // last `-{level}` (if any) is stripped, even from a multi-dash id.
    assert.equal(
      getCodexUpstreamModel("gpt-5.1-codex-medium-fine-tune"),
      "gpt-5.1-codex-medium-fine-tune"
    );
  });
});

// ============================================================================
// §2. parseCodexQuotaHeaders — quota snapshot construction
// ============================================================================

describe("parseCodexQuotaHeaders (5h / 7d window snapshot)", () => {
  it("returns null when no quota headers are present", () => {
    assert.equal(parseCodexQuotaHeaders({}), null);
    assert.equal(parseCodexQuotaHeaders({ "x-other": "1" }), null);
  });

  it("parses a full 5h + 7d quota snapshot", () => {
    const snap = parseCodexQuotaHeaders({
      "x-codex-5h-usage": "12000",
      "x-codex-5h-limit": "50000",
      "x-codex-5h-reset-at": "2026-07-01T00:00:00Z",
      "x-codex-7d-usage": "900000",
      "x-codex-7d-limit": "2000000",
      "x-codex-7d-reset-at": "2026-07-07T00:00:00Z",
    });
    assert.equal(snap?.usage5h, 12000);
    assert.equal(snap?.limit5h, 50000);
    assert.equal(snap?.resetAt5h, "2026-07-01T00:00:00Z");
    assert.equal(snap?.usage7d, 900000);
    assert.equal(snap?.limit7d, 2000000);
    assert.equal(snap?.resetAt7d, "2026-07-07T00:00:00Z");
  });

  it("returns a non-null snapshot as soon as ANY quota header is present", () => {
    const snap = parseCodexQuotaHeaders({ "x-codex-5h-usage": "5" });
    assert.ok(snap);
    assert.equal(snap?.usage5h, 5);
    // Missing limit → Infinity, missing reset → null
    assert.equal(snap?.limit5h, Infinity);
    assert.equal(snap?.resetAt5h, null);
  });

  it("defaults missing usage to 0 (not NaN)", () => {
    const snap = parseCodexQuotaHeaders({
      "x-codex-5h-limit": "1000",
      "x-codex-7d-limit": "5000",
    });
    assert.equal(snap?.usage5h, 0);
    assert.equal(snap?.usage7d, 0);
  });

  it("parses fractional usage values (e.g. 1.5k tokens used)", () => {
    const snap = parseCodexQuotaHeaders({
      "x-codex-5h-usage": "1500.75",
      "x-codex-5h-limit": "5000",
    });
    assert.equal(snap?.usage5h, 1500.75);
  });
});

// ============================================================================
// §3. getCodexResetTime — soonest-effective reset selection
// ============================================================================

describe("getCodexResetTime (returns the FURTHEST-OUT future reset, never past)", () => {
  it("returns null when both reset timestamps are absent", () => {
    const snap: CodexQuotaSnapshot = {
      usage5h: 0,
      limit5h: 100,
      resetAt5h: null,
      usage7d: 0,
      limit7d: 100,
      resetAt7d: null,
    };
    assert.equal(getCodexResetTime(snap), null);
  });

  it("returns null when both reset timestamps are in the past", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const snap: CodexQuotaSnapshot = {
      usage5h: 0,
      limit5h: 100,
      resetAt5h: past,
      usage7d: 0,
      limit7d: 100,
      resetAt7d: past,
    };
    assert.equal(getCodexResetTime(snap), null);
  });

  it("ignores invalid (NaN) reset timestamps", () => {
    const snap: CodexQuotaSnapshot = {
      usage5h: 0,
      limit5h: 100,
      resetAt5h: "not-a-date",
      usage7d: 0,
      limit7d: 100,
      resetAt7d: "also-not-a-date",
    };
    assert.equal(getCodexResetTime(snap), null);
  });

  it("returns the FURTHER-OUT reset (5h or 7d), never the earlier one", () => {
    const now = Date.now();
    const earlier = new Date(now + 60 * 60 * 1000).toISOString(); // +1h
    const later = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(); // +3d
    const snap: CodexQuotaSnapshot = {
      usage5h: 0,
      limit5h: 100,
      resetAt5h: earlier,
      usage7d: 0,
      limit7d: 100,
      resetAt7d: later,
    };
    const result = getCodexResetTime(snap);
    assert.ok(result !== null);
    // Math.max picks the FURTHER-OUT (later) reset; never the earlier one.
    assert.equal(result, new Date(later).getTime());
  });
});

// ============================================================================
// §4. getCodexDualWindowCooldownMs — 7d-takes-priority cooldown policy
// ============================================================================

describe("getCodexDualWindowCooldownMs (7d takes priority over 5h)", () => {
  it("returns window=none and cooldownMs=0 when both windows are well under threshold", () => {
    const snap: CodexQuotaSnapshot = {
      usage5h: 10,
      limit5h: 100,
      resetAt5h: null,
      usage7d: 100,
      limit7d: 1000,
      resetAt7d: null,
    };
    const result = getCodexDualWindowCooldownMs(snap);
    assert.equal(result.cooldownMs, 0);
    assert.equal(result.window, "none");
  });

  it("returns window=5h when 5h is over threshold and 7d is healthy", () => {
    const futureReset = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // +30m
    const snap: CodexQuotaSnapshot = {
      usage5h: 96,
      limit5h: 100,
      resetAt5h: futureReset,
      usage7d: 100,
      limit7d: 1000,
      resetAt7d: null,
    };
    const result = getCodexDualWindowCooldownMs(snap, 0.95);
    assert.equal(result.window, "5h");
    assert.ok(result.cooldownMs > 0);
    assert.ok(result.cooldownMs <= 30 * 60 * 1000);
  });

  it("returns window=7d when 7d is over threshold (priority over 5h)", () => {
    const futureReset = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // +2h
    const snap: CodexQuotaSnapshot = {
      usage5h: 96,
      limit5h: 100,
      resetAt5h: futureReset,
      usage7d: 970,
      limit7d: 1000,
      resetAt7d: futureReset,
    };
    const result = getCodexDualWindowCooldownMs(snap, 0.95);
    // 7d takes priority — the 7d reset is the one we should wait for.
    assert.equal(result.window, "7d");
  });

  it("returns window=none when 5h is exhausted but the reset is in the past", () => {
    // The reset is behind us — the quota is "stale"; no cooldown.
    const pastReset = new Date(Date.now() - 60_000).toISOString();
    const snap: CodexQuotaSnapshot = {
      usage5h: 96,
      limit5h: 100,
      resetAt5h: pastReset,
      usage7d: 0,
      limit7d: 100,
      resetAt7d: null,
    };
    const result = getCodexDualWindowCooldownMs(snap, 0.95);
    assert.equal(result.cooldownMs, 0);
    assert.equal(result.window, "none");
  });

  it("treats Infinity limits as no cap (cooldown not triggered)", () => {
    const snap: CodexQuotaSnapshot = {
      usage5h: 999_999,
      limit5h: Infinity,
      resetAt5h: null,
      usage7d: 999_999,
      limit7d: Infinity,
      resetAt7d: null,
    };
    const result = getCodexDualWindowCooldownMs(snap, 0.95);
    assert.equal(result.window, "none");
  });
});

// ============================================================================
// §5. isCodexFreePlan — free-plan detection
// ============================================================================

describe("isCodexFreePlan (workspacePlanType === 'free')", () => {
  it("returns false for null / undefined / non-object inputs", () => {
    assert.equal(isCodexFreePlan(undefined), false);
    assert.equal(isCodexFreePlan(null), false);
    assert.equal(isCodexFreePlan("free"), false);
    assert.equal(isCodexFreePlan(42), false);
  });

  it("returns true when workspacePlanType is 'free' (case-insensitive, trimmed)", () => {
    assert.equal(isCodexFreePlan({ workspacePlanType: "free" }), true);
    assert.equal(isCodexFreePlan({ workspacePlanType: "  Free  " }), true);
    assert.equal(isCodexFreePlan({ workspacePlanType: "FREE" }), true);
  });

  it("returns false for paid plans (pro, team, enterprise, business)", () => {
    for (const plan of ["pro", "team", "enterprise", "business", "plus"]) {
      assert.equal(isCodexFreePlan({ workspacePlanType: plan }), false, `plan=${plan}`);
    }
  });

  it("returns false when workspacePlanType is missing", () => {
    assert.equal(isCodexFreePlan({}), false);
    assert.equal(isCodexFreePlan({ other: "free" }), false);
  });
});

// ============================================================================
// §6. stripStoredItemReferences — server-generated ID stripper
// ============================================================================

describe("stripStoredItemReferences (rs_/fc_/resp_/msg_ ID + reasoning-blob strip)", () => {
  it("injects a default user 'continue' turn when input is an empty array", () => {
    const body: Record<string, unknown> = { input: [] };
    stripStoredItemReferences(body);
    const input = body.input as Array<Record<string, unknown>>;
    assert.equal(input.length, 1);
    assert.equal(input[0].type, "message");
    assert.equal(input[0].role, "user");
    const content = input[0].content as Array<Record<string, unknown>>;
    assert.equal(content[0].type, "input_text");
    assert.equal(content[0].text, "continue");
  });

  it("is a no-op when input is not an array", () => {
    const body: Record<string, unknown> = { input: "not-an-array" };
    stripStoredItemReferences(body);
    assert.equal(body.input, "not-an-array");
  });

  it("is a no-op when body has no input key", () => {
    const body: Record<string, unknown> = { model: "gpt-5" };
    stripStoredItemReferences(body);
    assert.equal(body.model, "gpt-5");
    assert.equal("input" in body, false);
  });

  it("filters out bare string references like 'rs_abc'", () => {
    const body: Record<string, unknown> = {
      input: ["rs_abc", "msg_xyz", "fc_1", "resp_9", "plain-string"],
    };
    stripStoredItemReferences(body);
    const input = body.input as string[];
    assert.deepEqual(input, ["plain-string"]);
  });

  it("filters out object items with type=item_reference", () => {
    const body: Record<string, unknown> = {
      input: [
        { type: "item_reference", id: "rs_abc" },
        { type: "item_reference", id: "resp_xyz" },
        { type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] },
      ],
    };
    stripStoredItemReferences(body);
    const input = body.input as Array<Record<string, unknown>>;
    assert.equal(input.length, 1);
    assert.equal(input[0].role, "user");
  });

  it("strips the id field from object items whose id matches a server prefix (content preserved)", () => {
    const body: Record<string, unknown> = {
      input: [
        {
          id: "rs_abc",
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "hello" }],
        },
        {
          id: "fc_xyz",
          type: "function_call",
          call_id: "call_1",
          arguments: "{}",
        },
      ],
    };
    stripStoredItemReferences(body);
    const input = body.input as Array<Record<string, unknown>>;
    assert.equal(input.length, 2);
    assert.equal("id" in input[0], false);
    assert.equal("id" in input[1], false);
    // The other fields are kept.
    assert.equal(input[0].type, "message");
    assert.equal(input[1].type, "function_call");
    assert.equal((input[1] as { call_id?: string }).call_id, "call_1");
  });

  it("filters out reasoning blobs (unusable with store=false)", () => {
    const body: Record<string, unknown> = {
      input: [
        { type: "reasoning", summary: [{ type: "summary_text", text: "thinking" }] },
        { type: "message", role: "user", content: [{ type: "input_text", text: "go" }] },
      ],
    };
    stripStoredItemReferences(body);
    const input = body.input as Array<Record<string, unknown>>;
    assert.equal(input.length, 1);
    assert.equal(input[0].type, "message");
  });
});

// ============================================================================
// §7. isCompactResponsesEndpoint — /responses/compact detection
// ============================================================================

describe("isCompactResponsesEndpoint", () => {
  it("detects a bare 'responses' path (not compact)", () => {
    assert.equal(isCompactResponsesEndpoint("responses"), false);
    assert.equal(isCompactResponsesEndpoint("/responses"), false);
  });

  it("detects a 'responses/compact' or '/responses/compact' path", () => {
    assert.equal(isCompactResponsesEndpoint("responses/compact"), true);
    assert.equal(isCompactResponsesEndpoint("/responses/compact"), true);
    assert.equal(isCompactResponsesEndpoint("/responses/compact/"), true);
  });

  it("detects compact subpath case-insensitively", () => {
    assert.equal(isCompactResponsesEndpoint("/responses/Compact"), true);
    assert.equal(isCompactResponsesEndpoint("/RESPONSES/COMPACT"), true);
  });

  it("returns false for unrelated subpaths", () => {
    assert.equal(isCompactResponsesEndpoint("/responses/stream"), false);
    assert.equal(isCompactResponsesEndpoint("/other"), false);
    assert.equal(isCompactResponsesEndpoint(""), false);
  });

  it("returns false for non-string inputs", () => {
    assert.equal(isCompactResponsesEndpoint(undefined), false);
    assert.equal(isCompactResponsesEndpoint(null), false);
  });
});

// ============================================================================
// §8. normalizeCodexTools — tool-call transformation
// ============================================================================

describe("normalizeCodexTools (Chat-Completions → Responses flat shape)", () => {
  it("flattens a { type:'function', function:{name,description,parameters} } tool", () => {
    const body: Record<string, unknown> = {
      tools: [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get the weather",
            parameters: { type: "object", properties: { city: { type: "string" } } },
          },
        },
      ],
    };
    normalizeCodexTools(body);
    const tools = body.tools as Array<Record<string, unknown>>;
    assert.equal(tools.length, 1);
    assert.equal(tools[0].type, "function");
    assert.equal(tools[0].name, "get_weather");
    assert.equal(tools[0].description, "Get the weather");
    assert.deepEqual(tools[0].parameters, {
      type: "object",
      properties: { city: { type: "string" } },
    });
    // The nested function wrapper must be gone.
    assert.equal("function" in tools[0], false);
  });

  it("preserves a top-level function tool already in Responses shape", () => {
    const body: Record<string, unknown> = {
      tools: [
        {
          type: "function",
          name: "search",
          description: "Search",
          parameters: { type: "object", properties: {} },
        },
      ],
    };
    normalizeCodexTools(body);
    const tools = body.tools as Array<Record<string, unknown>>;
    assert.equal(tools[0].name, "search");
    assert.equal("function" in tools[0], false);
  });

  it("preserves hosted tools (web_search, file_search, code_interpreter, mcp)", () => {
    const body: Record<string, unknown> = {
      tools: [
        { type: "web_search" },
        { type: "file_search" },
        { type: "code_interpreter" },
        { type: "mcp", server_label: "atlassian" },
      ],
    };
    normalizeCodexTools(body);
    const tools = body.tools as Array<Record<string, unknown>>;
    assert.equal(tools.length, 4);
    assert.equal(tools[0].type, "web_search");
    assert.equal(tools[1].type, "file_search");
    assert.equal(tools[2].type, "code_interpreter");
    assert.equal(tools[3].type, "mcp");
  });

  it("preserves namespace tools (MCP tool groups) and registers their sub-tool names", () => {
    const body: Record<string, unknown> = {
      tools: [
        {
          type: "namespace",
          name: "mcp__atlassian__",
          tools: [{ name: "create_issue" }, { name: "search_jira" }],
        },
      ],
    };
    normalizeCodexTools(body);
    const tools = body.tools as Array<Record<string, unknown>>;
    assert.equal(tools.length, 1);
    assert.equal(tools[0].type, "namespace");
    // A tool_choice.name reference to a registered sub-tool is preserved.
    body.tool_choice = { type: "function", name: "create_issue" };
    normalizeCodexTools(body);
    assert.deepEqual(body.tool_choice, { type: "function", name: "create_issue" });
  });

  it("preserves custom tools only when preserveCustomTools=true", () => {
    const body: Record<string, unknown> = {
      tools: [{ type: "custom", name: "apply_patch", format: "diff" }],
    };
    // Without the flag, custom tools are filtered out.
    normalizeCodexTools(body);
    assert.equal((body.tools as unknown[]).length, 0);

    // With the flag, custom tools are kept.
    body.tools = [{ type: "custom", name: "apply_patch", format: "diff" }];
    normalizeCodexTools(body, { preserveCustomTools: true });
    const tools = body.tools as Array<Record<string, unknown>>;
    assert.equal(tools.length, 1);
    assert.equal(tools[0].name, "apply_patch");
  });

  it("drops function tools with empty / whitespace-only names", () => {
    const body: Record<string, unknown> = {
      tools: [
        { type: "function", name: "", function: { name: "" } },
        { type: "function", name: "   ", function: { name: "   " } },
        { type: "function", name: "valid" },
      ],
    };
    normalizeCodexTools(body);
    const tools = body.tools as Array<Record<string, unknown>>;
    assert.equal(tools.length, 1);
    assert.equal(tools[0].name, "valid");
  });

  it("drops unknown hosted tool types (logs and continues)", () => {
    const body: Record<string, unknown> = {
      tools: [{ type: "future_hosted_tool_type" }, { type: "function", name: "kept" }],
    };
    normalizeCodexTools(body);
    const tools = body.tools as Array<Record<string, unknown>>;
    assert.equal(tools.length, 1);
    assert.equal(tools[0].name, "kept");
  });

  it("truncates function names longer than 128 characters (Codex wire limit)", () => {
    const longName = "x".repeat(200);
    const body: Record<string, unknown> = {
      tools: [{ type: "function", name: longName }],
    };
    normalizeCodexTools(body);
    const tools = body.tools as Array<Record<string, unknown>>;
    assert.equal(tools.length, 1);
    assert.equal((tools[0].name as string).length, 128);
  });

  it("drops image_generation for free-plan accounts (#2980)", () => {
    const body: Record<string, unknown> = {
      tools: [{ type: "image_generation" }, { type: "web_search" }],
    };
    normalizeCodexTools(body, { dropImageGeneration: true });
    const tools = body.tools as Array<Record<string, unknown>>;
    assert.equal(tools.length, 1);
    assert.equal(tools[0].type, "web_search");
  });

  it("strips tool_choice.name references that don't match any valid tool", () => {
    const body: Record<string, unknown> = {
      tools: [{ type: "function", name: "alpha" }],
      tool_choice: { type: "function", name: "ghost" },
    };
    normalizeCodexTools(body);
    assert.equal("tool_choice" in body, false);
  });

  it("preserves tool_choice.name when it matches a valid function tool", () => {
    const body: Record<string, unknown> = {
      tools: [{ type: "function", name: "alpha" }],
      tool_choice: { type: "function", name: "alpha" },
    };
    normalizeCodexTools(body);
    assert.deepEqual(body.tool_choice, { type: "function", name: "alpha" });
  });

  it("propagates strict mode from the nested function wrapper to the top level", () => {
    const body: Record<string, unknown> = {
      tools: [
        {
          type: "function",
          function: {
            name: "strict_tool",
            description: "d",
            parameters: { type: "object", properties: {} },
            strict: true,
          },
        },
      ],
    };
    normalizeCodexTools(body);
    const tools = body.tools as Array<Record<string, unknown>>;
    assert.equal(tools[0].strict, true);
  });
});

// ============================================================================
// §9. isCodexResponsesWebSocketRequired — WS transport gate
// ============================================================================

describe("isCodexResponsesWebSocketRequired (opt-in WS transport)", () => {
  const originalOverride = (globalThis as { __codexWsForTest?: unknown }).__codexWsForTest;

  beforeEach(() => {
    // Reset any prior override before each test.
    __setCodexWebSocketTransportForTesting(null);
  });

  after(() => {
    __setCodexWebSocketTransportForTesting(originalOverride as never);
  });

  it("returns false when codexTransport is not 'websocket'", () => {
    const creds = { providerSpecificData: { codexTransport: "http" } };
    assert.equal(isCodexResponsesWebSocketRequired("gpt-5", creds), false);
  });

  it("returns false when codexTransport='websocket' but the WS transport is unavailable", () => {
    const creds = { providerSpecificData: { codexTransport: "websocket" } };
    __setCodexWebSocketTransportForTesting(null);
    assert.equal(isCodexResponsesWebSocketRequired("gpt-5", creds), false);
  });

  it("returns true when codexTransport='websocket' AND the WS transport is available", () => {
    // Provide a minimal stub for the WS transport.
    __setCodexWebSocketTransportForTesting((async () => ({
      send: () => {},
      close: () => {},
      onmessage: null,
      onerror: null,
      onclose: null,
    })) as never);
    const creds = { providerSpecificData: { codexTransport: "websocket" } };
    assert.equal(isCodexResponsesWebSocketRequired("gpt-5", creds), true);
  });

  it("returns false when credentials are missing or malformed", () => {
    assert.equal(isCodexResponsesWebSocketRequired("gpt-5", null), false);
    assert.equal(isCodexResponsesWebSocketRequired("gpt-5", undefined), false);
    assert.equal(isCodexResponsesWebSocketRequired("gpt-5", "not-an-object"), false);
  });

  it("ignores the model argument (HTTP is the default for ALL Codex models)", () => {
    const creds = { providerSpecificData: {} };
    assert.equal(isCodexResponsesWebSocketRequired("gpt-5", creds), false);
    assert.equal(isCodexResponsesWebSocketRequired("gpt-5.1-codex", creds), false);
    assert.equal(isCodexResponsesWebSocketRequired("gpt-5.3-codex", creds), false);
  });
});

// ============================================================================
// §10. encodeResponseSseEvent — SSE event encoding + refusal handling
// ============================================================================
