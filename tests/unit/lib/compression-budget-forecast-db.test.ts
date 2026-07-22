import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-forecast-db-"));
process.env.DATA_DIR = dataDir;

const core = await import("../../../src/lib/db/core.ts");
const { getCompressionBudgetHistory } =
  await import("../../../src/lib/db/compressionBudgetForecast.ts");

beforeEach(() => {
  core.resetDbInstance();
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  core.getDbInstance();
});

after(() => {
  core.resetDbInstance();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test("getCompressionBudgetHistory filters provider and maps valid forecast points", () => {
  const nowMs = Date.parse("2026-07-20T04:00:00.000Z");
  const db = core.getDbInstance();
  const insert = db.prepare(`
    INSERT INTO compression_analytics
      (timestamp, mode, provider, original_tokens, compressed_tokens, tokens_saved)
    VALUES (?, 'headroom', ?, ?, ?, ?)
  `);
  insert.run("2026-07-20T03:55:00.000Z", "openai", 1000, 600, 400);
  insert.run("2026-07-20T03:50:00.000Z", "anthropic", 900, 700, 200);
  insert.run("not-a-timestamp", "openai", 500, 400, 100);

  assert.deepEqual(getCompressionBudgetHistory(60 * 60 * 1000, "openai", nowMs), [
    { tsMs: Date.parse("2026-07-20T03:55:00.000Z"), tokens: 1000, savedTokens: 400 },
  ]);
});

test("getCompressionBudgetHistory excludes stale and zero-value rows", () => {
  const nowMs = Date.parse("2026-07-20T04:00:00.000Z");
  const db = core.getDbInstance();
  const insert = db.prepare(`
    INSERT INTO compression_analytics
      (timestamp, mode, provider, original_tokens, compressed_tokens, tokens_saved)
    VALUES (?, 'headroom', 'openai', ?, 0, ?)
  `);
  insert.run("2026-07-20T02:00:00.000Z", 1000, 500);
  insert.run("2026-07-20T03:59:00.000Z", 0, 0);

  assert.deepEqual(getCompressionBudgetHistory(60 * 60 * 1000, null, nowMs), []);
});
