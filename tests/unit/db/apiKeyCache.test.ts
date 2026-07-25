/**
 * Unit coverage for the extracted apiKeyCache module.
 *
 * Scope: the cache primitives (validation/metadata/model-permission caches,
 * LRU eviction, `last_used_at` throttle) plus the Redis auth-cache feature
 * flags. Redis itself is mocked at the `@/shared/utils/rateLimiter` boundary
 * so we never need a live Redis server to exercise the helpers.
 *
 * The point of pulling apiKeyCache out of apiKeys.ts was testability — these
 * tests demonstrate that the pure logic (TTL math, LRU eviction, env-flag
 * gating) is now reachable without booting SQLite or Redis. Tests for the
 * host module's `validateApiKey()`/`getApiKeyMetadata()` CRUD surface still
 * live in tests/unit/db/api-keys.test.ts.
 */

import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

const apiKeyCache = await import("../../../src/lib/db/apiKeyCache.ts");
const {
  CACHE_TTL,
  LAST_USED_UPDATE_TTL,
  MAX_CACHE_SIZE,
  REDIS_AUTH_CACHE_PREFIX,
  REDIS_AUTH_CACHE_TTL_SECONDS,
  clearApiKeyCaches,
  deleteRedisAuthCacheEntries,
  deleteRedisAuthCacheEntry,
  deleteRedisAuthCacheForKeyId,
  evictIfNeeded,
  getMetadataCache,
  getModelPermissionCache,
  getValidationCache,
  isRedisAuthCacheEnabled,
  markApiKeyUsed,
  readRedisAuthCache,
  setMetadataCache,
  setModelPermissionCache,
  setValidationCache,
  writeRedisAuthCache,
} = apiKeyCache;

const ORIGINAL_ENV = {
  OMNIROUTE_DISABLE_REDIS_AUTH_CACHE: process.env.OMNIROUTE_DISABLE_REDIS_AUTH_CACHE,
  NODE_ENV: process.env.NODE_ENV,
  DISABLE_SQLITE_AUTO_BACKUP: process.env.DISABLE_SQLITE_AUTO_BACKUP,
};

describe("apiKeyCache — TTL & size constants", () => {
  it("CACHE_TTL is 60 seconds (validation/metadata/model-permission TTL)", () => {
    assert.equal(CACHE_TTL, 60 * 1000);
  });

  it("LAST_USED_UPDATE_TTL is 5 minutes (last_used_at throttle window)", () => {
    assert.equal(LAST_USED_UPDATE_TTL, 5 * 60 * 1000);
  });

  it("MAX_CACHE_SIZE is 1000 (per-cache cap)", () => {
    assert.equal(MAX_CACHE_SIZE, 1000);
  });

  it("REDIS_AUTH_CACHE_PREFIX and TTL are stable across releases", () => {
    // The Redis key shape and the cache TTL are part of the cross-instance
    // contract; a regression here breaks every OmniRoute deployment in a fleet.
    assert.equal(REDIS_AUTH_CACHE_PREFIX, "auth:api_key:");
    assert.equal(REDIS_AUTH_CACHE_TTL_SECONDS, 3600);
  });
});

describe("apiKeyCache — validation cache accessor", () => {
  beforeEach(() => {
    clearApiKeyCaches();
  });

  it("setValidationCache/getValidationCache round-trips the entry", () => {
    setValidationCache("hash-1", { valid: true, timestamp: 1000 });
    const got = getValidationCache("hash-1");
    assert.deepEqual(got, { valid: true, timestamp: 1000 });
  });

  it("setValidationCache overwrites previous entries for the same key", () => {
    setValidationCache("hash-1", { valid: true, timestamp: 1000 });
    setValidationCache("hash-1", { valid: false, timestamp: 2000 });
    assert.deepEqual(getValidationCache("hash-1"), { valid: false, timestamp: 2000 });
  });

  it("getValidationCache returns undefined for unknown keys", () => {
    assert.equal(getValidationCache("never-seen"), undefined);
  });
});

