/**
 * Keyv/SQLite-backed fixed-window rate limiter.
 *
 * The public rules API is deliberately compatible with the earlier Redis
 * implementation: each request is checked against every configured window
 * and increments every window only when all limits allow it.  Keyv is the
 * persistent backend when the legacy REDIS_URL opt-in is present; otherwise a
 * bounded process-local fallback avoids probing localhost or importing Redis.
 */
import { Keyv } from "keyv";
import { KeyvSqlite } from "@keyv/sqlite";
import { resolve } from "node:path";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export interface RateLimitRule {
  limit: number;
  /** Fixed-window duration in seconds. */
  window: number;
}

export interface RateLimitResult {
  allowed: boolean;
  failedWindow?: number;
  /** Present for the positional API. */
  remaining?: number;
  resetMs?: number;
  limit?: number;
}

/**
 * Retain this explicit legacy opt-in rather than silently connecting to a
 * localhost Redis instance.  The configured persistence implementation is
 * Keyv/SQLite, not a Redis client.
 */
const REDIS_URL = process.env.REDIS_URL?.trim() || "";

function defaultDataDir(): string {
  return process.env.DATA_DIR || process.env.HOME || "/tmp";
}

let keyvStore: Keyv | null = null;
let testMode = false;
let keyvCheckTail: Promise<void> = Promise.resolve();

function getKeyvStore(): Keyv {
  if (!keyvStore) {
    const dbPath = resolve(defaultDataDir(), "rate-limiter-keyv.sqlite");
    keyvStore = new Keyv({ store: new KeyvSqlite({ uri: dbPath }) });
  }
  return keyvStore;
}

const positionalCounters = new Map<string, RateLimitEntry>();
const TEST_MEMORY_STORE = new Map<string, number>();
const FALLBACK_MEMORY_STORE = new Map<string, number>();
const EVICTION_THRESHOLD = 50;

type RedisCompatibilityClient = {
  del: (...args: unknown[]) => Promise<unknown>;
  get: (...args: unknown[]) => Promise<unknown>;
  set: (...args: unknown[]) => Promise<unknown>;
};

export function isRedisConfigured(): boolean {
  return false;
}

function isKeyvPersistenceEnabled(): boolean {
  return REDIS_URL.length > 0;
}

/**
 * Redis was intentionally removed from this limiter.  Keep the historical
 * export strict so callers cannot accidentally treat a no-op as a live cache.
 */
export function getRedisClient(): RedisCompatibilityClient {
  if (!isRedisConfigured()) {
    throw new Error("Redis is not configured");
  }
  throw new Error("Redis is not available in the Keyv rate limiter");
}

/** Remove completed legacy fixed-window keys without touching unknown keys. */
export function evictStaleRateLimitWindows(store: Map<string, number>, nowSeconds: number): void {
  for (const key of store.keys()) {
    const lastColon = key.lastIndexOf(":");
    const secondLastColon = key.lastIndexOf(":", lastColon - 1);
    if (lastColon === -1 || secondLastColon === -1) continue;

    const windowNumber = Number(key.slice(lastColon + 1));
    const windowSize = Number(key.slice(secondLastColon + 1, lastColon));
    if (!Number.isFinite(windowNumber) || !Number.isFinite(windowSize) || windowSize <= 0) continue;
    if ((windowNumber + 1) * windowSize <= nowSeconds) store.delete(key);
  }
}

/** Force hermetic process-local storage for tests. */
export function setRateLimiterTestMode(enabled: boolean): void {
  testMode = enabled;
  if (enabled) {
    TEST_MEMORY_STORE.clear();
    positionalCounters.clear();
  }
}

/** Reset all process-local limiter state between tests. */
export function __resetRateLimitManagerForTests(): void {
  positionalCounters.clear();
  TEST_MEMORY_STORE.clear();
  FALLBACK_MEMORY_STORE.clear();
}

export function cleanupRateLimiters(): void {
  __resetRateLimitManagerForTests();
  keyvStore = null;
}

function ruleWindowKey(keyId: string, rule: RateLimitRule, nowSeconds: number): string {
  return `rl:api_key:${keyId}:${rule.window}:${Math.floor(nowSeconds / rule.window)}`;
}

function validateRules(rules: RateLimitRule[]): RateLimitRule[] {
  return rules.map((rule) => {
    if (!Number.isFinite(rule.limit) || rule.limit < 1 || !Number.isInteger(rule.limit)) {
      throw new TypeError("Rate limit rule limit must be a positive integer");
    }
    if (!Number.isFinite(rule.window) || rule.window < 1 || !Number.isInteger(rule.window)) {
      throw new TypeError("Rate limit rule window must be a positive integer in seconds");
    }
    return rule;
  });
}

