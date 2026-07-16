import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createChatPipelineHarness } from "./_chatPipelineHarness.ts";
import {
  getBifrostRouteMetrics,
  resetBifrostRouteMetricsForTest,
} from "../../open-sse/observability/bifrostRouteMetrics.ts";
import {
  resolveBifrostStreamRouteTarget,
} from "../../open-sse/handlers/chatCore/bifrostStreamOutcome.ts";

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
  await h.seedConnection("openai", { apiKey: "sk-openai-bifrost-stream" });
  const apiKey = await h.seedApiKey();

  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return createBifrostStreamingResponse();
  }) as typeof fetch;

  const response = await h.handleChat(
    h.buildRequest({
      authKey: apiKey.key,
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
  assert.ok(fetchCalls >= 1, "stream request and lifecycle instrumentation should invoke upstream fetch at least once");

  const target = resolveBifrostStreamRouteTarget("openai", "gpt-4o-mini");
  const stats = getBifrostRouteMetrics(target.provider, target.model);
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
});
