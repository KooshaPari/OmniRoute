// src/lib/db/adapters/sqljsAdapter.ts
import fs from "node:fs";
import path from "node:path";
import { createLogger } from "@/shared/utils/logger";
import type { SqliteAdapter, PreparedStatement, RunResult } from "./types";

const log = createLogger("db:adapter:sqljs");

const SAVE_DEBOUNCE_MS = 100;
const CHECKPOINT_INTERVAL_MS = 60_000;

let _sqlJsLib: Awaited<ReturnType<(typeof import("sql.js"))["default"]>> | null = null;

function resolveSqlJsWasmPath(): string {
  const candidatePaths = [
    path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
    path.join(
      process.cwd(),
      ".next",
      "standalone",
      "node_modules",
      "sql.js",
      "dist",
      "sql-wasm.wasm"
    ),
  ];

  for (const candidatePath of candidatePaths) {
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return candidatePaths[0];
}

async function loadSqlJs(): Promise<typeof _sqlJsLib> {
  if (_sqlJsLib) return _sqlJsLib;
  const initSqlJs = ((await import("sql.js")) as { default: (typeof import("sql.js"))["default"] })
    .default;
  const wasmPath = resolveSqlJsWasmPath();

  _sqlJsLib = await initSqlJs({
    locateFile(fileName) {
      if (fileName === "sql-wasm.wasm") {
        return wasmPath;
      }
      return fileName;
    },
  });
  return _sqlJsLib;
}

export async function createSqlJsAdapter(filePath: string): Promise<SqliteAdapter> {
  const SQLLib = await loadSqlJs();
  if (!SQLLib) throw new Error("[sqljsAdapter] Failed to load sql.js");

  const buf = filePath !== ":memory:" && fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
  const db = new SQLLib.Database(buf ? new Uint8Array(buf) : undefined);

  let dirty = false;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let _isOpen = true;

  function persist(): void {
    if (filePath === ":memory:") return;
    const data = db.export();
    fs.writeFileSync(filePath, Buffer.from(data));
    dirty = false;
  }

  function scheduleSave(): void {
    dirty = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (dirty) {
        try {
          persist();
        } catch (e) {
          log.error({ err: e }, "save failed");
        }
      }
    }, SAVE_DEBOUNCE_MS);
  }

  function runSavepoint<T>(fn: (...args: unknown[]) => T, ...args: unknown[]): T {
    const sp = `sp_${Math.random().toString(36).slice(2)}`;
    db.run(`SAVEPOINT "${sp}"`);
    try {
      const result = fn(...args);
      db.run(`RELEASE "${sp}"`);
      scheduleSave();
      return result;
    } catch (err) {
      try {
        db.run(`ROLLBACK TO "${sp}"`);
        db.run(`RELEASE "${sp}"`);
      } catch (rollbackErr) {
        log.error(
          { err: rollbackErr, savepoint: sp },
          "sqljsAdapter: rollback after transaction failure also failed — DB may be in inconsistent state"
        );
      }
      throw err;
    }
  }

  function makeStatement(sql: string): PreparedStatement {
    return {
      run(...params: unknown[]): RunResult {
        const stmt = db.prepare(sql);
        try {
          if (params.length) stmt.bind(params as unknown[]);
          stmt.step();
          const changes = db.getRowsModified();
          const lastRows = db.exec("SELECT last_insert_rowid() as id");
          const lastInsertRowid = (lastRows[0]?.values?.[0]?.[0] as number | null | undefined) ?? 0;
          scheduleSave();
          return { changes, lastInsertRowid };
        } finally {
          stmt.free();
        }
      },
      get(...params: unknown[]): unknown {
        const stmt = db.prepare(sql);
        try {
          if (params.length) stmt.bind(params as unknown[]);
          if (stmt.step()) return stmt.getAsObject();
          return undefined;
        } finally {
          stmt.free();
        }
      },
      all(...params: unknown[]): unknown[] {
        const stmt = db.prepare(sql);
        try {
          if (params.length) stmt.bind(params as unknown[]);
          const rows: unknown[] = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          return rows;
        } finally {
          stmt.free();
        }
      },
    };
  }

  const checkpointTimer = setInterval(() => {
    if (dirty)
      try {
        persist();
      } catch (err) {
        log.error({ err, filePath }, "sqljsAdapter: checkpoint persist failed — DB may be inconsistent until next save");
      }
  }, CHECKPOINT_INTERVAL_MS);
  (checkpointTimer as unknown as NodeJS.Timeout).unref?.();

  function gracefulClose(): void {
    clearInterval(checkpointTimer as unknown as NodeJS.Timeout);
    if (saveTimer) clearTimeout(saveTimer);
    if (dirty)
      try {
        persist();
      } catch (err) {
        log.error({ err, filePath }, "sqljsAdapter: gracefulClose persist failed — data loss possible");
      }
    try {
      db.close();
    } catch (err) {
      log.error({ err, filePath }, "sqljsAdapter: db.close failed during gracefulClose");
    }
    _isOpen = false;
  }

  const flush = (): void => {
    if (dirty)
      try {
        persist();
      } catch (err) {
        log.error({ err, filePath }, "sqljsAdapter: flush persist failed (signal handler)");
      }
  };
  process.on("beforeExit", flush);
  process.on("SIGINT", flush);
  process.on("SIGTERM", flush);

  return {
    driver: "sql.js",

    get open() {
      return _isOpen;
    },

    get name() {
      return filePath;
    },

    prepare(sql: string): PreparedStatement {
      return makeStatement(sql);
    },

    exec(sql: string): void {
      db.run(sql);
      scheduleSave();
    },

    pragma(pragmaStr: string, options?: { simple?: boolean }): unknown {
      const result = db.exec(`PRAGMA ${pragmaStr}`);
      if (!result.length) return null;
      const rows = result[0];
      if (options?.simple) {
        return rows.values?.[0]?.[0] ?? null;
      }
      return (rows.values ?? []).map((row: unknown[]) =>
        Object.fromEntries(rows.columns.map((col: string, i: number) => [col, row[i]]))
      );
    },

    transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T {
      return (...args: unknown[]) => runSavepoint(fn, ...args);
    },

    immediate(fn: () => void): void {
      runSavepoint(() => fn());
    },

    async backup(destination: string): Promise<void> {
      if (dirty) persist();
      if (filePath !== ":memory:") fs.copyFileSync(filePath, destination);
    },

    checkpoint(_mode = "TRUNCATE"): void {
      if (dirty)
        try {
          persist();
        } catch (err) {
          log.error({ err, filePath }, "sqljsAdapter: explicit checkpoint persist failed");
        }
    },

    close(): void {
      gracefulClose();
    },

    get raw() {
      return db;
    },
  };
}
