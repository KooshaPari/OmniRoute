import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createChatPipelineHarness } from "./_chatPipelineHarness.ts";
import {
  getBifrostRouteMetrics,
  resetBifrostRouteMetricsForTest,
} from "../../open-sse/observability/bifrostRouteMetrics.ts";
import { resolveBifrostStreamRouteTarget } from "../../open-sse/handlers/chatCore/bifrostStreamOutcome.ts";

let h: Awaited<ReturnType<typeof createChatPipelineHarness>>;

let originalBifrostEnabled: string | undefined;
let originalBifrostBaseUrl: string | undefined;

before(async () => {
  h = await createChatPipelineHarness("bifrost-streaming-lifecycle");
});

after(async () => {
  await h.cleanup();
});

beforeEach(async () => {
  await h.resetStorage();
  originalBifrostEnabled = process.env.BIFROST_ENABLED;
  originalBifrostBaseUrl = process.env.BIFROST_BASE_URL;
  process.env.BIFROST_ENABLED = "1";
  process.env.BIFROST_BASE_URL = "http://bifrost.integration.local:8080";
  resetBifrostRouteMetricsForTest();
});

afterEach(() => {
  if (originalBifrostEnabled === undefined) delete process.env.BIFROST_ENABLED;
  else process.env.BIFROST_ENABLED = originalBifrostEnabled;

  if (originalBifrostBaseUrl === undefined) delete process.env.BIFROST_BASE_URL;
  else process.env.BIFROST_BASE_URL = originalBifrostBaseUrl;

  resetBifrostRouteMetricsForTest();
});

function createBifrostStreamingResponse({
  model = "gpt-4o-mini",
  text = "bifrost stream output",
} = {}) {
  const encoder = new TextEncoder();
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const stream = new ReadableStream({
    async start(controller) {
      await sleep(10);
      const firstChunk = JSON.stringify({
        id: "chatcmpl_bifrost_integration",
        object: "chat.completion.chunk",
        model,
        choices: [
          {
            index: 0,
            delta: { role: "assistant", content: text },
            finish_reason: null,
          },
        ],
      });

      controller.enqueue(encoder.encode(`data: ${firstChunk}\n\n`));

      await sleep(10);
      const usageChunk = JSON.stringify({
        id: "chatcmpl_bifrost_integration",
        object: "chat.completion.chunk",
        model,
        choices: [],
        usage: {
          prompt_tokens: 4,
          completion_tokens: 12,
          total_tokens: 16,
        },
      });
      controller.enqueue(encoder.encode(`data: ${usageChunk}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function createBifrostStreamReadinessFailureResponse() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": keepalive\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function readSse(response: Response): Promise<string> {
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let out = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      out += decoder.decode(value, { stream: true });
    }
  }

  return out;
}

test("Bifrost streaming lifecycle records exactly one successful outcome sample", async () => {
  const connection = await h.seedConnection("openai", { apiKey: "sk-openai-bifrost-stream" });
  const apiKey = await h.seedApiKey();

  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return createBifrostStreamingResponse();
  }) as typeof fetch;

  const response = await h.handleChat(
    h.buildRequest({
      authKey: apiKey.key,
      headers: { "x-omniroute-connection": connection.id },
      body: {
        model: "openai/gpt-4o-mini",
        stream: true,
        messages: [{ role: "user", content: "Please confirm stream status." }],
      },
    })
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/event-stream");
  const streamText = await readSse(response);
  assert.match(streamText, /bifrost stream output/);
  assert.match(streamText, /data: \[DONE\]/);
  assert.ok(
    fetchCalls >= 1,
    "stream request and lifecycle instrumentation should invoke upstream fetch at least once"
  );

  const target = resolveBifrostStreamRouteTarget("openai", "gpt-4o-mini");
  const stats = getBifrostRouteMetrics(target.provider, target.model, connection.id);
  assert.ok(stats);
  assert.equal(stats?.sampleCount, 1);
  assert.equal(stats?.successCount, 1);
  assert.equal(stats?.failureCount, 0);
  assert.equal(stats?.lastStatus, 200);
  assert.ok(stats?.avgLatencyMs >= 0);
  assert.ok(stats?.avgTtftMs === null || stats?.avgTtftMs >= 0);
  assert.ok(
    stats?.avgTokensPerSecond === null || stats?.avgTokensPerSecond >= 0,
    "avgTokensPerSecond should be present or explicitly unavailable"
  );
  assert.equal(getBifrostRouteMetrics(target.provider, target.model), null);
});

test("Bifrost stream readiness failures record one failed outcome sample", async () => {
  const connection = await h.seedConnection("openai", {
    apiKey: "sk-openai-bifrost-readiness-failure",
  });
  const apiKey = await h.seedApiKey();
  const headers = { "x-omniroute-connection": connection.id };

  globalThis.fetch = (async () => createBifrostStreamReadinessFailureResponse()) as typeof fetch;

  const response = await h.handleChat(
    h.buildRequest({
      authKey: apiKey.key,
      headers,
      body: {
        model: "openai/gpt-4.1",
        stream: true,
        messages: [{ role: "user", content: "this should fail readiness" }],
      },
    })
  );
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.error.code, "STREAM_EARLY_EOF");

  const target = resolveBifrostStreamRouteTarget("openai", "gpt-4.1");
  const stats = getBifrostRouteMetrics(target.provider, target.model, connection.id);
  assert.ok(stats);
  assert.equal(stats?.sampleCount, 1);
  assert.equal(stats?.successCount, 0);
  assert.equal(stats?.failureCount, 1);
  assert.equal(stats?.lastStatus, 502);
  assert.equal(typeof stats?.lastError, "string");
  assert.match(stats?.lastError, /Stream ended before producing a non-ping SSE event/);
  assert.equal(getBifrostRouteMetrics(target.provider, target.model), null);
});
