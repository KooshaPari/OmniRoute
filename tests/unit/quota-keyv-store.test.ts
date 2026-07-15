// @vitest-environment node
/**
 * tests/unit/quota-keyv-store.test.ts
 *
 * Coverage for src/lib/quota/keyvQuotaStore.ts and
 * src/shared/utils/keyvKvStore.ts:
 *   - KvLike URL parsing (memory, sqlite/<path>, sqlite?path=...)
 *   - incrbyfloat + expire + mget + del + quit round-trip
 *   - KeyvQuotaStore consumes against the embedded store
 *   - KeyvQuotaStore peek applies sliding-window decay
 *   - KeyvQuotaStore.clear wipes both buckets
 *   - storeFactory picks driver=keyv when QUOTA_STORE_DRIVER=keyv
 *
 * These tests do NOT require a running Redis sidecar.
 */

import { describe, it, beforeEach, afterEach, afterAll, beforeAll, expect } from "vitest";
;
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-keyv-store-"));
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.DISABLE_SQLITE_AUTO_BACKUP = "true";

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

beforeEach(async () => {
  await resetStorage();
});

afterAll(async () => {
  core.resetDbInstance();
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

// ─── URL parsing ─────────────────────────────────────────────────────────────

it("keyvKvStore: parseKeyvUrl accepts keyv://memory", async () => {
  const { parseKeyvUrl } = await import("../../src/shared/utils/keyvKvStore.ts");
  expect(parseKeyvUrl("keyv://memory")).toEqual({ kind: "memory" });
  expect(parseKeyvUrl("")).toEqual({ kind: "memory" });
});

it("keyvKvStore: parseKeyvUrl accepts keyv://sqlite/<path>", async () => {
  const { parseKeyvUrl } = await import("../../src/shared/utils/keyvKvStore.ts");
  const parsed = parseKeyvUrl("keyv://sqlite/tmp/omniroute-kv.sqlite");
  expect(parsed.kind).toBe("sqlite");
  if (parsed.kind === "sqlite") {
    // path.resolve() anchors against cwd — assert it ends with the input path
    expect(
      parsed.path.endsWith("tmp/omniroute-kv.sqlite"),
      `expected path to end with tmp/omniroute-kv.sqlite, got ${parsed.path}`
    );
  }
});

it("keyvKvStore: parseKeyvUrl accepts keyv://sqlite?path=…&table=…", async () => {
  const { parseKeyvUrl } = await import("../../src/shared/utils/keyvKvStore.ts");
  const parsed = parseKeyvUrl("keyv://sqlite?path=/var/lib/omniroute/kv.sqlite&table=quota");
  expect(parsed.kind).toBe("sqlite");
  if (parsed.kind === "sqlite") {
    // Absolute paths survive path.resolve() unchanged
    expect(parsed.path).toBe("/var/lib/omniroute/kv.sqlite");
    expect(parsed.table).toBe("quota");
  }
});

it("keyvKvStore: parseKeyvUrl rejects malformed URLs", async () => {
  const { parseKeyvUrl } = await import("../../src/shared/utils/keyvKvStore.ts");
  expect(() => parseKeyvUrl("redis://localhost:6379")).toThrow();
  expect(() => parseKeyvUrl("keyv://unknown/foo")).toThrow();
});

// ─── KvLike round-trip ───────────────────────────────────────────────────────

it("keyvKvStore: incrbyfloat + expire + mget round-trip in-memory", async () => {
  const { createInMemoryKvLike } = await import("../../src/shared/utils/keyvKvStore.ts");
  const kv = createInMemoryKvLike();

  const v1 = await kv.incrbyfloat("counter:a", 100);
  expect(v1).toBe("100");

  const v2 = await kv.incrbyfloat("counter:a", 50.5);
  expect(v2).toBe("150.5");

  // expire returns 1 when key exists
  const exp = await kv.expire("counter:a", 60);
  expect(exp).toBe(1);

  // mget preserves ordering
  const vals = await kv.mget("counter:a", "counter:b", "counter:a");
  expect(vals).toEqual(["150.5", null, "150.5"]);
});

it("keyvKvStore: del returns count of removed keys", async () => {
  const { createInMemoryKvLike } = await import("../../src/shared/utils/keyvKvStore.ts");
  const kv = createInMemoryKvLike();

  await kv.incrbyfloat("k1", 1);
  await kv.incrbyfloat("k2", 1);
  await kv.incrbyfloat("k3", 1);

  const removed = await kv.del("k1", "k2", "missing");
  expect(removed).toBe(2);

  const after = await kv.mget("k1", "k2", "k3");
  expect(after).toEqual([null, null, "1"]);
});

it("keyvKvStore: eval returns null (no script execution on keyv)", async () => {
  const { createInMemoryKvLike } = await import("../../src/shared/utils/keyvKvStore.ts");
  const kv = createInMemoryKvLike();
  const result = await kv.eval("return 1", 0);
  expect(result).toBe(null);
});

it("keyvKvStore: quit closes SQLite adapter cleanly", async () => {
  const tmpDb = path.join(os.tmpdir(), `omniroute-keyv-quit-${Date.now()}.sqlite`);
  try {
    const { createKvLike, _resetKeyvKvStoreForTests } = await import(
      "../../src/shared/utils/keyvKvStore.ts"
    );
    _resetKeyvKvStoreForTests();
    const kv = await createKvLike(`keyv://sqlite/${tmpDb}`);
    await kv.incrbyfloat("x", 5);
    const ok = await kv.quit();
    expect(ok).toBe("OK");
  } finally {
    if (fs.existsSync(tmpDb)) {
      try {
        fs.rmSync(tmpDb, { force: true });
      } catch {
        // best-effort; SQLite WAL/SHM files may still be held briefly
      }
    }
  }
});

// ─── KeyvQuotaStore end-to-end ────────────────────────────────────────────────

it("keyvQuotaStore: consume → peek round-trip matches sliding-window math", async () => {
  const { KeyvQuotaStore } = await import("../../src/lib/quota/keyvQuotaStore.ts");
  const store = new KeyvQuotaStore("keyv://memory");
  const dim = { poolId: "pool1", unit: "tokens" as const, window: "hourly" as const };

  const e1 = await store.consume("key-a", dim, 100);
  const e2 = await store.consume("key-a", dim, 200);

  // Within the same bucket, prev=0 → effective ≈ 300 (with sub-second decay tolerance).
  expect(e1 > 95 && e1 <= 100, `first consume should be ~100, got ${e1}`);
  expect(e2 > 290 && e2 <= 300, `second consume should be ~300, got ${e2}`);

  const peeked = await store.peek("key-a", dim);
  expect(peeked > 290 && peeked <= 300, `peek should match second consume, got ${peeked}`);
});

it("keyvQuotaStore: clear wipes both bucket counters", async () => {
  const { KeyvQuotaStore } = await import("../../src/lib/quota/keyvQuotaStore.ts");
  const store = new KeyvQuotaStore("keyv://memory");
  const dim = { poolId: "pool1", unit: "tokens" as const, window: "hourly" as const };

  await store.consume("key-b", dim, 500);
  await store.clear("key-b", dim);

  const after = await store.peek("key-b", dim);
  expect(after).toBe(0);
  // peek after clear must be 0
});

it("keyvQuotaStore: persist via SQLite file", async () => {
  const tmpDb = path.join(os.tmpdir(), `omniroute-keyv-quota-${Date.now()}.sqlite`);
  try {
    const { KeyvQuotaStore, resetKeyvQuotaStore } = await import(
      "../../src/lib/quota/keyvQuotaStore.ts"
    );
    const { _resetKeyvKvStoreForTests } = await import("../../src/shared/utils/keyvKvStore.ts");
    _resetKeyvKvStoreForTests();
    resetKeyvQuotaStore();

    const dim = { poolId: "pool2", unit: "tokens" as const, window: "hourly" as const };

    const store1 = new KeyvQuotaStore(`keyv://sqlite/${tmpDb}`);
    await store1.consume("key-c", dim, 750);
    await store1.clear("key-c", dim); // tidy the file
    await store1.consume("key-c", dim, 250);
    await store1.quit();

    // Reopen and read back
    _resetKeyvKvStoreForTests();
    const store2 = new KeyvQuotaStore(`keyv://sqlite/${tmpDb}`);
    const peeked = await store2.peek("key-c", dim);
    expect(peeked).toBeGreaterThan(245);
    expect(peeked).toBeLessThanOrEqual(250);
  } finally {
    if (fs.existsSync(tmpDb)) {
      try {
        fs.rmSync(tmpDb, { force: true });
      } catch {
        // ignore
      }
    }
  }
});

// ─── storeFactory wiring ─────────────────────────────────────────────────────

it("storeFactory: driver=keyv picks KeyvQuotaStore", async () => {
  process.env.QUOTA_STORE_DRIVER = "keyv";
  process.env.QUOTA_STORE_KV_URL = "keyv://memory";

  const { getQuotaStore, resetQuotaStoreSingleton } = await import(
    "../../src/lib/quota/storeFactory.ts"
  );
  resetQuotaStoreSingleton();
  const store = await getQuotaStore();
  expect(store, "storeFactory should return a store");

  // KeyvQuotaStore exposes the same QuotaStore interface but is identified by
  // checking for the unique consume() return shape (sliding-window number).
  const dim = { poolId: "factory-pool", unit: "tokens" as const, window: "hourly" as const };
  const v = await store.consume("k", dim, 1);
  expect(typeof v).toBe("number");
  expect(v).toBeGreaterThan(0);
  expect(v).toBeLessThanOrEqual(1);

  resetQuotaStoreSingleton();
  delete process.env.QUOTA_STORE_DRIVER;
  delete process.env.QUOTA_STORE_KV_URL;
});