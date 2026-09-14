/**
 * Regression: claude-wire format vision targets (MiniMax, Z.AI, Kimi, …)
 * reject remote image URLs (MiniMax 403 code 2013). The vision bridge must
 * normalize remote URLs to base64 data URIs for these targets.
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  isClaudeWireFormatModel,
  ensureBase64ImagesForClaudeWire,
} = await import("../../../src/lib/guardrails/visionBridgeHelpers.ts");

test("isClaudeWireFormatModel: true for anthropic and claude-format registry providers", () => {
  assert.strictEqual(isClaudeWireFormatModel("anthropic/claude-sonnet-4"), true);
  assert.strictEqual(isClaudeWireFormatModel("zai/glm-5"), true);
  assert.strictEqual(isClaudeWireFormatModel("claude/claude-opus"), true);
  assert.strictEqual(isClaudeWireFormatModel("wafer/wafer-model"), true);
});

test("isClaudeWireFormatModel: false for openai-format providers", () => {
  assert.strictEqual(isClaudeWireFormatModel("openai/gpt-4o-mini"), false);
  // minimax deliberately moved claude→openai format so images work (#9463).
  assert.strictEqual(isClaudeWireFormatModel("minimax/MiniMax-M3"), false);
  assert.strictEqual(isClaudeWireFormatModel("kiro/minimax-m2.5"), false);
  assert.strictEqual(isClaudeWireFormatModel("auto/best-vision"), false);
  assert.strictEqual(isClaudeWireFormatModel(null), false);
});

test("ensureBase64ImagesForClaudeWire: passthrough for non-claude-wire models", async () => {
  const body = {
    model: "openai/gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "hi" },
          { type: "image_url", image_url: { url: "https://example.com/a.png" } },
        ],
      },
    ],
  };
  const out = await ensureBase64ImagesForClaudeWire(body, "openai/gpt-4o-mini");
  assert.strictEqual(out, body, "non-claude-wire body must be returned untouched");
});

test("ensureBase64ImagesForClaudeWire: keeps data-URI images as-is", async () => {
  const dataUri = "data:image/png;base64,iVBORw0KGgo=";
  const body = {
    model: "zai/glm-5",
    messages: [
      {
        role: "user",
        content: [{ type: "image_url", image_url: { url: dataUri } }],
      },
    ],
  };
  const out = await ensureBase64ImagesForClaudeWire(body, "zai/glm-5");
  const part = out.messages[0].content[0];
  assert.strictEqual(part.image_url.url, dataUri);
});

test("ensureBase64ImagesForClaudeWire: resolves remote URLs to base64 for claude-wire targets", async () => {
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(new Uint8Array(Buffer.from(pngBase64, "base64")), {
      status: 200,
      headers: { "content-type": "image/png" },
    });

  try {
    const body = {
      model: "zai/glm-5",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is this?" },
            { type: "image_url", image_url: { url: "https://example.com/cat.png" } },
          ],
        },
      ],
    };
    const out = await ensureBase64ImagesForClaudeWire(
      body,
      "zai/glm-5",
      async () =>
        new Response(new Uint8Array(Buffer.from(pngBase64, "base64")), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
    );
    const part = out.messages[0].content[1];
    assert.ok(
      part.image_url.url.startsWith("data:image/png;base64,"),
      "remote URL must be resolved to a base64 data URI"
    );
    assert.ok(part.image_url.url.includes(pngBase64));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ensureBase64ImagesForClaudeWire: fail-open when the remote fetch fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("network down");
  };

  try {
    const body = {
      model: "zai/glm-5",
      messages: [
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: "https://example.com/cat.png" } }],
        },
      ],
    };
    const out = await ensureBase64ImagesForClaudeWire(body, "zai/glm-5", async () => {
      throw new Error("network down");
    });
    const part = out.messages[0].content[0];
    assert.strictEqual(part.image_url.url, "https://example.com/cat.png");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
