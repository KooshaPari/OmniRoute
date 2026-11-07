import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { auditMigrationCollisions } from "./migration-collision-audit.mjs";
import { assessUsage185 } from "./migration-usage185-assessment.mjs";
import { assessGuardedAdditive, guardedAdditiveTargets } from "./guarded-additive-assessment.mjs";

/** Reads an operator-supplied, standalone offline snapshot; never use on a live database. */
export function auditOfflineSnapshot({ snapshotPath, migrationsDir, offlineSnapshot, recipes = [] }) {
  if (offlineSnapshot !== true) throw new Error("Explicit offlineSnapshot confirmation required");
  const snapshot = resolve(snapshotPath);
  if (!statSync(snapshot).isFile()) throw new Error("Snapshot must be a regular file");
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    if (existsSync(snapshot + suffix)) throw new Error(`Snapshot has ${suffix} sidecar`);
  }
  const files = readdirSync(migrationsDir).sort().flatMap((filename) => {
    const match = /^(\d+)_(.+)\.sql$/.exec(filename);
    return match ? [{ version: match[1], name: match[2], bytes: readFileSync(join(migrationsDir, filename)) }] : [];
  });
  const uri = `${pathToFileURL(snapshot).href}?mode=ro&immutable=1`;
  const db = new DatabaseSync(uri, { readOnly: true });
  try {
    const rows = db.prepare("SELECT version, name FROM _omniroute_migrations").all();
    const numeric = rows.filter((row) => typeof row.version === "string" && /^\d+$/.test(row.version));
    const report = auditMigrationCollisions(numeric, files, recipes);
    const collision = report.collisions.find((item) => item.version === "185");
    const tableExists = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='usage_history'").get());
    const columns = tableExists ? db.prepare("PRAGMA table_xinfo(usage_history)").all() : [];
    const usage185 = assessUsage185({ ...collision, tableExists, columns });
    const guardedAdditive = guardedAdditiveTargets.map(({ version, tableName }) => {
      const item = report.collisions.find((entry) => entry.version === version);
      const object = db.prepare("SELECT type FROM main.sqlite_master WHERE name = ? COLLATE NOCASE AND type != 'trigger' LIMIT 1").get(tableName);
      const tableColumns = object?.type === "table" ? db.prepare("SELECT * FROM pragma_table_xinfo(?)").all(tableName) : [];
      return assessGuardedAdditive({ ...item, version, tableName, objectType: object?.type, columns: tableColumns });
    });
    return { ...report, ledgerRecords: rows.length, unsupportedLedgerRecords: rows.length - numeric.length,
      usage185, guardedAdditive,
      snapshotAssumption: "operator-confirmed offline standalone snapshot; WAL contents are not read" };
  } finally {
    db.close();
  }
}
