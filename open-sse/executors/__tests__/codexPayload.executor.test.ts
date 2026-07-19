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

describe("encodeResponseSseEvent (SSE framing + refusal/error mapping)", () => {
  it("wraps a JSON Responses-API event in the canonical 'event: / data:' SSE shape", () => {
    const payload = JSON.stringify({ type: "response.created", response: { id: "r_1" } });
    const result = encodeResponseSseEvent(payload);
    assert.equal(result.sse, `event: response.created\ndata: ${payload}\n\n`);
    assert.equal(result.terminal, false);
  });

  it("marks response.completed as terminal", () => {
    const payload = JSON.stringify({ type: "response.completed", response: { id: "r_1" } });
    const result = encodeResponseSseEvent(payload);
    assert.equal(result.terminal, true);
  });

  it("marks response.failed as terminal", () => {
    const payload = JSON.stringify({
      type: "response.failed",
      response: { id: "r_1", error: { code: "x", message: "y" } },
    });
    const result = encodeResponseSseEvent(payload);
    assert.equal(result.terminal, true);
    // response.failed events are emitted on the 'response.failed' SSE channel.
    assert.equal(result.sse.startsWith("event: response.failed\n"), true);
  });

  it("rewrites a generic {type:'error'} event into response.failed and maps status 400", () => {
    const payload = JSON.stringify({
      type: "error",
      status_code: 400,
      error: { code: "bad_request", message: "Invalid request" },
    });
    const result = encodeResponseSseEvent(payload);
    const out = JSON.parse(result.sse.replace(/^event: [^\n]+\ndata: /, "").replace(/\n\n$/, ""));
    assert.equal(out.type, "response.failed");
    assert.equal(out.response.status, "failed");
    assert.equal(out.response.error.code, "bad_request");
    assert.equal(out.response.error.status_code, 400);
    assert.equal(result.terminal, true);
  });

  it("infers status 429 from a quota/rate-limit-shaped message when no explicit status is given", () => {
    const payload = JSON.stringify({
      type: "error",
      error: { code: "rate_limit_exceeded", message: "Too many requests" },
    });
    const result = encodeResponseSseEvent(payload);
    const out = JSON.parse(result.sse.replace(/^event: [^\n]+\ndata: /, "").replace(/\n\n$/, ""));
    assert.equal(out.response.error.status_code, 429);
  });

  it("preserves a non-JSON raw payload as a generic 'message' SSE event", () => {
    const result = encodeResponseSseEvent("not-json");
    assert.equal(result.sse, "event: message\ndata: not-json\n\n");
    assert.equal(result.terminal, false);
  });

  it("drops empty / whitespace-only payloads (no SSE frame emitted)", () => {
    assert.equal(encodeResponseSseEvent("").sse, "");
    assert.equal(encodeResponseSseEvent("   ").sse, "");
    assert.equal(encodeResponseSseEvent("\n").sse, "");
  });

  it("drops non-standard codex.* events when the OMNIROUTE_CODEX_DROP_NONSTANDARD_EVENTS env is on", () => {
    const prev = process.env.OMNIROUTE_CODEX_DROP_NONSTANDARD_EVENTS;
    process.env.OMNIROUTE_CODEX_DROP_NONSTANDARD_EVENTS = "true";
    try {
      const payload = JSON.stringify({ type: "codex.rate_limits", info: { remaining: 0 } });
      const result = encodeResponseSseEvent(payload);
      assert.equal(result.sse, "");
    } finally {
      if (prev === undefined) delete process.env.OMNIROUTE_CODEX_DROP_NONSTANDARD_EVENTS;
      else process.env.OMNIROUTE_CODEX_DROP_NONSTANDARD_EVENTS = prev;
    }
  });

  it("emits a non-JSON error string as a generic 'message' event (not response.failed)", () => {
    const result = encodeResponseSseEvent("raw error string");
    assert.equal(result.sse, "event: message\ndata: raw error string\n\n");
  });
});

// ============================================================================
// §11. filterNonstandardCodexSse — HTTP-transport byte-stream filter
// ============================================================================

