/**
 * #13459 — usage_history dedup must normalize provider ALIASES to the
 * canonical provider id.
 *
 * The same request logged once under an alias and once under the canonical id
 * ("oc" vs "opencode") must collapse to a single row; otherwise combo routing
 * double-counts usage and stats churn.
 *
 * On pristine main both the dedup SELECT and the INSERT receive the raw
 * `entry.provider`, so the two spellings compare unequal and insert twice.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolate the DB from other tests and from the real data dir.
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-alias-dedup-"));
process.env.DATA_DIR = TEST_DATA_DIR;

// Dynamic imports so DATA_DIR is set before any module initialises the DB.
const { resetDbInstance, getDbInstance } = await import("../../src/lib/db/core.ts");
const { saveRequestUsage } = await import("../../src/lib/usage/usageHistory.ts");

test.after(() => {
  resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function countRows(db: ReturnType<typeof getDbInstance>): number {
  const row = db.prepare("SELECT COUNT(*) AS cnt FROM usage_history").get() as { cnt: number };
  return row.cnt;
}

test("#13459: alias and canonical provider collapse to one usage row", async () => {
  const db = getDbInstance();
  const before = countRows(db);

  const timestamp = new Date().toISOString();
  const common = {
    model: "test-model",
    connectionId: "conn-alias-dedup",
    apiKeyId: null,
    tokens: { input_tokens: 10, output_tokens: 20 },
    status: "success",
    success: true,
    latencyMs: 100,
    endpoint: "/v1/chat/completions",
    timestamp,
  };

  // "oc" is an alias for the provider id "opencode" (ALIAS_TO_ID).
  await saveRequestUsage({ ...common, provider: "oc" });
  await saveRequestUsage({ ...common, provider: "opencode" });

  const inserted = countRows(db) - before;
  assert.equal(
    inserted,
    1,
    `alias + canonical provider must dedupe to 1 row, got ${inserted}`
  );
});

test("#13459: the stored provider is the canonical id, not the alias", async () => {
  const db = getDbInstance();
  const row = db
    .prepare("SELECT provider FROM usage_history WHERE connection_id = ? ORDER BY id DESC LIMIT 1")
    .get("conn-alias-dedup") as { provider: string | null } | undefined;

  assert.ok(row, "expected a usage row from the previous test");
  assert.equal(row.provider, "opencode");
  assert.notEqual(row.provider, "oc");
});