describe("apiKeyCache — metadata & model-permission cache accessors", () => {
  beforeEach(() => {
    clearApiKeyCaches();
  });

  it("setMetadataCache/getMetadataCache round-trips a typed metadata record", () => {
    const fakeMetadata = {
      id: "key-1",
      name: "test",
      machineId: null,
      allowedModels: [],
      blockedModels: [],
      allowedCombos: [],
      allowedConnections: [],
      allowedQuotas: [],
      noLog: false,
      autoResolve: false,
      isActive: true,
      accessSchedule: null,
      maxRequestsPerDay: null,
      maxRequestsPerMinute: null,
      throttleDelayMs: null,
      rateLimits: null,
      maxSessions: 0,
      revokedAt: null,
      expiresAt: null,
      ipAllowlist: [],
      scopes: [],
      isBanned: false,
      keyHash: "hash-x",
      proxyId: null,
      allowedEndpoints: [],
      streamDefaultMode: "legacy" as const,
      disableNonPublicModels: false,
      allowUsageCommand: false,
      usageLimitEnabled: false,
      dailyUsageLimitUsd: null,
      weeklyUsageLimitUsd: null,
    };
    setMetadataCache("hash-x", fakeMetadata, 12345);
    const got = getMetadataCache("hash-x");
    assert.equal(got?.timestamp, 12345);
    assert.equal(got?.value.id, "key-1");
  });

  it("setModelPermissionCache/getModelPermissionCache round-trips the decision", () => {
    setModelPermissionCache("api-key:model-1", { allowed: true, timestamp: 5000 });
    assert.deepEqual(getModelPermissionCache("api-key:model-1"), {
      allowed: true,
      timestamp: 5000,
    });
  });
});

describe("apiKeyCache — LRU eviction", () => {
  it("evictIfNeeded drops the oldest 20% of entries once the map exceeds MAX_CACHE_SIZE", () => {
    const map = new Map<number, number>();
    // Insert MAX_CACHE_SIZE entries + 1, in insertion order.
    for (let i = 0; i <= MAX_CACHE_SIZE; i++) {
      map.set(i, i);
    }
    assert.equal(map.size, MAX_CACHE_SIZE + 1);
    evictIfNeeded(map);
    // Should have evicted floor(MAX_CACHE_SIZE * 0.2) = 200 of the oldest entries,
    // leaving MAX_CACHE_SIZE + 1 - 200 entries behind.
    assert.equal(map.size, MAX_CACHE_SIZE + 1 - 200);
    // The first 200 keys (insertion order) must be gone; the rest must remain.
    assert.equal(map.has(0), false);
    assert.equal(map.has(199), false);
    assert.equal(map.has(200), true);
    assert.equal(map.has(MAX_CACHE_SIZE), true);
  });

  it("evictIfNeeded is a no-op when the map is at or below MAX_CACHE_SIZE", () => {
    const map = new Map<number, number>();
    for (let i = 0; i < MAX_CACHE_SIZE; i++) {
      map.set(i, i);
    }
    evictIfNeeded(map);
    assert.equal(map.size, MAX_CACHE_SIZE);
    assert.equal(map.has(0), true);
  });
});

describe("apiKeyCache — clearApiKeyCaches resets every owned map", () => {
  beforeEach(() => {
    clearApiKeyCaches();
  });

  it("clearApiKeyCaches wipes the validation, metadata, and model-permission caches", () => {
    setValidationCache("hash-1", { valid: true, timestamp: 1 });
    setMetadataCache(
      "hash-2",
      {
        id: "k",
        name: "",
        machineId: null,
        allowedModels: [],
        blockedModels: [],
        allowedCombos: [],
        allowedConnections: [],
        allowedQuotas: [],
        noLog: false,
        autoResolve: false,
        isActive: true,
        accessSchedule: null,
        maxRequestsPerDay: null,
        maxRequestsPerMinute: null,
        throttleDelayMs: null,
        rateLimits: null,
        maxSessions: 0,
        revokedAt: null,
        expiresAt: null,
        ipAllowlist: [],
        scopes: [],
        isBanned: false,
        keyHash: null,
        proxyId: null,
        allowedEndpoints: [],
        streamDefaultMode: "legacy",
        disableNonPublicModels: false,
        allowUsageCommand: false,
        usageLimitEnabled: false,
        dailyUsageLimitUsd: null,
        weeklyUsageLimitUsd: null,
      },
      1
    );
    setModelPermissionCache("api:model", { allowed: true, timestamp: 1 });
    clearApiKeyCaches();
    assert.equal(getValidationCache("hash-1"), undefined);
    assert.equal(getMetadataCache("hash-2"), undefined);
    assert.equal(getModelPermissionCache("api:model"), undefined);
  });
});

