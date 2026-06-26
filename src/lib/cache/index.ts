/**
 * Cache module barrel — PR-037
 *
 * Re-exports all public API from the cache subsystem.
 */
export { deriveCacheKey, hashPrompt, parseCacheKeyPrefix } from "./normalise";
export type { CacheKeyParams } from "./normalise";
export {
  keyFromBody,
  isCacheableRequest,
  isCacheableResponse,
  getCachedResponse,
  setCachedResponse,
  cleanExpiredEntries,
  invalidateByModel,
  invalidateByKey,
  clearCache,
  getCacheStats,
} from "./queryResponseCache";
export type { CachedResponse, CacheStoreOptions } from "./queryResponseCache";
