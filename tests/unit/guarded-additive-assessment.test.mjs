import test from "node:test";
import assert from "node:assert/strict";
import { assessGuardedAdditive } from "../../scripts/db/guarded-additive-assessment.mjs";

const identity = { version: "193", appliedName: "usage_history_account_identity", diskName: "proxy_subscription_selector_control", sha256: "3bfeb73b75ba0dd50c298a5767f3a2c7e1858b9ac0d05c6bd52ff22cda708af5", tableName: "proxy_subscriptions", objectType: "table" };
const column = (name, type = "TEXT", notnull = 0, dflt_value = null) => ({ name, type, notnull, dflt_value, pk: 0, hidden: 0 });
const columns = [column("control_url"), column("control_secret_enc"), column("selector_min_gap_seconds", "INTEGER", 1, "60"), column("selector_last_switch_at"), column("selector_last_switch_result"), column("selector_last_switch_member")];
const base = column("id");
const assess = (extra) => assessGuardedAdditive({ ...identity, columns: [base], ...extra });

test("all classifications deny execution and require owner and backup proof", () => {
  for (const options of [{}, { columns: [base, ...columns] }, { columns: [base, columns[0]] }, { sha256: "0" }, { tableName: "other" }]) {
    const result = assess(options);
    assert.equal(result.authorized, false);
    assert.equal(result.owner, "unverified");
    assert.equal(result.backup, "unverified");
  }
  assert.equal(assess({}).state, "candidate_requires_offline_witness");
  assert.equal(assess({ columns: [base, ...columns] }).state, "columns_present_unverified");
  assert.equal(assess({ columns: [base, columns[0]] }).state, "blocked_partial_schema");
});

test("rejects changed identity, incorrect or ambiguous schema", () => {
  assert.equal(assess({ appliedName: "other" }).state, "blocked_identity");
  assert.equal(assess({ version: "__proto__" }).state, "blocked_identity");
  assert.equal(assess({ sha256: "0" }).state, "blocked_identity");
  assert.equal(assess({ tableName: "other" }).state, "blocked_schema");
  assert.equal(assess({ columns: [] }).state, "blocked_schema");
  assert.equal(assess({ objectType: "view" }).state, "blocked_schema");
  assert.equal(assess({ columns: [columns[0], { ...columns[0], name: "CONTROL_URL" }] }).state, "blocked_schema");
  assert.equal(assess({ columns: [base, ...columns.map((x) => x.name === "selector_min_gap_seconds" ? { ...x, dflt_value: "0" } : x)] }).state, "blocked_column_mismatch");
});

test("all four exact installed identities remain assessment-only", () => {
  for (const item of [
    ["177", "cli_access_tokens", "provider_connection_synced_models_at", "ae3fe0db6d4604afec763e8cefef29e4eb64e2bc63ee83ce5b198ab00aac4d7d", "provider_connections"],
    ["185", "provider_param_filters", "usage_history_cpa_auth_index", "b71c5e5f74e9a60b26bc242e336470b3e2ae63430194caaf619d3271512b3c12", "usage_history"],
    ["193", "usage_history_account_identity", "proxy_subscription_selector_control", "3bfeb73b75ba0dd50c298a5767f3a2c7e1858b9ac0d05c6bd52ff22cda708af5", "proxy_subscriptions"],
    ["210", "memory_fts_trigger_content_only", "call_logs_detail_pending", "e6bb642ed7c68b710b1d3ef1d365ff4952a58fe94af42c6fe8c8beb9ed816932", "call_logs"],
  ]) {
    const [version, appliedName, diskName, sha256, tableName] = item;
    const result = assessGuardedAdditive({ version, appliedName, diskName, sha256, tableName, objectType: "table", columns: [base] });
    assert.equal(result.state, "candidate_requires_offline_witness");
    assert.equal(result.authorized, false);
  }
});
