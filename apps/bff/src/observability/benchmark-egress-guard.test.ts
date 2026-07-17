import dns from "node:dns";
import net from "node:net";
import { describe, expect, it } from "vitest";
import { installBenchmarkEgressGuard } from "./benchmark-egress-guard";

describe("benchmark egress guard", () => {
  it("blocks direct socket and DNS egress and restores functions", () => {
    const originalConnect = net.connect;
    const originalLookup = dns.lookup;
    const guard = installBenchmarkEgressGuard();
    try {
      expect(() => net.connect({ host: "example.com", port: 443 })).toThrow(/blocked/);
      expect(() => dns.lookup("example.com", () => {})).toThrow(/blocked/);
      expect(guard.blockedAttemptCount()).toBe(2);
    } finally {
      guard.restore();
    }
    expect(net.connect).toBe(originalConnect);
    expect(dns.lookup).toBe(originalLookup);
  });
});