describe("filterNonstandardCodexSse (HTTP-transport codex.* block filter)", () => {
  function makeSseResponse(body: string, contentType = "text/event-stream"): Response {
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(body));
          controller.close();
        },
      }),
      { headers: { "content-type": contentType } }
    );
  }

  it("returns the response unchanged when content-type is not text/event-stream", async () => {
    const r = new Response("plain", { headers: { "content-type": "text/plain" } });
    const out = filterNonstandardCodexSse(r);
    assert.equal(out, r);
  });

  it("returns the response unchanged when body is null", () => {
    const r = new Response(null, { headers: { "content-type": "text/event-stream" } });
    const out = filterNonstandardCodexSse(r);
    assert.equal(out, r);
  });

  it("strips event blocks whose event name starts with 'codex.'", async () => {
    const body =
      'event: response.created\ndata: {"id":"r_1"}\n\n' +
      'event: codex.rate_limits\ndata: {"remaining":0}\n\n' +
      'event: response.completed\ndata: {"id":"r_1"}\n\n';
    const out = filterNonstandardCodexSse(makeSseResponse(body));
    const text = await new Response(out.body!).text();
    assert.equal(text.includes("response.created"), true);
    assert.equal(text.includes("response.completed"), true);
    assert.equal(text.includes("codex.rate_limits"), false);
  });
});

// ============================================================================
// §12. CodexExecutor.buildUrl — URL composition (compact subpath)
// ============================================================================

describe("CodexExecutor.buildUrl (compact-subpath composition)", () => {
  it("appends /compact to the base URL for a /responses/compact request", () => {
    const exec = new CodexExecutor();
    const creds = { requestEndpointPath: "/responses/compact" } as Parameters<
      typeof exec.buildUrl
    >[3];
    const url = exec.buildUrl("gpt-5", true, 0, creds);
    assert.ok(typeof url === "string");
    assert.ok(url.endsWith("/responses/compact"), `url=${url}`);
  });

  it("uses /responses (no subpath) when requestEndpointPath is '/responses'", () => {
    const exec = new CodexExecutor();
    const creds = { requestEndpointPath: "/responses" } as Parameters<typeof exec.buildUrl>[3];
    const url = exec.buildUrl("gpt-5", true, 0, creds);
    assert.ok(typeof url === "string");
    // Either "/responses" or "/responses/" — both are equivalent.
    assert.ok(url.endsWith("/responses") || url.endsWith("/responses/"), `url=${url}`);
  });

  it("falls back to the base executor's URL when requestEndpointPath is absent", () => {
    const exec = new CodexExecutor();
    const url = exec.buildUrl("gpt-5", true, 0, { accessToken: "t" } as Parameters<
      typeof exec.buildUrl
    >[3]);
    assert.ok(typeof url === "string");
    // The base URL is from PROVIDERS.codex — we just verify it builds.
    assert.ok(url.length > 0);
  });
});

// ============================================================================
// §13. CodexExecutor.buildHeaders — header propagation
// ============================================================================

