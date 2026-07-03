import test from "node:test";
import assert from "node:assert/strict";

import { DefaultExecutor } from "../../open-sse/executors/default.ts";
import { CLAUDE_CODE_COMPATIBLE_DEFAULT_CHAT_PATH } from "../../open-sse/services/claudeCodeCompatible.ts";

test("DefaultExecutor.execute routes Responses-shaped MCP requests to /responses for OpenAI-compatible providers", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];

  globalThis.fetch = async (url, init = {}) => {
    calls.push({
      url: String(url),
      body: JSON.parse(String(init.body)) as Record<string, unknown>,
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const executor = new DefaultExecutor("openai-compatible-test");
    await executor.execute({
      model: "gpt-4.1",
      body: {
        model: "gpt-4.1",
        input: "find tools",
        tools: [{ type: "tool_search" }],
      },
      stream: false,
      credentials: {
        apiKey: "test-key",
        providerSpecificData: { baseUrl: "https://proxy.example/v1/" },
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://proxy.example/v1/responses");
  assert.equal(calls[0].body.stream_options, undefined);
  assert.deepEqual(calls[0].body.tools, [{ type: "tool_search" }]);
});

test("DefaultExecutor.buildUrl uses full chat endpoints for hosted OpenAI-compatible providers", () => {
  const bazaarlink = new DefaultExecutor("bazaarlink");
  const crof = new DefaultExecutor("crof");

  assert.equal(
    bazaarlink.buildUrl("auto:free", true),
    "https://bazaarlink.ai/api/v1/chat/completions"
  );
  assert.equal(crof.buildUrl("gpt-4.1", true), "https://crof.ai/v1/chat/completions");
});

test("DefaultExecutor.buildUrl handles openai-compatible and anthropic-compatible providers", () => {
  const openAICompat = new DefaultExecutor("openai-compatible-test");
  const openAIResponsesCompat = new DefaultExecutor("openai-compatible-responses-test");
  const openAILegacyResponsesCompat = new DefaultExecutor("openai-compatible-sp-openai");
  const anthropicCompat = new DefaultExecutor("anthropic-compatible-test");
  const anthropicCcCompat = new DefaultExecutor("anthropic-compatible-cc-test");

  assert.equal(
    openAICompat.buildUrl("gpt-4.1", true, 0, {
      providerSpecificData: { baseUrl: "https://proxy.example/v1/" },
    }),
    "https://proxy.example/v1/chat/completions"
  );
  assert.equal(
    openAICompat.buildUrl("gpt-4.1", true, 0, {
      providerSpecificData: {
        baseUrl: "https://proxy.example/v1/",
        chatPath: "/custom/chat",
      },
    }),
    "https://proxy.example/v1/custom/chat"
  );
  assert.equal(
    openAIResponsesCompat.buildUrl("gpt-4.1", true, 0, {
      providerSpecificData: { baseUrl: "https://proxy.example/v1/" },
    }),
    "https://proxy.example/v1/responses"
  );
  assert.equal(
    openAICompat.buildUrl("gpt-4.1", true, 0, {
      providerSpecificData: {
        baseUrl: "https://proxy.example/v1/",
        _omnirouteForceResponsesUpstream: true,
      },
    }),
    "https://proxy.example/v1/responses"
  );
  assert.equal(
    openAILegacyResponsesCompat.buildUrl("gpt-5.4", true, 0, {
      providerSpecificData: {
        apiType: "responses",
        baseUrl: "https://proxy.example/v1/",
      },
    }),
    "https://proxy.example/v1/responses"
  );
  assert.equal(
    anthropicCompat.buildUrl("claude-sonnet-4", true, 0, {
      providerSpecificData: { baseUrl: "https://anthropic.example/v1/" },
    }),
    "https://anthropic.example/v1/messages"
  );
  assert.equal(
    anthropicCompat.buildUrl("claude-sonnet-4", true, 0, {
      providerSpecificData: {
        baseUrl: "https://anthropic.example/v1/",
        chatPath: "/custom/messages",
      },
    }),
    "https://anthropic.example/v1/custom/messages"
  );
  assert.equal(
    anthropicCcCompat.buildUrl("claude-sonnet-4", true, 0, {
      providerSpecificData: {
        baseUrl: "https://cc.example/v1/messages",
      },
    }),
    `https://cc.example${CLAUDE_CODE_COMPATIBLE_DEFAULT_CHAT_PATH}`
  );
});
