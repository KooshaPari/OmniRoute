/**
 * Responses API transformer — Claude Code parity surface tests.
 *
 * Coverage targets (see docs/reference/RESPONSES-API.md):
 *   1. tool_use blocks emitted alongside function_call items (auto + opt-in).
 *   2. structured_outputs / output_format passthrough on response.
 *   3. prompt_cache_control / prompt_cache_key echo.
 *   4. usage cache token passthrough.
 *   5. Existing dense-output, reasoning, message, function_call,
 *      finish_reason, and keepalive invariants.
 *
 * These are pure unit tests over the TransformStream — no network, no DB.
 *
 * Note: SSE chunks are constructed via the `sse()` helper rather than raw
 * template literals. The Responses API SSE payload is JSON-in-string, and
 * crafting partial / escaped JSON inline is fragile (the backslash + nested
 * quote escaping is a constant foot-gun). The helper takes a plain object,
 * JSON.stringifies it, and wraps it in the SSE `data: ...\n\n` envelope.
 */

import test from "node:test";
import assert from "node:assert/strict";

const { createResponsesApiTransformStream } =
  await import("../../open-sse/transformer/responsesTransformer.ts");

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface SseEvent {
  event: string | null;
  data: string | null;
}

interface ChunkOptions {
  id?: string;
  model?: string;
  index?: number;
  finishReason?: string;
  content?: string;
  reasoningContent?: string;
  toolCalls?: Array<{
    index?: number;
    id?: string;
    function: { name?: string; arguments?: string };
  }>;
  usage?: Record<string, unknown>;
  /** When true, emit a usage-only chunk with no `choices` array. */
  usageOnly?: boolean;
}

function sse(opts: ChunkOptions): string {
  const payload: Record<string, unknown> = {
    id: opts.id ?? "chatcmpl-test",
  };
  if (opts.usageOnly) {
    payload.choices = [];
  } else {
    const choice: Record<string, unknown> = { index: opts.index ?? 0 };
    if (opts.finishReason !== undefined) choice.finish_reason = opts.finishReason;
    const delta: Record<string, unknown> = {};
    if (opts.content !== undefined) delta.content = opts.content;
    if (opts.reasoningContent !== undefined) delta.reasoning_content = opts.reasoningContent;
    if (opts.toolCalls) delta.tool_calls = opts.toolCalls;
    if (Object.keys(delta).length > 0) choice.delta = delta;
    payload.choices = [choice];
  }
  if (opts.usage) payload.usage = opts.usage;
  return `data: ${JSON.stringify(payload)}\n\n`;
}

async function runTransformStream(
  chunks: string[],
  options: Record<string, unknown> = {}
): Promise<string> {
  const stream = createResponsesApiTransformStream(null, 3000, options);
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();

  const out: string[] = [];
  const readerTask = (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      out.push(decoder.decode(value));
    }
  })();

  for (const chunk of chunks) {
    await writer.write(encoder.encode(chunk));
  }
  await writer.close();
  await readerTask;

  return out.join("");
}

function parseSseOutput(output: string): SseEvent[] {
  return output
    .trim()
    .split("\n\n")
    .map((entry) => {
      const lines = entry.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event: "));
      const dataLine = lines.find((l) => l.startsWith("data: "));
      return {
        event: eventLine ? eventLine.slice("event: ".length) : null,
        data: dataLine ? dataLine.slice("data: ".length) : null,
      };
    });
}

function findEvent(events: SseEvent[], name: string): Record<string, unknown> | null {
  const e = events.find((x) => x.event === name);
  if (!e?.data) return null;
  return JSON.parse(e.data);
}

function getCompleted(output: string): Record<string, unknown> {
  const events = parseSseOutput(output);
  const e = events.find((x) => x.event === "response.completed");
  assert.ok(e, "response.completed event must be present");
  return JSON.parse(e!.data!).response as Record<string, unknown>;
}

function getCreated(output: string): Record<string, unknown> {
  const events = parseSseOutput(output);
  const e = findEvent(events, "response.created");
  assert.ok(e, "response.created event must be present");
  return e!.response as Record<string, unknown>;
}

// ───────────────────────── 1. tool_use blocks ─────────────────────────

