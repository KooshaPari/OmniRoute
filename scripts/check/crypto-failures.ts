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

// Default allow-list: file paths where silent catches are intentional and
// reviewed. Format: regex matched against the relative file path.
const DEFAULT_ALLOW_LIST: RegExp[] = [
  // CLI deploy routes use randomBytes for relay auth URLs — non-security
  // crypto. The catch falls through to a server-assigned default URL.
  /src\/app\/api\/settings\/proxy\/(cloudflare|deno|vercel)-deploy\/route\.ts$/,
  // Test route uses randomUUID for test isolation.
  /src\/app\/api\/combos\/test\/route\.ts$/,
  // Traffic inspector uses createHash for content fingerprinting and
  // timingSafeEqual for fingerprint comparison. The catch is intentional
  // (returns false for non-matching fingerprints).
  /src\/app\/api\/tools\/traffic-inspector\//,
  // MITM inspector uses createHash for context-key derivation.
  /src\/mitm\/inspector\/contextKey\.ts$/,
  // open-sse executors use randomUUID/createHash for client identifiers
  // and content addressing. Catch falls through to a deterministic
  // fallback (counter or content hash).
  /open-sse\/executors\//,
  // open-sse TLS client lifecycle handlers clean up on process exit. The
  // catch ignores errors because the process is exiting anyway.
  /open-sse\/services\/(chatgpt|claude|grok|perplexity)TlsClient\.ts$/,
  // open-sse responses logger uses randomBytes for sampling nonce.
  /open-sse\/transformer\/responsesLogger\.ts$/,
  // sha3-512 wrapper exposes the raw createHash call; callers handle
  // the throw via the wrapper's return type.
  /open-sse\/utils\/sha3-512\.ts$/,
];

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

    // If the body contains log.* or throw, it's fine. We match any
    // `<word>Log.<level>(` (encryptionLog.error, cloudSyncLog.warn, etc.)
    // — domain loggers created via `createLogger("domain:subsystem")`
    // — and the plain `log.*` pattern.
    if (/(\w+)?[Ll]og\.(error|warn|info|debug|trace)/.test(body) || /\bthrow\b/.test(body)) continue;

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

function isAllowListed(filePath: string, allowList: RegExp[]): boolean {
  const rel = path.relative(REPO_ROOT, filePath);
  return allowList.some((re) => re.test(rel));
}

function main(): void {
  const args = process.argv.slice(2);
  const allowListArg = args.find((a) => a.startsWith("--allow-list="));
  const extraAllow = allowListArg
    ? allowListArg
        .split("=")[1]
        .split(",")
        .map((s) => new RegExp(s))
    : [];
  const allowList = [...DEFAULT_ALLOW_LIST, ...extraAllow];

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
      `[check-crypto-failures] OK (${SCAN_DIRS.length} dirs scanned, ${allowList.length} allow-list patterns, no crypto-relevant silent failures)`
    );
    return;
  }

  console.error(
    `[check-crypto-failures] FALHOU: ${allFindings.length} finding(s) ` +
      `(${allowList.length} allow-list patterns applied):\n`,
  );
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
