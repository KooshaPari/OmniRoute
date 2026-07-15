// @vitest-environment node
import { describe, it, beforeEach, afterEach, afterAll, beforeAll } from "vitest";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const TMP_TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "kvrl-"));

describe("Keyv rate-limiter store (embedded sqlite)", () => {
  let sqlitePath: string;

  beforeAll(() => {
    delete process.env.REDIS_URL;
    sqlitePath = path.join(TMP_TEST_DIR, "test-ratelimit.sqlite");
  });

  afterAll(() => {
    fs.rmSync(TMP_TEST_DIR, { recursive: true, force: true });
  });

  it("KeyvRateLimitStore round-trips a value", async () => {
    const { KeyvRateLimitStore } = await import(
      "../../../../src/shared/utils/rateLimiter.js"
    );
    const store = new KeyvRateLimitStore({
      uri: `keyv://sqlite/${sqlitePath}?table=rate_limiter`,
    });

    await store.set("test:key", 42, 60);
    const result = await store.get("test:key");
    expect(result, 42);

    await store.del("test:key");
    const afterDelete = await store.get("test:key");
    expect(afterDelete, undefined);
  });

  it("isRedisConfigured reflects REDIS_URL", async () => {
    const { isRedisConfigured } = await import(
      "../../../../src/shared/utils/rateLimiter.js"
    );
    process.env.REDIS_URL = "";
    expect(isRedisConfigured(), false);

    process.env.REDIS_URL = "redis://host";
    expect(isRedisConfigured(), true);

    delete process.env.REDIS_URL;
  });

  it("checkRateLimit rejects after the limit is hit (in-memory fallback)", async () => {
    const { checkRateLimit, setRateLimiterTestMode, _resetRateLimitStoreForTests } =
      await import("../../../../src/shared/utils/rateLimiter.js");

    _resetRateLimitStoreForTests();
    setRateLimiterTestMode(true);

    const keyId = `k_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const rules = [{ limit: 2, window: 60 }];

    const r1 = await checkRateLimit(keyId, rules);
    expect(r1.allowed, true);
    const r2 = await checkRateLimit(keyId, rules);
    expect(r2.allowed, true);
    const r3 = await checkRateLimit(keyId, rules);
    expect(r3.allowed, false, "third call exceeds limit");
    expect(r3.failedWindow, 60);

    setRateLimiterTestMode(false);
  });
});
