export const USAGE_185_SHA256 = "b71c5e5f74e9a60b26bc242e336470b3e2ae63430194caaf619d3271512b3c12";

/** Classifies a snapshot only. No result grants authority to alter a database. */
export function assessUsage185({ appliedName, diskName, sha256, tableExists, columns }) {
  if (appliedName !== "provider_param_filters" || diskName !== "usage_history_cpa_auth_index" ||
      sha256 !== USAGE_185_SHA256) {
    return { state: "blocked_identity", authorized: false };
  }
  if (!tableExists) return { state: "blocked_missing_table", authorized: false };
  const column = columns.find((item) => item.name === "cpa_auth_index");
  if (!column) return { state: "missing_column_requires_recovery", authorized: false };
  if (String(column.type).toUpperCase() !== "TEXT" || column.notnull !== 0 ||
      column.dflt_value !== null || column.pk !== 0) {
    return { state: "blocked_column_mismatch", authorized: false };
  }
  return { state: "column_present_unverified", authorized: false };
}
