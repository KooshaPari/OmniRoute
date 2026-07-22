import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";

const serial = { concurrency: false };

async function importFresh(modulePath) {
  const url = pathToFileURL(path.resolve(modulePath)).href;
  return import(`${url}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function withMockedMigrationFs(files, fn) {
  const originalExistsSync = fs.existsSync;
  const originalReaddirSync = fs.readdirSync;
  const originalReadFileSync = fs.readFileSync;

  const isMigrationDir = (target) =>
    String(target).replaceAll("\\", "/").endsWith("/src/lib/db/migrations") ||
    String(target).replaceAll("\\", "/").endsWith("/migrations");

  fs.existsSync = (target) => {
    if (files === null && isMigrationDir(target)) return false;
    if (files && isMigrationDir(target)) return true;

    const fileName = path.basename(String(target));
    if (files && Object.hasOwn(files, fileName)) return true;

    return originalExistsSync(target);
  };

  fs.readdirSync = ((target: string, options?: Parameters<typeof originalReaddirSync>[1]) => {
    if (files && isMigrationDir(target)) {
      return Object.keys(files);
    }

    return originalReaddirSync(target, options);
  }) as unknown as typeof originalReaddirSync;

  fs.readFileSync = (target, options) => {
    const fileName = path.basename(String(target));
    if (files && Object.hasOwn(files, fileName)) {
      return files[fileName];
    }

    return originalReadFileSync(target, options);
  };

  try {
    return fn();
  } finally {
    fs.existsSync = originalExistsSync;
    fs.readdirSync = originalReaddirSync;
    fs.readFileSync = originalReadFileSync;
  }
}

function createDb() {
  return new Database(":memory:");
}

function createSqlJsLikeDb() {
  const db = createDb();

  return {
    driver: "sql.js",
    get open() {
      return true;
    },
    get name() {
      return ":memory:";
    },
    prepare(sql) {
      return db.prepare(sql);
    },
    exec(sql) {
      if (/fts5/i.test(sql)) {
        throw new Error("no such module: fts5");
      }
      db.exec(sql);
    },
    pragma(pragmaStr, options) {
      return db.pragma(pragmaStr, options);
    },
    transaction(fn) {
      const tx = db.transaction((...args) => fn(...args));
      return (...args) => tx(...args);
    },
    immediate(fn) {
      fn();
    },
    async backup() {},
    checkpoint() {},
    close() {
      db.close();
    },
    get raw() {
      return db;
    },
  };
}

function createInitialSchemaTables(db) {
  db.exec(`
    CREATE TABLE provider_connections (id TEXT PRIMARY KEY);
    CREATE TABLE combos (id TEXT PRIMARY KEY);
    CREATE TABLE call_logs (id TEXT PRIMARY KEY);
  `);
}

function buildMockMigrationFiles(startVersion, endVersion, prefix) {
  const files = {};

  for (let version = startVersion; version <= endVersion; version++) {
    const padded = String(version).padStart(3, "0");
    const fileName = version === 1 ? "001_initial_schema.sql" : `${padded}_${prefix}_${padded}.sql`;
    files[fileName] = `CREATE TABLE ${prefix}_${padded} (id INTEGER);`;
  }

  return files;
}

function withNonTestEnvironment(fn) {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVitest = process.env.VITEST;
  const originalDisableAutoBackup = process.env.DISABLE_SQLITE_AUTO_BACKUP;
  const originalArgv = [...process.argv];

  delete process.env.NODE_ENV;
  delete process.env.VITEST;
  delete process.env.DISABLE_SQLITE_AUTO_BACKUP;
  process.argv = process.argv.filter((arg) => !arg.includes("test"));

  try {
    return fn();
  } finally {
    process.argv = originalArgv;

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalVitest === undefined) delete process.env.VITEST;
    else process.env.VITEST = originalVitest;

    if (originalDisableAutoBackup === undefined) delete process.env.DISABLE_SQLITE_AUTO_BACKUP;
    else process.env.DISABLE_SQLITE_AUTO_BACKUP = originalDisableAutoBackup;
  }
}

const REAL_022_ADD_MEMORY_FTS5_SQL = fs.readFileSync(
  path.resolve("src/lib/db/migrations/022_add_memory_fts5.sql"),
  "utf8"
);
const REAL_023_FIX_MEMORY_FTS_UUID_SQL = fs.readFileSync(
  path.resolve("src/lib/db/migrations/023_fix_memory_fts_uuid.sql"),
  "utf8"
);

// ── #3416: OMNIROUTE_MAX_PENDING_MIGRATIONS env override ─────────────────────
// The mass-migration safety threshold must be overridable at runtime so a user
// restoring a backup can raise (or lower) the limit without code changes. The
// resolver reads the env var at CALL TIME inside runMigrations(), so these tests
// set/delete the env around the call and assert the abort message reflects the
// resolved threshold.

// Build an "existing DB" with only the migrations table + one applied row and no
// physical-schema sentinel tables, so inferPhysicalSchemaBaseline() returns null
// and the abort decision depends purely on the resolved threshold.
function seedExistingDbWithoutPhysicalBaseline(db) {
  db.exec(`
    CREATE TABLE _omniroute_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.prepare("INSERT INTO _omniroute_migrations (version, name) VALUES (?, ?)").run(
    "001",
    "initial_schema"
  );
}

test(
  "runMigrations aborts when OMNIROUTE_MAX_PENDING_MIGRATIONS lowers the threshold (#3416)",
  serial,
  async () => {
    const runner = await importFresh("src/lib/db/migrationRunner.ts");
    const db = createDb();
    const original = process.env.OMNIROUTE_MAX_PENDING_MIGRATIONS;

    try {
      seedExistingDbWithoutPhysicalBaseline(db);
      process.env.OMNIROUTE_MAX_PENDING_MIGRATIONS = "5";

      // 1 applied (001) + files 001..011 → 10 actionable pending > threshold 5.
      assert.throws(
        () =>
          withNonTestEnvironment(() =>
            withMockedMigrationFs(buildMockMigrationFiles(1, 11, "lower_threshold"), () =>
              runner.runMigrations(db)
            )
          ),
        /threshold is 5/i
      );
    } finally {
      if (original === undefined) delete process.env.OMNIROUTE_MAX_PENDING_MIGRATIONS;
      else process.env.OMNIROUTE_MAX_PENDING_MIGRATIONS = original;
      db.close();
    }
  }
);

test(
  "runMigrations allows a large pending set when OMNIROUTE_MAX_PENDING_MIGRATIONS raises the threshold (#3416)",
  serial,
  async () => {
    const runner = await importFresh("src/lib/db/migrationRunner.ts");
    const db = createDb();
    const original = process.env.OMNIROUTE_MAX_PENDING_MIGRATIONS;

    try {
      seedExistingDbWithoutPhysicalBaseline(db);
      process.env.OMNIROUTE_MAX_PENDING_MIGRATIONS = "500";

      // 1 applied (001) + 60 plain pending files at versions 100..159 (chosen to
      // avoid the special-cased migration versions 032/041/042). All 60 exceed the
      // default 50 threshold but stay well under the raised 500 limit, so they apply.
      const pendingFiles = {};
      for (let v = 100; v < 160; v++) {
        pendingFiles[`${v}_raise_threshold_${v}.sql`] =
          `CREATE TABLE raise_threshold_${v} (id INTEGER);`;
      }

      const count = withNonTestEnvironment(() =>
        withMockedMigrationFs(pendingFiles, () => runner.runMigrations(db))
      );

      assert.equal(count, 60);
    } finally {
      if (original === undefined) delete process.env.OMNIROUTE_MAX_PENDING_MIGRATIONS;
      else process.env.OMNIROUTE_MAX_PENDING_MIGRATIONS = original;
      db.close();
    }
  }
);

test(
  "runMigrations keeps the default 50 threshold when OMNIROUTE_MAX_PENDING_MIGRATIONS is unset or invalid (#3416)",
  serial,
  async () => {
    const runner = await importFresh("src/lib/db/migrationRunner.ts");
    const original = process.env.OMNIROUTE_MAX_PENDING_MIGRATIONS;

    try {
      // Case 1: env unset → default 50 abort message.
      delete process.env.OMNIROUTE_MAX_PENDING_MIGRATIONS;
      const dbUnset = createDb();
      try {
        seedExistingDbWithoutPhysicalBaseline(dbUnset);
        assert.throws(
          () =>
            withNonTestEnvironment(() =>
              withMockedMigrationFs(buildMockMigrationFiles(1, 60, "default_unset"), () =>
                runner.runMigrations(dbUnset)
              )
            ),
          /threshold is 50/i
        );
      } finally {
        dbUnset.close();
      }

      // Case 2: invalid (non-numeric) → fall back to default 50.
      process.env.OMNIROUTE_MAX_PENDING_MIGRATIONS = "abc";
      const dbInvalid = createDb();
      try {
        seedExistingDbWithoutPhysicalBaseline(dbInvalid);
        assert.throws(
          () =>
            withNonTestEnvironment(() =>
              withMockedMigrationFs(buildMockMigrationFiles(1, 60, "default_invalid"), () =>
                runner.runMigrations(dbInvalid)
              )
            ),
          /threshold is 50/i
        );
      } finally {
        dbInvalid.close();
      }
    } finally {
      if (original === undefined) delete process.env.OMNIROUTE_MAX_PENDING_MIGRATIONS;
      else process.env.OMNIROUTE_MAX_PENDING_MIGRATIONS = original;
    }
  }
);
