import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PolicyEngine } from "../../src/domain/policyEngine.ts";
import {
  ROUTING_POLICY_FILE,
  loadRoutingPolicies,
} from "../../src/lib/routing/policyStore.ts";

function withPolicyFile(
  policies: unknown,
  fn: (loaded: ReturnType<typeof loadRoutingPolicies>) => void
): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-policy-eval-"));
  try {
    fs.writeFileSync(path.join(dir, ROUTING_POLICY_FILE), JSON.stringify(policies), "utf8");
    fn(loadRoutingPolicies(dir));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

const policies = [
  {
    id: "premium-cel",
    name: "Premium CEL",
    type: "cel",
    enabled: true,
    priority: 1,
    conditions: { expression: 'context.metadata.tier == "premium"' },
    actions: { prefer_provider: ["openai"], max_tokens: 1024 },
  },
  {
    id: "platform-team",
    name: "Platform team",
    type: "conditional",
    enabled: true,
    priority: 2,
    conditions: { condition: { "metadata.team": "platform" } },
    actions: { prefer_provider: ["anthropic"] },
  },
];

test("file-backed CEL and conditional policies evaluate through the engine", () => {
  withPolicyFile(policies, (loaded) => {
    assert.deepEqual(loaded.errors, []);
    const engine = new PolicyEngine({ celEnabled: true });
    engine.loadPolicies(loaded.policies);

    const result = engine.evaluate({
      model: "gpt-4o",
      metadata: { tier: "premium", team: "platform" },
    });
    assert.deepEqual(result.preferredProviders, ["openai", "anthropic"]);
    assert.deepEqual(result.appliedPolicies, ["Premium CEL", "Platform team"]);
    assert.equal(result.maxTokens, 1024);
    assert.deepEqual(engine.getCelErrors(), {});
    assert.deepEqual(engine.getConditionalErrors(), {});
  });
});

test("a malformed CEL policy is skipped and reported", () => {
  withPolicyFile(
    [
      {
        id: "broken",
        name: "Broken CEL",
        type: "cel",
        enabled: true,
        priority: 1,
        conditions: { expression: "@@invalid@@" },
        actions: { prefer_provider: ["openai"] },
      },
      {
        id: "working",
        name: "Working conditional",
        type: "conditional",
        enabled: true,
        priority: 2,
        conditions: { condition: { "metadata.team": "platform" } },
        actions: { prefer_provider: ["anthropic"] },
      },
    ],
    (loaded) => {
      const engine = new PolicyEngine({ celEnabled: true });
      engine.loadPolicies(loaded.policies);
      const result = engine.evaluate({ model: "gpt-4o", metadata: { team: "platform" } });
      assert.deepEqual(result.preferredProviders, ["anthropic"]);
      assert.notEqual(engine.getCelErrors().broken, undefined);
    }
  );
});
