/**
 * Query-Response Cache — PR-037
 *
 * Multi-tier cache for LLM query-response pairs.  Caches deterministic
 * (temperature=0) responses to reduce cost and latency.
 *
 * Tiers
 * -----
 * 1. In-memory LRU (`LRUCache` from `cacheLayer`) — fast, process-local.
 * 2. SQLite (`semantic_cache` table) — survives restarts.
 *
 * Cache key derivation uses `@/lib/cache/normalise` which produces a
 * deterministic SHA-256 digest of the normalised request body plus
 * model, temperature, top_p, etc.
 *
 * Bypass
 * ------
 * Set `X-OmniRoute-No-Cache: true` to skip both read and write.
 *
 * @module lib/cache/queryResponseCache
 */

import crypto from "node:crypto";
import { LRUCache } from "@/lib/cacheLayer";
import { deriveCacheKey, type CacheKeyParams } from "@/lib/cache/normalise";
import { getDbInstance } from "@/lib/db/core";

// ── Types ─────────────────────────────────────────────────────

export interface CachedResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<Record<string, unknown>>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  [key: string]: unknown;
}

export interface CacheStoreOptions {
  /** Estimated tokens saved by this cache hit. */
  tokensSaved?: number;
  /** TTL in ms (default: from env or 1 hour). */
  ttlMs?: number;
}

// ── Defaults ──────────────────────────────────────────────────

const DEFAULT_TTL_MS = parseInt(
  process.env.QUERY_RESPONSE_CACHE_TTL_MS || String(60 * 60 * 1000),
  10
); // 1 hour
const MAX_MEMORY_ENTRIES = parseInt(
  process.env.QUERY_RESPONSE_CACHE_MAX_ENTRIES || "200",
  10
);
const MAX_MEMORY_BYTES = parseInt(
  process.env.QUERY_RESPONSE_CACHE_MAX_BYTES || String(10 * 1024 * 1024),
  10
); // 10 MB

// ── Singleton memory cache ────────────────────────────────────

let _memCache: LRUCache | null = null;

function memCache(): LRUCache {
  if (!_memCache) {
    _memCache = new LRUCache({
      maxSize: MAX_MEMORY_ENTRIES,
      maxBytes: MAX_MEMORY_BYTES,
      defaultTTL: DEFAULT_TTL_MS,
    });
  }
  return _memCache;
}

// ── SQLite helpers ────────────────────────────────────────────

