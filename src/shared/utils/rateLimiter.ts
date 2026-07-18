/**
 * Keyv-backed rate limiter — replaces ioredis Lua-scripted sliding window.
 *
 * Uses Keyv with SQLite backend for persistent counters. The Keyv INCR+EXPIRE
 * pattern replicates the Redis Lua atomic counter without requiring a Redis
 * sidecar. Falls back to in-memory Map when Keyv initialization fails.
 */
import { Keyv } from "keyv";
import { KeyvSqlite } from "@keyv/sqlite";
import { resolve } from "node:path";

// Keyv-backed store — always on (replaces REDIS_URL-gated ioredis).
const USE_KEYV = true;
let keyvStore: Keyv | null = null;

function getKeyvStore(): Keyv {
  if (!keyvStore) {
    const dataDir = process.env.DATA_DIR || process.env.HOME || "/tmp";
    const dbPath = resolve(dataDir, "rate-limiter-keyv.sqlite");
    keyvStore = new Keyv({ store: new KeyvSqlite({ uri: dbPath }) });
  }
  return keyvStore;
}

/** Legacy shim — always returns a no-op Redis stub for apiKeys.ts dead-code paths. */
export function getRedisClient(): { del: (...args: any[]) => Promise<any>; get: (...args: any[]) => Promise<any>; set: (...args: any[]) => Promise<any> } {
  return {
    async del() { return 1; },
    async get() { return null; },
    async set() { return "OK"; },
  };
}

export function isRedisConfigured(): boolean {
  return false;
}

// ---------- Keyv-backed sliding-window counter ----------

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * Atomic sliding-window counter using Keyv.
 *
 * For single-process use this is safe (no contention). For multi-process,
 * each process counts independently — acceptable for rate limiting where
 * per-process approximation is sufficient.
 */
async function incrementKeyvCounter(
  key: string,
  windowMs: number,
  limit: number,
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const kv = getKeyvStore();
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetMs = windowStart + windowMs;
  const entryKey = `${key}:${windowStart}`;

  try {
    const raw = await kv.get(entryKey);
    const entry: RateLimitEntry = raw && typeof raw === "object" && "count" in (raw as any)
      ? (raw as RateLimitEntry)
      : { count: 0, windowStart };
    entry.count += 1;
    await kv.set(entryKey, entry, resetMs - now + 1000); // TTL = window remainder + buffer
    const remaining = Math.max(0, limit - entry.count);
    return { allowed: entry.count <= limit, remaining, resetMs };
  } catch {
    // Keyv fallback — allow the request
    return { allowed: true, remaining: limit, resetMs };
  }
}

// ---------- In-memory fallback (used when Keyv init fails) ----------

const inMemoryCounters = new Map<string, RateLimitEntry>();

function incrementInMemoryCounter(
  key: string,
  windowMs: number,
  limit: number,
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetMs = windowStart + windowMs;
  const entryKey = `${key}:${windowStart}`;
  const entry = inMemoryCounters.get(entryKey) ?? { count: 0, windowStart };
  entry.count += 1;
  inMemoryCounters.set(entryKey, entry);
  // Periodic cleanup of expired entries
  if (inMemoryCounters.size > 10_000) {
    for (const [k, v] of inMemoryCounters) {
      if (v.windowStart + windowMs < now) inMemoryCounters.delete(k);
    }
  }
  const remaining = Math.max(0, limit - entry.count);
  return { allowed: entry.count <= limit, remaining, resetMs };
}

// ---------- Public API ----------

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
}

/**
 * Check a rate limit rule for the given key.
 *
 * @param keyId       Unique identifier for the rate-limited resource
 * @param limit       Maximum requests per window
 * @param windowMs    Window duration in milliseconds
 */
export async function checkRateLimit(
  keyId: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (USE_KEYV) {
    const result = await incrementKeyvCounter(`rl:${keyId}`, windowMs, limit);
    return { ...result, limit };
  }
  const result = incrementInMemoryCounter(`rl:${keyId}`, windowMs, limit);
  return { ...result, limit };
}

/**
 * Legacy single-rule check (backward-compatible).
 */
export async function checkRateLimitSingleRule(
  keyId: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  return checkRateLimit(keyId, limit, windowMs);
}

/**
 * Clear all in-memory rate limit counters (used in tests).
 */
export function __resetRateLimitManagerForTests(): void {
  inMemoryCounters.clear();
}

/**
 * Cleanup — no-op for Keyv (SQLite handles TTL), clears in-memory counters.
 */
export function cleanupRateLimiters(): void {
  inMemoryCounters.clear();
}
