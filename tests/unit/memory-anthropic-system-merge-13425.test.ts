/**
 * Tests for #13425: Anthropic-shaped requests carry the system prompt as a
 * top-level `system` string field, not as a `messages[0]` role:"system" entry.
 * For providers routed through injectSystemFirst() (strict system-must-be-first
 * providers, and the Claude-family cache-safe reroute), memory text must be
 * merged into that top-level `system` field instead of injecting a role:"system"
 * message — Anthropic rejects a system role at messages[0].
 *
 * The behavior under test lives in src/lib/memory/injection.ts::injectSystemFirst
 * and is only reachable through the public injectMemory() entrypoint.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { injectMemory } from "../../src/lib/memory/injection.ts";
import type { ChatMessage, ChatRequest } from "../../src/lib/memory/injection.ts";
import type { Memory } from "../../src/lib/memory/types.ts";

function mem(content: string): Memory {
  return {
    id: `mem-${content}`,
    content,
    type: "factual" as Memory["type"],
    apiKeyId: "k",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    importance: 0.5,
  } as unknown as Memory;
}

/** Strict system-must-be-first provider — always routed through injectSystemFirst. */
const STRICT_PROVIDER = "xiaomi-mimo";

/** Anthropic-shaped request: system prompt in the top-level `system` field. */
function anthropicShaped(): ChatRequest {
  return {
    model: "claude-sonnet-4-6",
    system: "You are a helpful assistant.",
    messages: [
      { role: "user", content: "hello" } as ChatMessage,
      { role: "assistant", content: "hi" } as ChatMessage,
      { role: "user", content: "what is 2+2?" } as ChatMessage,
    ],
  };
}

describe("injectMemory top-level system merge (#13425)", () => {
  it("merges memory into an existing top-level `system` string (strict provider)", () => {
    const req = anthropicShaped();
    const out = injectMemory(req, [mem("dark mode")], STRICT_PROVIDER);

    // Memory text is prepended to the existing system string...
    assert.equal(typeof out.system, "string");
    assert.ok(
      (out.system as string).startsWith("Memory context: dark mode"),
      `system must start with memory context, got: ${String(out.system)}`
    );
    assert.ok(
      (out.system as string).endsWith("You are a helpful assistant."),
      `original system prompt must be preserved, got: ${String(out.system)}`
    );
    // ...and the original system prompt is still present exactly once.
    assert.equal((out.system as string).split("You are a helpful assistant.").length - 1, 1);
  });

  it("does NOT insert a role:\"system\" message when a top-level system exists", () => {
    const req = anthropicShaped();
    const out = injectMemory(req, [mem("dark mode")], STRICT_PROVIDER);

    // Anthropic rejects a system role inside messages — none may be injected.
    assert.equal(
      out.messages.some((m) => m.role === "system"),
      false,
      "no role:system message may be added when a top-level system field is present"
    );
    // The caller's message list is otherwise untouched.
    assert.equal(out.messages.length, req.messages.length);
    assert.deepEqual(out.messages, req.messages);
  });

  it("merges into the top-level `system` on the Claude-family cache-safe path too", () => {
    // cacheSafe + Claude provider + a plain-text assistant turn before the splice
    // point routes through injectSystemFirst (#11290). The top-level system merge
    // must apply on that path as well.
    const req = anthropicShaped();
    const out = injectMemory(req, [mem("dark mode")], "anthropic", { cacheSafe: true });

    assert.equal(typeof out.system, "string");
    assert.ok((out.system as string).startsWith("Memory context: dark mode"));
    assert.equal(
      out.messages.some((m) => m.role === "system"),
      false,
      "no role:system message may be added on the cache-safe Claude path"
    );
    assert.deepEqual(out.messages, req.messages);
  });

  it("regression: empty/absent top-level `system` keeps the leading-system-message path", () => {
    // With no top-level system field, the pre-#13425 behavior must hold: a
    // role:"system" message is injected at index 0 for a strict provider.
    const req: ChatRequest = {
      model: "mimo-v2.5",
      messages: [
        { role: "user", content: "hello" } as ChatMessage,
        { role: "user", content: "again" } as ChatMessage,
      ],
    };
    const out = injectMemory(req, [mem("dark mode")], STRICT_PROVIDER);

    assert.equal(out.system, undefined);
    assert.equal(out.messages[0].role, "system");
    assert.ok(out.messages[0].content.includes("Memory context"));
    assert.equal(out.messages.length, req.messages.length + 1);
  });
});
