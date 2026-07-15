/**
 * keyvQuotaStore.ts — Keyv-backed QuotaStore implementation.
 *
 * Counter keys follow the same pattern as the Redis driver:
 *   omniroute:quota:<apiKeyId>:<dimensionKey>:<bucketIndex>
 *
 * Sliding-window math is identical (effective = prev × (1 − elapsed/window) + curr).
 *
 * Pool/allocation metadata (listAllocationsForApiKey, getPool) still lives in
 * SQLite (F2) — only the rolling counters are stored in the KV store.
 *
 * Why keyv? It lets OmniRoute drop the Redis sidecar from docker-compose
 * while preserving the same wire semantics. Operators who need cross-process
 * counters can still point at Redis via the `redis` driver.
 *
 * Part of: Group B — Quota Sharing Engine (plan 22, frente F6).
 */

import {
  getPool,
  listAllocationsForApiKey,
} from "@/lib/localDb";
import { WINDOW_MS, dimensionKeyToString } from "./dimensions";
import type { DimensionKey } from "./dimensions";
import type { QuotaStore, PoolUsageSnapshot } from "./types";
import { computeBurnRateFromWindow } from "./burnRate";
import {
  createKvLike,
  type KvLike,
} from "@/shared/utils/keyvKvStore";

// ---------------------------------------------------------------------------
// Key helpers (must match RedisQuotaStore byte-for-byte)
// ---------------------------------------------------------------------------

const KEY_PREFIX = "omniroute:quota";

function bucketKey(apiKeyId: string, dimensionKey: string, bucketIndex: number): string {
  return `${KEY_PREFIX}:${apiKeyId}:${dimensionKey}:${bucketIndex}`;
}

function ttlSeconds(windowMs: number): number {
  // Keep both current + previous bucket alive → 2 × window
  return Math.ceil((2 * windowMs) / 1000);
}

// ---------------------------------------------------------------------------
// Sliding window helpers (mirror RedisQuotaStore exactly)
// ---------------------------------------------------------------------------

function slidingWindowEffective(
  curr: number,
  prev: number,
  nowMs: number,
  windowMs: number
): number {
  const currentBucketIndex = Math.floor(nowMs / windowMs);
  const currentBucketStartMs = currentBucketIndex * windowMs;
  const elapsed = nowMs - currentBucketStartMs;
  const weight = 1 - elapsed / windowMs;
  return prev * weight + curr;
}

// ---------------------------------------------------------------------------
// KeyvQuotaStore
// ---------------------------------------------------------------------------

export class KeyvQuotaStore implements QuotaStore {
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  private async client(): Promise<KvLike> {
    return createKvLike(this.url);
  }

  /**
   * Increment consumption by `cost` using a keyv-backed INCRBYFLOAT
   * analogue and refresh TTL. Returns the new sliding-window effective value.
   */
  async consume(apiKeyId: string, dim: DimensionKey, cost: number): Promise<number> {
    const nowMs = Date.now();
    const dimKey = dimensionKeyToString(dim);
    const windowMs = WINDOW_MS[dim.window];
    const currentBucket = Math.floor(nowMs / windowMs);

    const client = await this.client();
    const currKey = bucketKey(apiKeyId, dimKey, currentBucket);
    const prevKey = bucketKey(apiKeyId, dimKey, currentBucket - 1);
    const ttl = ttlSeconds(windowMs);

    // Atomic increment + refresh TTL — KvLike mirrors the ioredis surface.
    const newCurrStr = await client.incrbyfloat(currKey, cost);
    await client.expire(currKey, ttl);
    // Also ensure prev key TTL is refreshed so it doesn't disappear prematurely
    await client.expire(prevKey, ttl);

    const newCurr = parseFloat(newCurrStr) || 0;

    // Read prev to compute sliding window
    const [prevStr] = await client.mget(prevKey);
    const prev = parseFloat(prevStr ?? "0") || 0;

    return slidingWindowEffective(newCurr, prev, nowMs, windowMs);
  }

  /**
   * Read the sliding-window effective value without modification.
   */
  async peek(apiKeyId: string, dim: DimensionKey): Promise<number> {
    const nowMs = Date.now();
    const dimKey = dimensionKeyToString(dim);
    const windowMs = WINDOW_MS[dim.window];
    const currentBucket = Math.floor(nowMs / windowMs);

    const client = await this.client();
    const currKey = bucketKey(apiKeyId, dimKey, currentBucket);
    const prevKey = bucketKey(apiKeyId, dimKey, currentBucket - 1);

    const [currStr, prevStr] = await client.mget(currKey, prevKey);
    const curr = parseFloat(currStr ?? "0") || 0;
    const prev = parseFloat(prevStr ?? "0") || 0;

    return slidingWindowEffective(curr, prev, nowMs, windowMs);
  }

  /**
   * Return the real pool-wide consumption for a dimension in the current
   * sliding window, summed across ALL apiKeyIds in the pool's allocations.
   *
   * Strategy mirrors RedisQuotaStore.poolConsumedTotal — pool/allocation
   * metadata lives in SQLite (F2), KV stores the rolling counters, and a
   * single MGET fetches all per-key buckets before sliding-window math.
   */
  async poolConsumedTotal(poolId: string, dim: DimensionKey): Promise<number> {
    const pool = getPool(poolId);
    if (!pool || pool.allocations.length === 0) return 0;

    const nowMs = Date.now();
    const dimKey = dimensionKeyToString(dim);
    const windowMs = WINDOW_MS[dim.window];
    const currentBucket = Math.floor(nowMs / windowMs);
    const prevBucket = currentBucket - 1;

    const client = await this.client();

    // Build [currKey0, prevKey0, currKey1, prevKey1, ...] for all allocated keys
    const keys: string[] = [];
    for (const alloc of pool.allocations) {
      keys.push(bucketKey(alloc.apiKeyId, dimKey, currentBucket));
      keys.push(bucketKey(alloc.apiKeyId, dimKey, prevBucket));
    }

    const values = await client.mget(...keys);

    let currTotal = 0;
    let prevTotal = 0;
    for (let i = 0; i < values.length; i += 2) {
      currTotal += parseFloat(values[i] ?? "0") || 0;
      prevTotal += parseFloat(values[i + 1] ?? "0") || 0;
    }

    return slidingWindowEffective(currTotal, prevTotal, nowMs, windowMs);
  }

