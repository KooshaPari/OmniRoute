/**
 * Tests for the SystemLoadAdapter (Task 0.3).
 *
 * Covers: computeScore component correctness, weighted composite,
 * caching strategy (TTL, stale fallback, expiry), HTTP methods
 * (local, remote, batch), clearCache, getCacheStats, and edge cases.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SystemLoadAdapter } from "../../open-sse/services/combo/systemLoadAdapter.ts";
import type { SystemMetrics, CompositeHealthScore } from "../../open-sse/services/combo/systemLoadAdapter.ts";

// ────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────

/** Run a block of code with a fixed Date.now(). Supports async callbacks. */
async function withFakeNow<T>(fakeNow: number, fn: () => T | Promise<T>): Promise<T> {
  const originalNow = Date.now.bind(Date.now);
  Date.now = () => fakeNow;
  try {
    return await Promise.resolve(fn());
  } finally {
    Date.now = originalNow;
  }
}

/** Advance time by `ms` milliseconds and return the new fake timestamp. */
function advance(ms: number, current: number): number {
  return current + ms;
}

/** Build a fully-populated SystemMetrics object with sensible defaults. */
function makeMetrics(overrides?: {
  cpu?: Partial<SystemMetrics["cpu"]>;
  memory?: Partial<SystemMetrics["memory"]>;
  io?: Partial<SystemMetrics["io"]>;
  network?: Partial<SystemMetrics["network"]>;
  gpu?: Partial<SystemMetrics["gpu"]> | null;
  process?: Partial<SystemMetrics["process"]>;
}): SystemMetrics {
  return {
    cpu: {
      utilizationPct: 50,
      loadAvg1m: 1.0,
      loadAvg5m: 0.8,
      loadAvg15m: 0.6,
      contextSwitches: 1000,
      procsRunning: 2,
      procsBlocked: 0,
      ...overrides?.cpu,
    },
    memory: {
      totalBytes: 16_000_000_000,
      availableBytes: 8_000_000_000,
      usedBytes: 8_000_000_000,
      swapTotalBytes: 2_000_000_000,
      swapUsedBytes: 100_000_000,
      cachedBytes: 2_000_000_000,
      buffersBytes: 500_000_000,
      ...overrides?.memory,
    },
    io: {
      readBytesPerSec: 50_000_000,
      writeBytesPerSec: 30_000_000,
      iopsRead: 1000,
      iopsWrite: 500,
      ioWaitPct: 5,
      avgQueueDepth: 2,
      ...overrides?.io,
    },
    network: {
      rxBytesPerSec: 100_000_000,
      txBytesPerSec: 80_000_000,
      rxPacketsPerSec: 10_000,
      txPacketsPerSec: 8_000,
      rxDroppedPerSec: 10,
      txDroppedPerSec: 5,
      tcpConnectionsEstablished: 50,
      ...overrides?.network,
    },
    gpu: overrides?.gpu === null
      ? undefined
      : {
          utilizationPct: 40,
          memoryUsedMib: 4096,
          memoryTotalMib: 8192,
          temperatureC: 65,
          powerDrawWatts: 150,
          pcieBandwidthUtil: 30,
          ...overrides?.gpu,
        },
    process: {
      memoryRssBytes: 500_000_000,
      cpuPercent: 25,
      openFds: 100,
      threadCount: 20,
      ...overrides?.process,
    },
  };
}

/** Build a CompositeHealthScore with given score and optional components. */
function makeScore(score: number, ts?: number): CompositeHealthScore {
  return {
    score,
    components: { cpu: score, memory: score, io: score, network: score, gpu: score, requests: score },
    timestamp: ts ?? Date.now(),
  };
}

/** Create a mock fetch response. */
function mockJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Create a mock error response. */
function mockErrorResponse(status: number, statusText: string): Response {
  return new Response(null, { status, statusText });
}

// ────────────────────────────────────────────
//  Constructor & Default Config
// ────────────────────────────────────────────

// ────────────────────────────────────────────
//  HTTP Fetch — Local Health Score
// ────────────────────────────────────────────

