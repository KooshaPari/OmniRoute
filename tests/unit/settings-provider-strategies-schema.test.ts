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

test("updateSettingsSchema enforces provider strategy key and entry bounds", () => {
  const maxKey = "p".repeat(200);
  const valid = updateSettingsSchema.safeParse({
    providerStrategies: {
      [maxKey]: { fallbackStrategy: "p2c" },
    },
  });
  assert.equal(valid.success, true);

  const oversizedKey = updateSettingsSchema.safeParse({
    providerStrategies: {
      ["p".repeat(201)]: { fallbackStrategy: "p2c" },
    },
  });
  assert.equal(oversizedKey.success, false);

  const tooManyEntries = Object.fromEntries(
    Array.from({ length: 101 }, (_, index) => [
      `provider-${index}`,
      { fallbackStrategy: "p2c" },
    ])
  );
  const overLimit = updateSettingsSchema.safeParse({
    providerStrategies: tooManyEntries,
  });
  assert.equal(overLimit.success, false);
});
