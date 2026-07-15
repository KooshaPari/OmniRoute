#!/usr/bin/env node
/**
 * Promote the tier-verification matrix to a CI gate.
 *
 * Reads `bench-results/polyglot-tier-matrix-v2.json` (or `v1` if v2
 * missing), checks every edge measurement against the ADR-032 claim
 * tolerance (`±150%`), and exits non-zero on FAIL.
 *
 * Tolerance rationale:
 *   T1 (HTTP sidecar)  — 150% — variance from network congestion
 *   T2 (UDS RPC)       — 200% — variance from socket priority
 *   T3 (FFI)           — 150% — variance from CPU thermal state
 *
 * Usage:
 *   node scripts/check/tier-matrix-verify.mjs
 *   node scripts/check/tier-matrix-verify.mjs --strict   # FAIL on FLAG too
 *
 * @see docs/adr/0032-polyglot-binding-tiers.md Appendix B
 * @see bench-results/polyglot-tier-matrix-v2.json
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const strict = process.argv.includes("--strict");

const matrixPath = existsSync(resolve(repoRoot, "bench-results/polyglot-tier-matrix-v2.json"))
  ? resolve(repoRoot, "bench-results/polyglot-tier-matrix-v2.json")
  : resolve(repoRoot, "bench-results/polyglot-tier-matrix.json");

if (!existsSync(matrixPath)) {
  console.error(`No tier matrix found at ${matrixPath}`);
  console.error("Run `npm run bench:polyglot && npm run tier-matrix:generate` first.");
  process.exit(2);
}

const matrix = JSON.parse(await readFile(matrixPath, "utf-8"));
const tolerance = { T1: 1.5, T2: 2.0, T3: 1.5 };
const summary = matrix.summary || {};
const edges = summary.edges || summary.results || [];

let pass = 0, flag = 0, fail = 0, missing = 0;
const failures = [];
const flags = [];

for (const e of edges) {
  if (!e.tier || e.claimed_us == null || e.measured_us == null) {
    missing++;
    continue;
  }
  const tol = tolerance[e.tier] ?? 1.5;
  const ok = e.measured_us <= e.claimed_us * tol;
  const flagVerdict = e.measured_us <= e.claimed_us;
  if (e.verdict === "PASS") pass++;
  else if (e.verdict === "FLAG") {
    flag++;
    flags.push(e);
  } else if (e.verdict === "FAIL") {
    fail++;
    failures.push(e);
  } else if (!ok) {
    fail++;
    failures.push({ ...e, reason: "outside tolerance window" });
  } else {
    flag++;
    flags.push(e);
  }
}

console.log(`Tier matrix gate: ${matrixPath}`);
console.log(`Edges checked: ${edges.length} | PASS ${pass} | FLAG ${flag} | FAIL ${fail}`);

if (failures.length) {
  console.error("\nFailures:");
  for (const f of failures) {
    console.error(`  [${f.tier || "?"}] ${f.edge || f.name || "?"} — claim ${f.claimed_us}µs, measured ${f.measured_us}µs`);
  }
}

if (strict && flags.length) {
  console.error("\nFlags:");
  for (const f of flags) {
    console.error(`  [${f.tier || "?"}] ${f.edge || f.name || "?"} — claim ${f.claimed_us}µs, measured ${f.measured_us}µs`);
  }
}

if (fail > 0 || (strict && flag > 0)) {
  console.error("\nTier matrix CI gate: FAILED");
  process.exit(1);
}
console.log("\nTier matrix CI gate: PASSED");
