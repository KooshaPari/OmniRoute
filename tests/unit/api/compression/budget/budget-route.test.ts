import test, { describe } from "node:test";
import assert from "node:assert/strict";

const route = await import("../../../../../src/app/api/compression/budget/route.ts");

async function postJson(body: unknown): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const res = await route.POST(
    new Request("http://localhost/api/compression/budget", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
  };
}

describe("POST /api/compression/budget", () => {
  test("rejects missing numeric top-up fields", async () => {
    const { status, body } = await postJson({ currentBudget: 1024 });

    assert.equal(status, 400);
    assert.equal(body.error, "currentBudget and additionalTokens are required non-negative numbers");
  });

  test("accepts a valid budget top-up body", async () => {
    const { status, body } = await postJson({
      currentBudget: 1024,
      additionalTokens: 256,
      model: "claude-opus-4",
    });

    assert.equal(status, 200);
    assert.equal(typeof body.budget, "number");
    assert.ok((body.budget as number) >= 1024);
  });
});
