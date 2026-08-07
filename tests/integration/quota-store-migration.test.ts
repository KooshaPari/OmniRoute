/**
 * tests/integration/quota-store-migration.test.ts
 *
 * Verifies `scripts/migrate-quota-storage.ts`:
 *   - AC-13: dry-run does NOT write to keyv
 *   - AC-14: --apply writes counter state to keyv, matching source
 *   - AC-13 idempotency: re-running apply does not double-count
 *
 * Per `plans/keyv-as-embedded-default-spec.md` §5 (AC-13, AC-14) + §8.1.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "omniroute-quota-migration-"),
);
process.env.DATA_DIR = TEST_DATA_DIR;

// Force the migration script's resolved keyv URI to an isolated memory
// namespace so concurrent tests don't share state.
const MIGRATION_URI = `memory://migration-test-${Date.now()}`;
process.env.QUOTA_STORE_KEYV_URL = MIGRATION_URI;

const core = await import("../../src/lib/db/core.ts");
const localDb = await import("../../src/lib/localDb.ts");
const sqliteModule = await import("../../src/lib/quota/sqliteQuotaStore.ts");
const keyvModule = await import("../../src/lib/quota/keyvQuotaStore.ts");

const { runQuotaMigration } = await import(
  "../../scripts/migrate-quota-storage.ts"
);

async function reset() {
  core.resetDbInstance();
  keyvModule.__resetKeyvQuotaStoreForTests();
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.beforeEach(async () => {
  await reset();
});

test.after(async () => {
  core.resetDbInstance();
  keyvModule.__resetKeyvQuotaStoreForTests();
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
});

// Helper: create a fresh pool + allocation row. Returns the pool ID assigned
// by `createPool` (which auto-generates a UUID — the input `poolId` is only
// used for the display name).
function makePool(poolId: string, apiKeyId: string, connId: string = "conn-mig"): string {
  const pool = localDb.createPool({
    connectionId: connId,
    name: `mig-pool-${poolId}`,
    allocations: [
      {
        apiKeyId,
        weight: 100,
        policy: "hard",
      },
    ],
  });
  return pool.id;
}

// ─── AC-14: dry-run does NOT mutate keyv ────────────────────────────────────

test("migration: AC-14 — dry-run does not write to keyv", async () => {
  const poolId = makePool("mig-pool-dry", "mig-key-dry");
  const sqlite = sqliteModule.getSqliteQuotaStore();
  await sqlite.consume(
    "mig-key-dry",
    { poolId, unit: "tokens", window: "hourly" },
    42,
  );

  // Dry-run.
  const summary = await runQuotaMigration({ apply: false });
  assert.equal(summary.dryRun, true, "dryRun flag must be true");
  assert.ok(summary.rowsMigrated >= 1, "must report at least one row scanned");

  // Read keyv: must be empty (dry-run, no writes).
  keyvModule.__resetKeyvQuotaStoreForTests();
  const keyv = keyvModule.getKeyvQuotaStore({ uri: MIGRATION_URI });
  const keyvValue = await keyv.peek("mig-key-dry", {
    poolId,
    unit: "tokens",
    window: "hourly",
  });
  assert.equal(keyvValue, 0, "keyv must be empty after dry-run");
});

// ─── AC-13: apply writes state; idempotency ──────────────────────────────────

test("migration: AC-13 — apply writes counter state to keyv", async () => {
  const poolId = makePool("mig-pool-apply", "mig-key-apply");
  const sqlite = sqliteModule.getSqliteQuotaStore();
  const TARGET = 123;
  await sqlite.consume(
    "mig-key-apply",
    { poolId, unit: "tokens", window: "hourly" },
    TARGET,
  );

  const summary = await runQuotaMigration({ apply: true });
  assert.equal(summary.dryRun, false);
  assert.ok(summary.rowsMigrated >= 1);

  // Read keyv: must equal source. The migration script keeps the keyv
  // singleton alive (does not call dispose()), so we read from the same
  // instance by NOT resetting the singleton here.
  const keyv = keyvModule.getKeyvQuotaStore({ uri: MIGRATION_URI });
  const keyvValue = await keyv.peek("mig-key-apply", {
    poolId,
    unit: "tokens",
    window: "hourly",
  });
  // SqliteQuotaStore uses 2-bucket sliding window: after consume(123) the
  // bucket value is exactly 123 (no decay since we just wrote). Keyv uses
  // its own bucket model — also stores the exact value via seed().
  assert.equal(keyvValue, TARGET, "keyv value must equal sqlite value after seed()");
});

test("migration: AC-13 — idempotent (re-running apply does not double-count)", async () => {
  const poolId = makePool("mig-pool-idem", "mig-key-idem");
  const sqlite = sqliteModule.getSqliteQuotaStore();
  const TARGET = 77;
  await sqlite.consume(
    "mig-key-idem",
    { poolId, unit: "tokens", window: "hourly" },
    TARGET,
  );

  // Apply once.
  await runQuotaMigration({ apply: true });
  const keyv = keyvModule.getKeyvQuotaStore({ uri: MIGRATION_URI });
  const afterFirst = await keyv.peek("mig-key-idem", {
    poolId,
    unit: "tokens",
    window: "hourly",
  });
  assert.equal(afterFirst, TARGET);

  // Re-apply (sqlite source is unchanged, so seed() is a no-op overwrite).
  // Sqlite value has decayed slightly via sliding-window math; the test
  // only requires that keyv does not exceed `TARGET` (i.e. no double-count).
  await runQuotaMigration({ apply: true });
  const keyv2 = keyvModule.getKeyvQuotaStore({ uri: MIGRATION_URI });
  const afterSecond = await keyv2.peek("mig-key-idem", {
    poolId,
    unit: "tokens",
    window: "hourly",
  });
  // After re-seeding with whatever the (slightly decayed) sqlite value is,
  // the keyv bucket should be exactly that decayed value — never above it.
  assert.ok(
    afterSecond <= afterFirst + 1,
    `keyv value must not exceed initial seed (was ${afterSecond}, initial ${afterFirst})`,
  );
});

// ─── AC-13: summary shape ────────────────────────────────────────────────────

test("migration: summary includes kvUri + counts", async () => {
  const poolId = makePool("mig-pool-shape", "mig-key-shape");
  const summary = await runQuotaMigration({ apply: false });
  assert.equal(summary.dryRun, true);
  assert.ok(typeof summary.kvUri === "string" && summary.kvUri.length > 0);
  assert.ok(summary.poolsScanned >= 1);
  assert.ok(summary.dimensionsScanned >= 1);
  assert.ok(summary.rowsMigrated >= 0);
  assert.ok(summary.rowsSkipped >= 0);
});
