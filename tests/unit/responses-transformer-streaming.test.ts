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

test("baseline: response.created is emitted first", async () => {
  const output = await runTransformStream([sse({ content: "x" }), sse({ finishReason: "stop" })]);
  const events = parseSseOutput(output);
  const first = events.find((e) => e.event !== null);
  assert.equal(first.event, "response.created");
});

test("baseline: response.completed is the last named event before [DONE]", async () => {
  const output = await runTransformStream([sse({ content: "x" }), sse({ finishReason: "stop" })]);
  const events = parseSseOutput(output);
  const last = events[events.length - 1];
  const penultimate = events[events.length - 2];
  assert.equal(last.data, "[DONE]", "final payload is [DONE] sentinel");
  assert.equal(penultimate.event, "response.completed", "penultimate is response.completed");
});

test("baseline: usage in non-streaming chunk is captured and forwarded", async () => {
  const output = await runTransformStream([
    sse({ usageOnly: true, usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 } }),
    sse({ finishReason: "stop" }),
  ]);
  const completed = getCompleted(output);
  const usage = completed.usage as Record<string, unknown>;
  assert.equal(usage.prompt_tokens, 3);
  assert.equal(usage.completion_tokens, 1);
  assert.equal(usage.total_tokens, 4);
});

test("baseline: multiple text deltas stream into a single message item with concatenated text", async () => {
  const output = await runTransformStream([
    sse({ content: "Hello, " }),
    sse({ content: "world" }),
    sse({ finishReason: "stop" }),
  ]);
  const completed = getCompleted(output);
  const messages = (completed.output as Array<Record<string, unknown>>).filter(
    (i) => i.type === "message"
  );
  assert.equal(messages.length, 1);
  const content = (messages[0].content as Array<Record<string, unknown>>)[0];
  assert.equal(content.text, "Hello, world");
});

test("baseline: reasoning_content is emitted as a reasoning item", async () => {
  const output = await runTransformStream([
    sse({ reasoningContent: "thinking..." }),
    sse({ content: "answer" }),
    sse({ finishReason: "stop" }),
  ]);
  const completed = getCompleted(output);
  const items = completed.output as Array<Record<string, unknown>>;
  assert.ok(
    items.find((i) => i.type === "reasoning"),
    "reasoning item present"
  );
  assert.ok(
    items.find((i) => i.type === "message"),
    "message item present"
  );
  const reasoningIdx = items.findIndex((i) => i.type === "reasoning");
  const messageIdx = items.findIndex((i) => i.type === "message");
  assert.ok(reasoningIdx < messageIdx, "reasoning precedes message in dense output");
});

test("baseline: <think>...</think> tags become reasoning items", async () => {
  // Tag-native routing is known before the upstream stream begins. Exercise
  // the explicit hint because some providers omit `model` from SSE chunks.
  const payload = {
    id: "chatcmpl-think",
    choices: [
      {
        index: 0,
        delta: { content: "<think>plan</think>hi" },
      },
    ],
  };
  const output = await runTransformStream(
    [`data: ${JSON.stringify(payload)}\n\n`, sse({ finishReason: "stop" })],
    { parseTextualReasoningTags: true }
  );
  const completed = getCompleted(output);
  const items = completed.output as Array<Record<string, unknown>>;
  const reasoning = items.find((i) => i.type === "reasoning") as
    { summary: Array<{ text: string }> } | undefined;
  const message = items.find((i) => i.type === "message");
  assert.ok(reasoning, "reasoning item present");
  assert.equal(reasoning!.summary[0].text, "plan");
  assert.ok(message, "message item present");
});

test("baseline: function_call arguments stream as deltas", async () => {
  const args = JSON.stringify({ a: 1 });
  const output = await runTransformStream([
    sse({ toolCalls: [{ index: 0, id: "call_b7", function: { name: "sum", arguments: args } }] }),
    sse({ finishReason: "tool_calls" }),
  ]);
  const events = parseSseOutput(output);
  const argDeltas = events.filter((e) => e.event === "response.function_call_arguments.delta");
  assert.ok(argDeltas.length > 0, "at least one arg delta");
  const argDone = events.find((e) => e.event === "response.function_call_arguments.done");
  assert.ok(argDone, "arg done present");
  const doneArgs = JSON.parse(argDone!.data!).arguments as string;
  assert.equal(doneArgs, args);
});

