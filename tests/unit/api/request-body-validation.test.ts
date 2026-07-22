import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";

import { POST as topUpBudget } from "../../../src/app/api/compression/budget/route.ts";
import { POST as createVirtualKey } from "../../../src/app/api/virtual-keys/route.ts";

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("compression budget returns 400 for malformed JSON and schema errors", async () => {
  const malformed = await topUpBudget(
    new NextRequest("http://localhost/api/compression/budget", { method: "POST", body: "{" }),
  );
  assert.equal(malformed.status, 400);

  const invalid = await topUpBudget(
    jsonRequest("http://localhost/api/compression/budget", {
      currentBudget: "100",
      additionalTokens: 20,
    }),
  );
  assert.equal(invalid.status, 400);
});

test("compression budget tops up fractional and negative numeric inputs", async () => {
  const response = await topUpBudget(
    jsonRequest("http://localhost/api/compression/budget", {
      currentBudget: 100.5,
      additionalTokens: -0.5,
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { budget: 100 });
});

test("virtual-key auth runs before malformed JSON parsing", async () => {
  const response = await createVirtualKey(
    new Request("https://example.com/api/virtual-keys", { method: "POST", body: "{" }),
  );
  assert.equal(response.status, 401);
});

test("virtual-key creation accepts camelCase aliases and mixed model arrays", async () => {
  const response = await createVirtualKey(
    jsonRequest("http://localhost/api/virtual-keys", {
      tenantId: "tenant-camel",
      label: 42,
      allowedModels: ["gpt-5", 42, "claude"],
      maxCostUsd: 1.5,
      maxRpd: 2,
    }),
  );
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.key.tenantId, "tenant-camel");
  assert.deepEqual(payload.key.allowedModels, ["gpt-5", "claude"]);
  assert.match(payload.rawKey, /^vk_/);
});

test("virtual-key creation accepts snake_case aliases", async () => {
  const response = await createVirtualKey(
    jsonRequest("http://localhost/api/virtual-keys", {
      tenant_id: "tenant-snake",
      allowed_models: ["gemini"],
      max_cost_usd: 2.25,
      max_rpd: 3,
    }),
  );
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.key.tenantId, "tenant-snake");
  assert.deepEqual(payload.key.allowedModels, ["gemini"]);
});
