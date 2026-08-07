/**
 * keyvDefaultConfig.ts — Env-driven configuration for the embedded-default
 * Keyv QuotaStore driver.
 *
 * This module is the Single Source of Truth (SSOT) for "what does the keyv
 * default config look like when QUOTA_STORE_DRIVER=keyv (or unset)":
 *
 *   - QUOTA_STORE_DRIVER       (sqlite | keyv | redis; default = keyv)
 *   - QUOTA_KEYV_BACKEND       (memory | sqlite | file;  default = sqlite)
 *   - QUOTA_STORE_KEYV_URL     (URI string; default = `keyv://sqlite:.agileplus/quota/quota.db`)
 *
 * Used by:
 *   - `storeFactory.ts`        — to resolve the env-layer config at startup
 *   - `scripts/migrate-quota-storage.ts` — opt-in migration script
 *   - `tests/unit/quota/keyvDefaultConfig.test.ts` — env validation
 *
 * DB-layer settings (`quotaStore.driver`, `quotaStore.kvUrl`,
 * `quotaStore.keyvBackend`) override env values; composition happens in the
 * factory, not here. This module is intentionally env-only — the DB layer is
 * a separate concern.
 *
 * Per `plans/keyv-as-embedded-default-spec.md` §4.3.2.
 */
import { z } from "zod";

export const KEYV_BACKEND_SCHEMA = z.enum(["memory", "sqlite", "file"]);
export type KeyvBackend = z.infer<typeof KEYV_BACKEND_SCHEMA>;

export const QUOTA_STORE_DRIVER_SCHEMA = z.enum(["sqlite", "keyv", "redis"]);
export type QuotaStoreDriver = z.infer<typeof QUOTA_STORE_DRIVER_SCHEMA>;

export const KEYV_DEFAULT_URI = "keyv://sqlite:.agileplus/quota/quota.db";

export interface KeyvDefaultConfig {
  driver: QuotaStoreDriver;
  backend: KeyvBackend;
  kvUrl: string;
}

/**
 * Read env vars, validate against the zod schema, and return the resolved
 * config. Throws a human-readable error if validation fails (fail-fast at
 * startup).
 *
 * Defaults:
 *   - driver  → "keyv"   (was "sqlite" pre-PR-G)
 *   - backend → "sqlite" (durable single-process; override with `memory`
 *                          for ephemeral / serverless workloads)
 *   - kvUrl   → `KEYV_DEFAULT_URI` unless QUOTA_KEYV_BACKEND=memory,
 *               in which case → "memory://"
 */
export function readKeyvDefaultConfigFromEnv(): KeyvDefaultConfig {
  const driverRaw = process.env.QUOTA_STORE_DRIVER ?? "keyv";
  const backendRaw = process.env.QUOTA_KEYV_BACKEND ?? "sqlite";
  const kvUrlRaw = process.env.QUOTA_STORE_KEYV_URL ?? "";

  const driver = QUOTA_STORE_DRIVER_SCHEMA.parse(driverRaw);
  const backend = KEYV_BACKEND_SCHEMA.parse(backendRaw);

  let kvUrl: string;
  if (kvUrlRaw) {
    kvUrl = kvUrlRaw;
  } else if (backend === "memory") {
    kvUrl = "memory://";
  } else {
    // "sqlite" (default) or "file" — use the durable default
    kvUrl = KEYV_DEFAULT_URI;
  }

  return { driver, backend, kvUrl };
}

/** Convenience constants for tests and consumers that need the defaults. */
export const KEYV_DEFAULTS = {
  KEYV_DEFAULT_URI,
  driver: "keyv" as const,
  backend: "sqlite" as const,
} as const;
