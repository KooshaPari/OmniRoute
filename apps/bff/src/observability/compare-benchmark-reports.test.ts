import { describe, expect, it } from "vitest";

import { inventorySha256 } from "./benchmark-contract";
import { compareBenchmarkReports } from "./compare-benchmark-reports";

const routes = ["GET /healthz", "GET /api/dashboard/health"]
  .sort((left, right) => left.localeCompare(right, "en"));
const result = (route: string, offset = 0) => {
  const samples = Array.from({ length: 50 }, (_, sequence) => ({
    sequence, durationMs: 2 + (sequence % 5) * 0.1 + offset, status: 200,
  }));
  const sorted = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
  return {
    schemaVersion: 1, method: "GET", route, sampleCount: 50,
    errorCount: 0, errorRate: 0,
    p50Ms: sorted[24], p95Ms: sorted[47], p99Ms: sorted[49], samples,
  };
};
const report = () => ({
  schemaVersion: 2,
  sourceCommit: "a".repeat(40), sourceTree: "b".repeat(40),
  benchmark: {
    transport: "bun-loopback-tcp-built-bff", hostname: "127.0.0.1",
    warmupCount: 30, sampleCount: 50, percentileMethod: "nearest-rank",
    errorDefinition: "HTTP status >= 500", clock: "Bun.nanoseconds",
  },
  networkPolicy: {
    mode: "deny-non-loopback-network",
    guardCoverage: ["global.fetch", "Bun.connect", "node:net.connect", "node:net.createConnection", "node:dns.lookup", "node:dns.resolve"],
    guardActivations: ["global.fetch", "Bun.connect", "node:net.connect", "node:net.createConnection", "node:dns.lookup", "node:dns.resolve"].map((api) => ({ api, blocked: true })),
    allowedLoopbackAttempts: 160,
    blockedNonLoopbackAttempts: 0,
  },
  environment: { runtime: "bun 1.3.14", runnerImage: "test", platform: "linux", architecture: "x64", cpuCount: 4 },
  rssBytes: 100_000_000,
  routeInventory: { count: routes.length, routes, sha256: inventorySha256(routes) },
  routes: [result("/healthz"), result("/api/dashboard/health")],
});

describe("strict benchmark comparison", () => {
  it("accepts order-independent exact route sets", () => {
    const second = report(); second.routes = [...second.routes]; second.routes.reverse();
    expect(() => compareBenchmarkReports(report(), second)).not.toThrow();
  });

  it.each([
    ["extra route", (value: any) => value.routes.push(result("/extra"))],
    ["duplicate route", (value: any) => value.routes.push(value.routes[0])],
    ["inventory drift", (value: any) => value.routeInventory.sha256 = "c".repeat(64)],
    ["invalid rate", (value: any) => value.routes[0].errorRate = 2],
    ["forged percentile", (value: any) => value.routes[0].p95Ms += 1],
    ["missing raw sample", (value: any) => value.routes[0].samples.pop()],
    ["duplicate sequence", (value: any) => value.routes[0].samples[1].sequence = 0],
    ["environment drift", (value: any) => value.environment.cpuCount = 8],
    ["transport drift", (value: any) => value.benchmark.transport = "fake"],
    ["network attempt", (value: any) => value.networkPolicy.blockedNonLoopbackAttempts = 1],
    ["large latency drift", (value: any) => value.routes[0] = result("/healthz", 2)],
    ["large RSS drift", (value: any) => value.rssBytes = 200_000_000],
    ["unknown field", (value: any) => value.fabricated = true],
  ])("rejects %s", (_name, mutate) => {
    const second = report(); mutate(second);
    expect(() => compareBenchmarkReports(report(), second)).toThrow();
  });
});
