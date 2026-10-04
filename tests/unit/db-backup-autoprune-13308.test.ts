/**
 * Tests for #13308: the startup health-check repair path creates a backup snapshot
 * (`db_backups/db_<ts>_health-check-repair.sqlite`). Without pruning, `db_backups/`
 * grows without bound across restarts. `getDbInstance()` now prunes the backups
 * directory after the health check reports `backupCreated`.
 *
 * The pruning only runs on the real (non-test) startup path: `createManagedDbBackup`
 * returns false when `isAutomatedTestProcess()` is true, so a plain in-process test
 * can never reach `backupCreated === true`. This test therefore drives
 * `getDbInstance()` in a child Node process that does not look like a test runner
 * (no `--test`/vitest in argv), and observes the resulting backup-file count.
 *
 * On pristine main (no #13308 prune call) the child would leave every seeded
 * snapshot plus the newly created repair snapshot in place (seedCount + 1), so the
 * final count assertion fails. On the branch the directory is pruned to maxFiles.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const serial = { concurrency: false };

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CORE_PATH = path.join(REPO_ROOT, "src/lib/db/core.ts");

const SEEDED_BACKUPS = 6;
const MAX_FILES = 3;

const HARNESS_SOURCE = `
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.DATA_DIR as string;
const core = await import(process.env.CORE_PATH as string);

const seedCount = Number(process.env.SEED_COUNT);
const maxFiles = Number(process.env.DB_BACKUP_MAX_FILES);

// First init: healthy DB, no repair snapshot.
const db = core.getDbInstance();

// Force a repair on the next init — invalid JSON in domain_lockout_state.attempts
// is one of runDbHealthCheck()'s repair triggers (see healthCheck.ts), which calls
// createBackupBeforeRepair() exactly once (createHealthCheckBackup -> a real backup
// in a non-test process).
db.prepare(
  "INSERT OR REPLACE INTO domain_lockout_state (identifier, attempts, locked_until) VALUES ('probe','not-json',NULL)"
).run();

const backupDir = path.join(dataDir, "db_backups");
fs.mkdirSync(backupDir, { recursive: true });
const now = Date.now() / 1000;
for (let i = 0; i < seedCount; i++) {
  const p = path.join(backupDir, "db_seed_" + String(i).padStart(3, "0") + ".sqlite");
  fs.writeFileSync(p, "seed");
  const t = now - i;
  fs.utimesSync(p, t, t);
}

core.resetDbInstance();
await new Promise((r) => setTimeout(r, 100));

// Second init: health check finds the invalid row, repairs it, creates a backup,
// and (only on the branch) prunes the directory to maxFiles.
core.getDbInstance();
await new Promise((r) => setTimeout(r, 1200));

const count = fs
  .readdirSync(backupDir)
  .filter((f) => f.startsWith("db_") && f.endsWith(".sqlite")).length;
console.log("RESULT:" + JSON.stringify({ seedCount, maxFiles, count }));
process.exit(0);
`;

test("#13308 getDbInstance prunes db_backups after a health-check repair backup", serial, () => {
  const harnessDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-autoprune-"));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-autoprunedata-"));
  const harnessPath = path.join(harnessDir, "harness.mts");

  try {
    fs.writeFileSync(harnessPath, HARNESS_SOURCE);

    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.NODE_ENV;
    delete env.VITEST;
    delete env.NODE_TEST_CONTEXT;
    env.DATA_DIR = dataDir;
    env.CORE_PATH = CORE_PATH;
    env.SEED_COUNT = String(SEEDED_BACKUPS);
    env.DB_BACKUP_MAX_FILES = String(MAX_FILES);
    // Keep the timer-driven auto-backup path out of the picture so the only
    // snapshot created is the health-check repair backup under test.
    env.DISABLE_SQLITE_AUTO_BACKUP = "true";

    const proc = spawnSync(process.execPath, ["--import", "tsx", harnessPath], {
      cwd: REPO_ROOT,
      env,
      encoding: "utf8",
      timeout: 120_000,
    });

    assert.equal(
      proc.status,
      0,
      `harness exited ${proc.status}\n--- stdout ---\n${proc.stdout}\n--- stderr ---\n${proc.stderr}`
    );

    const line = (proc.stdout ?? "")
      .split("\n")
      .reverse()
      .find((l) => l.includes("RESULT:"));

    assert.ok(line, `harness produced no RESULT line\n${proc.stdout}`);
    const result = JSON.parse(line.slice(line.indexOf("RESULT:") + "RESULT:".length)) as {
      seedCount: number;
      maxFiles: number;
      count: number;
    };

    assert.equal(result.seedCount, SEEDED_BACKUPS);
    assert.equal(result.maxFiles, MAX_FILES);
    // The repair snapshot was created (seedCount + 1 existed momentarily) and the
    // directory was pruned back to maxFiles. On pristine main the cleanup call is
    // absent, leaving seedCount + 1 files and failing this assertion.
    assert.equal(
      result.count,
      MAX_FILES,
      `expected db_backups pruned to ${MAX_FILES}, saw ${result.count}`
    );
  } finally {
    fs.rmSync(harnessDir, { recursive: true, force: true, maxRetries: 5 });
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5 });
  }
});