test("tool_use is NOT emitted when no Anthropic-shaped tools and no opt-in", async () => {
  const output = await runTransformStream([
    sse({
      toolCalls: [{ index: 0, id: "call_a", function: { name: "lookup", arguments: "{}" } }],
    }),
    sse({ finishReason: "tool_calls" }),
  ]);
  const events = parseSseOutput(output);
  const outputItemAdded = events.filter((e) => e.event === "response.output_item.added");
  assert.equal(outputItemAdded.length, 1);
  const item = JSON.parse(outputItemAdded[0].data!).item as Record<string, unknown>;
  assert.equal(item.type, "function_call");
});

test("tool_use IS emitted automatically when tools[] contains Anthropic-shaped entries", async () => {
  const tools = [
    {
      name: "lookup",
      description: "Look up a record",
      input_schema: {
        type: "object",
        properties: { q: { type: "string" } },
        required: ["q"],
      },
    },
  ];
  const output = await runTransformStream(
    [
      sse({
        toolCalls: [
          {
            index: 0,
            id: "call_b",
            function: { name: "lookup", arguments: JSON.stringify({ q: "hi" }) },
          },
        ],
      }),
      sse({ finishReason: "tool_calls" }),
    ],
    { tools }
  );
  const events = parseSseOutput(output);

  const added = events.filter((e) => e.event === "response.output_item.added");
  assert.equal(added.length, 2, "one function_call + one parallel tool_use output_item.added");
  const types = added.map((e) => (JSON.parse(e.data!).item as { type: string }).type);
  assert.deepEqual(types.sort(), ["function_call", "tool_use"]);

  const toolUseAdded = added.find(
    (e) => (JSON.parse(e.data!).item as { type: string }).type === "tool_use"
  );
  const toolUseItem = JSON.parse(toolUseAdded!.data!).item as Record<string, unknown>;
  assert.equal(toolUseItem.name, "lookup");
  assert.deepEqual(toolUseItem.input, {});
  assert.equal(toolUseItem.id, "fc_call_b", "tool_use shares id with the function_call");
});

test("tool_use done event has parsed input when arguments are valid JSON", async () => {
  const tools = [
    {
      name: "lookup",
      input_schema: { type: "object", properties: { q: { type: "string" } } },
    },
  ];
  const args = JSON.stringify({ q: "hello", n: 2 });
  const output = await runTransformStream(
    [
      sse({
        toolCalls: [{ index: 0, id: "call_c", function: { name: "lookup", arguments: args } }],
      }),
      sse({ finishReason: "tool_calls" }),
    ],
    { tools }
  );

  const completed = getCompleted(output);
  const outputArr = completed.output as Array<Record<string, unknown>>;
  const funcCall = outputArr.find((i) => i.type === "function_call");
  const toolUse = outputArr.find((i) => i.type === "tool_use");
  assert.ok(funcCall, "function_call item present");
  assert.ok(toolUse, "tool_use item present");
  assert.equal(toolUse.id, funcCall.id, "tool_use and function_call share id");
  assert.deepEqual(
    toolUse.input,
    { q: "hello", n: 2 },
    "input is the parsed JSON object, not a string"
  );
  assert.equal(typeof funcCall.arguments, "string");
  assert.equal(typeof toolUse.input, "object");
});

test("tool_use input is empty-object when arguments are invalid JSON", async () => {
  const tools = [{ name: "broken", input_schema: { type: "object" } }];
  const output = await runTransformStream(
    [
      sse({
        toolCalls: [
          { index: 0, id: "call_d", function: { name: "broken", arguments: "not json" } },
        ],
      }),
      sse({ finishReason: "tool_calls" }),
    ],
    { tools }
  );
  const completed = getCompleted(output);
  const toolUse = (completed.output as Array<Record<string, unknown>>).find(
    (i) => i.type === "tool_use"
  );
  assert.ok(toolUse);
  assert.deepEqual(toolUse.input, {}, "invalid JSON falls back to empty object");
});

