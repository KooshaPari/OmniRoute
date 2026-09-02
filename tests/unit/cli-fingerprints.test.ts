import test from "node:test";
import assert from "node:assert/strict";

const { applyFingerprint } = await import("../../open-sse/config/cliFingerprints.ts");

test("Codex CLI fingerprint orders prompt_cache_key before include", () => {
  const body = {
    model: "gpt-5.5-low",
    stream: true,
    input: [{ role: "user", content: "hello" }],
    instructions: "You are Codex.",
    store: false,
    reasoning: { effort: "low" },
    tools: [],
    tool_choice: "auto",
    include: ["reasoning.encrypted_content"],
    prompt_cache_key: "conv-codex",
    service_tier: "priority",
  };

  const result = applyFingerprint("codex", {}, body);
  const orderedKeys = Object.keys(JSON.parse(result.bodyString));

  assert.deepEqual(orderedKeys.slice(0, 10), [
    "model",
    "stream",
    "input",
    "instructions",
    "store",
    "reasoning",
    "prompt_cache_key",
    "tools",
    "tool_choice",
    "include",
  ]);
});

test("Qwen CLI fingerprint injects the canonical OAuth wire headers", () => {
  const result = applyFingerprint("qwen", {}, { model: "qwen3-coder", messages: [] });

  assert.match(result.headers["User-Agent"], /^QwenCode\//);
  assert.equal(result.headers["X-Dashscope-AuthType"], "qwen-oauth");
  assert.equal(result.headers["X-Dashscope-CacheControl"], "enable");
  assert.equal(result.headers["X-Stainless-Lang"], "js");
  assert.deepEqual(Object.keys(result.headers).slice(0, 5), [
    "User-Agent",
    "X-Dashscope-AuthType",
    "X-Dashscope-CacheControl",
    "X-Dashscope-UserAgent",
    "X-Stainless-Arch",
  ]);
});
