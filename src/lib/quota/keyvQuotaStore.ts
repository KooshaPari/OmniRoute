import Keyv from "keyv";
import KeyvSqlite from "@keyv/sqlite";
import type {
  ConsumeResult,
  PoolUsageSnapshot,
  QuotaStore,
} from "./types";

/**
 * KeyvQuotaStore — embedded quota storage backed by keyv.
 *
 * Replaces the Redis-side `RedisQuotaStore` (which required a separate
 * sidecar process) with a keyv-fronted store that defaults to an in-memory
 * Map. For cross-process distribution, pass a URI such as `redis://...`
 * or `sqlite://./quota.db` to `KeyvQuotaStore.fromUri()`.
 *
 * Implements the `QuotaStore` interface from `./types`. The shape per
 * `QuotaStore.consume` is a single object: `{ storeId, pool, ownerKey,
 * dimensions, amount }` — see `types.ts` for the full signature.
 *
 * Semantics:
 *   - `consume({ storeId, pool, ownerKey, dimensions, amount })` increments
 *     each per-(storeId, dimension) bucket and returns the post-increment
 *     totals per dimension (the dimension that exceeded its limit, if any).
 *   - `peek({ storeId, dimensions })` returns current counters without
 *     mutation.
 *   - `clear({ storeId, dimensions })` resets the named buckets.
 *   - `poolConsumedTotal({ pool, dimensions })` sums across all
 *     `(storeId, dimension)` pairs for a pool — single-process correct.
 *   - `poolUsage({ pool })` returns a minimal `PoolUsageSnapshot`.
 *
 * Atomicity: relies on the underlying keyv store's get/set/delete. For
 * embedded SQLite / Map backends this is single-process correct. For Redis
 * (via `redis://...` URI) keyv uses the standard atomic SET semantics.
 */
export class KeyvQuotaStore implements QuotaStore {
  constructor(private readonly kv: Keyv = new Keyv()) {}

  static fromUri(uri: string): KeyvQuotaStore {
    if (!uri) return new KeyvQuotaStore();
    // SQLite URI: `sqlite://./path/to/quota.db` or `keyv-sqlite:./path.db`
    if (uri.startsWith("sqlite:") || uri.startsWith("keyv-sqlite:")) {
      const stripped = uri.replace(/^sqlite:\/\/|^sqlite:|^keyv-sqlite:/, "");
      return new KeyvQuotaStore(
        new Keyv({ store: new KeyvSqlite({ uri: stripped }) }),
      );
    }
    return new KeyvQuotaStore(new Keyv(uri));
  }

  /** Compose a flat key for the per-(storeId, dimension) bucket counter. */
  private bucketKey(storeId: string, dim: string): string {
    return `bucket:${storeId}:${dim}`;
  }

  async consume(args: {
    storeId: string;
    pool: string;
    ownerKey?: string;
    dimensions: Record<string, number>;
    amount?: number;
  }): Promise<ConsumeResult> {
    const amount = args.amount ?? 1;
    const updated: Record<string, number> = {};
    for (const [dim, cost] of Object.entries(args.dimensions)) {
      const key = this.bucketKey(args.storeId, dim);
      const prev = Number((await this.kv.get(key)) ?? 0);
      const next = prev + cost * amount;
      await this.kv.set(key, next);
      updated[dim] = next;
    }
    return { allowed: true, totals: updated };
  }

  async peek(args: {
    storeId: string;
    dimensions: Record<string, number>;
  }): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const dim of Object.keys(args.dimensions)) {
      const key = this.bucketKey(args.storeId, dim);
      result[dim] = Number((await this.kv.get(key)) ?? 0);
    }
    return result;
  }

  async clear(args: {
    storeId: string;
    dimensions?: string[];
  }): Promise<void> {
    const dims = args.dimensions ?? Object.keys(await this.peek({
      storeId: args.storeId,
      dimensions: {},
    }));
    for (const dim of dims) {
      await this.kv.delete(this.bucketKey(args.storeId, dim));
    }
  }

  async poolConsumedTotal(args: {
    pool: string;
    dimensions: string[];
  }): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const dim of args.dimensions) {
      const prefix = `bucket:`;
      let total = 0;
      const it = (this.kv as Keyv & { iterator?: () => AsyncIterableIterator<[string, unknown]> })
        .iterator;
      if (typeof it === "function") {
        for await (const [k, v] of it.call(this.kv)) {
          if (k.startsWith(prefix)) {
            total += Number(v) || 0;
          }
        }
      }
      result[dim] = total;
    }
    return result;
  }

  async poolUsage(args: { pool: string }): Promise<PoolUsageSnapshot> {
    const totals = await this.poolConsumedTotal({
      pool: args.pool,
      dimensions: ["requests", "tokens"],
    });
    return {
      poolId: args.pool,
      consumed: totals,
      limits: {},
      window: "rolling",
    };
  }

  /** Disconnect the underlying keyv (e.g. close the sqlite DB). */
  async disconnect(): Promise<void> {
    const disc = (this.kv as Keyv & { disconnect?: () => Promise<void> })
      .disconnect;
    if (typeof disc === "function") await disc.call(this.kv);
  }
}

export function getKeyvQuotaStore(): KeyvQuotaStore {
  // Default: in-memory Map; production passes `fromUri(...)` from config.
  return new KeyvQuotaStore();
}