function checkInMemoryRateLimit(
  store: Map<string, number>,
  keyId: string,
  rules: RateLimitRule[]
): RateLimitResult {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (store.size > EVICTION_THRESHOLD) evictStaleRateLimitWindows(store, nowSeconds);

  for (const rule of rules) {
    const key = ruleWindowKey(keyId, rule, nowSeconds);
    if ((store.get(key) ?? 0) >= rule.limit) return { allowed: false, failedWindow: rule.window };
  }
  for (const rule of rules) {
    const key = ruleWindowKey(keyId, rule, nowSeconds);
    store.set(key, (store.get(key) ?? 0) + 1);
  }
  return { allowed: true };
}

async function checkKeyvRateLimit(keyId: string, rules: RateLimitRule[]): Promise<RateLimitResult> {
  const previousCheck = keyvCheckTail;
  let releaseCheck: () => void = () => undefined;
  keyvCheckTail = new Promise<void>((resolve) => {
    releaseCheck = resolve;
  });
  await previousCheck;

  try {
    return await checkKeyvRateLimitLocked(keyId, rules);
  } finally {
    releaseCheck();
  }
}

async function checkKeyvRateLimitLocked(
  keyId: string,
  rules: RateLimitRule[]
): Promise<RateLimitResult> {
  const store = getKeyvStore();
  const nowMs = Date.now();
  const nowSeconds = Math.floor(nowMs / 1000);
  const keys = rules.map((rule) => ruleWindowKey(keyId, rule, nowSeconds));

  try {
    const counts = await Promise.all(keys.map((key) => store.get<number>(key)));
    for (let index = 0; index < rules.length; index += 1) {
      if ((counts[index] ?? 0) >= rules[index].limit) {
        return { allowed: false, failedWindow: rules[index].window };
      }
    }
    await Promise.all(
      rules.map((rule, index) => {
        const remainingMs = (Math.floor(nowSeconds / rule.window) + 1) * rule.window * 1000 - nowMs;
        return store.set(keys[index], (counts[index] ?? 0) + 1, remainingMs + 1000);
      })
    );
    return { allowed: true };
  } catch {
    // If persistence becomes unavailable, retain local protection rather than
    // failing open or attempting an implicit Redis connection.
    return checkInMemoryRateLimit(FALLBACK_MEMORY_STORE, keyId, rules);
  }
}

export async function checkRateLimit(
  keyId: string,
  rules: RateLimitRule[]
): Promise<RateLimitResult>;
export async function checkRateLimit(
  keyId: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult>;
export async function checkRateLimit(
  keyId: string,
  rulesOrLimit: RateLimitRule[] | number,
  windowMs?: number
): Promise<RateLimitResult> {
  if (Array.isArray(rulesOrLimit)) return checkRateLimitWithRules(keyId, rulesOrLimit);
  if (!Number.isFinite(rulesOrLimit) || rulesOrLimit < 1 || !Number.isInteger(rulesOrLimit)) {
    throw new TypeError("Rate limit must be a positive integer");
  }
  if (!Number.isFinite(windowMs) || !windowMs || windowMs < 1) {
    throw new TypeError("Rate limit window must be a positive number of milliseconds");
  }

  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetMs = windowStart + windowMs;
  const entryKey = `${keyId}:${windowStart}`;
  const entry = positionalCounters.get(entryKey) ?? { count: 0, windowStart };
  entry.count += 1;
  positionalCounters.set(entryKey, entry);
  return {
    allowed: entry.count <= rulesOrLimit,
    remaining: Math.max(0, rulesOrLimit - entry.count),
    resetMs,
    limit: rulesOrLimit,
  };
}

/**
 * Apply every fixed-window rule to one request.  This preserves the public
 * array contract used by API-key policy and the existing E2E suite.
 */
export async function checkRateLimitWithRules(
  keyId: string,
  suppliedRules: RateLimitRule[]
): Promise<RateLimitResult> {
  const rules = validateRules(suppliedRules);
  if (rules.length === 0) return { allowed: true };
  if (testMode) return checkInMemoryRateLimit(TEST_MEMORY_STORE, keyId, rules);
  if (!isKeyvPersistenceEnabled()) return checkInMemoryRateLimit(FALLBACK_MEMORY_STORE, keyId, rules);
  return checkKeyvRateLimit(keyId, rules);
}

export { checkRateLimitWithRules as checkRateLimitArray };
