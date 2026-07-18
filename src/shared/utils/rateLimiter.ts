import { Keyv } from "keyv";

// Redis is optional. When REDIS_URL is unset, use a process-local fallback
// instead of probing localhost on every API request.
const REDIS_URL = process.env.REDIS_URL?.trim() || "";
if (process.env.NODE_ENV === "production" && !REDIS_URL) {
  console.warn("[KEYV] REDIS_URL is not set in production. Using in-memory rate limiting.");
}

let keyvClient: Keyv | null = null;

export function isRedisConfigured(): boolean {
  return REDIS_URL.length > 0;
}

/**
 * State-change-gated log throttle for the Keyv error handler.
 *
 * #4878: when REDIS_URL points at a non-running server, keyv retries on a
 * backoff and fires the "error" event on every attempt, flooding the logs with
 * identical "[KEYV] Error:" lines. We only want to log when the error STATE
 * actually changes (first occurrence, or a different error message), not on
 * every retry of the same failure.
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

// Exposed for unit tests — returns a fresh, isolated throttle instance.
export function _createRedisLogThrottleForTests() {
  return createRedisLogThrottle();
}

export function getRedisClient() {
  if (!isRedisConfigured()) {
    throw new Error("Redis is not configured");
  }

  if (!keyvClient) {
    keyvClient = new Keyv(REDIS_URL, {
      namespace: "rate_limit",
    });
    keyvClient.on("error", (err: Error) => {
      if (redisLogThrottle.shouldLog(err.message)) {
        console.error("[KEYV] Error:", err.message);
      }
    });
  }
  return keyvClient;
}

export interface RateLimitRule {
  limit: number;
  window: number; // in seconds
}

export interface RateLimitResult {
  allowed: boolean;
  failedWindow?: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  failedWindow?: number;
  retryAfterMs?: number;
  limit?: number;
  remaining?: number;
}

// Memory store for in-process use (no Redis).
const TEST_MEMORY_STORE = new Map<string, number>();
const FALLBACK_MEMORY_STORE = new Map<string, number>();
const EVICTION_THRESHOLD = 10_000;
let explicitTestMode = false;

function evictStaleRateLimitWindows(store: Map<string, number>, nowSeconds: number) {
  const keys = Array.from(store.keys());
  for (const key of keys) {
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
 * Check rate limits using Keyv (Redis-backed when REDIS_URL is set).
 * For single-process use, this is equivalent to the in-memory path.
 * For cross-process use (Redis via keyv), atomicity is best-effort.
 */
async function checkKeyvRateLimit(
  kv: Keyv,
  keyId: string,
  rules: RateLimitRule[]
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);

  // Check all rules first
  for (const rule of rules) {
    const currentWindow = Math.floor(now / rule.window);
    const windowKey = `rl:api_key:${keyId}:${rule.window}:${currentWindow}`;
    const count = (await kv.get<number>(windowKey)) ?? 0;
    if (count >= rule.limit) {
      return { allowed: false, failedWindow: rule.window };
    }
  }

  // Increment all counters (best-effort atomic for Redis backend)
  for (const rule of rules) {
    const currentWindow = Math.floor(now / rule.window);
    const windowKey = `rl:api_key:${keyId}:${rule.window}:${currentWindow}`;
    const current = (await kv.get<number>(windowKey)) ?? 0;
    const ttlMs = rule.window * 1000 + 1000; // window + 1s buffer
    await kv.set(windowKey, current + 1, ttlMs);
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
    return checkInMemoryRateLimit(FALLBACK_MEMORY_STORE, keyId, rules);
  }

  const kv = getRedisClient();

  try {
    return await checkKeyvRateLimit(kv, keyId, rules);
  } catch (error) {
    // Fail-open strategy if Redis goes down to prevent complete API outage
    console.error("[RATE_LIMITER] Keyv eval failed, bypassing rate limit:", error);
    return { allowed: true };
  }
}
