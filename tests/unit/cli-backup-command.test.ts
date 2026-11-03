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

test("encrypted SQLite backup refuses before reading keys or creating staging files", async () => {
  await withBackupEnv(async (dataDir) => {
    const { default: Database } = await import("better-sqlite3");
    const { runBackupCommand } = await import("../../bin/cli/commands/backup.mjs");
    const dbPath = path.join(dataDir, "storage.sqlite");
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec("CREATE TABLE witness (value TEXT); INSERT INTO witness VALUES ('preserved')");
    const before = fs.readFileSync(dbPath);
    const walBefore = fs.readFileSync(`${dbPath}-wal`);
    const previousError = console.error;
    const messages: string[] = [];
    console.error = (...args) => { messages.push(args.map(String).join(" ")); };
    try {
      assert.equal(await runBackupCommand({ encrypt: true, keyFile: path.join(dataDir, "missing-key") }), 1);
      assert.match(messages.join(" "), /private staging/i);
      assert.equal(fs.existsSync(path.join(dataDir, "backups")), false);
      assert.ok(fs.readFileSync(dbPath).equals(before));
      assert.ok(fs.readFileSync(`${dbPath}-wal`).equals(walBefore));
      assert.deepEqual(db.prepare("SELECT value FROM witness").get(), { value: "preserved" });
    } finally { console.error = previousError; db.close(); }
  });
});

test("encrypted backup refuses a database created while passphrase input is pending", async () => {
  const { spawn } = await import("node:child_process");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-encryption-race-"));
  const dbPath = path.join(dir, "storage.sqlite");
  const script = `import {runBackupCommand} from './bin/cli/commands/backup.mjs'; const code=await runBackupCommand({encrypt:true,name:'witness'}); process.exit(code);`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(), env: { ...process.env, DATA_DIR: dir, LANG: "en_US.UTF-8" }, stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "";
  let observedPrompt = false;
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
    if (!observedPrompt && /passphrase/i.test(output)) {
      observedPrompt = true;
      fs.writeFileSync(dbPath, "arrived-after-preflight");
      child.stdin.write("test-passphrase\n");
    }
  });
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    assert.equal(observedPrompt, true, output);
    assert.equal(code, 1, stderr);
    assert.match(stderr, /private staging/i);
    assert.equal(fs.readFileSync(dbPath, "utf8"), "arrived-after-preflight");
    const backupPath = path.join(dir, "backups", "omniroute-backup-witness");
    assert.equal(fs.existsSync(path.join(backupPath, "storage.sqlite")), false);
    assert.equal(fs.existsSync(path.join(backupPath, "storage.sqlite.enc")), false);
    assert.equal(fs.readdirSync(backupPath).some((name) => name.startsWith(".sqlite-backup-")), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("backup metadata lists published files when a database appears after its turn", async () => {
  const { syncBuiltinESMExports } = await import("node:module");
  await withBackupEnv(async (dataDir) => {
    const { runBackupCommand } = await import("../../bin/cli/commands/backup.mjs");
    const sqlitePath = path.join(dataDir, "storage.sqlite");
    const key = path.join(dataDir, "key.txt");
    fs.writeFileSync(path.join(dataDir, "settings.json"), "settings");
    fs.writeFileSync(key, "test-key");
    const original = fs.existsSync;
    let checks = 0;
    fs.existsSync = ((value) => {
      if (String(value) === sqlitePath && ++checks === 2) {
        fs.writeFileSync(sqlitePath, "arrived-after-scan");
        return false;
      }
      return original(value);
    }) as typeof fs.existsSync;
    syncBuiltinESMExports();
    try {
      assert.equal(await runBackupCommand({ encrypt: true, keyFile: key, name: "appearance" }), 0);
    } finally { fs.existsSync = original; syncBuiltinESMExports(); }
    const dir = path.join(dataDir, "backups", "omniroute-backup-appearance");
    const info = JSON.parse(fs.readFileSync(path.join(dir, "backup-info.json"), "utf8"));
    assert.deepEqual(info.files, ["settings.json.enc"]);
    assert.equal(fs.readFileSync(sqlitePath, "utf8"), "arrived-after-scan");
    assert.equal(fs.existsSync(path.join(dir, "storage.sqlite.enc")), false);
  });
});

test("backup metadata retains a published file when its source disappears", async () => {
  const { syncBuiltinESMExports } = await import("node:module");
  await withBackupEnv(async (dataDir) => {
    const { runBackupCommand } = await import("../../bin/cli/commands/backup.mjs");
    const source = path.join(dataDir, "settings.json");
    const nextFile = path.join(dataDir, "combos.json");
    fs.writeFileSync(source, "preserved-settings");
    const original = fs.existsSync;
    fs.existsSync = ((value) => {
      if (String(value) === nextFile && original(source)) fs.unlinkSync(source);
      return original(value);
    }) as typeof fs.existsSync;
    syncBuiltinESMExports();
    try { assert.equal(await runBackupCommand({ name: "disappearance" }), 0); }
    finally { fs.existsSync = original; syncBuiltinESMExports(); }
    const dir = path.join(dataDir, "backups", "omniroute-backup-disappearance");
    const info = JSON.parse(fs.readFileSync(path.join(dir, "backup-info.json"), "utf8"));
    assert.deepEqual(info.files, ["settings.json"]);
    assert.equal(fs.readFileSync(path.join(dir, "settings.json"), "utf8"), "preserved-settings");
  });
});
