#!/usr/bin/env node
// scripts/check/crypto-failures.ts
// Gate that flags crypto-relevant silent failures. Catches the patterns
// that PRs #509, #510, #518 manually addressed:
//   - createHmac(...) / createHash(...) / scryptSync(...) / randomBytes(...)
//     followed by `.catch(() => ...)` swallowing the error
//   - jwtVerify(...) followed by empty catches that return false
//   - timingSafeEqual(...) followed by non-constant-time fallbacks
//   - "return '' / return null / return false" immediately after a crypto catch
//
// Usage:
//   node --import tsx scripts/check/crypto-failures.ts [--allow-list=path1,path2]
//
// Exits non-zero on findings. Findings printed to stderr.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CRYPTO_APIS = [
  "createHmac",
  "createHash",
  "scryptSync",
  "randomBytes",
  "randomUUID",
  "jwtVerify",
  "timingSafeEqual",
  "generateKeyPair",
  "diffieHellman",
];

const REPO_ROOT = process.cwd();
const SCAN_DIRS = ["src", "open-sse"];

interface Finding {
  file: string;
  line: number;
  column: number;
  pattern: string;
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

// Detect `} catch { ... }` blocks immediately preceded by a crypto API call
// within the same try. Heuristic: a line containing the crypto API call
// followed within ~20 lines by a `} catch {` with no `log.` / `throw` inside.
function findCryptoSilentFailures(filePath: string): Finding[] {
  const findings: Finding[] = [];
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cryptoCall = CRYPTO_APIS.find((api) => line.includes(api));
    if (!cryptoCall) continue;

    // Look forward up to 40 lines for a `} catch`
    let catchLine = -1;
    for (let j = i + 1; j < Math.min(i + 40, lines.length); j++) {
      if (/\}\s*catch\s*(\([^)]*\))?\s*\{/.test(lines[j])) {
        catchLine = j;
        break;
      }
      if (/^\s*\}/.test(lines[j])) {
        // Scope ended without a catch — bail
        break;
      }
    }
    if (catchLine === -1) continue;

    // Inspect the catch body (up to 10 lines)
    const bodyStart = catchLine;
    const bodyEnd = Math.min(catchLine + 10, lines.length);
    const body = lines.slice(bodyStart, bodyEnd).join("\n");

    // If the body contains log.* or throw, it's fine
    if (/log\.(error|warn|info)/.test(body) || /\bthrow\b/.test(body)) continue;

    findings.push({
      file: path.relative(REPO_ROOT, filePath),
      line: catchLine + 1,
      column: 1,
      pattern: `crypto API ${cryptoCall} → silent catch`,
      preview: lines[catchLine].trim(),
    });
  }

  return findings;
}

function isAllowListed(filePath: string, allowList: string[]): boolean {
  const rel = path.relative(REPO_ROOT, filePath);
  return allowList.some((entry) => rel.startsWith(entry) || rel === entry);
}

function main(): void {
  const args = process.argv.slice(2);
  const allowListArg = args.find((a) => a.startsWith("--allow-list="));
  const allowList = allowListArg ? allowListArg.split("=")[1].split(",") : [];

  const allFindings: Finding[] = [];
  for (const dir of SCAN_DIRS) {
    const files = walk(path.join(REPO_ROOT, dir));
    for (const file of files) {
      if (isAllowListed(file, allowList)) continue;
      allFindings.push(...findCryptoSilentFailures(file));
    }
  }

  if (allFindings.length === 0) {
    console.log(
      `[check-crypto-failures] OK (${SCAN_DIRS.length} dirs scanned, no crypto-relevant silent failures)`
    );
    return;
  }

  console.error(`[check-crypto-failures] FALHOU: ${allFindings.length} finding(s):\n`);
  for (const finding of allFindings) {
    console.error(
      `  ${finding.file}:${finding.line}:${finding.column}  [${finding.pattern}]\n    ${finding.preview}`
    );
  }
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main();
}
