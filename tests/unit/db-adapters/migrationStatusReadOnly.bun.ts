import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createBunSqliteAdapter } from "../../../src/lib/db/adapters/bunSqliteAdapter";

test("migration status reads missing and existing ledgers and refuses collisions", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-status-"));
  const previous = process.env.OMNIROUTE_MIGRATIONS_DIR;
  process.env.OMNIROUTE_MIGRATIONS_DIR = dir;
  fs.writeFileSync(path.join(dir, "001_first.sql"), "SELECT 1;");
  fs.writeFileSync(path.join(dir, "002_second.sql"), "SELECT 2;");
  try {
    const { getMigrationStatus } = await import("../../../src/lib/db/migrationRunner");
    for (const state of ["missing", "empty", "existing", "mixedcase", "triggerfirst", "triggeronly", "collision", "indexcollision", "malformed"] as const) {
      const file = path.join(dir, `${state}.sqlite`);
      const setup = new Database(file);
      if (state === "existing" || state === "empty") setup.exec("CREATE TABLE _omniroute_migrations (version TEXT, name TEXT, applied_at TEXT)");
      if (state === "existing") setup.exec("INSERT INTO _omniroute_migrations VALUES ('001', 'first', 'time')");
      if (state === "mixedcase") setup.exec("CREATE TABLE _OmniRoute_Migrations (version TEXT, name TEXT, applied_at TEXT); INSERT INTO _OmniRoute_Migrations VALUES ('001', 'first', 'time')");
      if (state === "triggerfirst") setup.exec("CREATE TABLE host (id INTEGER); CREATE TRIGGER _omniroute_migrations AFTER INSERT ON host BEGIN SELECT 1; END; CREATE TABLE _omniroute_migrations (version TEXT, name TEXT, applied_at TEXT); INSERT INTO _omniroute_migrations VALUES ('001', 'first', 'time')");
      if (state === "triggeronly") setup.exec("CREATE TABLE host (id INTEGER); CREATE TRIGGER _omniroute_migrations AFTER INSERT ON host BEGIN SELECT 1; END");
      if (state === "collision") setup.exec("CREATE VIEW _OmniRoute_Migrations AS SELECT 1");
      if (state === "indexcollision") setup.exec("CREATE TABLE host (id INTEGER); CREATE INDEX _omniroute_migrations ON host(id)");
      if (state === "malformed") setup.exec("CREATE TABLE _omniroute_migrations (wrong_column TEXT)");
      setup.close();
      const before = fs.readFileSync(file);
      const db = createBunSqliteAdapter(new Database(file, { readonly: true }), file);
      try {
        if (state === "existing") db.exec("CREATE TEMP TABLE _omniroute_migrations (version TEXT, name TEXT, applied_at TEXT); INSERT INTO temp._omniroute_migrations VALUES ('002', 'shadow', 'time')");
        if (state === "collision" || state === "indexcollision") {
          expect(() => getMigrationStatus(db)).toThrow("non-table object");
        } else if (state === "malformed") {
          expect(() => getMigrationStatus(db)).toThrow();
        } else {
          const status = getMigrationStatus(db);
          const hasApplied = state === "existing" || state === "mixedcase" || state === "triggerfirst";
          expect(status.applied.map((row) => row.version)).toEqual(hasApplied ? ["001"] : []);
          expect(status.pending.map((row) => row.version)).toEqual(hasApplied ? ["002"] : ["001", "002"]);
        }
      } finally { db.close(); }
      expect(fs.readFileSync(file)).toEqual(before);
    }
  } finally {
    if (previous === undefined) delete process.env.OMNIROUTE_MIGRATIONS_DIR;
    else process.env.OMNIROUTE_MIGRATIONS_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
