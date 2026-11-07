const recipes = Object.freeze({
  "177": { applied: "cli_access_tokens", name: "provider_connection_synced_models_at", sha: "ae3fe0db6d4604afec763e8cefef29e4eb64e2bc63ee83ce5b198ab00aac4d7d", table: "provider_connections", columns: [["synced_models_at", "TEXT", 0, null]] },
  "185": { applied: "provider_param_filters", name: "usage_history_cpa_auth_index", sha: "b71c5e5f74e9a60b26bc242e336470b3e2ae63430194caaf619d3271512b3c12", table: "usage_history", columns: [["cpa_auth_index", "TEXT", 0, null]] },
  "193": { applied: "usage_history_account_identity", name: "proxy_subscription_selector_control", sha: "3bfeb73b75ba0dd50c298a5767f3a2c7e1858b9ac0d05c6bd52ff22cda708af5", table: "proxy_subscriptions", columns: [["control_url", "TEXT", 0, null], ["control_secret_enc", "TEXT", 0, null], ["selector_min_gap_seconds", "INTEGER", 1, "60"], ["selector_last_switch_at", "TEXT", 0, null], ["selector_last_switch_result", "TEXT", 0, null], ["selector_last_switch_member", "TEXT", 0, null]] },
  "210": { applied: "memory_fts_trigger_content_only", name: "call_logs_detail_pending", sha: "e6bb642ed7c68b710b1d3ef1d365ff4952a58fe94af42c6fe8c8beb9ed816932", table: "call_logs", columns: [["detail_pending_until", "INTEGER", 0, "NULL"]] },
});

export const guardedAdditiveTargets = Object.freeze(Object.entries(recipes).map(([version, recipe]) =>
  Object.freeze({ version, tableName: recipe.table })
));

/** Snapshot-only evidence classification. It cannot authorize or execute a repair. */
export function assessGuardedAdditive({ version, appliedName, diskName, sha256, tableName, objectType, columns }) {
  const recipe = Object.hasOwn(recipes, version) ? recipes[version] : undefined;
  const result = (state) => ({ version, state, authorized: false, owner: "unverified", backup: "unverified" });
  if (!recipe || appliedName !== recipe.applied || diskName !== recipe.name || sha256 !== recipe.sha) return result("blocked_identity");
  if (tableName !== recipe.table || objectType !== "table" || !Array.isArray(columns)) return result("blocked_schema");
  const fold = (name) => name.replace(/[A-Z]/g, (c) => c.toLowerCase());
  const byName = new Map();
  for (const column of columns) {
    if (!column || typeof column.name !== "string" || byName.has(fold(column.name))) return result("blocked_schema");
    byName.set(fold(column.name), column);
  }
  if (!byName.has("id") || byName.get("id").hidden !== 0) return result("blocked_schema");
  let present = 0;
  for (const [name, type, notnull, defaultValue] of recipe.columns) {
    const column = byName.get(fold(name));
    if (!column) continue;
    present++;
    const actualDefault = column.dflt_value === null ? null : String(column.dflt_value).toUpperCase();
    if (column.hidden !== 0 || String(column.type).toUpperCase() !== type || column.notnull !== notnull || column.pk !== 0 || actualDefault !== defaultValue) return result("blocked_column_mismatch");
  }
  if (present === 0) return result("candidate_requires_offline_witness");
  if (present !== recipe.columns.length) return result("blocked_partial_schema");
  return result("columns_present_unverified");
}
