/**
 * Shared benchmarking utilities for polyglot tier benchmarks (ADR-032).
 *
 * Each benchmark produces a JSON line: `{"bench":"<name>", ...stats...}`
 * The runner (`run-all.ts`) collects these and writes `bench-results/polyglot-tier-matrix.json`.
 *
 * Design:
 *   - No external dependencies (uses `performance.now()` + `node:test`).
 *   - Each benchmark declares its inputs up front so the matrix generator
 *     can classify them without re-running.
 *   - Warmup phase (3 iterations) avoids JIT cold-start skew.
 *   - Measurement phase runs N iterations and records min/max/mean/p50/p95/p99.
 */

export interface BenchResult {
  name: string;
  tier: "T1" | "T2" | "T3";
  edge: string;
  description: string;
  iterations: number;
  totalMs: number;
  meanMicros: number;
  minMicros: number;
  maxMicros: number;
  p50Micros: number;
  p95Micros: number;
  p99Micros: number;
  result: unknown;
}

export interface BenchInput {
  name: string;
  tier: "T1" | "T2" | "T3";
  edge: string;
  description: string;
  iterations: number;
  run: () => unknown | Promise<unknown>;
}

export async function bench(input: BenchInput): Promise<BenchResult> {
  const { name, tier, edge, description, iterations, run } = input;

  // Warmup (3 iterations) — JIT compiler warmup.
  for (let w = 0; w < 3; w++) {
    await run();
  }

  // Measurement phase.
  const samples: number[] = [];
  const start = performance.now();
  let lastResult: unknown;

  for (let i = 0; i < iterations; i++) {
    const s = performance.now();
    lastResult = await run();
    const elapsed = performance.now() - s;
    samples.push(elapsed * 1000); // convert to micros
  }

  const totalMs = performance.now() - start;
  samples.sort((a, b) => a - b);

  const meanMicros = samples.reduce((a, b) => a + b, 0) / samples.length;
  const minMicros = samples[0];
  const maxMicros = samples[samples.length - 1];
  const p50Micros = percentile(samples, 0.5);
  const p95Micros = percentile(samples, 0.95);
  const p99Micros = percentile(samples, 0.99);

  return {
    name,
    tier,
    edge,
    description,
    iterations,
    totalMs,
    meanMicros,
    minMicros,
    maxMicros,
    p50Micros,
    p95Micros,
    p99Micros,
    result: lastResult,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export interface MatrixEntry {
  edge: string;
  name: string;
  tier: string;
  meanMicros: number;
  p50Micros: number;
  p95Micros: number;
  verification: "PASS" | "FAIL" | "INFO";
  threshold: string;
}

/**
 * Generate the tier-verification matrix from bench results.
 * Compares each result against the ADR-032 claimed overheads.
 */
export function generateMatrix(results: BenchResult[]): MatrixEntry[] {
  return results.map((r) => {
    let verification: "PASS" | "FAIL" | "INFO" = "INFO";
    let threshold = "";

    if (r.tier === "T1") {
      threshold = "mean < 2000 micros (HTTP loopback)";
      verification = r.meanMicros < 2000 ? "PASS" : "FAIL";
    } else if (r.tier === "T2") {
      threshold = "p50 < 200 micros (UDS RPC claim)";
      verification = r.p50Micros < 200 ? "PASS" : "FAIL";
    } else if (r.tier === "T3") {
      threshold = "mean < 10 micros (FFI claim)";
      verification = r.meanMicros < 10 ? "PASS" : "FAIL";
    }

    return {
      edge: r.edge,
      name: r.name,
      tier: r.tier,
      meanMicros: r.meanMicros,
      p50Micros: r.p50Micros,
      p95Micros: r.p95Micros,
      verification,
      threshold,
    };
  });
}

/**
 * Format the matrix as a markdown table.
 */
export function formatMatrixTable(entries: MatrixEntry[]): string {
  const rows = entries.map(
    (e) =>
      `| ${e.edge} | ${e.name} | ${e.tier} | ${e.meanMicros.toFixed(1)} | ${e.p50Micros.toFixed(1)} | ${e.p95Micros.toFixed(1)} | ${e.verification} | ${e.threshold} |`
  );
  return [
    "| Edge | Benchmark | Tier | Mean (micros) | p50 (micros) | p95 (micros) | Verification | Threshold |",
    "|---|---|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}
