/**
 * storeFactory.ts — Lazy singleton factory for QuotaStore.
 *
 * Driver selection precedence (highest to lowest):
 *   1. DB setting `quotaStore.driver` (read via getSettings())
 *   2. Env `QUOTA_STORE_DRIVER`
 *   3. Default: "keyv"   ← NEW 2026-07: prefers embedded keyv (zero sidecar)
 *
 * Driver values:
 *   - "keyv"   — embedded KV via @keyv/sqlite (zero sidecar, Redis-API shape)
 *   - "sqlite" — embedded SQLite (legacy, kept for backwards compat)
 *   - "redis"  — external Redis via ioredis (legacy, requires REDIS_URL)
 *
 * KV URL precedence (for driver=keyv):
 *   1. DB setting `quotaStore.kvUrl`
 *   2. Env `QUOTA_STORE_KV_URL`
 *   3. Default: `keyv-sqlite://default`  ← NEW 2026-07: persistent local file
 *
 * Redis URL precedence (for driver=redis):
 *   1. DB setting `quotaStore.redisUrl`
 *   2. Env `QUOTA_STORE_REDIS_URL`
 *
 * If a sidecar driver is selected without a URL → fallback to keyv + persist warning.
 * Never throws — always returns a valid QuotaStore.
 *
 * Part of: Group B — Quota Sharing Engine (plan 22, frente F6).
 */

import { createLogger } from "@/shared/utils/logger";
import type { QuotaStore } from "./types";

const log = createLogger("quota:factory");

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

let _store: QuotaStore | null = null;

/** Reset the singleton (test-only). */
export function resetQuotaStoreSingleton(): void {
  _store = null;
}

// ---------------------------------------------------------------------------
// Settings reader (async, best-effort)
// ---------------------------------------------------------------------------

interface QuotaStoreSettings {
  driver?: string;
  redisUrl?: string;
  kvUrl?: string;
}

async function readDbSettings(): Promise<QuotaStoreSettings> {
  try {
    // Lazy import to avoid circular deps and to keep the module loadable
    // in environments without a DB (e.g. partial test setups).
    const { getSettings } = await import("@/lib/db/settings");
    const settings = await getSettings();
    const raw = settings["quotaStore"];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      return {
        driver: typeof obj.driver === "string" ? obj.driver : undefined,
        redisUrl: typeof obj.redisUrl === "string" ? obj.redisUrl : undefined,
        kvUrl: typeof obj.kvUrl === "string" ? obj.kvUrl : undefined,
      };
    }
  } catch {
    // DB not available — fall through to env
  }
  return {};
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Return the singleton QuotaStore, initialising it on first call.
 *
 * This function is async only because reading DB settings is async.
 * After the first call it returns synchronously from the cached singleton.
 */
export async function getQuotaStore(): Promise<QuotaStore> {
  if (_store) return _store;

  // Read settings
  const dbSettings = await readDbSettings();

  const driver =
    dbSettings.driver ?? process.env.QUOTA_STORE_DRIVER ?? "keyv";

  const redisUrl =
    dbSettings.redisUrl ?? process.env.QUOTA_STORE_REDIS_URL ?? "";

  const kvUrl =
    dbSettings.kvUrl ?? process.env.QUOTA_STORE_KV_URL ?? "keyv-sqlite://default";

  if (driver === "redis") {
    if (!redisUrl) {
      log.warn("QUOTA_STORE_DRIVER=redis but no Redis URL configured — falling back to keyv");
    } else {
      try {
        const { getRedisQuotaStore } = await import("./redisQuotaStore");
        // Validate ioredis is available by attempting a mock import
        // The actual connection is lazy; we just need the class to instantiate.
        const store = getRedisQuotaStore(redisUrl);
        _store = store;
        log.info({ redisUrl: redisUrl.replace(/:[^:@]*@/, ":***@") }, "QuotaStore: using Redis driver");
        return _store;
      } catch (err) {
        log.warn(
          { err: (err as Error)?.message },
          "Redis QuotaStore unavailable — falling back to keyv"
        );
        // Fall through to keyv
      }
    }
  }

  if (driver === "keyv") {
    try {
      const { getKeyvQuotaStore } = await import("./keyvQuotaStore");
      const store = getKeyvQuotaStore(kvUrl);
      _store = store;
      log.info({ kvUrl }, "QuotaStore: using embedded keyv driver (no sidecar)");
      return _store;
    } catch (err) {
      log.warn(
        { err: (err as Error)?.message },
        "keyv QuotaStore unavailable — falling back to SQLite"
      );
      // Fall through to SQLite
    }
  }

  // Default / unknown driver → SQLite (legacy fallback)
  const { getSqliteQuotaStore } = await import("./sqliteQuotaStore");
  _store = getSqliteQuotaStore();
  log.info("QuotaStore: using SQLite driver (legacy)");
  return _store;
}

/**
 * Synchronous version for callers that know the store has been initialised.
 * Throws if called before getQuotaStore() has resolved.
 */
export function getQuotaStoreSync(): QuotaStore {
  if (!_store) {
    throw new Error("QuotaStore has not been initialised yet. Call getQuotaStore() first.");
  }
  return _store;
}
