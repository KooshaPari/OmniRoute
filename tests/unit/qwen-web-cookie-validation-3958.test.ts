import test from "node:test";
import assert from "node:assert/strict";

const { validateProviderApiKey } = await import("../../src/lib/providers/validation.ts");
const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

for (const body of ['{"id":"u-1234567"}', "{}", '{"user":{"id":"u-2"}}', "<<not json>>"]) {
  test(`retired qwen-web rejects credentials without probing: ${body}`, async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response(body, { status: 200 });
    }) as typeof fetch;

    const result = await validateProviderApiKey({
      provider: "qwen-web",
      apiKey: "qwen-token-abc123",
    });
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.unsupported, true);
    assert.match(result.error, /provider validation not supported/i);
    assert.strictEqual(called, false);
  });
}
