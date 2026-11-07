import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("repeated startup attempts preserve probe-failed artifacts", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-6835-"));
  const previous = process.env.DATA_DIR; process.env.DATA_DIR = tmpDir;
  const sqliteFile = path.join(tmpDir, "storage.sqlite");
  const backupFile = sqliteFile + ".probe-failed-1000000000000";
  fs.writeFileSync(backupFile, "preserved evidence");
  try {
    const core = await import("../../src/lib/db/core.ts");
    for (let i = 0; i < 6; i++) {
      assert.throws(() => core.getDbInstance(), /Manual recovery required: the main database is missing/);
      assert.equal(fs.existsSync(sqliteFile), false);
      assert.equal(fs.readFileSync(backupFile, "utf8"), "preserved evidence");
    }
  } finally {
    if (previous === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = previous;
  }
});
