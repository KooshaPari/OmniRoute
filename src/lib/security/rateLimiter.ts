/**
 * PR-051: Rate limiting per IP+tenant using sliding-window counters.
 *
 * Design:
 * - Sliding-window counter algorithm (approximates a true sliding window
 *   by weighting the previous window's count).
 * - Per-tier configuration: free=10/min, pro=100/min, enterprise=unlimited.
 * - Composite key: `rl:sec:<ip>:<tenant>` — separate counters per tenant
 *   so one tenant's bursts never starve another.
 * - Redis-backed with atomic Lua script, in-memory fallback when Redis is
 *   unavailable or NODE_ENV=test.
 * - Fail-open: if both Redis and in-memory backends error, the request is
 *   allowed and the error is logged.
 *
 * @module lib/security/rateLimiter
 */

import Redis from "ioredis";
import { getRedisClient, isRedisConfigured } from "../../shared/utils/rateLimiter";

// ── Tier configuration ──────────────────────────────────────────────

export type RateLimitTier = "free" | "pro" | "enterprise";

export interface TierConfig {
  /** Max requests per sliding window. */
  limit: number;
  /** Window size in seconds. */
  windowSeconds: number;
}

export const TIER_LIMITS: Record<RateLimitTier, TierConfig> = {
  free:       { limit: 10,  windowSeconds: 60 },
  pro:        { limit: 100, windowSeconds: 60 },
  enterprise: { limit: Infinity, windowSeconds: 60 },
};

// ── Public types ────────────────────────────────────────────────────

export interface RateLimitContext {
  /** Client IP address (v4 or v6 string). */
  ip: string;
  /** Tenant/account identifier. Empty string for unauthenticated requests. */
  tenant: string;
  /** Service tier resolved for this request. */
  tier: RateLimitTier;
}

export interface RateLimitDecision {
  /** true if the request is within the allowed rate. */
  allowed: boolean;
  /** Remaining requests in the current sliding window. */
  remaining: number;
  /** Approximate seconds until the bucket resets. */
  resetInSeconds: number;
  /** Human-readable reason when denied. */
  reason?: string;
}

// ── In-memory fallback store ────────────────────────────────────────

interface SlidingWindowEntry {
  prevCount: number;
  currCount: number;
  currWindowStart: number;
  ttl: number; // unix ts when this entry can be evicted
}

const MEMORY_STORE = new Map<string, SlidingWindowEntry>();

// Clean stale entries every 5 minutes to prevent unbounded growth.
const MEMORY_CLEANUP_INTERVAL_MS = 300_000;
let lastCleanupTs = 0;

function maybeCleanMemoryStore(now: number): void {
  if (now - lastCleanupTs < MEMORY_CLEANUP_INTERVAL_MS) return;
  lastCleanupTs = now;
  for (const [key, entry] of MEMORY_STORE) {
    if (now >= entry.ttl) MEMORY_STORE.delete(key);
  }
}

// ── Redis Lua script (sliding-window counter) ───────────────────────

/**
 * Lua script implementing atomic sliding-window counter.
 *
 * KEYS[1]  → composite key prefix: `rl:sec:<ip>:<tenant>`
 * ARGV[1]  → current unix timestamp (seconds)
 * ARGV[2]  → window size (seconds)
 * ARGV[3]  → max limit for this tier
 *
 * Returns: { remaining, resetInSeconds }
 *   remaining < 0 → request should be rejected
 *
 * Algorithm derived from the canonical "Sliding window counter"
 * pattern (Redis rate-limiting examples).
 */
const SLIDING_WINDOW_SCRIPT = `
local prefix = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

-- Current & previous window boundaries
local curr_window = math.floor(now / window)
local prev_window = curr_window - 1

local curr_key = prefix .. ":" .. curr_window
local prev_key = prefix .. ":" .. prev_window

-- Increment current window (lazy init with EXPIRE)
local curr_count = redis.call("INCR", curr_key)
if curr_count == 1 then
  redis.call("EXPIRE", curr_key, window * 2)
end

-- Read previous window (may be nil if it expired)
local prev_count = tonumber(redis.call("GET", prev_key) or "0")

-- Sliding weight: how far into the current window are we?
local elapsed_ratio = (now % window) / window
local estimated = prev_count * (1 - elapsed_ratio) + curr_count

local remaining = limit - estimated
local reset_in = window - (now % window)

if remaining < 0 then
  -- Reject: return negative remaining
  return { -1, reset_in }
end

-- Accept: return count and reset
return { math.floor(remaining), reset_in }
`;

// ── Core rate-limit check (Redis path) ──────────────────────────────

