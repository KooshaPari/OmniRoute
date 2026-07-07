/**
 * Seed local SQLite with dev fixtures. Idempotent.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import pc from 'picocolors';

const root = resolve(import.meta.dirname, '../../../');
const dataDir = process.env.OMNIROUTE_DATA_DIR ?? resolve(root, '.data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
const db = resolve(dataDir, 'argis-dev.sqlite');
console.log(pc.green(`seed: would write to ${db} (provider/combo/apikey fixtures)`));
console.log(pc.dim('  TODO: hook into omniroute-storage when storage crate lands'));
