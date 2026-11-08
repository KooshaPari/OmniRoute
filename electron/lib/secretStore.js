"use strict";

/**
 * Packaged-safe credential persistence for the Electron desktop shell.
 *
 * The login IPC handler used to `require("../src/lib/db/secrets")`, a
 * TypeScript module that only exists in the Next.js source tree. In a packaged
 * build that path is not inside app.asar, so every credential the desktop
 * login flow extracted failed to persist.
 *
 * This module writes the same row the server's `src/lib/db/secrets.ts` writes
 * (namespace 'secrets', key = provider id, value = JSON-encoded string)
 * against the same DATA_DIR/storage.sqlite the bundled server uses, using
 * only SQLite drivers that are reachable from the Electron main process.
 */

const fs = require("fs");
const path = require("path");

const SECRETS_NAMESPACE = "secrets";

/**
 * Open the OmniRoute SQLite database for writing.
 *
 * Mirrors electron/sqlite-inspection.js: better-sqlite3 when it resolves
 * (development checkouts have it in the repository root node_modules), and the
 * built-in node:sqlite module otherwise (a packaged app ships neither the
 * server's node_modules nor better-sqlite3).
 */
function openDatabase(dbPath) {
  const errors = [];

  try {
    const Database = require("better-sqlite3");
    return new Database(dbPath);
  } catch (error) {
    errors.push(`better-sqlite3: ${error.message}`);
  }

  try {
    const { DatabaseSync } = require("node:sqlite");
    return new DatabaseSync(dbPath);
  } catch (error) {
    errors.push(`node:sqlite: ${error.message}`);
  }

  throw new Error(`No SQLite driver available for ${dbPath} (${errors.join("; ")})`);
}

/**
 * Persist a credential under `key` in the `secrets` namespace.
 *
 * @param {string} key - provider id
 * @param {string} value - credential payload; stored JSON-encoded, matching
 *   the server's `getPersistedSecret` reader
 * @param {{ dataDir: string }} options - DATA_DIR the bundled server uses
 * @returns {boolean} true when the row was written
 */
function persistSecret(key, value, { dataDir } = {}) {
  if (!key || !value) {
    throw new Error("persistSecret requires a non-empty key and value");
  }
  if (!dataDir) {
    throw new Error("persistSecret requires a dataDir");
  }

  const dbPath = path.join(dataDir, "storage.sqlite");
  if (!fs.existsSync(dbPath)) {
    throw new Error(`OmniRoute database not found at ${dbPath}`);
  }

  const db = openDatabase(dbPath);
  try {
    db.prepare("INSERT OR IGNORE INTO key_value (namespace, key, value) VALUES (?, ?, ?)").run(
      SECRETS_NAMESPACE,
      key,
      JSON.stringify(value)
    );
    return true;
  } finally {
    try {
      db.close();
    } catch {
      // Already closed.
    }
  }
}

module.exports = { persistSecret };
