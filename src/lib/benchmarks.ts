import { performance } from "node:perf_hooks";

export interface BenchmarkResult {
  name: string;
  durationNs: number;
  opsPerSecond: number;
  memoryBytes: number;
  success: boolean;
}

export interface BenchmarkDefinition {
  name: string;
  fn: () => void | Promise<void>;
  warmupIterations?: number;
  iterations?: number;
}

export interface BenchmarkSuite {
  name: string;
  benchmarks: BenchmarkDefinition[];
}

export async function runBenchmark(definition: BenchmarkDefinition): Promise<BenchmarkResult> {
  const iterations = definition.iterations ?? 10_000;
  const warmupIterations = definition.warmupIterations ?? 100;
  for (let index = 0; index < warmupIterations; index += 1) await definition.fn();

  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) await definition.fn();
  const elapsedMs = performance.now() - start;
  return {
    name: definition.name,
    durationNs: elapsedMs * 1_000_000,
    opsPerSecond: elapsedMs > 0 ? (iterations / elapsedMs) * 1000 : Number.POSITIVE_INFINITY,
    memoryBytes: 0,
    success: true,
  };
}

export async function runBenchmarks(suites: BenchmarkSuite[]): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  for (const suite of suites) {
    for (const benchmark of suite.benchmarks) {
      try {
        results.push(await runBenchmark(benchmark));
      } catch {
        results.push({
          name: benchmark.name,
          durationNs: 0,
          opsPerSecond: 0,
          memoryBytes: 0,
          success: false,
        });
      }
    }
  }
  return results;
}

export async function runLatencyBenchmark(
  operation: () => void | Promise<void>,
  iterations = 1000
): Promise<{ p50: number; p95: number; p99: number; opsPerSecond: number }> {
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new RangeError("iterations must be a positive integer");
  }
  for (let index = 0; index < Math.min(iterations, 100); index += 1) await operation();

  const latencies: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    await operation();
    latencies.push(performance.now() - start);
  }
  latencies.sort((left, right) => left - right);
  const percentile = (ratio: number) =>
    latencies[Math.min(iterations - 1, Math.floor(iterations * ratio))];
  const average = latencies.reduce((sum, latency) => sum + latency, 0) / iterations;
  return {
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    opsPerSecond: average > 0 ? 1000 / average : Number.POSITIVE_INFINITY,
  };
}

function formatOpsPerSecond(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
  return value.toFixed(2);
}

export function formatBenchmarkReport(results: BenchmarkResult[]): string {
  const lines = [
    "| Benchmark | Duration (ms) | Ops/sec | Status |",
    "|-----------|---------------|---------|--------|",
  ];
  for (const result of results) {
    lines.push(
      `| ${result.name} | ${(result.durationNs / 1_000_000).toFixed(4)} | ${formatOpsPerSecond(result.opsPerSecond)} | ${result.success ? "PASS" : "FAIL"} |`
    );
  }
  return lines.join("\n");
}

export function formatLatencyReport(
  name: string,
  result: { p50: number; p95: number; p99: number; opsPerSecond: number }
): string {
  return `${name}:
  p50: ${result.p50.toFixed(3)}ms
  p95: ${result.p95.toFixed(3)}ms
  p99: ${result.p99.toFixed(3)}ms
  ops/s: ${result.opsPerSecond.toFixed(2)}`;
}

export default runBenchmarks;
