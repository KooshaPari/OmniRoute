/**
 * Performance benchmarks for OmniRoute provider routing hot paths.
 *
 * Measures:
 *   1. Provider registry lookup throughput (getRegistryEntry, resolveProviderId)
 *   2. Payload transformation throughput (tool call helpers, schema coercion)
 *   3. Concurrent request handling patterns
 *   4. Memory usage under sustained load
 *   5. Error classification performance (circuit breaker fast-paths)
 *
 * Uses manual timing with performance.now() for portability.
 * Thresholds account for CI variability (2x headroom over target).
 *
 * Run:
 *   npx vitest run tests/performance/provider-routing-benchmark.test.ts --reporter=verbose
 */
import { describe, it, expect, beforeAll } from "vitest";

// ── Imports ──────────────────────────────────────────────────────────────────
// Lightweight pure functions from the translator helpers (no DB/network)
import {
  ensureToolCallIds,
  fixMissingToolResponses,
  stripOrphanedToolResults,
  fallbackToolCallId,
  generateToolCallId,
} from "@omniroute/open-sse/translator/helpers/toolCallHelper";

// Circuit breaker fast-path classifier (pure regex-based)
import { isLocalStreamLifecycleError } from "@/shared/utils/circuitBreaker";

// Provider registry lookups
import {
  getRegistryEntry,
  getRegisteredProviders,
} from "@omniroute/open-sse/config/providerRegistry";
import { resolveProviderId } from "@/shared/constants/providers";

// ── Helpers ──────────────────────────────────────────────────────────────────

interface BenchResult {
  iterations: number;
  totalMs: number;
  avgMs: number;
  medianMs: number;
  p99Ms: number;
  opsPerSec: number;
}

