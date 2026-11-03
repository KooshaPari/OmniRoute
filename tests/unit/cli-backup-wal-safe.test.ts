import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { backupOpenSqliteDatabase, backupSqliteFile } from "../../bin/cli/sqlite.mjs";

test("CLI backup refuses a raw copy without a backup API", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-cli-no-backup-api-"));
  const file = path.join(dir, "storage.sqlite");
  const destination = path.join(dir, "refused.sqlite");
  fs.writeFileSync(file, "preserve");
  try {
    await assert.rejects(backupOpenSqliteDatabase({ exec() { throw new Error("must not checkpoint"); } }, file, destination), /WAL-consistent SQLite backup driver/);
    assert.equal(fs.existsSync(destination), false);
    assert.equal(fs.readFileSync(file, "utf8"), "preserve");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("CLI backup rejects raw copy and preserves a real active WAL", async (t) => {
  let Database: typeof import("better-sqlite3")["default"];
  try { ({ default: Database } = await import("better-sqlite3")); }
  catch (error) {
    if (/Cannot find (package|module).*better-sqlite3|ERR_DLOPEN_FAILED/i.test(String(error))) {
      t.skip("native better-sqlite3 is unavailable");
      return;
    }
    throw error;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-cli-wal-backup-"));
  const file = path.join(dir, "storage.sqlite");
  let writer: InstanceType<typeof Database>;
  try { writer = new Database(file); }
  catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    if (/Could not locate the bindings file|NODE_MODULE_VERSION|ERR_DLOPEN_FAILED/i.test(String(error))) {
      t.skip("native better-sqlite3 binding is unavailable");
      return;
    }
    throw error;
  }
  writer.pragma("journal_mode = WAL");
  writer.exec("CREATE TABLE witness (value TEXT); INSERT INTO witness VALUES ('committed')");
  const wal = fs.readFileSync(`${file}-wal`);
  const original = fs.readFileSync(file);
  const refused = path.join(dir, "refused.sqlite");
  const safe = path.join(dir, "safe.sqlite");
  try {
    await assert.rejects(backupOpenSqliteDatabase({ exec() { throw new Error("must not checkpoint"); } }, file, refused), /WAL-consistent SQLite backup driver/);
    assert.equal(fs.existsSync(refused), false);
    assert.ok(fs.readFileSync(file).equals(original));
    assert.ok(fs.readFileSync(`${file}-wal`).equals(wal));
    await backupSqliteFile(file, safe);
    const copy = new Database(safe, { readonly: true });
    try {
      assert.deepEqual(copy.prepare("SELECT value FROM witness").get(), { value: "committed" });
      assert.equal(copy.pragma("integrity_check", { simple: true }), "ok");
    } finally { copy.close(); }
    assert.ok(fs.readFileSync(`${file}-wal`).equals(wal));
  } finally {
    writer.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
import { createNodeSqliteAdapterFromDatabase } from "../../src/lib/db/adapters/nodeSqliteShared.ts";
import { createBunSqliteAdapter } from "../../src/lib/db/adapters/bunSqliteAdapter.ts";

test("actual fallback adapters cannot authorize raw backup merely by exposing backup", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-fallback-adapter-"));
  const file = path.join(dir, "storage.sqlite");
  fs.writeFileSync(file, "preserve-source");
  const fakeRaw = { exec() { throw new Error("must not checkpoint"); }, close() {} };
  const adapters = [
    createNodeSqliteAdapterFromDatabase(fakeRaw as never, file),
    createBunSqliteAdapter(fakeRaw as never, file),
  ];
  try {
    for (const [index, adapter] of adapters.entries()) {
      const destination = path.join(dir, `refused-${index}.sqlite`);
      assert.equal(typeof adapter.backup, "function");
      await assert.rejects(backupOpenSqliteDatabase(adapter, file, destination), /WAL-consistent SQLite backup driver/);
      assert.equal(fs.existsSync(destination), false);
      assert.equal(fs.readFileSync(file, "utf8"), "preserve-source");
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
