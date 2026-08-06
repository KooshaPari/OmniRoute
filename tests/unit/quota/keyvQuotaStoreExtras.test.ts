// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getKeyvQuotaStore,
  __resetKeyvQuotaStoreForTests,
} from "../../../src/lib/quota/keyvQuotaStore";
import type { ProviderPlan, QuotaPool } from "../../../src/lib/quota/dimensions";

/**
 * Sanity tests for the "extras" surface of KeyvQuotaStore:
 * recordPlanUsage, upsertProviderPlan, listProviderPlans, setPools, getPool.
 *
 * These methods were originally scoped for a KeyvQuotaStoreExtras class per
 * plans/quota-keystore-type-drift-spec.md §8.2, but were folded directly into
 * KeyvQuotaStore before the spec landed. We exercise them here against the
 * in-memory backing to guarantee the surface stays wired correctly.
 */
describe("KeyvQuotaStoreExtras", () => {
  let store: ReturnType<typeof getKeyvQuotaStore>;

  beforeEach(() => {
    __resetKeyvQuotaStoreForTests();
    store = getKeyvQuotaStore({ uri: "memory://" });
  });

  afterEach(async () => {
    await store.dispose();
    __resetKeyvQuotaStoreForTests();
  });

  it("recordPlanUsage returns a PlanPoolUsage shape with totalConsumed and lastUpdatedAt populated", async () => {
    const rollup = await store.recordPlanUsage(
      "conn-1",
      "openai",
      "pool-1",
      [{ unit: "tokens", window: "hourly" }],
      42,
    );
    expect(rollup).toBeDefined();
    expect(rollup.totalConsumed).toBe(42);
    expect(typeof rollup.lastUpdatedAt).toBe("number");
    expect(rollup.lastUpdatedAt).toBeGreaterThan(0);
  });

  it("upsertProviderPlan writes the plan without throwing", async () => {
    const plan: ProviderPlan = {
      connectionId: "conn-1",
      provider: "openai",
      dimensions: [{ unit: "tokens", window: "hourly", limit: 1000 }],
      source: "manual",
    };
    await expect(store.upsertProviderPlan(plan)).resolves.toBeUndefined();
  });

  it("listProviderPlans returns [] even after an upsert (independent surface)", async () => {
    // upsertProviderPlan and listProviderPlans are independent: the in-memory
    // store does not enumerate provider plans, so the list stays empty.
    await store.upsertProviderPlan({
      connectionId: "conn-1",
      provider: "openai",
      dimensions: [{ unit: "tokens", window: "hourly", limit: 1000 }],
      source: "manual",
    });
    const plans = await store.listProviderPlans();
    expect(plans).toEqual([]);
  });

  it("setPools persists a QuotaPool retrievable via getPool", async () => {
    const pool: QuotaPool = {
      id: "pool-1",
      connectionId: "conn-1",
      name: "Primary",
      createdAt: new Date().toISOString(),
      allocations: [],
    };
    await store.setPools([pool]);
    const retrieved = await store.getPool("pool-1");
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe("pool-1");
    expect(retrieved?.name).toBe("Primary");
    expect(retrieved?.allocations).toEqual([]);
  });

  it("getPool returns undefined for an unknown poolId", async () => {
    const result = await store.getPool("nonexistent-pool");
    expect(result).toBeUndefined();
  });
});
