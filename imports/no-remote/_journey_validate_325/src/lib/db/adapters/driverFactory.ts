import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { createBetterSqliteAdapter } from "./betterSqliteAdapter";
import {
  createNodeSqliteAdapterFromDatabase,
  type NodeSqliteDatabaseLike,
} from "./nodeSqliteShared";
import type { SqliteAdapter } from "./types";

const _require = createRequire(import.meta.url);

/**
 * `omniroute repair` installs the native SQLite binding here when the bundled
 * optional dependency cannot load. Keep this lookup aligned with
 * bin/cli/runtime/sqliteRuntime.mjs so a repaired runtime is usable by the
 * server, not only by the CLI health check.
 */
export function resolveRuntimeModuleRoot(): string {
  return process.env.OMNIROUTE_RUNTIME_DIR ?? join(homedir(), ".omniroute", "runtime");
}

declare global {
  var __omnirouteSqlJsAdapters: Map<string, SqliteAdapter> | undefined;
}

function getSqlJsCache(): Map<string, SqliteAdapter> {
  if (!globalThis.__omnirouteSqlJsAdapters) {
    globalThis.__omnirouteSqlJsAdapters = new Map();
  }
  return globalThis.__omnirouteSqlJsAdapters;
}

/** Tenta abrir com better-sqlite3 e node:sqlite sincronamente. Retorna null se ambos falharem. */
export function tryOpenSync(
  filePath: string,
  options?: Record<string, unknown>
): SqliteAdapter | null {
  // better-sqlite3: rápido, nativo — skip em Bun
  if (!process.versions.bun) {
    try {
      const BetterSqlite = _require("better-sqlite3") as {
        new (p: string, o?: object): import("better-sqlite3").Database;
      };
      const db = new BetterSqlite(filePath, options);
      return createBetterSqliteAdapter(db);
    } catch {
      // continua para próximo driver
    }
  }

  // `better-sqlite3` may have been repaired into a user-writable runtime
  // directory after an ABI mismatch or a package-manager optional-dependency
  // omission. Resolve it from that package root before falling back to WASM.
  if (!process.versions.bun) {
    try {
      const runtimeRequire = createRequire(join(resolveRuntimeModuleRoot(), "package.json"));
      const BetterSqlite = runtimeRequire("better-sqlite3") as {
        new (p: string, o?: object): import("better-sqlite3").Database;
      };
      const db = new BetterSqlite(filePath, options);
      return createBetterSqliteAdapter(db);
    } catch {
      // continua para próximo driver
    }
  }

  // node:sqlite: built-in desde Node 22.5 — skip em Bun
  if (!process.versions.bun) {
    const [maj, min] = (process.versions.node ?? "0.0").split(".").map(Number);
    if (maj > 22 || (maj === 22 && min >= 5)) {
      try {
        const { DatabaseSync } = _require("node:sqlite") as {
          DatabaseSync: new (p: string) => NodeSqliteDatabaseLike;
        };
        const db = new DatabaseSync(filePath);
        return createNodeSqliteAdapterFromDatabase(db, filePath);
      } catch {
        // continua
      }
    }
  }

  return null;
}

/**
 * Pré-inicializa sql.js para um filePath.
 * Armazena em globalThis para acesso posterior via getSqlJsAdapter().
 * Idempotente — seguro chamar múltiplas vezes.
 */
export async function preInitSqlJs(filePath: string): Promise<SqliteAdapter> {
  const cache = getSqlJsCache();
  const existing = cache.get(filePath);
  if (existing) return existing;

  const { createSqlJsAdapter } = await import("./sqljsAdapter");
  const adapter = await createSqlJsAdapter(filePath);
  cache.set(filePath, adapter);
  return adapter;
}

/** Retorna adapter sql.js pré-inicializado ou null se ainda não inicializado. */
export function getSqlJsAdapter(filePath: string): SqliteAdapter | null {
  return getSqlJsCache().get(filePath) ?? null;
}

/**
 * Factory assíncrona completa: tenta todos os drivers em cascata.
 * Ordem: better-sqlite3 → node:sqlite → sql.js
 */
export async function openDatabaseAsync(
  filePath: string,
  options?: Record<string, unknown>
): Promise<SqliteAdapter> {
  const sync = tryOpenSync(filePath, options);
  if (sync) {
    console.log(`[DB] Driver: ${sync.driver} | file: ${filePath}`);
    return sync;
  }

  console.warn("[DB] Synchronous drivers unavailable — falling back to sql.js (WASM)");
  const adapter = await preInitSqlJs(filePath);
  console.log(`[DB] Driver: sql.js | file: ${filePath}`);
  return adapter;
}