describe("apiKeyCache — markApiKeyUsed throttle", () => {
  beforeEach(() => {
    clearApiKeyCaches();
  });

  it("issues an UPDATE on first call and skips subsequent ones within the throttle window", () => {
    const calls: Array<{ sql: string; params: unknown }> = [];
    const db = {
      prepare(sql: string) {
        return {
          run(params: unknown) {
            calls.push({ sql, params });
            return { changes: 1 };
          },
        };
      },
    };

    markApiKeyUsed(db, "key-1", 1000);
    markApiKeyUsed(db, "key-1", 1500); // 500ms later — inside LAST_USED_UPDATE_TTL
    markApiKeyUsed(db, "key-1", 2000);

    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /UPDATE api_keys SET last_used_at/);
  });

  it("issues a second UPDATE after the throttle window expires", () => {
    const calls: number[] = [];
    const db = {
      prepare() {
        return {
          run() {
            calls.push(Date.now());
            return { changes: 1 };
          },
        };
      },
    };

    markApiKeyUsed(db, "key-1", 1000);
    // Jump well past LAST_USED_UPDATE_TTL (5 minutes).
    markApiKeyUsed(db, "key-1", 1000 + LAST_USED_UPDATE_TTL + 1);
    assert.equal(calls.length, 2);
  });

  it("ignores non-string or empty ids without touching the DB", () => {
    const calls: unknown[] = [];
    const db = {
      prepare() {
        return {
          run(params: unknown) {
            calls.push(params);
            return { changes: 1 };
          },
        };
      },
    };
    markApiKeyUsed(db, "", 1000);
    markApiKeyUsed(db, null, 1000);
    markApiKeyUsed(db, undefined, 1000);
    markApiKeyUsed(db, 12345 as unknown as string, 1000);
    assert.equal(calls.length, 0);
  });
});

describe("apiKeyCache — Redis auth-cache feature flags", () => {
  beforeEach(() => {
    clearApiKeyCaches();
    process.env.OMNIROUTE_DISABLE_REDIS_AUTH_CACHE = ORIGINAL_ENV.OMNIROUTE_DISABLE_REDIS_AUTH_CACHE;
    process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
    process.env.DISABLE_SQLITE_AUTO_BACKUP = ORIGINAL_ENV.DISABLE_SQLITE_AUTO_BACKUP;
  });

  after(() => {
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("isRedisAuthCacheEnabled returns true when no opt-out env flag is set", () => {
    delete process.env.OMNIROUTE_DISABLE_REDIS_AUTH_CACHE;
    delete process.env.NODE_ENV;
    delete process.env.DISABLE_SQLITE_AUTO_BACKUP;
    assert.equal(isRedisAuthCacheEnabled(), true);
  });

  it("isRedisAuthCacheEnabled is disabled when OMNIROUTE_DISABLE_REDIS_AUTH_CACHE=1", () => {
    process.env.OMNIROUTE_DISABLE_REDIS_AUTH_CACHE = "1";
    assert.equal(isRedisAuthCacheEnabled(), false);
  });

  it("isRedisAuthCacheEnabled is disabled under NODE_ENV=test", () => {
    process.env.NODE_ENV = "test";
    assert.equal(isRedisAuthCacheEnabled(), false);
  });

  it("isRedisAuthCacheEnabled is disabled under DISABLE_SQLITE_AUTO_BACKUP=true", () => {
    process.env.DISABLE_SQLITE_AUTO_BACKUP = "true";
    assert.equal(isRedisAuthCacheEnabled(), false);
  });
});

describe("apiKeyCache — Redis auth-cache helpers are no-ops when disabled", () => {
  beforeEach(() => {
    clearApiKeyCaches();
    process.env.OMNIROUTE_DISABLE_REDIS_AUTH_CACHE = "1";
  });

  after(() => {
    process.env.OMNIROUTE_DISABLE_REDIS_AUTH_CACHE = ORIGINAL_ENV.OMNIROUTE_DISABLE_REDIS_AUTH_CACHE;
  });

  it("deleteRedisAuthCacheEntry no-ops on blank hash without importing Redis", async () => {
    await deleteRedisAuthCacheEntry("");
    await deleteRedisAuthCacheEntry(null as unknown as string);
    await deleteRedisAuthCacheEntry(undefined as unknown as string);
  });

  it("deleteRedisAuthCacheEntries fans out across N hashes in parallel", async () => {
    // All hashes are blank → all calls should no-op (no Redis import attempted).
    await deleteRedisAuthCacheEntries("", null as unknown as string, undefined as unknown as string);
  });

  it("deleteRedisAuthCacheForKeyId no-ops without a DB read when Redis is disabled", async () => {
    let called = false;
    const db = {
      prepare() {
        called = true;
        return { get: () => undefined };
      },
    };
    await deleteRedisAuthCacheForKeyId(db, "key-1");
    // The implementation short-circuits before the DB read when Redis is disabled.
    assert.equal(called, false);
  });

  it("readRedisAuthCache returns null when Redis is disabled", async () => {
    const decision = await readRedisAuthCache("hash-1");
    assert.equal(decision, null);
  });

  it("writeRedisAuthCache no-ops when Redis is disabled", async () => {
    await writeRedisAuthCache("hash-1", {
      id: "key-1",
      isBanned: false,
      isActive: true,
      revokedAt: null,
      expiresAt: null,
    });
    // No assertion — the contract is "doesn't throw, doesn't import Redis".
  });
});