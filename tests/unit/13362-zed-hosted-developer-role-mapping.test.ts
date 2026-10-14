/**
 * Issue #13362: zed-hosted OpenAI proxy rejects "developer" role
 *
 * Zed's OpenAI proxy does not understand the OpenAI-specific "developer" role.
 * The fix maps "developer" → "system" in the messages array before forwarding
 * the request to the Zed OpenAI proxy (or any other non-Anthropic provider).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Replicate the normalization logic from zed-hosted.ts so we can unit-test
 * it without importing the full executor (which has side effects / DB deps).
 */
function normalizeDeveloperRole(body: unknown): unknown {
  const rec = body as Record<string, unknown>;
  if (!Array.isArray(rec.messages)) return body;
  rec.messages = rec.messages.map((m: Record<string, unknown>) =>
    m.role === "developer" ? { ...m, role: "system" } : m
  );
  return rec;
}

describe("zed-hosted #13362: developer role mapping", () => {
  it("maps developer role to system in messages", () => {
    const body = {
      model: "gpt-4o",
      messages: [
        { role: "developer", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ],
    };
    const result = normalizeDeveloperRole(body) as Record<string, unknown>;
    const msgs = result.messages as Array<Record<string, unknown>>;
    assert.equal(msgs[0].role, "system");
    assert.equal(msgs[0].content, "You are helpful.");
    assert.equal(msgs[1].role, "user");
    assert.equal(msgs[1].content, "Hello");
  });

  it("leaves non-developer roles untouched", () => {
    const body = {
      messages: [
        { role: "system", content: "System prompt" },
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
      ],
    };
    const result = normalizeDeveloperRole(body) as Record<string, unknown>;
    const msgs = result.messages as Array<Record<string, unknown>>;
    assert.equal(msgs[0].role, "system");
    assert.equal(msgs[1].role, "user");
    assert.equal(msgs[2].role, "assistant");
  });

  it("handles body without messages array gracefully", () => {
    const body = { model: "gpt-4o", stream: true };
    const result = normalizeDeveloperRole(body) as Record<string, unknown>;
    assert.equal(result.model, "gpt-4o");
    assert.equal(result.stream, true);
    assert.equal(result.messages, undefined);
  });

  it("handles multiple developer-role messages", () => {
    const body = {
      messages: [
        { role: "developer", content: "First dev" },
        { role: "developer", content: "Second dev" },
        { role: "user", content: "Question" },
      ],
    };
    const result = normalizeDeveloperRole(body) as Record<string, unknown>;
    const msgs = result.messages as Array<Record<string, unknown>>;
    assert.equal(msgs[0].role, "system");
    assert.equal(msgs[1].role, "system");
    assert.equal(msgs[2].role, "user");
  });

  it("does not mutate other message properties", () => {
    const body = {
      messages: [
        { role: "developer", content: "Instruction", name: "custom" },
      ],
    };
    const result = normalizeDeveloperRole(body) as Record<string, unknown>;
    const msgs = result.messages as Array<Record<string, unknown>>;
    assert.equal(msgs[0].role, "system");
    assert.equal(msgs[0].content, "Instruction");
    assert.equal(msgs[0].name, "custom");
  });
});