function computeStats(times: number[]): BenchResult {
  const sorted = [...times].sort((a, b) => a - b);
  const total = sorted.reduce((s, t) => s + t, 0);
  const avg = total / sorted.length;
  const median = sorted[Math.floor(sorted.length * 0.5)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return {
    iterations: sorted.length,
    totalMs: round(total),
    avgMs: round(avg),
    medianMs: round(median),
    p99Ms: round(p99),
    opsPerSec: round(1000 / avg),
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function logResult(label: string, result: BenchResult) {
  console.log(
    `  ${label}: avg=${result.avgMs}ms median=${result.medianMs}ms ` +
      `p99=${result.p99Ms}ms ops/s=${result.opsPerSec} ` +
      `(${result.iterations} iterations in ${result.totalMs}ms)`
  );
}

/**
 * Run a synchronous benchmark with warmup.
 */
function benchSync(
  fn: () => void,
  opts: { warmup?: number; iterations?: number } = {}
): BenchResult {
  const warmup = opts.warmup ?? 500;
  const iterations = opts.iterations ?? 5_000;
  for (let i = 0; i < warmup; i++) fn();
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  return computeStats(times);
}

/**
 * Run an async benchmark with warmup.
 */
async function benchAsync(
  fn: () => Promise<void>,
  opts: { warmup?: number; iterations?: number } = {}
): Promise<BenchResult> {
  const warmup = opts.warmup ?? 200;
  const iterations = opts.iterations ?? 2_000;
  for (let i = 0; i < warmup; i++) await fn();
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  return computeStats(times);
}

// ── Test data factories ──────────────────────────────────────────────────────

function makeToolCallMessages(count: number) {
  const messages: unknown[] = [];
  for (let i = 0; i < count; i++) {
    messages.push({
      role: "assistant",
      tool_calls: [
        {
          id: `call_existing_${i}`,
          type: "function",
          function: { name: `tool_${i}`, arguments: '{"x":1}' },
        },
      ],
    });
    messages.push({
      role: "tool",
      tool_call_id: `call_existing_${i}`,
      content: `result ${i}`,
    });
  }
  return { messages };
}

function makeToolCallMessagesWithoutIds(count: number) {
  const messages: unknown[] = [];
  for (let i = 0; i < count; i++) {
    messages.push({
      role: "assistant",
      tool_calls: [
        {
          type: "function",
          function: { name: `tool_${i}`, arguments: '{"x":1}' },
        },
      ],
    });
    messages.push({
      role: "tool",
      tool_call_id: `call_0_${i}`,
      content: `result ${i}`,
    });
  }
  return { messages };
}

function makeOrphanedToolMessages() {
  return {
    messages: [
      {
        role: "assistant",
        tool_calls: [{ id: "call_a", type: "function", function: { name: "t1", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "call_a", content: "ok" },
      { role: "tool", tool_call_id: "call_ORPHAN_999", content: "dangling" },
      {
        role: "assistant",
        tool_calls: [{ id: "call_b", type: "function", function: { name: "t2", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "call_b", content: "ok2" },
    ],
  };
}

function makeLargeConversation(msgCount: number) {
  const messages: unknown[] = [{ role: "system", content: "You are a helpful assistant." }];
  for (let i = 0; i < msgCount; i++) {
    messages.push({ role: "user", content: `User message ${i} with some text content for size.` });
    messages.push({
      role: "assistant",
      content: `Assistant reply ${i} with detailed response text to simulate realistic payload size.`,
    });
  }
  return { messages, model: "gpt-4" };
}

// ── Benchmark tests ──────────────────────────────────────────────────────────

describe("Provider Routing Performance Benchmarks", () => {
  // Collect all provider IDs once for reuse
  let providerIds: string[];

  beforeAll(() => {
    providerIds = getRegisteredProviders();
    console.log(`\n  Loaded ${providerIds.length} registered providers`);
  });

  // ── 1. Provider Registry Lookup ──────────────────────────────────────────

  describe("1. Provider Registry Lookups", () => {
    it("getRegistryEntry: lookup throughput for known providers", () => {
      const knownProviders = [
        "openai",
        "anthropic",
        "google",
        "groq",
        "together",
        "fireworks",
        "mistral",
      ];
      const existing = knownProviders.filter((p) => getRegistryEntry(p) !== null);

      if (existing.length === 0) {
        console.log("  SKIP: no known providers found in registry");
        return;
      }

      let idx = 0;
      const result = benchSync(() => {
        getRegistryEntry(existing[idx % existing.length]);
        idx++;
      });

      logResult("getRegistryEntry (known)", result);
      expect(result.avgMs).toBeLessThan(1); // < 1ms average per lookup
      expect(result.opsPerSec).toBeGreaterThan(1000);
    });

    it("getRegistryEntry: miss-path throughput for unknown providers", () => {
      const unknowns = ["nonexistent_aaa", "nonexistent_bbb", "nonexistent_ccc"];
      let idx = 0;
      const result = benchSync(() => {
        getRegistryEntry(unknowns[idx % unknowns.length]);
        idx++;
      });

      logResult("getRegistryEntry (miss)", result);
      expect(result.avgMs).toBeLessThan(0.5);
    });

    it("resolveProviderId: alias resolution throughput", () => {
      // Test with real provider IDs to measure resolution cost
      const targets = ["openai", "anthropic", "gpt-4", "claude-3-5-sonnet"];
      let idx = 0;
      const result = benchSync(() => {
        resolveProviderId(targets[idx % targets.length]);
        idx++;
      });

      logResult("resolveProviderId", result);
      expect(result.avgMs).toBeLessThan(1);
    });
  });

  // ── 2. Payload Transformation ────────────────────────────────────────────

  describe("2. Payload Transformation Throughput", () => {
    it("ensureToolCallIds: adds IDs to tool calls (small payload)", () => {
      const body = makeToolCallMessagesWithoutIds(3);
      const result = benchSync(() => {
        ensureToolCallIds(body);
      });

      logResult("ensureToolCallIds (3 msgs)", result);
      expect(result.avgMs).toBeLessThan(5); // threshold: 5ms per transform
    });

    it("ensureToolCallIds: handles large payloads (20 tool calls)", () => {
      const body = makeToolCallMessagesWithoutIds(20);
      const result = benchSync(() => {
        ensureToolCallIds(body);
      });

      logResult("ensureToolCallIds (20 msgs)", result);
      expect(result.avgMs).toBeLessThan(10);
    });

    it("fixMissingToolResponses: validates tool call/response pairs", () => {
      const body = makeToolCallMessages(5);
      const result = benchSync(() => {
        fixMissingToolResponses(body);
      });

      logResult("fixMissingToolResponses (5 pairs)", result);
      expect(result.avgMs).toBeLessThan(5);
    });

    it("fixMissingToolResponses: large payload (30 pairs)", () => {
      const body = makeToolCallMessages(30);
      const result = benchSync(() => {
        fixMissingToolResponses(body);
      });

      logResult("fixMissingToolResponses (30 pairs)", result);
      expect(result.avgMs).toBeLessThan(10);
    });

    it("stripOrphanedToolResults: filters dangling tool results", () => {
      const body = makeOrphanedToolMessages();
      const result = benchSync(() => {
        stripOrphanedToolResults(body);
      });

      logResult("stripOrphanedToolResults", result);
      expect(result.avgMs).toBeLessThan(5);
    });

    it("fallbackToolCallId: ID generation throughput", () => {
      let idx = 0;
      const result = benchSync(() => {
        fallbackToolCallId(idx++);
      });

      logResult("fallbackToolCallId", result);
      expect(result.opsPerSec).toBeGreaterThan(10_000);
    });

    it("generateToolCallId: unique ID generation throughput", () => {
      const result = benchSync(() => {
        generateToolCallId();
      });

      logResult("generateToolCallId", result);
      expect(result.opsPerSec).toBeGreaterThan(10_000);
    });
  });

  // ── 3. Concurrent Request Handling ───────────────────────────────────────

  describe("3. Concurrent Request Patterns", () => {
    it("parallel payload transforms: 100 concurrent requests simulated", async () => {
      const concurrency = 100;
      const bodyFactory = () => makeToolCallMessagesWithoutIds(3);

      const result = await benchAsync(
        async () => {
          const promises = Array.from(
            { length: concurrency },
            () =>
              new Promise<void>((resolve) => {
                const body = bodyFactory();
                ensureToolCallIds(body);
                fixMissingToolResponses(body);
                resolve();
              })
          );
          await Promise.all(promises);
        },
        { warmup: 100, iterations: 500 }
      );

      logResult(`parallel transforms (x${concurrency})`, result);
      // 100 concurrent transforms should complete in < 50ms on average
      expect(result.avgMs).toBeLessThan(50);
    });

    it("sequential pipeline: translate -> validate -> sanitize", () => {
      const result = benchSync(() => {
        const body = makeToolCallMessagesWithoutIds(5);
        // Pipeline: ensure IDs -> fix missing -> strip orphans
        ensureToolCallIds(body);
        fixMissingToolResponses(body);
        stripOrphanedToolResults(body);
      });

      logResult("full pipeline (5 msgs)", result);
      expect(result.avgMs).toBeLessThan(5);
    });

    it("high-concurrency burst: 500 rapid-fire operations", async () => {
      const burst = 500;
      const t0 = performance.now();
      const promises = Array.from(
        { length: burst },
        () =>
          new Promise<void>((resolve) => {
            const body = makeToolCallMessagesWithoutIds(2);
            ensureToolCallIds(body);
            resolve();
          })
      );
      await Promise.all(promises);
      const totalMs = performance.now() - t0;

      console.log(
        `  Burst ${burst} ops: ${round(totalMs)}ms total, ${round(totalMs / burst)}ms avg per op`
      );
      expect(totalMs).toBeLessThan(2000); // 500 ops should complete in < 2s total
    });
  });

  // ── 4. Memory Usage Under Load ───────────────────────────────────────────

  describe("4. Memory Usage Under Load", () => {
    it("sustained transformation load: no excessive memory growth", () => {
      // Force GC if available
      if (globalThis.gc) globalThis.gc();

      const heapBefore = process.memoryUsage().heapUsed;
      const iterations = 10_000;

      for (let i = 0; i < iterations; i++) {
        const body = makeToolCallMessagesWithoutIds(3);
        ensureToolCallIds(body);
        fixMissingToolResponses(body);
        stripOrphanedToolResults(body);
      }

      // Force GC if available to get accurate reading
      if (globalThis.gc) globalThis.gc();
      const heapAfter = process.memoryUsage().heapUsed;
      const growthBytes = heapAfter - heapBefore;
      const growthMB = round(growthBytes / (1024 * 1024));

      console.log(
        `  After ${iterations} full-pipeline iterations: heap growth = ${growthMB}MB ` +
          `(${round(heapBefore / 1024 / 1024)}MB -> ${round(heapAfter / 1024 / 1024)}MB)`
      );
      // 10k iterations of small payloads should not leak more than 20MB
      expect(growthBytes).toBeLessThan(20 * 1024 * 1024);
    });

    it("large payload memory: 100-message conversation transforms", () => {
      if (globalThis.gc) globalThis.gc();
      const heapBefore = process.memoryUsage().heapUsed;

      for (let i = 0; i < 100; i++) {
        const body = makeLargeConversation(50);
        ensureToolCallIds(body);
        fixMissingToolResponses(body);
      }

      if (globalThis.gc) globalThis.gc();
      const heapAfter = process.memoryUsage().heapUsed;
      const growthMB = round((heapAfter - heapBefore) / (1024 * 1024));

      console.log(`  100 large-conversation transforms: heap growth = ${growthMB}MB`);
      expect(heapAfter - heapBefore).toBeLessThan(50 * 1024 * 1024);
    });
  });

  // ── 5. Error Classification (Circuit Breaker Fast-Path) ──────────────────

  describe("5. Error Classification Performance", () => {
    it("isLocalStreamLifecycleError: classification throughput", () => {
      const errors = [
        new Error("Invalid state: Controller is already closed"),
        new Error("Client disconnected"),
        new Error("request_signal_aborted"),
        new Error("operation was aborted"),
        new Error("Something went wrong"),
        Object.assign(new Error("abort"), { name: "AbortError" }),
        null,
        undefined,
        "plain string error",
      ];

      let idx = 0;
      const result = benchSync(() => {
        isLocalStreamLifecycleError(errors[idx % errors.length]);
        idx++;
      });

      logResult("isLocalStreamLifecycleError", result);
      expect(result.opsPerSec).toBeGreaterThan(10_000);
    });

    it("isLocalStreamLifecycleError: regex hot-path throughput", () => {
      // Test with the most expensive case: a message that requires regex matching
      const err = new Error("Invalid state: Controller is already closed");
      const result = benchSync(() => {
        isLocalStreamLifecycleError(err);
      });

      logResult("regex classification (single pattern)", result);
      expect(result.opsPerSec).toBeGreaterThan(50_000);
    });
  });

  // ── 6. Provider Catalog Scalability ──────────────────────────────────────

  describe("6. Provider Catalog Scalability", () => {
    it("full registry enumeration: iterate all providers", { timeout: 30000 }, () => {
      const result = benchSync(() => {
        const providers = getRegisteredProviders();
        // Simulate what combo routing does: iterate to find candidates
        for (const p of providers) {
          getRegistryEntry(p);
        }
      });

      logResult(`full registry scan (${providerIds.length} providers)`, result);
      expect(result.avgMs).toBeLessThan(100); // full scan < 100ms
    });

    it("random-access lookup pattern: simulate combo routing candidate selection", () => {
      if (providerIds.length === 0) {
        console.log("  SKIP: no providers registered");
        return;
      }

      // Simulate combo routing picking random candidates
      const result = benchSync(() => {
        const picks = 10;
        for (let i = 0; i < picks; i++) {
          const idx = Math.floor(Math.random() * providerIds.length);
          const entry = getRegistryEntry(providerIds[idx]);
          // Simulate candidate evaluation (access entry fields)
          if (entry) {
            void entry.format;
            void entry.baseUrls;
          }
        }
      });

      logResult("combo candidate selection (10 random)", result);
      expect(result.avgMs).toBeLessThan(10);
    });
  });
});
