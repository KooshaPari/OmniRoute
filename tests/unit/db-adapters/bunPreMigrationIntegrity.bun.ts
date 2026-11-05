import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createBunSqliteAdapter } from "../../../src/lib/db/adapters/bunSqliteAdapter";
import { createPreMigrationBackup } from "../../../src/lib/db/migrationRunner/preMigrationBackup";

test("Bun pre-migration validation includes WAL and refuses corrupted stage", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bun-migration-integrity-"));
  const source = path.join(dir, "storage.sqlite");
  const raw = new Database(source);
  const db = createBunSqliteAdapter(raw, source);
  const originalOpen = fs.openSync;
  try {
    db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE items(value); INSERT INTO items VALUES(42)");
    const receipt = createPreMigrationBackup(db);
    expect(receipt).not.toBeNull();
    const snapshot = new Database(receipt!.path, { readonly: true });
    try {
      expect(snapshot.query("SELECT value FROM items").all()).toEqual([{ value: 42 }]);
      expect(snapshot.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    } finally { snapshot.close(); }
    const backupDir = path.join(dir, "db_backups");
    const before = fs.readdirSync(backupDir).sort();
    let injected = false;
    fs.openSync = ((file, flags, ...rest) => {
      const fd = originalOpen(file, flags, ...rest);
      if (!injected && String(file).endsWith("snapshot.sqlite") && flags === "r+") {
        injected = true;
        fs.writeSync(fd, Buffer.from("broken"), 0, 6, 0);
      }
      return fd;
    }) as typeof fs.openSync;
    expect(() => createPreMigrationBackup(db)).toThrow(/snapshot creation failed/i);
    expect(injected).toBe(true);
    expect(fs.readdirSync(backupDir).sort()).toEqual(before);
    expect(db.prepare("SELECT value FROM items").all()).toEqual([{ value: 42 }]);
  } finally {
    fs.openSync = originalOpen;
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
