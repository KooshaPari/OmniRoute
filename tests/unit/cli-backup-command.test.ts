// ENVIRONMENT NOTE (sandbox better-sqlite3 / glibc limitation, not a code defect):
// This test constructs or exercises a real better-sqlite3-backed SQLite database.
// better-sqlite3 is a native addon; production and CI load it normally, but some
// sandboxes/dev boxes ship a system glibc older than the prebuilt binary requires
// ("GLIBC_2.29 not found"), so the native module fails to dlopen and any test that
// reaches better-sqlite3 directly (or asserts stdout that the load-failure warning
// would pollute) fails HERE while passing in CI. This is a known environment
// limitation, not a defect in the code under test: the OmniRoute runtime itself
// cascades to node:sqlite/sql.js when better-sqlite3 is unavailable. See
// tests/unit/_helpers/betterSqlite3Availability.ts for a guard helper.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ORIGINAL_DATA_DIR = process.env.DATA_DIR;

function createTempDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-cli-backup-"));
}

async function withBackupEnv(fn: (dataDir: string) => Promise<void>) {
  const dataDir = createTempDataDir();
  process.env.DATA_DIR = dataDir;

  const originalLog = console.log;
  console.log = () => {};

  try {
    await fn(dataDir);
  } finally {
    console.log = originalLog;
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    if (ORIGINAL_DATA_DIR === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = ORIGINAL_DATA_DIR;
  }
}

test("backup returns 0 with no files (empty data dir)", async () => {
  await withBackupEnv(async () => {
    const { runBackupCommand } = await import("../../bin/cli/commands/backup.mjs");
    const result = await runBackupCommand({});
    assert.equal(result, 0);
  });
});

test("backup creates backup-info.json when storage.sqlite exists", async () => {
  await withBackupEnv(async (dataDir) => {
    const dbPath = path.join(dataDir, "storage.sqlite");
    const Database = (await import("better-sqlite3")).default;
    new Database(dbPath).close();

    const { runBackupCommand } = await import("../../bin/cli/commands/backup.mjs");
    const result = await runBackupCommand({});
    assert.equal(result, 0);

    const backupDir = path.join(dataDir, "backups");
    assert.ok(fs.existsSync(backupDir));
    const entries = fs.readdirSync(backupDir).filter((d) => d.startsWith("omniroute-backup-"));
    assert.ok(entries.length > 0);
    const infoPath = path.join(backupDir, entries[0], "backup-info.json");
    assert.ok(fs.existsSync(infoPath));
    const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
    assert.ok(info.timestamp);
    assert.ok(Array.isArray(info.files));
  });
});

test("encrypted backup removes temporary ciphertext files", async () => {
  await withBackupEnv(async (dataDir) => {
    fs.writeFileSync(path.join(dataDir, "settings.json"), JSON.stringify({ ok: true }), "utf8");
    const keyFile = path.join(dataDir, "backup.key");
    fs.writeFileSync(keyFile, "test-passphrase", "utf8");

    const { runBackupCommand } = await import("../../bin/cli/commands/backup.mjs");
    const result = await runBackupCommand({ encrypt: true, keyFile });
    assert.equal(result, 0);

    const backupDir = path.join(dataDir, "backups");
    const entries = fs.readdirSync(backupDir).filter((d) => d.startsWith("omniroute-backup-"));
    assert.ok(entries.length > 0);
    const backupPath = path.join(backupDir, entries[0]);
    assert.deepEqual(
      fs.readdirSync(backupPath).filter((name) => name.endsWith(".ciphertext")),
      []
    );
    assert.ok(fs.existsSync(path.join(backupPath, "settings.json.enc")));
  });
});

test("restore --list returns 0 with no backups", async () => {
  await withBackupEnv(async () => {
    const { runRestoreCommand } = await import("../../bin/cli/commands/backup.mjs");
    const result = await runRestoreCommand(undefined, { list: true });
    assert.equal(result, 0);
  });
});

test("restore returns 1 when backup id not found", async () => {
  await withBackupEnv(async () => {
    const { runRestoreCommand } = await import("../../bin/cli/commands/backup.mjs");
    const originalError = console.error;
    console.error = () => {};
    const result = await runRestoreCommand("nonexistent-id", { yes: true });
    console.error = originalError;
    assert.equal(result, 1);
  });
});

test("restore refuses without changing an active SQLite WAL or configuration", async () => {
  await withBackupEnv(async (dataDir) => {
    const { default: Database } = await import("better-sqlite3");
    const { runRestoreCommand } = await import("../../bin/cli/commands/backup.mjs");
    const dbPath = path.join(dataDir, "storage.sqlite");
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec("CREATE TABLE witness (value TEXT); INSERT INTO witness VALUES ('preserved')");
    const config = path.join(dataDir, "settings.json");
    fs.writeFileSync(config, "preserved-config");
    const candidate = path.join(dataDir, "backups", "omniroute-backup-witness");
    fs.mkdirSync(candidate, { recursive: true });
    fs.writeFileSync(path.join(candidate, "storage.sqlite"), "candidate-data");
    fs.writeFileSync(path.join(candidate, "settings.json"), "candidate-config");
    const originalMain = fs.readFileSync(dbPath);
    const originalWal = fs.readFileSync(`${dbPath}-wal`);
    const originalError = console.error;
    const messages: string[] = [];
    console.error = (...args) => { messages.push(args.map(String).join(" ")); };
    try {
      assert.equal(await runRestoreCommand("witness", { yes: true }), 1);
      assert.equal(await runRestoreCommand("witness"), 1);
      assert.equal(await runRestoreCommand(undefined, { list: true }), 0);
      assert.ok(messages.every((message) => /offline recovery/i.test(message)));
      assert.equal(messages.length, 2);
      assert.ok(fs.readFileSync(dbPath).equals(originalMain));
      assert.ok(fs.readFileSync(`${dbPath}-wal`).equals(originalWal));
      assert.equal(fs.readFileSync(config, "utf8"), "preserved-config");
      assert.deepEqual(db.prepare("SELECT value FROM witness").get(), { value: "preserved" });
      assert.equal(fs.readFileSync(path.join(candidate, "storage.sqlite"), "utf8"), "candidate-data");
    } finally { console.error = originalError; db.close(); }
  });
});
