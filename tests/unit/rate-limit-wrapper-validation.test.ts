import assert from "node:assert/strict";
import test from "node:test";

import {
  clearConnectionRateLimit,
  markConnectionRateLimitedUntil,
} from "../../src/lib/db/providers.ts";
import {
  connectionRateLimitConnectionIdSchema,
  connectionRateLimitRetryAfterMsSchema,
} from "../../src/shared/validation/schemas/misc.ts";

test("rate-limit persistence schemas preserve legacy wrapper input behavior", () => {
  assert.equal(connectionRateLimitConnectionIdSchema.safeParse(" ").success, true);
  assert.equal(connectionRateLimitConnectionIdSchema.safeParse("").success, false);
  assert.equal(connectionRateLimitConnectionIdSchema.safeParse(null).success, false);

  assert.equal(connectionRateLimitRetryAfterMsSchema.safeParse(0.5).success, true);
  assert.equal(connectionRateLimitRetryAfterMsSchema.safeParse(0).success, false);
  assert.equal(connectionRateLimitRetryAfterMsSchema.safeParse(Number.NaN).success, false);
  assert.equal(
    connectionRateLimitRetryAfterMsSchema.safeParse(Number.POSITIVE_INFINITY).success,
    false
  );
});

test("rate-limit persistence wrappers reject invalid inputs without database access", () => {
  assert.doesNotThrow(() => markConnectionRateLimitedUntil("", 1));
  assert.doesNotThrow(() => markConnectionRateLimitedUntil("connection", 0));
  assert.doesNotThrow(() => markConnectionRateLimitedUntil("connection", Number.NaN));
  assert.doesNotThrow(() => markConnectionRateLimitedUntil("connection", Number.POSITIVE_INFINITY));
  assert.doesNotThrow(() => clearConnectionRateLimit(""));
});
