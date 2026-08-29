/**
 * db/migrationRunner/constants.ts — Static migration-compatibility data tables.
 *
 * Pure data (no imports, no DB, no behaviour) extracted verbatim from
 * migrationRunner.ts: the renamed/legacy/superseded migration maps and the
 * physical/initial schema sentinels used by the reconciliation, dedup, and
 * already-applied detection paths. Kept separate so the orchestrator host
 * file holds logic, not data tables.
 */

export const RENAMED_MIGRATION_COMPATIBILITY = [
  {
    fromVersion: "022",
    fromName: "call_logs_summary_storage",
    toVersion: "025",
    toName: "call_logs_summary_storage",
  },
  {
    fromVersion: "028",
    fromName: "provider_connection_max_concurrent",
    toVersion: "029",
    toName: "provider_connection_max_concurrent",
  },
  {
    fromVersion: "028",
    fromName: "compression_settings",
    toVersion: "034",
    toName: "compression_settings",
  },
  {
    fromVersion: "032",
    fromName: "create_reasoning_cache",
    toVersion: "033",
    toName: "create_reasoning_cache",
  },
  {
    fromVersion: "032",
    fromName: "compression_analytics",
    toVersion: "038",
    toName: "compression_analytics",
  },
  {
    fromVersion: "033",
    fromName: "compression_cache_stats",
    toVersion: "039",
    toName: "compression_cache_stats",
  },
  {
    fromVersion: "041",
    fromName: "session_account_affinity",
    toVersion: "050",
    toName: "session_account_affinity",
  },
  {
    fromVersion: "051",
    fromName: "usage_history_service_tier",
    toVersion: "054",
    toName: "usage_history_service_tier",
  },
  {
    fromVersion: "052",
    fromName: "manifest_routing",
    toVersion: "059",
    toName: "manifest_routing",
  },
  {
    fromVersion: "056",
    fromName: "manifest_routing",
    toVersion: "059",
    toName: "manifest_routing",
  },
  {
    fromVersion: "113",
    fromName: "provider_node_icon_url",
    toVersion: "134",
    toName: "provider_node_icon_url",
  },
  {
    fromVersion: "114",
    fromName: "mux_service_seed",
    toVersion: "135",
    toName: "mux_service_seed",
  },
  {
    fromVersion: "115",
    fromName: "bifrost_service",
    toVersion: "136",
    toName: "bifrost_service",
  },
  {
    fromVersion: "116",
    fromName: "call_logs_reasoning_source",
    toVersion: "137",
    toName: "call_logs_reasoning_source",
  },
  {
    fromVersion: "117",
    fromName: "proxy_pool_rotation",
    toVersion: "138",
    toName: "proxy_pool_rotation",
  },
  {
    fromVersion: "118",
    fromName: "provider_param_filters",
    toVersion: "139",
    toName: "provider_param_filters",
  },
  {
    fromVersion: "119",
    fromName: "model_capability_overrides",
    toVersion: "140",
    toName: "model_capability_overrides",
  },
  {
    fromVersion: "120",
    fromName: "interception_rules",
    toVersion: "141",
    toName: "interception_rules",
  },
  {
    fromVersion: "122",
    fromName: "free_proxy_sync_errors",
    toVersion: "142",
    toName: "free_proxy_sync_errors",
  },
  {
    fromVersion: "123",
    fromName: "quota_auto_ping",
    toVersion: "143",
    toName: "quota_auto_ping",
  },
  {
    fromVersion: "124",
    fromName: "generic_session_affinity_ttl",
    toVersion: "144",
    toName: "generic_session_affinity_ttl",
  },
  {
    fromVersion: "125",
    fromName: "provider_connection_quota_visibility",
    toVersion: "145",
    toName: "provider_connection_quota_visibility",
  },
  {
    fromVersion: "126",
    fromName: "reasoning_routing_rules",
    toVersion: "146",
    toName: "reasoning_routing_rules",
  },
  {
    fromVersion: "127",
    fromName: "usage_history_account_identity",
    toVersion: "147",
    toName: "usage_history_account_identity",
  },
  {
    fromVersion: "128",
    fromName: "auto_candidate_overrides",
    toVersion: "148",
    toName: "auto_candidate_overrides",
  },
] as const;

export const LEGACY_VERSION_SLOT_MIGRATIONS = [
  { version: "028", name: "evals_tables" },
  { version: "029", name: "webhooks_templates" },
  { version: "030", name: "mcp_scopes_api_keys" },
  { version: "031", name: "api_keys_expires" },
  { version: "032", name: "detailed_logs_warnings" },
  { version: "033", name: "provider_connections_block_extra_usage" },
  { version: "033", name: "add_batch_id_to_call_logs" },
  { version: "046", name: "remove_status_from_files" },
  { version: "051", name: "remove_status_from_files" },
] as const;

export const SUPERSEDED_DUPLICATE_MIGRATIONS = [
  {
    version: "041",
    name: "session_account_affinity",
    supersededByVersion: "050",
    supersededByName: "session_account_affinity",
  },
] as const;

export const PHYSICAL_SCHEMA_SENTINELS = [
  { version: "028", tableName: "batches", description: "batches table" },
  { version: "024", tableName: "sync_tokens", description: "sync_tokens table" },
  { version: "022", tableName: "memory_fts", description: "memory_fts virtual table" },
  { version: "019", tableName: "context_handoffs", description: "context_handoffs table" },
  {
    version: "064",
    tableName: "session_model_history",
    description: "session_model_history table",
  },
  { version: "017", tableName: "version_manager", description: "version_manager table" },
  { version: "016", tableName: "skill_executions", description: "skill_executions table" },
  { version: "015", tableName: "memories", description: "memories table" },
  { version: "013", tableName: "quota_snapshots", description: "quota_snapshots table" },
  { version: "011", tableName: "webhooks", description: "webhooks table" },
  { version: "010", tableName: "model_combo_mappings", description: "model_combo_mappings table" },
  { version: "008", tableName: "registered_keys", description: "registered_keys table" },
  { version: "006", tableName: "request_detail_logs", description: "request_detail_logs table" },
  { version: "004", tableName: "proxy_registry", description: "proxy_registry table" },
  { version: "002", tableName: "mcp_tool_audit", description: "mcp_tool_audit table" },
] as const;

export const INITIAL_SCHEMA_SENTINELS = ["provider_connections", "combos", "call_logs"] as const;
export const OPTIONAL_FTS5_MIGRATION_VERSIONS = new Set(["022", "023"]);
