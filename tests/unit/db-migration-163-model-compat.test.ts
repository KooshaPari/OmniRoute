import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createNodeSqliteAdapterFromDatabase } from "../../src/lib/db/adapters/nodeSqliteShared.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-163-compat-"));
for (const name of ["163_radar_feed_cache_generated_at.sql", "169_model_capabilities.sql"]) {
  fs.copyFileSync(path.join(process.cwd(), "src/lib/db/migrations", name), path.join(dir, name));
}
const originalDir = process.env.OMNIROUTE_MIGRATIONS_DIR;
process.env.OMNIROUTE_MIGRATIONS_DIR = dir;
const { runMigrations } = await import("../../src/lib/db/migrationRunner.ts");
if (originalDir === undefined) delete process.env.OMNIROUTE_MIGRATIONS_DIR;
else process.env.OMNIROUTE_MIGRATIONS_DIR = originalDir;

function legacyDb(hasGeneratedAt: boolean) {
  const db = createNodeSqliteAdapterFromDatabase(new DatabaseSync(":memory:"), ":memory:");
  db.exec(`
    CREATE TABLE _omniroute_migrations (version TEXT PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')));
    INSERT INTO _omniroute_migrations (version, name) VALUES ('163', 'model_capabilities');
    CREATE TABLE model_capabilities (provider TEXT, model_id TEXT);
    INSERT INTO model_capabilities VALUES ('provider', 'model');
    CREATE TABLE radar_feed_cache (id INTEGER PRIMARY KEY, payload TEXT${hasGeneratedAt ? ", generated_at TEXT" : ""});
    INSERT INTO radar_feed_cache (id, payload) VALUES (1, 'preserve');
  `);
  return db;
}

for (const hasGeneratedAt of [false, true]) {
  test(`legacy model migration preserves both tables when radar column ${hasGeneratedAt ? "exists" : "is absent"}`, () => {
    const db = legacyDb(hasGeneratedAt);
    try {
      let radarExecuted = false;
      const exec = db.exec.bind(db);
      db.exec = (sql) => {
        if (sql.includes("ALTER TABLE radar_feed_cache ADD COLUMN generated_at")) radarExecuted = true;
        exec(sql);
      };
      assert.equal(runMigrations(db), 1);
      assert.equal(radarExecuted, !hasGeneratedAt);
      assert.deepEqual(
        db.prepare("SELECT version, name FROM _omniroute_migrations ORDER BY version").all(),
        [
          { version: "163", name: "radar_feed_cache_generated_at" },
          { version: "169", name: "model_capabilities" },
        ]
      );
      assert.deepEqual(db.prepare("SELECT provider, model_id FROM model_capabilities").get(), {
        provider: "provider",
        model_id: "model",
      });
      assert.equal(
        (db.prepare("SELECT payload FROM radar_feed_cache").get() as { payload: string }).payload,
        "preserve"
      );
      const columns = db.prepare("PRAGMA table_info(radar_feed_cache)").all() as Array<{
        name: string;
      }>;
      assert.equal(columns.filter((column) => column.name === "generated_at").length, 1);
      assert.equal(runMigrations(db), 0);
    } finally {
      db.close();
    }
  });
}

test("an occupied target slot aborts without changing the legacy ledger or data", () => {
  const db = legacyDb(false);
  try {
    db.exec("INSERT INTO _omniroute_migrations (version, name) VALUES ('169', 'unexpected');");
    assert.throws(() => runMigrations(db), /target version 169 is occupied/);
    assert.deepEqual(
      db.prepare("SELECT version, name FROM _omniroute_migrations ORDER BY version").all(),
      [
        { version: "163", name: "model_capabilities" },
        { version: "169", name: "unexpected" },
      ]
    );
    assert.deepEqual(db.prepare("SELECT provider, model_id FROM model_capabilities").get(), {
      provider: "provider",
      model_id: "model",
    });
    assert.equal(
      (db.prepare("SELECT payload FROM radar_feed_cache").get() as { payload: string }).payload,
      "preserve"
    );
  } finally {
    db.close();
  }
});