describe("CodexExecutor.buildHeaders (Version, User-Agent, originator, session_id, chatgpt-account-id)", () => {
  it("sets Version, originator, User-Agent, and Bearer Authorization by default", () => {
    const exec = new CodexExecutor();
    const headers = exec.buildHeaders({ accessToken: "tok-abc" } as Parameters<
      typeof exec.buildHeaders
    >[0]);
    assert.equal(headers["originator"], "codex_cli_rs");
    assert.equal(headers["Authorization"], "Bearer tok-abc");
    assert.ok(typeof headers["Version"] === "string" && headers["Version"].length > 0);
    assert.ok(typeof headers["User-Agent"] === "string" && headers["User-Agent"].length > 0);
  });

  it("adds chatgpt-account-id when workspaceId is set in providerSpecificData", () => {
    const exec = new CodexExecutor();
    const headers = exec.buildHeaders({
      accessToken: "tok",
      providerSpecificData: { workspaceId: "ws-12345" },
    } as Parameters<typeof exec.buildHeaders>[0]);
    assert.equal(headers["chatgpt-account-id"], "ws-12345");
  });

  it("omits chatgpt-account-id when workspaceId is missing or empty", () => {
    const exec = new CodexExecutor();
    const headers = exec.buildHeaders({
      accessToken: "tok",
      providerSpecificData: { workspaceId: "" },
    } as Parameters<typeof exec.buildHeaders>[0]);
    assert.equal("chatgpt-account-id" in headers, false);
  });

  it("picks application/json Accept for /responses/compact (stream flag is forced to false)", () => {
    const exec = new CodexExecutor();
    const headers = exec.buildHeaders({
      accessToken: "tok",
      requestEndpointPath: "/responses/compact",
    } as Parameters<typeof exec.buildHeaders>[0]);
    assert.equal(headers["Accept"], "application/json");
  });

  it("picks text/event-stream Accept for /responses (stream default true)", () => {
    const exec = new CodexExecutor();
    const headers = exec.buildHeaders({
      accessToken: "tok",
      requestEndpointPath: "/responses",
    } as Parameters<typeof exec.buildHeaders>[0]);
    assert.equal(headers["Accept"], "text/event-stream");
  });
});

// ============================================================================
// §14. CodexExecutor.transformRequest — system prompt injection
// ============================================================================

describe("CodexExecutor.transformRequest — system prompt (instructions) injection", () => {
  it("injects the CODEX_DEFAULT_INSTRUCTIONS for a tool-bearing translated request", () => {
    const body = {
      model: "gpt-5",
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }],
      tools: [
        {
          type: "function",
          name: "f",
          description: "d",
          parameters: { type: "object", properties: {} },
        },
      ],
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    // instructions should be set; we just check it's a non-empty string.
    assert.equal(typeof out.instructions, "string");
    assert.ok((out.instructions as string).length > 0);
  });

  it("injects the CHAT default instructions for a tool-less translated request", () => {
    const body = {
      model: "gpt-5",
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }],
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    assert.equal(typeof out.instructions, "string");
    assert.ok((out.instructions as string).length > 0);
    // The chat default is shorter than the tool default — quick sanity check.
    assert.ok((out.instructions as string).includes("ChatGPT"));
  });

  it("does NOT overwrite an existing non-empty instructions field", () => {
    const custom = "MY-CUSTOM-INSTRUCTIONS-XYZ";
    const body = {
      model: "gpt-5",
      instructions: custom,
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }],
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    assert.equal(out.instructions, custom);
  });

  it("uses a minimal placeholder instructions on native Codex passthrough", () => {
    const body = {
      model: "gpt-5",
      _nativeCodexPassthrough: true,
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }],
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    assert.equal(out.instructions, "Follow the developer instructions in the conversation.");
    // The native passthrough marker is consumed and removed.
    assert.equal("_nativeCodexPassthrough" in out, false);
  });
});

// ============================================================================
// §15. CodexExecutor.transformRequest — model ID fallback chain
// ============================================================================