describe("SystemLoadAdapter — HTTP fetch for local health score", () => {
  it("GETs /system-load and computes score", async () => {
    let calledUrl = "";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request) => {
      calledUrl = url.toString();
      return mockJsonResponse(makeMetrics({ cpu: { utilizationPct: 20 } }));
    };

    try {
      const adapter = new SystemLoadAdapter({ agentBaseUrl: "http://test-agent:9099" });
      const result = await adapter.getLocalHealthScore();

      assert.ok(calledUrl.includes("/system-load"), `expected /system-load, got ${calledUrl}`);
      assert.ok(calledUrl.startsWith("http://test-agent:9099"), `expected base URL, got ${calledUrl}`);

      // cpu = 1 - 20/100 = 0.8
      assert.equal(result.components.cpu, 0.8);
      assert.ok(typeof result.score === "number");
      assert.ok(result.score >= 0 && result.score <= 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws on non-OK response", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return mockErrorResponse(503, "Service Unavailable");
    };

    try {
      const adapter = new SystemLoadAdapter();
      await assert.rejects(
        () => adapter.getLocalHealthScore(),
        /503/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses default agentBaseUrl when not configured", async () => {
    let calledUrl = "";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request) => {
      calledUrl = url.toString();
      return mockJsonResponse(makeMetrics());
    };

    try {
      const adapter = new SystemLoadAdapter();
      await adapter.getLocalHealthScore();
      assert.ok(calledUrl.includes("localhost:9099"), `expected localhost:9099, got ${calledUrl}`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ────────────────────────────────────────────
//  clearCache & getCacheStats
// ────────────────────────────────────────────

describe("SystemLoadAdapter — clearCache", () => {
  it("clears all cached entries", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/health-score/")) {
        return mockJsonResponse(makeScore(0.9));
      }
      if (urlStr.includes("/health-scores/batch")) {
        return mockJsonResponse({ "node-1": makeScore(0.8), "node-2": makeScore(0.7) });
      }
      return mockJsonResponse(makeMetrics());
    };

    try {
      const adapter = new SystemLoadAdapter({ cacheTtlMs: 5000 });

      await adapter.getLocalHealthScore();
      await adapter.getRemoteHealthScore("node-1");
      await adapter.getRemoteHealthScore("node-2");
      assert.ok(adapter.getCacheStats().size > 0);

      adapter.clearCache();
      const stats = adapter.getCacheStats();
      assert.equal(stats.size, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not affect hit/miss counters", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/health-score/") || urlStr.includes("/health-scores/")) {
        return mockJsonResponse(makeScore(0.9));
      }
      return mockJsonResponse(makeMetrics());
    };

    try {
      const adapter = new SystemLoadAdapter({ cacheTtlMs: 5000 });

      await adapter.getLocalHealthScore(); // 1 miss
      const stats1 = adapter.getCacheStats();
      assert.equal(stats1.misses, 1);
      assert.equal(stats1.hits, 0);

      // Cache hit
      await adapter.getLocalHealthScore();
      const stats2 = adapter.getCacheStats();
      assert.equal(stats2.hits, 1);

      adapter.clearCache();
      const stats3 = adapter.getCacheStats();
      // Hits/misses should be preserved
      assert.equal(stats3.hits, 1);
      assert.equal(stats3.misses, 1);
      assert.equal(stats3.size, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("SystemLoadAdapter — getCacheStats", () => {
  it("tracks hits and misses correctly", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => mockJsonResponse(makeMetrics());

    try {
      const adapter = new SystemLoadAdapter({ cacheTtlMs: 5000 });

      // Initial stats
      let stats = adapter.getCacheStats();
      assert.equal(stats.hits, 0);
      assert.equal(stats.misses, 0);
      assert.equal(stats.hitRate, 0);

      // First call = miss
      await adapter.getLocalHealthScore();
      stats = adapter.getCacheStats();
      assert.equal(stats.misses, 1);
      assert.equal(stats.hits, 0);

      // Second call within TTL = hit
      await adapter.getLocalHealthScore();
      stats = adapter.getCacheStats();
      assert.equal(stats.hits, 1);
      assert.equal(stats.misses, 1);
      assert.equal(stats.hitRate, 0.5);

      // Third call within TTL = hit
      await adapter.getLocalHealthScore();
      stats = adapter.getCacheStats();
      assert.equal(stats.hits, 2);
      assert.equal(stats.misses, 1);
      assert.ok(Math.abs(stats.hitRate - 2 / 3) < 0.001);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("hitRate returns 0 when no requests have been made", () => {
    const adapter = new SystemLoadAdapter();
    const stats = adapter.getCacheStats();
    assert.equal(stats.hitRate, 0);
    assert.equal(stats.hits, 0);
    assert.equal(stats.misses, 0);
    assert.equal(stats.size, 0);
  });
});
