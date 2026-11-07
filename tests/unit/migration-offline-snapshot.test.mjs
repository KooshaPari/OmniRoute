import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { auditOfflineSnapshot } from "../../scripts/db/migration-offline-snapshot.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "omni-audit-"));
  const snapshotPath = join(root, "snapshot.sqlite");
  const migrationsDir = join(root, "migrations"); mkdirSync(migrationsDir);
  const db = new DatabaseSync(snapshotPath);
  db.exec("CREATE TABLE _omniroute_migrations(version TEXT PRIMARY KEY, name TEXT NOT NULL); INSERT INTO _omniroute_migrations VALUES ('185','old'),('legacy-1','legacy'),(NULL,'unknown')");
  db.close(); writeFileSync(join(migrationsDir, "185_new.sql"), "SELECT 1;");
  return { root, snapshotPath, migrationsDir, offlineSnapshot: true };
}
test("snapshot is byte-identical, creates no sidecars and reports unsupported records", () => {
  const f = fixture(); const before = digest(readFileSync(f.snapshotPath)); const names = readdirSync(f.root);
  const result = auditOfflineSnapshot(f);
  assert.equal(result.ledgerRecords, 3); assert.equal(result.unsupportedLedgerRecords, 2);
  assert.equal(result.collisions.length, 1); assert.equal(result.collisions[0].disposition, "unverified");
  assert.equal(result.guardedAdditive.length, 4);
  assert.ok(result.guardedAdditive.every((item) => item.authorized === false && item.state === "blocked_identity"));
  assert.equal(digest(readFileSync(f.snapshotPath)), before); assert.deepEqual(readdirSync(f.root), names);
});
test("requires offline assertion and refuses every sidecar before reading", () => {
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    const f = fixture(); assert.throws(() => auditOfflineSnapshot({ ...f, offlineSnapshot: false }), /confirmation/);
    writeFileSync(f.snapshotPath + suffix, "sidecar"); const before = digest(readFileSync(f.snapshotPath));
    assert.throws(() => auditOfflineSnapshot(f), /sidecar/); assert.equal(digest(readFileSync(f.snapshotPath)), before);
  }
});
test("fails on duplicate migration slots without changing snapshot", () => {
  const f = fixture(); writeFileSync(join(f.migrationsDir, "185_other.sql"), "SELECT 2;");
  const before = digest(readFileSync(f.snapshotPath));
  assert.throws(() => auditOfflineSnapshot(f), /Duplicate migration/); assert.equal(digest(readFileSync(f.snapshotPath)), before);
});

test("exact 185 bytes classify an absent column and reject a generated collision", () => {
  const vectors = JSON.parse(readFileSync(new URL("../fixtures/guarded-additive/migration-bytes.json", import.meta.url), "utf8"));
  const bytes = Buffer.from(vectors["185_usage_history_cpa_auth_index.sql"], "base64");
  assert.equal(digest(bytes), "b71c5e5f74e9a60b26bc242e336470b3e2ae63430194caaf619d3271512b3c12");
  for (const mode of ["absent", "generated", "uppercase"]) {
    const f = fixture();
    const db = new DatabaseSync(f.snapshotPath);
    db.exec("DELETE FROM _omniroute_migrations WHERE version='185'; INSERT INTO _omniroute_migrations VALUES ('185','provider_param_filters')");
    db.exec(mode === "generated"
      ? "CREATE TABLE usage_history(id INTEGER PRIMARY KEY, cpa_auth_index TEXT GENERATED ALWAYS AS ('hidden') VIRTUAL)"
      : mode === "uppercase" ? "CREATE TABLE usage_history(id INTEGER PRIMARY KEY, CPA_AUTH_INDEX TEXT)" : "CREATE TABLE usage_history(id INTEGER PRIMARY KEY)");
    db.close();
    writeFileSync(join(f.migrationsDir, "185_new.sql"), bytes);
    const renamed = join(f.migrationsDir, "185_usage_history_cpa_auth_index.sql");
    renameSync(join(f.migrationsDir, "185_new.sql"), renamed);
    const before = digest(readFileSync(f.snapshotPath));
    const result = auditOfflineSnapshot(f);
    const assessment = result.guardedAdditive.find((item) => item.version === "185");
    assert.equal(assessment.state, mode === "generated" ? "blocked_column_mismatch" : mode === "uppercase" ? "columns_present_unverified" : "candidate_requires_offline_witness");
    assert.equal(result.usage185.state, mode === "generated" ? "blocked_column_mismatch" : mode === "uppercase" ? "column_present_unverified" : "missing_column_requires_recovery");
    assert.equal(assessment.authorized, false);
    assert.equal(digest(readFileSync(f.snapshotPath)), before);
  }
});

test("other exact installed migration bytes classify real absent, present and conflicting schemas", () => {
  const vectors = JSON.parse(readFileSync(new URL("../fixtures/guarded-additive/migration-bytes.json", import.meta.url), "utf8"));
  for (const [version, appliedName, filename, tableName, extra] of [
    ["177", "cli_access_tokens", "177_provider_connection_synced_models_at.sql", "provider_connections", "synced_models_at TEXT"],
    ["193", "usage_history_account_identity", "193_proxy_subscription_selector_control.sql", "proxy_subscriptions", "control_url TEXT, control_secret_enc TEXT, selector_min_gap_seconds INTEGER NOT NULL DEFAULT 60, selector_last_switch_at TEXT, selector_last_switch_result TEXT, selector_last_switch_member TEXT"],
    ["210", "memory_fts_trigger_content_only", "210_call_logs_detail_pending.sql", "call_logs", "detail_pending_until INTEGER DEFAULT NULL"],
  ]) {
    for (const mode of version === "193" ? ["absent", "present", "mismatch", "partial"] : ["absent", "present", "mismatch"]) {
    const f = fixture();
    const db = new DatabaseSync(f.snapshotPath);
    db.prepare("INSERT INTO _omniroute_migrations VALUES (?,?)").run(version, appliedName);
    const definition = mode === "absent" ? "" : mode === "present" ? `, ${extra}` : mode === "partial" ? ", control_url TEXT" : `, ${extra.replace(/TEXT|INTEGER/, "BLOB")}`;
    db.exec(`CREATE TABLE "${tableName}" (id INTEGER PRIMARY KEY${definition})`);
    db.close();
    writeFileSync(join(f.migrationsDir, filename), Buffer.from(vectors[filename], "base64"));
    const before = digest(readFileSync(f.snapshotPath));
    const result = auditOfflineSnapshot(f).guardedAdditive.find((item) => item.version === version);
    assert.equal(result.state, mode === "absent" ? "candidate_requires_offline_witness" : mode === "present" ? "columns_present_unverified" : mode === "partial" ? "blocked_partial_schema" : "blocked_column_mismatch");
    assert.equal(result.authorized, false);
    assert.equal(digest(readFileSync(f.snapshotPath)), before);
    }
  }
});
