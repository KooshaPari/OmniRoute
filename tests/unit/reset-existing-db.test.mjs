import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const driver = process.env.TEST_SQLITE_DRIVER || require.resolve("better-sqlite3");
const Database = require(driver);
const project = fileURLToPath(new URL("../../", import.meta.url));

test("reset cannot recreate a database removed between lookup and open", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reset-db-test-"));
  try {
    const cli = path.join(root, "cli");
    const commands = path.join(cli, "commands");
    const data = path.join(root, "data");
    const fake = path.join(cli, "node_modules", "better-sqlite3");
    fs.mkdirSync(commands, { recursive: true });
    fs.mkdirSync(data);
    fs.mkdirSync(fake, { recursive: true });
    fs.copyFileSync((process.env.TEST_RESET_SOURCE || path.join(project, "bin/cli/commands/reset-encrypted-columns.mjs")), path.join(commands, "reset-encrypted-columns.mjs"));
    fs.copyFileSync(path.join(project, "bin/cli/data-dir.mjs"), path.join(cli, "data-dir.mjs"));
    const dbPath = path.join(data, "storage.sqlite");
    const db = new Database(dbPath);
    db.exec("CREATE TABLE provider_connections (api_key TEXT, access_token TEXT, refresh_token TEXT, id_token TEXT)");
    db.close();
    fs.writeFileSync(dbPath + "-wal", "fixture sidecar");
    fs.writeFileSync(path.join(fake, "index.js"), "require(\"node:fs\").unlinkSync(process.env.TEST_DB_PATH); module.exports = require(process.env.TEST_SQLITE_DRIVER);");
    const entry = pathToFileURL(path.join(commands, "reset-encrypted-columns.mjs")).href;
    const code = "import { runResetEncryptedColumns } from " + JSON.stringify(entry) + "; process.exitCode = await runResetEncryptedColumns([\"--force\"]);";
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], { env: { ...process.env, DATA_DIR: data, TEST_DB_PATH: dbPath, TEST_SQLITE_DRIVER: driver }, encoding: "utf8" });
    assert.equal(result.status, 1, result.stderr);
    assert.equal(fs.existsSync(dbPath), false);
    assert.equal(fs.readFileSync(dbPath + "-wal", "utf8"), "fixture sidecar");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("reset still updates an existing database when explicitly forced", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reset-db-test-"));
  try {
    const cli = path.join(root, "cli");
    const commands = path.join(cli, "commands");
    const data = path.join(root, "data");
    const fake = path.join(cli, "node_modules", "better-sqlite3");
    fs.mkdirSync(commands, { recursive: true });
    fs.mkdirSync(data);
    fs.mkdirSync(fake, { recursive: true });
    fs.copyFileSync(path.join(project, "bin/cli/commands/reset-encrypted-columns.mjs"), path.join(commands, "reset-encrypted-columns.mjs"));
    fs.copyFileSync(path.join(project, "bin/cli/data-dir.mjs"), path.join(cli, "data-dir.mjs"));
    fs.writeFileSync(path.join(fake, "index.js"), "module.exports = require(process.env.TEST_SQLITE_DRIVER);");
    const dbPath = path.join(data, "storage.sqlite");
    const db = new Database(dbPath);
    db.exec("CREATE TABLE provider_connections (api_key TEXT, access_token TEXT, refresh_token TEXT, id_token TEXT); INSERT INTO provider_connections VALUES ('enc:v1:fixture', NULL, NULL, NULL); INSERT INTO provider_connections VALUES ('plain', NULL, NULL, NULL)");
    db.close();
    const entry = pathToFileURL(path.join(commands, "reset-encrypted-columns.mjs")).href;
    const code = "import { runResetEncryptedColumns } from " + JSON.stringify(entry) + "; process.exitCode = await runResetEncryptedColumns([\"--force\"]);";
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], { env: { ...process.env, DATA_DIR: data, TEST_SQLITE_DRIVER: driver }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const verify = new Database(dbPath, { readonly: true });
    assert.deepEqual(verify.prepare("SELECT api_key FROM provider_connections ORDER BY rowid").all(), [{ api_key: null }, { api_key: "plain" }]);
    verify.close();
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
