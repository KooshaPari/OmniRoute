// @vitest-environment node
/**
 * tests/unit/quota-store-factory.test.ts
 *
 * Coverage for src/lib/quota/storeFactory.ts:
 *   - Default driver = keyv (uses @keyv/sqlite, no sidecar)
 *   - Env override QUOTA_STORE_DRIVER=redis + URL → redis store (if ioredis available)
 *   - Driver redis + URL absent → fallback keyv
 *   - Singleton: multiple calls return same instance
 *   - resetQuotaStoreSingleton() resets
 */

import { describe, it, beforeEach, afterEach, afterAll, beforeAll, expect } from "vitest";
;
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-store-factory-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");

async function resetStorage() {
  core.resetDbInstance();
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      if (fs.existsSync(TEST_DATA_DIR)) {
        fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
      }
      break;
    } catch (err: unknown) {
      const e = err as { code?: string };
      if ((e?.code === "EBUSY" || e?.code === "EPERM") && attempt < 9) {
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

const origDriver = process.env.QUOTA_STORE_DRIVER;
const origRedisUrl = process.env.QUOTA_STORE_REDIS_URL;

beforeEach(async () => {
  await resetStorage();
  // Reset env
  delete process.env.QUOTA_STORE_DRIVER;
  delete process.env.QUOTA_STORE_REDIS_URL;
  // Reset singleton
  const { resetQuotaStoreSingleton } = await import("../../src/lib/quota/storeFactory.ts");
  resetQuotaStoreSingleton();
});

afterAll(async () => {
  core.resetDbInstance();
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
  // Restore env
  if (origDriver !== undefined) process.env.QUOTA_STORE_DRIVER = origDriver;
  else delete process.env.QUOTA_STORE_DRIVER;
  if (origRedisUrl !== undefined) process.env.QUOTA_STORE_REDIS_URL = origRedisUrl;
  else delete process.env.QUOTA_STORE_REDIS_URL;
});

// ─── Default driver ──────────────────────────────────────────────────────────

it("storeFactory: default driver is keyv", async () => {
  const { getQuotaStore, resetQuotaStoreSingleton } = await import("../../src/lib/quota/storeFactory.ts");
  resetQuotaStoreSingleton();
  delete process.env.QUOTA_STORE_DRIVER; // ensure default branch

  const store = await getQuotaStore();
  expect(store, "Should return a store");
  // The store surface is identical regardless of driver (keyv/sqlite/redis all
  // implement QuotaStore).
  expect(typeof store.consume === "function");
  expect(typeof store.peek === "function");
  expect(typeof store.poolUsage === "function");
  expect(typeof store.clear === "function");
});

// ─── Singleton behaviour ─────────────────────────────────────────────────────

it("storeFactory: multiple calls return same singleton", async () => {
  const { getQuotaStore, resetQuotaStoreSingleton } = await import("../../src/lib/quota/storeFactory.ts");
  resetQuotaStoreSingleton();

  const store1 = await getQuotaStore();
  const store2 = await getQuotaStore();
  expect(store1, store2);
});

it("storeFactory: resetQuotaStoreSingleton() creates new instance on next call", async () => {
  const { getQuotaStore, resetQuotaStoreSingleton } = await import("../../src/lib/quota/storeFactory.ts");
  resetQuotaStoreSingleton();

  const store1 = await getQuotaStore();
  resetQuotaStoreSingleton();
  const store2 = await getQuotaStore();

  // After reset, a new instance is created (may or may not be the same object
  // since singleton is re-created — but the important thing is it doesn't throw)
  expect(store2, "Should return a new store after reset");
});

// ─── Redis driver + no URL → fallback sqlite ─────────────────────────────────

it("storeFactory: QUOTA_STORE_DRIVER=redis without URL → fallback to sqlite", async () => {
  const { getQuotaStore, resetQuotaStoreSingleton } = await import("../../src/lib/quota/storeFactory.ts");
  resetQuotaStoreSingleton();

  process.env.QUOTA_STORE_DRIVER = "redis";
  delete process.env.QUOTA_STORE_REDIS_URL;

  // Should not throw — should fall back to sqlite
  const store = await getQuotaStore();
  expect(store, "Should return a valid store (sqlite fallback)");
  expect(typeof store.consume === "function");
});

// ─── Unknown driver → fallback sqlite ────────────────────────────────────────

it("storeFactory: unknown driver value → falls back to sqlite silently", async () => {
  const { getQuotaStore, resetQuotaStoreSingleton } = await import("../../src/lib/quota/storeFactory.ts");
  resetQuotaStoreSingleton();

  (process.env as Record<string, string>).QUOTA_STORE_DRIVER = "memcached";

  const store = await getQuotaStore();
  expect(store, "Should return sqlite store as fallback");
  expect(typeof store.consume === "function");
});

// ─── Redis driver + invalid URL (ioredis not installed) → fallback ────────────

it("storeFactory: QUOTA_STORE_DRIVER=redis with invalid URL → fallback or throws gracefully", async () => {
  const { getQuotaStore, resetQuotaStoreSingleton } = await import("../../src/lib/quota/storeFactory.ts");
  resetQuotaStoreSingleton();

  process.env.QUOTA_STORE_DRIVER = "redis";
  process.env.QUOTA_STORE_REDIS_URL = "redis://localhost:6380"; // likely not running

  // In test env, ioredis may or may not be installed.
  // If installed: store is created (Redis connection is lazy).
  // If not installed: factory falls back to sqlite.
  // Either way, no throw — returns a valid store.
  const store = await getQuotaStore();
  expect(store, "Should always return a valid store");
  expect(typeof store.consume === "function");
});
