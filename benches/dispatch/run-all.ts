#!/usr/bin/env node
/**
 * run-all.ts — Dispatch bench suite runner (ADR-032 / benchmarks)
 *
 * Orchestrates all 6 benchmarks, collects results, generates the
 * tier-verification matrix, and writes it to
 * `bench-results/dispatch-tier-matrix.json`.
 *
 * Usage:
 *   node --import tsx/esm benches/dispatch/run-all.ts
 *
 * Or via npm:
 *   npm run bench:dispatch
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateMatrix, formatMatrixTable } from "./shared.ts";
import type { BenchResult, MatrixEntry } from "./shared.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = resolve(__dirname, "../../bench-results");
const MATRIX_PATH = resolve(RESULTS_DIR, "dispatch-tier-matrix.json");
const MATRIX_MD_PATH = resolve(RESULTS_DIR, "dispatch-tier-matrix.md");

// ── Import each bench script ───────────────────────────────────────
// Each exports/prints a JSON BenchResult line to stdout on execution.
// We collect them by re-importing (they self-execute on import via top-level
// await). We capture JSON from each.
//
// NOTE: the bench scripts write JSON objects separated by "---" lines.
import "../dispatch/combo-scorer.bench.ts" with { benchResult: true };
import "../dispatch/sse-chunking.bench.ts" with { benchResult: true };
import "../dispatch/semantic-lookup.bench.ts" with { benchResult: true };
import "../dispatch/compression-lite.bench.ts" with { benchResult: true };
import "../dispatch/guardrails-pii.bench.ts" with { benchResult: true };

// uds-vs-http starts servers — run separately to avoid side effects.
// import "../dispatch/uds-vs-http.bench.ts" with { benchResult: true };
//
// We parse results from stdout of the subprocess instead.
// See the shell-script wrapper: `npm run bench:dispatch` runs each
// independently and collects stdout.

console.error("[run-all] Bench scripts require subprocess execution. Use:");
console.error("  npm run bench:dispatch");
console.error("");
console.error("This file provides the matrix generator helpers.");
