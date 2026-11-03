import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { auditMigrationCollisions } from "./migration-collision-audit.mjs";

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
    return { ...report, ledgerRecords: rows.length, unsupportedLedgerRecords: rows.length - numeric.length,
      snapshotAssumption: "operator-confirmed offline standalone snapshot; WAL contents are not read" };
  } finally {
    db.close();
  }
}
