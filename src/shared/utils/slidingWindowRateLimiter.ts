export interface SlidingWindowRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
}

export interface SlidingWindowRateLimiterOptions {
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}

interface KeyState {
  timestamps: number[];
  lastAccess: number;
}

/**
 * Dependency-free per-key sliding-window rate limiter.
 *
 * Uses a timestamp log per key: each allowed consume records the event time and
 * requests are allowed while fewer than `limit` timestamps fall within the last
 * `windowMs` milliseconds.
 *
 * Eviction policy when `maxKeys` is exceeded (documented choice): fully-expired
 * keys are evicted first, preferring the key whose window expired longest ago
 * (based on last access). If no fully-expired key exists, the least-recently-used
 * key is evicted. This favors cleanup of stale keys while still bounding memory
 * under active load.
 */
export class SlidingWindowRateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;
  private readonly nowFn: () => number;
  private readonly store = new Map<string, KeyState>();

  constructor(options: SlidingWindowRateLimiterOptions) {
    const { limit, windowMs, maxKeys = 10_000, now = Date.now } = options;

    if (!Number.isFinite(limit) || limit <= 0) {
      throw new Error("limit must be a positive number");
    }
    if (!Number.isFinite(windowMs) || windowMs <= 0) {
      throw new Error("windowMs must be a positive number");
    }
    if (!Number.isFinite(maxKeys) || maxKeys <= 0) {
      throw new Error("maxKeys must be a positive number");
    }

    this.limit = limit;
    this.windowMs = windowMs;
    this.maxKeys = Math.floor(maxKeys);
    this.nowFn = now;
  }

  check(key: string): SlidingWindowRateLimitResult {
    return this.evaluate(key, false);
  }

  consume(key: string): SlidingWindowRateLimitResult {
    return this.evaluate(key, true);
  }

  private evaluate(key: string, shouldConsume: boolean): SlidingWindowRateLimitResult {
    const now = this.nowFn();
    let state = this.store.get(key);

    if (state) {
      this.prune(state, now);
      // Refresh LRU position on access.
      this.store.delete(key);
      this.store.set(key, state);
      state.lastAccess = now;
    } else {
      this.evictIfNeeded(now);
      state = { timestamps: [], lastAccess: now };
      this.store.set(key, state);
    }

    const count = state.timestamps.length;
    const allowed = count < this.limit;

    if (allowed && shouldConsume) {
      state.timestamps.push(now);
    }

    const countAfter = state.timestamps.length;
    const oldest = state.timestamps[0];
    const resetAt = oldest === undefined ? now : oldest + this.windowMs;
    const retryAfterMs = allowed ? 0 : Math.max(0, resetAt - now);

    return {
      allowed,
      remaining: Math.max(0, this.limit - countAfter),
      resetAt,
      retryAfterMs,
    };
  }

  private prune(state: KeyState, now: number): void {
    const cutoff = now - this.windowMs;
    if (state.timestamps.length === 0) return;

    // Timestamps are appended in chronological order.
    let pruneCount = 0;
    while (pruneCount < state.timestamps.length && state.timestamps[pruneCount] <= cutoff) {
      pruneCount++;
    }
    if (pruneCount > 0) {
      state.timestamps.splice(0, pruneCount);
    }
  }

  private evictIfNeeded(now: number): void {
    if (this.store.size < this.maxKeys) return;

    let oldestExpiredKey: string | undefined;
    let oldestExpiredAccess = Infinity;

    for (const [key, state] of this.store.entries()) {
      this.prune(state, now);
      if (state.timestamps.length === 0) {
        if (state.lastAccess < oldestExpiredAccess) {
          oldestExpiredAccess = state.lastAccess;
          oldestExpiredKey = key;
        }
      }
    }

    if (oldestExpiredKey !== undefined) {
      this.store.delete(oldestExpiredKey);
      return;
    }

    if (this.store.size < this.maxKeys) return;

    // No fully-expired key found: evict least-recently-used (oldest Map entry).
    const lruKey = this.store.keys().next().value as string | undefined;
    if (lruKey !== undefined) {
      this.store.delete(lruKey);
    }
  }
}

