import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { DatabaseSync } from "node:sqlite";
import { createBetterSqliteAdapter } from "../../src/lib/db/adapters/betterSqliteAdapter.ts";
import { createPreMigrationBackup } from "../../src/lib/db/migrationRunner/preMigrationBackup.ts";
import { createSqlJsAdapter } from "../../src/lib/db/adapters/sqljsAdapter.ts";

test("pre-migration snapshot is validated and corruption fails before publication", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-integrity-"));
  const source = path.join(dir, "storage.sqlite");
  const backupDir = path.join(dir, "db_backups");
  fs.mkdirSync(backupDir);
  const existing = path.join(backupDir, "existing.sqlite");
  fs.writeFileSync(existing, "preserve");
  const raw = new Database(source);
  const db = createBetterSqliteAdapter(raw);
  raw.exec("CREATE TABLE items(value TEXT); INSERT INTO items VALUES ('preserved')");
  try {
    const receipt = createPreMigrationBackup(db);
    assert.ok(receipt);
    const snapshot = new Database(receipt.path, { readonly: true });
    try {
      assert.equal(snapshot.pragma("integrity_check", { simple: true }), "ok");
      assert.deepEqual(snapshot.prepare("SELECT value FROM items").all(), [{ value: "preserved" }]);
    } finally { snapshot.close(); }
    const before = fs.readdirSync(backupDir).sort();
    const originalOpen = fs.openSync;
    let injected = false;
    fs.openSync = ((file, flags, ...rest) => {
      const fd = originalOpen(file, flags, ...rest);
      if (!injected && String(file).endsWith("snapshot.sqlite") && flags === "r+") {
        injected = true;
        fs.writeSync(fd, Buffer.from("broken"), 0, 6, 0);
      }
      return fd;
    }) as typeof fs.openSync;
    try {
      assert.throws(() => createPreMigrationBackup(db), /snapshot creation failed/i);
      assert.equal(injected, true);
    } finally { fs.openSync = originalOpen; }
    assert.deepEqual(fs.readdirSync(backupDir).sort(), before);
    assert.equal(fs.readFileSync(existing, "utf8"), "preserve");
    assert.deepEqual(raw.prepare("SELECT value FROM items").all(), [{ value: "preserved" }]);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("node:sqlite validator close failure refuses snapshot publication", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-integrity-node-"));
  const raw = new Database(path.join(dir, "storage.sqlite"));
  const db = createBetterSqliteAdapter(raw);
  const previous = process.env.OMNIROUTE_BUILDING;
  const originalClose = DatabaseSync.prototype.close;
  const originalPrepare = DatabaseSync.prototype.prepare;
  let closes = 0;
  try {
    raw.exec("CREATE TABLE items(value TEXT); INSERT INTO items VALUES ('preserved')");
    process.env.OMNIROUTE_BUILDING = "1";
    assert.ok(createPreMigrationBackup(db));
    const existing = fs.readdirSync(path.join(dir, "db_backups")).sort();
    DatabaseSync.prototype.close = function () {
      closes++;
      if (closes === 2) {
        originalClose.call(this);
        throw new Error("injected validator close failure");
      }
      return originalClose.call(this);
    };
    assert.throws(() => createPreMigrationBackup(db), /injected validator close failure/);
    assert.ok(closes >= 2);
    assert.deepEqual(fs.readdirSync(path.join(dir, "db_backups")).sort(), existing);
    closes = 0;
    DatabaseSync.prototype.prepare = function (sql) {
      if (sql === "PRAGMA integrity_check") throw new Error("injected validation failure");
      return originalPrepare.call(this, sql);
    };
    assert.throws(() => createPreMigrationBackup(db), (error: Error) => {
      assert.ok(error.cause instanceof AggregateError);
      assert.match(String(error.cause.errors[0]), /injected validation failure/);
      assert.match(String(error.cause.errors[1]), /injected validator close failure/);
      return true;
    });
    assert.deepEqual(fs.readdirSync(path.join(dir, "db_backups")).sort(), existing);
    assert.deepEqual(raw.prepare("SELECT value FROM items").all(), [{ value: "preserved" }]);
  } finally {
    DatabaseSync.prototype.close = originalClose;
    DatabaseSync.prototype.prepare = originalPrepare;
    if (previous === undefined) delete process.env.OMNIROUTE_BUILDING;
    else process.env.OMNIROUTE_BUILDING = previous;
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("sql.js snapshot clone checks integrity and refuses corrupted staged output", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-integrity-sqljs-"));
  const db = await createSqlJsAdapter(path.join(dir, "storage.sqlite"));
  try {
    db.exec("CREATE TABLE items(value TEXT); INSERT INTO items VALUES ('preserved')");
    const receipt = createPreMigrationBackup(db);
    assert.ok(receipt);
    const check = new Database(receipt.path, { readonly: true });
    try { assert.equal(check.pragma("integrity_check", { simple: true }), "ok"); }
    finally { check.close(); }
    const backupDir = path.join(dir, "db_backups");
    const before = fs.readdirSync(backupDir).sort();
    const originalWrite = fs.writeFileSync;
    let injected = false;
    fs.writeFileSync = ((file, data, options) => {
      originalWrite(file, data, options);
      if (typeof file === "number" && !injected) {
        injected = true;
        fs.writeSync(file, Buffer.from("broken"), 0, 6, 0);
      }
    }) as typeof fs.writeFileSync;
    try {
      assert.throws(() => createPreMigrationBackup(db), /snapshot creation failed/i);
      assert.equal(injected, true);
    } finally { fs.writeFileSync = originalWrite; }
    assert.deepEqual(fs.readdirSync(backupDir).sort(), before);
    assert.deepEqual(db.prepare("SELECT value FROM items").all(), [{ value: "preserved" }]);
    const prototype = Object.getPrototypeOf(db.raw) as { exec: (...args: any[]) => unknown; close: () => void };
    const originalExec = prototype.exec;
    const originalClose = prototype.close;
    let validatorFailed = false;
    try {
      prototype.exec = function (...args) {
        if (args[0] === "PRAGMA integrity_check") {
          validatorFailed = true;
          throw new Error("injected sql.js validation failure");
        }
        return originalExec.apply(this, args);
      };
      prototype.close = function () {
        originalClose.call(this);
        if (validatorFailed) {
          validatorFailed = false;
          throw new Error("injected sql.js close failure");
        }
      };
      assert.throws(() => createPreMigrationBackup(db), (error: Error) => {
        assert.ok(error.cause instanceof AggregateError);
        assert.match(String(error.cause.errors[0]), /injected sql.js validation failure/);
        assert.match(String(error.cause.errors[1]), /injected sql.js close failure/);
        return true;
      });
      assert.deepEqual(fs.readdirSync(backupDir).sort(), before);
    } finally {
      prototype.exec = originalExec;
      prototype.close = originalClose;
    }
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
