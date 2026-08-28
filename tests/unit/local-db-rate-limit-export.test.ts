import assert from "node:assert/strict";
import test from "node:test";

test("providers exposes rate-limit persistence wrappers for localDb re-export", async () => {
  const providers = await import("../../src/lib/db/providers.ts");

  assert.equal(typeof providers.markConnectionRateLimitedUntil, "function");
  assert.equal(typeof providers.clearConnectionRateLimit, "function");
});
