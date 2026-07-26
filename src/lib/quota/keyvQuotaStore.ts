/**
 * KeyvQuotaStore — fully-embedded alternative to SqliteQuotaStore.
 *
 * Uses Keyv as the storage backend. Default backing is an in-memory Map;
 * pass a URI string (e.g. `keyv://sqlite:/tmp/quota.db`) for persistence.
 * Implements the `QuotaStore` interface from `./types`.
 */
import { Keyv } from "keyv";
import KeyvSqlite from "@keyv/sqlite";
import type { DimensionKey, QuotaDimension } from "./dimensions";
import { dimensionKeyToString, WINDOW_MS } from "./dimensions";
import type { QuotaStore, PoolUsageSnapshot, ConsumeResult } from "./types";

export interface KeyvQuotaStoreOptions {
  uri?: string;
  namespace?: string;
}

function dimKey(apiKeyId: string, dim: DimensionKey): string {
  return `${apiKeyId}:${dimensionKeyToString(dim)}`;
}
function poolKey(poolId: string, dim: DimensionKey): string {
  return `pool:${poolId}:${dimensionKeyToString(dim)}`;
}

interface BucketState {
  value: number;
  expiresAt: number;
}

export class KeyvQuotaStore implements QuotaStore {
  private readonly kv: Keyv;
  private readonly buckets = new Map<string, BucketState>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: KeyvQuotaStoreOptions = {}) {
    const uri = options.uri ?? "memory://";
    if (uri !== "memory://") {
      // @keyv/sqlite v3 uses the options form; passing a URI string silently
      // falls back to its in-memory default and loses persistence.
      const store = new KeyvSqlite({ uri });
      this.kv = new Keyv({ store, namespace: options.namespace ?? "quota" });
    } else {
      this.kv = new Keyv({ store: undefined, namespace: options.namespace ?? "quota" });
    }

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [k, b] of this.buckets) {
        if (b.expiresAt <= now) this.buckets.delete(k);
      }
    }, 30_000);
    if (typeof this.cleanupTimer.unref === "function") this.cleanupTimer.unref();
  }

  private async getBucket(key: string, ttlMs: number): Promise<BucketState> {
    const now = Date.now();
    const cached = this.buckets.get(key);
    if (cached && cached.expiresAt > now) return cached;
    const fromKv = ((await this.kv.get<number>(key)) as number) ?? 0;
    const state: BucketState = { value: fromKv, expiresAt: now + ttlMs };
    this.buckets.set(key, state);
    return state;
  }

  async consume(apiKeyId: string, dim: DimensionKey, cost: number): Promise<number> {
    const ttlMs = WINDOW_MS[dim.window] ?? 3600_000;
    const k = dimKey(apiKeyId, dim);
    const state = await this.getBucket(k, ttlMs);
    const next = state.value + cost;
    state.value = next;
    state.expiresAt = Date.now() + ttlMs;
    await this.kv.set(k, next, ttlMs);

    // Mirror to pool bucket for aggregate queries
    const pk = poolKey(dim.poolId, dim);
    const pState = await this.getBucket(pk, ttlMs);
    const pNext = pState.value + cost;
    pState.value = pNext;
    pState.expiresAt = Date.now() + ttlMs;
    await this.kv.set(pk, pNext, ttlMs);

    return next;
  }

  async peek(apiKeyId: string, dim: DimensionKey): Promise<number> {
    const ttlMs = WINDOW_MS[dim.window] ?? 3600_000;
    const state = await this.getBucket(dimKey(apiKeyId, dim), ttlMs);
    return state.value;
  }

  async clear(apiKeyId: string, dim: DimensionKey): Promise<void> {
    const k = dimKey(apiKeyId, dim);
    this.buckets.delete(k);
    await this.kv.delete(k);
  }

  async poolConsumedTotal(poolId: string, dim: DimensionKey): Promise<number> {
    const ttlMs = WINDOW_MS[dim.window] ?? 3600_000;
    const state = await this.getBucket(poolKey(poolId, dim), ttlMs);
    return state.value;
  }

  async poolUsage(poolId: string): Promise<PoolUsageSnapshot> {
    const dims: QuotaDimension[] = [
      { unit: "tokens", window: "hourly", limit: 0 },
      { unit: "requests", window: "hourly", limit: 0 },
      { unit: "usd", window: "daily", limit: 0 },
    ];
    return this.poolUsageWithDimensions(
      poolId,
      dims.map((d) => ({ unit: d.unit, window: d.window, limit: d.limit })),
    );
  }

  async poolUsageWithDimensions(
    poolId: string,
    planDimensions: Array<{ unit: string; window: string; limit: number }>,
  ): Promise<PoolUsageSnapshot> {
    const dimensionEntries: PoolUsageSnapshot["dimensions"] = [];

    for (const pd of planDimensions) {
      const dim: DimensionKey = {
        poolId,
        unit: pd.unit as QuotaDimension["unit"],
        window: pd.window as QuotaDimension["window"],
      };
      const consumedTotal = await this.poolConsumedTotal(poolId, dim);
      dimensionEntries.push({
        unit: pd.unit as QuotaDimension["unit"],
        window: pd.window as QuotaDimension["window"],
        limit: pd.limit,
        consumedTotal,
        perKey: [],
      });
    }

    return {
      poolId,
      generatedAt: new Date().toISOString(),
      dimensions: dimensionEntries,
    };
  }

  async dispose(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

let defaultStore: KeyvQuotaStore | null = null;

export function getKeyvQuotaStore(
  uriOrOpts?: string | KeyvQuotaStoreOptions,
): KeyvQuotaStore {
  if (!defaultStore) {
    const opts =
      typeof uriOrOpts === "string" ? { uri: uriOrOpts } : (uriOrOpts ?? {});
    defaultStore = new KeyvQuotaStore(opts);
  }
  return defaultStore;
}

export function __resetKeyvQuotaStoreForTests(): void {
  defaultStore = null;
}
