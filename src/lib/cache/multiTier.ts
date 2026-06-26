/**
 * Multi-tier LRU Cache — PR-036
 *
 * Orchestrates three cache tiers with a read-through / write-through
 * strategy:
 *
 *   Tier 1 (Memory)   — W-TinyLFU-style LRU, sub-millisecond, process-local
 *   Tier 2 (SQLite)   — survives restarts, shared within a single host
 *   Tier 3 (Disk)     — segmented file store, survives restarts, shared
 *                        across processes (PM2 cluster)
 *
 * **Read path**:  Memory → SQLite → Disk.  On hit, the value is promoted
 * to every higher tier (warming).  On miss, returns null.
 *
 * **Write path**:  Written to all three tiers synchronously (the disk
 * write is fire-and-forget behind a setImmediate).
 *
 * **Cache key**:  SHA-256(normalised request body + model + provider + tenant).
 * See {@link module:lib/cache/normalise}.
 *
 * **Env knobs**:
 *   - `MULTI_TIER_CACHE_TTL_MS`       — default TTL (default 3 600 000 / 1 h)
 *   - `MULTI_TIER_MEMORY_MAX_SIZE`    — max memory entries (default 10 000)
 *   - `MULTI_TIER_MEMORY_MAX_BYTES`   — max memory bytes (default 16 MB)
 *   - `MULTI_TIER_SQLITE_TTL_MS`      — SQLite TTL override
 *   - `DISK_CACHE_MAX_ENTRIES`        — max disk entries (default 50 000)
 *   - `OMNIROUTE_CACHE_DIR`           — disk cache root
 *   - `MULTI_TIER_CACHE_DISABLED=1`   — disable all caching
 *
 * @module lib/cache/multiTier
 */

import { MemoryTier } from "./tiers/memory";
import { SqliteTier } from "./tiers/sqlite";
import { DiskTier } from "./tiers/disk";
import { generateCacheKey, type NormaliseParams } from "./normalise";

// ── Types ─────────────────────────────────────────────

export interface CacheHit<T = unknown> {
  value: T;
  tier: "memory" | "sqlite" | "disk";
  tokensSaved: number;
}

export interface CacheWriteOptions {
  ttlMs?: number;
  tokensSaved?: number;
}

export interface CacheStats {
  memoryEntries: number;
  sqliteEntries: number;
  diskEntries: number;
  memoryBytes: number;
  sqliteBytes: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: string;
  tokensSaved: number;
}

// ── Singleton ─────────────────────────────────────────

let instance: MultiTierCache | null = null;

/**
 * Get or create the global multi-tier cache instance.
 */
export function getMultiTierCache(): MultiTierCache {
  if (!instance) {
    instance = new MultiTierCache();
  }
  return instance;
}

/**
 * Reset singleton (for testing).
 */
export function resetMultiTierCache(): void {
  instance = null;
}

// ── Tier Orchestrator ────────────────────────────────

export class MultiTierCache {
  readonly memory: MemoryTier;
  readonly sqlite: SqliteTier;
  readonly disk: DiskTier;
  readonly disabled: boolean;

  // Reaper interval handle
  #reaperTimer: ReturnType<typeof setInterval> | null = null;

  // Instance-level metrics (not shared across instances)
  #hits = 0;
  #misses = 0;
  #evictions = 0;
  #tokensSaved = 0;

