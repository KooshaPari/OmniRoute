import {
  BenchmarkReportSchema,
  assertUnique,
  inventorySha256,
  routeKey,
  type BenchmarkReport,
} from "./benchmark-contract";

const ABSOLUTE_TOLERANCE_MS = 0.75;
const RELATIVE_TOLERANCE = 0.35;
const RSS_ABSOLUTE_TOLERANCE = 32 * 1024 * 1024;
const RSS_RELATIVE_TOLERANCE = 0.2;

function nearestRank(sorted: number[], quantile: number): number {
  return sorted[Math.max(0, Math.ceil(quantile * sorted.length) - 1)];
}

function exactKeys(values: string[], label: string): string[] {
  assertUnique(values, label);
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

function requireEqual(left: unknown, right: unknown, label: string): void {
  if (JSON.stringify(left) !== JSON.stringify(right)) throw new Error(`${label} mismatch`);
}

function validateDerived(report: BenchmarkReport): void {
  const inventory = exactKeys(report.routeInventory.routes, "route inventory");
  if (inventory.length !== report.routeInventory.count) throw new Error("route inventory count mismatch");
  if (inventorySha256(inventory) !== report.routeInventory.sha256) throw new Error("route inventory hash mismatch");

  const measured = exactKeys(report.routes.map(routeKey), "measured routes");
  for (const key of measured) if (!inventory.includes(key)) throw new Error(`measured route absent from inventory: ${key}`);
  for (const route of report.routes) {
    if (route.sampleCount !== report.benchmark.sampleCount || route.samples.length !== route.sampleCount) {
      throw new Error(`sample count mismatch for ${routeKey(route)}`);
    }
    const sequences = route.samples.map((sample) => sample.sequence);
    requireEqual(sequences, Array.from({ length: route.sampleCount }, (_, index) => index), `sample sequence ${routeKey(route)}`);
    const durations = route.samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
    const errorCount = route.samples.filter((sample) => sample.status >= 500).length;
    if (route.errorCount !== errorCount || route.errorRate !== errorCount / route.sampleCount) {
      throw new Error(`error summary mismatch for ${routeKey(route)}`);
    }
    if (route.p50Ms !== nearestRank(durations, 0.5) ||
        route.p95Ms !== nearestRank(durations, 0.95) ||
        route.p99Ms !== nearestRank(durations, 0.99)) {
      throw new Error(`percentile summary mismatch for ${routeKey(route)}`);
    }
  }
}

export function compareBenchmarkReports(firstInput: unknown, secondInput: unknown): void {
  const first = BenchmarkReportSchema.parse(firstInput);
  const second = BenchmarkReportSchema.parse(secondInput);
  validateDerived(first);
  validateDerived(second);

  requireEqual(first.sourceCommit, second.sourceCommit, "source commit");
  requireEqual(first.sourceTree, second.sourceTree, "source tree");
  requireEqual(first.benchmark, second.benchmark, "benchmark contract");
  requireEqual(first.environment, second.environment, "environment");
  requireEqual(first.networkPolicy.mode, second.networkPolicy.mode, "network guard mode");
  if (first.networkPolicy.blockedNonLoopbackAttempts !== 0 || second.networkPolicy.blockedNonLoopbackAttempts !== 0) {
    throw new Error("blocked network attempts must be zero");
  }
  requireEqual(first.networkPolicy.allowedLoopbackAttempts, second.networkPolicy.allowedLoopbackAttempts, "loopback attempt count");

  const firstInventory = exactKeys(first.routeInventory.routes, "first inventory");
  const secondInventory = exactKeys(second.routeInventory.routes, "second inventory");
  requireEqual(firstInventory, secondInventory, "route inventory set");
  requireEqual(first.routeInventory.sha256, second.routeInventory.sha256, "route inventory hash");

  const firstKeys = exactKeys(first.routes.map(routeKey), "first measured routes");
  const secondKeys = exactKeys(second.routes.map(routeKey), "second measured routes");
  requireEqual(firstKeys, secondKeys, "measured route set");
  for (const key of firstKeys) {
    const left = first.routes.find((route) => routeKey(route) === key)!;
    const right = second.routes.find((route) => routeKey(route) === key)!;
    requireEqual(left.sampleCount, right.sampleCount, `${key} sample count`);
    requireEqual(left.errorCount, right.errorCount, `${key} error count`);
    requireEqual(left.errorRate, right.errorRate, `${key} error rate`);
    for (const metric of ["p50Ms", "p95Ms", "p99Ms"] as const) {
      const delta = Math.abs(left[metric] - right[metric]);
      const allowed = Math.max(
        ABSOLUTE_TOLERANCE_MS,
        Math.max(left[metric], right[metric]) * RELATIVE_TOLERANCE,
      );
      if (delta > allowed) throw new Error(`${key} ${metric} delta ${delta} exceeds ${allowed}`);
    }
  }

  const rssDelta = Math.abs(first.rssBytes - second.rssBytes);
  const rssAllowed = Math.max(
    RSS_ABSOLUTE_TOLERANCE,
    Math.max(first.rssBytes, second.rssBytes) * RSS_RELATIVE_TOLERANCE,
  );
  if (rssDelta > rssAllowed) throw new Error(`RSS delta ${rssDelta} exceeds ${rssAllowed}`);
}
