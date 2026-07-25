/**
 * db/apiKeyCache.ts — in-memory + Redis auth-cache layer for API-key lookups.
 *
 * Extracted from db/apiKeys.ts (god-file decomposition). This module owns:
 *   - The per-process LRU Maps that hot-cache `validateApiKey()`,
 *     `getApiKeyMetadata()`, and `isModelAllowedForKey()` results so a request
 *     storm against a popular key never re-hits SQLite on every call.
 *   - The Redis-backed auth cache (`auth:api_key:<hash>`) that gives
 *     multi-instance deployments a shared cache layer so a key banned on
 *     instance A is rejected by instance B within seconds instead of within
 *     the in-process TTL.
 *   - The `markApiKeyUsed()` bookkeeping that throttles `last_used_at`
 *     updates to at most one write every 5 minutes per key id.
 *   - The `evictIfNeeded()` LRU eviction policy and its `MAX_CACHE_SIZE`
 *     cap, so a runaway keyspace cannot grow the in-memory caches
 *     unbounded.
 *
 * Why a separate file:
 *   - Pure logic (TTL math, LRU eviction, env-flag gating) is the most
 *     testable subset of `apiKeys.ts`. Pulling it out lets unit tests
 *     exercise the cache primitives without booting SQLite, a real DB
 *     instance, or Redis.
 *   - The module is self-contained: it does not import from `apiKeys.ts`,
 *     and the host module only consumes the accessors by name. No circular
 *     import risk.
 *
 * Behavior-preserving move: every constant, function body, and Redis key
 * string is byte-identical to its origin in `db/apiKeys.ts` (god-file
 * decomposition, PR-extracted). The host module imports the named exports
 * it needs and keeps the `clearApiKeyCaches()` symbol as a re-export so
 * all 41+ existing consumers (including the test suite and `localDb.ts`)
 * continue to work unchanged.
 */

import type { ApiKeyMetadata } from "./apiKeys/types";

// ──────────────── TTL & size constants ────────────────

/**
 * TTL applied to the in-memory validation/metadata/model-permission caches.
 * One minute — short enough that a stale "valid=true" entry cannot keep a
 * banned/revoked/expired key alive for long, long enough to absorb a single
 * user's request burst without re-querying SQLite.
 */
export const CACHE_TTL = 60 * 1000;

/**
 * TTL applied to the per-key `_lastUsedUpdateCache`. Throttles
 * `last_used_at` writes so a high-traffic key triggers at most one UPDATE
 * per 5 minutes.
 */
export const LAST_USED_UPDATE_TTL = 5 * 60 * 1000;

/**
 * Hard cap on the size of every in-memory cache managed by this module.
 * When a cache exceeds this, `evictIfNeeded()` drops the oldest 20% of
 * entries (insertion order — Map guarantees that).
 */
export const MAX_CACHE_SIZE = 1000;

// ──────────────── Cache primitives ────────────────

interface ValidationCacheEntry {
  valid: boolean;
  timestamp: number;
}

interface ModelPermissionCacheEntry {
  allowed: boolean;
  timestamp: number;
}

/**
 * LRU cache for the boolean result of `validateApiKey()`. The Map's
 * insertion order is the eviction order (no recent-GET re-ordering — see
 * `evictIfNeeded`).
 */
const _keyValidationCache = new Map<string, ValidationCacheEntry>();

/**
 * LRU cache for `getApiKeyMetadata()` results keyed by the API-key hash.
 * The `CacheEntry<TValue>` shape wraps the typed metadata value with a
 * timestamp so the host module can detect a TTL miss.
 */
const _keyMetadataCache = new Map<string, { timestamp: number; value: ApiKeyMetadata }>();

/**
 * LRU cache for `isModelAllowedForKey()` results keyed by
 * `${apiKey}:${modelId}`. The `(apiKey)` slot uses the raw key (not the
 * hash) because the permission-check is also a function of the key's
 * metadata — keyed the same way the host module keys it.
 */
const _modelPermissionCache = new Map<string, ModelPermissionCacheEntry>();

/**
 * Throttle map for `markApiKeyUsed()`: maps an API-key id to the
 * millisecond timestamp of the last `last_used_at` UPDATE. A second
 * UPDATE inside `LAST_USED_UPDATE_TTL` is skipped.
 */
const _lastUsedUpdateCache = new Map<string, number>();

// ──────────────── Accessors ────────────────

/** Read the cached validation result, if any. */
export function getValidationCache(
  key: string
): { valid: boolean; timestamp: number } | undefined {
  return _keyValidationCache.get(key);
}

/** Insert/overwrite a validation result; runs `evictIfNeeded` first. */
export function setValidationCache(key: string, value: ValidationCacheEntry): void {
  evictIfNeeded(_keyValidationCache);
  _keyValidationCache.set(key, value);
}

/** Read the cached metadata record, if any. */
export function getMetadataCache(key: string): { timestamp: number; value: ApiKeyMetadata } | undefined {
  return _keyMetadataCache.get(key);
}

