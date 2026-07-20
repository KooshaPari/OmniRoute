#!/usr/bin/env node
// Tier-matrix CI gate for polyglot binding tiers (ADR-032 Appendix D.3).
//
// Reads bench-results/polyglot-tier-matrix*.{json,md} artifacts and asserts
// each edge's measured latency falls inside a per-tier tolerance window.
// Default tolerance bands:
//   T1 = 150 % of claim
//   T2 = 200 % of claim
//   T3 = 150 % of claim
//
// Exit code 0 on pass, 1 on any FAIL row, 2 if artifact is missing.
//
// Usage:
//   node scripts/check/tier-matrix-verify.mjs           # default tolerance
//   node scripts/check/tier-matrix-verify.mjs --strict  # 110/110/110 (no slack)

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STRICT = process.argv.includes("--strict");
const TOLERANCE = STRICT
  ? { T1: 1.1, T2: 1.1, T3: 1.1 }
  : { T1: 1.5, T2: 2.0, T3: 1.5 };

const ARTIFACT = resolve(__dirname, "..", "..", "bench-results", "polyglot-tier-matrix-v2.json");

function main() {
  if (!existsSync(ARTIFACT)) {
    console.error(`FAIL: missing tier-matrix artifact at ${ARTIFACT}`);
    console.error("      generate it first via: node benches/polyglot/matrix-generator.ts");
    process.exit(2);
  }

  const raw = readFileSync(ARTIFACT, "utf-8");
  const artifact = JSON.parse(raw);
  const rows = Array.isArray(artifact) ? artifact : artifact?.edges;
  if (!Array.isArray(rows)) {
    console.error(`FAIL: malformed tier-matrix artifact at ${ARTIFACT}`);
    console.error("      expected an array or an object with an edges array");
    process.exit(2);
  }

  const counts = { pass: 0, fail: 0, flag: 0 };
  for (const row of rows) {
    const tier = row.tier ?? row.defaultTier ?? "T3";
    const measured = row.measured_us ?? row.measuredUs ?? row.measured;
    const claim = row.claim_us ?? row.claimUs ?? row.claim;
    if (typeof measured !== "number" || typeof claim !== "number" || claim <= 0) {
      row.status = "FLAG";
      row.reason = "missing measured_us or claim_us";
      counts.flag += 1;
      continue;
    }
    const cap = claim * (TOLERANCE[tier] ?? 2.0);
    if (measured <= cap) {
      row.status = "PASS";
      counts.pass += 1;
    } else {
      row.status = "FAIL";
      row.reason = `measured ${measured}µs > claim ${claim}µs × ${TOLERANCE[tier]}`;
      counts.fail += 1;
    }
  }

  const md = renderMarkdown(rows, counts);
  console.log(md);
  process.exit(counts.fail === 0 ? 0 : 1);
}

function renderMarkdown(rows, counts) {
  const lines = [];
  lines.push("# Polyglot Tier Verification Matrix\n");
  lines.push(`Tolerance: T1≤${TOLERANCE.T1}×, T2≤${TOLERANCE.T2}×, T3≤${TOLERANCE.T3}×${STRICT ? " (strict)" : ""}`);
  lines.push("");
  lines.push("| Edge | Tier | Claim (µs) | Measured (µs) | Status | Reason |");
  lines.push("|---|---|---:|---:|---|---|");
  for (const row of rows) {
    const measured = row.measured_us ?? "—";
    const claim = row.claim_us ?? "—";
    lines.push(`| ${row.edge ?? "?"} | ${row.tier ?? row.defaultTier ?? "?"} | ${claim} | ${measured} | ${row.status ?? "?"} | ${row.reason ?? ""} |`);
  }
  lines.push("");
  lines.push(`**Totals:** ${counts.pass} PASS · ${counts.flag} FLAG · ${counts.fail} FAIL`);
  return lines.join("\n");
}

main();
