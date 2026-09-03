#!/usr/bin/env node
// bin/i18n-audit.mjs
//
// W2.x / W10.x — i18n audit: find every __MISSING__ sentinel across the
// 42 locale catalogs and classify them by namespace + by whether they
// share a path with en.json. Produces a fix plan for upstream PR #12272.
//
// Usage:
//   node bin/i18n-audit.mjs                  # full audit
//   node bin/i18n-audit.mjs --summary        # one-line summary
//   node bin/i18n-audit.mjs --namespace combo  # filter to one namespace
//   node bin/i18n-audit.mjs --fix  > plan.json  # produce fix plan (JSON)
//
// Exit 0 = no missing keys; 1 = at least one missing key found.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const NS = args.find((a) => a.startsWith("--namespace="))?.split("=")[1];
const FIX = args.includes("--fix");
const SUMMARY = args.includes("--summary");
const LIMIT = 25;

const I18N_DIR = "src/i18n/messages";
const EN_FILE = join(I18N_DIR, "en.json");

function flatten(obj, prefix = "") {
  const out = [];
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object") {
        out.push(...flatten(v, key));
      } else {
        out.push({ key, value: v });
      }
    }
  }
  return out;
}

function get(obj, path) {
  return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}

function set(obj, path, value) {
  const parts = path.split(".");
  let o = obj;
  while (parts.length > 1) {
    const p = parts.shift();
    if (!o[p] || typeof o[p] !== "object") o[p] = {};
    o = o[p];
  }
  o[parts[0]] = value;
}

function loadAll() {
  const files = readdirSync(I18N_DIR).filter((f) => f.endsWith(".json"));
  const en = JSON.parse(readFileSync(EN_FILE, "utf8"));
  const enKeys = new Set(flatten(en).map((e) => e.key));

  const result = [];
  for (const f of files) {
    const locale = f.replace(/\.json$/, "");
    const data = JSON.parse(readFileSync(join(I18N_DIR, f), "utf8"));
    const flat = flatten(data);
    const missing = flat.filter((e) => String(e.value).startsWith("__MISSING__:"));
    result.push({ locale, missing, total: flat.length });
  }
  return { en, enKeys, locales: result, files };
}

// All the real work lives in one scope so hasMissing is in scope at the bottom.
function main() {
  const { en, enKeys, locales } = loadAll();

  // Aggregate missing keys across all locales.
  const tally = new Map();
  for (const { locale, missing } of locales) {
    for (const m of missing) {
      const entry = tally.get(m.key) ?? { key: m.key, byLocale: [], sample: m.value };
      entry.byLocale.push(locale);
      tally.set(m.key, entry);
    }
  }
  const allMissing = [...tally.values()].sort((a, b) => b.byLocale.length - a.byLocale.length);
  globalThis._allMissing = allMissing;

  // Categorize: does the key exist in en.json?
  const trulyMissing = allMissing.filter((e) => !enKeys.has(e.key));
  const translated = allMissing.filter((e) => enKeys.has(e.key));
  const filtered = NS ? allMissing.filter((e) => e.key.startsWith(NS + ".")) : allMissing;

  if (SUMMARY) {
    const total = allMissing.reduce((s, e) => s + e.byLocale.length, 0);
    console.log(`i18n-audit: locales=${locales.length} total-missing-keys=${allMissing.length} (${total} occurrences) truly-missing-from-en=${trulyMissing.length} translated-but-stale=${translated.length}`);
    return;
  }

  console.log(`\n=== i18n Audit Report ===\n`);
  console.log(`Locales scanned: ${locales.length}`);
  console.log(`Distinct missing keys: ${allMissing.length}`);
  console.log(`  - Truly missing from en.json (need to add source): ${trulyMissing.length}`);
  console.log(`  - In en.json but locale has stale __MISSING__ marker: ${translated.length}`);
  console.log("");

  console.log("Per-locale missing-key counts:");
  for (const { locale, missing } of locales.sort((a, b) => b.missing.length - a.missing.length).slice(0, 10)) {
    console.log(`  ${locale.padEnd(8)}  ${missing.length} keys`);
  }
  console.log("");

  if (NS) console.log(`Filtered to namespace '${NS}':\n`);

  console.log(`Top ${LIMIT} most-widespread missing keys (by number of locales affected):\n`);
  console.log("Key".padEnd(50), "Locales".padEnd(8), "Status");
  console.log("-".repeat(80));
  for (const e of filtered.slice(0, LIMIT)) {
    const status = enKeys.has(e.key) ? "TRANSLATED-BUT-STALE" : "TRULY-MISSING-FROM-EN";
    console.log(e.key.padEnd(50), String(e.byLocale.length).padEnd(8), status);
  }

  if (FIX) {
    const plan = {
      generated: new Date().toISOString(),
      totalKeys: allMissing.length,
      trulyMissing: trulyMissing.map((e) => ({
        key: e.key,
        locales: e.byLocale,
        sample: e.sample,
      })),
      translatedButStale: translated.map((e) => ({
        key: e.key,
        locales: e.byLocale,
        enValue: get(en, e.key),
      })),
    };
    const out = "upstream/i18n-fix-plan.json";
    writeFileSync(out, JSON.stringify(plan, null, 2));
    console.log(`\nWrote fix plan → ${out}`);
  }
  if (globalThis._allMissing && globalThis._allMissing.length > 0) process.exit(1);
}

main();
