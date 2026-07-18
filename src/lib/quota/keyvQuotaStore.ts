import { Keyv } from "keyv";
import KeyvSqlite from "@keyv/sqlite";
import type { DimensionKey, QuotaUnit, QuotaWindow } from "./dimensions";
import type { QuotaDimension } from "./dimensions";
import { dimensionKeyToString, WINDOW_MS } from "./dimensions";
import type { PoolUsageSnapshot, ConsumeResult, QuotaStore } from "./types";

/**
 * KeyvQuotaStore — fully-embedded quota storage backed by keyv.
 *
 * Replaces the Redis-side `RedisQuotaStore` with a keyv-fronted store
 * that defaults to an in-memory Map. Pass a URI for persistent use:
 *   - `sqlite://./quota.db` for single-process embedded
 *   - `redis://host:port` for multi-process (requires ioredis adapter)
 *
 * Implements the `QuotaStore` interface from `./types` so it drops
 * into `storeFactory.ts` as a third option alongside `sqlite` and `redis`.
 */
export class KeyvQuotaStore implements QuotaStore {
  private readonly kv: Keyv;

  constructor(options?: { uri?: string; namespace?: string }) {
    const uri = options?.uri;
    const ns = options?.namespace;
    if (uri && (uri.startsWith("sqlite:") || uri.startsWith("keyv-sqlite:"))) {
      const stripped = uri.replace(/^sqlite:\/\/|^sqlite:|^keyv-sqlite:/, "");
      const store = new KeyvSqlite(stripped);
      this.kv = ns ? new Keyv({ store, namespace: ns }) : new Keyv({ store });
    } else if (uri) {
      this.kv = ns ? new Keyv(uri, { namespace: ns }) : new Keyv(uri);
    } else {
      this.kv = ns ? new Keyv({ namespace: ns }) : new Keyv();
    }
  }

  /** Flat key for the per-(apiKeyId, dimension) bucket counter. */
  private bucketKey(apiKeyId: string, dim: DimensionKey): string {
    return `bucket:${apiKeyId}:${dim.poolId}:${dim.unit}:${dim.window}`;
  }

  /** Flat key for the pool-level aggregate counter. */
  private poolKey(poolId: string, dim: DimensionKey): string {
    return `pool:${poolId}:${dim.unit}:${dim.window}`;
  }

  async consume(apiKeyId: string, dim: DimensionKey, cost: number): Promise<number> {
    const k = this.bucketKey(apiKeyId, dim);
    const prev = Number((await this.kv.get(k)) ?? 0);
    const next = prev + cost;
    await this.kv.set(k, next);
    // Mirror to pool bucket for `poolConsumedTotal`.
    const pk = this.poolKey(dim.poolId, dim);
    const pPrev = Number((await this.kv.get(pk)) ?? 0);
    await this.kv.set(pk, pPrev + cost);
    return next;
  }

  async peek(apiKeyId: string, dim: DimensionKey): Promise<number> {
    const k = this.bucketKey(apiKeyId, dim);
    return Number((await this.kv.get(k)) ?? 0);
  }

  async clear(apiKeyId: string, dim: DimensionKey): Promise<void> {
    const k = this.bucketKey(apiKeyId, dim);
    await this.kv.delete(k);
  }

  async poolConsumedTotal(poolId: string, dim: DimensionKey): Promise<number> {
    const pk = this.poolKey(poolId, dim);
    return Number((await this.kv.get(pk)) ?? 0);
  }

  async poolUsage(poolId: string): Promise<PoolUsageSnapshot> {
    const totals: Record<string, number> = {};
    const prefix = `pool:${poolId}:`;
    const iter = (this.kv as Keyv & { iterator?: (opts?: unknown) => AsyncIterableIterator<[string, unknown]> }).iterator;
    if (typeof iter === "function") {
      for await (const [k, v] of iter.call(this.kv)) {
        if (typeof k === "string" && k.startsWith(prefix)) {
          const dimPart = k.slice(prefix.length);
          totals[dimPart] = Number(v) || 0;
        }
      }
    }
    return { poolId, consumed: totals };
  }

  async poolUsageWithDimensions(
    poolId: string,
    planDimensions: Array<{ unit: string; window: string; limit: number }>,
  ): Promise<PoolUsageSnapshot> {
    const consumed: Record<string, number> = {};
    for (const planDim of planDimensions) {
      const dim: DimensionKey = { poolId, unit: planDim.unit, window: planDim.window };
      consumed[`${planDim.unit}:${planDim.window}`] = await this.poolConsumedTotal(poolId, dim);
    }
    const limits: Record<string, number> = {};
    for (const planDim of planDimensions) {
      limits[`${planDim.unit}:${planDim.window}`] = planDim.limit;
    }
    return { poolId, consumed, limits };
  }
}

let defaultStore: KeyvQuotaStore | null = null;

export function getKeyvQuotaStore(): KeyvQuotaStore {
  if (!defaultStore) defaultStore = new KeyvQuotaStore();
  return defaultStore;
}

export function __resetKeyvQuotaStoreForTests(): void {
  defaultStore = null;
}
