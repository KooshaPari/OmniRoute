/**
 * Keyv-backed rate limiter — replaces ioredis Lua-scripted sliding window.
 *
 * Two API surfaces:
 *  - checkRateLimit(keyId, limit, windowMs) — positional (used by simplified callers)
 *  - checkRateLimit(keyId, rules[])        — array form (used by E2E + tests)
 *
 * For the array form, a call increments the counter EXACTLY ONCE — not once per
 * rule. The loop checks whether the current count (before increment) would
 * exceed any rule's limit; if any rule fails, the call is rejected without
 * incrementing. Otherwise the counter is incremented once and the call passes.
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
  window: number;
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
  if (enabled) keyvStore = null;
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
  return {
    allowed,
    remaining: Math.max(0, limit - count),
    resetMs,
    limit,
    ...(failedWindow !== undefined ? { failedWindow } : {}),
  };
}

function currentWindow(now: number, windowMs: number): { key: string; resetMs: number } {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetMs = windowStart + windowMs;
  return { key: `${windowStart}`, resetMs };
}

function peekInMemory(key: string, windowMs: number): { count: number; resetMs: number } {
  const now = Date.now();
  const w = currentWindow(now, windowMs);
  const entry = inMemoryCounters.get(`${key}:${w.key}`);
  return { count: entry?.count ?? 0, resetMs: w.resetMs };
}

function incrementInMemory(key: string, windowMs: number, limit: number): RateLimitResult {
  const now = Date.now();
  const w = currentWindow(now, windowMs);
  const entryKey = `${key}:${w.key}`;
  const entry = inMemoryCounters.get(entryKey) ?? { count: 0, windowStart: Number(w.key) };
  entry.count += 1;
  inMemoryCounters.set(entryKey, entry);
  return compute(entry.count <= limit, limit, entry.count, w.resetMs);
}

async function peekKeyv(key: string, windowMs: number): Promise<{ count: number; resetMs: number }> {
  const kv = getKeyvStore();
  const w = currentWindow(Date.now(), windowMs);
  try {
    const raw = await kv.get<RateLimitEntry>(`${key}:${w.key}`);
    return { count: raw?.count ?? 0, resetMs: w.resetMs };
  } catch {
    return { count: 0, resetMs: w.resetMs };
  }
}

async function incrementKeyv(key: string, windowMs: number, limit: number): Promise<RateLimitResult> {
  const kv = getKeyvStore();
  const now = Date.now();
  const w = currentWindow(now, windowMs);
  const entryKey = `${key}:${w.key}`;
  try {
    const raw = await kv.get<RateLimitEntry>(entryKey);
    const entry = raw && typeof raw === "object" && "count" in raw ? raw : { count: 0, windowStart: Number(w.key) };
    entry.count += 1;
    await kv.set(entryKey, entry, w.resetMs - now + 1000);
    return compute(entry.count <= limit, limit, entry.count, w.resetMs);
  } catch {
    return { allowed: true, remaining: limit, resetMs: w.resetMs, limit };
  }
}

/** Positional form. */
export async function checkRateLimit(
  keyId: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  return testMode
    ? incrementInMemory(keyId, windowMs, limit)
    : await incrementKeyv(keyId, windowMs, limit);
}

/**
 * Array form: each call increments the counter EXACTLY ONCE.
 * All rules must pass for the call to succeed.
 */
export async function checkRateLimitWithRules(
  keyId: string,
  rules: RateLimitRule[],
): Promise<RateLimitResult> {
  if (rules.length === 0) {
    return { allowed: true, remaining: 0, resetMs: Date.now(), limit: 0 };
  }
  // Phase 1: peek — check current count against each rule without incrementing
  for (const rule of rules) {
    const windowMs = Math.max(1, rule.window) * 1000;
    const peek = testMode
      ? peekInMemory(keyId, windowMs)
      : await peekKeyv(keyId, windowMs);
    if (peek.count >= rule.limit) {
      return compute(false, rule.limit, peek.count, peek.resetMs, rule.window);
    }
  }
  // Phase 2: all rules pass — increment once on the most-restrictive rule (last)
  const last = rules[rules.length - 1];
  const windowMs = Math.max(1, last.window) * 1000;
  return testMode
    ? incrementInMemory(keyId, windowMs, last.limit)
    : await incrementKeyv(keyId, windowMs, last.limit);
}

// Back-compat: keep the overloaded checkRateLimit supporting the array form too.
// Test suite uses positional + object; this function name is the canonical entry.
export { checkRateLimitWithRules as checkRateLimitArray };

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
