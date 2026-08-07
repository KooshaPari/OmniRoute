/**
 * KeyvQuotaStoreExtras — extension class for KeyvQuotaStore.
 *
 * Carries the 5 dead-code methods preserved for future use:
 *   - `recordPlanUsage` — accumulates per-(connectionId, provider) usage
 *   - `upsertProviderPlan` — writes a `ProviderPlan` to the Keyv store
 *   - `listProviderPlans` — returns all stored plans (currently empty)
 *   - `setPools` — writes a list of `QuotaPool` to the Keyv store
 *   - `getPool` — reads a `QuotaPool` from the Keyv store (Keyv-backed;
 *     note that the canonical pool source for the QuotaStore interface
 *     contract is `@/lib/localDb` — this Keyv-backed getPool is preserved
 *     for the dead-code path only)
 *
 * These methods are NOT part of the `QuotaStore` interface contract and were
 * relocated from `keyvQuotaStore.ts` so the interface impl stays clean.
 * They have zero callers in the current codebase (`src/` + `tests/`) per
 * the 2026-08-05 audit, but are preserved for the future Keyv-backed
 * plan/pool storage direction (cf. FORGE_WRAPUP.md Tier-5 task 20).
 *
 * Part of: Group B — Quota Sharing Engine (plan 22, frente F6).
 */
import type { Keyv } from "keyv";
import type { ProviderPlan, QuotaPool, QuotaUnit, QuotaWindow } from "./dimensions";
import type { KeyvQuotaStore } from "./keyvQuotaStore";
import { getKeyvQuotaStore } from "./keyvQuotaStore";
import type { PlanPoolUsage } from "./types";

function planKey(connectionId: string, provider: string): string {
  return `plan:${connectionId}:${provider}`;
}

function poolKey(poolId: string): string {
  return `pool:${poolId}`;
}

export class KeyvQuotaStoreExtras {
  constructor(private readonly store: KeyvQuotaStore) {}

  private get kv(): Keyv {
    return this.store.getKeyv();
  }

  async recordPlanUsage(
    connectionId: string,
    provider: string,
    poolId: string,
    _dimensions: Array<{ unit: QuotaUnit; window: QuotaWindow }>,
    consumed: number,
  ): Promise<PlanPoolUsage> {
    const k = planKey(connectionId, provider);
    const ttlMs = 7 * 24 * 60 * 60 * 1000;
    const existing = ((await this.kv.get<PlanPoolUsage>(k)) ?? {}) as PlanPoolUsage;
    const rollup: PlanPoolUsage = {
      ...existing,
      totalConsumed: (existing.totalConsumed ?? 0) + consumed,
      lastUpdatedAt: Date.now(),
      poolId,
      connectionId,
      provider,
    };
    await this.kv.set(k, rollup, ttlMs);
    return rollup;
  }

  async upsertProviderPlan(plan: ProviderPlan): Promise<void> {
    const k = planKey(plan.connectionId ?? "", plan.provider);
    await this.kv.set(k, plan);
  }

  async listProviderPlans(): Promise<ProviderPlan[]> {
    return [];
  }

  async setPools(pools: QuotaPool[]): Promise<void> {
    for (const pool of pools) await this.kv.set(poolKey(pool.id), pool);
  }

  async getPool(poolId: string): Promise<QuotaPool | undefined> {
    return await this.kv.get<QuotaPool>(poolKey(poolId));
  }
}

let _extrasInstance: KeyvQuotaStoreExtras | null = null;

export function getKeyvQuotaStoreExtras(): KeyvQuotaStoreExtras {
  if (!_extrasInstance) _extrasInstance = new KeyvQuotaStoreExtras(getKeyvQuotaStore());
  return _extrasInstance;
}

export function __resetKeyvQuotaStoreExtrasForTests(): void {
  _extrasInstance = null;
}
