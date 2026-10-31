import test from "node:test";
import assert from "node:assert/strict";

import { validateChatRequestBody } from "../../src/sse/handlers/chat/chatBodyValidation.ts";

// Regression coverage for the extracted chat body validator (#5110, #6402,
// #6407, #6412). The module returns the platform `Response` (not a
// `node-fetch` type, which is not a direct dependency), so these assertions
// pin both the rejection behaviour and the response shape that callers rely on.

async function statusAndBody(response: Response): Promise<{ status: number; body: string }> {
  return { status: response.status, body: await response.text() };
}

test("rejects a present-but-non-array messages field with a 400", async () => {
  const response = validateChatRequestBody({ messages: "not-an-array" }, "openai");
  assert.ok(response instanceof Response, "expected a Response rejection");
  const { status, body } = await statusAndBody(response);
  assert.equal(status, 400);
  assert.match(body, /messages.*Expected array/i);
});

test("rejects an empty messages array with a 400", async () => {
  const response = validateChatRequestBody({ messages: [] }, "openai");
  assert.ok(response);
  const { status, body } = await statusAndBody(response);
  assert.equal(status, 400);
  assert.match(body, /at least one message is required/i);
});

test("rejects a body with neither messages nor input unless the source is antigravity", async () => {
  const response = validateChatRequestBody({ model: "x" }, "openai");
  assert.ok(response);
  const { status, body } = await statusAndBody(response);
  assert.equal(status, 400);
  assert.match(body, /messages.*Expected array, received undefined/i);

  assert.equal(validateChatRequestBody({ model: "x" }, "antigravity"), null);
});

test("rejects a non-string model before downstream string operations", async () => {
  const response = validateChatRequestBody({ messages: [{ role: "user" }], model: 42 }, "openai");
  assert.ok(response);
  const { status, body } = await statusAndBody(response);
  assert.equal(status, 400);
  assert.match(body, /model.*Expected string, received number/i);
});

test("rejects out-of-range scalar parameters with a 400", async () => {
  const cases: Array<{ body: Record<string, unknown>; expected: RegExp }> = [
    { body: { temperature: 3 }, expected: /temperature: must be between 0 and 2/ },
    { body: { top_p: -0.1 }, expected: /top_p: must be between 0 and 1/ },
    { body: { max_tokens: 0 }, expected: /max_tokens: must be a positive integer/ },
    { body: { n: 1.5 }, expected: /n: must be a positive integer/ },
  ];

  for (const { body, expected } of cases) {
    const response = validateChatRequestBody({ messages: [{ role: "user" }], ...body }, "openai");
    assert.ok(response, `expected rejection for ${JSON.stringify(body)}`);
    const result = await statusAndBody(response);
    assert.equal(result.status, 400);
    assert.match(result.body, expected);
  }
});

test("accepts a well-formed body", () => {
  const response = validateChatRequestBody(
    {
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: 256,
      n: 1,
    },
    "openai"
  );
  assert.equal(response, null);
});
