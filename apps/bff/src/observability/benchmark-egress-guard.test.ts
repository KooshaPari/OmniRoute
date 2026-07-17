import dns from "node:dns";
import net from "node:net";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REQUIRED_BENCHMARK_GUARDS, installBenchmarkEgressGuard } from "./benchmark-egress-guard";

describe("benchmark egress guard", () => {
  it("installs and activates every required API before restoring them", () => {
    const priorBun = (globalThis as any).Bun;
    const fakeBun = { connect: () => { throw new Error("native must not run"); } };
    (globalThis as any).Bun = fakeBun;
    const originals = {
      fetch: globalThis.fetch, bun: fakeBun.connect, connect: net.connect,
      createConnection: net.createConnection, lookup: dns.lookup, resolve: dns.resolve,
    };
    const guard = installBenchmarkEgressGuard();
    try {
      expect(guard.installedCoverage()).toEqual(REQUIRED_BENCHMARK_GUARDS);
      expect(guard.activationResults()).toEqual(REQUIRED_BENCHMARK_GUARDS.map((api) => ({ api, blocked: true })));
      const probes = [
        () => fetch("https://example.invalid"),
        () => fakeBun.connect(),
        () => net.connect({ host: "example.invalid", port: 443 }),
        () => net.createConnection({ host: "example.invalid", port: 443 }),
        () => dns.lookup("example.invalid", () => {}),
        () => dns.resolve("example.invalid", () => {}),
      ];
      for (const probe of probes) expect(probe).toThrow(/blocked/);
      expect(guard.blockedAttemptCount()).toBe(REQUIRED_BENCHMARK_GUARDS.length);
    } finally {
      guard.restore();
      (globalThis as any).Bun = priorBun;
    }
    expect(globalThis.fetch).toBe(originals.fetch);
    expect(fakeBun.connect).toBe(originals.bun);
    expect(net.connect).toBe(originals.connect);
    expect(net.createConnection).toBe(originals.createConnection);
    expect(dns.lookup).toBe(originals.lookup);
    expect(dns.resolve).toBe(originals.resolve);
  });

  it("fails closed when a required API is absent", () => {
    const priorBun = (globalThis as any).Bun;
    delete (globalThis as any).Bun;
    try { expect(() => installBenchmarkEgressGuard()).toThrow(/Bun\.connect/); }
    finally { (globalThis as any).Bun = priorBun; }
  });

  it("installs the complete guard before importing the built handler", () => {
    const source = readFileSync(new URL("../../scripts/benchmark-latency.ts", import.meta.url), "utf8");
    expect(source.indexOf("installBenchmarkEgressGuard()"))
      .toBeLessThan(source.indexOf('import("../dist/index.js")'));
  });
});
