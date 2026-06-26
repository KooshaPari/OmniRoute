/**
 * Tier 2: SQLite-persisted cache — PR-036 Multi-tier LRU Cache
 *
 * Stores cached responses in a dedicated SQLite table (`multi_tier_cache`)
 * keyed by the full cache key (SHA-256 based).  Survives process restarts.
 *
 * Schema uses WITHOUT ROWID for the primary key so lookups are a single
 * B-tree descent.  Expired rows are cleaned lazily on read + via a
 * periodic vacuum.
 *
 * @module lib/cache/tiers/sqlite
 */

import crypto from "crypto";
import { getDbInstance } from "@/lib/db/core";

export interface SqliteTierOptions {
  ttlMs?: number;
}

interface DbRow {
  cache_value: string;
  tokens_saved: number;
  expires_at: string;
  hit_count: number;
}

const DEFAULT_TTL = 3_600_000; // 1 hour

function ensureTable(): void {
  try {
    const db = getDbInstance();
    db.exec(`
      CREATE TABLE IF NOT EXISTS multi_tier_cache (
        cache_key    TEXT PRIMARY KEY,
        cache_value  TEXT NOT NULL,
        model        TEXT NOT NULL DEFAULT '',
        provider     TEXT NOT NULL DEFAULT '',
        tenant       TEXT NOT NULL DEFAULT '',
        tokens_saved INTEGER NOT NULL DEFAULT 0,
        hit_count    INTEGER NOT NULL DEFAULT 0,
        byte_size    INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at   TEXT NOT NULL
      ) WITHOUT ROWID
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mtc_expires
      ON multi_tier_cache(expires_at)
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mtc_provider
      ON multi_tier_cache(provider)
    `);
  } catch {
    // DB not available
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export class SqliteTier {
  #defaultTtl: number;

  constructor(options: SqliteTierOptions = {}) {
    this.#defaultTtl = options.ttlMs ?? DEFAULT_TTL;
    ensureTable();
  }

  /**
   * Read a value from SQLite.
   * Returns `{ value, tokensSaved }` or `null` on miss/expiry.
   */
  get(key: string, params?: { model?: string; provider?: string; tenant?: string }): { value: unknown; tokensSaved: number } | null {
    try {
      const db = getDbInstance();
      const row = db
        .prepare(
          `SELECT cache_value, tokens_saved, expires_at, hit_count
           FROM multi_tier_cache
           WHERE cache_key = ? AND expires_at > datetime('now')`
        )
        .get(key) as DbRow | undefined;

      if (!row) return null;

      // Bump hit count asynchronously (non-blocking)
      try {
        db.prepare(
          `UPDATE multi_tier_cache SET hit_count = hit_count + 1 WHERE cache_key = ?`
        ).run(key);
      } catch { /* best-effort */ }

      return {
        value: JSON.parse(row.cache_value),
        tokensSaved: row.tokens_saved,
      };
    } catch {
      return null;
    }
  }

  /**
   * Store a value in SQLite.
   */
  set(key: string, value: unknown, options?: { ttlMs?: number; model?: string; provider?: string; tenant?: string; tokensSaved?: number }): void {
    const ttl = options?.ttlMs ?? this.#defaultTtl;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttl).toISOString();
    const raw = JSON.stringify(value);
    const byteSize = raw.length * 2;

    try {
      const db = getDbInstance();
      db.prepare(
        `INSERT OR REPLACE INTO multi_tier_cache
         (cache_key, cache_value, model, provider, tenant, tokens_saved, byte_size, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        key,
        raw,
        options?.model ?? "",
        options?.provider ?? "",
        options?.tenant ?? "",
        options?.tokensSaved ?? 0,
        byteSize,
        now,
        expiresAt,
      );
    } catch {
      // Write failed
    }
  }

  /**
   * Delete a single key.
   */
  delete(key: string): boolean {
    try {
      const db = getDbInstance();
      const result = db.prepare("DELETE FROM multi_tier_cache WHERE cache_key = ?").run(key);
      return (result.changes ?? 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Delete all expired entries.
   */
  reap(): number {
    try {
      const db = getDbInstance();
      const result = db.prepare(
        "DELETE FROM multi_tier_cache WHERE expires_at <= datetime('now')"
      ).run();
      return result.changes ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Invalidate all entries for a given provider.
   */
  invalidateByProvider(provider: string): number {
    try {
      const db = getDbInstance();
      const result = db.prepare("DELETE FROM multi_tier_cache WHERE provider = ?").run(provider);
      return result.changes ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Invalidate all entries for a given tenant.
   */
  invalidateByTenant(tenant: string): number {
    try {
      const db = getDbInstance();
      const result = db.prepare("DELETE FROM multi_tier_cache WHERE tenant = ?").run(tenant);
      return result.changes ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Clear the entire table.
   */
  clear(): number {
    try {
      const db = getDbInstance();
      const result = db.prepare("DELETE FROM multi_tier_cache").run();
      return result.changes ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Return count of non-expired entries.
   */
  get size(): number {
    try {
      const db = getDbInstance();
      const row = db
        .prepare("SELECT COUNT(*) AS cnt FROM multi_tier_cache WHERE expires_at > datetime('now')")
        .get() as { cnt: number } | undefined;
      return row?.cnt ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Return total byte_size of non-expired entries.
   */
  get totalBytes(): number {
    try {
      const db = getDbInstance();
      const row = db
        .prepare("SELECT COALESCE(SUM(byte_size), 0) AS total FROM multi_tier_cache WHERE expires_at > datetime('now')")
        .get() as { total: number } | undefined;
      return row?.total ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Estimated tokens saved across all non-expired entries.
   */
  get totalTokensSaved(): number {
    try {
      const db = getDbInstance();
      const row = db
        .prepare("SELECT COALESCE(SUM(tokens_saved), 0) AS total FROM multi_tier_cache WHERE expires_at > datetime('now')")
        .get() as { total: number } | undefined;
      return row?.total ?? 0;
    } catch {
      return 0;
    }
  }
}