test("emitToolUse=true forces tool_use emission even for Chat-shaped tools", async () => {
  const tools = [{ type: "function", function: { name: "lookup", parameters: {} } }];
  const output = await runTransformStream(
    [
      sse({
        toolCalls: [{ index: 0, id: "call_e", function: { name: "lookup", arguments: "{}" } }],
      }),
      sse({ finishReason: "tool_calls" }),
    ],
    { tools, emitToolUse: true }
  );
  const completed = getCompleted(output);
  const outputArr = completed.output as Array<Record<string, unknown>>;
  assert.ok(
    outputArr.find((i) => i.type === "function_call"),
    "function_call still present"
  );
  assert.ok(
    outputArr.find((i) => i.type === "tool_use"),
    "tool_use forced on by opt-in"
  );
});

test("tool_use and function_call share the SAME id and output_index in dense output", async () => {
  const tools = [{ name: "lookup", input_schema: { type: "object" } }];
  const output = await runTransformStream(
    [
      sse({
        toolCalls: [{ index: 0, id: "call_f", function: { name: "lookup", arguments: "{}" } }],
      }),
      sse({ finishReason: "tool_calls" }),
    ],
    { tools }
  );
  const completed = getCompleted(output);
  const outputArr = completed.output as Array<Record<string, unknown>>;
  const fc = outputArr.find((i) => i.type === "function_call") as Record<string, unknown>;
  const tu = outputArr.find((i) => i.type === "tool_use") as Record<string, unknown>;
  assert.equal(fc.id, tu.id);
});

test("tool_use streaming events: output_item.added + output_item.done both fire", async () => {
  const tools = [{ name: "lookup", input_schema: { type: "object" } }];
  const output = await runTransformStream(
    [
      sse({
        toolCalls: [{ index: 0, id: "call_g", function: { name: "lookup", arguments: "{}" } }],
      }),
      sse({ finishReason: "tool_calls" }),
    ],
    { tools }
  );
  const events = parseSseOutput(output);
  const addedTypes = events
    .filter((e) => e.event === "response.output_item.added")
    .map((e) => (JSON.parse(e.data!).item as { type: string }).type);
  const doneTypes = events
    .filter((e) => e.event === "response.output_item.done")
    .map((e) => (JSON.parse(e.data!).item as { type: string }).type);
  assert.deepEqual(addedTypes.sort(), ["function_call", "tool_use"], "both added");
  assert.deepEqual(doneTypes.sort(), ["function_call", "tool_use"], "both done");
});

// ───────────────────────── 2. structured_outputs ─────────────────────────

test("structured_outputs: response_format json_schema is echoed on response", async () => {
  const request = {
    model: "gpt-5.5",
    input: "extract",
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "user_profile",
        schema: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
        strict: true,
      },
    },
  };
  const output = await runTransformStream(
    [sse({ content: JSON.stringify({ name: "K" }) }), sse({ finishReason: "stop" })],
    { request }
  );

  const created = getCreated(output);
  const completed = getCompleted(output);
  const expectedFormat = {
    type: "json_schema",
    name: "user_profile",
    schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
    strict: true,
  };
  assert.deepEqual(created.output_format, expectedFormat);
  assert.deepEqual(completed.output_format, expectedFormat);
});

test("structured_outputs: json_object is echoed on response", async () => {
  const request = { model: "gpt-5.5", input: "x", response_format: { type: "json_object" } };
  const output = await runTransformStream([sse({ content: "{}" }), sse({ finishReason: "stop" })], {
    request,
  });
  const completed = getCompleted(output);
  assert.deepEqual(completed.output_format, { type: "json_object" });
});

test("structured_outputs: text format is echoed on response", async () => {
  const request = { model: "gpt-5.5", input: "x", response_format: { type: "text" } };
  const output = await runTransformStream([sse({ content: "hi" }), sse({ finishReason: "stop" })], {
    request,
  });
  const completed = getCompleted(output);
  assert.deepEqual(completed.output_format, { type: "text" });
});

test("structured_outputs: absent response_format does NOT add output_format field", async () => {
  const output = await runTransformStream([sse({ content: "hi" }), sse({ finishReason: "stop" })]);
  const completed = getCompleted(output);
  assert.equal(
    "output_format" in completed,
    false,
    "output_format should be absent when request has no response_format"
  );
});