function ensureTable(): void {
  try {
    const db = getDbInstance();
    db.prepare(
      `CREATE TABLE IF NOT EXISTS query_response_cache (
        cache_key TEXT PRIMARY KEY,
        response TEXT NOT NULL,
        model TEXT NOT NULL,
        tokens_saved INTEGER NOT NULL DEFAULT 0,
        hit_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL
      )`
    ).run();
    // Index for expiry sweeps
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_qrc_expires_at ON query_response_cache(expires_at)`
    ).run();
  } catch {
    // DB unavailable — tier-2 degrades gracefully
  }
}

function insertRow(
  cacheKey: string,
  response: string,
  model: string,
  tokensSaved: number,
  expiresAt: string
): void {
  try {
    const db = getDbInstance();
    db.prepare(
      `INSERT OR REPLACE INTO query_response_cache (cache_key, response, model, tokens_saved, hit_count, created_at, expires_at)
       VALUES (?, ?, ?, ?, COALESCE((SELECT hit_count FROM query_response_cache WHERE cache_key = ?), 0), datetime('now'), ?)`
    ).run(cacheKey, response, model, tokensSaved, cacheKey, expiresAt);
  } catch {
    // DB unavailable — tier-2 write skipped
  }
}

function selectRow(cacheKey: string): {
  response: string;
  tokens_saved: number;
} | null {
  try {
    const db = getDbInstance();
    const row = db
      .prepare(
        `SELECT response, tokens_saved FROM query_response_cache
         WHERE cache_key = ? AND expires_at > datetime('now')`
      )
      .get(cacheKey) as { response: string; tokens_saved: number } | undefined;
    if (!row) return null;

    // Bump hit count asynchronously
    db.prepare(
      `UPDATE query_response_cache SET hit_count = hit_count + 1 WHERE cache_key = ?`
    ).run(cacheKey);

    return row;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Derive a deterministic cache key from a chat-completion request body.
 *
 * This is a convenience wrapper around `deriveCacheKey` that extracts
 * the relevant fields from an OpenAI-chat-completion-shaped body.
 *
 * Returns `null` when the body lacks mandatory fields (model, messages).
 */
export function keyFromBody(
  body: Record<string, unknown>,
  extra?: Pick<CacheKeyParams, "apiKeyId" | "tenantId" | "namespace">
): string | null {
  return deriveCacheKey({
    model: String(body.model ?? ""),
    messages: body.messages,
    temperature: body.temperature as number | undefined,
    top_p: body.top_p as number | undefined,
    max_tokens: body.max_tokens as number | undefined,
    stop: body.stop,
    presence_penalty: body.presence_penalty as number | undefined,
    frequency_penalty: body.frequency_penalty as number | undefined,
    tools: body.tools,
    tool_choice: body.tool_choice,
    response_format: body.response_format,
    seed: body.seed as number | undefined,
    ...extra,
  });
}

/**
 * Determine whether a request body is eligible for caching.
 *
 * Rules:
 *   1. `temperature` must be exactly `0` (deterministic output).
 *   2. `X-OmniRoute-No-Cache` header must not be `true`.
 *   3. Streaming requests ARE eligible — the cache stores the
 *      reassembled JSON response for subsequent non-streaming reads.
 */
export function isCacheableRequest(
  body: Record<string, unknown>,
  headers?: Headers | Record<string, string> | null
): boolean {
  // Temperature must be exactly 0
  const temp = body.temperature;
  if (typeof temp !== "number" || temp !== 0) return false;

  // Respect opt-out header
  if (headers) {
    const get =
      typeof (headers as Headers).get === "function"
        ? (k: string) => (headers as Headers).get(k)
        : (k: string) => (headers as Record<string, string>)[k];
    const noCache = get("x-omniroute-no-cache") || get("X-OmniRoute-No-Cache") || "";
    if (noCache.toLowerCase() === "true") return false;
  }

  return true;
}

/**
 * Determine whether an upstream response is eligible for storage.
 *
 * Rules:
 *   1. HTTP status must be 200.
 *   2. Request must have been cacheable (temperature=0).
 */
export function isCacheableResponse(
  status: number,
  _headers?: Headers | null
): boolean {
  return status === 200;
}

/**
 * Look up a cached response.
 *
 * Checks the in-memory LRU first (fast path), then falls back to
 * SQLite (persistent).  A SQLite hit is promoted back into memory.
 *
 * Returns `null` on cache miss.
 */
export function getCachedResponse(cacheKey: string): CachedResponse | null {
  // 1. In-memory
  const mem = memCache().get(cacheKey) as
    | { response: CachedResponse; tokensSaved: number }
    | undefined;
  if (mem) {
    return mem.response;
  }

  // 2. SQLite
  const row = selectRow(cacheKey);
  if (!row) return null;

  try {
    const parsed = JSON.parse(row.response) as CachedResponse;
    // Promote to memory
    memCache().set(cacheKey, {
      response: parsed,
      tokensSaved: row.tokens_saved,
    });
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Store a response in the cache.
 *
 * Writes to both the in-memory LRU and SQLite.
 *
 * @param cacheKey  The key from `keyFromBody`.
 * @param response  The full LLM response object.
 * @param model     Model identifier used for indexing.
 * @param opts      Optional tokens-saved estimate and TTL.
 */
export function setCachedResponse(
  cacheKey: string,
  response: CachedResponse,
  model: string,
  opts?: CacheStoreOptions
): void {
  const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS;
  const tokensSaved = opts?.tokensSaved ?? 0;

  // 1. In-memory
  memCache().set(
    cacheKey,
    { response, tokensSaved },
    ttl
  );

  // 2. SQLite
  const expiresAt = new Date(Date.now() + ttl).toISOString();
  insertRow(cacheKey, JSON.stringify(response), model, tokensSaved, expiresAt);
}

/**
 * Remove expired entries from SQLite.
 * Returns the number of rows purged.
 */
export function cleanExpiredEntries(): number {
  try {
    const db = getDbInstance();
    const result = db
      .prepare("DELETE FROM query_response_cache WHERE expires_at <= datetime('now')")
      .run();
    return result.changes;
  } catch {
    return 0;
  }
}

/**
 * Invalidate cache entries matching a model name.
 */
export function invalidateByModel(model: string): number {
  memCache().clear(); // Naive: clear all memory entries
  try {
    const db = getDbInstance();
    const result = db.prepare("DELETE FROM query_response_cache WHERE model = ?").run(model);
    return result.changes;
  } catch {
    return 0;
  }
}

/**
 * Invalidate a single cache entry by its key.
 */
export function invalidateByKey(cacheKey: string): boolean {
  memCache().delete(cacheKey);
  try {
    const db = getDbInstance();
    const result = db.prepare("DELETE FROM query_response_cache WHERE cache_key = ?").run(cacheKey);
    return result.changes > 0;
  } catch {
    return false;
  }
}

/**
 * Invalidate all cache entries.
 */
export function clearCache(): number {
  memCache().clear();
  try {
    const db = getDbInstance();
    const result = db.prepare("DELETE FROM query_response_cache").run();
    return result.changes;
  } catch {
    return 0;
  }
}

/**
 * Get aggregated cache statistics.
 */
export function getCacheStats(): {
  memoryEntries: number;
  dbEntries: number;
  hits: number;
  misses: number;
  hitRate: string;
  tokensSaved: number;
} {
  const memStats = memCache().getStats();

  let dbEntries = 0;
  try {
    const db = getDbInstance();
    const row = db
      .prepare(
        "SELECT COUNT(*) as count FROM query_response_cache WHERE expires_at > datetime('now')"
      )
      .get() as { count: number };
    dbEntries = row?.count ?? 0;
  } catch {
    // DB unavailable
  }

  // Sum hit_count across all entries for total hits
  let totalHits = 0;
  try {
    const db = getDbInstance();
    const row = db
      .prepare("SELECT COALESCE(SUM(hit_count), 0) as total FROM query_response_cache")
      .get() as { total: number };
    totalHits = row?.total ?? 0;
  } catch {
    // DB unavailable
  }

  const hits = memStats.hits + totalHits;
  const misses = memStats.misses;
  const total = hits + misses;

  return {
    memoryEntries: memStats.size,
    dbEntries,
    hits,
    misses,
    hitRate: total > 0 ? ((hits / total) * 100).toFixed(1) : "0.0",
    tokensSaved: 0, // Could track this in a future iteration
  };
}

// ── Startup ───────────────────────────────────────────────────

// Lazily ensure the SQLite table exists
ensureTable();