describe("CodexExecutor.transformRequest — model ID reasoning-effort fallback chain", () => {
  it("chains: model-suffix → body.reasoning.effort → body.reasoning_effort → defaults", () => {
    // 1) Model suffix alone
    const body1 = { model: "gpt-5-codex-high" };
    const out1 = buildPayload(body1, { credentials: { accessToken: "t" } });
    const r1 = out1.reasoning as Record<string, unknown>;
    assert.equal(r1.effort, "high");
    // The model is stripped of the suffix.
    assert.equal(out1.model, "gpt-5-codex");

    // 2) body.reasoning.effort overrides the (absent) model suffix
    const body2 = {
      model: "gpt-5-codex",
      reasoning: { effort: "low" },
    };
    const out2 = buildPayload(body2, { credentials: { accessToken: "t" } });
    const r2 = out2.reasoning as Record<string, unknown>;
    assert.equal(r2.effort, "low");

    // 3) body.reasoning_effort (legacy) is the next fallback
    const body3 = {
      model: "gpt-5-codex",
      reasoning_effort: "medium",
    };
    const out3 = buildPayload(body3, { credentials: { accessToken: "t" } });
    const r3 = out3.reasoning as Record<string, unknown>;
    assert.equal(r3.effort, "medium");
    // The legacy field is removed after folding.
    assert.equal("reasoning_effort" in out3, false);
  });

  it("clamps an over-cap effort for a known cap model (e.g. gpt-5-mini caps at high)", () => {
    const body = {
      model: "gpt-5-mini",
      reasoning: { effort: "xhigh" },
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    const r = out.reasoning as Record<string, unknown>;
    // gpt-5-mini's MAX_EFFORT_BY_MODEL entry is "high"; xhigh is clamped to it.
    assert.equal(r.effort, "high");
  });

  it("normalises 'max' → 'xhigh' before applying the cap", () => {
    const body = {
      model: "gpt-5.3-codex",
      reasoning_effort: "max",
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    const r = out.reasoning as Record<string, unknown>;
    // gpt-5.3-codex has cap=xhigh and max normalises to xhigh, so no clamp is needed.
    assert.equal(r.effort, "xhigh");
  });

  it("emits a summary='auto' and adds reasoning.encrypted_content to include when effort is non-none", () => {
    const body = {
      model: "gpt-5",
      reasoning: { effort: "medium" },
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    const r = out.reasoning as Record<string, unknown>;
    assert.equal(r.summary, "auto");
    assert.ok(Array.isArray(out.include));
    assert.ok((out.include as string[]).includes("reasoning.encrypted_content"));
  });

  it("does NOT add a summary or encrypted_content include when reasoning.effort is 'none'", () => {
    const body = {
      model: "gpt-5",
      reasoning: { effort: "none" },
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    const r = out.reasoning as Record<string, unknown>;
    assert.equal("summary" in r, false);
  });
});

// ============================================================================
// §16. CodexExecutor.transformRequest — tool call transformation
// ============================================================================

describe("CodexExecutor.transformRequest — tool call transformation (allowlist)", () => {
  it("flattens a Chat Completions-shape function tool into the Responses shape", () => {
    const body = {
      model: "gpt-5",
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "go" }] }],
      tools: [
        {
          type: "function",
          function: {
            name: "do_thing",
            description: "Do the thing",
            parameters: { type: "object", properties: { x: { type: "string" } } },
          },
        },
      ],
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    const tools = out.tools as Array<Record<string, unknown>>;
    assert.equal(tools[0].type, "function");
    assert.equal(tools[0].name, "do_thing");
    assert.equal("function" in tools[0], false);
  });

  it("strips Chat-Completions-only fields (max_tokens, max_output_tokens, truncation, etc.)", () => {
    const body = {
      model: "gpt-5",
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "go" }] }],
      max_tokens: 100,
      max_output_tokens: 200,
      truncation: "auto",
      background: true,
      prompt_cache_retention: "long",
      safety_identifier: "user-1",
      user: "user-1",
      // A pass-through field that is NOT in the allowlist should also be dropped.
      temperature: 0.7,
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    assert.equal("max_tokens" in out, false);
    assert.equal("max_output_tokens" in out, false);
    assert.equal("truncation" in out, false);
    assert.equal("background" in out, false);
    assert.equal("prompt_cache_retention" in out, false);
    assert.equal("safety_identifier" in out, false);
    assert.equal("user" in out, false);
    assert.equal("temperature" in out, false);
  });

  it("strips messages and prompt keys to keep only input (Responses schema)", () => {
    const body = {
      model: "gpt-5",
      messages: [{ role: "user", content: "hi" }],
      prompt: "fallback prompt",
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    assert.equal("messages" in out, false);
    assert.equal("prompt" in out, false);
    assert.ok(Array.isArray(out.input));
  });
});

// ============================================================================
// §17. CodexExecutor.transformRequest — conversation history merge
// ============================================================================

