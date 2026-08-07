/**
 * KeyvQuotaStore — fully-embedded alternative to SqliteQuotaStore.
 *
 * Uses Keyv (https://keyv.js.org) as the storage backend. Default backing
 * is an in-memory Map; pass a URI string (e.g. `keyv://sqlite:/tmp/quota.db`
 * or `redis://...`) at construction time for cross-process / persistent use.
 *
 * Implements the `QuotaStore` interface from `./types` so it can be dropped
 * into `storeFactory.ts` as a third option alongside `sqlite` and `redis`.
 *
 * Sliding-window semantics mirror `SqliteQuotaStore`:
 *   - In-memory `buckets` Map tracks `(apiKeyId, dimKey)` totals with TTL
 *   - Keyv persists the same values (cross-process durability when a
 *     `keyv://` URI is provided; in-memory Map is the default).
 *   - `poolUsage` returns an empty-shell snapshot (no plan metadata here).
 *   - `poolUsageWithDimensions` builds a full `PoolUsageSnapshot` from the
 *     DB-resident `QuotaPool` allocations + per-key `peek`.
 *
 * Note: `poolConsumedTotal` uses a separate pool bucket (legacy dual-write
 * layout preserved for the `poolUsageWithDimensions`-independent code paths).
 * `poolUsageWithDimensions` sums per-key `peek` values, matching sqlite's
 * semantics. The two paths can disagree under concurrent clear operations;
 * this is a known quirk of the dual-write layout and is documented for
 * future cleanup.
 *
 * Part of: Group B — Quota Sharing Engine (plan 22, frente F6).
 */
import { Keyv } from "keyv";
import type { DimensionKey } from "./dimensions";
import { dimensionKeyToString, WINDOW_MS } from "./dimensions";
import { getPool } from "@/lib/localDb";
import { computeBurnRateFromWindow } from "./burnRate";
import type { QuotaStore, PoolUsageSnapshot } from "./types";

export interface KeyvQuotaStoreOptions {
  /** Keyv URI: `memory://`, `keyv://sqlite:/path.db`, `redis://host:port`, etc. */
  uri?: string;
  /** Optional Keyv namespace to partition keys from other Keyv instances. */
  namespace?: string;
}

function dimKey(apiKeyId: string, dim: DimensionKey): string {
  return `consumed:${apiKeyId}:${dimensionKeyToString(dim)}`;
}
function poolDimKey(poolId: string, dim: DimensionKey): string {
  return `pool:${poolId}:${dimensionKeyToString(dim)}`;
}

export class KeyvQuotaStore implements QuotaStore {
  private readonly kv: Keyv;
  private readonly buckets = new Map<string, { value: number; expiresAt: number }>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(options: KeyvQuotaStoreOptions = {}) {
    const uri = options.uri ?? "memory://";
    const ns = options.namespace ? { namespace: options.namespace } : undefined;

    // Keyv 5.x accepts a URI string as the first constructor arg and parses
    // it internally (parseConnectionString). The TypeScript overloads don't
    // model the URI-string form, so cast at the call site. Runtime behavior
    // is identical to the un-cast call.
    const KeyvCtor = Keyv as unknown as new (uri: string, options?: object) => Keyv;
    this.kv = ns ? new KeyvCtor(uri, ns) : new KeyvCtor(uri);

    // Lightweight sweep for any TTL-keyed values the backend honors.
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [k, b] of this.buckets) {
        if (b.expiresAt <= now) this.buckets.delete(k);
      }
    }, 30_000);
    if (typeof this.cleanupTimer.unref === "function") this.cleanupTimer.unref();
  }

  /** Internal: exposed for KeyvQuotaStoreExtras. Do not use directly. */
  getKeyv(): Keyv {
    return this.kv;
  }

  async consume(apiKeyId: string, dim: DimensionKey, cost: number): Promise<number> {
    const k = dimKey(apiKeyId, dim);
    const ttlMs = WINDOW_MS[dim.window];
    const now = Date.now();
    const current = this.buckets.get(k);
    const next = (current && current.expiresAt > now ? current.value : 0) + cost;
    this.buckets.set(k, { value: next, expiresAt: now + ttlMs });
    await this.kv.set(k, next, ttlMs);
    // Mirror to pool bucket (used for `poolConsumedTotal` aggregates).
    const pk = poolDimKey(dim.poolId, dim);
    const pCurrent = this.buckets.get(pk);
    const pNext = (pCurrent && pCurrent.expiresAt > now ? pCurrent.value : 0) + cost;
    this.buckets.set(pk, { value: pNext, expiresAt: now + ttlMs });
    await this.kv.set(pk, pNext, ttlMs);
    return next;
  }

  async peek(apiKeyId: string, dim: DimensionKey): Promise<number> {
    const k = dimKey(apiKeyId, dim);
    const current = this.buckets.get(k);
    if (current && current.expiresAt > Date.now()) return current.value;
    const fromKv = (await this.kv.get<number>(k)) ?? 0;
    return fromKv;
  }

  async clear(apiKeyId: string, dim: DimensionKey): Promise<void> {
    const k = dimKey(apiKeyId, dim);
    this.buckets.delete(k);
    await this.kv.delete(k);
  }

  async poolConsumedTotal(poolId: string, dim: DimensionKey): Promise<number> {
    const pk = poolDimKey(poolId, dim);
    const current = this.buckets.get(pk);
    if (current && current.expiresAt > Date.now()) return current.value;
    return (await this.kv.get<number>(pk)) ?? 0;
  }

  async poolUsage(poolId: string): Promise<PoolUsageSnapshot> {
    // Empty-shell snapshot: pool allocation metadata lives in the DB (via
    // `getPool`), which `poolUsageWithDimensions` resolves. The interface
    // requires a non-throwing return; matches SqliteQuotaStore.poolUsage.
    return {
      poolId,
      generatedAt: new Date().toISOString(),
      dimensions: [],
    };
  }

  async poolUsageWithDimensions(
    poolId: string,
    planDimensions: Array<{ unit: string; window: string; limit: number }>,
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

    // Burn rate: derive from the sliding window (single-snapshot, no history
    // needed). Matches SqliteQuotaStore.poolUsageWithDimensions.
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

  async dispose(): Promise<void> {
    clearInterval(this.cleanupTimer);
    await this.kv.disconnect();
  }

  // The 5 dead-code methods (`recordPlanUsage`, `upsertProviderPlan`,
  // `listProviderPlans`, `setPools`, `getPool`) were removed from this class
  // and relocated to `KeyvQuotaStoreExtras` (./keyvQuotaStoreExtras.ts) so
  // the interface contract stays clean. They have zero callers today but are
  // preserved for future use.
}

let defaultStore: KeyvQuotaStore | null = null;

export function getKeyvQuotaStore(opts?: KeyvQuotaStoreOptions): KeyvQuotaStore {
  if (!defaultStore) defaultStore = new KeyvQuotaStore(opts);
  return defaultStore;
}

export function __resetKeyvQuotaStoreForTests(): void {
  defaultStore = null;
}
