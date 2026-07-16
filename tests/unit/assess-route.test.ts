import test from "node:test";
import assert from "node:assert/strict";

import type { ModelAssessment } from "../../src/domain/assessment/types.ts";

const assessRoute = await import("../../src/app/api/assess/route.ts");

test("POSTed assessments keep categorized results so GET results can filter by category", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string | URL, _options?: RequestInit) => {
    if (!String(url).endsWith("/chat/completions")) {
      throw new Error(`Unexpected fetch URL in test: ${String(url)}`);
    }

    const responsePayload = {
      choices: [{ message: { content: "ok" } }],
      usage: { completion_tokens: 1 },
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const postResponse = await assessRoute.POST(
      new Request("http://localhost/api/assess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope: { type: "model", modelId: "auto/gpt-4o-mini" },
          trigger: "on_demand",
        }),
      })
    );
    assert.equal(postResponse.status, 200, "assessment POST should return 200");

    const resultsResponse = await assessRoute.GET(
      new Request("http://localhost/api/assess?action=results&category=fast")
    );
    assert.equal(resultsResponse.status, 200, "results endpoint should return 200");

    const body = (await resultsResponse.json()) as { models: ModelAssessment[] };
    assert.equal(body.models.length, 1, "fast category should include the assessed model");
    assert.equal(body.models[0].id, "auto/gpt-4o-mini");
    assert.deepEqual(body.models[0].categories.includes("fast"), true);
    assert.ok(typeof body.models[0].fitnessScores.fast === "number");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
