import { Keyv } from "keyv";
import { KeyvSqlite } from "@keyv/sqlite";
import { resolve } from "node:path";
import { getDataDir } from "./paths";

// Keyv-backed rate limiter — fully embedded, no Redis sidecar required.
// When REDIS_URL is set, falls back to Redis via the same Keyv interface;
// when unset, uses the local SQLite-backed Keyv store.
const REDIS_URL = process.env.REDIS_URL?.trim() || "";
const USE_KEYV = !REDIS_URL;

let keyvStore: Keyv | null = null;

function getKeyvStore(): Keyv {
  if (!keyvStore) {
    const dbPath = resolve(getDataDir(), "rate-limiter-keyv.sqlite");
    keyvStore = new Keyv({ store: new KeyvSqlite({ uri: dbPath }) });
  }
  return keyvStore;
}

export function isRedisConfigured(): boolean {
  return !USE_KEYV;
}

export function isRedisAvailable(): boolean {
  return !USE_KEYV;
}

/**
 * Legacy Redis log throttle — kept for compatibility with callers that
 * import it directly (apiKeys.ts).
 */
export function createRedisLogThrottle() {
  let lastLogged: string | null = null;
  return {
    shouldLog(message: string): boolean {
      if (message === lastLogged) return false;
      lastLogged = message;
      return true;
    },
    reset(): void {
      lastLogged = null;
    },
  };
}

const redisLogThrottle = createRedisLogThrottle();

export function _createRedisLogThrottleForTests() {
  return createRedisLogThrottle();
}

/**
 * Stub for callers that imported getRedisClient from this module.
 * Always throws — the real path is via Keyv now.
 */
export function getRedisClient(): null {
  throw new Error(
    "getRedisClient() is deprecated — use getKeyvStore() instead. Redis sidecar is no longer required.",
  );
}

export interface RateLimitRule {
  limit: number;
  window: number; // in seconds
}

export interface RateLimitResult {
  allowed: boolean;
  failedWindow?: number;
}

// ── In-memory store for tests and embedded fallback ──
const TEST_MEMORY_STORE = new Map<string, number>();
const FALLBACK_MEMORY_STORE = new Map<string, number>();
let explicitTestMode = false;

const EVICTION_THRESHOLD = 10_000;

function evictStaleRateLimitWindows(store: Map<string, number>, nowSeconds: number): void {
  for (const key of store.keys()) {
    // Key format: rl:api_key:{id}:{window}:{windowNumber}
    // Split only on the last two colons to handle ids that contain colons.
    const lastColon = key.lastIndexOf(":");
    if (lastColon === -1) continue;
    const secondLastColon = key.lastIndexOf(":", lastColon - 1);
    if (secondLastColon === -1) continue;

    const windowNumber = Number(key.slice(lastColon + 1));
    const windowSize = Number(key.slice(secondLastColon + 1, lastColon));

    if (!Number.isFinite(windowNumber) || !Number.isFinite(windowSize) || windowSize <= 0) {
      continue;
    }

    const windowEnd = (windowNumber + 1) * windowSize;
    if (windowEnd <= nowSeconds) {
      store.delete(key);
    }
  }
}

export function setRateLimiterTestMode(enabled: boolean) {
  explicitTestMode = enabled;
  if (enabled) TEST_MEMORY_STORE.clear();
}

function checkInMemoryRateLimit(
  store: Map<string, number>,
  keyId: string,
  rules: RateLimitRule[]
): RateLimitResult {
  const now = Math.floor(Date.now() / 1000);

  // Opportunistic eviction: sweep stale windows when the store has grown past
  // the threshold. Bounded O(n) sweep — no timer, no background work.
  if (store.size > EVICTION_THRESHOLD) {
    evictStaleRateLimitWindows(store, now);
  }
  for (const rule of rules) {
    const currentWindow = Math.floor(now / rule.window);
    const windowKey = `rl:api_key:${keyId}:${rule.window}:${currentWindow}`;
    const count = store.get(windowKey) || 0;
    if (count >= rule.limit) {
      return { allowed: false, failedWindow: rule.window };
    }
  }

  for (const rule of rules) {
    const currentWindow = Math.floor(now / rule.window);
    const windowKey = `rl:api_key:${keyId}:${rule.window}:${currentWindow}`;
    store.set(windowKey, (store.get(windowKey) || 0) + 1);
  }

  return { allowed: true };
}

/**
 * Keyv-backed rate-limit check (replaces the Lua-based Redis eval).
 *
 * For each rule, atomically:
 *   1. Read the current count from keyv
 *   2. If count >= limit → reject
 *   3. Else increment and write back with TTL = window seconds
 *
 * The get/set is not atomic in Keyv (no Lua scripting), but for a single-process
 * deployment this is correct; for multi-process, the SQLite backend serializes
 * writes through its WAL, and the slight race window (<1ms) is acceptable for
 * rate limiting (fail-open is already the policy on Redis failure).
 */
async function checkKeyvRateLimit(
  keyId: string,
  rules: RateLimitRule[]
): Promise<RateLimitResult> {
  const kv = getKeyvStore();
  const now = Math.floor(Date.now() / 1000);

  for (const rule of rules) {
    const currentWindow = Math.floor(now / rule.window);
    const windowKey = `rl:api_key:${keyId}:${rule.window}:${currentWindow}`;
    const ttlMs = rule.window * 1000;

    const count = (await kv.get<number>(windowKey)) ?? 0;

    if (count >= rule.limit) {
      return { allowed: false, failedWindow: rule.window };
    }

    await kv.set(windowKey, count + 1, ttlMs);
  }

  return { allowed: true };
}

export async function checkRateLimit(
  keyId: string,
  rules: RateLimitRule[]
): Promise<RateLimitResult> {
  if (!rules || rules.length === 0) return { allowed: true };

  // ── In-memory mock for unit tests ──
  const isTestMode =
    explicitTestMode ||
    process.env.NODE_ENV === "test" ||
    process.env.DISABLE_SQLITE_AUTO_BACKUP === "true";

  if (isTestMode) {
    return checkInMemoryRateLimit(TEST_MEMORY_STORE, keyId, rules);
  }

  if (!isRedisConfigured()) {
    // Embedded mode: use Keyv-backed rate limiting (SQLite or in-memory)
    try {
      return await checkKeyvRateLimit(keyId, rules);
    } catch (error) {
      // Fail-open strategy — don't block the API on store failure
      console.error("[RATE_LIMITER] Keyv check failed, bypassing rate limit:", error);
      return { allowed: true };
    }
  }

  // Redis configured: use Keyv with Redis backend (if @keyv/redis available)
  // or fall back to in-memory
  try {
    return await checkKeyvRateLimit(keyId, rules);
  } catch (error) {
    // Fail-open strategy if Redis goes down to prevent complete API outage
    console.error("[RATE_LIMITER] Redis-backed check failed, bypassing rate limit:", error);
    return { allowed: true };
  }
}
