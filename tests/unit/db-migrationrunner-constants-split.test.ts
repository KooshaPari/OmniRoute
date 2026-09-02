/**
 * Characterization / snapshot test: migrationRunner.ts god-file decomposition.
 *
 * The static migration-compatibility data tables were extracted verbatim from
 * src/lib/db/migrationRunner.ts into the pure-data leaf
 * src/lib/db/migrationRunner/constants.ts (no imports, no DB, no behaviour).
 *
 * These tables drive the reconciliation / dedup / already-applied detection
 * paths in runMigrations(). The existing db-migration-runner.test.ts proves the
 * BEHAVIOUR is unchanged; this test PINS THE DATA so a bad move (a dropped row,
 * a transposed version, a corrupted sentinel) is caught immediately — the data
 * is the thing the move could silently break.
 *
 * Pure value assertions — no DB handle is opened.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  RENAMED_MIGRATION_COMPATIBILITY,
  LEGACY_VERSION_SLOT_MIGRATIONS,
  SUPERSEDED_DUPLICATE_MIGRATIONS,
  PHYSICAL_SCHEMA_SENTINELS,
  INITIAL_SCHEMA_SENTINELS,
  OPTIONAL_FTS5_MIGRATION_VERSIONS,
} from "../../src/lib/db/migrationRunner/constants.ts";

// ── small tables — full snapshot ─────────────────────────────────────────────

describe("migrationRunner/constants — exact small-table snapshots", () => {
  it("LEGACY_VERSION_SLOT_MIGRATIONS is the 9-entry list, in order", () => {
    assert.deepEqual(
      LEGACY_VERSION_SLOT_MIGRATIONS.map((m) => `${m.version}:${m.name}`),
      [
        "028:evals_tables",
        "029:webhooks_templates",
        "030:mcp_scopes_api_keys",
        "031:api_keys_expires",
        "032:detailed_logs_warnings",
        "033:provider_connections_block_extra_usage",
        "033:add_batch_id_to_call_logs",
        "046:remove_status_from_files",
        "051:remove_status_from_files",
      ]
    );
  });

  it("SUPERSEDED_DUPLICATE_MIGRATIONS is the single 041→050 session_account_affinity entry", () => {
    assert.deepEqual(SUPERSEDED_DUPLICATE_MIGRATIONS, [
      {
        version: "041",
        name: "session_account_affinity",
        supersededByVersion: "050",
        supersededByName: "session_account_affinity",
      },
    ]);
  });

  it("INITIAL_SCHEMA_SENTINELS pins the three baseline tables", () => {
    assert.deepEqual(INITIAL_SCHEMA_SENTINELS, ["provider_connections", "combos", "call_logs"]);
  });

  it("OPTIONAL_FTS5_MIGRATION_VERSIONS is exactly {022, 023}", () => {
    assert.ok(OPTIONAL_FTS5_MIGRATION_VERSIONS instanceof Set);
    assert.deepEqual([...OPTIONAL_FTS5_MIGRATION_VERSIONS].sort(), ["022", "023"]);
  });
});

// ── large tables — count + shape + spot-checks (corruption guard) ─────────────

describe("migrationRunner/constants — large-table integrity", () => {
  it("RENAMED_MIGRATION_COMPATIBILITY has 25 well-formed entries", () => {
    assert.equal(RENAMED_MIGRATION_COMPATIBILITY.length, 25);
    for (const e of RENAMED_MIGRATION_COMPATIBILITY) {
      assert.equal(typeof e.fromVersion, "string");
      assert.equal(typeof e.fromName, "string");
      assert.equal(typeof e.toVersion, "string");
      assert.equal(typeof e.toName, "string");
    }
  });

  it("RENAMED_MIGRATION_COMPATIBILITY spot-checks the boundary renames", () => {
    const first = RENAMED_MIGRATION_COMPATIBILITY[0];
    assert.deepEqual(first, {
      fromVersion: "022",
      fromName: "call_logs_summary_storage",
      toVersion: "025",
      toName: "call_logs_summary_storage",
    });
    // both manifest_routing collisions (052→059 and 056→059) must survive
    const manifest = RENAMED_MIGRATION_COMPATIBILITY.filter((e) => e.toName === "manifest_routing");
    assert.deepEqual(manifest.map((e) => e.fromVersion).sort(), ["052", "056"]);
  });

  it("pins every 113-128 collision rehome to the 134-148 range", () => {
    const collisionRehomes = RENAMED_MIGRATION_COMPATIBILITY.filter(
      (entry) => Number(entry.fromVersion) >= 113 && Number(entry.fromVersion) <= 128
    ).map((entry) => `${entry.fromVersion}:${entry.fromName}->${entry.toVersion}:${entry.toName}`);

    assert.deepEqual(collisionRehomes, [
      "113:provider_node_icon_url->134:provider_node_icon_url",
      "114:mux_service_seed->135:mux_service_seed",
      "115:bifrost_service->136:bifrost_service",
      "116:call_logs_reasoning_source->137:call_logs_reasoning_source",
      "117:proxy_pool_rotation->138:proxy_pool_rotation",
      "118:provider_param_filters->139:provider_param_filters",
      "119:model_capability_overrides->140:model_capability_overrides",
      "120:interception_rules->141:interception_rules",
      "122:free_proxy_sync_errors->142:free_proxy_sync_errors",
      "123:quota_auto_ping->143:quota_auto_ping",
      "124:generic_session_affinity_ttl->144:generic_session_affinity_ttl",
      "125:provider_connection_quota_visibility->145:provider_connection_quota_visibility",
      "126:reasoning_routing_rules->146:reasoning_routing_rules",
      "127:usage_history_account_identity->147:usage_history_account_identity",
      "128:auto_candidate_overrides->148:auto_candidate_overrides",
    ]);
  });

  it("PHYSICAL_SCHEMA_SENTINELS has 15 well-formed entries incl. the newest 064", () => {
    assert.equal(PHYSICAL_SCHEMA_SENTINELS.length, 15);
    for (const e of PHYSICAL_SCHEMA_SENTINELS) {
      assert.equal(typeof e.version, "string");
      assert.equal(typeof e.tableName, "string");
      assert.equal(typeof e.description, "string");
    }
    const byVersion = Object.fromEntries(
      PHYSICAL_SCHEMA_SENTINELS.map((e) => [e.version, e.tableName])
    );
    assert.equal(byVersion["064"], "session_model_history");
    assert.equal(byVersion["002"], "mcp_tool_audit");
    assert.equal(byVersion["028"], "batches");
  });
});
