#!/usr/bin/env node
// scripts/check/as-cast-drift.ts
//
// Detects `as unknown as X` casts in `src/lib/db/`. The 2026-08-05 quota
// keystore type-drift bug (PR #505) was caused by these casts hiding a
// missing type import — `PoolUsage`, `PoolUsageWithDimensions`, and
// `PlanPoolUsage` were referenced but never defined. The casts made the
// code compile silently.
//
// Two patterns are scanned:
//
// 1. `getDbInstance() as unknown as DbLike` — INTENTIONAL narrowing
//    pattern (each module limits its DB surface). Allowed by default
//    (allow-list of permitted narrowing types).
//
// 2. `rowToCamel(...) as unknown as SomeDomainType` — POTENTIAL DRIFT.
//    These cast an untyped JsonRecord to a specific row type, hiding
//    schema changes. FLAGGED for audit.
//
// Usage:
//   node --import tsx scripts/check/as-cast-drift.ts [--allow-list=Type1,Type2]
//
// Exits non-zero on findings.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SCAN_DIRS = ["src/lib/db"];

// Default allow-list: types we know are safe narrowing targets. The `DbLike`
// pattern is intentional (each module narrows getDbInstance() to a local
// DbLike). Adapter types (`NodeJS`, `RunResult`) are runtime narrowing for
// the better-sqlite3 ↔ sql.js abstraction. Domain row types
// (`RegisteredKey`, `QuotaSnapshotRow`, `RelayToken`, etc.) are intentionally
// NOT allow-listed — they represent known drift risk per PR #505 and should
// be migrated to runtime-validated row mapping.
const DEFAULT_ALLOW_LIST = [
  "DbLike",
  "NodeJS", // adapter narrowing (sql.js / better-sqlite3)
  "RunResult", // better-sqlite3 RunResult type alias for sql.js compat
];

interface CastFinding {
  file: string;
  line: number;
  cast: string;
  context: string;
  isAllowListed: boolean;
}

const CAST_RE = /\bas\s+unknown\s+as\s+([A-Z][A-Za-z0-9_<>,\s|&]*)/g;

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      walk(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function findCasts(filePath: string, allowList: Set<string>): CastFinding[] {
  const findings: CastFinding[] = [];
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    CAST_RE.lastIndex = 0;
    let match;
    while ((match = CAST_RE.exec(line)) !== null) {
      const cast = match[1].trim();
      const baseType = cast.split(/[<,|&]/)[0].trim();
      const isAllowListed = allowList.has(baseType);
      findings.push({
        file: path.relative(process.cwd(), filePath),
        line: i + 1,
        cast,
        context: line.trim().slice(0, 120),
        isAllowListed,
      });
    }
  }
  return findings;
}

function main(): void {
  const args = process.argv.slice(2);
  const allowArg = args.find((a) => a.startsWith("--allow-list="));
  const extraAllow = allowArg ? allowArg.split("=")[1].split(",") : [];
  const allowList = new Set([...DEFAULT_ALLOW_LIST, ...extraAllow]);

  const allFindings: CastFinding[] = [];
  for (const dir of SCAN_DIRS) {
    const files = walk(path.join(process.cwd(), dir));
    for (const file of files) {
      allFindings.push(...findCasts(file, allowList));
    }
  }

  const flagged = allFindings.filter((f) => !f.isAllowListed);
  const allowed = allFindings.filter((f) => f.isAllowListed);

  if (flagged.length === 0) {
    console.log(
      `[check-as-cast-drift] OK (${allFindings.length} total casts, ${allowed.length} allow-listed, 0 flagged)`,
    );
    process.exitCode = 0;
    return;
  }

  console.error(
    `[check-as-cast-drift] ${flagged.length} potentially-drifting casts found ` +
      `(${allowed.length} allow-listed):`,
  );
  for (const f of flagged) {
    console.error(`  ${f.file}:${f.line}  [as unknown as ${f.cast}]`);
    console.error(`    ${f.context}`);
  }
  console.error("");
  console.error(
    `[check-as-cast-drift] These casts hide schema drift. Recommend:\n` +
      `  - For row→domain conversions: add runtime validation (Zod or toRecord<T>)\n` +
      `  - For intentional narrowing: add the target type to --allow-list\n` +
      `  - Allow-list syntax: --allow-list=DbLike,SomeType`,
  );
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
