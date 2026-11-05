import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDaemon } from "../../bin/cli/commands/serve.mjs";

test("daemon spawn failure rejects without writing a PID", async () => {
  const dir = mkdtempSync(join(tmpdir(), "omniroute-daemon-test-"));
  const previousPath = process.env.PATH;
  const previousDataDir = process.env.DATA_DIR;
  const previousLog = console.log;
  const messages = [];
  process.env.PATH = dir;
  process.env.DATA_DIR = dir;
  console.log = (...args) => messages.push(args);
  try {
    await assert.rejects(runDaemon("missing-server.mjs", process.env, 512, 20128, 20128));
    assert.equal(existsSync(join(dir, "server", ".pid")), false);
    assert.deepEqual(messages, []);
  } finally {
    console.log = previousLog;
    process.env.PATH = previousPath;
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
  }
});
