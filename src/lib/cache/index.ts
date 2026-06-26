/**
 * Cache module barrel — PR-036 Multi-tier LRU Cache
 *
 * @module lib/cache
 */

export { MultiTierCache, getMultiTierCache, resetMultiTierCache } from "./multiTier";
export type { CacheHit, CacheWriteOptions, CacheStats } from "./multiTier";

export { MemoryTier } from "./tiers/memory";
export { SqliteTier } from "./tiers/sqlite";
export { DiskTier } from "./tiers/disk";

export { generateCacheKey, keyPrefix, keyHash } from "./normalise";
export type { NormaliseParams } from "./normalise";

export {
  stampedeGuard,
  isInflight,
  inflightCount,
  clearInflight,
} from "./cacheStampede";
export type { StampedeOptions, StampedeGenerator } from "./cacheStampede";
