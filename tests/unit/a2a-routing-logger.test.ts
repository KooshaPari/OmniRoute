import test from "node:test";
import assert from "node:assert/strict";

import { logRoutingDecision } from "../../src/lib/a2a/routingLogger.ts";

test("logRoutingDecision is fire-and-forget and does not throw", () => {
  // Current API returns void and persists asynchronously; the contract is
  // "never throw into the caller" rather than returning an enriched record.
  assert.equal(
    logRoutingDecision({
      taskType: "chat",
      comboId: "combo-1",
      providerSelected: "openai",
      modelUsed: "gpt-4o-mini",
      score: 0.91,
      factors: ["health"],
      fallbacksTriggered: [],
      success: true,
      latencyMs: 123,
      cost: 0.001,
    }),
    undefined
  );
});
