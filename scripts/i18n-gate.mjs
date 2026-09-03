#!/usr/bin/env node
// scripts/i18n-gate.mjs — Fail CI if any i18n locale still contains __MISSING__ markers.
// Usage: node scripts/i18n-gate.mjs src/i18n/messages/ [--strict]
// --strict also fails if any locale is missing keys present in en.json.
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2] || "src/i18n/messages";
const strict = process.argv.includes("--strict");

function getAllKeys(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, getAllKeys(v, p));
    else out[p] = v;
  }
  return out;
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
let bad = 0;
let report = [];

// 1. Detect __MISSING__: markers
for (const f of files) {
  const json = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const flat = getAllKeys(json);
  const missing = Object.entries(flat)
    .filter(([, v]) => typeof v === "string" && v.startsWith("__MISSING__:"))
    .map(([k]) => k);
  if (missing.length) {
    bad += missing.length;
    report.push(
      `${f}: ${missing.length} __MISSING__: markers (e.g. ${missing.slice(0, 3).join(", ")})`
    );
  }
}

// 2. (--strict) Detect keys in en.json missing from other locales
if (strict && files.includes("en.json")) {
  const en = getAllKeys(JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8")));
  const enKeys = new Set(Object.keys(en));
  for (const f of files) {
    if (f === "en.json") continue;
    const json = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const flat = getAllKeys(json);
    const missingKeys = Object.keys(flat).filter((k) => !enKeys.has(k));
    if (missingKeys.length) {
      bad += missingKeys.length;
      report.push(
        `${f}: ${missingKeys.length} keys not in en.json (e.g. ${missingKeys.slice(0, 3).join(", ")})`
      );
    }
  }
}

if (bad) {
  console.error(`i18n-gate FAIL: ${bad} issue(s) across ${files.length} locales`);
  report.forEach((r) => console.error("  " + r));
  process.exit(1);
} else {
  console.log(
    `i18n-gate OK: ${files.length} locales, no __MISSING__: markers${strict ? " (strict mode)" : ""}`
  );
}
