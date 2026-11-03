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
await import("../../src/lib/db/migrationRunner.ts");
process.env.OMNIROUTE_MIGRATIONS_DIR = dir;
const runnerPath = `../../src/lib/db/migrationRunner.ts?test163=${Date.now()}`;
const { runMigrations } = await import(runnerPath);
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

test("a competing connection applying radar after planning is accepted only for the same migration", () => {
  for (const name of ["radar_feed_cache_generated_at", "unexpected", "duplicate column name"]) {
    const file = path.join(dir, `${name}.sqlite`);
    const db = createNodeSqliteAdapterFromDatabase(new DatabaseSync(file), ":memory:");
    const other = new DatabaseSync(file);
    db.exec(`CREATE TABLE _omniroute_migrations (version TEXT PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')));
      INSERT INTO _omniroute_migrations (version, name) VALUES ('169', 'model_capabilities');
      CREATE TABLE radar_feed_cache (id INTEGER PRIMARY KEY, payload TEXT);
      INSERT INTO radar_feed_cache VALUES (1, 'preserve');`);
    const transaction = db.transaction.bind(db);
    let injected = false;
    db.transaction = (fn) => {
      if (!injected) {
        injected = true;
        other.exec(`ALTER TABLE radar_feed_cache ADD COLUMN generated_at TEXT;
          INSERT INTO _omniroute_migrations (version, name) VALUES ('163', '${name}');`);
      }
      return transaction(fn);
    };
    try {
      if (name !== "radar_feed_cache_generated_at") {
        assert.throws(() => runMigrations(db), /unexpected/);
      } else {
        assert.equal(runMigrations(db), 0);
      }
      assert.equal(
        (db.prepare("SELECT name FROM _omniroute_migrations WHERE version = '163'").get() as { name: string }).name,
        name
      );
      assert.equal(
        (db.prepare("SELECT payload FROM radar_feed_cache").get() as { payload: string }).payload,
        "preserve"
      );
    } finally {
      other.close();
      db.close();
    }
  }
});

for (const [rivalName, symbolic] of [["radar_feed_cache_generated_at", false], ["unexpected", false], ["radar_feed_cache_generated_at", true]] as const) test(`competing WAL writer after ledger read: ${rivalName} symbolic=${symbolic}`, () => {
  const file = path.join(dir, `wal-race-${rivalName}-${symbolic}.sqlite`);
  const db = createNodeSqliteAdapterFromDatabase(new DatabaseSync(file), ":memory:");
  const other = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE _omniroute_migrations (version TEXT PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now'))); INSERT INTO _omniroute_migrations (version, name) VALUES ('169', 'model_capabilities'); CREATE TABLE radar_feed_cache (id INTEGER PRIMARY KEY, payload TEXT); INSERT INTO radar_feed_cache VALUES (1, 'preserve');`);
  const prepare = db.prepare.bind(db);
  let injected = false;
  const transaction = db.transaction.bind(db);
  if (symbolic) db.transaction = (fn) => {
    const run = transaction(fn);
    return () => {
      try { return run(); } catch (err) {
        if ((err as { errcode?: number }).errcode === 517) throw Object.assign(new Error("busy snapshot"), { code: "SQLITE_BUSY_SNAPSHOT" });
        throw err;
      }
    };
  };
  db.prepare = (sql) => {
    const stmt = prepare(sql);
    if (sql === "SELECT name FROM _omniroute_migrations WHERE version = ?") {
      const get = stmt.get.bind(stmt);
      stmt.get = (...args) => {
        const result = get(...args);
        if (!injected) {
          injected = true;
          other.exec(`ALTER TABLE radar_feed_cache ADD COLUMN generated_at TEXT; INSERT INTO _omniroute_migrations (version, name) VALUES ('163', '${rivalName}');`);
        }
        return result;
      };
    }
    return stmt;
  };
  try {
    if (rivalName === "unexpected") assert.throws(() => runMigrations(db), /unexpected/);
    else assert.equal(runMigrations(db), 0);
  } finally { other.close(); db.close(); }
});

test("ordinary SQLite busy is not retried", () => {
  const db = legacyDb(false);
  let calls = 0;
  db.transaction = () => {
    return () => { calls++; throw Object.assign(new Error("busy"), { code: "SQLITE_BUSY" }); };
  };
  try {
    assert.throws(() => runMigrations(db), /busy/);
    assert.equal(calls, 1);
  } finally { db.close(); }
});

test("a competing migration 169 is accepted only when its ledger name matches", () => {
  for (const name of ["model_capabilities", "duplicate column name"]) {
    const file = path.join(dir, `race169-${name}.sqlite`);
    const db = createNodeSqliteAdapterFromDatabase(new DatabaseSync(file), ":memory:");
    const other = new DatabaseSync(file);
    db.exec("CREATE TABLE _omniroute_migrations (version TEXT PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now'))); INSERT INTO _omniroute_migrations (version, name) VALUES ('163', 'radar_feed_cache_generated_at'); CREATE TABLE preserved (value TEXT); INSERT INTO preserved VALUES ('retained');");
    const transaction = db.transaction.bind(db);
    let injected = false;
    db.transaction = (fn) => {
      if (!injected) {
        injected = true;
        other.exec(`CREATE TABLE model_capabilities (provider TEXT, model_id TEXT); INSERT INTO model_capabilities VALUES ('p', 'm'); INSERT INTO _omniroute_migrations (version, name) VALUES ('169', '${name}');`);
      }
      return transaction(fn);
    };
    try {
      if (name === "model_capabilities") {
        assert.equal(runMigrations(db), 0);
        assert.equal(runMigrations(db), 0);
      } else assert.throws(() => runMigrations(db), /occupied by an unexpected migration/);
      assert.equal((db.prepare("SELECT value FROM preserved").get() as { value: string }).value, "retained");
      assert.equal((db.prepare("SELECT model_id FROM model_capabilities").get() as { model_id: string }).model_id, "m");
      assert.equal((db.prepare("SELECT name FROM _omniroute_migrations WHERE version = '169'").get() as { name: string }).name, name);
    } finally { other.close(); db.close(); }
  }
});

test("a WAL snapshot conflict on migration 169 retries after rollback", () => {
  const file = path.join(dir, "wal169.sqlite");
  const db = createNodeSqliteAdapterFromDatabase(new DatabaseSync(file), ":memory:");
  const other = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE _omniroute_migrations (version TEXT PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now'))); INSERT INTO _omniroute_migrations (version, name) VALUES ('163', 'radar_feed_cache_generated_at');");
  const prepare = db.prepare.bind(db);
  let injected = false;
  db.prepare = (sql) => {
    const stmt = prepare(sql);
    if (sql === "SELECT name FROM _omniroute_migrations WHERE version = ?") {
      const get = stmt.get.bind(stmt);
      stmt.get = (...args) => {
        const result = get(...args);
        if (!injected) {
          injected = true;
          other.exec("CREATE TABLE model_capabilities (provider TEXT, model_id TEXT); INSERT INTO model_capabilities VALUES ('p', 'm'); INSERT INTO _omniroute_migrations (version, name) VALUES ('169', 'model_capabilities');");
        }
        return result;
      };
    }
    return stmt;
  };
  try {
    assert.equal(runMigrations(db), 0);
    assert.equal(runMigrations(db), 0);
    assert.equal((db.prepare("SELECT model_id FROM model_capabilities").get() as { model_id: string }).model_id, "m");
  } finally { other.close(); db.close(); }
});
