/**
 * storeFactory.ts — Lazy singleton factory for QuotaStore.
 *
 * Driver selection precedence (highest to lowest):
 *   1. DB setting `quotaStore.driver` (read via getSettings())
 *   2. Env `QUOTA_STORE_DRIVER`
 *   3. Default: "keyv"   (was "sqlite" pre-PR-G)
 *
 * Driver values:
 *   - "keyv"   — fully-embedded default; uses keyv (SQLite backend by default,
 *                memory for serverless, or any URI passed via
 *                QUOTA_STORE_KEYV_URL). Zero native bindings; persistent across
 *                restarts when QUOTA_KEYV_BACKEND=sqlite.
 *   - "sqlite" — fully-embedded (opt-in; uses localDb atomic primitives;
 *                retained for shared-disk multi-process users).
 *   - "redis"  — distributed (uses ioredis; optional sidecar).
 *
 * Keyv URL precedence:
 *   1. DB setting `quotaStore.kvUrl`
 *   2. Env `QUOTA_STORE_KEYV_URL`
 *   3. Default: `keyv://sqlite:.agileplus/quota/quota.db`
 *                (was "" pre-PR-G — i.e. memory-only)
 *
 * Redis URL precedence:
 *   1. DB setting `quotaStore.redisUrl`
 *   2. Env `QUOTA_STORE_REDIS_URL`
 *
 * Keyv backend precedence:
 *   1. DB setting `quotaStore.keyvBackend`
 *   2. Env `QUOTA_KEYV_BACKEND`
 *   3. Default: "sqlite"
 *
 * If driver=redis but URL is absent/invalid → fallback to sqlite + pino.warn.
 * If driver=keyv but no URL → falls back to the durable sqlite-backed URI.
 * Never throws — always returns a valid QuotaStore.
 *
 * Part of: Group B — Quota Sharing Engine (plan 22, frente F6).
 * Plan: `plans/keyv-as-embedded-default-spec.md` §4.3.1.
 */

import { createLogger } from "@/shared/utils/logger";
import type { QuotaStore } from "./types";
import {
  KEYV_DEFAULT_URI,
  readKeyvDefaultConfigFromEnv,
} from "./keyvDefaultConfig";

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
  keyvBackend?: string;
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
        keyvBackend: typeof obj.keyvBackend === "string" ? obj.keyvBackend : undefined,
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

  // PR-G (this PR): keyv driver is the embedded default when no driver is set.
  // Backed by keyv (sqlite backend by default, memory for serverless, or any
  // URI passed via QUOTA_STORE_KEYV_URL). Removes the Redis sidecar requirement
  // for fresh installs while preserving the option for distributed deploys.
  const driver =
    dbSettings.driver ?? process.env.QUOTA_STORE_DRIVER ?? "keyv";

  const redisUrl =
    dbSettings.redisUrl ?? process.env.QUOTA_STORE_REDIS_URL ?? "";

  if (driver === "keyv") {
    // Resolve the env-driven defaults via the SSOT config helper, then layer
    // any DB setting overrides on top (DB > env > default).
    const envCfg = readKeyvDefaultConfigFromEnv();
    const backend = dbSettings.keyvBackend ?? envCfg.backend;
    const explicitKvUrl = dbSettings.kvUrl ?? process.env.QUOTA_STORE_KEYV_URL;

    let resolvedKvUrl: string;
    if (explicitKvUrl) {
      // Operator supplied an explicit URI — honor it verbatim. This is the
      // escape hatch for redis:// or custom file:// backends.
      resolvedKvUrl = explicitKvUrl;
    } else if (backend === "memory") {
      // Serverless / ephemeral workloads — pure memory.
      resolvedKvUrl = "memory://";
    } else {
      // "sqlite" (default) or "file" — use the durable default URI.
      resolvedKvUrl = KEYV_DEFAULT_URI;
    }

    try {
      const { getKeyvQuotaStore } = await import("./keyvQuotaStore");
      const store = getKeyvQuotaStore({ uri: resolvedKvUrl });
      _store = store;
      log.info(
        {
          driver: "keyv",
          backend: explicitKvUrl ? "explicit-uri" : backend,
          kvUrl: resolvedKvUrl.replace(/:[^:@]*@/, ":***@"),
        },
        "QuotaStore: using keyv driver (embedded default)",
      );
      return _store;
    } catch (err) {
      log.warn(
        { err: (err as Error)?.message },
        "Keyv QuotaStore unavailable — falling back to sqlite",
      );
      // Fall through to sqlite
    }
  }

  if (driver === "redis") {
    if (!redisUrl) {
      log.warn("QUOTA_STORE_DRIVER=redis but no Redis URL configured — falling back to sqlite");
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
          "Redis QuotaStore unavailable — falling back to sqlite"
        );
        // Fall through to sqlite
      }
    }
  }

  // Default: SQLite
  const { getSqliteQuotaStore } = await import("./sqliteQuotaStore");
  _store = getSqliteQuotaStore();
  log.info("QuotaStore: using SQLite driver");
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
