#!/usr/bin/env node
/**
 * matrix-generator.ts — Polyglot tier-verification matrix builder
 *
 * Reads bench results from `bench-results/*.json` (each file may contain one
 * or multiple JSON BenchResult blocks, separated by `---` lines), then
 * produces:
 *   1. bench-results/polyglot-tier-matrix.json  — machine-readable
 *   2. bench-results/polyglot-tier-matrix.md    — human-readable table
 *
 * Each verified edge gets a verdict:
 *   PASS  — measured within 2x of the ADR claim
 *   FLAG  — measured between 2-5x of the ADR claim, or no ADR claim matched
 *   FAIL  — measured >5x of the ADR claim
 *
 * ADR-032 latency claims are lower-bound estimates from the design doc.
 * Real measurements come from `benches/polyglot/*.bench.ts`.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import type { BenchResult } from "./shared.ts";

const RESULTS_DIR = resolve(import.meta.dirname, "../../bench-results");
const MATRIX_JSON = resolve(RESULTS_DIR, "polyglot-tier-matrix.json");
const MATRIX_MD = resolve(RESULTS_DIR, "polyglot-tier-matrix.md");

// ── ADR-032 Per-edge latency claims (lower-bound estimates) ─────────
const ADR_CLAIMS: Record<
  string,
  { tier: string; claimMicros: number; opsSec: number; edgeFn?: string; note?: string }
> = {
  // T3 edges — FFI / native ABI
  "scoring.combo.scoreSimd": {
    tier: "T3",
    claimMicros: 5,
    opsSec: 200_000,
    note: "TS calculateScore() baseline; Rust SIMD target ≤2x",
  },
  "sse.chunk.sseStream": {
    tier: "T3",
    claimMicros: 3,
    opsSec: 333_333,
    note: "TS TextEncoder/Decoder baseline; Rust zero-copy target",
  },
  "cache.semantic.lookup": {
    tier: "T3",
    claimMicros: 8,
    opsSec: 125_000,
    note: "TS Array.some() baseline; Rust simhash target",
  },
  "cache.signature.lookup": {
    tier: "T3",
    claimMicros: 10,
    opsSec: 100_000,
    note: "TS Map scan baseline; Rust dashmap target",
  },
  // T2 edges — UDS RPC
  "compression.lite.collapseWhitespace": {
    tier: "T2",
    claimMicros: 50,
    opsSec: 20_000,
    note: "Per-call latency with UDS RPC round-trip",
  },
  "compression.lite.compressToolResults": {
    tier: "T2",
    claimMicros: 50,
    opsSec: 20_000,
    note: "Per-call latency with UDS RPC round-trip",
  },
  "compression.lite.dedupSystemPrompt": {
    tier: "T2",
    claimMicros: 50,
    opsSec: 20_000,
    note: "Per-call latency with UDS RPC round-trip",
  },
  "compression.lite.removeRedundantContent": {
    tier: "T2",
    claimMicros: 50,
    opsSec: 20_000,
    note: "Per-call latency with UDS RPC round-trip",
  },
  "guardrails.pii.anonymize": {
    tier: "T2",
    claimMicros: 50,
    opsSec: 20_000,
    note: "Per-call latency with UDS RPC round-trip",
  },
  // T1 transports (baseline measurements only)
  "runtime.transport.http-loopback": {
    tier: "T1",
    claimMicros: 1500,
    opsSec: 666,
    note: "Baseline HTTP loopback; expected 5-40x slower than T2 UDS",
  },
  "runtime.transport.uds-jsonrpc": {
    tier: "T2",
    claimMicros: 100,
    opsSec: 10_000,
    note: "JSON-RPC 2.0 over Unix socket",
  },
};

// ── Multi-object loader ────────────────────────────────────────────
function loadBenchResults(): { result: BenchResult; source: string }[] {
  const files = readdirSync(RESULTS_DIR).filter(
    (f) => f.endsWith(".json") && !f.startsWith("polyglot-tier-matrix")
  );
  const results: { result: BenchResult; source: string }[] = [];
  for (const file of files) {
    const raw = readFileSync(resolve(RESULTS_DIR, file), "utf-8");
    // Split on "---" separator (some benches emit multiple blocks).
    const blocks = raw.split(/^---$/m);
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed.startsWith("{")) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.name && parsed.tier && parsed.edge) {
          results.push({ result: parsed as BenchResult, source: file });
        }
      } catch {
        // skip malformed
      }
    }
  }
  return results;
}

type Verdict = "PASS" | "FLAG" | "FAIL";

function verify(
  claim: { claimMicros: number; opsSec: number },
  measuredMicros: number,
  measuredOpsSec: number
): Verdict {
  // Allow generous PASS (within 2x claim) for measured-µs and at least 50% of
  // claimed throughput.
  const microsRatio = measuredMicros / claim.claimMicros;
  const opsRatio = measuredOpsSec / claim.opsSec;
  if (microsRatio <= 2.0 && opsRatio >= 0.5) return "PASS";
  if (microsRatio <= 5.0 && opsRatio >= 0.2) return "FLAG";
  return "FAIL";
}

interface MatrixEntry {
  edge: string;
  benchName: string;
  tier: string;
  claimMicros: number;
  measuredMicros: number;
  claimOpsSec: number;
  measuredOpsSec: number;
  verdict: Verdict;
  note?: string;
  source: string;
}

async function main() {
  const entries = loadBenchResults();
  const matrix: MatrixEntry[] = entries.map(({ result, source }) => {
    const claim = ADR_CLAIMS[result.edge];
    const measuredMicros = Math.round(result.meanMicros);
    const measuredOpsSec =
      result.totalMs > 0 ? Math.round((result.iterations / (result.totalMs / 1000))) : 0;
    const verdict = claim
      ? verify(claim, measuredMicros, measuredOpsSec)
      : "FLAG";
    return {
      edge: result.edge,
      benchName: result.name,
      tier: claim?.tier ?? result.tier,
      claimMicros: claim?.claimMicros ?? 0,
      measuredMicros,
      claimOpsSec: claim?.opsSec ?? 0,
      measuredOpsSec,
      verdict,
      note: claim?.note,
      source,
    };
  });

  writeFileSync(MATRIX_JSON, JSON.stringify(matrix, null, 2) + "\n");

  // ── Human-readable table ───────────────────────────────────────
  const lines: string[] = [
    "# Polyglot Tier-Verification Matrix",
    "",
    `Auto-generated by \`benches/polyglot/matrix-generator.ts\` on ${new Date().toISOString()}`,
    "",
    `**Verdict legend**: PASS = within 2× ADR-032 claim | FLAG = 2-5× or no ADR match | FAIL = >5×`,
    "",
    "| Edge | Tier | Bench | Claim (µs) | Measured (µs) | Claim (ops/s) | Measured (ops/s) | Verdict |",
    "|------|------|-------|------------|---------------|---------------|------------------|---------|",
  ];
  for (const e of matrix) {
    const vMark =
      e.verdict === "PASS" ? "✓ PASS" : e.verdict === "FLAG" ? "! FLAG" : "✗ FAIL";
    const cl = e.claimMicros > 0 ? String(e.claimMicros) : "—";
    const ml = String(e.measuredMicros);
    const co = e.claimOpsSec > 0 ? e.claimOpsSec.toLocaleString() : "—";
    const mo = e.measuredOpsSec.toLocaleString();
    lines.push(
      `| \`${e.edge}\` | ${e.tier} | _${e.benchName}_ | ${cl} | ${ml} | ${co} | ${mo} | **${vMark}** |`
    );
  }
  const pass = matrix.filter((m) => m.verdict === "PASS").length;
  const flag = matrix.filter((m) => m.verdict === "FLAG").length;
  const fail = matrix.filter((m) => m.verdict === "FAIL").length;
  lines.push("");
  lines.push(`**Summary**: ${matrix.length} edges measured — ${pass} PASS, ${flag} FLAG, ${fail} FAIL`);
  lines.push("");

  // Add notes for each flagged/failed edge so reviewers know what to update.
  if (flag + fail > 0) {
    lines.push("## Review required", "");
    lines.push(
      "Edges below 2× off the ADR claim need an ADR-032 update or implementation tuning:"
    );
    lines.push("");
    for (const e of matrix) {
      if (e.verdict === "PASS") continue;
      lines.push(
        `- **${e.edge}** (${e.tier}, ${e.verdict}): measured ${e.measuredMicros}µs vs claim ${e.claimMicros}µs`
      );
      if (e.note) lines.push(`  - _${e.note}_`);
    }
    lines.push("");
  }

  writeFileSync(MATRIX_MD, lines.join("\n"));

  console.log(`**${matrix.length} edges measured — ${pass} PASS, ${flag} FLAG, ${fail} FAIL**`);
  console.log(`Wrote ${MATRIX_JSON} and ${MATRIX_MD}`);
}

main().catch((err) => {
  console.error("matrix-generator failed:", err);
  process.exit(1);
});
