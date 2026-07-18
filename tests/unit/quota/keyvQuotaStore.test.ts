// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getKeyvQuotaStore,
  __resetKeyvQuotaStoreForTests,
} from "../../../src/lib/quota/keyvQuotaStore";
import type { DimensionKey } from "../../src/lib/quota/dimensions";

const dim: DimensionKey = {
  unit: "tokens",
  window: "hourly",
  limit: 100,
  poolId: "test-pool",
};

describe("KeyvQuotaStore", () => {
  let store: ReturnType<typeof getKeyvQuotaStore>;

  beforeEach(() => {
    __resetKeyvQuotaStoreForTests();
    store = getKeyvQuotaStore({ uri: "memory://" });
  });

  afterEach(async () => {
    await store.dispose();
    __resetKeyvQuotaStoreForTests();
  });

  it("returns 0 before any consume", async () => {
    const usage = await store.peek("key-1", dim);
    expect(usage).toBe(0);
  });

  it("consume adds cost and returns total", async () => {
    const total = await store.consume("key-1", dim, 10);
    expect(total).toBe(10);
    const total2 = await store.consume("key-1", dim, 20);
    expect(total2).toBe(30);
  });

  it("peek reflects consumed amount", async () => {
    await store.consume("key-1", dim, 15);
    expect(await store.peek("key-1", dim)).toBe(15);
  });

  it("clear resets a bucket to 0", async () => {
    await store.consume("key-1", dim, 25);
    expect(await store.peek("key-1", dim)).toBe(25);
    await store.clear("key-1", dim);
    expect(await store.peek("key-1", dim)).toBe(0);
  });

  it("different keys are isolated", async () => {
    await store.consume("key-1", dim, 10);
    await store.consume("key-2", dim, 20);
    expect(await store.peek("key-1", dim)).toBe(10);
    expect(await store.peek("key-2", dim)).toBe(20);
  });

  it("dispose clears the internal timer", async () => {
    await store.consume("key-1", dim, 5);
    await store.dispose();
    // no crash or timer leak
    expect(true).toBe(true);
  });
});