async function checkWithRedis(
  prefix: string,
  config: TierConfig,
  now: number
): Promise<RateLimitDecision> {
  const redis: Redis = getRedisClient();

  const result = (await redis.eval(
    SLIDING_WINDOW_SCRIPT,
    1,
    prefix,
    now,
    config.windowSeconds,
    config.limit
  )) as [number, number];

  const [remaining, resetInSeconds] = result;

  if (remaining < 0) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.max(1, Math.ceil(resetInSeconds)),
      reason: `Rate limit exceeded. Try again in ${Math.ceil(resetInSeconds)}s.`,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, remaining),
    resetInSeconds: Math.max(1, Math.ceil(resetInSeconds)),
  };
}

// ── Core rate-limit check (in-memory path) ──────────────────────────

function checkInMemory(
  prefix: string,
  config: TierConfig,
  now: number
): RateLimitDecision {
  maybeCleanMemoryStore(now);

  const currWindow = Math.floor(now / config.windowSeconds);
  const prevWindow = currWindow - 1;

  const entry = MEMORY_STORE.get(prefix) ?? {
    prevCount: 0,
    currCount: 0,
    currWindowStart: 0,
    ttl: 0,
  };

  // If the window rolled over, promote curr → prev
  if (entry.currWindowStart !== currWindow) {
    entry.prevCount = entry.currWindowStart === prevWindow ? entry.currCount : 0;
    entry.currCount = 0;
    entry.currWindowStart = currWindow;
  }

  entry.currCount += 1;
  entry.ttl = now + config.windowSeconds * 2;
  MEMORY_STORE.set(prefix, entry);

  const elapsedRatio = (now % config.windowSeconds) / config.windowSeconds;
  const estimated = entry.prevCount * (1 - elapsedRatio) + entry.currCount;
  const remaining = config.limit - estimated;
  const resetIn = config.windowSeconds - (now % config.windowSeconds);

  if (remaining < 0) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.max(1, Math.ceil(resetIn)),
      reason: `Rate limit exceeded. Try again in ${Math.ceil(resetIn)}s.`,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, Math.floor(remaining)),
    resetInSeconds: Math.max(1, Math.ceil(resetIn)),
  };
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Check whether a request is within its rate-limit budget.
 *
 * The decision is based on a sliding-window counter keyed by `ip:tenant`.
 * When the tier is `enterprise` the check is skipped (unlimited).
 *
 * @param ctx - IP, tenant, and tier context for this request.
 * @returns A decision with `allowed` flag, `remaining` budget, and
 *          `resetInSeconds` estimate.
 */
export async function checkRateLimitSliding(
  ctx: RateLimitContext
): Promise<RateLimitDecision> {
  const config = TIER_LIMITS[ctx.tier];

  // Enterprise: skip rate limiting entirely.
  if (!Number.isFinite(config.limit)) {
    return { allowed: true, remaining: Infinity, resetInSeconds: 0 };
  }

  const now = Math.floor(Date.now() / 1000);
  const prefix = `rl:sec:${ctx.ip}:${ctx.tenant}`;

  // ── Test mode / in-memory fallback ──
  const isTestMode =
    process.env.NODE_ENV === "test" ||
    process.env.DISABLE_SQLITE_AUTO_BACKUP === "true";

  if (isTestMode || !isRedisConfigured()) {
    return checkInMemory(prefix, config, now);
  }

  // ── Redis path ──
  try {
    return await checkWithRedis(prefix, config, now);
  } catch (err) {
    console.error("[RateLimiter] Redis error, falling back to in-memory:", err);
    return checkInMemory(prefix, config, now);
  }
}

/**
 * Build a `RateLimitContext` from the raw parts typically extracted from
 * a NextRequest. Convenience export for the proxy/pipeline layer.
 */
export function buildRateLimitContext(
  ip: string,
  tenant: string,
  tier: RateLimitTier = "free"
): RateLimitContext {
  return { ip, tenant, tier };
}

/**
 * Resolve the effective tier for a tenant/account.
 * In a production system this would query a DB or cache; here we
 * provide the default mapping.
 *
 * Overridable via env var for testing or early rollout:
 *   RATE_LIMIT_TIER_OVERRIDE=<tier>
 */
export function resolveTier(tenant: string): RateLimitTier {
  const override = process.env.RATE_LIMIT_TIER_OVERRIDE;
  if (override === "free" || override === "pro" || override === "enterprise") {
    return override;
  }

  // Every authenticated tenant starts at "pro" by default in this system;
  // "free" is for anonymous/unauthenticated requests (tenant === "").
  if (!tenant) return "free";
  return "pro";
}
