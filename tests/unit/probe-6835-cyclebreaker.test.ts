import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("preserved probe-failed file prevents repeated automatic restore attempts", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-6835-"));
  process.env.DATA_DIR = tmpDir;
  const sqliteFile = path.join(tmpDir, "storage.sqlite");
  const backupFile = `${sqliteFile}.probe-failed-1000000000000`;
  fs.writeFileSync(backupFile, Buffer.from("not a real sqlite file, always fails to open"));
  const core = await import("../../src/lib/db/core.ts");
  const errors: string[] = [];
  for (let i = 0; i < 6; i++) {
    try {
      core.getDbInstance();
      errors.push("(no error)");
      break;
    } catch (err: unknown) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  assert.equal(errors.length, 6);
  assert.ok(errors.every((e) => /Manual offline recovery required/.test(e)));
  assert.equal(fs.existsSync(sqliteFile), false);
  assert.equal(fs.readFileSync(backupFile, "utf8"), "not a real sqlite file, always fails to open");
  fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
