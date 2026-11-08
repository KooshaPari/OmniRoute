/**
 * dbJsonMigration.ts — JSON to SQLite data migration.
 *
 * Extracted from core.ts. Handles the one-time migration of data from
 * the legacy `db.json` flat-file database into the SQLite database.
 */

import path from "path";
import fs from "fs";
import type { SqliteDatabase } from "./dbCoreTypes";
import { DATA_DIR } from "./dbCoreTypes";
import { parseModelAccessMode } from "./apiKeys/modelAccessMode";

// ──────────────── JSON → SQLite Migration ────────────────

export function migrateFromJson(db: SqliteDatabase, jsonPath: string) {
  try {
    const raw = fs.readFileSync(jsonPath, "utf-8");
    const data = JSON.parse(raw);

    const connCount = (data.providerConnections || []).length;
    const nodeCount = (data.providerNodes || []).length;
    const keyCount = (data.apiKeys || []).length;

    if (connCount === 0 && nodeCount === 0 && keyCount === 0) {
      console.log("[DB] db.json has no data to migrate, skipping");
      fs.renameSync(jsonPath, jsonPath + ".empty");
      return;
    }

    console.log(
      `[DB] Migrating db.json → SQLite (${connCount} connections, ${nodeCount} nodes, ${keyCount} keys)...`
    );

    const migrate = db.transaction(() => {
      // 1. Provider Connections
      const insertConn = db.prepare(`
        INSERT OR REPLACE INTO provider_connections (
          id, provider, auth_type, name, email, priority, is_active,
          access_token, refresh_token, expires_at, token_expires_at,
          scope, project_id, test_status, error_code, last_error,
          last_error_at, last_error_type, last_error_source, backoff_level,
          rate_limited_until, health_check_interval, last_health_check_at,
          last_tested, api_key, id_token, provider_specific_data,
          expires_in, display_name, global_priority, default_model,
          token_type, consecutive_use_count, rate_limit_protection, last_used_at, created_at, updated_at
        ) VALUES (
          @id, @provider, @authType, @name, @email, @priority, @isActive,
          @accessToken, @refreshToken, @expiresAt, @tokenExpiresAt,
          @scope, @projectId, @testStatus, @errorCode, @lastError,
          @lastErrorAt, @lastErrorType, @lastErrorSource, @backoffLevel,
          @rateLimitedUntil, @healthCheckInterval, @lastHealthCheckAt,
          @lastTested, @apiKey, @idToken, @providerSpecificData,
          @expiresIn, @displayName, @globalPriority, @defaultModel,
          @tokenType, @consecutiveUseCount, @rateLimitProtection, @lastUsedAt, @createdAt, @updatedAt
        )
      `);

      for (const conn of data.providerConnections || []) {
        insertConn.run({
          id: conn.id,
          provider: conn.provider,
          authType: conn.authType || "oauth",
          name: conn.name || null,
          email: conn.email || null,
          priority: conn.priority || 0,
          isActive: conn.isActive === false ? 0 : 1,
          accessToken: conn.accessToken || null,
          refreshToken: conn.refreshToken || null,
          expiresAt: conn.expiresAt || null,
          tokenExpiresAt: conn.tokenExpiresAt || null,
          scope: conn.scope || null,
          projectId: conn.projectId || null,
          testStatus: conn.testStatus || null,
          errorCode: conn.errorCode || null,
          lastError: conn.lastError || null,
          lastErrorAt: conn.lastErrorAt || null,
          lastErrorType: conn.lastErrorType || null,
          lastErrorSource: conn.lastErrorSource || null,
          backoffLevel: conn.backoffLevel || 0,
          rateLimitedUntil: conn.rateLimitedUntil || null,
          healthCheckInterval: conn.healthCheckInterval || null,
          lastHealthCheckAt: conn.lastHealthCheckAt || null,
          lastTested: conn.lastTested || null,
          apiKey: conn.apiKey || null,
          idToken: conn.idToken || null,
          providerSpecificData: conn.providerSpecificData
            ? JSON.stringify(conn.providerSpecificData)
            : null,
          expiresIn: conn.expiresIn || null,
          displayName: conn.displayName || null,
          globalPriority: conn.globalPriority || null,
          defaultModel: conn.defaultModel || null,
          tokenType: conn.tokenType || null,
          consecutiveUseCount: conn.consecutiveUseCount || 0,
          lastUsedAt: conn.lastUsedAt || null,
          rateLimitProtection:
            conn.rateLimitProtection === true || conn.rateLimitProtection === 1 ? 1 : 0,
          createdAt: conn.createdAt || new Date().toISOString(),
          updatedAt: conn.updatedAt || new Date().toISOString(),
        });
      }

      // 2. Provider Nodes
      const insertNode = db.prepare(`
        INSERT OR REPLACE INTO provider_nodes (id, type, name, prefix, api_type, base_url, created_at, updated_at)
        VALUES (@id, @type, @name, @prefix, @apiType, @baseUrl, @createdAt, @updatedAt)
      `);
      for (const node of data.providerNodes || []) {
        insertNode.run({
          id: node.id,
          type: node.type,
          name: node.name,
          prefix: node.prefix || null,
          apiType: node.apiType || null,
          baseUrl: node.baseUrl || null,
          createdAt: node.createdAt || new Date().toISOString(),
          updatedAt: node.updatedAt || new Date().toISOString(),
        });
      }

      // 3. Key-Value pairs
      const insertKv = db.prepare(
        "INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES (?, ?, ?)"
      );

      for (const [alias, model] of Object.entries(data.modelAliases || {})) {
        insertKv.run("modelAliases", alias, JSON.stringify(model));
      }
      for (const [toolName, mappings] of Object.entries(data.mitmAlias || {})) {
        insertKv.run("mitmAlias", toolName, JSON.stringify(mappings));
      }
      for (const [key, value] of Object.entries(data.settings || {})) {
        insertKv.run("settings", key, JSON.stringify(value));
      }
      for (const [provider, models] of Object.entries(data.pricing || {})) {
        insertKv.run("pricing", provider, JSON.stringify(models));
      }
      for (const [providerId, models] of Object.entries(data.customModels || {})) {
        insertKv.run("customModels", providerId, JSON.stringify(models));
      }
      if (data.proxyConfig) {
        insertKv.run("proxyConfig", "global", JSON.stringify(data.proxyConfig.global || null));
        insertKv.run("proxyConfig", "providers", JSON.stringify(data.proxyConfig.providers || {}));
        insertKv.run("proxyConfig", "combos", JSON.stringify(data.proxyConfig.combos || {}));
        insertKv.run("proxyConfig", "keys", JSON.stringify(data.proxyConfig.keys || {}));
      }

      // 4. Combos
      const insertCombo = db.prepare(`
        INSERT OR REPLACE INTO combos (id, name, data, sort_order, created_at, updated_at)
        VALUES (@id, @name, @data, @sortOrder, @createdAt, @updatedAt)
      `);
      for (const [index, combo] of (data.combos || []).entries()) {
        const normalizedCombo = {
          ...combo,
          sortOrder: typeof combo.sortOrder === "number" ? combo.sortOrder : index + 1,
        };
        insertCombo.run({
          id: normalizedCombo.id,
          name: normalizedCombo.name,
          data: JSON.stringify(normalizedCombo),
          sortOrder: normalizedCombo.sortOrder,
          createdAt: normalizedCombo.createdAt || new Date().toISOString(),
          updatedAt: normalizedCombo.updatedAt || new Date().toISOString(),
        });
      }
      const insertKey = db.prepare(`
        INSERT OR REPLACE INTO api_keys (id, name, key, machine_id, model_access_mode, allowed_models, no_log, created_at)
        VALUES (@id, @name, @key, @machineId, @modelAccessMode, @allowedModels, @noLog, @createdAt)
      `);
      for (const apiKey of data.apiKeys || []) {
        insertKey.run({
          id: apiKey.id,
          name: apiKey.name,
          key: apiKey.key,
          machineId: apiKey.machineId || null,
          modelAccessMode: parseModelAccessMode(apiKey.modelAccessMode, apiKey.allowedModels),
          allowedModels: JSON.stringify(apiKey.allowedModels || []),
          noLog: apiKey.noLog ? 1 : 0,
          createdAt: apiKey.createdAt || new Date().toISOString(),
        });
      }
    });

    migrate();

    const migratedPath = jsonPath + ".migrated";
    fs.renameSync(jsonPath, migratedPath);
    console.log(`[DB] ✓ Migration complete. Original saved as ${migratedPath}`);

    const legacyBackupDir = path.join(DATA_DIR, "db_backups");
    if (fs.existsSync(legacyBackupDir)) {
      const jsonBackups = fs.readdirSync(legacyBackupDir).filter((f) => f.endsWith(".json"));
      if (jsonBackups.length > 0) {
        console.log(
          `[DB] Note: ${jsonBackups.length} legacy .json backups remain in ${legacyBackupDir}`
        );
      }
    }
  } catch (err) {
    console.error("[DB] Migration from db.json failed:", err.message);
  }
}