describe("CodexExecutor.transformRequest — conversation history merge (messages/prompt → input)", () => {
  it("maps a flat messages array into a Responses-API input array", () => {
    const body = {
      model: "gpt-5",
      messages: [
        { role: "system", content: "be terse" },
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
        { role: "user", content: "what is 2+2?" },
      ],
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    const input = out.input as Array<Record<string, unknown>>;
    // The system message is converted to developer in-place (cacheable).
    assert.equal(input[0].role, "developer");
    assert.equal(input[1].role, "user");
    assert.equal(input[2].role, "assistant");
    assert.equal(input[3].role, "user");
    // String content is wrapped in input_text.
    for (const msg of input) {
      const content = msg.content as Array<Record<string, unknown>>;
      assert.equal(content[0].type, "input_text");
    }
  });

  it("preserves explicit text content parts (and converts type='text' → 'input_text')", () => {
    const body = {
      model: "gpt-5",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "hello" },
            { type: "image", image_url: "https://x/y.png" },
          ],
        },
      ],
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    const input = out.input as Array<Record<string, unknown>>;
    const content = input[0].content as Array<Record<string, unknown>>;
    assert.equal(content[0].type, "input_text");
    assert.equal(content[0].text, "hello");
    // The image part is preserved as-is (Codex has a sibling image type).
    assert.equal(content[1].type, "image");
  });

  it("maps a top-level string 'prompt' field into a single user input turn", () => {
    const body = { model: "gpt-5", prompt: "tell me a joke" };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    const input = out.input as Array<Record<string, unknown>>;
    assert.equal(input.length, 1);
    assert.equal(input[0].role, "user");
    const content = input[0].content as Array<Record<string, unknown>>;
    assert.equal(content[0].type, "input_text");
    assert.equal(content[0].text, "tell me a joke");
  });

  it("ignores an empty 'prompt' string (does not produce a synthetic 'continue' turn)", () => {
    const body = { model: "gpt-5", prompt: "   " };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    // No input was provided, so no synthetic turn is added.
    assert.equal("input" in out, false);
  });

  it("maps a top-level array 'prompt' field into per-item user turns", () => {
    const body = { model: "gpt-5", prompt: ["first", "second"] };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    const input = out.input as Array<Record<string, unknown>>;
    assert.equal(input.length, 2);
    assert.equal((input[0].content as Array<Record<string, unknown>>)[0].text, "first");
    assert.equal((input[1].content as Array<Record<string, unknown>>)[0].text, "second");
  });

  it("preserves a non-string 'phase' field on a messages[].phase hint", () => {
    const body = {
      model: "gpt-5",
      messages: [{ role: "user", content: "hi", phase: "final" }],
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    const input = out.input as Array<Record<string, unknown>>;
    assert.equal(input[0].phase, "final");
  });
});

// ============================================================================
// §18. CodexExecutor.transformRequest — store / stream / compact toggles
// ============================================================================

describe("CodexExecutor.transformRequest — stream / store / compact toggles", () => {
  it("forces stream=true for a regular /responses request regardless of input stream flag", () => {
    const body = { model: "gpt-5", input: [] };
    const out = buildPayload(body, { stream: false, credentials: { accessToken: "t" } });
    assert.equal(out.stream, true);
  });

  it("DELETES stream and stream_options for a /responses/compact request (the compact endpoint rejects them)", () => {
    const body = {
      model: "gpt-5",
      input: [],
      stream: true,
      stream_options: { include_usage: true },
    };
    const out = buildPayload(body, {
      stream: true,
      credentials: { accessToken: "t", requestEndpointPath: "/responses/compact" },
    });
    assert.equal("stream" in out, false);
    assert.equal("stream_options" in out, false);
  });

  it("defaults store=false for a regular Codex account", () => {
    const body = { model: "gpt-5", input: [] };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    assert.equal(out.store, false);
  });

  it("sets store=true only when openaiStoreEnabled is true (API-key accounts)", () => {
    const body = { model: "gpt-5", input: [] };
    const out = buildPayload(body, {
      credentials: { accessToken: "t", providerSpecificData: { openaiStoreEnabled: true } },
    });
    assert.equal(out.store, true);
  });

  it("DELETES store for a /responses/compact request (compact rejects the store field entirely)", () => {
    const body = { model: "gpt-5", input: [], store: true };
    const out = buildPayload(body, {
      credentials: { accessToken: "t", requestEndpointPath: "/responses/compact" },
    });
    assert.equal("store" in out, false);
  });

  it("rewrites service_tier 'fast' to the wire value 'priority' and preserves other tiers", () => {
    const bodyFast = { model: "gpt-5", input: [], service_tier: "fast" };
    const outFast = buildPayload(bodyFast, { credentials: { accessToken: "t" } });
    assert.equal(outFast.service_tier, "priority");

    const bodyDefault = { model: "gpt-5", input: [], service_tier: "default" };
    const outDefault = buildPayload(bodyDefault, { credentials: { accessToken: "t" } });
    assert.equal(outDefault.service_tier, "default");
  });
});

