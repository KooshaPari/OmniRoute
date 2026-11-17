import test from "node:test";
import assert from "node:assert/strict";

import { PolicyEngine, type Policy } from "../../src/domain/policyEngine.ts";

function conditionalPolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: "conditional-1",
    name: "Conditional test",
    type: "conditional",
    enabled: true,
    priority: 10,
    conditions: { condition: { "metadata.tier": "premium" } },
    actions: {},
    ...overrides,
  };
}

test("conditional policy applies actions when the condition matches", () => {
  const engine = new PolicyEngine();
  engine.addPolicy(
    conditionalPolicy({
      actions: { prefer_provider: ["anthropic"], max_tokens: 2048 },
    })
  );

  const result = engine.evaluate({ model: "gpt-4o", metadata: { tier: "premium" } });
  assert.deepEqual(result.preferredProviders, ["anthropic"]);
  assert.equal(result.maxTokens, 2048);
  assert.deepEqual(result.appliedPolicies, ["Conditional test"]);
});

test("conditional policy does not apply when the condition is false", () => {
  const engine = new PolicyEngine();
  engine.addPolicy(conditionalPolicy({ actions: { prefer_provider: ["anthropic"] } }));

  const result = engine.evaluate({ model: "gpt-4o", metadata: { tier: "free" } });
  assert.deepEqual(result.preferredProviders, []);
  assert.deepEqual(result.appliedPolicies, []);
});

test("conditional policy can block a model", () => {
  const engine = new PolicyEngine();
  engine.addPolicy(
    conditionalPolicy({
      name: "Block premium GPT",
      conditions: { condition: { "params.model": { $regex: "^gpt" } } },
      actions: { block_model: ["gpt-4o"] },
    })
  );

  const result = engine.evaluate({ model: "gpt-4o" });
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? "", /blocked by policy "Block premium GPT"/);
});

test("conditional policy supports nested and/or trees", () => {
  const engine = new PolicyEngine();
  engine.addPolicy(
    conditionalPolicy({
      conditions: {
        condition: {
          $and: [
            { $or: [{ "metadata.tier": "premium" }, { "metadata.tier": "enterprise" }] },
            { "params.stream": true },
          ],
        },
      },
      actions: { prefer_provider: ["openai"] },
    })
  );

  assert.deepEqual(
    engine.evaluate({
      model: "gpt-4o",
      stream: true,
      metadata: { tier: "enterprise" },
    }).preferredProviders,
    ["openai"]
  );
  assert.deepEqual(
    engine.evaluate({
      model: "gpt-4o",
      stream: false,
      metadata: { tier: "enterprise" },
    }).preferredProviders,
    []
  );
});

test("invalid conditional expressions are reported and skipped", () => {
  const engine = new PolicyEngine();
  engine.addPolicy(
    conditionalPolicy({
      id: "broken",
      conditions: { condition: { "params.priority": { $gt: 5 } } },
      actions: { prefer_provider: ["anthropic"] },
    })
  );

  const result = engine.evaluate({ model: "gpt-4o", priority: 10 });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.preferredProviders, []);
  assert.notEqual(engine.getConditionalErrors().broken, undefined);
});

test("conditional policy without a condition is skipped", () => {
  const engine = new PolicyEngine();
  engine.addPolicy(
    conditionalPolicy({
      conditions: {},
      actions: { prefer_provider: ["anthropic"] },
    })
  );

  const result = engine.evaluate({ model: "gpt-4o", metadata: { tier: "premium" } });
  assert.deepEqual(result.preferredProviders, []);
  assert.deepEqual(result.appliedPolicies, []);
});

test("conditional policy honors model_pattern before the condition", () => {
  const engine = new PolicyEngine();
  engine.addPolicy(
    conditionalPolicy({
      conditions: {
        model_pattern: "gpt-*",
        condition: { "metadata.tier": "premium" },
      },
      actions: { prefer_provider: ["openai"] },
    })
  );

  assert.deepEqual(
    engine.evaluate({ model: "gpt-4o", metadata: { tier: "premium" } }).preferredProviders,
    ["openai"]
  );
  assert.deepEqual(
    engine.evaluate({ model: "claude-3", metadata: { tier: "premium" } }).preferredProviders,
    []
  );
});

test("removing a conditional policy clears its diagnostics", () => {
  const engine = new PolicyEngine();
  engine.addPolicy(
    conditionalPolicy({
      id: "broken",
      conditions: { condition: { "params.priority": { $gt: 5 } } },
    })
  );
  engine.evaluate({ model: "gpt-4o", priority: 10 });
  assert.notEqual(engine.getConditionalErrors().broken, undefined);

  engine.removePolicy("broken");
  assert.equal(engine.getConditionalErrors().broken, undefined);
});
