import test from "node:test";
import assert from "node:assert/strict";

import { PollinationsExecutor } from "../../open-sse/executors/pollinations.ts";

test("PollinationsExecutor.buildUrl uses the primary endpoint and the gen fallback", () => {
  const executor = new PollinationsExecutor();
  assert.equal(
    executor.buildUrl("openai", true),
    "https://text.pollinations.ai/openai/chat/completions"
  );
  assert.equal(
    executor.buildUrl("openai", true, 1),
    "https://gen.pollinations.ai/v1/chat/completions"
  );
});

test("PollinationsExecutor.buildHeaders supports anonymous access and optional SSE accept", () => {
  const executor = new PollinationsExecutor();
  assert.deepEqual(executor.buildHeaders({}, true), {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  });
});

test("PollinationsExecutor.buildHeaders sends API auth for the key-backed tier when configured", () => {
  const executor = new PollinationsExecutor();
  assert.deepEqual(executor.buildHeaders({ apiKey: "poll-key" }, true), {
    "Content-Type": "application/json",
    Authorization: "Bearer poll-key",
    Accept: "text/event-stream",
  });
});

test("PollinationsExecutor.transformRequest is a passthrough for alias models", () => {
  const executor = new PollinationsExecutor();
  const body = { model: "claude", messages: [{ role: "user", content: "hello" }] };
  assert.equal(executor.transformRequest("claude", body, true, {}), body);
});
