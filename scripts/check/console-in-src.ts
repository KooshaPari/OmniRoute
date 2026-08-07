#!/usr/bin/env node
// scripts/check/console-in-src.ts
// Gate that flags `console.log|warn|error|info|debug` calls in src/lib/ and
// open-sse/. Complements the existing check-fail-open.sh and is the automated
// regression detector for the ~250 callsite migration done across PRs #522, #525.
//
// Excludes:
//   - .test.* / .spec.* files
//   - Explicitly allowed CLI/intentional files:
//     src/mitm/* (CLI-driven tooling)
//     src/lib/proxyLogger.ts (defines the logger interface itself)
//     src/lib/consoleInterceptor.ts (defines the interceptor)
//     src/app/* (browser-side React, uses console for devtools)
//
// Usage:
//   node --import tsx scripts/check/console-in-src.ts [--json] [--allow-list=path1,path2]

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SCAN_DIRS = ["src/lib", "open-sse"];
const DEFAULT_ALLOW = [
  "src/lib/proxyLogger.ts",
  "src/lib/consoleInterceptor.ts",
];

interface Finding {
  file: string;
  line: number;
  column: number;
  call: string;
  preview: string;
}

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

const CONSOLE_CALL_RE = /console\.(log|warn|error|info|debug)\s*\(/g;

function findConsoleCalls(filePath: string): Finding[] {
  const findings: Finding[] = [];
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    CONSOLE_CALL_RE.lastIndex = 0;
    while ((match = CONSOLE_CALL_RE.exec(line)) !== null) {
      findings.push({
        file: path.relative(process.cwd(), filePath),
        line: i + 1,
        column: match.index + 1,
        call: match[0],
        preview: line.trim(),
      });
    }
  }
  return findings;
}

function isAllowListed(filePath: string, allowList: string[]): boolean {
  const rel = path.relative(process.cwd(), filePath);
  return DEFAULT_ALLOW.includes(rel) || allowList.some((entry) => rel === entry || rel.startsWith(entry));
}

function main(): void {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");
  const allowListArg = args.find((a) => a.startsWith("--allow-list="));
  const allowList = allowListArg ? allowListArg.split("=")[1].split(",") : [];

  const allFindings: Finding[] = [];
  for (const dir of SCAN_DIRS) {
    const files = walk(path.join(process.cwd(), dir));
    for (const file of files) {
      if (file.includes(".test.") || file.includes(".spec.")) continue;
      if (isAllowListed(file, allowList)) continue;
      allFindings.push(...findConsoleCalls(file));
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ findings: allFindings }, null, 2));
    if (allFindings.length > 0) process.exitCode = 1;
    return;
  }

  if (allFindings.length === 0) {
    console.log(
      `[check-console-in-src] OK (${SCAN_DIRS.join(", ")} scanned, no console.* callsites)`
    );
    return;
  }

  console.error(`[check-console-in-src] FALHOU: ${allFindings.length} finding(s):\n`);
  for (const finding of allFindings.slice(0, 50)) {
    console.error(
      `  ${finding.file}:${finding.line}:${finding.column}  [${finding.call}]\n    ${finding.preview}`
    );
  }
  if (allFindings.length > 50) {
    console.error(`  ... and ${allFindings.length - 50} more`);
  }
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main();
}
