import fs from "node:fs";
import { createLogger } from "@/shared/utils/logger";
import type { PreparedStatement, RunResult, SqliteAdapter } from "./types";

const log = createLogger("db:adapter:node-sqlite-shared");

export interface NodeSqliteDatabaseLike {
  prepare(sql: string): {
    run(...p: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...p: unknown[]): unknown;
    all(...p: unknown[]): unknown[];
  };
  exec(sql: string): void;
  close(): void;
}

const MAX_STMT_CACHE_SIZE = 200;

export function createNodeSqliteAdapterFromDatabase(
  db: NodeSqliteDatabaseLike,
  filePath: string,
  onClose?: () => void
): SqliteAdapter {
  let _isOpen = true;
  type NodeSqliteStatement = ReturnType<NodeSqliteDatabaseLike["prepare"]>;
  interface CachedStatement {
    stmt: NodeSqliteStatement;
  }
  const stmtCache = new Map<string, CachedStatement>();

  function finalizeStatement(stmt: NodeSqliteStatement | undefined) {
    if (stmt && "finalize" in stmt) {
      try {
        (stmt as NodeSqliteStatement & { finalize: () => void }).finalize();
      } catch (err) {
        log.error({ err }, "nodeSqliteShared: finalize() failed during cache eviction");
      }
    }
  }

  function getCached(sql: string) {
    let entry = stmtCache.get(sql);
    if (entry) {
      stmtCache.delete(sql);
      stmtCache.set(sql, entry);
    } else {
      const stmt = db.prepare(sql);
      if (stmtCache.size >= MAX_STMT_CACHE_SIZE) {
        const oldestKey = stmtCache.keys().next().value;
        if (oldestKey !== undefined) {
          finalizeStatement(stmtCache.get(oldestKey)?.stmt);
          stmtCache.delete(oldestKey);
        }
      }
      entry = { stmt };
      stmtCache.set(sql, entry);
    }
    return entry.stmt;
  }

  function runSavepoint<T>(fn: (...args: unknown[]) => T, ...args: unknown[]): T {
    const sp = `sp_${Math.random().toString(36).slice(2)}`;
    db.exec(`SAVEPOINT "${sp}"`);
    try {
      const result = fn(...args);
      db.exec(`RELEASE "${sp}"`);
      return result;
    } catch (err) {
      try {
        db.exec(`ROLLBACK TO "${sp}"`);
        db.exec(`RELEASE "${sp}"`);
      } catch (rollbackErr) {
        log.error(
          { err: rollbackErr, savepoint: sp },
          "nodeSqliteShared: rollback after transaction failure also failed — DB may be in inconsistent state"
        );
      }
      throw err;
    }
  }

  function close() {
    try {
      onClose?.();
    } catch (err) {
      log.error({ err }, "nodeSqliteShared: onClose callback threw during close()");
    }
    try {
      for (const entry of stmtCache.values()) {
        finalizeStatement(entry.stmt);
      }
      stmtCache.clear();
    } catch (err) {
      log.error({ err }, "nodeSqliteShared: statement-cache finalization failed during close()");
    }
    try {
      db.close();
    } catch (err) {
      log.error({ err, filePath }, "nodeSqliteShared: db.close failed");
    }
    _isOpen = false;
  }

  return {
    driver: "node:sqlite",
    get open() {
      return _isOpen;
    },
    get name() {
      return filePath;
    },
    prepare(sql: string): PreparedStatement {
      const stmt = getCached(sql);
      return {
        run(...params: unknown[]): RunResult {
          const r = stmt.run(...params);
          return {
            changes: Number(r.changes ?? 0),
            lastInsertRowid: Number(r.lastInsertRowid ?? 0),
          };
        },
        get(...params: unknown[]): unknown {
          return stmt.get(...params);
        },
        all(...params: unknown[]): unknown[] {
          return stmt.all(...params);
        },
      };
    },
    exec(sql: string): void {
      db.exec(sql);
    },
    pragma(pragmaStr: string, options?: { simple?: boolean }): unknown {
      const sql = `PRAGMA ${pragmaStr}`;
      if (options?.simple) {
        const row = db.prepare(sql).get() as Record<string, unknown> | undefined;
        if (!row) return null;
        return Object.values(row)[0] ?? null;
      }
      return db.prepare(sql).all();
    },
    transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T {
      return (...args: unknown[]) => runSavepoint(fn, ...args);
    },
    immediate(fn: () => void): void {
      runSavepoint(() => fn());
    },
    async backup(destination: string): Promise<void> {
      try {
        db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      } catch (err) {
        log.error(
          { err, filePath, destination },
          "nodeSqliteShared: wal_checkpoint failed before backup — backup may include uncheckpointed WAL"
        );
      }
      fs.copyFileSync(filePath, destination);
    },
    checkpoint(mode = "TRUNCATE"): void {
      try {
        db.exec(`PRAGMA wal_checkpoint(${mode})`);
      } catch (err) {
        log.error(
          { err, mode, filePath },
          "nodeSqliteShared: explicit wal_checkpoint failed"
        );
      }
    },
    close,
    get raw() {
      return db;
    },
  };
}