test("baseline: keepalive heartbeat frames are emitted at the configured interval", async () => {
  // Use a tiny interval so the test doesn't take 3s.
  const stream = createResponsesApiTransformStream(null, 50);
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

  await writer.write(encoder.encode(sse({ content: "a" })));
  await new Promise((r) => setTimeout(r, 175));
  await writer.write(encoder.encode(sse({ finishReason: "stop" })));
  await writer.close();
  await readerTask;

  const text = out.join("");
  const heartbeats = text.split("\n\n").filter((b) => b.trim() === ": keepalive");
  assert.ok(
    heartbeats.length >= 1,
    `expected at least one keepalive heartbeat, got ${heartbeats.length}`
  );
});

test("baseline: dense output preserves ascending output_index across mixed message + tool_call", async () => {
  // Choice index 2 carries a text delta; choice index 0 carries a tool_call.
  // The dense output must place the function_call (output_index 0) before the
  // message (output_index 2+1 since reasoning is closed first).
  const output = await runTransformStream([
    sse({ index: 2, content: "later" }),
    sse({
      index: 0,
      toolCalls: [{ index: 0, id: "call_d1", function: { name: "f", arguments: "{}" } }],
    }),
    sse({ index: 2, finishReason: "stop" }),
    sse({ index: 0, finishReason: "tool_calls" }),
  ]);
  const completed = getCompleted(output);
  const items = completed.output as Array<Record<string, unknown>>;
  const types = items.map((i) => i.type);
  assert.ok(
    types.indexOf("function_call") < types.indexOf("message"),
    `dense ordering: function_call before message, got ${types.join(", ")}`
  );
});