  constructor() {
    this.disabled = process.env.MULTI_TIER_CACHE_DISABLED === "1";

    this.memory = new MemoryTier({
      maxSize: parseInt(process.env.MULTI_TIER_MEMORY_MAX_SIZE || "10000", 10),
      maxBytes: parseInt(process.env.MULTI_TIER_MEMORY_MAX_BYTES || String(16 * 1024 * 1024), 10),
      defaultTTL: parseInt(process.env.MULTI_TIER_CACHE_TTL_MS || "3600000", 10),
    });

    this.sqlite = new SqliteTier({
      ttlMs: parseInt(process.env.MULTI_TIER_SQLITE_TTL_MS || process.env.MULTI_TIER_CACHE_TTL_MS || "3600000", 10),
    });

    this.disk = new DiskTier({
      maxEntries: parseInt(process.env.DISK_CACHE_MAX_ENTRIES || "50000", 10),
      ttlMs: parseInt(process.env.DISK_CACHE_TTL_MS || String(12 * 60 * 60 * 1000), 10),
    });

    // Start periodic reaper for SQLite (every 5 min)
    this.#reaperTimer = setInterval(() => {
      const reaped = this.sqlite.reap();
      if (reaped > 0) {
        this.#evictions++;
      }
    }, 300_000);
    if (this.#reaperTimer && "unref" in this.#reaperTimer) {
      (this.#reaperTimer as unknown as { unref(): void }).unref();
    }
  }

  // ── Read ──────────────────────────────────────────────

  /**
   * Retrieve a value from the cache hierarchy.
   *
   * @param key    Full cache key
   * @returns `CacheHit` or `null` if not found in any tier
   */
  get<T = unknown>(key: string): CacheHit<T> | null {
    if (this.disabled) return null;

    // 1. Memory — fastest path
    const memVal = this.memory.get(key) as { value: T; tokensSaved: number } | undefined;
    if (memVal !== undefined) {
      this.#hits++;
      this.#tokensSaved += memVal.tokensSaved;
      return { value: memVal.value, tier: "memory", tokensSaved: memVal.tokensSaved };
    }

    // 2. SQLite
    const sqlResult = this.sqlite.get(key);
    if (sqlResult) {
      // Warm memory
      this.memory.set(key, { value: sqlResult.value, tokensSaved: sqlResult.tokensSaved });
      this.#hits++;
      this.#tokensSaved += sqlResult.tokensSaved;
      return { value: sqlResult.value as T, tier: "sqlite", tokensSaved: sqlResult.tokensSaved };
    }

    // 3. Disk — slowest
    const diskResult = this.disk.get(key);
    if (diskResult) {
      // Warm memory + SQLite
      this.memory.set(key, { value: diskResult.value, tokensSaved: diskResult.tokensSaved });
      this.sqlite.set(key, diskResult.value, { tokensSaved: diskResult.tokensSaved });
      this.#hits++;
      this.#tokensSaved += diskResult.tokensSaved;
      return { value: diskResult.value as T, tier: "disk", tokensSaved: diskResult.tokensSaved };
    }

    this.#misses++;
    return null;
  }

  // ── Write ─────────────────────────────────────────────

  /**
   * Store a value in all tiers.
   */
  set<T = unknown>(key: string, value: T, options?: CacheWriteOptions): void {
    if (this.disabled) return;

    const tokensSaved = options?.tokensSaved ?? 0;
    const ttlMs = options?.ttlMs;

    // Always write to memory
    this.memory.set(key, { value, tokensSaved }, ttlMs);

    // Write to SQLite
    this.sqlite.set(key, value, { ttlMs, tokensSaved });

    // Write to disk (deferred)
    setImmediate(() => {
      try {
        this.disk.set(key, value, { ttlMs, tokensSaved });
      } catch {
        // best-effort
      }
    });
  }

  // ── Existence + Invalidation ─────────────────────────

  /**
   * Check if a key exists in memory (fast check only).
   */
  has(key: string): boolean {
    return !this.disabled && this.memory.has(key);
  }

  /**
   * Delete a key from all tiers.
   */
  delete(key: string): boolean {
    if (this.disabled) return false;
    const m = this.memory.delete(key);
    const s = this.sqlite.delete(key);
    const d = this.disk.delete(key);
    return m || s || d;
  }

  /**
   * Clear all tiers.
   */
  clear(): void {
    if (this.disabled) return;
    this.memory.clear();
    this.sqlite.clear();
    this.disk.clear();
  }

  // ── Key Generation (delegates to normalise) ──────────

  /**
   * Generate a cache key from request parameters.
   * Convenience wrapper.
   */
  generateKey(params: NormaliseParams): string {
    return generateCacheKey(params);
  }

  // ── Stats ─────────────────────────────────────────────

  /**
   * Return combined stats across all tiers.
   */
  getStats(): CacheStats {
    const memStats = this.memory.stats;
    const total = this.#hits + this.#misses;

    return {
      memoryEntries: memStats.size,
      sqliteEntries: this.sqlite.size,
      diskEntries: this.disk.size,
      memoryBytes: memStats.bytes,
      sqliteBytes: this.sqlite.totalBytes,
      hits: this.#hits,
      misses: this.#misses,
      evictions: this.#evictions,
      hitRate: total > 0 ? ((this.#hits / total) * 100).toFixed(1) : "0.0",
      tokensSaved: this.#tokensSaved,
    };
  }

  // ── Teardown ──────────────────────────────────────────

  /**
   * Stop background timer.  Call during graceful shutdown.
   */
  shutdown(): void {
    if (this.#reaperTimer) {
      clearInterval(this.#reaperTimer);
      this.#reaperTimer = null;
    }
  }
}
