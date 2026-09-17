// The auto-cleanup scheduler used to run a full `VACUUM` after ANY deletion
// (`totalDeleted > 0`), no matter how small. `db.exec("VACUUM")` is synchronous
// and blocks the entire process -- on a multi-GB database that freezes all HTTP
// traffic for 15-20 minutes. Observed live: a routine cleanup that freed 2-6
// rows re-triggered a full VACUUM on every restart, because the new terminal-
// batch cleanup (see db-terminal-batch-and-file-cleanup.test.ts) almost always
// finds a handful of newly-aged-out batches.
//
// Row count was never the right signal anyway: a few oversized
// batch_item_checkpoints rows can free far more space than thousands of tiny
// audit-log rows. This pins vacuumAfterCleanup()'s reclaimable-bytes gate: SQLite's
// own free-page count (PRAGMA freelist_count), not "were any rows deleted". The
// row-count gate (OMNIROUTE_VACUUM_MIN_DELETED_ROWS) is untouched and still fires
// on its own -- see db-cleanup-vacuum-gate.test.ts -- this file only pins the
// ADDITIONAL reclaimable-bytes trigger.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-vacuum-threshold-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../src/lib/db/core.ts");
const cleanup = await import("../../src/lib/db/cleanup.ts");

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function withEnv<T>(
  key: string,
  value: string | undefined,
  fn: () => T | Promise<T>
): Promise<T> {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
}

test("getVacuumMinReclaimableBytes: defaults to 100 MB", async () => {
  await withEnv("OMNIROUTE_VACUUM_MIN_RECLAIMABLE_MB", undefined, () => {
    assert.equal(cleanup.getVacuumMinReclaimableBytes(), 100 * 1024 * 1024);
  });
});

test("getVacuumMinReclaimableBytes: honors the env override, including 0 (always vacuum)", async () => {
  await withEnv("OMNIROUTE_VACUUM_MIN_RECLAIMABLE_MB", "5", () => {
    assert.equal(cleanup.getVacuumMinReclaimableBytes(), 5 * 1024 * 1024);
  });
  await withEnv("OMNIROUTE_VACUUM_MIN_RECLAIMABLE_MB", "0", () => {
    assert.equal(cleanup.getVacuumMinReclaimableBytes(), 0);
  });
});

test("getVacuumMinReclaimableBytes: rejects garbage and falls back to the default", async () => {
  await withEnv("OMNIROUTE_VACUUM_MIN_RECLAIMABLE_MB", "not-a-number", () => {
    assert.equal(cleanup.getVacuumMinReclaimableBytes(), 100 * 1024 * 1024);
  });
  await withEnv("OMNIROUTE_VACUUM_MIN_RECLAIMABLE_MB", "-1", () => {
    assert.equal(cleanup.getVacuumMinReclaimableBytes(), 100 * 1024 * 1024);
  });
});

test("vacuumAfterCleanup: reclaimable-bytes gate skips VACUUM when space is under the threshold (row gate also below threshold)", async () => {
  const db = core.getDbInstance();
  db.exec("CREATE TABLE IF NOT EXISTS vacuum_threshold_probe (id INTEGER PRIMARY KEY, v TEXT)");
  // A handful of tiny rows leaves negligible freelist space after deletion --
  // nowhere near the (very high, deliberately unreachable in this test) threshold.
  db.exec("INSERT INTO vacuum_threshold_probe (v) VALUES ('a'), ('b'), ('c')");
  db.exec("DELETE FROM vacuum_threshold_probe");

  await withEnv("OMNIROUTE_VACUUM_MIN_RECLAIMABLE_MB", "999999", async () => {
    // Also keep the row-count gate from firing on its own so only the
    // reclaimable-bytes gate is under test here.
    await withEnv("OMNIROUTE_VACUUM_MIN_DELETED_ROWS", "999999", async () => {
      // Must not throw, and specifically must not attempt to run VACUUM at all --
      // proven by the fact that a VACUUM would otherwise reset freelist_count.
      const before = cleanup.getReclaimableBytes(db);
      const ran = await cleanup.vacuumAfterCleanup(
        3,
        (sql) => db.exec(sql),
        () => {},
        () => {},
        () => cleanup.getReclaimableBytes(db)
      );
      const after = cleanup.getReclaimableBytes(db);
      assert.equal(ran, false);
      assert.equal(after, before, "skipping VACUUM must leave the freelist untouched");
    });
  });
});

test("vacuumAfterCleanup: reclaimable-bytes gate alone triggers VACUUM even when the row-count gate is not met", async () => {
  const db = core.getDbInstance();
  db.exec("CREATE TABLE IF NOT EXISTS vacuum_threshold_probe2 (id INTEGER PRIMARY KEY, v TEXT)");
  const insert = db.prepare("INSERT INTO vacuum_threshold_probe2 (v) VALUES (?)");
  const big = "x".repeat(4096);
  for (let i = 0; i < 200; i++) insert.run(big);
  db.exec("DELETE FROM vacuum_threshold_probe2");

  const reclaimableBeforeVacuum = cleanup.getReclaimableBytes(db);
  assert.ok(reclaimableBeforeVacuum > 0, "sanity: the delete above must have freed some pages");

  await withEnv("OMNIROUTE_VACUUM_MIN_RECLAIMABLE_MB", "0", async () => {
    // Row-count gate deliberately unreachable: only 1 row "deleted" here, far
    // below any realistic OMNIROUTE_VACUUM_MIN_DELETED_ROWS value, proving the
    // reclaimable-bytes signal alone is sufficient to trigger VACUUM.
    await withEnv("OMNIROUTE_VACUUM_MIN_DELETED_ROWS", "999999", async () => {
      const ran = await cleanup.vacuumAfterCleanup(
        1,
        (sql) => db.exec(sql),
        () => {},
        () => {},
        () => cleanup.getReclaimableBytes(db)
      );
      assert.equal(ran, true);
    });
  });

  // A successful VACUUM rebuilds the file with no free pages left over.
  assert.equal(cleanup.getReclaimableBytes(db), 0, "VACUUM must have actually run");
});
