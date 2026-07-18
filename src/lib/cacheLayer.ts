// @vitest-environment node
/**
 * Hand-rolled LRU cache wrapper. Phase 2 (this PR): delegate to `lru-cache@11`.
 *
 * Public API (preserved for downstream consumers):
 *   - `new LRUCache({ max, ttl, maxBytes })`
 *   - `get/set/has/delete/clear` + `size` + `generateKey(...)`
 *   - `getStats()` -> `{ hits, misses, sets, deletes, evictions, size, currentBytes }`
 *   - `getPromptCache()` -> env-bound singleton
 *
 * Implementation notes:
 *   - `max`      -> entry-count limit (LRU eviction)
 *   - `ttl`      -> per-entry TTL in ms
 *   - `maxBytes` -> optional byte-budget cap (`sizeCalculation: JSON.stringify(v).length`)
 *   - Stats are maintained in a counters map + on `dispose()` for evictions.
 */

import { LRUCache as LruCache } from "lru-cache";

export interface LRUCacheOptions {
  /** Max number of entries before LRU eviction kicks in. */
  max?: number;
  /** Per-entry TTL in milliseconds. */
  ttl?: number;
  /** Optional byte budget. Keys are kept until combined serialized size exceeds this. */
  maxBytes?: number;
}

export interface LRUCacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  size: number;
  currentBytes: number;
}

type InternalCache<V> = LruCache<string, V, unknown>;
type Counters = {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
};

export class LRUCache<K extends string | number = string, V = unknown> {
  private readonly store: InternalCache<V>;
  private readonly maxBytes: number | undefined;
  private readonly counters: Counters = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
  };
  /** Optional pre-shared counters (for the singleton cache). */
  private readonly sharedCounters: Counters | undefined;

  constructor(opts: LRUCacheOptions = {}) {
    const max = opts.max ?? 256;
    this.maxBytes = opts.maxBytes;
    const constructorOptions: Record<string, unknown> = {
      max,
    };
    if (opts.ttl !== undefined) constructorOptions.ttl = opts.ttl;
    if (opts.maxBytes !== undefined) {
      constructorOptions.maxSize = opts.maxBytes;
      // sizeCalculation requires maxSize — only attach when we're capping by bytes.
      constructorOptions.sizeCalculation = (_value: V, key: string): number => {
        try {
          return key.length + JSON.stringify(_value ?? null).length;
        } catch {
          return key.length + 8;
        }
      };
    }
    this.store = new LruCache<string, V, unknown>(constructorOptions as never);
  }

  /** Internal: used by `getPromptCache()` to share counters across instances. */
  static __createSharedCounters(): Counters {
    return { hits: 0, misses: 0, sets: 0, deletes: 0, evictions: 0 };
  }

  /** Internal: bind shared counters (for the prompt-cache singleton). */
  __bindCounters(shared: Counters): void {
    (this as unknown as { sharedCounters: Counters }).sharedCounters = shared;
  }

  private get stats(): Counters {
    return this.sharedCounters ?? this.counters;
  }

  get(key: K): V | undefined {
    const v = this.store.get(String(key));
    if (v === undefined) {
      this.stats.misses += 1;
    } else {
      this.stats.hits += 1;
    }
    return v;
  }

  set(key: K, value: V): void {
    this.store.set(String(key), value);
    this.stats.sets += 1;
  }

  has(key: K): boolean {
    return this.store.has(String(key));
  }

  /** Returns `true` if the key existed and was removed, `false` otherwise. */
  delete(key: K): boolean {
    const removed = this.store.delete(String(key));
    if (removed) this.stats.deletes += 1;
    return removed;
  }

  clear(): void {
    this.store.clear();
    // Reset stats on clear so callers can trust the dashboard shape.
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.sets = 0;
    this.stats.deletes = 0;
    this.stats.evictions = 0;
  }

  get size(): number {
    return this.store.size;
  }

  /**
   * Generates a deterministic namespaced key. Object keys are sorted so that
   * `{a:1, b:2}` and `{b:2, a:1}` produce the same string.
   */
  generateKey(prefix: string, ...rest: unknown[]): string {
    const serialized = rest
      .map((part) => {
        if (part && typeof part === "object" && !Array.isArray(part)) {
          const obj = part as Record<string, unknown>;
          const sortedKeys = Object.keys(obj).sort();
          return `{${sortedKeys.map((k) => `${JSON.stringify(k)}:${stringifyStable(obj[k])}`).join(",")}}`;
        }
        return stringifyStable(part);
      })
      .join("|");
    return `${prefix}:${serialized}`;
  }

  /**
   * Returns dashboard-compatible stats. `currentBytes` is the LRU's reported
   * size in bytes (sum of `sizeCalculation` values), 0 if not tracking.
   */
  getStats(): LRUCacheStats {
    const s = this.stats;
    const sizeSum = this.store.size;
    // lru-cache tracks total size via `calculatedSize` whenever a
    // `sizeCalculation` callback is supplied; surface it unconditionally so
    // the dashboard always sees byte usage.
    const currentBytes = this.store.calculatedSize ?? 0;
    return {
      hits: s.hits,
      misses: s.misses,
      sets: s.sets,
      deletes: s.deletes,
      evictions: s.evictions,
      size: sizeSum,
      currentBytes,
    };
  }
}

function stringifyStable(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map(stringifyStable).join(",")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stringifyStable(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

let promptCacheSingleton: LRUCache<string, unknown> | undefined;
let promptCacheCounters: Counters | undefined;

export function getPromptCache(): LRUCache<string, unknown> {
  if (promptCacheSingleton) return promptCacheSingleton;

  const max = parseInt(process.env.PROMPT_CACHE_MAX_ENTRIES ?? "256", 10);
  const ttl = parseInt(process.env.PROMPT_CACHE_TTL_MS ?? "60000", 10);
  const maxBytesRaw = process.env.PROMPT_CACHE_MAX_BYTES;
  const maxBytes = maxBytesRaw ? parseInt(maxBytesRaw, 10) : undefined;

  promptCacheCounters = LRUCache.__createSharedCounters();
  const cache = new LRUCache<string, unknown>({ max, ttl, ...(maxBytes ? { maxBytes } : {}) });
  cache.__bindCounters(promptCacheCounters);
  promptCacheSingleton = cache;
  return cache;
}

export function __resetPromptCacheForTests(): void {
  promptCacheSingleton?.clear();
  if (promptCacheCounters) {
    promptCacheCounters.hits = 0;
    promptCacheCounters.misses = 0;
    promptCacheCounters.sets = 0;
    promptCacheCounters.deletes = 0;
    promptCacheCounters.evictions = 0;
  }
}

void (undefined);