test("structured_outputs: json_schema without strict defaults strict=true", async () => {
  const request = {
    model: "gpt-5.5",
    response_format: {
      type: "json_schema",
      json_schema: { name: "x", schema: { type: "object" } },
    },
  };
  const output = await runTransformStream([sse({ content: "{}" }), sse({ finishReason: "stop" })], {
    request,
  });
  const completed = getCompleted(output);
  const fmt = completed.output_format as Record<string, unknown>;
  assert.equal(fmt.strict, true, "strict defaults to true when omitted");
});

test("structured_outputs: strict:false is honored", async () => {
  const request = {
    model: "gpt-5.5",
    response_format: {
      type: "json_schema",
      json_schema: { name: "x", schema: {}, strict: false },
    },
  };
  const output = await runTransformStream([sse({ content: "{}" }), sse({ finishReason: "stop" })], {
    request,
  });
  const completed = getCompleted(output);
  const fmt = completed.output_format as Record<string, unknown>;
  assert.equal(fmt.strict, false);
});

// ───────────────────────── 3. prompt_cache_control ─────────────────────────

test("prompt_cache_key: snake_case from request is echoed on response", async () => {
  const request = { model: "gpt-5.5", input: "x", prompt_cache_key: "user-42-session-7" };
  const output = await runTransformStream([sse({ content: "hi" }), sse({ finishReason: "stop" })], {
    request,
  });
  const created = getCreated(output);
  const completed = getCompleted(output);
  assert.equal(created.prompt_cache_key, "user-42-session-7");
  assert.equal(completed.prompt_cache_key, "user-42-session-7");
});

test("prompt_cache_key: camelCase alias is also accepted", async () => {
  const request = { model: "gpt-5.5", input: "x", promptCacheKey: "session-99" };
  const output = await runTransformStream([sse({ content: "hi" }), sse({ finishReason: "stop" })], {
    request,
  });
  const completed = getCompleted(output);
  assert.equal(completed.prompt_cache_key, "session-99");
});

test("prompt_cache_key: snake_case wins when both forms are present", async () => {
  const request = {
    model: "gpt-5.5",
    input: "x",
    prompt_cache_key: "snake",
    promptCacheKey: "camel",
  };
  const output = await runTransformStream([sse({ content: "hi" }), sse({ finishReason: "stop" })], {
    request,
  });
  const completed = getCompleted(output);
  assert.equal(completed.prompt_cache_key, "snake");
});

test("prompt_cache_key: absent when no cache key in request", async () => {
  const output = await runTransformStream([sse({ content: "hi" }), sse({ finishReason: "stop" })]);
  const completed = getCompleted(output);
  assert.equal("prompt_cache_key" in completed, false);
});

test("usage: cache_creation_input_tokens + cache_read_input_tokens are forwarded as-is", async () => {
  const output = await runTransformStream([
    sse({ content: "hi" }),
    sse({
      usageOnly: true,
      usage: {
        prompt_tokens: 10,
        completion_tokens: 2,
        total_tokens: 12,
        cache_creation_input_tokens: 900,
        cache_read_input_tokens: 1234,
      },
    }),
  ]);
  const completed = getCompleted(output);
  const usage = completed.usage as Record<string, unknown>;
  assert.equal(usage.cache_creation_input_tokens, 900);
  assert.equal(usage.cache_read_input_tokens, 1234);
  assert.equal(usage.prompt_tokens, 10);
  assert.equal(usage.completion_tokens, 2);
});

test("usage: missing cache_* fields are NOT invented", async () => {
  const output = await runTransformStream([
    sse({ content: "hi" }),
    sse({
      usageOnly: true,
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
    }),
  ]);
  const completed = getCompleted(output);
  const usage = completed.usage as Record<string, unknown>;
  assert.equal("cache_creation_input_tokens" in usage, false);
  assert.equal("cache_read_input_tokens" in usage, false);
});

test("usage: OpenAI-shaped cached_tokens is also forwarded", async () => {
  const output = await runTransformStream([
    sse({ content: "hi" }),
    sse({
      usageOnly: true,
      usage: {
        prompt_tokens: 10,
        completion_tokens: 2,
        total_tokens: 12,
        cached_tokens: 800,
      },
    }),
  ]);
  const completed = getCompleted(output);
  const usage = completed.usage as Record<string, unknown>;
  assert.equal(usage.cached_tokens, 800);
});

// ───────────────────────── 4. Existing behavior — baseline guards ─────────────────────────
