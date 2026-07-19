/**
 * E2E: KeyvQuotaStore
 *
 * Exercises the in-memory KeyvQuotaStore: consume tokens, peek remaining,
 * clear a bucket, and verify pool totals across multiple API keys.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { KeyvQuotaStore } from "@/lib/quota/keyvQuotaStore";
import type { DimensionKey } from "@/lib/quota/dimensions";

let store: KeyvQuotaStore;

const TOKEN_DIM: DimensionKey = {
  poolId: "test-pool",
  unit: "tokens",
  window: "hourly",
};

const REQUEST_DIM: DimensionKey = {
  poolId: "test-pool",
  unit: "requests",
  window: "hourly",
};

beforeEach(() => {
  store = new KeyvQuotaStore(); // in-memory
});

afterEach(async () => {
  await store.dispose();
});

describe("E2E: KeyvQuotaStore — consume & peek", () => {
  it("consume returns the cumulative total for the key", async () => {
    const KEY = "key-a";
    const first = await store.consume(KEY, TOKEN_DIM, 100);
    expect(first).toBe(100);

    const second = await store.consume(KEY, TOKEN_DIM, 250);
    expect(second).toBe(350);
  });

  it("peek returns the current consumed value without incrementing", async () => {
    const KEY = "key-b";
    await store.consume(KEY, TOKEN_DIM, 50);

    const before = await store.peek(KEY, TOKEN_DIM);
    expect(before).toBe(50);

    // Peek again should be idempotent
    const after = await store.peek(KEY, TOKEN_DIM);
    expect(after).toBe(50);
  });

  it("peek returns 0 for a key that has never been consumed", async () => {
    const val = await store.peek("nonexistent", TOKEN_DIM);
    expect(val).toBe(0);
  });
});

describe("E2E: KeyvQuotaStore — clear", () => {
  it("clear resets the bucket to zero", async () => {
    const KEY = "key-c";
    await store.consume(KEY, TOKEN_DIM, 1000);
    expect(await store.peek(KEY, TOKEN_DIM)).toBe(1000);

    await store.clear(KEY, TOKEN_DIM);
    expect(await store.peek(KEY, TOKEN_DIM)).toBe(0);
  });

  it("clear only affects the specified dimension", async () => {
    const KEY = "key-d";
    await store.consume(KEY, TOKEN_DIM, 500);
    await store.consume(KEY, REQUEST_DIM, 10);

    await store.clear(KEY, TOKEN_DIM);

    expect(await store.peek(KEY, TOKEN_DIM)).toBe(0);
    expect(await store.peek(KEY, REQUEST_DIM)).toBe(10);
  });
});

describe("E2E: KeyvQuotaStore — pool totals", () => {
  it("poolConsumedTotal sums across all keys in the same pool", async () => {
    const keyA = "pool-key-a";
    const keyB = "pool-key-b";

    await store.consume(keyA, TOKEN_DIM, 200);
    await store.consume(keyB, TOKEN_DIM, 350);

    const total = await store.poolConsumedTotal("test-pool", TOKEN_DIM);
    expect(total).toBe(550);
  });

  it("poolConsumedTotal is independent of per-key clear", async () => {
    const keyA = "pool-clear-a";
    const keyB = "pool-clear-b";

    await store.consume(keyA, TOKEN_DIM, 100);
    await store.consume(keyB, TOKEN_DIM, 200);

    // Clear keyA's per-key bucket — pool total should remain
    await store.clear(keyA, TOKEN_DIM);

    // Note: pool bucket is separate from per-key bucket, so total stays
    const total = await poolTotalNoCache("test-pool", TOKEN_DIM);
    expect(total).toBe(300);
  });

  it("poolUsageWithDimensions returns a structured snapshot", async () => {
    await store.consume("snap-key", TOKEN_DIM, 500);

    const snapshot = await store.poolUsageWithDimensions("test-pool", [
      { unit: "tokens", window: "hourly", limit: 10000 },
    ]);

    expect(snapshot.poolId).toBe("test-pool");
    expect(snapshot.dimensions).toHaveLength(1);
    expect(snapshot.dimensions[0].unit).toBe("tokens");
    expect(snapshot.dimensions[0].window).toBe("hourly");
    expect(snapshot.dimensions[0].limit).toBe(10000);
    expect(snapshot.dimensions[0].consumedTotal).toBe(500);
    expect(typeof snapshot.generatedAt).toBe("string");
  });
});

// Helper: read pool total without the in-memory cache influencing the result.
// The store caches buckets in-memory, so we use poolConsumedTotal directly
// (it hits the same Keyv backend).
async function poolTotalNoCache(
  poolId: string,
  dim: DimensionKey,
): Promise<number> {
  return store.poolConsumedTotal(poolId, dim);
}