/** Insert/overwrite a metadata record; runs `evictIfNeeded` first. */
export function setMetadataCache(key: string, value: ApiKeyMetadata, timestamp: number): void {
  evictIfNeeded(_keyMetadataCache);
  _keyMetadataCache.set(key, { timestamp, value });
}

/** Read the cached model-permission decision, if any. */
export function getModelPermissionCache(
  key: string
): { allowed: boolean; timestamp: number } | undefined {
  return _modelPermissionCache.get(key);
}

/** Insert/overwrite a model-permission decision; runs `evictIfNeeded` first. */
export function setModelPermissionCache(key: string, value: ModelPermissionCacheEntry): void {
  evictIfNeeded(_modelPermissionCache);
  _modelPermissionCache.set(key, value);
}

// ──────────────── LRU eviction ────────────────

/**
 * Drop the oldest `floor(MAX_CACHE_SIZE * 0.2)` entries from `cache` once
 * it exceeds `MAX_CACHE_SIZE`. Insertion order is the eviction order
 * because Map preserves insertion order and we never re-insert on read.
 *
 * Exposed (not internal) so unit tests can verify the eviction policy
 * against a stubbed Map without booting the full module graph.
 */
export function evictIfNeeded<TKey, TValue>(cache: Map<TKey, TValue>): void {
  if (cache.size > MAX_CACHE_SIZE) {
    // Remove oldest 20% of entries
    const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
    let i = 0;
    for (const key of cache.keys()) {
      if (i++ >= entriesToRemove) break;
      cache.delete(key);
    }
  }
}

// ──────────────── Private reset ────────────────

/**
 * Wipe every in-memory cache except `_lastUsedUpdateCache` (which is
 * reset by `clearApiKeyCaches()` below). Called from every CRUD path
 * that mutates the `api_keys` table so the next read sees fresh data.
 */
function invalidateCaches(): void {
  _keyValidationCache.clear();
  _keyMetadataCache.clear();
  _modelPermissionCache.clear();
}

/**
 * Public cache reset for tests/debugging. Wipes every cache owned by this
 * module — the validation/metadata/model-permission caches AND the
 * `last_used_at` throttle map. Re-exported from `db/apiKeys.ts` so the
 * 40+ test sites that call `clearApiKeyCaches()` continue to work.
 */
export function clearApiKeyCaches(): void {
  invalidateCaches();
  _lastUsedUpdateCache.clear();
}

// ──────────────── `last_used_at` throttle ────────────────

/**
 * Throttle bookkeeping: writes `last_used_at = NOW` to `api_keys` for the
 * given key id, but skips the UPDATE if the previous UPDATE was within
 * `LAST_USED_UPDATE_TTL`. Idempotent under a request burst.
 *
 * `db` and `id` are untyped on purpose — the host module passes the
 * `ApiKeysDbLike` it already has, and we don't want this leaf to import
 * the DB type chain.
 */
export function markApiKeyUsed(
  db: { prepare: (sql: string) => { run: (...params: unknown[]) => unknown } },
  id: unknown,
  now: number
): void {
  if (typeof id !== "string" || id.trim() === "") return;

  const lastUpdate = _lastUsedUpdateCache.get(id);
  if (lastUpdate && now - lastUpdate < LAST_USED_UPDATE_TTL) return;

  db.prepare("UPDATE api_keys SET last_used_at = @lastUsedAt WHERE id = @id").run({
    id,
    lastUsedAt: new Date(now).toISOString(),
  });
  _lastUsedUpdateCache.set(id, now);
}

// ──────────────── Redis auth-cache helpers ────────────────
//
// `auth:api_key:<hash>` is a tiny side-channel cache that lets every
// OmniRoute instance in a fleet agree on the lifecycle state of a key
// (active/ban/revoked/expires) within seconds instead of waiting for the
// per-process `CACHE_TTL` to expire on each replica. SQLite remains
// authoritative — Redis is purely an optimization and every code path
// falls through to SQLite on any Redis failure.

/**
 * Whether the Redis auth-cache should be consulted for the current
 * process. Disabled when:
 *   - `OMNIROUTE_DISABLE_REDIS_AUTH_CACHE=1` (operator opt-out),
 *   - `NODE_ENV=test` (unit tests run with a stub Redis client; we
 *     want zero Redis traffic from the auth cache during `node --test`),
 *   - `DISABLE_SQLITE_AUTO_BACKUP=true` (CI / e2e marker — the same env
 *     flag the rest of the test bootstrap uses to skip backup writes).
 */
export function isRedisAuthCacheEnabled(): boolean {
  return (
    process.env.OMNIROUTE_DISABLE_REDIS_AUTH_CACHE !== "1" &&
    process.env.NODE_ENV !== "test" &&
    process.env.DISABLE_SQLITE_AUTO_BACKUP !== "true"
  );
}

/**
 * The Redis key under which we store the cached auth decision for a
 * given API-key hash. Exported so tests can assert the key shape.
 */
export const REDIS_AUTH_CACHE_PREFIX = "auth:api_key:";

/**
 * Compose a full Redis key for `auth:api_key:<hash>`. Centralised here so
 * the read path (validate) and the write path (validate-on-success) never
 * drift.
 */
