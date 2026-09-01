import { test } from "node:test";
import assert from "node:assert/strict";
import { updateSettingsSchema } from "../../src/shared/validation/settingsSchemas.ts";

test("updateSettingsSchema preserves valid provider strategy overrides", () => {
  const result = updateSettingsSchema.safeParse({
    expectedRevision: 4,
    providerStrategies: {
      codex: { fallbackStrategy: "round-robin", stickyRoundRobinLimit: 3 },
      antigravity: { fallbackStrategy: "p2c" },
    },
  });

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.data.providerStrategies, {
    codex: { fallbackStrategy: "round-robin", stickyRoundRobinLimit: 3 },
    antigravity: { fallbackStrategy: "p2c" },
  });
});

test("updateSettingsSchema rejects malformed provider strategy overrides", () => {
  const invalidOverrides = [
    { providerStrategies: { codex: { fallbackStrategy: "unsupported" } } },
    { providerStrategies: { codex: { stickyRoundRobinLimit: 0 } } },
    { providerStrategies: { "  ": { fallbackStrategy: "p2c" } } },
  ];

  for (const body of invalidOverrides) {
    assert.equal(updateSettingsSchema.safeParse(body).success, false);
  }
});
