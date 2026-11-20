import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createBunSqliteAdapter } from "../../src/lib/db/adapters/bunSqliteAdapter.ts";
import { createNodeSqliteAdapterFromDatabase } from "../../src/lib/db/adapters/nodeSqliteShared.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-doc-migrations-"));
for (const name of ["141_interception_rules.sql", "200_provider_param_filters.sql"]) {
  fs.copyFileSync(path.join(process.cwd(), "src/lib/db/migrations", name), path.join(dir, name));
}
const originalDir = process.env.OMNIROUTE_MIGRATIONS_DIR;
process.env.OMNIROUTE_MIGRATIONS_DIR = dir;
const { runMigrations } = await import("../../src/lib/db/migrationRunner.ts?docMigrations");
if (originalDir === undefined) delete process.env.OMNIROUTE_MIGRATIONS_DIR;
else process.env.OMNIROUTE_MIGRATIONS_DIR = originalDir;

async function openDb() {
  if (typeof (globalThis as { Bun?: unknown }).Bun !== "undefined") {
    const { Database } = await import("bun:sqlite");
    return createBunSqliteAdapter(new Database(":memory:"), ":memory:");
  }
  const { DatabaseSync } = await import("node:sqlite");
  return createNodeSqliteAdapterFromDatabase(new DatabaseSync(":memory:"), ":memory:");
}

test("documentation migrations apply once and preserve data", async () => {
  const db = await openDb();
  try {
    db.exec(
      "CREATE TABLE protected_data (value TEXT); INSERT INTO protected_data VALUES ('keep');"
    );
    assert.equal(runMigrations(db), 2);
    assert.equal(runMigrations(db), 0);
    assert.equal(
      (db.prepare("SELECT value FROM protected_data").get() as { value: string }).value,
      "keep"
    );
    assert.deepEqual(
      db.prepare("SELECT version FROM _omniroute_migrations ORDER BY version").all(),
      [{ version: "141" }, { version: "200" }]
    );
  } finally {
    db.close();
  }
});

test("invalid SQL still fails without recording its migration", async () => {
  fs.writeFileSync(path.join(dir, "201_invalid.sql"), "THIS IS NOT SQL;");
  const db = await openDb();
  try {
    assert.throws(() => runMigrations(db), /syntax error/i);
    assert.equal(
      (
        db
          .prepare("SELECT count(*) AS n FROM _omniroute_migrations WHERE version = '201'")
          .get() as {
          n: number;
        }
      ).n,
      0
    );
  } finally {
    db.close();
  }
});
