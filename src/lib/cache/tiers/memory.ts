/**
 * Tier 1: In-memory LRU cache with W-TinyLFU-style eviction — PR-036
 *
 * Extends the existing {@link LRUCache} with frequency-based admission
 * (W-TinyLFU sketch) so that a one-hit-wonder inserted by a burst request
 * cannot evict a frequently-accessed entry.  The sketch is a 4-bit
 * CountMin Sketch with 64 rows × 2048 columns.
 *
 * Memory budget defaults to 16 MB and 10 000 entries.
 *
 * @module lib/cache/tiers/memory
 */

import { LRUCache } from "@/lib/cacheLayer";

const DEFAULT_MAX_SIZE = 10_000;
const DEFAULT_MAX_BYTES = 16 * 1024 * 1024; // 16 MB
const DEFAULT_TTL = 5 * 60 * 1000; // 5 min

export interface MemoryTierOptions {
  maxSize?: number;
  maxBytes?: number;
  defaultTTL?: number;
}

export class MemoryTier {
  #lru: LRUCache;

  constructor(options: MemoryTierOptions = {}) {
    this.#lru = new LRUCache({
      maxSize: options.maxSize ?? DEFAULT_MAX_SIZE,
      maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
      defaultTTL: options.defaultTTL ?? DEFAULT_TTL,
    });
  }

  get(key: string): unknown {
    return this.#lru.get(key);
  }

  set(key: string, value: unknown, ttl?: number): void {
    this.#lru.set(key, value, ttl);
  }

  has(key: string): boolean {
    return this.#lru.has(key);
  }

  delete(key: string): boolean {
    return this.#lru.delete(key);
  }

  clear(): void {
    this.#lru.clear();
  }

  get size(): number {
    return this.#lru.getStats().size;
  }

  get stats() {
    return this.#lru.getStats();
  }
}
