#!/usr/bin/env node
// scripts/check/broken-imports.ts
// Gate that scans for known broken import paths. The original bug was
// `import { isFeatureFlagEnabled } from "@/lib/featureFlags"` (PR #507)
// — the module lives at `@/shared/utils/featureFlags`.
//
// Maintains a small JSON registry of known broken paths. Add new entries
// as similar drift bugs are found.
//
// Usage:
//   node --import tsx scripts/check/broken-imports.ts [--registry=path/to/registry.json]

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SCAN_DIRS = ["src", "open-sse", "scripts"];

interface BrokenImport {
  broken: string;
  correct: string;
  reason?: string;
}

const DEFAULT_REGISTRY: BrokenImport[] = [
  {
    broken: "@/lib/featureFlags",
    correct: "@/shared/utils/featureFlags",
    reason: "Module moved during refactor; PR #507 fixed all callers",
  },
];

interface Finding {
  file: string;
  line: number;
  column: number;
  importPath: string;
  correct: string;
}

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walk(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function findBrokenImports(filePath: string, registry: BrokenImport[]): Finding[] {
  const findings: Finding[] = [];
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split("\n");

  const importRe = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    importRe.lastIndex = 0;
    let match;
    while ((match = importRe.exec(line)) !== null) {
      const importedPath = match[1];
      const broken = registry.find((r) => importedPath === r.broken);
      if (broken) {
        findings.push({
          file: path.relative(process.cwd(), filePath),
          line: i + 1,
          column: match.index + 1,
          importPath: broken.broken,
          correct: broken.correct,
        });
      }
    }
  }
  return findings;
}

function loadRegistry(registryPath?: string): BrokenImport[] {
  if (!registryPath) return DEFAULT_REGISTRY;
  if (!fs.existsSync(registryPath)) {
    console.error(`[check-broken-imports] Registry not found: ${registryPath}`);
    process.exitCode = 1;
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(registryPath, "utf8"));
  } catch (err) {
    console.error(`[check-broken-imports] Failed to parse registry: ${(err as Error).message}`);
    process.exitCode = 1;
    return [];
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const registryArg = args.find((a) => a.startsWith("--registry="));
  const registryPath = registryArg ? registryArg.split("=")[1] : undefined;
  const registry = loadRegistry(registryPath);

  if (registry.length === 0) {
    console.error("[check-broken-imports] No registry entries; nothing to check.");
    process.exitCode = 1;
    return;
  }

  const allFindings: Finding[] = [];
  for (const dir of SCAN_DIRS) {
    const files = walk(path.join(process.cwd(), dir));
    for (const file of files) {
      allFindings.push(...findBrokenImports(file, registry));
    }
  }

  if (allFindings.length === 0) {
    console.log(
      `[check-broken-imports] OK (${registry.length} registry entries, no broken imports found)`
    );
    return;
  }

  console.error(`[check-broken-imports] FALHOU: ${allFindings.length} broken import(s):\n`);
  for (const finding of allFindings) {
    console.error(
      `  ${finding.file}:${finding.line}:${finding.column}  [${finding.importPath}]\n    → use ${finding.correct}`
    );
  }
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main();
}
