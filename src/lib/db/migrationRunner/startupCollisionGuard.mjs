/** Read-only strict preflight. This is not a migration or a recovery authorization. */
export function assertStartupMigrationIdentities(db, files) {
  if (files.length === 0) throw new Error("[Migration] Startup identity preflight has no migration files.");
  const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_omniroute_migrations'").get();
  if (!table) throw new Error("[Migration] Startup identity preflight requires an existing migration ledger.");
  const rows = db.prepare("SELECT version, name FROM _omniroute_migrations ORDER BY version").all();
  if (rows.length === 0) throw new Error("[Migration] Startup identity preflight found an empty migration ledger.");
  const slots = new Map();
  for (const row of rows) {
    if (typeof row.version !== "string" || !row.version || typeof row.name !== "string" || !row.name || slots.has(row.version)) {
      throw new Error("[Migration] Startup identity preflight found an invalid ledger identity.");
    }
    slots.set(row.version, row.name);
  }
  const seen = new Set();
  const mismatches = [];
  for (const file of files) {
    if (typeof file.version !== "string" || !file.version || typeof file.name !== "string" || !file.name) {
      throw new Error("[Migration] Startup identity preflight found an invalid migration file identity.");
    }
    if (seen.has(file.version)) throw new Error(`[Migration] Duplicate startup migration version ${file.version}.`);
    seen.add(file.version);
    const prior = slots.get(file.version);
    if (prior && prior !== file.name) mismatches.push(`${file.version}: ${prior} != ${file.name}`);
  }
  if (mismatches.length) throw new Error(`[Migration] Startup identity preflight blocked ${mismatches.length} collision(s): ${mismatches.join(", ")}`);
}
