import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openOmniRouteDb } from "../../bin/cli/sqlite.mjs";

test("CLI database opener preserves orphan sidecars and failed-probe files", async () => {
  const previous = process.env.DATA_DIR;
  try {
    for (const suffix of ["-wal", "-shm", "-journal", ".probe-failed-123"]) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-cli-orphan-"));
      const file = path.join(dir, "storage.sqlite");
      process.env.DATA_DIR = dir;
      fs.writeFileSync(file + suffix, "preserve");
      try {
        await assert.rejects(openOmniRouteDb(), /Manual offline recovery required/);
        assert.equal(fs.existsSync(file), false);
        assert.equal(fs.readFileSync(file + suffix, "utf8"), "preserve");
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    }
  } finally {
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
  }
});

test("CLI database opener still initializes a fresh database", async () => {
  const previous = process.env.DATA_DIR;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-cli-fresh-"));
  process.env.DATA_DIR = dir;
  try {
    const { db, dbPath } = await openOmniRouteDb();
    try {
      assert.equal(fs.existsSync(dbPath), true);
      assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name = 'provider_connections'").get());
    } finally { db.close(); }
  } finally {
    if (previous === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
