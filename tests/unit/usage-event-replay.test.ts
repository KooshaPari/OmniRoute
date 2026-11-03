import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-usage-event-"));
process.env.DATA_DIR = dataDir;
const { getDbInstance, closeDbInstance } = await import("../../src/lib/db/core.ts");
const { saveRequestUsage } = await import("../../src/lib/usage/usageHistory.ts");

test("identified usage persists once and fails closed on conflicts and receipt failure", async () => {
  const db = getDbInstance();
  const entry = { eventId: "event-a", timestamp: "2026-01-01T00:00:00.000Z", provider: "synthetic", model: "one", tokens: { input: 2, output: 3 } };
  const rows = () => (db.prepare("SELECT COUNT(*) AS n FROM usage_history").get() as { n: number }).n;
  const receipts = () => (db.prepare("SELECT COUNT(*) AS n FROM usage_event_receipts").get() as { n: number }).n;
  await saveRequestUsage(entry);
  await saveRequestUsage(entry);
  assert.equal(rows(), 1); assert.equal(receipts(), 1);
  await assert.rejects(saveRequestUsage({ ...entry, model: "changed" }), /conflicts/);
  assert.equal(rows(), 1); assert.equal(receipts(), 1);
  await saveRequestUsage({ ...entry, eventId: "event-b" });
  assert.equal(rows(), 2); assert.equal(receipts(), 2);
  await assert.rejects(saveRequestUsage({ ...entry, eventId: "event-c", timestamp: undefined }), /stable timestamp/);
  db.exec("CREATE TRIGGER fixture_receipt_failure BEFORE INSERT ON usage_event_receipts BEGIN SELECT RAISE(ABORT, 'fixture failure'); END");
  await assert.rejects(saveRequestUsage({ ...entry, eventId: "event-d" }), /fixture failure/);
  assert.equal(rows(), 2); assert.equal(receipts(), 2);
  closeDbInstance();
  await saveRequestUsage(entry);
  const reopened = getDbInstance();
  assert.equal((reopened.prepare("SELECT COUNT(*) AS n FROM usage_history").get() as { n: number }).n, 2);
  assert.equal((reopened.prepare("SELECT COUNT(*) AS n FROM usage_event_receipts").get() as { n: number }).n, 2);
  const receipt = reopened.prepare("SELECT usage_row_id FROM usage_event_receipts WHERE event_id = ?").get("event-a") as { usage_row_id: number };
  reopened.prepare("DELETE FROM usage_history WHERE id = ?").run(receipt.usage_row_id);
  await assert.rejects(saveRequestUsage(entry), /missing usage row/);
});
