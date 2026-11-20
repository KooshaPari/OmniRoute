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
    const { getMigrationStatus, runMigrations, MigrationLedgerCollisionError } = await import("../../../src/lib/db/migrationRunner");
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
          try {
            getMigrationStatus(db);
            throw new Error("Expected a ledger collision");
          } catch (error) {
            expect(error).toBeInstanceOf(MigrationLedgerCollisionError);
            expect((error as InstanceType<typeof MigrationLedgerCollisionError>).objectType).toBe(state === "collision" ? "view" : "index");
          }
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
    const raw = new Database(":memory:");
    const db = createBunSqliteAdapter(raw, ":memory:");
    try {
      db.exec("CREATE TABLE main._omniroute_migrations (version TEXT PRIMARY KEY, name TEXT, applied_at TEXT DEFAULT 'time'); INSERT INTO main._omniroute_migrations (version, name) VALUES ('001', 'first'); CREATE TEMP TABLE _omniroute_migrations (version TEXT PRIMARY KEY, name TEXT, applied_at TEXT DEFAULT 'time'); INSERT INTO temp._omniroute_migrations (version, name) VALUES ('002', 'shadow')");
      expect(runMigrations(db, { isNewDb: true })).toBe(1);
      expect(raw.query("SELECT version FROM main._omniroute_migrations ORDER BY version").all()).toEqual([{ version: "001" }, { version: "002" }]);
      expect(raw.query("SELECT version, name FROM temp._omniroute_migrations").all()).toEqual([{ version: "002", name: "shadow" }]);
      expect(getMigrationStatus(db).pending).toEqual([]);
    } finally { db.close(); }
    const { reconcileRenumberedMigrations } = await import("../../../src/lib/db/migrationRunner/schemaState");
    const repairRaw = new Database(":memory:");
    const repair = createBunSqliteAdapter(repairRaw, ":memory:");
    try {
      repair.exec("CREATE TABLE main._omniroute_migrations (version TEXT PRIMARY KEY, name TEXT); INSERT INTO main._omniroute_migrations VALUES ('028', 'compression_settings'); CREATE TEMP TABLE _omniroute_migrations (version TEXT PRIMARY KEY, name TEXT); INSERT INTO temp._omniroute_migrations VALUES ('028', 'shadow')");
      expect(reconcileRenumberedMigrations(repair, [{ version: "028", name: "other", path: "" }, { version: "034", name: "compression_settings", path: "" }])).toBe(true);
      expect(repairRaw.query("SELECT version, name FROM main._omniroute_migrations").all()).toEqual([{ version: "034", name: "compression_settings" }]);
      expect(repairRaw.query("SELECT version, name FROM temp._omniroute_migrations").all()).toEqual([{ version: "028", name: "shadow" }]);
    } finally { repair.close(); }
    const startupRaw = new Database(":memory:");
    try {
      startupRaw.exec("CREATE TEMP TABLE _omniroute_migrations (version TEXT PRIMARY KEY, name TEXT); INSERT INTO temp._omniroute_migrations VALUES ('999', 'shadow')");
      const core = fs.readFileSync(path.resolve("src/lib/db/core.ts"), "utf8");
      const seed = core.match(/db\.exec\(`\s*(CREATE TABLE IF NOT EXISTS main\._omniroute_migrations[\s\S]*?)`\);/);
      expect(seed).not.toBeNull();
      startupRaw.exec(seed![1]);
      const settings = fs.readFileSync(path.resolve("src/lib/db/databaseSettings.ts"), "utf8");
      const versionQuery = settings.match(/\.prepare\("(SELECT MAX\(CAST\(version AS INTEGER\)\) AS version FROM main\._omniroute_migrations)"\)/);
      expect(versionQuery).not.toBeNull();
      expect(startupRaw.query(versionQuery![1]).get()).toEqual({ version: 1 });
      expect(startupRaw.query("SELECT version, name FROM temp._omniroute_migrations").all()).toEqual([{ version: "999", name: "shadow" }]);
    } finally { startupRaw.close(); }
  } finally {
    if (previous === undefined) delete process.env.OMNIROUTE_MIGRATIONS_DIR;
    else process.env.OMNIROUTE_MIGRATIONS_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
