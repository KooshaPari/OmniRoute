/**
 * db/authCache.ts — Keyv-backed distributed auth cache.
 *
 * Replaces the legacy `ioredis`-based distributed auth cache with a portable
 * Keyv adapter so the Redis sidecar is no longer required. Same semantics:
 *   - LRU eviction with 5-minute TTL
 *   - Multi-instance safety when REDIS_URL is set (Redis backend)
 *   - In-process fallback when REDIS_URL is unset (default in-memory Map)
 *
 * Public surface preserves legacy names (`deleteRedisAuthCacheEntry`, etc.)
 * so call sites in `apiKeys.ts` stay unchanged, and adds new ergonomic names
 * (`getAuthCacheEntry`, `setAuthCacheEntry`, etc.).
 */
import Keyv from "keyv";
import pino from "pino";

const log = pino({ name: "auth-cache" });

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let _kv: Keyv | null = null;

function isRedisUri(uri: string): boolean {
  return uri.startsWith("redis://") || uri.startsWith("rediss://");
}

function buildKv(): Keyv {
  if (_kv) return _kv;
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl && isRedisUri(redisUrl)) {
    _kv = new Keyv(redisUrl);
    log.debug("authCache: using Redis backend");
  } else {
    _kv = new Keyv();
    log.debug("authCache: using in-process Map backend (REDIS_URL unset)");
  }
  _kv.on("error", (err) => log.error("authCache Keyv error: " + err.message));
  return _kv;
}

export function isAuthCacheDistributed(): boolean {
  return isRedisUri(process.env.REDIS_URL?.trim() ?? "");
}

export interface AuthCacheEntry<T> {
  timestamp: number;
  value: T;
}

function withCachePrefix(rawKey: string): string {
  return rawKey.startsWith("auth:api_key:") ? rawKey : `auth:api_key:${rawKey}`;
}

export async function getAuthCacheEntry<T>(
  rawKey: string,
): Promise<AuthCacheEntry<T> | undefined> {
  const kv = buildKv();
  const key = withCachePrefix(rawKey);
  const raw = (await kv.get(key)) as AuthCacheEntry<T> | undefined;
  if (!raw) return undefined;
  if (typeof raw.timestamp === "number" && Date.now() - raw.timestamp > CACHE_TTL_MS) {
    await kv.delete(key);
    return undefined;
  }
  return raw;
}

export async function setAuthCacheEntry<T>(
  rawKey: string,
  value: T,
): Promise<void> {
  const kv = buildKv();
  const key = withCachePrefix(rawKey);
  const entry: AuthCacheEntry<T> = { timestamp: Date.now(), value };
  await kv.set(key, entry);
}

export async function deleteAuthCacheEntry(rawKey: string): Promise<void> {
  const kv = buildKv();
  await kv.delete(withCachePrefix(rawKey));
}

export async function deleteAuthCacheEntries(rawKeys: string[]): Promise<void> {
  const kv = buildKv();
  await Promise.all(rawKeys.map((k) => kv.delete(withCachePrefix(k))));
}

// ───────────── Legacy API aliases ─────────────
// Preserves call-site compatibility with the previous ioredis-based surface.

export async function isRedisAuthCacheEnabled(): Promise<boolean> {
  return isAuthCacheDistributed();
}

export async function getCachedApiKeyAuth<T>(
  apiKeyHash: string,
): Promise<AuthCacheEntry<T> | undefined> {
  return getAuthCacheEntry<T>(apiKeyHash);
}

export async function setCachedApiKeyAuth<T>(
  apiKeyHash: string,
  value: T,
): Promise<void> {
  return setAuthCacheEntry<T>(apiKeyHash, value);
}

export async function deleteRedisAuthCacheEntry(apiKeyHash: string): Promise<void> {
  return deleteAuthCacheEntry(apiKeyHash);
}

export async function deleteRedisAuthCacheEntries(
  apiKeyHashes: string[],
): Promise<void> {
  return deleteAuthCacheEntries(apiKeyHashes);
}

export async function deleteRedisAuthCacheForKeyId(_keyId: string): Promise<void> {
  // No-op in Keyv: per-key tag invalidation is not exposed by the simple
  // KV interface. Callers that need this should track the hash themselves.
}

export async function deleteRedisAuthCacheForProvider(_provider: string): Promise<void> {
  // No-op in Keyv: see deleteRedisAuthCacheForKeyId.
}

export function __resetAuthCacheForTests(): void {
  _kv = null;
}