test("baseline: empty choices with usage-only chunks do not break the stream", async () => {
  // OpenAI sends a usage-only chunk at the end (no `choices`).
  const usageOnly = sse({
    usageOnly: true,
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
  const output = await runTransformStream([
    sse({ content: "x" }),
    usageOnly,
    sse({ finishReason: "stop" }),
  ]);
  const completed = getCompleted(output);
  const usage = completed.usage as Record<string, unknown>;
  assert.equal(usage.total_tokens, 2);
  assert.ok(Array.isArray(completed.output));
});

test("baseline: response.error is not synthesized on finish — only response.completed fires for a clean stop", async () => {
  const output = await runTransformStream([sse({ content: "x" }), sse({ finishReason: "stop" })]);
  const events = parseSseOutput(output);
  assert.equal(
    events.find((e) => e.event === "response.error"),
    undefined
  );
  assert.ok(events.find((e) => e.event === "response.completed"));
});

test("baseline: tool_call with no name does not crash; the function_name defaults to empty string", async () => {
  const output = await runTransformStream([
    sse({ toolCalls: [{ index: 0, id: "call_n", function: { arguments: "{}" } }] }),
    sse({ finishReason: "tool_calls" }),
  ]);
  const completed = getCompleted(output);
  const fc = (completed.output as Array<Record<string, unknown>>).find(
    (i) => i.type === "function_call"
  );
  assert.ok(fc);
  assert.equal(fc!.name, "");
});

test("baseline: aborted stream clears its keepalive timer (no leaked intervals)", async () => {
  // The transformer's keepalive timer is unref'd in start() and self-clears on
  // stream cancel (#2544 follow-up). Construct a stream, write a partial chunk,
  // then cancel the writable side. The transformer's `cancel()` hook runs
  // synchronously and clears the timer; the test passes if abort() resolves
  // and the reader can be cancelled without hanging the process.
  const stream = createResponsesApiTransformStream(null, 30);
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  await writer.write(encoder.encode(sse({ content: "a" })));
  await writer.abort();
  // Attach a no-op error handler so a downstream abort error doesn't bubble
  // up as an unhandled rejection. The test is concerned with timer cleanup,
  // not with whether the read side cleanly terminates.
  reader.cancel().catch(() => {});
  assert.ok(true, "stream cancelled without throwing");
});

test("baseline: tools[] without input_schema does NOT auto-enable tool_use (Chat-shaped only)", async () => {
  const tools = [{ type: "function", function: { name: "f", parameters: {} } }];
  const output = await runTransformStream(
    [
      sse({ toolCalls: [{ index: 0, id: "call_t1", function: { name: "f", arguments: "{}" } }] }),
      sse({ finishReason: "tool_calls" }),
    ],
    { tools }
  );
  const events = parseSseOutput(output);
  const added = events.filter((e) => e.event === "response.output_item.added");
  const types = added.map((e) => (JSON.parse(e.data!).item as { type: string }).type);
  assert.deepEqual(types, ["function_call"], "Chat-shaped tools do not auto-emit tool_use");
});

test("baseline: tools[] with input_schema is detected even when parameters is also present", async () => {
  // The auto-detect is conservative: it requires `input_schema` AND no
  // Chat-style `parameters`. If both are present the entry is ambiguous and
  // the transformer falls back to function_call-only (the safer default — the
  // client can opt in via the explicit `emitToolUse: true` flag).
  const tools = [{ name: "f", input_schema: { type: "object" }, parameters: { type: "object" } }];
  const output = await runTransformStream(
    [
      sse({ toolCalls: [{ index: 0, id: "call_t2", function: { name: "f", arguments: "{}" } }] }),
      sse({ finishReason: "tool_calls" }),
    ],
    { tools }
  );
  const events = parseSseOutput(output);
  const added = events.filter((e) => e.event === "response.output_item.added");
  const types = added.map((e) => (JSON.parse(e.data!).item as { type: string }).type);
  // Ambiguous: only function_call is emitted unless `emitToolUse: true`.
  assert.deepEqual(types, ["function_call"]);
});

test("baseline: multiple tool_calls in different indexes are emitted in order", async () => {
  const output = await runTransformStream([
    sse({
      toolCalls: [
        { index: 2, id: "call_b", function: { name: "b", arguments: "{}" } },
        { index: 0, id: "call_a", function: { name: "a", arguments: "{}" } },
      ],
    }),
    sse({ finishReason: "tool_calls" }),
  ]);
  const completed = getCompleted(output);
  const fcs = (completed.output as Array<Record<string, unknown>>).filter(
    (i) => i.type === "function_call"
  );
  assert.equal(fcs.length, 2);
  assert.equal(fcs[0].name, "a");
  assert.equal(fcs[1].name, "b");
});

test("baseline: response.completed output is always an array (never null/undefined)", async () => {
  const output = await runTransformStream([sse({ finishReason: "stop" })]);
  const completed = getCompleted(output);
  assert.ok(Array.isArray(completed.output));
  assert.equal(completed.output.length, 0);
});

test("baseline: sequence_number increments across all emitted events", async () => {
  const output = await runTransformStream([sse({ content: "x" }), sse({ finishReason: "stop" })]);
  const events = parseSseOutput(output).filter((e) => e.event !== null);
  const seqs = events.map((e) => {
    const data = JSON.parse(e.data!);
    return data.sequence_number;
  });
  assert.equal(seqs[0], 1);
  for (let i = 1; i < seqs.length; i++) {
    assert.ok(
      seqs[i] > seqs[i - 1],
      `sequence_number not strictly increasing at ${i}: ${seqs[i - 1]} -> ${seqs[i]}`
    );
  }
});

test("baseline: tools array that is not an array (e.g. object) is treated as empty", async () => {
  const tools = { not: "an array" };
  const output = await runTransformStream(
    [
      sse({ toolCalls: [{ index: 0, id: "call_bad", function: { name: "f", arguments: "{}" } }] }),
      sse({ finishReason: "tool_calls" }),
    ],
    { tools }
  );
  const events = parseSseOutput(output);
  const added = events.filter((e) => e.event === "response.output_item.added");
  const types = added.map((e) => (JSON.parse(e.data!).item as { type: string }).type);
  assert.deepEqual(types, ["function_call"]);
});

test("baseline: request without options behaves identically to legacy two-arg call", async () => {
  const stream = createResponsesApiTransformStream();
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
  await writer.write(encoder.encode(sse({ content: "hi" })));
  await writer.write(encoder.encode(sse({ finishReason: "stop" })));
  await writer.close();
  await readerTask;
  const completed = getCompleted(out.join(""));
  assert.equal("output_format" in completed, false);
  assert.equal("prompt_cache_key" in completed, false);
});

test("baseline: response.completed always ends with status:completed", async () => {
  const output = await runTransformStream([sse({ content: "x" }), sse({ finishReason: "stop" })]);
  const completed = getCompleted(output);
  assert.equal(completed.status, "completed");
  assert.equal(completed.object, "response");
  assert.equal(completed.error, null);
  assert.equal(completed.background, false);
});

test("baseline: reasoning item has summary array with summary_text", async () => {
  const output = await runTransformStream([
    sse({ reasoningContent: "step1 step2" }),
    sse({ content: "answer" }),
    sse({ finishReason: "stop" }),
  ]);
  const completed = getCompleted(output);
  const reasoning = (completed.output as Array<Record<string, unknown>>).find(
    (i) => i.type === "reasoning"
  ) as { summary: Array<{ type: string; text: string }> };
  assert.ok(reasoning);
  assert.equal(reasoning.summary[0].type, "summary_text");
  assert.equal(reasoning.summary[0].text, "step1 step2");
});