  /**
   * Aggregate pool usage. Pool and allocation metadata come from SQLite (F2);
   * rolling counters come from the KV store.
   */
  async poolUsage(poolId: string): Promise<PoolUsageSnapshot> {
    const nowMs = Date.now();
    const pool = getPool(poolId);

    if (!pool) {
      return {
        poolId,
        generatedAt: new Date(nowMs).toISOString(),
        dimensions: [],
      };
    }

    // Pool dimensions are not directly available here — return empty for now.
    return {
      poolId,
      generatedAt: new Date(nowMs).toISOString(),
      dimensions: [],
    };
  }

  /**
   * Build a PoolUsageSnapshot with explicit plan dimensions.
   * Mirrors RedisQuotaStore.poolUsageWithDimensions() and
   * SqliteQuotaStore.poolUsageWithDimensions() exactly.
   */
  async poolUsageWithDimensions(
    poolId: string,
    planDimensions: Array<{ unit: string; window: string; limit: number }>
  ): Promise<PoolUsageSnapshot> {
    const nowMs = Date.now();
    const pool = getPool(poolId);

    if (!pool) {
      return {
        poolId,
        generatedAt: new Date(nowMs).toISOString(),
        dimensions: [],
      };
    }

    const { allocations } = pool;
    const totalWeight = allocations.reduce((sum, a) => sum + a.weight, 0);
    const dimensionSnapshots: PoolUsageSnapshot["dimensions"] = [];

    for (const planDim of planDimensions) {
      const windowMs = WINDOW_MS[planDim.window as keyof typeof WINDOW_MS];
      if (!windowMs) continue;

      let consumedTotal = 0;
      const perKey: PoolUsageSnapshot["dimensions"][number]["perKey"] = [];

      for (const alloc of allocations) {
        const dim: DimensionKey = {
          poolId,
          unit: planDim.unit as DimensionKey["unit"],
          window: planDim.window as DimensionKey["window"],
        };
        const consumed = await this.peek(alloc.apiKeyId, dim);
        consumedTotal += consumed;

        const effectiveWeight = totalWeight > 0 ? alloc.weight : 0;
        const fairShare = (effectiveWeight / 100) * planDim.limit;
        const deficit = consumed - fairShare;
        const borrowing = consumed > fairShare;

        perKey.push({
          apiKeyId: alloc.apiKeyId,
          consumed,
          fairShare,
          deficit,
          borrowing,
        });
      }

      dimensionSnapshots.push({
        unit: planDim.unit as PoolUsageSnapshot["dimensions"][number]["unit"],
        window: planDim.window as PoolUsageSnapshot["dimensions"][number]["window"],
        limit: planDim.limit,
        consumedTotal,
        perKey,
      });
    }

    const tokenDim = dimensionSnapshots.find((d) => d.unit === "tokens");
    let burnRate: PoolUsageSnapshot["burnRate"];
    if (tokenDim && tokenDim.consumedTotal > 0) {
      const windowMs = WINDOW_MS[tokenDim.window as keyof typeof WINDOW_MS];
      const remaining = tokenDim.limit - tokenDim.consumedTotal;
      const rateResult = computeBurnRateFromWindow(tokenDim.consumedTotal, windowMs, remaining);
      burnRate = {
        tokensPerSecond: rateResult.tokensPerSecond,
        timeToExhaustionMs: rateResult.timeToExhaustionMs,
      };
    }

    return {
      poolId,
      generatedAt: new Date(nowMs).toISOString(),
      dimensions: dimensionSnapshots,
      burnRate,
    };
  }

  /**
   * Clear both current and previous bucket counters. Test-only.
   */
  async clear(apiKeyId: string, dim: DimensionKey): Promise<void> {
    const nowMs = Date.now();
    const dimKey = dimensionKeyToString(dim);
    const windowMs = WINDOW_MS[dim.window];
    const currentBucket = Math.floor(nowMs / windowMs);

    const client = await this.client();
    const currKey = bucketKey(apiKeyId, dimKey, currentBucket);
    const prevKey = bucketKey(apiKeyId, dimKey, currentBucket - 1);

    await client.del(currKey, prevKey);
  }

  /**
   * Close the underlying keyv connection (test-only / shutdown hook).
   * Mirrors the optional quit() path that RedisQuotaStore callers may use.
   */
  async quit(): Promise<void> {
    const client = await this.client();
    await client.quit();
  }
}

// Singleton per URL
let _storeInstance: KeyvQuotaStore | null = null;
let _storeUrl: string | null = null;

export function getKeyvQuotaStore(url: string): KeyvQuotaStore {
  if (!_storeInstance || _storeUrl !== url) {
    _storeInstance = new KeyvQuotaStore(url);
    _storeUrl = url;
  }
  return _storeInstance;
}

export function resetKeyvQuotaStore(): void {
  _storeInstance = null;
  _storeUrl = null;
}

// Silence "unused import" when bundlers tree-shake — kept for tests that
// import via the module surface.
void listAllocationsForApiKey;