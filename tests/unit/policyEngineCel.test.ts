import test from "node:test";
import assert from "node:assert/strict";

import { PolicyEngine, type Policy } from "../../src/domain/policyEngine.ts";

function celPolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: "cel-1",
    name: "CEL test",
    type: "cel",
    enabled: true,
    priority: 10,
    conditions: { expression: 'context.model == "gpt-4o"' },
    actions: {},
    ...overrides,
  };
}

test("cel policy applies prefer_provider and max_tokens when the expression matches", () => {
  const engine = new PolicyEngine({ celEnabled: true });
  engine.addPolicy(
    celPolicy({
      actions: { prefer_provider: ["anthropic"], max_tokens: 2048 },
    })
  );

  const result = engine.evaluate({ model: "gpt-4o" });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.preferredProviders, ["anthropic"]);
  assert.equal(result.maxTokens, 2048);
  assert.deepEqual(result.appliedPolicies, ["CEL test"]);
});

test("cel policy does not apply when the expression is false", () => {
  const engine = new PolicyEngine({ celEnabled: true });
  engine.addPolicy(celPolicy({ actions: { prefer_provider: ["anthropic"] } }));

  const result = engine.evaluate({ model: "claude-3-5-sonnet" });
  assert.deepEqual(result.preferredProviders, []);
  assert.deepEqual(result.appliedPolicies, []);
});

test("cel policy can block a model through block_model", () => {
  const engine = new PolicyEngine({ celEnabled: true });
  engine.addPolicy(
    celPolicy({
      name: "Block GPT",
      conditions: { expression: 'context.model.startsWith("gpt")' },
      actions: { block_model: ["gpt-4o"] },
    })
  );

  const result = engine.evaluate({ model: "gpt-4o" });
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? "", /blocked by policy "Block GPT"/);
  assert.deepEqual(result.appliedPolicies, ["Block GPT"]);
});

test("cel policy receives nested request metadata", () => {
  const engine = new PolicyEngine({ celEnabled: true });
  engine.addPolicy(
    celPolicy({
      conditions: { expression: 'context.metadata.tier == "premium"' },
      actions: { prefer_provider: ["openai"] },
    })
  );

  const result = engine.evaluate({
    model: "gpt-4o",
    metadata: { tier: "premium" },
  });
  assert.deepEqual(result.preferredProviders, ["openai"]);
  assert.deepEqual(result.appliedPolicies, ["CEL test"]);

  const free = engine.evaluate({
    model: "gpt-4o",
    metadata: { tier: "free" },
  });
  assert.deepEqual(free.preferredProviders, []);
});

test("cel policies are inert unless celEnabled is set", () => {
  const engine = new PolicyEngine();
  engine.addPolicy(celPolicy({ actions: { prefer_provider: ["anthropic"] } }));

  const result = engine.evaluate({ model: "gpt-4o" });
  assert.deepEqual(result.preferredProviders, []);
  assert.deepEqual(result.appliedPolicies, []);
});

test("invalid cel expressions are reported and skipped", () => {
  const engine = new PolicyEngine({ celEnabled: true });
  engine.addPolicy(
    celPolicy({
      id: "broken",
      conditions: { expression: "@@invalid@@" },
      actions: { prefer_provider: ["anthropic"] },
    })
  );

  const result = engine.evaluate({ model: "gpt-4o" });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.preferredProviders, []);
  assert.notEqual(engine.getCelErrors().broken, undefined);
});

test("loadPolicies compiles every cel policy and removePolicy clears errors", () => {
  const engine = new PolicyEngine({ celEnabled: true });
  engine.loadPolicies([
    celPolicy({
      id: "valid",
      name: "Valid",
      conditions: { expression: 'context.model == "gpt-4o"' },
    }),
    celPolicy({
      id: "invalid",
      name: "Invalid",
      conditions: { expression: "(" },
    }),
  ]);

  assert.equal(engine.getCelErrors().valid, undefined);
  assert.notEqual(engine.getCelErrors().invalid, undefined);

  engine.removePolicy("invalid");
  assert.equal(engine.getCelErrors().invalid, undefined);

  const result = engine.evaluate({ model: "gpt-4o" });
  assert.deepEqual(result.appliedPolicies, ["Valid"]);
});

test("cel policies honor model_pattern before evaluating the expression", () => {
  const engine = new PolicyEngine({ celEnabled: true });
  engine.addPolicy(
    celPolicy({
      conditions: {
        model_pattern: "gpt-*",
        expression: 'context.model == "gpt-4o"',
      },
      actions: { prefer_provider: ["openai"] },
    })
  );

  assert.deepEqual(engine.evaluate({ model: "gpt-4o" }).preferredProviders, ["openai"]);
  assert.deepEqual(engine.evaluate({ model: "claude-3-opus" }).preferredProviders, []);
});

test("a mutated cel expression is recompiled before evaluation", () => {
  const engine = new PolicyEngine({ celEnabled: true });
  const policy = celPolicy({ actions: { prefer_provider: ["anthropic"] } });
  engine.addPolicy(policy);

  assert.deepEqual(engine.evaluate({ model: "gpt-4o" }).preferredProviders, ["anthropic"]);

  policy.conditions = { expression: 'context.model == "claude"' };
  assert.deepEqual(engine.evaluate({ model: "gpt-4o" }).preferredProviders, []);
  assert.deepEqual(engine.evaluate({ model: "claude" }).preferredProviders, ["anthropic"]);

  policy.conditions = { expression: "@@invalid@@" };
  assert.deepEqual(engine.evaluate({ model: "claude" }).preferredProviders, []);
  assert.notEqual(engine.getCelErrors()["cel-1"], undefined);

  policy.conditions = { expression: 'context.model == "claude"' };
  assert.deepEqual(engine.evaluate({ model: "claude" }).preferredProviders, ["anthropic"]);
  assert.equal(engine.getCelErrors()["cel-1"], undefined);
});