function redisAuthCacheKey(keyHash: string): string {
  return `${REDIS_AUTH_CACHE_PREFIX}${keyHash}`;
}

/**
 * Drop the Redis auth-cache entry for `keyHash`. No-op if the hash is
 * blank, Redis is disabled, or Redis is unreachable — Redis is an
 * optimization, SQLite is authoritative.
 */
export async function deleteRedisAuthCacheEntry(keyHash: unknown): Promise<void> {
  if (!isRedisAuthCacheEnabled() || typeof keyHash !== "string" || keyHash.trim() === "") return;

  try {
    const { getRedisClient, isRedisConfigured } = await import("@/shared/utils/rateLimiter");
    if (!isRedisConfigured()) return;
    const redis = getRedisClient();
    await redis.del(redisAuthCacheKey(keyHash));
  } catch {
    // Redis is an optimization for auth caching; SQLite remains authoritative.
  }
}

/**
 * Drop N Redis auth-cache entries in parallel. Convenience wrapper used
 * by `regenerateApiKey()` which must invalidate both the old hash AND
 * the new hash.
 */
export async function deleteRedisAuthCacheEntries(...keyHashes: unknown[]): Promise<void> {
  await Promise.all(keyHashes.map((keyHash) => deleteRedisAuthCacheEntry(keyHash)));
}

/**
 * Look up the `key_hash` column for `id` and drop its Redis auth-cache
 * entry. Used by every CRUD path that mutates a key (update / revoke /
 * expiry) — the cache key is the hash, not the row id, so we have to
 * round-trip through SQLite first.
 */
export async function deleteRedisAuthCacheForKeyId(
  db: {
    prepare: <TRow = unknown>(sql: string) => {
      get: (...params: unknown[]) => TRow | undefined;
    };
  },
  id: string
): Promise<void> {
  if (!isRedisAuthCacheEnabled()) return;

  const row = db
    .prepare<{ key_hash: string | null }>("SELECT key_hash FROM api_keys WHERE id = ?")
    .get(id);
  await deleteRedisAuthCacheEntry(row?.key_hash);
}

// ──────────────── Redis-backed validation cache read/write ────────────────
//
// These two helpers are kept here (not in `apiKeys.ts`) because they
// embody the Redis-side of the cache contract. They are consumed
// exclusively by `validateApiKey()`; the host module imports them by
// name and forwards the call. Keeping them encapsulated here means a
// future migration to `keyv` (or any other Redis-shaped backend) is a
// single-file change.

interface RedisCachedAuthRecord {
  id?: unknown;
  isBanned?: unknown;
  isActive?: unknown;
  revokedAt?: unknown;
  expiresAt?: unknown;
}

interface RedisAuthDecision {
  id: unknown;
  isBanned: boolean;
  isActive: boolean;
  revokedAt: string | null;
  expiresAt: string | null;
}

/**
 * TTL applied to a freshly-written Redis auth-cache entry (1 hour).
 * Longer than the in-process `CACHE_TTL` because Redis evictions are
 * cluster-wide and a fleet of N instances all re-validating at once
 * would stampede SQLite.
 */
export const REDIS_AUTH_CACHE_TTL_SECONDS = 3600;

/**
 * Read the Redis auth-cache entry for `keyHash`. Returns the parsed
 * decision object on hit, or `null` on miss / Redis-disabled / any
 * Redis failure (Redis is an optimization — never block on it).
 */
export async function readRedisAuthCache(keyHash: string): Promise<RedisAuthDecision | null> {
  if (!isRedisAuthCacheEnabled()) return null;

  try {
    const { getRedisClient, isRedisConfigured } = await import("@/shared/utils/rateLimiter");
    if (!isRedisConfigured()) return null;
    const redis = getRedisClient();
    const raw = await redis.get(redisAuthCacheKey(keyHash));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RedisCachedAuthRecord;
    return {
      id: parsed.id,
      isBanned: parsed.isBanned === true || parsed.isBanned === 1,
      isActive: parsed.isActive === true || parsed.isActive === 1,
      revokedAt:
        typeof parsed.revokedAt === "string" && parsed.revokedAt.trim() !== ""
          ? parsed.revokedAt
          : null,
      expiresAt:
        typeof parsed.expiresAt === "string" && parsed.expiresAt.trim() !== ""
          ? parsed.expiresAt
          : null,
    };
  } catch {
    return null;
  }
}

/**
 * Write a fresh Redis auth-cache entry for `keyHash` with a 1-hour TTL.
 * No-op when Redis is disabled or unreachable.
 */
export async function writeRedisAuthCache(
  keyHash: string,
  decision: RedisAuthDecision
): Promise<void> {
  if (!isRedisAuthCacheEnabled()) return;

  try {
    const { getRedisClient, isRedisConfigured } = await import("@/shared/utils/rateLimiter");
    if (!isRedisConfigured()) return;
    const redis = getRedisClient();
    await redis.set(
      redisAuthCacheKey(keyHash),
      JSON.stringify(decision),
      "EX",
      REDIS_AUTH_CACHE_TTL_SECONDS
    );
  } catch {
    // Redis cache update failures do not block successful SQLite validation.
  }
}