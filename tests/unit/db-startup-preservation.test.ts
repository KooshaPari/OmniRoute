import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { Database } from "bun:sqlite";

function start(dataDir: string) {
  const coreUrl = pathToFileURL(path.resolve("src/lib/db/core.ts")).href;
  const code = "try { const core=await import(process.env.TEST_CORE_URL); core.getDbInstance(); console.log('UNEXPECTED_SUCCESS'); process.exitCode=3; } catch(e) { console.log('STARTUP_ERROR:'+String(e?.message ?? e)); }";
  return spawnSync(process.execPath, ["-e", code], { cwd: process.cwd(), env: { ...process.env, DATA_DIR: dataDir, TEST_CORE_URL: coreUrl }, encoding: "utf8", timeout: 30000, windowsHide: true });
}

for (const data of [false, true]) {
  test(`legacy schema with data=${data} preserves main and committed WAL`, { timeout: 45000 }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-startup-legacy-")); const file = path.join(dir, "storage.sqlite");
    const db = new Database(file);
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE schema_migrations(version TEXT); CREATE TABLE provider_connections(id TEXT PRIMARY KEY); CREATE TABLE important(value TEXT); INSERT INTO important VALUES ('preserve'); ${data ? "INSERT INTO provider_connections VALUES ('one');" : ""}`);
    const before = fs.readFileSync(file), walBefore = fs.readFileSync(file + "-wal");
    try {
      const result = start(dir); assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Manual recovery required: legacy schema detected/);
      assert.deepEqual(fs.readFileSync(file), before); assert.deepEqual(fs.readFileSync(file + "-wal"), walBefore);
      assert.equal(fs.existsSync(file + ".old-schema"), false);
      assert.deepEqual(db.query("SELECT value FROM important").all(), [{ value: "preserve" }]);
    } finally { db.close(); }
  });
}

test("missing main with preserved probe artifact and WAL does not restore or initialize", { timeout: 45000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-startup-orphan-")); const file = path.join(dir, "storage.sqlite");
  fs.writeFileSync(file + ".probe-failed-123", "artifact"); fs.writeFileSync(file + "-wal", "wal evidence");
  const result = start(dir); assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Manual recovery required/);
  assert.equal(fs.existsSync(file), false); assert.equal(fs.readFileSync(file + ".probe-failed-123", "utf8"), "artifact"); assert.equal(fs.readFileSync(file + "-wal", "utf8"), "wal evidence");
});

test("failed probe does not rename an existing SQLite main file", { timeout: 45000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-startup-invalid-")); const file = path.join(dir, "storage.sqlite"); fs.writeFileSync(file, "not a database");
  const result = start(dir); assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Manual recovery required: the existing database probe failed/);
  assert.equal(fs.readFileSync(file, "utf8"), "not a database"); assert.equal(fs.readdirSync(dir).some((name) => name.includes("probe-failed")), false);
});

for (const existing of [false, true]) {
  test(`ordinary startup remains available with existing=${existing}`, { timeout: 60000 }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-startup-normal-"));
    const migrations = fs.mkdtempSync(path.join(os.tmpdir(), "omni-startup-migrations-"));
    fs.writeFileSync(path.join(migrations, "999_fixture.sql"), "CREATE TABLE IF NOT EXISTS fixture_marker(id INTEGER);");
    if (existing) { const seed = new Database(path.join(dir, "storage.sqlite")); seed.exec("CREATE TABLE existing_evidence(value TEXT); INSERT INTO existing_evidence VALUES ('keep')"); seed.close(); }
    const coreUrl = pathToFileURL(path.resolve("src/lib/db/core.ts")).href;
    const code = "const core=await import(process.env.TEST_CORE_URL); const db=core.getDbInstance(); console.log('STARTUP_OK'); core.closeDbInstance();";
    const result = spawnSync(process.execPath, ["-e", code], { cwd: process.cwd(), env: { ...process.env, DATA_DIR: dir, TEST_CORE_URL: coreUrl, NODE_ENV: "test", OMNIROUTE_MIGRATIONS_DIR: migrations, OMNIROUTE_SKIP_DB_HEALTHCHECK: "1" }, encoding: "utf8", timeout: 45000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /STARTUP_OK/);
    if (existing) { const reopened = new Database(path.join(dir, "storage.sqlite"), { readonly: true }); try { assert.deepEqual(reopened.query("SELECT value FROM existing_evidence").all(), [{ value: "keep" }]); } finally { reopened.close(); } }
  });
}

test("transient schema-query failure aborts rather than trusting an open-only retry", { timeout: 45000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-startup-transient-")); const file = path.join(dir, "storage.sqlite");
  const db = new Database(file); db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE schema_migrations(version TEXT); CREATE TABLE provider_connections(id TEXT); CREATE TABLE important(value TEXT); INSERT INTO important VALUES ('preserve')");
  const before = fs.readFileSync(file), walBefore = fs.readFileSync(file + "-wal");
  const coreUrl = pathToFileURL(path.resolve("src/lib/db/core.ts")).href;
  const code = `import { Database } from 'bun:sqlite'; const original=Database.prototype.query; const close=Database.prototype.close; let injected=false, closed=0; Database.prototype.query=function(sql) { if(!injected && String(sql).includes('schema_migrations')) { injected=true; const e=new Error('database is locked'); e.code='SQLITE_BUSY'; throw e; } return original.call(this,sql); }; Database.prototype.close=function(...args) { closed++; return close.apply(this,args); }; try { const core=await import(process.env.TEST_CORE_URL); core.getDbInstance(); console.log('UNEXPECTED_SUCCESS'); process.exitCode=3; } catch(e) { console.log('STARTUP_ERROR:'+String(e?.message ?? e)); } finally { console.log('INJECTED='+injected+' CLOSED='+closed); }`;
  try {
    const result = spawnSync(process.execPath, ["-e", code], { cwd: process.cwd(), env: { ...process.env, DATA_DIR: dir, TEST_CORE_URL: coreUrl }, encoding: "utf8", timeout: 30000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Manual recovery required: the existing database probe failed/);
    assert.match(result.stdout, /INJECTED=true CLOSED=[1-9]/);
    assert.deepEqual(fs.readFileSync(file), before); assert.deepEqual(fs.readFileSync(file + "-wal"), walBefore);
    assert.deepEqual(db.query("SELECT value FROM important").all(), [{ value: "preserve" }]);
  } finally { db.close(); }
});

test("mixed-case legacy table is detected without changing main or WAL", { timeout: 45000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-startup-case-")); const file = path.join(dir, "storage.sqlite");
  const db = new Database(file); db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE Schema_Migrations(version TEXT); CREATE TABLE important(value TEXT); INSERT INTO important VALUES ('keep')");
  const before = fs.readFileSync(file), wal = fs.readFileSync(file + "-wal");
  try { const result = start(dir); assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Manual recovery required: legacy schema detected/); assert.deepEqual(fs.readFileSync(file), before); assert.deepEqual(fs.readFileSync(file + "-wal"), wal); assert.deepEqual(db.query("SELECT value FROM important").all(), [{ value: "keep" }]); } finally { db.close(); }
});

test("probe and close errors are both preserved", { timeout: 45000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-startup-close-")); const file = path.join(dir, "storage.sqlite");
  const db = new Database(file); db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE important(value TEXT); INSERT INTO important VALUES ('keep')");
  const before = fs.readFileSync(file), wal = fs.readFileSync(file + "-wal");
  const coreUrl = pathToFileURL(path.resolve("src/lib/db/core.ts")).href;
  const code = `import { Database } from 'bun:sqlite'; const query=Database.prototype.query; const close=Database.prototype.close; Database.prototype.query=function(sql) { if(String(sql).includes('schema_migrations')) { const e=new Error('forced SQLITE_BUSY'); e.code='SQLITE_BUSY'; throw e; } return query.call(this,sql); }; Database.prototype.close=function(...args) { close.apply(this,args); throw new Error('forced close failure'); }; try { const core=await import(process.env.TEST_CORE_URL); core.getDbInstance(); console.log('UNEXPECTED_SUCCESS'); process.exitCode=3; } catch(e) { console.log('RESULT:'+JSON.stringify({name:e.name, errors:Array.isArray(e.errors)?e.errors.map(x=>String(x.message)):[]})); }`;
  try {
    const result = spawnSync(process.execPath, ["-e", code], { cwd: process.cwd(), env: { ...process.env, DATA_DIR: dir, TEST_CORE_URL: coreUrl }, encoding: "utf8", timeout: 30000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /AggregateError/); assert.match(result.stdout, /Manual recovery required: the existing database probe failed/); assert.match(result.stdout, /forced close failure/);
    assert.deepEqual(fs.readFileSync(file), before); assert.deepEqual(fs.readFileSync(file + "-wal"), wal);
  } finally { db.close(); }
});
