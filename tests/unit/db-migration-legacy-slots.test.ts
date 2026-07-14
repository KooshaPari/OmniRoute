import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import Database from "better-sqlite3";

const serial = { concurrency: false };
const migrationNames = [
  "100_bifrost_models.sql",
  "101_bifrost_shadow.sql",
  "113_cli_access_tokens.sql",
  "115_api_key_usage_limits.sql",
] as const;
const migrationFiles = Object.fromEntries(
  migrationNames.map((name) => [
    name,
    fs.readFileSync(path.resolve("src/lib/db/migrations", name), "utf8"),
  ])
);

async function importFresh(modulePath: string) {
  const url = pathToFileURL(path.resolve(modulePath)).href;
  return import(`${url}?test=${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function withMockedMigrationFs<T>(files: Record<string, string>, fn: () => T): T {
  const originalExistsSync = fs.existsSync;
  const originalReaddirSync = fs.readdirSync;
  const originalReadFileSync = fs.readFileSync;
  const isMigrationDir = (target: fs.PathLike) =>
    String(target).replaceAll("\\", "/").endsWith("/src/lib/db/migrations") ||
    String(target).replaceAll("\\", "/").endsWith("/migrations");

  fs.existsSync = (target) => {
    if (isMigrationDir(target)) return true;
    if (Object.hasOwn(files, path.basename(String(target)))) return true;
    return originalExistsSync(target);
  };
  fs.readdirSync = ((target: fs.PathLike, options?: unknown) => {
    if (isMigrationDir(target)) return Object.keys(files);
    return originalReaddirSync(target, options as never);
  }) as typeof fs.readdirSync;
  fs.readFileSync = ((target: fs.PathOrFileDescriptor, options?: unknown) => {
    const fileName = path.basename(String(target));
    if (Object.hasOwn(files, fileName)) return files[fileName];
    return originalReadFileSync(target, options as never);
  }) as typeof fs.readFileSync;

  try {
    return fn();
  } finally {
    fs.existsSync = originalExistsSync;
    fs.readdirSync = originalReaddirSync;
    fs.readFileSync = originalReadFileSync;
  }
}

test(
  "runMigrations rehomes legacy 100/101 markers before canonical Bifrost migrations",
  serial,
  async () => {
    const runner = await importFresh("src/lib/db/migrationRunner.ts");
    const db = new Database(":memory:");

    try {
      db.exec(`
        CREATE TABLE _omniroute_migrations (
          version TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO _omniroute_migrations (version, name) VALUES
          ('100', 'cli_access_tokens'),
          ('101', 'api_key_usage_limits');

        CREATE TABLE cli_access_tokens (
          id TEXT PRIMARY KEY,
          token_hash TEXT NOT NULL UNIQUE,
          token_prefix TEXT NOT NULL,
          name TEXT NOT NULL,
          scope TEXT NOT NULL DEFAULT 'read',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_used_at TEXT,
          expires_at TEXT,
          revoked_at TEXT
        );
        INSERT INTO cli_access_tokens (id, token_hash, token_prefix, name, scope)
          VALUES ('token-1', 'hash-1', 'omni_1', 'existing token', 'admin');

        CREATE TABLE api_keys (
          id TEXT PRIMARY KEY,
          usage_limit_enabled INTEGER NOT NULL DEFAULT 0,
          daily_usage_limit_usd REAL,
          weekly_usage_limit_usd REAL
        );
        INSERT INTO api_keys (
          id,
          usage_limit_enabled,
          daily_usage_limit_usd,
          weekly_usage_limit_usd
        ) VALUES ('key-1', 1, 12.5, 50.0);
      `);

      const appliedCount = withMockedMigrationFs(migrationFiles, () => runner.runMigrations(db));

      assert.equal(appliedCount, 4);
      assert.deepEqual(
        db
          .prepare("SELECT version, name FROM _omniroute_migrations ORDER BY version")
          .all()
          .map(({ version, name }) => `${version}:${name}`),
        [
          "100:bifrost_models",
          "101:bifrost_shadow",
          "113:cli_access_tokens",
          "115:api_key_usage_limits",
          "legacy-100-cli_access_tokens:cli_access_tokens",
          "legacy-101-api_key_usage_limits:api_key_usage_limits",
        ]
      );
      assert.ok(
        db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
          .get("bifrost_models")
      );
      assert.ok(
        db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
          .get("bifrost_shadow_events")
      );
      assert.deepEqual(db.prepare("SELECT name, scope FROM cli_access_tokens").get(), {
        name: "existing token",
        scope: "admin",
      });
      assert.deepEqual(
        db
          .prepare(
            "SELECT usage_limit_enabled, daily_usage_limit_usd, weekly_usage_limit_usd FROM api_keys"
          )
          .get(),
        {
          usage_limit_enabled: 1,
          daily_usage_limit_usd: 12.5,
          weekly_usage_limit_usd: 50,
        }
      );
    } finally {
      db.close();
    }
  }
);
