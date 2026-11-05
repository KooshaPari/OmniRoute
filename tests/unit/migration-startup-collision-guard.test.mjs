import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { assertStartupMigrationIdentities } from "../../src/lib/db/migrationRunner/startupCollisionGuard.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function fixture(rows) {
  const path = join(mkdtempSync(join(tmpdir(),"omni-startup-guard-")),"db.sqlite");
  const db = new DatabaseSync(path); db.exec("CREATE TABLE _omniroute_migrations(version TEXT PRIMARY KEY,name TEXT NOT NULL)");
  const insert = db.prepare("INSERT INTO _omniroute_migrations VALUES (?,?)"); for (const [version,name] of rows) insert.run(version,name);
  db.close(); return path;
}
test("matching and pending identities pass without writing the existing database", () => {
  const path=fixture([["001","initial"],["185","old"]]); const before=hash(readFileSync(path));
  const db=new DatabaseSync(path,{readOnly:true}); assert.doesNotThrow(()=>assertStartupMigrationIdentities(db,[{version:"001",name:"initial"},{version:"185",name:"old"},{version:"186",name:"pending"}])); db.close();
  assert.equal(hash(readFileSync(path)),before);
});
test("collision blocks without changing ledger or schema", () => {
  const path=fixture([["185","provider_param_filters"]]);const before=hash(readFileSync(path));const db=new DatabaseSync(path,{readOnly:true});
  assert.throws(()=>assertStartupMigrationIdentities(db,[{version:"185",name:"usage_history_cpa_auth_index"}]),/blocked 1 collision/);db.close();assert.equal(hash(readFileSync(path)),before);
});
test("missing ledger, null identity, missing inventory and duplicate files fail closed", () => {
  const db=new DatabaseSync(":memory:"); assert.throws(()=>assertStartupMigrationIdentities(db,[]),/no migration files/);
  assert.throws(()=>assertStartupMigrationIdentities(db,[{version:"1",name:"a"}]),/requires an existing migration ledger/);
  db.exec("CREATE TABLE _omniroute_migrations(version TEXT,name TEXT);INSERT INTO _omniroute_migrations VALUES(NULL,'bad')");
  assert.throws(()=>assertStartupMigrationIdentities(db,[{version:"1",name:"a"}]),/invalid ledger/);
  db.exec("DELETE FROM _omniroute_migrations");assert.throws(()=>assertStartupMigrationIdentities(db,[{version:"1",name:"a"}]),/empty migration ledger/);
  db.exec("INSERT INTO _omniroute_migrations VALUES('1','a')");
  assert.throws(()=>assertStartupMigrationIdentities(db,[{version:"1",name:"a"},{version:"1",name:"b"}]),/Duplicate/);db.close();
});
test("strict guard runs before restore and remains opt-in", () => {
  const source=readFileSync(new URL("../../src/lib/db/core.ts",import.meta.url),"utf8");
  const opt=source.indexOf('process.env.OMNIROUTE_STRICT_MIGRATION_IDENTITIES === "1"');
  const audit=source.indexOf("assertStartupMigrationPreflight(auditDb)");
  const restore=source.indexOf("fs.renameSync(latestBackup, sqliteFile)");
  assert.ok(opt>=0 && opt<audit && audit<restore);
});
