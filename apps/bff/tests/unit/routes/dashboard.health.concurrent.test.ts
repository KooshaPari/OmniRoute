import { afterEach, describe, expect, it, vi } from "vitest";

let maxConcurrentWrites = 0;
let concurrentWrites = 0;
const releaseWrites: Array<() => void> = [];

vi.mock("hono/streaming", async (importOriginal) => {
  const actual = await importOriginal<typeof import("hono/streaming")>();
  return {
    ...actual,
    streamSSE: (c: Parameters<typeof actual.streamSSE>[0], runner: Parameters<typeof actual.streamSSE>[1]) =>
      actual.streamSSE(c, async (stream) => {
        const originalWrite = stream.writeSSE.bind(stream);
        stream.writeSSE = async (payload) => {
          concurrentWrites++;
          maxConcurrentWrites = Math.max(maxConcurrentWrites, concurrentWrites);
          await new Promise<void>((resolve) => releaseWrites.push(resolve));
          try {
            return await originalWrite(payload);
          } finally {
            concurrentWrites--;
          }
        };
        await runner(stream);
      }),
  };
});

import { dashboardRoutes } from "../../../src/routes/dashboard";

afterEach(() => {
  vi.useRealTimers();
  maxConcurrentWrites = 0;
  concurrentWrites = 0;
  releaseWrites.splice(0, releaseWrites.length);
});

describe("dashboard health SSE concurrency characterization", () => {
  it("records overlapping heartbeat writes before lifecycle hardening", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const response = await dashboardRoutes.request("http://localhost/health/stream", {
      signal: controller.signal,
    });

    const reader = response.body!.getReader();
    const readLoop = (async () => {
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } catch {
        // aborted stream
      }
    })();

    await vi.advanceTimersByTimeAsync(0);
    expect(releaseWrites.length).toBeGreaterThanOrEqual(1);
    releaseWrites.shift()?.();
    await vi.advanceTimersByTimeAsync(5000);
    expect(releaseWrites.length).toBeGreaterThanOrEqual(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(releaseWrites.length).toBeGreaterThanOrEqual(2);
    expect(maxConcurrentWrites).toBeGreaterThanOrEqual(2);

    while (releaseWrites.length > 0) {
      releaseWrites.shift()?.();
    }
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    await reader.cancel();
    await readLoop;

    expect(vi.getTimerCount()).toBe(0);
  }, 15_000);
});