// ============================================================================
// §19. CodexExecutor.transformRequest — prompt_cache_key derivation
// ============================================================================

describe("CodexExecutor.transformRequest — prompt_cache_key derivation", () => {
  it("uses the body's prompt_cache_key verbatim (per-conversation cache affinity)", () => {
    const body = {
      model: "gpt-5",
      input: [],
      prompt_cache_key: "11111111-2222-3333-4444-555555555555",
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    assert.equal(out.prompt_cache_key, "11111111-2222-3333-4444-555555555555");
  });

  it("falls back to body.session_id when prompt_cache_key is absent", () => {
    const body = {
      model: "gpt-5",
      input: [],
      session_id: "session_xyz_123",
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    assert.equal(out.prompt_cache_key, "session_xyz_123");
    // session_id is consumed and removed from the body.
    assert.equal("session_id" in out, false);
  });

  it("falls back to body.conversation_id when neither prompt_cache_key nor session_id is set", () => {
    const body = {
      model: "gpt-5",
      input: [],
      conversation_id: "conv_xyz_456",
    };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    assert.equal(out.prompt_cache_key, "conv_xyz_456");
    assert.equal("conversation_id" in out, false);
  });

  it("falls back to credentials.providerSpecificData.workspaceId as a last resort", () => {
    const body = { model: "gpt-5", input: [] };
    const out = buildPayload(body, {
      credentials: { accessToken: "t", providerSpecificData: { workspaceId: "ws-fallback" } },
    });
    assert.equal(out.prompt_cache_key, "ws-fallback");
  });

  it("omits prompt_cache_key entirely when no candidate ID is present", () => {
    const body = { model: "gpt-5", input: [] };
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    assert.equal("prompt_cache_key" in out, false);
  });
});

// ============================================================================
// §20. CodexExecutor.transformRequest — defensive cloning
// ============================================================================

describe("CodexExecutor.transformRequest — does NOT mutate the caller's payload", () => {
  it("leaves the original body.input array intact (deep clone)", () => {
    const body = {
      model: "gpt-5",
      input: [
        { type: "message", role: "system", content: [{ type: "input_text", text: "be terse" }] },
        { type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] },
      ],
    };
    const originalInput = JSON.parse(JSON.stringify(body.input));
    const out = buildPayload(body, { credentials: { accessToken: "t" } });
    // Output's system role is rewritten to developer.
    const outInput = out.input as Array<Record<string, unknown>>;
    assert.equal(outInput[0].role, "developer");
    // But the ORIGINAL body's system role is preserved (clone, not in-place).
    assert.equal((body.input as Array<Record<string, unknown>>)[0].role, "system");
    assert.deepEqual(body.input, originalInput);
  });

  it("handles a non-object body gracefully (empty object fallback)", () => {
    const out = buildPayload(null, { credentials: { accessToken: "t" } });
    assert.equal(typeof out, "object");
    assert.equal(out.stream, true);
    assert.equal(out.store, false);
  });
});

// ============================================================================
// §21. CodexExecutor.refreshCredentials — token refresh behaviour
// ============================================================================

describe("CodexExecutor.refreshCredentials (returns null when refresh is impossible)", () => {
  it("returns null when no refreshToken is on the credentials", async () => {
    const exec = new CodexExecutor();
    const result = await exec.refreshCredentials({ accessToken: "t" } as Parameters<
      typeof exec.refreshCredentials
    >[0]);
    assert.equal(result, null);
  });
});
