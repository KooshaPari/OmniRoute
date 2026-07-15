#!/usr/bin/env node
/**
 * fix-package-json.mjs — Fix unescaped double quotes inside JSON strings
 *
 * The test scripts contain glob paths like "open-sse/executors/__tests__/**"
 * where the leading " is NOT escaped, breaking JSON. We track string context
 * and only escape " that appear INSIDE a JSON string value.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../package.json", import.meta.url).pathname;
const content = readFileSync(path, "utf-8");

// Path prefixes that appear as glob-path arguments inside test scripts
const KNOWN_PATHS = [
  // Not needed anymore — we detect via string context
];

let result = "";
let inString = false;

for (let i = 0; i < content.length; i++) {
  const ch = content[i];
  const prev = i > 0 ? content[i - 1] : "";

  // ── 1. Handle escaped sequences: \" and \\ (and other \x) ──────
  if (ch === "\\") {
    // Consume the backslash and the escaped character as-is
    result += ch;
    if (i + 1 < content.length) {
      i++;
      result += content[i];
    }
    continue;
  }

  // ── 2. Handle double quotes (toggle string mode) ──────────────
  if (ch === '"') {
    if (inString) {
      // Inside a string: this " might be a glob delimiter (needs escaping)
      // or the true string terminator (followed by , newline } or ])
      const next = content[i + 1] || "";
      const isTerminator = next === "," || next === ":" || next === "\n" || next === "}" || next === "]";
      if (!isTerminator) {
        // Glob delimiter — escape it so the string continues
        result += "\\";
      } else {
        // True string terminator — exit string mode
        inString = false;
      }
    } else {
      // Outside a string: this " opens a new string
      inString = true;
    }
    result += ch;
    continue;
  }

  // ── 3. Everything else passes through ─────────────────────────
  result += ch;
}

writeFileSync(path, result);

try {
  JSON.parse(result);
  console.log("VALID JSON");
} catch (e) {
  const posMatch = e.message.match(/position (\d+)/);
  const pos = posMatch ? parseInt(posMatch[1]) : 0;
  const ctx = result.slice(Math.max(0, pos - 50), pos + 50);
  console.error("STILL INVALID:", e.message.slice(0, 120));
  console.error("Context:", JSON.stringify(ctx));
  process.exit(1);
}
