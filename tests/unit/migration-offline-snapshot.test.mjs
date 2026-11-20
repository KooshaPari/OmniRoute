import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { auditOfflineSnapshot } from "../../scripts/db/migration-offline-snapshot.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "omni-audit-"));
  const snapshotPath = join(root, "snapshot.sqlite");
  const migrationsDir = join(root, "migrations"); mkdirSync(migrationsDir);
  const db = new DatabaseSync(snapshotPath);
  db.exec("CREATE TABLE _omniroute_migrations(version TEXT PRIMARY KEY, name TEXT NOT NULL); INSERT INTO _omniroute_migrations VALUES ('185','old'),('legacy-1','legacy'),(NULL,'unknown')");
  db.close(); writeFileSync(join(migrationsDir, "185_new.sql"), "SELECT 1;");
  return { root, snapshotPath, migrationsDir, offlineSnapshot: true };
}
test("snapshot is byte-identical, creates no sidecars and reports unsupported records", () => {
  const f = fixture(); const before = digest(readFileSync(f.snapshotPath)); const names = readdirSync(f.root);
  const result = auditOfflineSnapshot(f);
  assert.equal(result.ledgerRecords, 3); assert.equal(result.unsupportedLedgerRecords, 2);
  assert.equal(result.collisions.length, 1); assert.equal(result.collisions[0].disposition, "unverified");
  assert.equal(digest(readFileSync(f.snapshotPath)), before); assert.deepEqual(readdirSync(f.root), names);
});
test("requires offline assertion and refuses every sidecar before reading", () => {
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    const f = fixture(); assert.throws(() => auditOfflineSnapshot({ ...f, offlineSnapshot: false }), /confirmation/);
    writeFileSync(f.snapshotPath + suffix, "sidecar"); const before = digest(readFileSync(f.snapshotPath));
    assert.throws(() => auditOfflineSnapshot(f), /sidecar/); assert.equal(digest(readFileSync(f.snapshotPath)), before);
  }
});
test("fails on duplicate migration slots without changing snapshot", () => {
  const f = fixture(); writeFileSync(join(f.migrationsDir, "185_other.sql"), "SELECT 2;");
  const before = digest(readFileSync(f.snapshotPath));
  assert.throws(() => auditOfflineSnapshot(f), /Duplicate migration/); assert.equal(digest(readFileSync(f.snapshotPath)), before);
});
