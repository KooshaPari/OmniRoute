/**
 * E2E: KeyvQuotaStore
 *
 * Exercises the in-memory KeyvQuotaStore: consume tokens, peek remaining,
 * clear a bucket, and verify pool totals across multiple API keys.
 *
 * Pool usage tests (poolUsageWithDimensions) require a DB-backed pool
 * because the rewrite (2026-08-05, `quota-keystore-type-drift` spec) now
 * resolves `getPool(poolId)` from `@/lib/localDb` to match
 * `SqliteQuotaStore` semantics. The pool fixture is created in
 * `beforeEach` via `createPool` and the generated id is captured for use
 * in the test cases.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolate DATA_DIR for this test process (mirrors `tests/_setup/isolateDataDir.ts`,
// loaded via `--import` for node:test invocations but vitest doesn't auto-load it).
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-keyv-e2e-"));
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.DISABLE_SQLITE_AUTO_BACKUP = "true";

import { KeyvQuotaStore } from "@/lib/quota/keyvQuotaStore";
import type { DimensionKey } from "@/lib/quota/dimensions";
import { getDbInstance } from "@/lib/db/core";
import { createPool } from "@/lib/db/quotaPools";

let store: KeyvQuotaStore;
let testPoolId: string;

function makeDim(unit: DimensionKey["unit"], window: DimensionKey["window"]): DimensionKey {
  return { poolId: testPoolId, unit, window };
}

beforeEach(() => {
  // Initialize DB (applies migrations) and create the test pool fixture.
  // `getDbInstance()` is the singleton; calling it ensures migrations run.
  getDbInstance();
  const pool = createPool({
    connectionId: "test-conn",
    name: "Test Pool",
    allocations: [
      { apiKeyId: "snap-key", weight: 100, policy: "hard" },
    ],
  });
  testPoolId = pool.id;
  store = new KeyvQuotaStore(); // in-memory
});

afterEach(async () => {
  await store.dispose();
  // Best-effort cleanup of the temp DATA_DIR.
  try {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe("E2E: KeyvQuotaStore — consume & peek", () => {
  it("consume returns the cumulative total for the key", async () => {
    const KEY = "key-a";
    const dim = makeDim("tokens", "hourly");
    const first = await store.consume(KEY, dim, 100);
    expect(first).toBe(100);

    const second = await store.consume(KEY, dim, 250);
    expect(second).toBe(350);
  });

  it("peek returns the current consumed value without incrementing", async () => {
    const KEY = "key-b";
    const dim = makeDim("tokens", "hourly");
    await store.consume(KEY, dim, 50);

    const before = await store.peek(KEY, dim);
    expect(before).toBe(50);

    // Peek again should be idempotent
    const after = await store.peek(KEY, dim);
    expect(after).toBe(50);
  });

  it("peek returns 0 for a key that has never been consumed", async () => {
    const dim = makeDim("tokens", "hourly");
    const val = await store.peek("nonexistent", dim);
    expect(val).toBe(0);
  });
});

describe("E2E: KeyvQuotaStore — clear", () => {
  it("clear resets the bucket to zero", async () => {
    const KEY = "key-c";
    const dim = makeDim("tokens", "hourly");
    await store.consume(KEY, dim, 1000);
    expect(await store.peek(KEY, dim)).toBe(1000);

    await store.clear(KEY, dim);
    expect(await store.peek(KEY, dim)).toBe(0);
  });

  it("clear only affects the specified dimension", async () => {
    const KEY = "key-d";
    const tokenDim = makeDim("tokens", "hourly");
    const requestDim = makeDim("requests", "hourly");
    await store.consume(KEY, tokenDim, 500);
    await store.consume(KEY, requestDim, 10);

    await store.clear(KEY, tokenDim);

    expect(await store.peek(KEY, tokenDim)).toBe(0);
    expect(await store.peek(KEY, requestDim)).toBe(10);
  });
});

describe("E2E: KeyvQuotaStore — pool totals", () => {
  it("poolConsumedTotal sums across all keys in the same pool", async () => {
    const dim = makeDim("tokens", "hourly");
    const keyA = "pool-key-a";
    const keyB = "pool-key-b";

    await store.consume(keyA, dim, 200);
    await store.consume(keyB, dim, 350);

    const total = await store.poolConsumedTotal(testPoolId, dim);
    expect(total).toBe(550);
  });

  it("poolConsumedTotal is independent of per-key clear", async () => {
    const dim = makeDim("tokens", "hourly");
    const keyA = "pool-clear-a";
    const keyB = "pool-clear-b";

    await store.consume(keyA, dim, 100);
    await store.consume(keyB, dim, 200);

    // Clear keyA's per-key bucket — pool total should remain
    await store.clear(keyA, dim);

    // Note: pool bucket is separate from per-key bucket, so total stays
    const total = await poolTotalNoCache(testPoolId, dim);
    expect(total).toBe(300);
  });

  it("poolUsageWithDimensions returns a structured snapshot", async () => {
    const dim = makeDim("tokens", "hourly");
    await store.consume("snap-key", dim, 500);

    const snapshot = await store.poolUsageWithDimensions(testPoolId, [
      { unit: "tokens", window: "hourly", limit: 10000 },
    ]);

    expect(snapshot.poolId).toBe(testPoolId);
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
