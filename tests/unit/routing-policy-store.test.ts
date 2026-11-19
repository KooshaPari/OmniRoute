import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ROUTING_POLICY_FILE,
  loadRoutingPolicies,
  validatePolicies,
} from "../../src/lib/routing/policyStore.ts";

function withTempDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-policy-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

function writePolicies(dir: string, value: unknown): void {
  fs.writeFileSync(path.join(dir, ROUTING_POLICY_FILE), JSON.stringify(value), "utf8");
}

const validPolicy = {
  id: "premium",
  name: "Premium routing",
  type: "cel",
  enabled: true,
  priority: 5,
  conditions: { expression: 'context.metadata.tier == "premium"' },
  actions: { prefer_provider: ["openai"] },
};

test("a missing policy file is empty and error-free", () => {
  withTempDir((dir) => {
    const loaded = loadRoutingPolicies(dir);
    assert.equal(loaded.exists, false);
    assert.deepEqual(loaded.policies, []);
    assert.deepEqual(loaded.errors, []);
  });
});

test("an array policy file is loaded", () => {
  withTempDir((dir) => {
    writePolicies(dir, [validPolicy]);
    const loaded = loadRoutingPolicies(dir);
    assert.equal(loaded.exists, true);
    assert.deepEqual(loaded.errors, []);
    assert.equal(loaded.policies.length, 1);
    assert.equal(loaded.policies[0].id, "premium");
  });
});

test("an object with a policies array is loaded", () => {
  withTempDir((dir) => {
    writePolicies(dir, { policies: [validPolicy] });
    const loaded = loadRoutingPolicies(dir);
    assert.deepEqual(loaded.errors, []);
    assert.equal(loaded.policies[0].name, "Premium routing");
  });
});

test("invalid JSON is reported", () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, ROUTING_POLICY_FILE), "{not json", "utf8");
    const loaded = loadRoutingPolicies(dir);
    assert.equal(loaded.exists, true);
    assert.equal(loaded.policies.length, 0);
    assert.match(loaded.errors[0], /Unable to parse/);
  });
});

test("a non-array root is reported", () => {
  withTempDir((dir) => {
    writePolicies(dir, { nope: true });
    const loaded = loadRoutingPolicies(dir);
    assert.equal(loaded.policies.length, 0);
    assert.match(loaded.errors[0], /must be an array/);
  });
});

test("malformed entries are reported while valid entries survive", () => {
  withTempDir((dir) => {
    writePolicies(dir, [
      validPolicy,
      { name: "missing id", type: "cel", enabled: true },
      { id: "bad-type", name: "Bad", type: "does-not-exist", enabled: true },
      { id: "bad-enabled", name: "Bad", type: "routing", enabled: "yes" },
      { id: "bad-conditions", name: "Bad", type: "cel", enabled: true, conditions: "nope" },
    ]);
    const loaded = loadRoutingPolicies(dir);
    assert.equal(loaded.policies.length, 1);
    assert.equal(loaded.errors.length, 4);
    assert.ok(loaded.errors.some((error) => error.includes("policies[1]: id")));
    assert.ok(loaded.errors.some((error) => error.includes("unknown policy type")));
    assert.ok(loaded.errors.some((error) => error.includes("enabled must be a boolean")));
    assert.ok(loaded.errors.some((error) => error.includes("conditions must be an object")));
  });
});

test("priority defaults to 100", () => {
  withTempDir((dir) => {
    const { priority, ...withoutPriority } = validPolicy;
    writePolicies(dir, [withoutPriority]);
    const loaded = loadRoutingPolicies(dir);
    assert.equal(loaded.policies[0].priority, 100);
  });
});

test("validatePolicies rejects a non-array input", () => {
  assert.deepEqual(validatePolicies({}), {
    policies: [],
    errors: ["policies must be an array"],
  });
});

test("validatePolicies reports non-object entries", () => {
  assert.deepEqual(validatePolicies([null]), {
    policies: [],
    errors: ["policies[0]: expected an object"],
  });
});
