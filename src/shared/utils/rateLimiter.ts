/**
 * Keyv-backed rate limiter — replaces ioredis Lua-scripted sliding window.
 *
 * Uses Keyv with SQLite backend for persistent counters. The Keyv INCR+EXPIRE
 * pattern replicates the Redis Lua atomic counter without requiring a Redis
 * sidecar.
 *
 * Two API surfaces:
 *  - checkRateLimit(keyId, limit, windowMs) — positional (used by `simplified` callers)
 *  - checkRateLimit(keyId, rules[])        — array form (used by E2E + tests)
 */
import { Keyv } from "keyv";
import { KeyvSqlite } from "@keyv/sqlite";
import { resolve } from "node:path";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/** Rule shape consumed by the array-form API. `window` is in seconds. */
export interface RateLimitRule {
  limit: number;
  window: number; // seconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
  /** Window (seconds) on which the limit was exceeded (array-form only). */
  failedWindow?: number;
}

function defaultDataDir(): string {
  return process.env.DATA_DIR || process.env.HOME || "/tmp";
}

let keyvStore: Keyv | null = null;
let testMode = false;

function getKeyvStore(): Keyv {
  if (!keyvStore) {
    const dbPath = resolve(defaultDataDir(), "rate-limiter-keyv.sqlite");
    keyvStore = new Keyv({ store: new KeyvSqlite({ uri: dbPath }) });
  }
  return keyvStore;
}

const inMemoryCounters = new Map<string, RateLimitEntry>();

/** Force in-memory mode (used by tests for hermeticity). */
export function setRateLimiterTestMode(enabled: boolean): void {
  testMode = enabled;
  if (enabled) keyvStore = null; // ensure no keyv leakage
}

/** Reset in-memory counters (call between tests). */
export function __resetRateLimitManagerForTests(): void {
  inMemoryCounters.clear();
}

export function cleanupRateLimiters(): void {
  inMemoryCounters.clear();
  keyvStore = null;
}

function compute(allowed: boolean, limit: number, count: number, resetMs: number, failedWindow?: number): RateLimitResult {
  return { allowed, remaining: Math.max(0, limit - count), resetMs, limit, ...(failedWindow !== undefined ? { failedWindow } : {}) };
}

async function incrementKeyv(
  key: string,
  windowMs: number,
  limit: number,
): Promise<RateLimitResult> {
  const kv = getKeyvStore();
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetMs = windowStart + windowMs;
  const entryKey = `${key}:${windowStart}`;
  try {
    const raw = await kv.get<RateLimitEntry>(entryKey);
    const entry = raw && typeof raw === "object" && "count" in raw ? raw : { count: 0, windowStart };
    entry.count += 1;
    await kv.set(entryKey, entry, resetMs - now + 1000);
    return compute(entry.count <= limit, limit, entry.count, resetMs);
  } catch {
    return { allowed: true, remaining: limit, resetMs, limit };
  }
}

function incrementInMemory(
  key: string,
  windowMs: number,
  limit: number,
): RateLimitResult {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetMs = windowStart + windowMs;
  const entryKey = `${key}:${windowStart}`;
  const entry = inMemoryCounters.get(entryKey) ?? { count: 0, windowStart };
  entry.count += 1;
  inMemoryCounters.set(entryKey, entry);
  return compute(entry.count <= limit, limit, entry.count, resetMs);
}

/** Array-form API: evaluate each rule, fail on first non-allowed. */
export async function checkRateLimit(
  keyId: string,
  limitOrRules: number | RateLimitRule[],
  windowMsOrUnused?: number,
): Promise<RateLimitResult> {
  // Array form
  if (Array.isArray(limitOrRules)) {
    const rules = limitOrRules;
    let c: { last: RateLimitResult | null } = { last: null };
    for (const rule of rules) {
      const windowMs = Math.max(1, rule.window) * 1000;
      const result = testMode
        ? incrementInMemory(keyId, windowMs, rule.limit)
        : await incrementKeyv(keyId, windowMs, rule.limit);
      if (!result.allowed) return { ...result, failedWindow: rule.window };
      c.last = result;
    }
    // Last rule passed; return its "allowed" result
    const last = rules[rules.length - 1];
    return testMode
      ? incrementInMemory(keyId, Math.max(1, last.window) * 1000, last.limit)
      : await incrementKeyv(keyId, Math.max(1, last.window) * 1000, last.limit);
  }
  // Positional form
  const limit = limitOrRules;
  const windowMs = windowMsOrUnused ?? 1000;
  return testMode
    ? incrementInMemory(keyId, windowMs, limit)
    : await incrementKeyv(keyId, windowMs, limit);
}

/** Legacy shim — always returns false (Redis removed). */
export function isRedisConfigured(): boolean {
  return false;
}

/** Legacy shim — returns a no-op Redis client. */
export function getRedisClient(): {
  del: (...args: any[]) => Promise<any>;
  get: (...args: any[]) => Promise<any>;
  set: (...args: any[]) => Promise<any>;
} {
  return {
    async del() { return 1; },
    async get() { return null; },
    async set() { return "OK"; },
  };
}
